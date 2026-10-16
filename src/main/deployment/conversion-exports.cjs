"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {safePath,hashFile}=require("./artifacts.cjs");
const {admitImageHeader,metadata,writeOva}=require("./output-export.cjs");
async function previewConversion({artifact,format,outputName}) {
  if (!["raw","vmdk","vdi","qcow2","iso","ova"].includes(format) || typeof outputName!=="string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(outputName) || !outputName.toLowerCase().endsWith("."+format) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(outputName)) throw new Error("invalid-conversion");
  for(const [id,p] of this.plans)if(p.expiresAt<Date.now())this.plans.delete(id);
  if(this.plans.size>=32)throw new Error("conversion-preview-limit");
  const file=safePath(this.store.root,artifact),stat=fs.statSync(file);
  if(stat.size<512||stat.size>16*1024**3)throw new Error("conversion-source-size-limit");
  const info=await this.store.inspectArtifact(artifact),inputFormat=["raw-disk","gpt-disk"].includes(info.format)?"raw":info.format;
  if(format==="iso"){if(inputFormat!=="iso9660")throw new Error("conversion-iso-requires-existing-iso");}
  else if(!["raw","vdi","vmdk","qcow2"].includes(inputFormat))throw new Error("unsupported-source-format");
  if(fs.existsSync(path.join(this.store.root,outputName)))throw new Error("conversion-output-exists");
  let virtualBytes=stat.size;
  if(format!=="iso"){
    admitImageHeader(file,inputFormat,this.convertedDisks.get(file)===info.sha256);
    const temporary=fs.mkdtempSync(path.join(this.managedDirectory,"preview-"));
    try {
      const snapshot=path.join(temporary,"input");
      fs.copyFileSync(file,snapshot,fs.constants.COPYFILE_EXCL);
      if(await hashFile(snapshot)!==info.sha256)throw new Error("conversion-source-changed");
      admitImageHeader(snapshot,inputFormat,this.convertedDisks.get(file)===info.sha256);
      virtualBytes=metadata(await this.run("qemu",["info","--output=json","-f",inputFormat,snapshot]),inputFormat)["virtual-size"];
    } finally {fs.rmSync(temporary,{recursive:true,force:true});}
  }
  if(await hashFile(file)!==info.sha256)throw new Error("conversion-source-changed");
  const id=crypto.randomUUID(),expiresAt=Date.now()+120000;
  this.plans.set(id,{id,artifact,sha256:info.sha256,format,outputName,inputFormat,expiresAt,virtualBytes});
  return {id,artifact,sha256:info.sha256,format,outputName,expiresAt,virtualBytes,destructive:false,
    operation:format==="iso"?"byte-identical-iso-copy":format==="ova"?"stream-optimized-disk-appliance":"disk-format-conversion",
    hardware:format==="ova"?{cpus:1,memoryMiB:1024,network:"none"}:null,
    warning:"Original bytes are preserved. ISO export copies an existing ISO. OVA uses one CPU, 1024 MiB RAM, SATA storage and no network. Boot and importer compatibility remain unverified."};
}
async function executeConversion({id}) {
  const p=this.plans.get(id);if(!p)throw new Error("conversion-preview-required");this.plans.delete(id);
  if(p.expiresAt<Date.now())throw new Error("conversion-preview-expired");
  const file=safePath(this.store.root,p.artifact),destination=path.join(this.store.root,p.outputName);
  if(await hashFile(file)!==p.sha256||fs.existsSync(destination))throw new Error("conversion-preview-stale");
  const temporary=fs.mkdtempSync(path.join(this.managedDirectory,"export-")),input=path.join(temporary,"input"),output=path.join(temporary,"result"),disk=path.join(temporary,"disk.vmdk");
  try {
    fs.copyFileSync(file,input,fs.constants.COPYFILE_EXCL);
    if(await hashFile(input)!==p.sha256)throw new Error("conversion-source-changed");
    if(p.format==="iso")fs.copyFileSync(input,output,fs.constants.COPYFILE_EXCL);
    else {
      admitImageHeader(input,p.inputFormat,this.convertedDisks.get(file)===p.sha256);
      const before=metadata(await this.run("qemu",["info","--output=json","-f",p.inputFormat,input]),p.inputFormat);
      if(before["virtual-size"]!==p.virtualBytes)throw new Error("conversion-source-changed");
      const targetFormat=p.format==="ova"?"vmdk":p.format,converted=p.format==="ova"?disk:output;
      await this.run("qemu",["convert","-f",p.inputFormat,"-O",targetFormat,...(p.format==="ova"?["-o","subformat=streamOptimized"]:[]),input,converted],600000);
      const produced=metadata(await this.run("qemu",["info","--output=json","-f",targetFormat,converted]),targetFormat);
      if(produced["virtual-size"]!==p.virtualBytes||!fs.statSync(converted).size)throw new Error("conversion-output-invalid");
      await this.run("qemu",["compare","-f",p.inputFormat,"-F",targetFormat,input,converted],600000);
      if(p.format==="ova")await writeOva(temporary,disk,p.virtualBytes,output);
    }
    const sha256=await hashFile(output);
    if(p.format==="iso"&&sha256!==p.sha256)throw new Error("conversion-output-invalid");
    fs.copyFileSync(output,destination,fs.constants.COPYFILE_EXCL);
    if(await hashFile(destination)!==sha256)throw new Error("conversion-copy-verification-failed");
    if(["vmdk","vdi","qcow2","raw"].includes(p.format))this.convertedDisks.set(destination,sha256);
    return {path:p.outputName,format:p.format,size:fs.statSync(destination).size,sha256,sourceSha256:p.sha256,contentVerified:true,bootVerified:false,importerCompatibilityVerified:false,overwritten:false};
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
module.exports={previewConversion,executeConversion};
