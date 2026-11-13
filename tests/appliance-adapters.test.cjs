'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {adapterForSource,repositoryFromOrigin,sourceRequirements}=require('../src/main/appliance/adapters/index.cjs');
const shape={paths:new Set(['backend/pyproject.toml','backend/src/job_backend/main.py','frontend/package.json','frontend/package-lock.json']),backendProject:'[project]\nname = "job-2027-backend"\n'};
test('source origin parsing is credential-free and compatibility uses pinned shape rather than owner',()=>{
 assert.equal(repositoryFromOrigin('https://github.com/fixture-owner/workload.git'),'fixture-owner/workload');assert.equal(repositoryFromOrigin('git@github.com:sample-owner/other-source.git'),'sample-owner/other-source');
 assert.equal(adapterForSource('https://github.com/fixture-owner/workload.git',shape).adapter,'job-2027-upstream');assert.equal(adapterForSource('https://github.com/another-owner/another-source',shape).shapeTrusted,false);assert.equal(adapterForSource('https://github.com/fixture-owner/workload.git',{paths:new Set()}),null);
 for(const origin of ['https://github.com.evil.test/fixture-owner/workload','https://user:pass@github.com/fixture-owner/workload','https://github.com/fixture-owner/workload/other','https://github.com/fixture-owner/workload?x=1','https://github.com/fixture-owner/workload#part','file:///source','https://github.com/fixture-owner/workload\n',null]){assert.equal(adapterForSource(origin,shape),null);assert.equal(repositoryFromOrigin(origin),null);}
});
test('custom frontend requirements use source roles without an owner allowlist',()=>{
 const plan=sourceRequirements('home-assistant-material');assert.equal(plan.primary,'core');assert.equal(plan.companion,'frontend');assert.ok(plan.limitations.includes('NO_SUPERVISOR_OR_HAOS'));assert.throws(()=>sourceRequirements('renderer-command'));
});
test('source shape detection rejects ambiguous products and does not promote compatibility to trust',()=>{
 const combined={paths:new Set([...shape.paths,'pyproject.toml','homeassistant/__init__.py','homeassistant/components/frontend/manifest.json','homeassistant/package_constraints.txt','requirements.txt']),backendProject:shape.backendProject,rootProject:'[project]\nname = "homeassistant"\n'};
 assert.equal(adapterForSource('https://github.com/fixture-owner/combined',combined),null);const recognized=adapterForSource('https://github.com/fixture-owner/workload',shape);assert.equal(recognized.shapeTrusted,false);assert.equal(recognized.requiresExecutionConsent,true);
});
test('one repository carrying Core and the frontend is recognized without a companion source',()=>{
 const origin='https://github.com/fixture-owner/material-home';
 const complete={paths:new Set(['versions.json','core/Dockerfile','core/requirements.txt','core/requirements_all.txt','core/homeassistant/__init__.py','core/homeassistant/package_constraints.txt','core/homeassistant/components/frontend/manifest.json','frontend/package.json','frontend/pnpm-lock.yaml','frontend/pyproject.toml','frontend/gulpfile.js']),coreProject:'[project]\nname = "homeassistant"\n'};
 const found=adapterForSource(origin,complete);assert.equal(found.adapter,'home-assistant-material');assert.equal(found.role,'repository');assert.equal(found.shapeTrusted,false);
 const plan=sourceRequirements('home-assistant-material','repository');assert.equal(plan.primary,'repository');assert.equal(plan.companion,null);assert.ok(plan.limitations.includes('NO_SUPERVISOR_OR_HAOS'));
 for(const missing of complete.paths){const paths=new Set(complete.paths);paths.delete(missing);assert.equal(adapterForSource(origin,{...complete,paths}),null,missing);}
 assert.equal(adapterForSource(origin,{...complete,coreProject:'[project]\nname = "other"\n'}),null);
});
test('frontend compatibility requires the actual recipe inputs and a source version',()=>{
 const origin='https://github.com/fixture-owner/frontend-source';
 const complete={paths:new Set(['pyproject.toml','package.json','yarn.lock','script/build_frontend','.yarn/releases/yarn-4.18.0.cjs']),rootProject:'[project]\nname = "home-assistant-frontend"\nversion = "20260729.0"\n',packageJson:'{"name":"home-assistant-frontend"}'};
 assert.equal(adapterForSource(origin,complete).role,'frontend');assert.equal(adapterForSource(origin,complete).requiresExecutionConsent,true);
 for(const missing of ['pyproject.toml','yarn.lock','script/build_frontend','.yarn/releases/yarn-4.18.0.cjs']){const paths=new Set(complete.paths);paths.delete(missing);assert.equal(adapterForSource(origin,{...complete,paths}),null,missing);}
 const buildOnly={paths:new Set(['package.json','yarn.lock','script/build']),packageJson:complete.packageJson};assert.equal(adapterForSource(origin,buildOnly),null);
 assert.equal(adapterForSource(origin,{...complete,rootProject:'[project]\nname = "home-assistant-frontend"\n'}),null);
});
