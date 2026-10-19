"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createIsoRecoveryRecords}=require("../src/main/jobs/iso-recovery-records.cjs"),{createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs"),{createIsoProducerTransactions}=require("../src/main/execution/iso-producer-transaction.cjs"),{validateOwnershipReceipt}=require("../src/main/execution/index.cjs");
const HASH="a".repeat(64),JOB="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"iso-recovery-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const directory=path.join(root,"recovery"),journalDirectory=path.join(root,"journal"),legacy=path.join(root,"runtime-recovery.json");fs.writeFileSync(legacy,'{"version":1,"records":[]}');
 const bound={jobId:JOB,workspaceId:"workspace",grantId:"grant",runtime:{kind:"wsl",distribution:"Fixture"},journalKey:JOB,sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:HASH,policy:createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"})};
 const owner={version:1,kind:"wsl",ownerToken:JOB,distribution:"Fixture",bootId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pidNamespace:"pid:[123]",pid:42,startTime:"456"};
 const options={directory,journalDirectory},store=createIsoRecoveryRecords(options);
 async function completeJournal(){
  const execution={grants:new Map([["grant",{root:"root",source:"source",output:"output",wslReceipt:{storage:{distribution:"Fixture"}}}]]),locks:new Set()};
  const stage=async(options,observation)=>{await options.onOwnership(owner);return{state:"succeeded",code:0,observation};};
  const tx=createIsoProducerTransactions({execution,directory:journalDirectory,adapters:{current:async()=>({sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:HASH}),validateOwner:validateOwnershipReceipt,inspectCleanup:async()=>({state:"verified-stopped",reason:"owned-session-absent"}),
   prepare:async(input,options)=>stage(options,{state:"prepared-unbound",jobId:JOB,preparationSha256:HASH,prior:null,jobBound:false,bootVerified:false}),
   produce:async(input,options)=>{await options.onOwnership({...owner,pid:null,startTime:null});await options.onOwnership(owner);return{state:"succeeded",code:0};},
   capture:async(input,options)=>stage(options,{state:"fresh-file-observed-unbound",jobId:JOB,preparationSha256:HASH,jobBound:false,producerVerified:false,cleanupVerified:false,bootVerified:false,output:{sha256:HASH,bytes:51200,identity:Array(9).fill("1"),structure:{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false}}})
  }});return(await tx.run({grantId:bound.grantId,jobId:JOB,runtime:bound.runtime,policy:bound.policy})).receiptRecordSha256;
 }
 return{root,directory,journalDirectory,legacy,bound,owner,options,store,completeJournal};
}
test("durable reference and separate helper owners survive restart without changing legacy records",t=>{
 const f=fixture(t),before=fs.readFileSync(f.legacy);f.store.begin(f.bound);f.store.checkpointOwner(f.bound,f.owner);
 const second={...f.owner,ownerToken:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",pid:43};f.store.checkpointOwner(f.bound,second);
 const restarted=createIsoRecoveryRecords(f.options),result=restarted.read(f.bound);assert.equal(result.state,"incomplete");assert.deepEqual(result.owners,[f.owner,second]);assert.equal(result.grantsAuthority,false);
 assert.deepEqual(fs.readFileSync(f.legacy),before);assert.throws(()=>restarted.begin(f.bound),{code:"EEXIST"});
});
test("anchored completion needs actual journal readback and cleanup of every helper",async t=>{
 const f=fixture(t);f.store.begin(f.bound);f.store.checkpointOwner(f.bound,f.owner);const anchor=await f.completeJournal();
 f.store.recordReference(f.bound,{state:"receipt-recorded",receiptRecordSha256:anchor});
 assert.throws(()=>f.store.recordReference(f.bound,{state:"verified",receiptRecordSha256:anchor}),{code:"ISO_RECOVERY_UNVERIFIED"});
 f.store.checkpointCleanup(f.bound,f.owner,{state:"verified-stopped",reason:"owned-session-absent"});
 f.store.recordReference(f.bound,{state:"verified",receiptRecordSha256:anchor});
 assert.equal(createIsoRecoveryRecords(f.options).read(f.bound).state,"complete");
});
test("unknown cleanup and missing journal never become completed recovery",t=>{
 const f=fixture(t);f.store.begin(f.bound);f.store.checkpointOwner(f.bound,f.owner);f.store.checkpointCleanup(f.bound,f.owner,{state:"unknown",reason:"runtime-unavailable"});
 f.store.recordReference(f.bound,{state:"receipt-recorded",receiptRecordSha256:HASH});
 assert.throws(()=>f.store.recordReference(f.bound,{state:"verified",receiptRecordSha256:HASH}),{code:"ISO_RECOVERY_UNVERIFIED"});assert.equal(f.store.read(f.bound).state,"incomplete");
 assert.throws(()=>f.store.checkpointCleanup(f.bound,f.owner,{state:"verified-stopped",reason:"owned-session-absent"}),{code:"ISO_RECOVERY_UNVERIFIED"});
});
test("observer timeout cannot be relabelled as precise writer absence",t=>{
 const f=fixture(t);f.store.begin(f.bound);f.store.checkpointOwner(f.bound,f.owner);
 assert.throws(()=>f.store.checkpointCleanup(f.bound,f.owner,{state:"verified-stopped",reason:"timed-out"}),{code:"ISO_RECOVERY_UNVERIFIED"});assert.equal(f.store.read(f.bound).state,"incomplete");
});
test("cross-job/grant/runtime replay, owner replacement and conflicting anchors are rejected",t=>{
 const f=fixture(t);f.store.begin(f.bound);f.store.checkpointOwner(f.bound,f.owner);
 for(const change of[{jobId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",journalKey:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"},{grantId:"other"},{runtime:{kind:"wsl",distribution:"Other"}},{sourceSha256:"b".repeat(64)}])assert.equal(f.store.read({...f.bound,...change}).state,"unknown");
 assert.throws(()=>f.store.checkpointOwner(f.bound,{...f.owner,pid:99}),{code:"ISO_RECOVERY_UNVERIFIED"});
 assert.throws(()=>f.store.checkpointOwner(f.bound,{...f.owner,ownerToken:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",pid:null,startTime:null}),{code:"ISO_RECOVERY_UNVERIFIED"});
 f.store.recordReference(f.bound,{state:"receipt-recorded",receiptRecordSha256:HASH});assert.throws(()=>f.store.recordReference(f.bound,{state:"receipt-recorded",receiptRecordSha256:"b".repeat(64)}),{code:"ISO_RECOVERY_UNVERIFIED"});
});
for(const mode of["truncate","missing","unknown-file"])test(`malformed ${mode} evidence remains unknown and retained`,t=>{
 const f=fixture(t);f.store.begin(f.bound);f.store.checkpointOwner(f.bound,f.owner);const first=path.join(f.directory,JOB,"000000.json");
 if(mode==="truncate")fs.writeFileSync(first,"{");if(mode==="missing")fs.unlinkSync(first);if(mode==="unknown-file")fs.writeFileSync(path.join(f.directory,JOB,"other"),"{}");
 assert.equal(f.store.read(f.bound).state,"unknown");assert.equal(fs.existsSync(path.join(f.directory,JOB)),true);assert.throws(()=>f.store.checkpointOwner(f.bound,{...f.owner,ownerToken:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}));
});
test("failed initial persistence leaves an exclusive unreplayable recovery directory",t=>{
 const f=fixture(t);f.store.begin(f.bound);fs.writeFileSync(path.join(f.directory,JOB,"000001.json"),"");
 assert.equal(createIsoRecoveryRecords(f.options).read(f.bound).state,"unknown");assert.throws(()=>f.store.begin(f.bound),{code:"EEXIST"});
});
for(const operation of["writeFileSync","fsyncSync"])test(`injected ${operation} failure retains recovery prefix without success`,t=>{
 const f=fixture(t);f.store.begin(f.bound);const first=path.join(f.directory,JOB,"000000.json"),before=fs.readFileSync(first),descriptors=new Map();
 const faulty={...fs,openSync(file,...args){const fd=fs.openSync(file,...args);descriptors.set(fd,String(file));return fd;},closeSync(fd){descriptors.delete(fd);return fs.closeSync(fd);},[operation](fd,...args){if(descriptors.get(fd)?.endsWith("000001.json"))throw Object.assign(Error("injected persistence failure"),{code:"EIO"});return fs[operation](fd,...args);}};
 const vm=require("node:vm"),Module=require("node:module"),file=require.resolve("../src/main/jobs/iso-recovery-records.cjs"),loaded={exports:{}};
 vm.runInThisContext(Module.wrap(fs.readFileSync(file,"utf8")),{filename:file})(loaded.exports,name=>name==="node:fs"?faulty:require(name.startsWith(".")?path.resolve(path.dirname(file),name):name),loaded,file,path.dirname(file));
 const store=loaded.exports.createIsoRecoveryRecords(f.options);assert.throws(()=>store.checkpointOwner(f.bound,f.owner),{code:"EIO"});
 assert.deepEqual(fs.readFileSync(first),before);assert.equal(fs.existsSync(path.join(f.directory,JOB,"000001.json")),true);assert.notEqual(createIsoRecoveryRecords(f.options).read(f.bound).state,"complete");assert.throws(()=>store.begin(f.bound),{code:"EEXIST"});
});
