"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createIsoWslProducer}=require("../src/main/execution/iso-wsl-producer.cjs");
const {validateOwnershipReceipt,ExecutionService}=require("../src/main/execution/index.cjs");
const initial={version:1,kind:"wsl",ownerToken:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",distribution:"Fixture",bootId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pidNamespace:"pid:[123]",pid:null,startTime:null};
const precise={...initial,pid:42,startTime:"456"};
function fixture(mode={}){
 const records=[],inspected=[];let cancelCount=0,release;const completion=new Promise(resolve=>release=resolve);
 const execution={validateOwnershipReceipt,reconcileCleanup:async owner=>{inspected.push(owner);return{state:mode.unknown?"unknown":"verified-stopped"};},startIsoProducer:async(request,log,options,transactions,context)=>{
  assert.equal(request.target,"all");assert.equal(request.jobs,2);assert.equal(context.lease,lease);
  await options.onOwnership(initial);
  if(mode.refine!==false){await options.onOwnership({...precise,...mode.change});if(mode.duplicate)await options.onOwnership(precise);}
  if(!mode.signal?.aborted)queueMicrotask(()=>release({state:mode.failed?"failed":"succeeded",code:mode.failed?2:0}));
  return{completion,cancel:async()=>{cancelCount++;release({state:"cancelled",code:null});}};
 }};
 const lease={},producer=createIsoWslProducer({execution,transactions:{assertLifecycleLease(){}},jobs:2});
 return{run:()=>producer({grantId:"grant",runtime:{kind:"wsl",distribution:"Fixture"},lease,jobId:"job"},{signal:mode.signal,onOwnership:async receipt=>records.push(receipt)}),records,inspected,cancelCount:()=>cancelCount};
}
test("producer awaits completion and independently checks only precise owner",async()=>{
 const f=fixture(),result=await f.run();assert.equal(result.state,"succeeded");assert.deepEqual(f.records,[initial,precise]);assert.deepEqual(f.inspected,[precise]);
});
for(const mode of [{refine:false},{change:{ownerToken:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}},{change:{distribution:"Other"}},{change:{pidNamespace:"pid:[999]"}},{change:{bootId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}},{duplicate:true},{change:{pid:null,startTime:null}}]){
 test(`rejects invalid ownership progression ${JSON.stringify(mode)}`,async()=>{const f=fixture(mode);await assert.rejects(f.run(),{code:"ISO_TRANSACTION_PRODUCER_OWNER_UNVERIFIED"});assert.equal(f.inspected.length,0);});
}
test("terminal failure and unknown cleanup cannot report producer success",async()=>{
 const failed=fixture({failed:true});assert.equal((await failed.run()).state,"failed");assert.equal(failed.inspected.length,0);
 const unknown=fixture({unknown:true});assert.equal((await unknown.run()).state,"runtime-cleanup-failed");assert.deepEqual(unknown.inspected,[precise]);
});
test("cancel before handshake preserves terminal cancellation with no precise-owner claim",async()=>{
 const controller=new AbortController();controller.abort();const f=fixture({signal:controller.signal,refine:false});assert.equal((await f.run()).state,"cancelled");assert.equal(f.cancelCount(),1);assert.equal(f.inspected.length,0);
});
test("ordinary execution cannot receive internal lease validator through options",async()=>{
 const service=new ExecutionService();let called=false;
 await assert.rejects(service.start({grantId:"absent",runtime:{kind:"wsl",distribution:"Fixture"},target:"all"},undefined,{validateLease(){called=true;}}));assert.equal(called,false);
 await assert.rejects(service.startIsoProducer({grantId:"absent",runtime:{kind:"wsl",distribution:"Fixture"},target:"all"},undefined,{},null,{}),/iso-producer-authority-required/);
});
