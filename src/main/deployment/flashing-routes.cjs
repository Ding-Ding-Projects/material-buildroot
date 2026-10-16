"use strict";
const { randomUUID }=require("node:crypto");
const fail=code=>{throw Object.assign(new Error(code),{code});};
class FlashingRoutes {
  constructor({viewer,native,guests,confirm}){Object.assign(this,{viewer,native,guests,confirm});this.devices=new Map();this.plans=new Map();this.busy=false;this.cancelled=false;}
  state(){const c=this.native.capability();return {physicalAvailable:c.available,reason:c.reason||"Native consent and elevation required",active:this.busy};}
  async discover(){if(this.busy)fail("FLASH_BUSY");this.devices.clear();const r=await this.native.run({operation:"discover"});if(r.state!=="discovered"||!Array.isArray(r.result))return r;for(const d of r.result){if(!Number.isSafeInteger(d.id)||!Number.isSafeInteger(d.capacity)||!/^[a-f0-9]{64}$/.test(d.identity))fail("FLASH_RECEIPT_INVALID");this.devices.set(String(d.id),d);}return {state:r.state,devices:r.result};}
  async source(fileId){const info=await this.viewer.inspect(fileId),hash=await this.viewer.checksum(fileId,"");const {grant}=this.viewer.resolve(fileId,"file");return {fileId,name:info.name,relative:grant.relative,format:info.format,bytes:info.size,sha256:hash.sha256};}
  async preview({fileId,route,destinationId}){
    if(this.busy)fail("FLASH_BUSY");for(const [id,p]of this.plans)if(p.expiresAt<Date.now())this.plans.delete(id);if(this.plans.size>=16)fail("FLASH_PREVIEW_LIMIT");
    if(!["physical","iso-guest"].includes(route))fail("FLASH_INVALID_ROUTE");const source=await this.source(fileId);
    if(route==="physical"&&!(["raw-disk","gpt-disk","iso9660"].includes(source.format)&&source.bytes>0&&source.bytes%512===0))fail("FLASH_IMAGE_UNSUPPORTED");
    if(route==="iso-guest"&&source.format!=="iso9660")fail("FLASH_ISO_REQUIRED");
    const destination=route==="physical"?this.devices.get(destinationId):{id:destinationId,name:destinationId};
    if(!destination||route==="physical"&&(!destination.eligible||destination.capacity<source.bytes)||route==="iso-guest"&&!["virtualbox","vmware"].includes(destinationId))fail("FLASH_DESTINATION_UNSAFE");
    const plan={id:randomUUID(),route,source,destination,expiresAt:Date.now()+120000};this.plans.set(plan.id,plan);return plan;
  }
  async execute({id,reviewedIdentity}){
    if(this.busy)fail("FLASH_BUSY");const p=this.plans.get(id);this.plans.delete(id);if(!p||p.expiresAt<Date.now()||reviewedIdentity!==(p.destination.identity||p.destination.id))fail("FLASH_CONFIRMATION_REQUIRED");
    this.busy=true;this.cancelled=false;
    try{
      const current=await this.source(p.source.fileId);if(current.sha256!==p.source.sha256||current.bytes!==p.source.bytes||current.format!==p.source.format)fail("FLASH_SOURCE_CHANGED");
      if(!await this.confirm(p))return {state:"cancelled",written:0};
      if(this.cancelled)return {state:"cancelled",written:0};
      if(p.expiresAt<Date.now())fail("FLASH_PREVIEW_EXPIRED");
      const {file}=this.viewer.resolve(p.source.fileId,"file");
      if(p.route==="physical")return await this.native.run({operation:"write",diskNumber:p.destination.id,identity:p.destination.identity,capacity:p.destination.capacity,source:file,sha256:p.source.sha256,bytes:p.source.bytes});
      const after=await this.source(p.source.fileId);if(after.sha256!==p.source.sha256)fail("FLASH_SOURCE_CHANGED");
      const guest=await this.guests.createGuest({provider:p.destination.id,hardware:{network:"none"},storage:[{slot:0,kind:"iso",artifact:current.relative}]});
      return {state:"guest-created-installation-pending",guest,installationVerified:false,warning:"Guest has installation media only. Add an owned blank disk and explicitly launch from Virtual machines. Creating a guest does not install an operating system."};
    }finally{this.busy=false;}
  }
  cancel(id){this.plans.delete(id);if(this.busy)this.cancelled=true;return this.native.cancel();}
}
module.exports={FlashingRoutes};
