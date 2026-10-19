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
  "./wsl-build-intent.cjs":{captureWslBuildIntent:async options=>{calls.push("current-launch");await options.onOwnership(owner);calls.push("current-input");return{sourceRevision:mode.changed?"b".repeat(64):HASH,configRevision:HASH};}},
  "../execution/wsl-iso-output-lifecycle.cjs":{createLeasedWslIsoOutputLifecycle:()=>async(request,options)=>{calls.push(request.operation);await options.onOwnership(owner);return{state:"succeeded",code:0,observation:request.operation==="prepare"?{state:"prepared-unbound",jobId:JOB,preparationSha256:HASH,prior:null,jobBound:false,bootVerified:false}:{state:"fresh-file-observed-unbound",jobId:JOB,preparationSha256:HASH,jobBound:false,producerVerified:false,cleanupVerified:false,bootVerified:false,output:{sha256:HASH,bytes:51200,identity:Array(9).fill("1"),structure:{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false}}}};}},
  "../execution/iso-wsl-producer.cjs":{createIsoWslProducer:()=>async(input,options)=>{calls.push("produce");await options.onOwnership({...owner,pid:null,startTime:null});await options.onOwnership(owner);return{state:mode.failed?"failed":"succeeded",code:mode.failed?2:0};}}
 };
 vm.runInThisContext(Module.wrap(fs.readFileSync(file,"utf8")),{filename:file})(loaded.exports,name=>substitutes[name]||require(name.startsWith(".")?path.resolve(path.dirname(file),name):name),loaded,file,path.dirname(file));
 const options={execution,directory,resolveProject:()=>item,authorize:async()=>calls.push("authorize"),retainReference:async value=>{calls.push("reference:"+value.state);if(mode.referenceFailure)throw Error("reference unavailable");},checkpointCurrentOwner:async()=>{calls.push("current-owner");if(mode.checkpointFailure)throw Error("checkpoint unavailable");if(mode.revoked)execution.grants.delete("grant");},run:()=>{},checkpoint:()=>{},signalScript:"fixed-existing-signal"};
 const build=loaded.exports.createIsoHostBuildAdapter(options),payload={workspaceId:"workspace",target:"all",runtime:item.runtime,jobs:2,intent:{projectId:"workspace",sourceRevision:HASH,configRevision:HASH},isoOutputPolicy:createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"})};
 return{run:()=>build(payload,{jobId:JOB,log:()=>{}}),calls,execution,directory,payload};
}
test("host composition requires anchored fresh ISO readback before returning success",async t=>{
 const f=fixture(t),result=await f.run();assert.equal(result.state,"succeeded");assert.equal(result.iso.state,"complete");assert.equal(result.iso.bootVerified,false);
 assert.ok(f.calls.indexOf("reference:pending")<f.calls.indexOf("current-launch"));assert.ok(f.calls.indexOf("current-owner")<f.calls.indexOf("current-input"));
 assert.ok(f.calls.indexOf("reference:receipt-recorded")<f.calls.indexOf("reference:verified"));assert.equal(f.execution.locks.size,0);
});
for(const mode of["forged","changed","referenceFailure","checkpointFailure","revoked","failed"])test(`host composition preserves non-success for ${mode}`,async t=>{
 const f=fixture(t,{[mode]:true});await assert.rejects(f.run());assert.equal(f.calls.includes("reference:verified"),false);
 if(["forged","referenceFailure"].includes(mode))assert.equal(f.calls.includes("current-launch"),false);
 if(mode==="checkpointFailure"||mode==="revoked")assert.equal(f.calls.includes("current-input"),false);
 if(mode==="failed"){assert.equal(f.calls.includes("capture"),false);assert.equal(f.execution.locks.size,3);assert.equal(fs.existsSync(path.join(f.directory,"active.json")),true);}
});
