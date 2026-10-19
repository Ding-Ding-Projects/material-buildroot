"use strict";
const {createDurableIsoHostBuildAdapter}=require("./iso-durable-host-adapter.cjs");
const {assertIsoOutputPolicy}=require("./iso-output-policy.cjs");
const {snapshotIsoBuild}=require("./iso-host-build-snapshot.cjs");
const fail=code=>{throw Object.assign(Error(code),{code});};
/** Scheduler adapter seam. This module alone does not activate operations-service routing. */
function createIsoScheduledBuild({hostOptions,quarantine,activeRecovery,markRecoveryUnavailable,createHostBuild=createDurableIsoHostBuildAdapter}){
 if(typeof markRecoveryUnavailable!=="function"||typeof createHostBuild!=="function")fail("ISO_SCHEDULED_ADAPTER_REQUIRED");
 return async function build(payload,context){
  const item=Object.getOwnPropertyDescriptor(context||{},"item")?.value;
  ({payload,context}=snapshotIsoBuild(payload,context));assertIsoOutputPolicy(payload.isoOutputPolicy,payload.target);
  if(typeof item!=="function")fail("ISO_SCHEDULED_ADAPTER_REQUIRED");
  try{quarantine.begin({jobId:context.jobId,workspaceId:payload.workspaceId});}catch(error){markRecoveryUnavailable();throw error;}
  activeRecovery.add(context.jobId);
  let bound;
  try{
   const host=createHostBuild({...hostOptions,onRecoveryBinding:async binding=>{
    if(bound||binding.jobId!==context.jobId||binding.workspaceId!==payload.workspaceId||binding.sourceSha256!==payload.intent.sourceRevision||binding.configurationSha256!==payload.intent.configRevision||JSON.stringify(binding.runtime)!==JSON.stringify(payload.runtime))fail("ISO_SCHEDULED_BINDING_CHANGED");
    item({kind:"iso-native-binding",binding});bound=binding;
   }});
   const result=await host(payload,context),iso=result?.iso,receipt=iso?.receipt;
   if(!bound||result.state!=="succeeded"||result.code!==0||iso.state!=="complete"||iso.bootVerified!==false||typeof iso.receiptRecordSha256!=="string"||!/^[a-f0-9]{64}$/.test(iso.receiptRecordSha256)||receipt?.jobId!==context.jobId||receipt.jobBound!==true||receipt.producerVerified!==true||receipt.cleanupVerified!==true||receipt.bootVerified!==false||typeof receipt.preparationSha256!=="string"||!/^[a-f0-9]{64}$/.test(receipt.preparationSha256)||!Number.isSafeInteger(receipt.output?.bytes)||receipt.output.bytes<1||receipt.output.bytes>4*1024**3||typeof receipt.output.sha256!=="string"||!/^[a-f0-9]{64}$/.test(receipt.output.sha256)||receipt.binding?.sourceSha256!==payload.intent.sourceRevision||receipt.binding?.configurationSha256!==payload.intent.configRevision||receipt.binding?.projectProofSha256!==bound.projectProofSha256||JSON.stringify(receipt.runtime)!==JSON.stringify(payload.runtime)||JSON.stringify(receipt.policy)!==JSON.stringify(payload.isoOutputPolicy))fail("ISO_SCHEDULED_RECEIPT_UNVERIFIED");
   item({kind:"iso-output",state:"verified",receiptRecordSha256:iso.receiptRecordSha256,receipt});
   // Clearing this live placeholder follows verified writer cleanup, not historical readback alone.
   quarantine.clear(context.jobId);
   return{state:"succeeded",code:0,iso:{state:"verified",sha256:receipt.output.sha256,bytes:receipt.output.bytes,bootVerified:false}};
  }catch(error){
   if(error.code==="QUARANTINE_UNAVAILABLE")markRecoveryUnavailable();
   item({kind:"iso-recovery",state:"required",code:/^(?:ISO_|BLOCKED_)[A-Z_]+$/.test(error.code||"")?error.code:"ISO_SCHEDULED_UNVERIFIED",bootVerified:false});
   return{state:"runtime-cleanup-failed",code:null};
  }finally{activeRecovery.delete(context.jobId);}
 };
}
function createBuildJobRouter({ordinary,iso}){
 if(typeof ordinary!=="function"||typeof iso!=="function")fail("ISO_SCHEDULED_ADAPTER_REQUIRED");
 return(payload,context)=>Object.hasOwn(payload||{},"isoOutputPolicy")?iso(payload,context):ordinary(payload,context);
}
module.exports={createIsoScheduledBuild,createBuildJobRouter};
