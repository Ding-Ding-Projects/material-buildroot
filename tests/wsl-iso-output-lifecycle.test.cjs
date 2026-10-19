"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {validateOwnershipReceipt,ExecutionService}=require("../src/main/execution/index.cjs");
const JOB="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",BOOT="01234567-89ab-4def-8123-456789abcdef",HASH="b".repeat(64);
function fixture(mode={}){
 const receipt=Object.freeze({storage:Object.freeze({distribution:"Fixture",rootLinux:"/home/fixture/material-buildroot",sourceLinux:"/home/fixture/material-buildroot/source",outputLinux:"/home/fixture/material-buildroot/output"}),proof:BOOT+"\n"+"a".repeat(32)+"\n1000\n1:10\n1:11\n1:12"});
 const grant={wslReceipt:receipt,root:"root",source:"source",output:"output"},calls=[],writes=[];let stopped=false,finish;
 const execution={grants:new Map([["grant",grant]]),locks:new Set(),executables:{wsl:"fixture-wsl"},validateOwnershipReceipt,reconcileCleanup:async owner=>{
  calls.push({inspect:owner});if(mode.namespaceChanged)return{state:"unknown",reason:"runtime-namespace-changed"};return stopped?(mode.unknownCleanup?{state:"unknown",reason:"runtime-unavailable"}:{state:"verified-stopped",reason:"owned-session-absent"}):{state:"unknown",reason:"owned-runtime-active"};
 }};
 const processRun=(file,args,options)=>{
  calls.push({file,args,options});
  if(!args.includes("setsid")){stopped=true;return{completion:Promise.resolve({state:"succeeded",code:0})};}
  stopped=false;const completion=new Promise(resolve=>finish=resolve);
  const job={completion,cancel(){Promise.resolve().then(options.onTerminate).then(()=>finish({state:"cancelled",code:null}),()=>finish({state:"runtime-cleanup-failed",code:null}));},writeInput(input){
   const parsed=JSON.parse(input);writes.push(parsed);if(mode.abort){mode.abort.abort();return true;}if(mode.timeout){Promise.resolve().then(options.onTerminate).then(()=>finish({state:"timed-out",code:null}));return true;}
   if(mode.revokeAfterInput)execution.grants.delete("grant");stopped=true;
   const result=parsed.request.operation==="prepare"?{state:"prepared-unbound",preparationSha256:HASH,jobId:JOB,prior:null,jobBound:false,bootVerified:false}:{state:"fresh-file-observed-unbound",preparationSha256:HASH,jobId:JOB,output:{sha256:HASH,bytes:51200,identity:Array(9).fill("1"),structure:{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false}},jobBound:false,producerVerified:false,cleanupVerified:false,bootVerified:false};
   mode.changeResponse?.(result);queueMicrotask(()=>finish({state:"succeeded",code:0,stdout:JSON.stringify({ok:true,result})}));return true;
  }};
  queueMicrotask(()=>options.onLog({stream:"stderr",text:"MATERIAL_ISO_OWNER="+JSON.stringify({bootId:mode.badBoot?"ffffffff-ffff-4fff-8fff-ffffffffffff":BOOT,pidNamespace:"pid:[123]",pid:1234,startTime:"98765"})+"\n"}));return job;
 };
 const file=require.resolve("../src/main/execution/wsl-iso-output-lifecycle.cjs"),loaded={exports:{}};
 vm.runInThisContext(require("node:module").wrap(fs.readFileSync(file,"utf8")),{filename:file})(loaded.exports,name=>name==="./wsl-project.cjs"?{isWslReceipt:value=>value===receipt,verifyWslProject:async value=>{assert.equal(value,receipt);calls.push({verify:true});}}:require(name),loaded,file,path.dirname(file));
 const transportOptions={execution,run:processRun,checkpoint:async(callback,owner)=>callback(owner),signalScript:"fixed-existing-signal"};
 const lifecycle=loaded.exports.createWslIsoOutputLifecycle(transportOptions);
 const request={grantId:"grant",runtime:{kind:"wsl",distribution:"Fixture"},operation:"prepare",jobId:JOB};
 return{lifecycle,request,execution,calls,writes,receipt,leased:transactions=>loaded.exports.createLeasedWslIsoOutputLifecycle(transportOptions,transactions),options:{onOwnership:async(owner,stage)=>{calls.push({checkpoint:owner,stage});if(mode.revokeAtCheckpoint)execution.grants.delete("grant");},...(mode.abort?{signal:mode.abort.signal}:{})}};
}
test("real transport rejects forged receipt, unsupported runtime and renderer-shaped extras without native access",async()=>{
 const real=new ExecutionService();real.grants.set("forged",{wslReceipt:{}});
 await assert.rejects(real.runIsoOutputLifecycle({grantId:"forged",runtime:{kind:"wsl",distribution:"Fixture"},operation:"prepare",jobId:JOB},{onOwnership:async()=>{}}),{code:"ISO_LIFECYCLE_AUTHORITY_REQUIRED"});
 const f=fixture();for(const extra of [{outputRoot:"/other"},{admittedOutputIdentity:{device:"1",inode:"12",uid:"1000"}},{command:"anything"}])await assert.rejects(f.lifecycle({...f.request,...extra},f.options),{code:"ISO_LIFECYCLE_INVALID_REQUEST"});
 await assert.rejects(f.lifecycle({...f.request,runtime:{kind:"docker",distribution:"Fixture"}},f.options),{code:"ISO_LIFECYCLE_AUTHORITY_REQUIRED"});
 await assert.rejects(f.lifecycle(f.request,{}),{code:"ISO_LIFECYCLE_AUTHORITY_REQUIRED"});assert.equal(f.calls.length,0);
});
test("fixed transport derives root identity and checkpoints exact active namespace before helper input",async()=>{
 const f=fixture(),result=await f.lifecycle(f.request,f.options);assert.equal(result.state,"succeeded");assert.equal(result.observation.jobBound,false);assert.equal(result.observation.bootVerified,false);
 const sent=f.writes[0];assert.equal(sent.request.outputRoot,f.receipt.storage.outputLinux);assert.deepEqual(sent.request.admittedOutputIdentity,{device:"1",inode:"12",uid:"1000"});assert.equal(sent.pidNamespace,"pid:[123]");assert.equal(sent.proof,f.receipt.proof);assert.match(Buffer.from(sent.helper,"base64").toString(),/admittedOutputIdentity/);
 const native=f.calls.find(call=>call.args?.includes("setsid"));assert.equal(native.args.includes("--wait"),true);assert.equal(native.options.timeoutMs,70000);assert.equal(native.options.inputPipe,true);assert.equal(f.calls.filter(call=>call.checkpoint).length,1);assert.deepEqual(result.stage,{operation:"prepare",jobId:JOB});assert.equal(result.cleanup.state,"verified-stopped");assert.equal(f.execution.locks.size,0);
});
test("durable ownership callback settles before mutating input is released",async()=>{
 const f=fixture();let release,reached;const arrived=new Promise(resolve=>reached=resolve);const pending=f.lifecycle(f.request,{onOwnership:async()=>{reached();await new Promise(resolve=>release=resolve);}});await arrived;assert.equal(f.writes.length,0);assert.equal(f.execution.locks.size,3);release();assert.equal((await pending).state,"succeeded");
});
test("stale grants and conflicting execution locks reject before native launch",async()=>{
 const stale=fixture();stale.execution.grants.delete("grant");await assert.rejects(stale.lifecycle(stale.request,stale.options),{code:"ISO_LIFECYCLE_AUTHORITY_REQUIRED"});assert.equal(stale.calls.length,0);
 const busy=fixture();busy.execution.locks.add("output");await assert.rejects(busy.lifecycle(busy.request,busy.options),{code:"ISO_LIFECYCLE_PROJECT_BUSY"});assert.equal(busy.calls.length,0);assert.deepEqual([...busy.execution.locks],["output"]);
});
test("failed checkpoint and admission boot mismatch never release helper input",async()=>{
 const checkpoint=fixture(),failed=await checkpoint.lifecycle(checkpoint.request,{onOwnership:async()=>{throw Error("fixture checkpoint failure");}});assert.equal(checkpoint.writes.length,0);assert.equal(failed.state,"failed");assert.equal(failed.observation,null);
 const boot=fixture({badBoot:true}),changed=await boot.lifecycle(boot.request,boot.options);assert.equal(boot.writes.length,0);assert.notEqual(changed.state,"succeeded");
});
test("checkpoint revocation and changed namespace withhold input and retain unknown cleanup",async()=>{
 const revoked=fixture({revokeAtCheckpoint:true}),r=await revoked.lifecycle(revoked.request,revoked.options);assert.equal(revoked.writes.length,0);assert.notEqual(r.state,"succeeded");
 const changed=fixture({namespaceChanged:true}),c=await changed.lifecycle(changed.request,changed.options);assert.equal(changed.writes.length,0);assert.equal(c.state,"runtime-cleanup-failed");assert.equal(c.observation,null);
});
test("abort and simulated hard timeout signal only the exact owned session",async()=>{
 for(const mode of [{abort:new AbortController()},{timeout:true}]){const f=fixture(mode),result=await f.lifecycle(f.request,f.options);assert.equal(result.state,mode.abort?"cancelled":"failed");if(mode.timeout)assert.equal(result.errorCode,"ISO_LIFECYCLE_TIMED_OUT");assert.equal(result.cleanup.state,"verified-stopped");assert.equal(result.observation,null);const signal=f.calls.find(call=>call.args?.includes("signal"));assert.deepEqual(signal.args.slice(-5),["1234","98765",BOOT,"KILL","pid:[123]"]);assert.equal(signal.options.timeoutMs,5000);}
});
test("unknown final cleanup and revoked admission never admit successful observations",async()=>{
 for(const mode of [{unknownCleanup:true},{revokeAfterInput:true}]){const f=fixture(mode),result=await f.lifecycle(f.request,f.options);assert.notEqual(result.state,"succeeded");assert.equal(result.observation,null);if(mode.unknownCleanup)assert.equal(result.state,"runtime-cleanup-failed");assert.equal(f.execution.locks.size,0);}
});
test("capture preserves unbound flags and rejects optimistic or private response additions",async()=>{
 const f=fixture(),request={...f.request,operation:"capture",preparationSha256:HASH};const result=await f.lifecycle(request,f.options);assert.equal(result.state,"succeeded");assert.equal(result.observation.producerVerified,false);assert.equal(result.observation.cleanupVerified,false);
 for(const changeResponse of [value=>value.jobBound=true,value=>value.privatePath="/private",value=>value.output.sha256=[HASH]]){const invalid=fixture({changeResponse});const reply=await invalid.lifecycle({...invalid.request,operation:"capture",preparationSha256:HASH},invalid.options);assert.equal(reply.state,"failed");assert.equal(reply.observation,null);}
});

function transactionFixture(t,mode={}){
 const os=require("node:os"),{createIsoProducerTransactions}=require("../src/main/execution/iso-producer-transaction.cjs"),{createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs");
 const f=fixture(mode),directory=fs.mkdtempSync(path.join(os.tmpdir(),"iso-leased-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 let bridge,transactions;const stages=[];
 async function call(operation,input,options){
  const request={...f.request,operation,...(operation==="capture"?{preparationSha256:input.preparationSha256}:{})};
  stages.push(operation);
  if(operation==="prepare"&&mode.checkBoundaries){
   const context={execution:f.execution,jobId:JOB,grantId:"grant",runtime:f.request.runtime,roots:["root","source","output"]};
   transactions.assertLifecycleLease(input.lease,context);
   for(const changed of [{execution:{}},{grantId:"other"},{runtime:{kind:"wsl",distribution:"Other"}},{roots:["root","source","other"]}])assert.throws(()=>transactions.assertLifecycleLease(input.lease,{...context,...changed}),{code:"ISO_TRANSACTION_LEASE_REQUIRED"});
   await assert.rejects(bridge(request,{...options,lease:{}}),{code:"ISO_TRANSACTION_LEASE_REQUIRED"});
   await assert.rejects(bridge({...request,jobId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"},{...options,lease:input.lease}),{code:"ISO_TRANSACTION_LEASE_REQUIRED"});
   await assert.rejects(f.lifecycle(request,f.options),{code:"ISO_LIFECYCLE_PROJECT_BUSY"});
   await assert.rejects(f.lifecycle(request,{...f.options,lease:input.lease}),{code:"ISO_LIFECYCLE_AUTHORITY_REQUIRED"});
  }
  const result=await bridge(request,{...options,lease:input.lease,onOwnership:async(owner,stage)=>{await f.options.onOwnership(owner,stage);await options.onOwnership(owner);}});
  assert.equal(f.execution.locks.size,3);return result;
 }
 transactions=createIsoProducerTransactions({execution:f.execution,directory,adapters:{
  current:async()=>({sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:HASH}),validateOwner:validateOwnershipReceipt,
  inspectCleanup:async()=>({state:"verified-stopped"}),
  prepare:(input,options)=>call("prepare",input,options),capture:(input,options)=>call("capture",input,options),
  produce:async(input,options)=>{
   assert.equal(f.execution.locks.size,3);stages.push("produce");
   await assert.rejects(f.lifecycle(f.request,f.options),{code:"ISO_LIFECYCLE_PROJECT_BUSY"});
   const producerOwner={version:1,kind:"wsl",ownerToken:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",distribution:"Fixture",bootId:BOOT,pidNamespace:"pid:[123]",pid:1234,startTime:"98765"};
   await options.onOwnership({...producerOwner,pid:null,startTime:null});await options.onOwnership(producerOwner);
   return{state:"succeeded",code:0};
  }
 }});bridge=f.leased(transactions);
 return{...f,transactions,stages,transactionRequest:{grantId:"grant",jobId:JOB,runtime:f.request.runtime,policy:createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"})}};
}
test("internal lifecycle bridge borrows transaction locks across prepare and capture",async t=>{
 const f=transactionFixture(t,{checkBoundaries:true});const result=await f.transactions.run(f.transactionRequest);
 assert.equal(result.receipt.jobBound,true);assert.equal(result.receipt.bootVerified,false);assert.deepEqual(f.stages,["prepare","produce","capture"]);assert.equal(f.execution.locks.size,0);assert.equal(f.writes.length,2);
});
for(const mode of [{revokeAtCheckpoint:true},{unknownCleanup:true},{abort:new AbortController()}]){
 test(`borrowed locks survive lifecycle ${Object.keys(mode)[0]}`,async t=>{
  const f=transactionFixture(t,mode);
  await assert.rejects(f.transactions.run(f.transactionRequest,{...(mode.abort?{signal:mode.abort.signal}:{})}));
  assert.equal(f.execution.locks.size,3);assert.deepEqual(f.stages,["prepare"]);
  if(mode.revokeAtCheckpoint)assert.equal(f.writes.length,0);
 });
}
