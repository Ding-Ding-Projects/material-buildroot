"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {parseFailure}=require('../src/main/appliance/failure-diagnostic.cjs');
const {createApplianceService}=require('../src/main/appliance/service.cjs');
const diagnostic={schemaVersion:1,stage:'preparing',code:'DOCKER_DAEMON_UNAVAILABLE',tool:'docker',exitCode:1};
test('producer diagnostics admit only the fixed bounded schema without raw output',()=>{
 assert.deepEqual(parseFailure(Buffer.from(JSON.stringify(diagnostic))),diagnostic);
 for(const value of [{...diagnostic,stderr:'private output'},{...diagnostic,code:'UNKNOWN'},{...diagnostic,tool:'shell'},{...diagnostic,exitCode:256},{...diagnostic,stage:'other'}])assert.equal(parseFailure(Buffer.from(JSON.stringify(value))),null);
 assert.equal(parseFailure(Buffer.alloc(1025)),null);assert.equal(parseFailure(Buffer.from('{"schemaVersion":1,"schemaVersion":1}')),null);
});
test('failed build exposes and persists validated producer diagnostics without changing cleanup proof',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-diagnostic-test-'));
 const run=(_file,args)=>{
  if(args.includes('id'))return {completion:Promise.resolve({state:'succeeded',stdout:'1000\n'})};
  if(args.includes('manifest'))return {completion:Promise.resolve({state:'succeeded',stdout:JSON.stringify({Descriptor:{digest:'sha256:'+'c'.repeat(64),platform:{os:'linux',architecture:'amd64'}}})})};
  if(args.includes('bash')){const id=fs.readdirSync(path.join(directory,'appliance'))[0];fs.writeFileSync(path.join(directory,'appliance',id,'output','failure.json'),JSON.stringify(diagnostic));return {completion:Promise.resolve({state:'failed',code:1,stdout:'must not appear',stderr:'private output'})};}
  return {completion:Promise.resolve({state:'succeeded',stdout:'{"state":"verified-stopped"}'})};
 };
 let service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',scriptDirectory:directory,run});
 try {const preview=await service.preview({version:1,name:'diagnostic',distribution:'Ubuntu',source:{kind:'registry',image:'nginx:1'},mode:'console',kioskUrl:'',persistence:true,tunnel:{mode:'off'}});const started=await service.build(preview.previewId,true);for(let i=0;i<40&&service.state(started.id).state==='running';i++)await new Promise(resolve=>setTimeout(resolve,10));const failed=service.state(started.id);assert.equal(failed.state,'failed');assert.equal(failed.code,'APPLIANCE_BUILD_FAILED');assert.equal(failed.diagnosticStatus,'available');assert.deepEqual(failed.diagnostic,diagnostic);assert.equal(JSON.stringify(failed).includes('private output'),false);await service.dispose();service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',scriptDirectory:directory,run});assert.deepEqual(service.state(started.id).diagnostic,diagnostic);}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('saved archive binding diagnostics remain distinct from source admission drift',()=>{
 const saved={...diagnostic,code:'SAVED_IMAGE_IDENTITY_MISMATCH',tool:'python3'};
 assert.deepEqual(parseFailure(Buffer.from(JSON.stringify(saved))),saved);
 assert.equal(parseFailure(Buffer.from(JSON.stringify({...saved,code:'SOURCE_IDENTITY_MISMATCH'}))).code,'SOURCE_IDENTITY_MISMATCH');
 for(const code of ['SAVED_IMAGE_IDENTITY_MISMATCH_EXTRA','SAVED_IMAGE_IDENTITY_MATCH','saved_image_identity_mismatch'])assert.equal(parseFailure(Buffer.from(JSON.stringify({...saved,code}))),null);
});
