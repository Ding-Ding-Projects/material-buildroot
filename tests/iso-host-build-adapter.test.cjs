"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),vm=require("node:vm"),Module=require("node:module");
const {validateOwnershipReceipt}=require("../src/main/execution/index.cjs"),{createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs");
const HASH="a".repeat(64),JOB="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function fixture(t,mode={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"iso-host-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const receipt={storage:{distribution:"Fixture"},proof:"native admitted fixture proof"},grant={root:"root",source:"source",output:"output",wslReceipt:receipt},item={grantId:"grant",source:"source",output:"output",storage:{kind:"wsl"},runtime:{kind:"wsl",distribution:"Fixture"},externalStateVerified:true,externalTrees:[]},calls=[];
 const owner={version:1,kind:"wsl",ownerToken:JOB,distribution:"Fixture",bootId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pidNamespace:"pid:[123]",pid:42,startTime:"456"};
 const execution={grants:new Map([["grant",grant]]),locks:new Set(),validateOwnershipReceipt,verifyWslGrant:async()=>calls.push("verify"),reconcileCleanup:async()=>({state:"verified-stopped",reason:"owned-session-absent"})};
 const file=require.resolve("../src/main/jobs/iso-host-build-adapter.cjs"),loaded={exports:{}};
 const substitutes={
  "../execution/wsl-project.cjs":{isWslReceipt:value=>value===receipt&&!mode.forged},
  "./wsl-build-intent.cjs":{captureWslBuildIntent:async options=>{const currentOwner={...owner,ownerToken:require("node:crypto").randomUUID()};calls.push("current-launch");await options.onOwnership(currentOwner);calls.push("current-input");await options.onCleanup(currentOwner,{state:mode.unknownCurrentCleanup?"unknown":"verified-stopped",reason:mode.unknownCurrentCleanup?"runtime-unavailable":"owned-session-absent"});if(mode.unknownCurrentCleanup)throw Error("current cleanup unknown");return{sourceRevision:mode.capturedRevision||(mode.changed?"b".repeat(64):HASH),configRevision:mode.capturedRevision||HASH};}},
  "../execution/wsl-iso-output-lifecycle.cjs":{createLeasedWslIsoOutputLifecycle:()=>async(request,options)=>{calls.push(request.operation);await options.onOwnership(owner);return{state:"succeeded",code:0,observation:request.operation==="prepare"?{state:"prepared-unbound",jobId:JOB,preparationSha256:HASH,prior:null,jobBound:false,bootVerified:false}:{state:"fresh-file-observed-unbound",jobId:JOB,preparationSha256:HASH,jobBound:false,producerVerified:false,cleanupVerified:false,bootVerified:false,output:{sha256:HASH,bytes:51200,identity:Array(9).fill("1"),structure:{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false}}}};}},
  "../execution/iso-wsl-producer.cjs":{createIsoWslProducer:()=>async(input,options)=>{calls.push("produce");await options.onOwnership({...owner,pid:null,startTime:null});await options.onOwnership(owner);return{state:mode.failed?"failed":"succeeded",code:mode.failed?2:0};}}
 };
 vm.runInThisContext(Module.wrap(fs.readFileSync(file,"utf8")),{filename:file})(loaded.exports,name=>substitutes[name]||require(name.startsWith(".")?path.resolve(path.dirname(file),name):name),loaded,file,path.dirname(file));
 const references=[],authorizations=[];
 const recoveryDirectory=path.join(directory,"recovery"),journalDirectory=path.join(directory,"journal");
 const options={execution,directory:mode.durable?journalDirectory:directory,recoveryDirectory,resolveProject:()=>item,authorize:async(payload,context)=>{calls.push("authorize");authorizations.push({jobId:context.jobId,sourceRevision:payload.intent.sourceRevision,signal:context.signal});},retainReference:async value=>{calls.push("reference:"+value.state);references.push({...value});if(mode.delayReference&&value.state==="pending")await mode.delayReference();if(mode.referenceFailure)throw Error("reference unavailable");},checkpointCurrentOwner:async()=>{calls.push("current-owner");if(mode.checkpointFailure)throw Error("checkpoint unavailable");if(mode.revoked)execution.grants.delete("grant");},checkpointCurrentCleanup:async()=>calls.push("current-cleanup"),run:()=>{},checkpoint:()=>{},signalScript:"fixed-existing-signal"};
 let factory=loaded.exports.createIsoHostBuildAdapter;
 if(mode.durable){const durableFile=require.resolve("../src/main/jobs/iso-durable-host-adapter.cjs"),durable={exports:{}};vm.runInThisContext(Module.wrap(fs.readFileSync(durableFile,"utf8")),{filename:durableFile})(durable.exports,name=>name==="./iso-host-build-adapter.cjs"?loaded.exports:substitutes[name]||require(name.startsWith(".")?path.resolve(path.dirname(durableFile),name):name),durable,durableFile,path.dirname(durableFile));factory=durable.exports.createDurableIsoHostBuildAdapter;}
 const build=factory(options),payload={workspaceId:"workspace",target:"all",runtime:item.runtime,jobs:2,intent:{projectId:"workspace",sourceRevision:HASH,configRevision:HASH},isoOutputPolicy:createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"})};
 const context={jobId:JOB,log:()=>{},signal:mode.signal};
 return{run:()=>build(payload,context),calls,execution,directory,payload,context,references,authorizations,recoveryDirectory,journalDirectory,recoveryBinding:{jobId:JOB,workspaceId:"workspace",grantId:"grant",runtime:item.runtime,journalKey:JOB,sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:require("node:crypto").createHash("sha256").update(receipt.proof).digest("hex"),policy:payload.isoOutputPolicy}};
}
test("host composition requires anchored fresh ISO readback before returning success",async t=>{
 const f=fixture(t),result=await f.run();assert.equal(result.state,"succeeded");assert.equal(result.iso.state,"complete");assert.equal(result.iso.bootVerified,false);
 assert.ok(f.calls.indexOf("reference:pending")<f.calls.indexOf("current-launch"));assert.ok(f.calls.indexOf("current-owner")<f.calls.indexOf("current-input"));
 assert.ok(f.calls.indexOf("reference:receipt-recorded")<f.calls.indexOf("reference:verified"));assert.equal(f.execution.locks.size,0);
});
test("durable host bridge persists every helper owner and cleanup before anchored completion",async t=>{
 const {createIsoRecoveryRecords}=require("../src/main/jobs/iso-recovery-records.cjs"),f=fixture(t,{durable:true});
 const result=await f.run();assert.equal(result.state,"succeeded");
 const state=createIsoRecoveryRecords({directory:f.recoveryDirectory,journalDirectory:f.journalDirectory}).read(f.recoveryBinding);
 assert.equal(state.state,"complete");assert.ok(state.owners.length>1);assert.equal(state.cleanups.length,state.owners.length);assert.equal(state.grantsAuthority,false);
 await assert.rejects(f.run(),{code:"EEXIST"});
});
for(const mode of["unknownCurrentCleanup","failed"])test(`durable host bridge retains ${mode} evidence across restart`,async t=>{
 const {createIsoRecoveryRecords}=require("../src/main/jobs/iso-recovery-records.cjs"),f=fixture(t,{durable:true,[mode]:true});await assert.rejects(f.run());
 const state=createIsoRecoveryRecords({directory:f.recoveryDirectory,journalDirectory:f.journalDirectory}).read(f.recoveryBinding);
 assert.equal(state.state,"incomplete");assert.ok(state.owners.length>0);assert.equal(state.reference.state,"pending");if(mode==="unknownCurrentCleanup")assert.equal(state.cleanups[0].verdict.state,"unknown");
});
test("delayed pending reference cannot switch caller revision or job identity",async t=>{
 let release,reached;const ready=new Promise(resolve=>reached=resolve),controller=new AbortController();
 const mode={signal:controller.signal,delayReference:async()=>{reached();await new Promise(resolve=>release=resolve);}};
 const f=fixture(t,mode),pending=f.run(),rejection=assert.rejects(pending,{code:"ISO_HOST_INPUT_CHANGED"});await ready;
 f.payload.intent.sourceRevision="b".repeat(64);f.payload.intent.configRevision="b".repeat(64);f.payload.isoOutputPolicy={...f.payload.isoOutputPolicy,appliedConfigurationRevision:"b".repeat(64)};
 f.context.jobId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";f.context.signal=new AbortController().signal;mode.capturedRevision="b".repeat(64);
 release();await rejection;assert.ok(f.authorizations.every(value=>value.jobId===JOB&&value.sourceRevision===HASH&&value.signal===controller.signal));
 assert.ok(f.references.every(value=>value.jobId===JOB&&value.journalKey===JOB));assert.equal(f.calls.includes("produce"),false);
});
test("snapshot rejects identity accessors and preserves the original signal capability",t=>{
 const {snapshotIsoBuild}=require("../src/main/jobs/iso-host-build-snapshot.cjs"),f=fixture(t),controller=new AbortController();
 const fixed=snapshotIsoBuild(f.payload,{jobId:JOB,log:()=>{},signal:controller.signal});
 assert.equal(fixed.context.signal,controller.signal);assert.equal(Object.isFrozen(fixed.payload.intent),true);assert.equal(Object.isFrozen(controller.signal),false);
 let invoked=false;const context={log:()=>{}};Object.defineProperty(context,"jobId",{get(){invoked=true;return JOB;}});
 assert.throws(()=>snapshotIsoBuild(f.payload,context),{code:"ISO_HOST_REQUEST_INVALID"});assert.equal(invoked,false);
});
for(const mode of["forged","changed","referenceFailure","checkpointFailure","revoked","failed"])test(`host composition preserves non-success for ${mode}`,async t=>{
 const f=fixture(t,{[mode]:true});await assert.rejects(f.run());assert.equal(f.calls.includes("reference:verified"),false);
 if(["forged","referenceFailure"].includes(mode))assert.equal(f.calls.includes("current-launch"),false);
 if(mode==="checkpointFailure"||mode==="revoked")assert.equal(f.calls.includes("current-input"),false);
 if(mode==="failed"){assert.equal(f.calls.includes("capture"),false);assert.equal(f.execution.locks.size,3);assert.equal(fs.existsSync(path.join(f.directory,"active.json")),true);}
});
