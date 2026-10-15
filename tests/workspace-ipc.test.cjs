'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createWorkspaceIPC}=require('../src/main/security/workspace-ipc.cjs');
test('workspace IPC denies foreign frames before touching storage',()=>{
 let calls=0;const ipc=createWorkspaceIPC({desktop:{admitted:e=>e==='owner'},service:{get:()=>{calls++;return {ok:true};},exportDocument:()=>{calls++;return {ok:true};},mutate:()=>{calls++;return {ok:true};}}});
 assert.equal(ipc.get('foreign').code,'UNAUTHORIZED');assert.equal(ipc.export('foreign').code,'UNAUTHORIZED');assert.equal(ipc.mutate('foreign','{}').code,'UNAUTHORIZED');assert.equal(calls,0);
 for(const body of ['{}','{"action":"onboarding.complete","action":"plan.delete","expectedRevision":0}','{"action":"onboarding.complete","expectedRevision":0,"path":"/tmp"}'])assert.equal(ipc.mutate('owner',body).code,'INVALID_REQUEST');
 assert.equal(calls,0);assert.equal(ipc.mutate('owner',JSON.stringify({action:'onboarding.complete',expectedRevision:0})).ok,true);assert.equal(calls,1);
});
