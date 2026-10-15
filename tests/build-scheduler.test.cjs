"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const {createJobManager}=require("../src/main/jobs/manager.cjs"),{createBuildScheduler}=require("../src/main/jobs/scheduler.cjs");
async function until(check){for(let n=0;n<100;n++){if(check())return;await new Promise(r=>setImmediate(r));}assert.fail("Expected scheduler transition");}
function fixture(t,options={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"scheduler-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const projects=new Map(),active=new Map(),ownerId="owner";
 const adapters={build:async(payload,ctx)=>new Promise(resolve=>active.set(ctx.jobId,{resolve,signal:ctx.signal}))};const jobs=createJobManager({directory:path.join(root,"jobs"),adapters});
 const metrics={resourceDomain:"runtime",storageDomain:"disk",cpuSlots:4,memoryAvailableBytes:4000,storageAvailableBytes:4000,...options.observed};
 const scheduler=createBuildScheduler({jobs,ownerId,resolveAdmission:async job=>{const p=projects.get(job.payload.intent.projectId);return {...p,intent:options.stale?{...p.intent,sourceRevision:"changed"}:p.intent};},observeResources:options.observeResources|| (async()=>metrics),limits:{maxConcurrent:4,cpuSlots:4,memoryBytes:4000,storageBytes:4000,...options.limits},maxScan:options.maxScan||100,callbackTimeoutMs:options.callbackTimeoutMs||15000,acquireLease:options.acquireLease});t.after(()=>scheduler.close());
 function project(name,extra={}){const source=path.join(root,name+"-source"),output=path.join(root,name+"-output");fs.mkdirSync(source);fs.mkdirSync(output);fs.writeFileSync(path.join(source,"Makefile"),name);const intent={sourceRevision:crypto.createHash("sha256").update(name).digest("hex"),configRevision:"fixture-config-content-hash"};const p={projectId:name,source,output,externalTrees:[],resourceDomain:"runtime",storageDomain:"disk",cpuSlots:1,memoryBytes:1000,storageBytes:1000,intent,...extra};projects.set(name,p);return p;}
 const enqueue=name=>jobs.enqueue({kind:"build",ownerId,payload:{intent:{projectId:name,...projects.get(name).intent}}});return {root,projects,active,jobs,scheduler,project,enqueue,ownerId,adapters};
}
test("concurrent projects preserve FIFO and release reservations after cancellation cleanup",async t=>{
 const f=fixture(t,{limits:{maxConcurrent:2,cpuSlots:2}});f.project("a");f.project("b");const a=f.enqueue("a"),b=f.enqueue("b"),next=f.enqueue("a");await f.scheduler.pump();await until(()=>f.active.size===2);assert.equal(f.jobs.get(next.id).state,"queued");assert.equal(f.scheduler.status().reservations.cpuSlots,2);
 const current=f.jobs.get(a.id);f.jobs.cancel(a.id,f.ownerId,current.sequence);assert.equal(f.active.get(a.id).signal.aborted,true);assert.equal(f.scheduler.status().reservations.cpuSlots,2);f.active.get(a.id).resolve();await until(()=>f.active.has(next.id));assert.equal(f.jobs.get(a.id).state,"cancelled");f.active.get(b.id).resolve();f.active.get(next.id).resolve();await f.scheduler.awaitIdle();assert.equal(f.scheduler.status().reservations.cpuSlots,0);
});
test("unknown or insufficient resource observations keep durable work queued",async t=>{
 for(const [observed,expected] of [[{cpuSlots:null},"BLOCKED_RESOURCE_UNKNOWN"],[{cpuSlots:0},"BLOCKED_CPU_LIMIT"],[{memoryAvailableBytes:999},"BLOCKED_MEMORY_LIMIT"],[{storageAvailableBytes:999},"BLOCKED_STORAGE_LIMIT"]]){const f=fixture(t,{observed});f.project("a");const j=f.enqueue("a");await f.scheduler.pump();assert.equal(f.jobs.get(j.id).state,"queued");assert.equal(f.scheduler.status().blocked[0].reason,expected);assert.equal(f.active.size,0);}
});
test("ancestor and external-tree mutation leases prevent overlapping projects",async t=>{
 const f=fixture(t);const a=f.project("a"),b=f.project("b");const shared=path.join(f.root,"shared");fs.mkdirSync(shared);a.externalTrees=[shared];b.externalTrees=[shared];const release=f.scheduler.acquireMutationLease({projectId:"editing",source:f.root,output:shared});const ja=f.enqueue("a"),jb=f.enqueue("b");await f.scheduler.pump();assert.equal(f.active.size,0);release();await until(()=>f.active.has(ja.id));assert.equal(f.jobs.get(jb.id).state,"queued");assert.throws(()=>f.scheduler.acquireMutationLease({projectId:"editor",source:shared,output:b.output}),e=>e.code==="SOURCE_BUSY");f.active.get(ja.id).resolve();await until(()=>f.active.has(jb.id));f.active.get(jb.id).resolve();await f.scheduler.awaitIdle();
});
test("close preserves queued work for explicit recovery",async t=>{
 const f=fixture(t,{limits:{maxConcurrent:1}});f.project("a");f.project("b");const a=f.enqueue("a"),b=f.enqueue("b");await f.scheduler.pump();await until(()=>f.active.has(a.id));f.scheduler.close();f.active.get(a.id).resolve();await f.scheduler.awaitIdle();const restored=createJobManager({directory:path.join(f.root,"jobs"),adapters:f.adapters});assert.equal(restored.get(b.id).state,"queued");assert.equal(restored.get(a.id).state,"succeeded");
});
test("changed immutable intents and cancellation during observation cannot execute",async t=>{
 const f=fixture(t,{stale:true});f.project("a");f.enqueue("a");await f.scheduler.pump();assert.equal(f.scheduler.status().blocked[0].reason,"BLOCKED_INTENT_CHANGED");
 let observed;const g=fixture(t,{observeResources:()=>new Promise(resolve=>observed=resolve)});g.project("a");const j=g.enqueue("a"),pump=g.scheduler.pump();await until(()=>Boolean(observed));g.jobs.cancel(j.id,g.ownerId,j.sequence);observed({resourceDomain:"runtime",storageDomain:"disk",cpuSlots:4,memoryAvailableBytes:4000,storageAvailableBytes:4000});await pump;assert.equal(g.active.size,0);assert.equal(g.jobs.get(j.id).state,"cancelled");
});
test("bounded scan rotation admits independent work beyond blocked queue heads",async t=>{
 const f=fixture(t,{maxScan:1});f.project("a",{cpuSlots:5});f.project("b");const a=f.enqueue("a"),b=f.enqueue("b");await f.scheduler.pump();await f.scheduler.pump();await until(()=>f.active.has(b.id));f.active.get(b.id).resolve();await f.scheduler.awaitIdle();assert.equal(f.jobs.get(a.id).state,"queued");
});
test("external lease denial releases local ownership without spinning",async t=>{
 const f=fixture(t,{acquireLease:async()=>{throw Object.assign(Error("busy"),{code:"SOURCE_BUSY"});}});const p=f.project("a");f.enqueue("a");await f.scheduler.pump();assert.equal(f.scheduler.status().blocked[0].reason,"BLOCKED_SOURCE_BUSY");const release=f.scheduler.acquireMutationLease(p);f.scheduler.close();release();
});
test("source intent is revalidated while the acquired host lease is held",async t=>{
 let f;f=fixture(t,{acquireLease:async()=>{f.projects.get("a").intent.sourceRevision="changed-after-observation";return ()=>{};}});f.project("a");const j=f.enqueue("a");await f.scheduler.pump();assert.equal(f.active.size,0);assert.equal(f.jobs.get(j.id).state,"queued");assert.equal(f.scheduler.status().blocked[0].reason,"BLOCKED_INTENT_CHANGED");
});

test("admission callback timeouts leave work queued with an explicit bounded reason",async t=>{
 const f=fixture(t,{callbackTimeoutMs:10,observeResources:()=>new Promise(()=>{})});f.project("a");const j=f.enqueue("a");await f.scheduler.pump();assert.equal(f.jobs.get(j.id).state,"queued");assert.equal(f.scheduler.status().blocked[0].reason,"BLOCKED_ADMISSION_TIMEOUT");
});
