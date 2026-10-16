"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fail = code => { throw Object.assign(new Error(code), { code }); };
// Installation packaging supplies this exact executable and a digest manifest.
class FlashingNative {
  constructor(root, directory) { this.root=root; this.directory=directory; this.active=null; }
  capability() {
    if(process.platform!=="win32")return {available:false,reason:"Windows native helper required"};
    try {
      const file=path.join(this.root,"native","flashing","MaterialBuildroot.Flash.exe"), manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(file),"manifest.json"),"utf8"));
      if(fs.lstatSync(file).isSymbolicLink()||manifest.protocol!==1||!/^[a-f0-9]{64}$/.test(manifest.sha256)||crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")!==manifest.sha256)throw new Error();
      return {available:true,file,sha256:manifest.sha256};
    }catch{return {available:false,reason:"Packaged native helper and matching protocol-1 digest manifest unavailable"};}
  }
  async run(request) {
    if(this.active)fail("FLASH_BUSY"); const capability=this.capability();if(!capability.available)fail("FLASH_HELPER_UNAVAILABLE");
    const nonce=crypto.randomUUID(), folder=path.join(this.directory,nonce);fs.mkdirSync(folder,{recursive:true,mode:0o700});
    const requestFile=path.join(folder,"request.json");fs.writeFileSync(requestFile,JSON.stringify({version:1,nonce,diskNumber:0,identity:"",capacity:0,source:"",sha256:"",bytes:0,...request}),{flag:"wx",mode:0o600});
    this.active={folder,nonce};
    try {
      // Fixed launch protocol: shell text and arguments are never accepted from the renderer.
      const quote=value=>"'"+value.replaceAll("'","''")+"'";
      const script=`$ErrorActionPreference='Stop'; $p=Start-Process -FilePath ${quote(capability.file)} -ArgumentList ${quote('"'+requestFile+'"')} -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode`;
      const exe=path.join(process.env.SystemRoot||"C:\\Windows","System32","WindowsPowerShell","v1.0","powershell.exe");
      await new Promise((resolve,reject)=>{const child=spawn(exe,["-NoProfile","-NonInteractive","-EncodedCommand",Buffer.from(script,"utf16le").toString("base64")],{windowsHide:true,stdio:"ignore"});child.once("error",reject);child.once("exit",resolve);});
      const file=path.join(folder,"result.json");if(!fs.existsSync(file)||fs.statSync(file).size>131072)fail("FLASH_NATIVE_INCOMPLETE");
      const receipt=JSON.parse(fs.readFileSync(file,"utf8"));if(receipt.version!==1||receipt.nonce!==nonce||!["discovered","verified","incomplete","cancelled"].includes(receipt.state))fail("FLASH_RECEIPT_INVALID");
      return receipt;
    }finally{this.active=null;}
  }
  cancel(){if(!this.active)return {state:"idle"};fs.writeFileSync(path.join(this.active.folder,"cancel"),"cancel",{flag:"a",mode:0o600});return {state:"cancelling",warning:"Cancellation does not restore overwritten bytes"};}
}
module.exports={FlashingNative};
