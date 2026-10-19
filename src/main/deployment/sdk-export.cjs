"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { hashFile } = require("./artifacts.cjs");
const MAX_ARCHIVE = 4 * 1024 ** 3, MAX_EXPANDED = 16 * 1024 ** 3;
function fail(code) { throw Object.assign(new Error(code), { code }); }
function same(a,b) { return ["dev","ino","size","mtimeMs","ctimeMs"].every(k=>a[k]===b[k]); }
function safeName(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !/[\\:\x00-\x1f\x7f]/.test(value) && !value.startsWith("/") && !value.split("/").some(p=>p==="..");
}
/** Stream metadata only. Nothing is extracted, sourced, or executed. */
async function inspectSdk(file) {
  const fd=fs.openSync(file,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)), before=fs.fstatSync(fd);
  let input, stream, timer;
  try {
    if(!before.isFile() || before.size<32 || before.size>MAX_ARCHIVE)fail("SDK_ARCHIVE_SIZE_LIMIT");
    input=fs.createReadStream(file,{fd,autoClose:false});stream=zlib.createGunzip();
    input.on("error",error=>stream.destroy(error));input.pipe(stream);
    timer=setTimeout(()=>stream.destroy(Object.assign(new Error("SDK_INSPECTION_TIMEOUT"),{code:"SDK_INSPECTION_TIMEOUT"})),120000);
    let pending=Buffer.alloc(0),skip=0,expanded=0,entries=0,ended=false,zeroBlocks=0,root=null,longName=null,longLink=null,extension=null,extensionBytes=0;
    let environment=false,relocation=false;const compilers=new Set(),names=new Set();
    for await(const chunk of stream) {
      expanded+=chunk.length;if(expanded>MAX_EXPANDED)fail("SDK_EXPANDED_SIZE_LIMIT");
      pending=Buffer.concat([pending,chunk]);
      while(pending.length) {
        if(skip) {
          const used=Math.min(skip,pending.length);
          if(extension && extensionBytes) {const take=Math.min(extensionBytes,used);extension.parts.push(pending.subarray(0,take));extensionBytes-=take;}
          skip-=used;pending=pending.subarray(used);
          if(!skip&&extension){const value=Buffer.concat(extension.parts).toString("utf8").replace(/\0.*$/s,"");if(extension.type==="L")longName=value;else longLink=value;extension=null;}
          continue;
        }
        if(pending.length<512)break;
        const b=pending.subarray(0,512);pending=pending.subarray(512);
        if(b.every(x=>x===0)){zeroBlocks++;if(zeroBlocks>=2)ended=true;continue;}
        if(ended||zeroBlocks)fail("SDK_ARCHIVE_TRAILING_DATA");
        const text=(a,n)=>b.subarray(a,a+n).toString("utf8").replace(/\0.*$/s,"");
        const octal=(a,n)=>{const s=text(a,n).trim();if(!/^[0-7]+$/.test(s))fail("SDK_ARCHIVE_HEADER");return parseInt(s,8);};
        if(octal(148,8)!==b.reduce((s,v,i)=>s+(i>=148&&i<156?32:v),0))fail("SDK_ARCHIVE_CHECKSUM");
        const size=octal(124,12),type=String.fromCharCode(b[156]||48);
        if(!Number.isSafeInteger(size)||size>MAX_EXPANDED)fail("SDK_ARCHIVE_SIZE_LIMIT");
        skip=Math.ceil(size/512)*512;
        if(type==="L"||type==="K") {if(size<1||size>4096||extension||(type==="L"?longName:longLink)!==null)fail("SDK_ARCHIVE_EXTENSION_LIMIT");extension={type,parts:[]};extensionBytes=size;continue;}
        if(!["0","1","2","5"].includes(type))fail("SDK_ARCHIVE_UNSUPPORTED_ENTRY");
        if(++entries>100000)fail("SDK_ARCHIVE_ENTRY_LIMIT");
        const prefix=b.subarray(257,263).equals(Buffer.from("ustar\0"))?text(345,155):"";let name=longName || ((prefix?prefix+"/":"")+text(0,100));longName=null;
        name=name.replace(/^\.\//,"").replace(/\/$/,"");
        if(!safeName(name)||names.has(name))fail("SDK_ARCHIVE_PATH");names.add(name);
        const top=name.split("/")[0];if(!root)root=top;if(root!==top)fail("SDK_ARCHIVE_MULTIPLE_ROOTS");
        const link=longLink || text(157,100);longLink=null;
        if(type==="1"||type==="2") {
          if(!link||link.length>4096||/[\\:\x00-\x1f\x7f]/.test(link)||path.posix.isAbsolute(link)||size)fail("SDK_ARCHIVE_LINK");
          const resolved=path.posix.normalize(type==="1"?link:path.posix.join(path.posix.dirname(name),link));
          if(resolved!==root&&!resolved.startsWith(root+"/"))fail("SDK_ARCHIVE_LINK_ESCAPE");
        } else if(type==="5"&&size)fail("SDK_ARCHIVE_DIRECTORY");
        if(name===root+"/environment-setup"&&type==="0")environment=true;
        if(name===root+"/relocate-sdk.sh"&&type==="0")relocation=true;
        if(name.startsWith(root+"/bin/") && /^[A-Za-z0-9_.+-]+-gcc$/.test(name.slice(root.length+5)))compilers.add(path.posix.basename(name));
        if(compilers.size>32)fail("SDK_COMPILER_LIMIT");
      }
    }
    if(!ended||pending.length||skip||extension||longName||longLink||!root||!relocation||!compilers.size)fail("SDK_ARCHIVE_INCOMPLETE");
    if(!same(before,fs.fstatSync(fd)))fail("SDK_SOURCE_CHANGED");
    return {root,entries,expandedBytes:expanded,environmentSetup:environment,relocationScript:relocation,compilerNames:[...compilers].sort(),archivePolicy:"metadata-only-no-extraction",toolchainExecuted:false};
  } catch(error) { if(typeof error.code==="string"&&error.code.startsWith("SDK_"))throw error;fail("SDK_ARCHIVE_UNREADABLE"); }
  finally {clearTimeout(timer);input?.destroy();stream?.destroy();fs.closeSync(fd);}
}
function instructions(info) {
  return `# Buildroot SDK handoff\n\nThis bundle preserves the original sdk.tar.gz bytes. It does not contain a Windows-native compiler. Use a compatible Linux host (WSL 2 or a Linux container), as an ordinary non-root user.\n\n1. Compare sdk.tar.gz SHA-256 with sdk-export.json before transfer and after transfer.\n2. Inspect the archive and its scripts before extracting into a new empty directory. No extraction was performed by this application.\n3. In the extracted SDK root, review and run ./relocate-sdk.sh using the SDK's documented Linux environment. Relocation executes SDK-supplied code; this application never executes it.\n4. ${info.environmentSetup ? "Review environment-setup before sourcing it in a disposable shell. Sourcing executes SDK-supplied code." : "No regular environment-setup file was observed. Do not invent or source one. Use the SDK bin directory and explicit cross-compiler paths according to its Buildroot version documentation."}\n5. Observed compiler file names: ${info.compilerNames.join(", ")}. Names alone do not establish compiler functionality, target ABI, C library, or host compatibility.\n6. Build a small consumer in that Linux environment, check its architecture and ABI, and run only on the intended target. This step has not been performed.\n\nArchive inspection accepts bounded traditional/GNU tar metadata and relative links contained within one root. PAX, special files, duplicate paths, absolute links, escaping links and oversized archives are unsupported. Metadata admission is not a security assessment of executable SDK content.\n\nThe source/configuration locks and available successful-job binding are recorded in sdk-export.json. A current-input observation is not proof this SDK was produced by those inputs. No toolchain-content lock, environment-content lock, fresh-build, consumer-build, or runtime acceptance is claimed.\n`;
}
class SdkExport {
  constructor({viewer,manifest}) {this.viewer=viewer;this.manifest=manifest;this.plans=new Map();}
  async preview(fileId) {
    const source=this.viewer.resolve(fileId,"file");
    if(!/^[^/\\]+_sdk-buildroot\.tar\.gz$/.test(path.basename(source.file)) && !/\.tar\.gz$/i.test(source.file))fail("SDK_ARCHIVE_FORMAT");
    const info=await inspectSdk(source.file),manifest=await this.manifest(source.grant.relative.split(path.sep).join("/"));
    this.viewer.resolve(fileId,"file");
    if(manifest.entries.length!==1||manifest.entries[0].size!==source.current.size)fail("SDK_SOURCE_CHANGED");
    for(const [id,p] of this.plans)if(p.expiresAt<Date.now())this.plans.delete(id);
    if(this.plans.size>=8)fail("SDK_PREVIEW_LIMIT");
    const id=crypto.randomUUID(),folder=`sdk-export-${id}`,expiresAt=Date.now()+120000;
    const plan={id,fileId,folder,expiresAt,info,manifest};this.plans.set(id,plan);
    return {id,folder,expiresAt,info,manifest,instructions:instructions(info),consumerBuildVerified:false};
  }
  async execute(id) {
    const plan=this.plans.get(id);if(!plan)fail("SDK_PREVIEW_REQUIRED");this.plans.delete(id);
    if(plan.expiresAt<Date.now())fail("SDK_PREVIEW_EXPIRED");
    const source=this.viewer.resolve(plan.fileId,"file"),root=this.viewer.resolve("root","directory").file;
    const current=await this.manifest(source.grant.relative.split(path.sep).join("/"));
    if(current.digest!==plan.manifest.digest)fail("SDK_PREVIEW_STALE");
    const destination=path.join(root,plan.folder);
    fs.mkdirSync(destination,{recursive:false,mode:0o700});
    // Failed publication is retained, never recursively removed or reported complete.
    try {
      const archive=path.join(destination,"sdk.tar.gz");
      fs.copyFileSync(source.file,archive,fs.constants.COPYFILE_EXCL);
      this.viewer.resolve(plan.fileId,"file");
      const sha256=await hashFile(archive);
      if(sha256!==plan.manifest.entries[0].sha256)fail("SDK_COPY_CHANGED");
      const receipt={schemaVersion:1,format:"buildroot-sdk-export",exportedAt:new Date().toISOString(),archive:{name:"sdk.tar.gz",size:fs.statSync(archive).size,sha256},source:current,inspection:plan.info,toolchainContentHash:null,environmentContentHash:null,consumerBuildVerified:false,runtimeVerified:false,overwritten:false};
      const content=JSON.stringify(receipt,null,2)+"\n";if(Buffer.byteLength(content)>1024*1024)fail("SDK_RECEIPT_SIZE_LIMIT");
      fs.writeFileSync(path.join(destination,"README.md"),instructions(plan.info),{flag:"wx",mode:0o600});
      fs.writeFileSync(path.join(destination,"sdk-export.json"),content,{flag:"wx",mode:0o600});
      return {folder:plan.folder,instructionsId:this.viewer.admit(path.join(plan.folder,"README.md"),"file"),receiptId:this.viewer.admit(path.join(plan.folder,"sdk-export.json"),"file"),sha256,size:receipt.archive.size,receiptSha256:crypto.createHash("sha256").update(content).digest("hex"),consumerBuildVerified:false,runtimeVerified:false,overwritten:false};
    } catch {fail("SDK_EXPORT_INCOMPLETE_RETAINED");}
  }
}
module.exports={SdkExport};


