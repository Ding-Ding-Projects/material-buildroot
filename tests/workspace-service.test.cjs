'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createWorkspaceService}=require('../src/main/workspace-service.cjs');
function setup(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-service-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const filePath=path.join(directory,'workspace.json');return {filePath,service:createWorkspaceService({filePath})};}
const plan={name:'Board image',runtime:'wsl',target:'image',status:'draft',notes:'Preserve source'};
test('plans and preferences survive service restart with revision conflicts preserving data',t=>{const {filePath,service}=setup(t);assert.equal(service.get().state.preferences.theme,'system');let reply=service.mutate({expectedRevision:0,action:'plan.create',plan});assert.equal(reply.ok,true);assert.equal(reply.state.revision,1);assert.equal(service.mutate({expectedRevision:0,action:'onboarding.complete'}).code,'REVISION_CONFLICT');assert.equal(service.mutate({expectedRevision:1,action:'preferences.update',preferences:{theme:'dark'}}).ok,true);assert.equal(service.mutate({expectedRevision:2,action:'onboarding.complete'}).ok,true);const restored=createWorkspaceService({filePath}).get().state;assert.equal(restored.plans[0].name,plan.name);assert.equal(restored.preferences.theme,'dark');assert.equal(restored.onboardingCompleted,true);assert.equal(restored.activity.length,3);});
test('snapshots restore content as a new revision and exports exclude history',t=>{const {service}=setup(t);service.mutate({expectedRevision:0,action:'plan.create',plan});const snapshot=service.mutate({expectedRevision:1,action:'snapshot.create',name:'Before edits'}).state.snapshots[0];const id=service.get().state.plans[0].id;service.mutate({expectedRevision:2,action:'plan.update',id,changes:{name:'Changed'}});const restored=service.mutate({expectedRevision:3,action:'snapshot.restore',id:snapshot.id});assert.equal(restored.state.revision,4);assert.equal(restored.state.plans[0].name,plan.name);const document=service.exportDocument().document;assert.equal(Object.hasOwn(JSON.parse(document),'activity'),false);assert.equal(Object.hasOwn(JSON.parse(document),'snapshots'),false);service.mutate({expectedRevision:4,action:'plan.delete',id});assert.equal(service.mutate({expectedRevision:5,action:'document.import',document}).state.plans.length,1);});
test('unsafe requests, prototype fields, accessors, large and duplicate documents are rejected',t=>{const {service}=setup(t);for(const input of [{expectedRevision:0,action:'shell',command:'whoami'},{expectedRevision:0,action:'plan.create',plan:{...plan,path:'/etc'}},{expectedRevision:0,action:'plan.create',plan:{...plan,notes:'x'.repeat(4001)}},JSON.parse('{"expectedRevision":0,"action":"onboarding.complete","__proto__":{}}'),{expectedRevision:0,action:'document.import',document:'{"format":"material-buildroot-workspace-export","version":1,"version":1,"plans":[],"preferences":{"theme":"system"},"onboardingCompleted":false}'},{expectedRevision:0,action:'document.import',document:'['.repeat(20000)}])assert.equal(service.mutate(input).code,'INVALID_REQUEST');const accessor={expectedRevision:0,action:'plan.create'};Object.defineProperty(accessor,'plan',{enumerable:true,get(){throw new Error('Must not invoke');}});assert.equal(service.mutate(accessor).code,'INVALID_REQUEST');assert.equal(service.get().state.revision,0);});
test('plan capacity rejects overflow while activity remains bounded',t=>{const {service}=setup(t);for(let revision=0;revision<100;revision++)assert.equal(service.mutate({expectedRevision:revision,action:'plan.create',plan}).ok,true);assert.equal(service.mutate({expectedRevision:100,action:'plan.create',plan}).code,'LIMIT_REACHED');const state=service.mutate({expectedRevision:100,action:'onboarding.complete'}).state;assert.equal(state.plans.length,100);assert.equal(state.activity.length,100);assert.equal(state.activity[0].revision,2);assert.equal(state.activity.at(-1).revision,101);});
test('imports reject foreign and secret-bearing documents without replacing saved state',t=>{const {service}=setup(t);service.mutate({expectedRevision:0,action:'plan.create',plan});const document=JSON.parse(service.exportDocument().document);for(const extra of [{credentials:{token:'example'}},{format:'foreign'},{version:2},{plans:[{...document.plans[0],command:'make'}]}]){assert.equal(service.mutate({expectedRevision:1,action:'document.import',document:JSON.stringify({...document,...extra})}).code,'INVALID_REQUEST');assert.equal(service.get().state.revision,1);assert.equal(service.get().state.plans[0].name,plan.name);}});
test('paged activity retains records beyond the bounded workspace view across restarts',t=>{const {filePath,service}=setup(t);for(let revision=0;revision<105;revision++)assert.equal(service.mutate({expectedRevision:revision,action:'onboarding.complete'}).ok,true);const restarted=createWorkspaceService({filePath});assert.equal(restarted.get().state.activity.length,100);const first=restarted.activityPage({limit:100});assert.equal(first.ok,true);assert.equal(first.events.length,100);assert.equal(first.events[0].revision,105);const second=restarted.activityPage({beforeRevision:first.nextBeforeRevision,limit:100});assert.deepEqual(second.events.map(event=>event.revision),[5,4,3,2,1]);assert.equal(second.nextBeforeRevision,null);assert.equal(restarted.activityPage({limit:1000}).code,'INVALID_REQUEST');assert.equal(restarted.activityPage({command:'read'}).code,'INVALID_REQUEST');});
test('onboarding progress resumes independently from completion and dismissal',t=>{const {filePath,service}=setup(t);const created=service.mutate({expectedRevision:0,action:'plan.create',plan});const planId=created.state.plans[0].id;const onboarding={step:1,planId,runtime:'docker',name:'Saved draft',dismissed:true};assert.equal(service.mutate({expectedRevision:1,action:'onboarding.update',onboarding}).ok,true);const resumed=createWorkspaceService({filePath}).get().state;assert.deepEqual(resumed.onboarding,onboarding);assert.equal(resumed.onboardingCompleted,false);const complete=service.mutate({expectedRevision:2,action:'onboarding.complete'});assert.equal(complete.state.onboardingCompleted,true);assert.equal(complete.state.onboarding.dismissed,true);assert.equal(service.mutate({expectedRevision:2,action:'onboarding.update',onboarding}).code,'REVISION_CONFLICT');for(const changes of [{step:3},{runtime:'native'},{name:'x'.repeat(81)},{dismissed:'true'},{planId:'not-an-id'},{command:'make'}])assert.equal(service.mutate({expectedRevision:3,action:'onboarding.update',onboarding:{...onboarding,...changes}}).code,'INVALID_REQUEST');assert.equal(service.get().state.revision,3);});
test('setup plan creation and onboarding progress commit in one revision and never duplicate',t=>{
 const {filePath,service}=setup(t);
 const first=service.mutate({expectedRevision:0,action:'onboarding.createPlan',plan});
 assert.equal(first.ok,true);
 assert.equal(first.state.revision,1);
 assert.equal(first.state.plans.length,1);
 const planId=first.state.plans[0].id;
 assert.deepEqual(first.state.onboarding,{step:2,runtime:'wsl',name:'Board image',dismissed:false,planId});
 const resumed=createWorkspaceService({filePath}).get().state;
 assert.deepEqual(resumed.onboarding,first.state.onboarding);
 assert.equal(resumed.plans.length,1);
 const retry=service.mutate({expectedRevision:1,action:'onboarding.createPlan',plan:{...plan,name:'Another'}});
 assert.equal(retry.ok,true);
 assert.equal(retry.state.plans.length,1,'a recorded setup plan is reused, not duplicated');
 assert.equal(retry.state.onboarding.planId,planId);
 assert.equal(service.mutate({expectedRevision:2,action:'plan.delete',id:planId}).ok,true);
 const recreated=service.mutate({expectedRevision:3,action:'onboarding.createPlan',plan});
 assert.equal(recreated.state.plans.length,1);
 assert.notEqual(recreated.state.onboarding.planId,planId,'a removed setup plan is replaced');
 for(const bad of [{...plan,runtime:'native'},{...plan,command:'make'},{name:'x'}])assert.equal(service.mutate({expectedRevision:4,action:'onboarding.createPlan',plan:bad}).code,'INVALID_REQUEST');
 assert.equal(service.mutate({expectedRevision:4,action:'onboarding.createPlan',plan,onboarding:{step:0,runtime:'wsl',name:'',dismissed:false}}).code,'INVALID_REQUEST');
});
test('a failed setup plan write leaves neither the plan nor the progress behind',t=>{
 const {filePath,service}=setup(t);
 service.mutate({expectedRevision:0,action:'preferences.update',preferences:{theme:'light'}});
 const previous=fs.readFileSync(filePath,'utf8');
 const rename=fs.renameSync;
 fs.renameSync=()=>{throw Object.assign(new Error('Simulated replacement failure'),{code:'EACCES'});};
 try{assert.equal(service.mutate({expectedRevision:1,action:'onboarding.createPlan',plan}).code,'STORAGE_UNAVAILABLE');}
 finally{fs.renameSync=rename;}
 assert.equal(fs.readFileSync(filePath,'utf8'),previous);
 const state=createWorkspaceService({filePath}).get().state;
 assert.equal(state.plans.length,0);
 assert.equal(state.onboarding.step,0);
 assert.equal(state.onboarding.planId,undefined);
});
