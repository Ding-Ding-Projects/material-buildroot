"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createJobManager}=require("../src/main/jobs/manager.cjs"),{createBuildScheduler}=require("../src/main/jobs/scheduler.cjs"),{createBuildQuarantine}=require("../src/main/jobs/quarantine.cjs");
const {createIsoScheduledBuild,createBuildJobRouter}=require("../src/main/jobs/iso-scheduled-build.cjs"),{restoreIsoSchedulerRecovery}=require("../src/main/jobs/iso-scheduler-recovery.cjs"),{createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs");
const HASH="a".repeat(64);
function fixture(t,mode={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"iso-scheduled-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const source=path.join(directory,"source"),output=path.join(directory,"output");fs.mkdirSync(source);fs.mkdirSync(output);
 const quarantineOptions={directory:path.join(directory,"quarantine"),validateReceipt:()=>{}},quarantine=createBuildQuarantine(quarantineOptions),activeRecovery=new Set();quarantine.initialize();let unavailable=false,ordinary=0,producer=0,ready;
 const started=new Promise(resolve=>ready=resolve);
 const iso=createIsoScheduledBuild({hostOptions:{},quarantine,activeRecovery,markRecoveryUnavailable:()=>{unavailable=true;},createHostBuild:options=>async(payload,context)=>{
  const binding={jobId:context.jobId,workspaceId:payload.workspaceId,grantId:"native-grant",runtime:payload.runtime,journalKey:context.jobId,sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:HASH,policy:payload.isoOutputPolicy};
  await options.onRecoveryBinding(binding);producer++;ready();
  if(mode.cancel)await new Promise((resolve,reject)=>{context.signal.addEventListener("abort",()=>reject(Error("cancelled")),{once:true});});
  const receipt={version:1,jobId:context.jobId,runtime:payload.runtime,policy:payload.isoOutputPolicy,binding:{sourceSha256:mode.stale?"b".repeat(64):HASH,configurationSha256:HASH,projectProofSha256:HASH},preparationSha256:HASH,output:mode.missing?undefined:{sha256:HASH,bytes:51200},jobBound:true,producerVerified:true,cleanupVerified:true,bootVerified:false};
  return{state:"succeeded",code:0,iso:{state:"complete",bootVerified:false,receiptRecordSha256:HASH,receipt}};
 }});
 const routed=createBuildJobRouter({ordinary:async()=>{ordinary++;return{state:"succeeded",code:0};},iso});
 const errors=[];
 const jobs=createJobManager({directory:path.join(directory,"jobs"),adapters:{build:async(payload,context)=>{try{return await routed(payload,{...context,item(value){if(mode.persist&&value.kind==="iso-output")throw Error("injected item persistence failure");return context.item(value);}});}catch(error){errors.push(error.stack);throw error;}}}});
 const scheduler=createBuildScheduler({jobs,ownerId:"owner",limits:{maxConcurrent:1,cpuSlots:4,memoryBytes:1024,storageBytes:1024},resolveAdmission:async job=>{
  if(quarantine.list().some(row=>!activeRecovery.has(row.jobId)))throw Object.assign(Error("recovery required"),{code:"BLOCKED_RUNTIME_RECOVERY_REQUIRED"});
  return{projectId:job.payload.workspaceId,source,output,externalTrees:[],resourceDomain:"fixture",storageDomain:"fixture",cpuSlots:1,memoryBytes:1,storageBytes:1,intent:job.payload.intent};
 },observeResources:async()=>({resourceDomain:"fixture",storageDomain:"fixture",cpuSlots:4,memoryAvailableBytes:1024,storageAvailableBytes:1024})});t.after(()=>scheduler.close());
 const workspaceId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const payload={workspaceId,target:"all",runtime:{kind:"wsl",distribution:"Fixture"},jobs:1,intent:{projectId:workspaceId,sourceRevision:HASH,configRevision:HASH},isoOutputPolicy:createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"})};
 function enqueue(ordinaryBuild=false){const value={...payload};if(ordinaryBuild)delete value.isoOutputPolicy;return jobs.enqueue({kind:"build",ownerId:"owner",payload:value});}
 return{directory,quarantine,quarantineOptions,jobs,scheduler,payload,enqueue,started,errors,unavailable:()=>unavailable,ordinary:()=>ordinary,producer:()=>producer};
}
test("real scheduler and job manager require verified ISO item before success",async t=>{
 const f=fixture(t),job=f.enqueue();await f.scheduler.pump();await f.scheduler.awaitIdle();assert.equal(f.jobs.get(job.id,"owner").state,"succeeded",f.errors.join("\n"));
 const records=f.jobs.page(job.id,"item",{limit:100},"owner").records.map(row=>row.value);assert.deepEqual(records.map(row=>row.kind),["iso-native-binding","iso-output"]);assert.equal(records[1].receipt.bootVerified,false);assert.equal(f.quarantine.list().length,0);assert.equal(f.producer(),1);
});
for(const mode of["missing","stale","persist"])test(`scheduler retains reservation after ${mode}`,async t=>{
 const f=fixture(t,{[mode]:true}),job=f.enqueue();await f.scheduler.pump();await f.scheduler.awaitIdle();assert.equal(f.jobs.get(job.id,"owner").state,"interrupted");assert.equal(f.quarantine.list()[0].jobId,job.id);
 const later=f.enqueue(true);await f.scheduler.pump();assert.equal(f.jobs.get(later.id,"owner").state,"queued");assert.equal(f.scheduler.status().blocked.find(row=>row.jobId===later.id).reason,"BLOCKED_RUNTIME_RECOVERY_REQUIRED");
});
test("cancellation preserves unresolved ISO reservation",async t=>{
 const f=fixture(t,{cancel:true}),job=f.enqueue();await f.scheduler.pump();await f.started;const running=f.jobs.get(job.id,"owner");f.jobs.cancel(job.id,"owner",running.sequence);await f.scheduler.awaitIdle();assert.equal(f.jobs.get(job.id,"owner").state,"interrupted");assert.equal(f.quarantine.list()[0].jobId,job.id);
});
test("ordinary builds use their existing adapter without ISO recovery writes",async t=>{
 const f=fixture(t),job=f.enqueue(true);await f.scheduler.pump();await f.scheduler.awaitIdle();assert.equal(f.jobs.get(job.id,"owner").state,"succeeded");assert.equal(f.ordinary(),1);assert.equal(f.producer(),0);assert.equal(f.quarantine.list().length,0);
});
test("restart reconstructs denial reservations from durable queued job identity without grants",async t=>{
 const f=fixture(t,{missing:true}),job=f.enqueue();await f.scheduler.pump();await f.scheduler.awaitIdle();
 const restartedJobs=createJobManager({directory:path.join(f.directory,"jobs"),adapters:{build:async()=>{throw Error("must not execute");}}}),restartedQuarantine=createBuildQuarantine(f.quarantineOptions);let unavailable=false;
 const result=restoreIsoSchedulerRecovery({jobs:restartedJobs,owner:"owner",quarantine:restartedQuarantine,recoveryDirectory:path.join(f.directory,"iso-recovery"),journalDirectory:path.join(f.directory,"iso-journal"),markRecoveryUnavailable:()=>{unavailable=true;}});
 assert.equal(result.grantsRestored,false);assert.equal(result.retained[0].jobId,job.id);assert.equal(restartedQuarantine.list()[0].jobId,job.id);assert.equal(unavailable,false);
});
test("unbound recovery directories fail closed without manufacturing grants",t=>{
 const f=fixture(t),recoveryDirectory=path.join(f.directory,"iso-recovery");fs.mkdirSync(path.join(recoveryDirectory,"cccccccc-cccc-4ccc-8ccc-cccccccccccc"),{recursive:true});let unavailable=false;
 const result=restoreIsoSchedulerRecovery({jobs:f.jobs,owner:"owner",quarantine:f.quarantine,recoveryDirectory,journalDirectory:path.join(f.directory,"iso-journal"),markRecoveryUnavailable:()=>{unavailable=true;}});
 assert.equal(result.state,"unknown");assert.equal(result.grantsRestored,false);assert.equal(unavailable,true);
});
test("cross-job native binding cannot reconcile a succeeded scheduler record",async t=>{
 const f=fixture(t),job=f.enqueue();await f.scheduler.pump();await f.scheduler.awaitIdle();const recordFile=path.join(f.directory,"jobs",job.id,"item-1.json"),record=JSON.parse(fs.readFileSync(recordFile));record.value.binding.jobId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";fs.writeFileSync(recordFile,JSON.stringify(record));
 const result=restoreIsoSchedulerRecovery({jobs:f.jobs,owner:"owner",quarantine:f.quarantine,recoveryDirectory:path.join(f.directory,"iso-recovery"),journalDirectory:path.join(f.directory,"iso-journal"),markRecoveryUnavailable:()=>{}});
 assert.equal(result.retained[0].jobId,job.id);assert.equal(result.grantsRestored,false);assert.equal(f.quarantine.list()[0].jobId,job.id);
});
