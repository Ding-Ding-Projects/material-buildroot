"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),vm=require("node:vm"),Module=require("node:module");
const {validateOwnershipReceipt}=require("../src/main/execution/index.cjs"),{DEFAULT_LIMITS}=require("../src/main/jobs/build-intent.cjs");
const HASH="a".repeat(64),CONFIG="b".repeat(64);
function load(relative,overrides){const file=require.resolve(relative),loaded={exports:{}},local=Module.createRequire(file);vm.runInThisContext(Module.wrap(fs.readFileSync(file,"utf8")),{filename:file})(loaded.exports,name=>Object.hasOwn(overrides,name)?overrides[name]:local(name),loaded,file,path.dirname(file));return loaded.exports;}
async function fixture(t,mode={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"iso-operations-")),state=path.join(directory,"state"),root=path.join(directory,"project"),source=path.join(root,"source"),output=path.join(root,"output");fs.mkdirSync(source,{recursive:true});fs.mkdirSync(output);fs.writeFileSync(path.join(source,"Makefile"),"BR2_VERSION = 2025.02\n");
 let revision=HASH,values={BR2_x86_64:true,BR2_LINUX_KERNEL:true},producerCount=0,ordinaryCount=0,helperCount=0,ready;
 const started=new Promise(resolve=>ready=resolve),runtime={kind:"wsl",distribution:"Fixture"},receipt={storage:{kind:"wsl",distribution:"Fixture",rootLinux:"/home/fixture/material-buildroot",sourceLinux:"/home/fixture/material-buildroot/source",outputLinux:"/home/fixture/material-buildroot/output"},paths:{root,source,output},proof:"native fixture proof"};
 const owner=()=>({version:1,kind:"wsl",ownerToken:crypto.randomUUID(),distribution:"Fixture",bootId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",pidNamespace:"pid:[123]",pid:42,startTime:"456"});
 const execution={grants:new Map(),locks:new Set(),validateOwnershipReceipt,executables:{},verifyWslGrant:async()=>{},revoke:id=>execution.grants.delete(id),
  grantWslProject:async()=>{execution.grants.set("fixture-grant",{root,source,output,wslReceipt:receipt});return{grantId:"fixture-grant"};},
  probeResources:async()=>({cpuSlots:32,memoryAvailableBytes:32*1024**3,storageAvailableBytes:128*1024**3,observedAt:new Date().toISOString()}),
  reconcileCleanup:async()=>({state:"verified-stopped",reason:"owned-session-absent"}),
  createLeasedIsoOutputLifecycle:transactions=>async(request,options)=>{
   transactions.assertLifecycleLease(options.lease,{execution,jobId:request.jobId,grantId:request.grantId,runtime:request.runtime,roots:[root,source,output]});await options.onOwnership(owner());
   return{state:"succeeded",code:0,observation:request.operation==="prepare"?{state:"prepared-unbound",jobId:request.jobId,preparationSha256:HASH,prior:mode.stale?{sha256:HASH,bytes:51200,identity:Array(9).fill("1")}:null,jobBound:false,bootVerified:false}:{state:"fresh-file-observed-unbound",jobId:request.jobId,preparationSha256:HASH,jobBound:false,producerVerified:false,cleanupVerified:false,bootVerified:false,output:mode.missing?undefined:{sha256:HASH,bytes:51200,identity:Array(9).fill("1"),structure:{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false}}}};
  },
  startIsoProducer:async(request,log,options)=>{
   producerCount++;const precise=owner();await options.onOwnership({...precise,pid:null,startTime:null});await options.onOwnership(precise);let finish;
   const completion=mode.cancel?new Promise(resolve=>finish=resolve):Promise.resolve({state:"succeeded",code:0});ready();return{completion,cancel:async()=>{finish?.({state:"cancelled",code:null});return{state:"cancelled",code:null};}};
  },
  start:async()=>{ordinaryCount++;return{completion:Promise.resolve({state:"succeeded",code:0}),cancel:async()=>({state:"cancelled",code:null})};}
 };
 const capture=async options=>{
  if(options.onOwnership){helperCount++;assert.ok(fs.existsSync(path.join(state,"iso-recovery")));const current=owner();await options.onOwnership(current);await options.onCleanup(current,{state:mode.unknown?"unknown":"verified-stopped",reason:mode.unknown?"runtime-unavailable":"owned-session-absent"});if(mode.unknown)throw Error("cleanup unknown");}
  return{sourceRevision:HASH,configRevision:revision,snapshot:{version:3,entries:1,bytes:1,excludesGitObjectHistory:true,symlinkPolicy:"internal-content-and-missing-targets",symlinks:0,limitations:[],limits:DEFAULT_LIMITS,downloadCache:null}};
 };
 const nativeIntent={...require("../src/main/jobs/wsl-build-intent.cjs"),captureWslBuildIntent:capture},wslProject={isWslReceipt:value=>value===receipt};
 const host=load("../src/main/jobs/iso-host-build-adapter.cjs",{"./wsl-build-intent.cjs":nativeIntent,"../execution/wsl-project.cjs":wslProject});
 const durable=load("../src/main/jobs/iso-durable-host-adapter.cjs",{"./iso-host-build-adapter.cjs":host,"../execution/wsl-project.cjs":wslProject});
 const scheduled=load("../src/main/jobs/iso-scheduled-build.cjs",{"./iso-durable-host-adapter.cjs":durable});
 const names=["BR2_x86_64","BR2_LINUX_KERNEL","BR2_TARGET_GRUB2","BR2_TARGET_GRUB2_I386_PC","BR2_TARGET_ROOTFS_ISO9660","BR2_TARGET_ROOTFS_ISO9660_GRUB2","BR2_TARGET_ROOTFS_ISO9660_INITRD","BR2_TARGET_ROOTFS_ISO9660_BOOT_MENU","BR2_TARGET_GRUB2_BUILTIN_CONFIG_PC","BR2_TARGET_GRUB2_BOOT_PARTITION","BR2_TARGET_GRUB2_BUILTIN_MODULES_PC"];
 const configuration={inspect:async()=>({revision,values,semantics:{available:true,tree:{children:names.map(symbol=>({symbol,type:/BOOT_MENU|BUILTIN_CONFIG|BOOT_PARTITION|BUILTIN_MODULES/.test(symbol)?"string":"bool",value:values[symbol]}))}}}),apply:async input=>{values={...values,...Object.fromEntries(Object.entries(input.changes).map(([name,change])=>[name,change.value]))};revision=CONFIG;return{revision,values};}};
 const originalManager=require("../src/main/jobs/manager.cjs");
 const projectStore=load("../src/main/storage/project-store.cjs",{"../execution/wsl-project.cjs":{metadataPaths:()=>receipt.paths}});
 const operations=load("../src/main/operations-service.cjs",{"./storage/project-store.cjs":projectStore,"./jobs/iso-scheduled-build.cjs":scheduled,"./jobs/wsl-build-intent.cjs":nativeIntent,"./execution/wsl-project.cjs":wslProject,"./execution/wsl-runtime.cjs":{createWslRuntime:()=>({chooseProject:async()=>({root,source,output,storage:receipt.storage,receipt,name:"Fixture"})})},"./configuration/index.cjs":{createConfigurationService:()=>configuration},"./jobs/manager.cjs":{createJobManager:options=>originalManager.createJobManager({...options,adapters:{...options.adapters,build:(payload,context)=>options.adapters.build(payload,{...context,item(value){if(mode.persist&&value.kind==="iso-native-binding")throw Error("injected persistence failure");return context.item(value);}})}})}});
 let service=operations.createOperationsService({directory:state,execution,version:"0.1.0",source:null,dialog:{showOpenDialog:async()=>({canceled:true,filePaths:[]})},parentWindow:null});
 t.after(async()=>{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});});
 const request=value=>service.request(JSON.stringify(value));const adopted=await request({action:"runtime.wsl",kind:"chooseProject",distribution:"Fixture"});assert.equal(adopted.ok,true,JSON.stringify(adopted));const workspaceId=adopted.result.workspaceId;
 const applied=await request({action:"imagePreset.isoApply",workspaceId,revision});assert.equal(applied.ok,true,JSON.stringify(applied));
 async function submit(ordinary=false){return request(ordinary?{action:"build.submit",workspaceId,target:"all",runtime,jobs:1}:{action:"imagePreset.isoBuild",workspaceId,revision:applied.result.revision,profile:applied.result.profile,runtime,jobs:1});}
 async function terminal(id){for(let n=0;n<200;n++){const reply=await request({action:"jobs.list"}),job=reply.result?.find(row=>row.id===id);if(job&&!['queued','running','cancelling'].includes(job.state))return job;await new Promise(resolve=>setTimeout(resolve,10));}throw Error("terminal fixture timeout");}
 async function restart(){await service.dispose();service=operations.createOperationsService({directory:state,execution,version:"0.1.0",source:null,dialog:{showOpenDialog:async()=>({canceled:true,filePaths:[]})},parentWindow:null});}
 return{request,submit,terminal,started,workspaceId,restart,state,producerCount:()=>producerCount,ordinaryCount:()=>ordinaryCount,helperCount:()=>helperCount};
}
test("operations routes ISO through actual durable composition before scheduler success",{timeout:10000},async t=>{
 const f=await fixture(t),submitted=await f.submit();assert.equal(submitted.ok,true,JSON.stringify(submitted));const job=await f.terminal(submitted.result.id);assert.equal(job.state,"succeeded",JSON.stringify(job));assert.equal(f.producerCount(),1);assert.ok(f.helperCount()>0);assert.equal(f.ordinaryCount(),0);
 await f.restart();const status=await f.request({action:"scheduler.status"});assert.equal(status.result.quarantine.records.length,0);assert.equal(status.result.quarantine.unavailable,false);
});
for(const mode of["missing","stale","unknown","persist"])test(`operations preserves ${mode} recovery and restart denial`,{timeout:10000},async t=>{
 const f=await fixture(t,{[mode]:true}),submitted=await f.submit();assert.equal(submitted.ok,true,JSON.stringify(submitted));const job=await f.terminal(submitted.result.id);assert.equal(job.state,"interrupted",JSON.stringify(job));await f.restart();const status=await f.request({action:"scheduler.status"});assert.ok(status.result.quarantine.records.some(row=>row.jobId===job.id));if(mode==="persist")assert.equal(f.helperCount(),0);
 const adopted=await f.request({action:"runtime.wsl",kind:"chooseProject",distribution:"Fixture"});assert.equal(adopted.ok,true);const mutation=await f.request({action:"imagePreset.isoApply",workspaceId:adopted.result.workspaceId,revision:CONFIG});assert.equal(mutation.ok,false);assert.equal(mutation.code,"RUNTIME_RECOVERY_REQUIRED");
});
test("operations cancellation retains unresolved ISO owner reservation",{timeout:10000},async t=>{
 const f=await fixture(t,{cancel:true}),submitted=await f.submit();assert.equal(submitted.ok,true);await f.started;const list=await f.request({action:"jobs.list"}),job=list.result.find(row=>row.id===submitted.result.id);const cancelled=await f.request({action:"jobs.cancel",id:job.id,sequence:job.sequence});assert.equal(cancelled.ok,true,JSON.stringify(cancelled));assert.equal((await f.terminal(job.id)).state,"interrupted");
});
test("operations ordinary build keeps the original execution adapter",{timeout:10000},async t=>{
 const f=await fixture(t),submitted=await f.submit(true);assert.equal(submitted.ok,true);assert.equal((await f.terminal(submitted.result.id)).state,"succeeded");assert.equal(f.ordinaryCount(),1);assert.equal(f.producerCount(),0);assert.equal(f.helperCount(),0);
});
