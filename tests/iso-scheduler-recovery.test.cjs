"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createJobManager}=require("../src/main/jobs/manager.cjs"),{createBuildQuarantine}=require("../src/main/jobs/quarantine.cjs"),{createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs"),{createIsoRecoveryRecords}=require("../src/main/jobs/iso-recovery-records.cjs"),{restoreIsoSchedulerRecovery}=require("../src/main/jobs/iso-scheduler-recovery.cjs");
const {createIsoProducerTransactions}=require("../src/main/execution/iso-producer-transaction.cjs"),{validateOwnershipReceipt}=require("../src/main/execution/index.cjs");
const HASH="a".repeat(64),WORKSPACE="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"iso-restart-anchor-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const recoveryDirectory=path.join(root,"recovery"),journalDirectory=path.join(root,"journal"),jobDirectory=path.join(root,"jobs");
 const runtime={kind:"wsl",distribution:"Fixture"},policy=createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"}),owner={version:1,kind:"wsl",ownerToken:WORKSPACE,distribution:"Fixture",bootId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pidNamespace:"pid:[123]",pid:42,startTime:"456"};
 const recovery=createIsoRecoveryRecords({directory:recoveryDirectory,journalDirectory});
 const jobs=createJobManager({directory:jobDirectory,adapters:{build:async(payload,context)=>{
  const bound={jobId:context.jobId,workspaceId:WORKSPACE,grantId:"grant",runtime,journalKey:context.jobId,sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:HASH,policy};
  context.item({kind:"iso-native-binding",binding:bound});recovery.begin(bound);recovery.checkpointOwner(bound,owner);recovery.checkpointCleanup(bound,owner,{state:"verified-stopped",reason:"owned-session-absent"});
  const execution={grants:new Map([["grant",{root:"root",source:"source",output:"output",wslReceipt:{storage:{distribution:"Fixture"}}}]]),locks:new Set()};
  const stage=async(options,observation)=>{await options.onOwnership(owner);return{state:"succeeded",code:0,observation};};
  const tx=createIsoProducerTransactions({execution,directory:journalDirectory,adapters:{current:async()=>({sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:HASH}),validateOwner:validateOwnershipReceipt,inspectCleanup:async()=>({state:"verified-stopped",reason:"owned-session-absent"}),
   prepare:async(input,options)=>stage(options,{state:"prepared-unbound",jobId:context.jobId,preparationSha256:HASH,prior:null,jobBound:false,bootVerified:false}),
   produce:async(input,options)=>{await options.onOwnership({...owner,pid:null,startTime:null});await options.onOwnership(owner);return{state:"succeeded",code:0};},
   capture:async(input,options)=>stage(options,{state:"fresh-file-observed-unbound",jobId:context.jobId,preparationSha256:HASH,jobBound:false,producerVerified:false,cleanupVerified:false,bootVerified:false,output:{sha256:HASH,bytes:51200,identity:Array(9).fill("1"),structure:{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false}}})
  }});const result=await tx.run({grantId:"grant",jobId:context.jobId,runtime,policy});
  recovery.recordReference(bound,{state:"receipt-recorded",receiptRecordSha256:result.receiptRecordSha256});recovery.recordReference(bound,{state:"verified",receiptRecordSha256:result.receiptRecordSha256});
  context.item({kind:"iso-output",state:"verified",receiptRecordSha256:result.receiptRecordSha256,receipt:result.receipt});return{state:"succeeded",code:0};
 }}});
 const job=jobs.enqueue({kind:"build",ownerId:"owner",payload:{workspaceId:WORKSPACE,target:"all",runtime,jobs:1,intent:{projectId:WORKSPACE,sourceRevision:HASH,configRevision:HASH},isoOutputPolicy:policy}});await jobs.run(job.id,"owner",job.sequence);
 function restore(){const restarted=createJobManager({directory:jobDirectory,adapters:{build:async()=>{throw Error("must not run");}}}),quarantine=createBuildQuarantine({directory:path.join(root,"quarantine"),validateReceipt:()=>{}});quarantine.initialize();const result=restoreIsoSchedulerRecovery({jobs:restarted,owner:"owner",quarantine,recoveryDirectory,journalDirectory,markRecoveryUnavailable:()=>{}});return{result,quarantine};}
 return{job,root,jobDirectory,restore,itemFile:path.join(jobDirectory,job.id,"item-2.json")};
}
test("unchanged actual anchored journal and inventory remain historical complete on restart",async t=>{
 const f=await fixture(t),{result,quarantine}=f.restore();assert.deepEqual(result.retained,[]);assert.equal(result.grantsRestored,false);assert.deepEqual(quarantine.list(),[]);
});
for(const change of["hash","bytes","state","job-result"])test(`changed ${change} cannot correlate completed ISO history`,async t=>{
 const f=await fixture(t);
 if(change==="job-result"){const file=path.join(f.jobDirectory,"jobs.json"),data=JSON.parse(fs.readFileSync(file));data.jobs[0].result.state="failed";fs.writeFileSync(file,JSON.stringify(data));}
 else{const row=JSON.parse(fs.readFileSync(f.itemFile));if(change==="hash")row.value.receipt.output.sha256="b".repeat(64);if(change==="bytes")row.value.receipt.output.bytes++;if(change==="state")row.value.state="failed";fs.writeFileSync(f.itemFile,JSON.stringify(row));}
 const {result,quarantine}=f.restore();assert.equal(result.retained[0]?.jobId,f.job.id);assert.equal(quarantine.list()[0]?.jobId,f.job.id);assert.equal(result.grantsRestored,false);
});
