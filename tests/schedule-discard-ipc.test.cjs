'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createScheduleIPC}=require('../src/main/preferences/schedule-ipc.cjs');
test('draft actions reject foreign frames and active or unknown shared mode before storage access',async()=>{
  let state={available:true,active:false},calls=0;
  const ipc=createScheduleIPC({desktop:{admitted:event=>event==='owner'},sharedModeStatus:()=>state,service:{draftList(){calls++;return {records:[],next:0,hasMore:false};},draftRead(){calls++;return null;},draftDiscard(){calls++;return {sequence:1,discardedAt:1};}}});
  const requests=[{action:'draft.discard',document:{}},{action:'draft.list',after:0,limit:20},{action:'draft.read',sequence:1}];
  for(const request of requests)assert.equal((await ipc.request('foreign',JSON.stringify(request))).code,'UNAUTHORIZED');
  for(const restricted of [undefined,{available:false,active:null},{available:true,active:true}]) {
    state=restricted;
    for(const request of requests)assert.equal((await ipc.request('owner',JSON.stringify(request))).code,'UNAUTHORIZED');
  }
  assert.equal(calls,0);state={available:true,active:false};
  assert.deepEqual(await ipc.request('owner',JSON.stringify(requests[1])),{ok:true,result:{records:[],next:0,hasMore:false}});
  assert.equal(calls,1);
});
test('draft IPC admits exact local-data envelopes and does not expose host or enrollment controls',async()=>{
  let calls=0;
  const ipc=createScheduleIPC({desktop:{admitted:()=>true},sharedModeStatus:()=>({available:true,active:false}),service:{draftDiscard(){calls++;return {};},draftList(){calls++;return {};},draftRead(){calls++;return {};}}});
  const invalid=[{action:'draft.discard',document:{},token:'secret'},{action:'draft.discard',document:{},authorize:true},{action:'draft.discard',document:{},enrollments:[]},{action:'draft.read',sequence:'1'},{action:'draft.read',sequence:0},{action:'draft.read',sequence:1,directory:'/outside'},{action:'draft.list',after:0,limit:21},{action:'draft.list',after:-1,limit:1},{action:'draft.restore',sequence:1}];
  for(const request of invalid)assert.equal((await ipc.request({},JSON.stringify(request))).code,'INVALID_REQUEST');
  assert.equal(calls,0);
});
test('shared-mode changes revoke an outstanding draft append and withhold a draft read reply',async()=>{
  let state={available:true,active:false},resume,effects=0;
  let wait=new Promise(resolve=>resume=resolve);
  const ipc=createScheduleIPC({desktop:{admitted:()=>true},sharedModeStatus:()=>state,service:{async draftDiscard({authorize}){await wait;if(!authorize())throw Object.assign(Error(),{code:'UNAUTHORIZED'});effects++;return {};},async draftRead(){await wait;return {sequence:1,discardedAt:1,document:{private:'withheld'}};}}});
  const append=ipc.request({},JSON.stringify({action:'draft.discard',document:{}}));
  state={available:true,active:true};resume();assert.deepEqual(await append,{ok:false,code:'UNAUTHORIZED'});assert.equal(effects,0);
  state={available:true,active:false};wait=new Promise(resolve=>resume=resolve);
  const read=ipc.request({},JSON.stringify({action:'draft.read',sequence:1}));
  state={available:false,active:null};resume();assert.deepEqual(await read,{ok:false,code:'UNAUTHORIZED'});
});
test('missing shared-mode provider fails closed for draft reads without changing ordinary schedule actions',async()=>{
  const ipc=createScheduleIPC({desktop:{admitted:()=>true},service:{read:()=>null,draftRead:()=>assert.fail('restricted draft accessed')}});
  assert.deepEqual(await ipc.request({},'{"action":"draft.read","sequence":1}'),{ok:false,code:'UNAUTHORIZED'});
  assert.deepEqual(await ipc.request({},'{"action":"read"}'),{ok:true,result:null});
});
