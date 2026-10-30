"use strict";
const test=require('node:test');const assert=require('node:assert/strict');
const {validateSpec}=require('../src/main/appliance/contract.cjs');
const {createApplianceService}=require('../src/main/appliance/service.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const valid=()=>({version:1,name:'sample-os',distribution:'Ubuntu-24.04',source:{kind:'registry',image:'ghcr.io/example/app:1'},mode:'console',kioskUrl:'',persistence:true,tunnel:{mode:'off'}});
test('strict appliance specification rejects renderer execution and credential fields',()=>{
 assert.equal(validateSpec(valid()).name,'sample-os');
 for(const extra of [{command:'id'},{output:'/tmp/a'},{credentials:'not-allowed'}])assert.throws(()=>validateSpec({...valid(),...extra}));
 for(const image of ['--privileged','app;id','$(id)','app\nnext'])assert.throws(()=>validateSpec({...valid(),source:{kind:'registry',image}}));
 assert.throws(()=>validateSpec({...valid(),tunnel:{mode:'named',token:'not-allowed'}}));
 assert.throws(()=>validateSpec({...valid(),mode:'kiosk',kioskUrl:'https://user:password@example.com'}));
});
test('native input grants and exact preview are required before execution',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-test-'));let calls=0;
 const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',run:(_exe,args)=>({completion:Promise.resolve({state:'succeeded',stdout:args.includes('manifest')?JSON.stringify({Descriptor:{digest:'sha256:'+'c'.repeat(64),platform:{os:'linux',architecture:'amd64'}}}):'1000\n'})}),downloadsDirectory:()=>directory});
 try {
  await assert.rejects(service.preview({...valid(),source:{kind:'archive',fileId:'00000000-0000-4000-8000-000000000000',image:'sample:1'}}),{code:'FILE_GRANT_REQUIRED'});
  await assert.rejects(service.build('missing',true),{code:'APPLIANCE_PREVIEW_REQUIRED'});
  const preview=await service.preview(valid());
  await assert.rejects(service.build(preview.previewId,false),{code:'SOURCE_CONSENT_REQUIRED'});
  assert.equal(calls,0);await assert.rejects(service.export('missing'),{code:'APPLIANCE_JOB_NOT_FOUND'});
 } finally {await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('root WSL account is rejected before preview admission',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-root-test-'));
 const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',run:()=>({completion:Promise.resolve({state:'succeeded',stdout:'0\n'})})});
 try {await assert.rejects(service.preview(valid()),{code:'APPLIANCE_NON_ROOT_WSL_REQUIRED'});}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('restart records interrupted work without inventing resumed execution',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-restart-test-')),id=require('node:crypto').randomUUID();
 const folder=path.join(directory,'appliance',id);fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({schemaVersion:1,id,state:'running',sequence:3,logs:['Phase: building'],distribution:'Ubuntu'}));
 const service=createApplianceService({directory,dialog:{}});
 try {assert.equal(service.state(id).state,'interrupted');assert.equal(service.state(id).code,'APPLIANCE_RESTART_RECONCILIATION_REQUIRED');}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('export rechecks output and creates checksums plus truthful boot receipt',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-export-test-')),id=require('node:crypto').randomUUID();
 const folder=path.join(directory,'appliance',id),output=path.join(folder,'output'),downloads=path.join(directory,'downloads');fs.mkdirSync(output,{recursive:true});fs.mkdirSync(downloads);
 const bytes=Buffer.alloc(32768,42),sha256=require('node:crypto').createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(output,'sample-os.iso'),bytes);
 fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({schemaVersion:1,id,state:'succeeded',sequence:3,logs:[],distribution:'Ubuntu',outputName:'sample-os.iso',sha256,size:bytes.length,privateArtifact:true}));
 const service=createApplianceService({directory,dialog:{},downloadsDirectory:()=>downloads});
 try {const result=await service.export(id);assert.equal(result.sha256,sha256);assert.equal(result.privateArtifact,true);assert.equal(JSON.parse(fs.readFileSync(path.join(downloads,result.name+'.receipt.json'))).bootVerified,false);fs.writeFileSync(path.join(output,'sample-os.iso'),Buffer.alloc(32768,7));await assert.rejects(service.export(id),{code:'APPLIANCE_OUTPUT_CHANGED'});}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('archive content changed after preview cannot start the producer',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-change-test-')),archive=path.join(directory,'input.tar');fs.writeFileSync(archive,'first');let starts=0;
 const service=createApplianceService({directory,dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[archive]})},wslExecutable:'wsl.exe',run:(_file,args)=>{if(args.includes('bash'))starts++;return {completion:Promise.resolve({state:'succeeded',stdout:'1000\n'})};}});
 try {const choice=await service.choose('archive'),preview=await service.preview({...valid(),source:{kind:'archive',fileId:choice.id,image:'sample:1'}});fs.writeFileSync(archive,'changed');await assert.rejects(service.build(preview.previewId,true),{code:'APPLIANCE_INPUT_CHANGED'});assert.equal(starts,0);}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('unverified process cleanup never becomes cancelled',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-cancel-test-')),id=require('node:crypto').randomUUID(),folder=path.join(directory,'appliance',id);fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({schemaVersion:1,id,state:'running',sequence:1,logs:[],distribution:'Ubuntu'}));
 const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',scriptDirectory:directory,run:()=>({completion:Promise.resolve({state:'succeeded',stdout:'{"state":"identity-mismatch"}'})})});
 try {const result=await service.cancel(id);assert.equal(result.state,'interrupted');assert.equal(result.code,'APPLIANCE_CLEANUP_UNVERIFIED');}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('successful verification launcher without boot evidence stays unverified',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-verify-test-')),id=require('node:crypto').randomUUID(),folder=path.join(directory,'appliance',id),output=path.join(folder,'output');fs.mkdirSync(output,{recursive:true});
 const bytes=Buffer.alloc(32768,42),sha256=require('node:crypto').createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(output,'sample-os.iso'),bytes);
 fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({schemaVersion:1,id,state:'succeeded',sequence:1,logs:[],distribution:'Ubuntu',outputName:'sample-os.iso',sha256,size:bytes.length}));
 const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',scriptDirectory:directory,run:(_exe,args)=>({completion:Promise.resolve({state:'succeeded',stdout:args.includes('id')?'1000\n':''})})});
 try {await service.verify(id);for(let count=0;count<20&&service.state(id).verification.state==='pending';count++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(service.state(id).verification.state,'unverified');assert.equal(service.state(id).verification.bootVerified,false);}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('real Python verification function requires an absent destination before tool execution',t=>{
 const helper=path.join(__dirname,'../scripts/appliance/verify-boot.py');if(!fs.existsSync(helper)){t.skip('Producer helper is owned by the separate lane and is not incorporated here yet.');return;}
 const child=require('node:child_process'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-verifier-boundary-'));
 try{
  const iso=path.join(directory,'test.iso');fs.writeFileSync(iso,'bounded fixture');const sha=require('node:crypto').createHash('sha256').update('bounded fixture').digest('hex');
  const existing=path.join(directory,'existing');fs.mkdirSync(existing);const absent=path.join(directory,'absent');
  const wrapper="import os,runpy,shutil,sys\nfrom pathlib import Path\nos.getuid=lambda:1000\nshutil.which=lambda name:None\nmodule=runpy.run_path(sys.argv[1],run_name='fixture')\ntry:\n module['verify'](Path(sys.argv[2]),sys.argv[3],Path(sys.argv[4]))\nexcept ValueError as error:\n print(str(error))";
  const execute=out=>child.spawnSync('python',['-c',wrapper,helper,iso,sha,out],{encoding:'utf8',timeout:10000});
  const before=execute(existing),after=execute(absent);assert.equal(before.status,0);assert.match(before.stdout+before.stderr,/Select a new verification directory/);assert.equal(after.status,0);assert.match(after.stdout+after.stderr,/dependency unavailable/);assert.equal(fs.existsSync(absent),false);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('concurrent verify requests launch one owned verifier and dispose cancels that operation',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-verify-dispose-')),id=require('node:crypto').randomUUID(),folder=path.join(directory,'appliance',id),output=path.join(folder,'output');fs.mkdirSync(output,{recursive:true});
 const bytes=Buffer.alloc(32768,42),sha256=require('node:crypto').createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(output,'sample-os.iso'),bytes);
 fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({schemaVersion:1,id,state:'succeeded',sequence:1,logs:[],distribution:'Ubuntu',outputName:'sample-os.iso',sha256,size:bytes.length}));
 let settle,controlled=false,nativeCancelled=false,verifierLaunches=0;
 const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',scriptDirectory:directory,run:(_exe,args)=>{
  if(args.includes('id'))return {completion:Promise.resolve({state:'succeeded',stdout:'1000\n'})};
  if(args.some(value=>typeof value==='string'&&value.endsWith('control-appliance.py'))){controlled=true;return {completion:Promise.resolve({state:'succeeded',stdout:'{"state":"verified-stopped"}'})};}
  assert.equal(fs.existsSync(path.join(output,path.basename(args.at(-1)))),false);
  verifierLaunches++;return {completion:new Promise(resolve=>{settle=resolve}),cancel:async()=>{nativeCancelled=true;settle({state:'cancelled'});}};
 }});
 try {const replies=await Promise.all([service.verify(id),service.verify(id)]);assert.equal(replies[0].verification.state,'pending');assert.equal(replies[1].verification.state,'pending');assert.equal(verifierLaunches,1);await service.dispose();assert.equal(controlled,true);assert.equal(nativeCancelled,true);assert.equal(service.state(id).verification.bootVerified,false);assert.equal(service.state(id).verification.cleanupVerified,true);}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('prepared source resolves only host-owned bundle IDs and detects bundled-file tampering',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-bundle-test-')),id=require('node:crypto').randomUUID(),folder=path.join(directory,'appliance-preparation',id),workload=path.join(folder,'workload');fs.mkdirSync(path.join(workload,'backend/docker'),{recursive:true});
 const hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');const archive=Buffer.from('bounded archive fixture'),compose=Buffer.from('{"services":{"web":{"image":"fixture:1"}}}'),seccomp=Buffer.from('{}');fs.writeFileSync(path.join(folder,'prepared-image.tar'),archive);fs.writeFileSync(path.join(workload,'compose.yaml'),compose);fs.writeFileSync(path.join(workload,'backend/docker/chromium-seccomp.json'),seccomp);
 const image='material-buildroot/prepared:'+id;
 const bundleFiles=[{path:'compose.yaml',size:compose.length,sha256:hash(compose)},{path:'backend/docker/chromium-seccomp.json',size:seccomp.length,sha256:hash(seccomp)}];const manifest=Buffer.from(JSON.stringify({schemaVersion:1,sourceRevision:'a'.repeat(40),image,imageId:'sha256:'+'b'.repeat(64),archive:{name:'prepared-image.tar',size:archive.length,sha256:hash(archive)},bundleFiles,completeWorkload:true,endpoints:require('../src/main/appliance/workload-endpoints.json')['job-2027-fork']}));fs.writeFileSync(path.join(folder,'prepared-manifest.json'),manifest);fs.writeFileSync(path.join(folder,'state.json'),JSON.stringify({schemaVersion:1,id,state:'succeeded',sourceRevision:'a'.repeat(40),distribution:'Ubuntu',logs:[],sequence:1,prepared:{image,imageId:'sha256:'+'b'.repeat(64),sha256:hash(archive),size:archive.length,completeWorkload:true,bundleFiles,manifest:{size:manifest.length,sha256:hash(manifest)}}}));
 const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',run:()=>({completion:Promise.resolve({state:'succeeded',stdout:'1000\n'})})});
 try {const preview=await service.preview({...valid(),source:{kind:'prepared',bundleId:id}});assert.ok(preview.previewId);assert.equal(preview.summary.privateArtifact,true);fs.writeFileSync(path.join(workload,'backend/docker/chromium-seccomp.json'),'changed');await assert.rejects(service.preview({...valid(),source:{kind:'prepared',bundleId:id}}),{code:'APPLIANCE_OUTPUT_CHANGED'});}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
});
test('final prepared preview and result admit exact source receipts for both recipe profiles',async()=>{
 for(const adapter of ['job-2027-upstream','home-assistant-material']){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-profile-boundary-')),id=require('node:crypto').randomUUID(),folder=path.join(directory,'appliance-preparation',id),workload=path.join(folder,'workload');fs.mkdirSync(workload,{recursive:true});
  const hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex'),revision='a'.repeat(40),image=(adapter==='job-2027-upstream'?'material-buildroot/job-api:':'material-buildroot/home-assistant:')+id,imageId='sha256:'+'b'.repeat(64),endpoints=require('../src/main/appliance/workload-endpoints.json')[adapter];
  const archive=Buffer.from('archive fixture '+adapter),compose=Buffer.from(JSON.stringify({services:{app:{image}}})),receipt=Buffer.from(JSON.stringify({schemaVersion:1,adapter,sourceRevision:revision,runtimeVerified:false}));fs.writeFileSync(path.join(folder,'prepared-image.tar'),archive);fs.writeFileSync(path.join(workload,'compose.yaml'),compose);fs.writeFileSync(path.join(workload,'source-receipt.json'),receipt);
  const bundleFiles=[{path:'compose.yaml',size:compose.length,sha256:hash(compose)},{path:'source-receipt.json',size:receipt.length,sha256:hash(receipt)}];
  const manifest=Buffer.from(JSON.stringify({schemaVersion:1,adapter,sourceRevision:revision,image,imageId,archive:{name:'prepared-image.tar',size:archive.length,sha256:hash(archive)},bundleFiles,completeWorkload:true,endpoints}));fs.writeFileSync(path.join(folder,'prepared-manifest.json'),manifest);
  fs.writeFileSync(path.join(folder,'state.json'),JSON.stringify({schemaVersion:1,id,state:'succeeded',adapter,sourceRevision:revision,endpoints:{productiveUrl:'http://caller.invalid/'},distribution:'Ubuntu',logs:[],sequence:1,prepared:{image,imageId,sha256:hash(archive),size:archive.length,completeWorkload:true,bundleFiles,manifest:{size:manifest.length,sha256:hash(manifest)}}}));
  const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',run:()=>({completion:Promise.resolve({state:'succeeded',stdout:'1000\n'})})});
  try {const preview=await service.preview({...valid(),source:{kind:'prepared',bundleId:id}});assert.ok(preview.previewId);const result=await service.prepare.result(id);assert.deepEqual(result.endpoints,endpoints);assert.equal(result.bundleId,id);fs.writeFileSync(path.join(workload,'source-receipt.json'),'changed');await assert.rejects(service.prepare.result(id),{code:'APPLIANCE_OUTPUT_CHANGED'});}finally{await service.dispose();fs.rmSync(directory,{recursive:true,force:true});}
 }
});
test('disposal during verifier admission prevents any later QEMU launch',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-verify-admission-')),id=require('node:crypto').randomUUID(),folder=path.join(directory,'appliance',id),output=path.join(folder,'output');fs.mkdirSync(output,{recursive:true});
 const bytes=Buffer.alloc(32768,42),sha256=require('node:crypto').createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(output,'sample-os.iso'),bytes);fs.writeFileSync(path.join(folder,'job.json'),JSON.stringify({schemaVersion:1,id,state:'succeeded',sequence:1,logs:[],distribution:'Ubuntu',outputName:'sample-os.iso',sha256,size:bytes.length}));
 let releaseUser,observeUser,launches=0;const observed=new Promise(resolve=>{observeUser=resolve});
 const service=createApplianceService({directory,dialog:{},wslExecutable:'wsl.exe',scriptDirectory:directory,run:(_exe,args)=>{if(args.includes('id')){observeUser();return {completion:new Promise(resolve=>{releaseUser=resolve})};}launches++;return {completion:Promise.resolve({state:'failed'})};}});
 try {const pending=service.verify(id);await observed;await service.dispose();releaseUser({state:'succeeded',stdout:'1000\n'});await assert.rejects(pending,{code:'CANCELLED'});assert.equal(launches,0);assert.equal(service.state(id).verification.code,'CANCELLED');}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
