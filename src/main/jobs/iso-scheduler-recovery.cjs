"use strict";
const fs=require("node:fs"),path=require("node:path");
const {createIsoRecoveryRecords}=require("./iso-recovery-records.cjs");
const {assertIsoOutputPolicy}=require("./iso-output-policy.cjs");
const {readIsoTransaction}=require("./iso-transaction-readback.cjs");
const {isDeepStrictEqual}=require("node:util");
/** Restore only denial reservations. Historical records never recreate project grants. */
function restoreIsoSchedulerRecovery({jobs,owner,quarantine,recoveryDirectory,journalDirectory,markRecoveryUnavailable}){
 const retained=[];
 function hold(job,reason){
  if(!quarantine.list().some(record=>record.jobId===job.id))quarantine.begin({jobId:job.id,workspaceId:job.payload.workspaceId});
  retained.push({jobId:job.id,workspaceId:job.payload.workspaceId,reason});
 }
 try{
  const all=jobs.list(owner);if(all.length>1000)throw Error("history-limit");
  const candidates=all.filter(job=>Object.hasOwn(job.payload||{},"isoOutputPolicy"));
  const inventory=[];
  if(fs.existsSync(recoveryDirectory)){
   const stat=fs.lstatSync(recoveryDirectory);if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync.native(recoveryDirectory)!==recoveryDirectory)throw Error("invalid-root");
   const iterator=fs.opendirSync(recoveryDirectory);try{for(let n=0;n<1001;n++){const entry=iterator.readSync();if(!entry)break;if(n===1000)throw Error("inventory-limit");if(!entry.isDirectory()||entry.isSymbolicLink())throw Error("invalid-entry");inventory.push(entry.name);}}finally{iterator.closeSync();}
  }
  if(inventory.some(id=>!candidates.some(job=>job.id===id)))throw Error("unbound-inventory");
  const store=inventory.length?createIsoRecoveryRecords({directory:recoveryDirectory,journalDirectory}):null;
  for(const job of candidates){
   assertIsoOutputPolicy(job.payload.isoOutputPolicy,job.payload.target);
   if(job.state==="queued"&&!inventory.includes(job.id))continue;
   let valid=false;
   try{
    if(job.itemCount>500)throw Error("item-limit");
    const records=[];for(let after=0;after<job.itemCount;after+=100)records.push(...jobs.page(job.id,"item",{after,limit:100},owner).records.map(row=>row.value));
    const bindings=records.filter(row=>row.kind==="iso-native-binding"),outputs=records.filter(row=>row.kind==="iso-output");
    if(bindings.length!==1||outputs.length!==1)throw Error("missing-native-history");
    const bound=bindings[0].binding,result=outputs[0];
    if(bound.jobId!==job.id||bound.workspaceId!==job.payload.workspaceId||bound.journalKey!==job.id||bound.sourceSha256!==job.payload.intent?.sourceRevision||bound.configurationSha256!==job.payload.intent?.configRevision||JSON.stringify(bound.runtime)!==JSON.stringify(job.payload.runtime)||JSON.stringify(bound.policy)!==JSON.stringify(job.payload.isoOutputPolicy)||result.receipt?.jobId!==job.id)throw Error("binding-changed");
    const recovered=store?.read(bound);
    const transaction=readIsoTransaction({directory:journalDirectory,expected:{jobId:bound.jobId,grantId:bound.grantId,runtime:bound.runtime,policy:bound.policy,
     binding:{sourceSha256:bound.sourceSha256,configurationSha256:bound.configurationSha256,projectProofSha256:bound.projectProofSha256},receiptRecordSha256:result.receiptRecordSha256}});
    valid=job.state==="succeeded"&&job.result?.state==="succeeded"&&job.result.code===0&&result.state==="verified"&&recovered?.state==="complete"&&recovered.reference.receiptRecordSha256===result.receiptRecordSha256&&transaction.state==="complete"&&isDeepStrictEqual(result.receipt,transaction.receipt);
   }catch{valid=false;}
   if(!valid)hold(job,"ISO_RECOVERY_REQUIRED");
  }
  return{state:"observed",retained,grantsRestored:false};
 }catch{markRecoveryUnavailable();return{state:"unknown",retained,grantsRestored:false};}
}
module.exports={restoreIsoSchedulerRecovery};
