"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),vm=require("node:vm"),Module=require("node:module");
const {DEFAULT_LIMITS}=require("../src/main/jobs/build-intent.cjs"),{createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs"),{createJobManager}=require("../src/main/jobs/manager.cjs");
const HASH="a".repeat(64),WORKSPACE="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"iso-submission-link-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const runtime={kind:"wsl",distribution:"Fixture"},policy=createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"}),receipt={storage:{distribution:"Fixture"},proof:"native fixture proof"};
 const item={grantId:"grant",source:"source",output:"output",runtime,storage:{kind:"wsl"},externalTrees:[]},grant={root:"root",source:"source",output:"output",wslReceipt:receipt},execution={grants:new Map([["grant",grant]])};
 const captured={sourceRevision:HASH,configRevision:HASH,snapshot:{version:3,entries:1,bytes:1,excludesGitObjectHistory:true,symlinkPolicy:"internal-content-and-missing-targets",symlinks:0,limitations:[],limits:DEFAULT_LIMITS,downloadCache:null}},owner={version:1,kind:"wsl",ownerToken:WORKSPACE,distribution:"Fixture",bootId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pidNamespace:"pid:[123]",pid:42,startTime:"456"};
 const file=require.resolve("../src/main/jobs/iso-submission.cjs"),loaded={exports:{}},local=Module.createRequire(file);
 vm.runInThisContext(Module.wrap(fs.readFileSync(file,"utf8")),{filename:file})(loaded.exports,name=>name==="../execution/wsl-project.cjs"?{isWslReceipt:value=>value===receipt}:name==="./wsl-build-intent.cjs"?{...local(name),captureWslBuildIntent:async options=>{await options.onOwnership(owner);await options.onCleanup(owner,{state:"verified-stopped",reason:"owned-session-absent"});return captured;}}:local(name),loaded,file,path.dirname(file));
 const directory=path.join(root,"submissions"),submission=await loaded.exports.captureIsoSubmission({directory,execution,item,workspaceId:WORKSPACE,runtime,policy,resolveProject:()=>item,onReserved:()=>{}});
 const jobs=createJobManager({directory:path.join(root,"jobs"),adapters:{build:async()=>({state:"succeeded",code:0})}}),payload={workspaceId:WORKSPACE,target:"all",runtime,jobs:1,intent:{projectId:WORKSPACE,sourceRevision:HASH,configRevision:HASH},snapshot:captured.snapshot,isoOutputPolicy:policy,isoSubmission:submission.descriptor};
 const job=jobs.enqueue({kind:"build",ownerId:"owner",payload});submission.commitJob(job);
 return{jobs,payload,job,inspect:()=>loaded.exports.inspectIsoSubmissions({directory,jobs,owner:"owner"})};
}
test("completed submission retains one historical job binding alongside ordinary jobs",async t=>{
 const f=await fixture(t);assert.equal(f.inspect().state,"verified");f.jobs.enqueue({kind:"build",ownerId:"owner",payload:{workspaceId:WORKSPACE,target:"all"}});assert.equal(f.inspect().state,"verified");assert.equal(f.inspect().grantsRestored,false);
});
test("second job cannot reuse a completed submission descriptor",async t=>{
 const f=await fixture(t);assert.equal(f.inspect().state,"verified");const duplicate=f.jobs.enqueue({kind:"build",ownerId:"owner",payload:f.payload});assert.notEqual(duplicate.id,f.job.id);assert.equal(f.inspect().state,"unknown");
});
test("same submission ID with changed anchor cannot correlate another job",async t=>{
 const f=await fixture(t);f.jobs.enqueue({kind:"build",ownerId:"owner",payload:{...f.payload,isoSubmission:{...f.payload.isoSubmission,captureRecordSha256:"b".repeat(64)}}});assert.equal(f.inspect().state,"unknown");
});
