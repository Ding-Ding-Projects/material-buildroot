"use strict";
const path=require("node:path"),crypto=require("node:crypto");
const {isWslReceipt}=require("../execution/wsl-project.cjs");
const {captureWslBuildIntent}=require("./wsl-build-intent.cjs");
const {createIsoProducerTransactions}=require("../execution/iso-producer-transaction.cjs");
const {createLeasedWslIsoOutputLifecycle}=require("../execution/wsl-iso-output-lifecycle.cjs");
const {createIsoWslProducer}=require("../execution/iso-wsl-producer.cjs");
const {readIsoTransaction}=require("./iso-transaction-readback.cjs");
const {assertIsoOutputPolicy}=require("./iso-output-policy.cjs");
const {snapshotIsoBuild}=require("./iso-host-build-snapshot.cjs");
const fail=code=>{throw Object.assign(Error(code),{code});};
/** Host-only composition. Required durable hooks are not supplied by the current scheduler. */
function createIsoHostBuildAdapter({execution,directory,resolveProject,authorize,retainReference,checkpointCurrentOwner,checkpointCurrentCleanup,run,checkpoint,signalScript}){
 if(typeof directory!=="string"||!path.isAbsolute(directory)||[resolveProject,authorize,retainReference,checkpointCurrentOwner,checkpointCurrentCleanup,run,checkpoint].some(fn=>typeof fn!=="function")||typeof signalScript!=="string")fail("ISO_HOST_ADAPTER_REQUIRED");
 return async function build(payload,context){
  ({payload,context}=snapshotIsoBuild(payload,context));
  assertIsoOutputPolicy(payload?.isoOutputPolicy,payload?.target);
  if(payload.runtime?.kind!=="wsl"||typeof context?.jobId!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(context.jobId)||payload.intent?.projectId!==payload.workspaceId||!Number.isInteger(payload.jobs)||payload.jobs<1||payload.jobs>32)fail("ISO_HOST_REQUEST_INVALID");
  await authorize(payload,context);
  const item=resolveProject(payload.workspaceId),grant=execution.grants.get(item?.grantId),receipt=grant?.wslReceipt;
  if(!isWslReceipt(receipt)||item.storage?.kind!=="wsl"||item.externalStateVerified!==true||item.externalTrees?.length||item.runtime?.kind!=="wsl"||item.runtime.distribution!==payload.runtime.distribution||receipt.storage.distribution!==payload.runtime.distribution)fail("ISO_HOST_AUTHORITY_REQUIRED");
  const roots=[grant.root,grant.source,grant.output],runtime=Object.freeze({...payload.runtime});
  function currentProject(){
   if(context.signal?.aborted)fail("ISO_HOST_CANCELLED");
   if(resolveProject(payload.workspaceId)!==item||execution.grants.get(item.grantId)!==grant||grant.wslReceipt!==receipt||item.externalStateVerified!==true||item.externalTrees?.length||item.runtime.kind!==runtime.kind||item.runtime.distribution!==runtime.distribution||roots.some((root,i)=>root!==[grant.root,grant.source,grant.output][i])||item.source!==grant.source||item.output!==grant.output)fail("ISO_HOST_AUTHORITY_CHANGED");
  }
  // This reference must be durable before the first current-input helper can be launched.
  const reference={version:1,jobId:context.jobId,workspaceId:payload.workspaceId,journalKey:context.jobId,receiptRecordSha256:null,state:"pending"};
  await retainReference(reference);currentProject();
  let lifecycle,producer,expectedBinding;
  const transactions=createIsoProducerTransactions({execution,directory,adapters:{
   current:async()=>{
    currentProject();await authorize(payload,context);currentProject();
    await execution.verifyWslGrant(grant,runtime);currentProject();
    const captured=await captureWslBuildIntent({execution,grantId:item.grantId,runtime,source:item.source,output:item.output,externalTrees:[],signal:context.signal,
     onOwnership:async owner=>{currentProject();await checkpointCurrentOwner({version:1,jobId:context.jobId,workspaceId:payload.workspaceId,phase:"current-input",receipt:owner});currentProject();},
     onCleanup:async(owner,verdict)=>{await checkpointCurrentCleanup({version:1,jobId:context.jobId,workspaceId:payload.workspaceId,phase:"current-input",receipt:owner,verdict});currentProject();}});
    currentProject();
    if(captured.sourceRevision!==payload.intent?.sourceRevision||captured.configRevision!==payload.intent?.configRevision||captured.configRevision!==payload.isoOutputPolicy.appliedConfigurationRevision)fail("ISO_HOST_INPUT_CHANGED");
    return expectedBinding={sourceSha256:captured.sourceRevision,configurationSha256:captured.configRevision,projectProofSha256:crypto.createHash("sha256").update(receipt.proof).digest("hex")};
   },
   validateOwner:value=>execution.validateOwnershipReceipt(value),inspectCleanup:value=>execution.reconcileCleanup(value),
   prepare:(input,options)=>lifecycle({grantId:input.grantId,runtime:input.runtime,jobId:input.jobId,operation:"prepare"},{...options,lease:input.lease}),
   produce:(input,options)=>producer(input,options),
   capture:(input,options)=>lifecycle({grantId:input.grantId,runtime:input.runtime,jobId:input.jobId,operation:"capture",preparationSha256:input.preparationSha256},{...options,lease:input.lease})
  }});
  lifecycle=createLeasedWslIsoOutputLifecycle({execution,run,checkpoint,signalScript},transactions);
  producer=createIsoWslProducer({execution,transactions,jobs:payload.jobs,onLog:context.log});
  const request={grantId:item.grantId,runtime,jobId:context.jobId,policy:payload.isoOutputPolicy};
  const result=await transactions.run(request,{signal:context.signal});currentProject();
  // Persist the trusted anchor before verifying readback. No reference is cleared here.
  await retainReference({...reference,state:"receipt-recorded",receiptRecordSha256:result.receiptRecordSha256});currentProject();
  const readback=readIsoTransaction({directory,expected:{...request,binding:expectedBinding,receiptRecordSha256:result.receiptRecordSha256}});
  if(readback.state!=="complete")fail("ISO_HOST_READBACK_UNVERIFIED");
  await retainReference({...reference,state:"verified",receiptRecordSha256:result.receiptRecordSha256});currentProject();
  return{state:"succeeded",code:0,iso:{...readback,bootVerified:false}};
 };
}
module.exports={createIsoHostBuildAdapter};
