"use strict";
const crypto=require("node:crypto");
const {snapshotIsoBuild}=require("./iso-host-build-snapshot.cjs");
const {createIsoHostBuildAdapter}=require("./iso-host-build-adapter.cjs");
const {createIsoRecoveryRecords}=require("./iso-recovery-records.cjs");
const {isWslReceipt}=require("../execution/wsl-project.cjs");
const fail=()=>{throw Object.assign(Error("ISO durable host authority unverified"),{code:"ISO_DURABLE_HOST_UNVERIFIED"});};
/** Native-only bridge. Constructing it does not activate any scheduler or renderer route. */
function createDurableIsoHostBuildAdapter(options){
 const {execution,directory,recoveryDirectory,resolveProject}=options;
 const recovery=createIsoRecoveryRecords({directory:recoveryDirectory,journalDirectory:directory});
 return async function build(payload,context){
  ({payload,context}=snapshotIsoBuild(payload,context));
  const item=resolveProject(payload.workspaceId),grant=execution.grants.get(item?.grantId),receipt=grant?.wslReceipt;
  if(!isWslReceipt(receipt)||receipt.storage.distribution!==payload.runtime.distribution)fail();
  const binding=Object.freeze({jobId:context.jobId,workspaceId:payload.workspaceId,grantId:item.grantId,runtime:payload.runtime,journalKey:context.jobId,
   sourceSha256:payload.intent.sourceRevision,configurationSha256:payload.intent.configRevision,projectProofSha256:crypto.createHash("sha256").update(receipt.proof).digest("hex"),policy:payload.isoOutputPolicy});
  function current(){
   if(resolveProject(payload.workspaceId)!==item||execution.grants.get(binding.grantId)!==grant||item.grantId!==binding.grantId||grant.wslReceipt!==receipt)fail();
  }
  function recordContext(record){
   if(record.version!==1||record.jobId!==binding.jobId||record.workspaceId!==binding.workspaceId||record.phase!=="current-input")fail();
  }
  if(options.onRecoveryBinding){if(typeof options.onRecoveryBinding!=="function")fail();await options.onRecoveryBinding(binding);current();}
  let began=false;
  const adapter=createIsoHostBuildAdapter({...options,
   retainReference:async reference=>{
    current();
    if(reference.version!==1||reference.jobId!==binding.jobId||reference.workspaceId!==binding.workspaceId||reference.journalKey!==binding.journalKey)fail();
    if(reference.state==="pending"){
     if(began||reference.receiptRecordSha256!==null)fail();recovery.begin(binding);began=true;return;
    }
    if(!began)fail();recovery.recordReference(binding,{state:reference.state,receiptRecordSha256:reference.receiptRecordSha256});
   },
   checkpointCurrentOwner:async record=>{recordContext(record);current();if(!began)fail();recovery.checkpointOwner(binding,record.receipt);},
   // Cleanup is evidence persistence, allowed even after grant revocation or cancellation.
   checkpointCurrentCleanup:async record=>{recordContext(record);if(!began)fail();recovery.checkpointCleanup(binding,record.receipt,record.verdict);}
  });
  const result=await adapter(payload,context);
  if(recovery.read(binding).state!=="complete")fail();
  return result;
 };
}
module.exports={createDurableIsoHostBuildAdapter};
