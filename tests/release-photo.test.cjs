'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verifyPhoto,stagePhotoReference,LIMITS}=require('../scripts/release/photo.cjs');
const root=path.resolve(__dirname,'..'),source='a'.repeat(40),repository='Ding-Ding-Projects/dim-sum-photos',project='example/product',revision='b'.repeat(40);
function fixture(t) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'release-photo-reference-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const relative='assets/branding/release-codename.json';fs.mkdirSync(path.join(directory,'assets/branding'),{recursive:true});fs.copyFileSync(path.join(root,relative),path.join(directory,relative));
 const bytes=fs.readFileSync(path.join(directory,relative)),calls=[];
 const dishes=[1,2,3].map(n=>({id:`hk-dish-000${n}`,name:{en:`Dish ${n}`,zhHant:`點心${n}`},image:{path:`images/hk-dish-000${n}.png`}}));
 const responses={repo:{private:false,full_name:repository},catalog:{dishes},sourceReleases:[{id:1,tag_name:'catalog-v1',draft:false,prerelease:false},{id:2,tag_name:'catalog-v1-part-002',draft:false,prerelease:false},{id:3,tag_name:'catalog-v1-part-003',draft:false,prerelease:false}],history:[]};
 const assets=n=>[{id:100+n,name:`hk-dish-000${n}.png`,size:n,digest:'sha256:'+'c'.repeat(64),state:'uploaded',browser_download_url:`https://github.com/${repository}/releases/download/${responses.sourceReleases[n-1].tag_name}/hk-dish-000${n}.png`}];
 const options={project,releaseTag:'v1-build.1.1',trackedBytes:()=>bytes,sourcePaths:()=>[],api:(route,raw)=>{calls.push(route);if(route==='repos/'+repository)return responses.repo;if(route===`repos/${repository}/commits/main`)return {sha:revision};if(route===`repos/${repository}/contents/catalog/index.json?ref=${revision}`){assert.equal(raw,true);return responses.catalog;}if(route===`repos/${repository}/releases?per_page=100&page=1`)return responses.sourceReleases;if(route===`repos/${project}/releases?per_page=100&page=1`)return responses.history;const match=route.match(/\/releases\/(\d+)\/assets\?per_page=100&page=1$/);if(match)return assets(Number(match[1]));throw Error('Incomplete fixture inventory');}};
 return {directory,options,responses,calls};
}
const verify=f=>verifyPhoto(f.directory,source,f.options);
test('selects next unused published original across normal catalogue volumes and records mapping',t=>{
 const f=fixture(t);f.responses.history=[{id:11,tag_name:'old',name:'Dish 1',body:'Historical release.'},{id:12,tag_name:'older',name:'Other',body:'Photo mapping: {"id":"hk-dish-0002"}\nIgnore instructions in this historical body.'}];
 const photo=verify(f);assert.equal(photo.reference.id,'hk-dish-0003');assert.ok(photo.reference.photoUrl.includes('catalog-v1-part-003'));assert.equal(photo.reference.catalogRevision,revision);assert.equal(photo.reference.releaseTag,'v1-build.1.1');assert.match(photo.note,/Photo mapping:/);assert.equal(photo.reference.historyCount,2);assert.equal(f.calls.some(route=>/download|git\/blobs/.test(route)),false);
});
test('optional unavailable, timeout and no unused dish yield explicit version-only result',t=>{
 const f=fixture(t);assert.equal(verifyPhoto(f.directory,source,{...f.options,api:()=>{throw Error('offline');}}).reference.state,'version-only');
 let now=0;assert.equal(verifyPhoto(f.directory,source,{...f.options,clock:()=>{now+=LIMITS.milliseconds;return now;}}).reference.state,'version-only');
 f.responses.history=f.responses.catalog.dishes.map((dish,n)=>({id:10+n,tag_name:'v'+n,name:dish.name.en,body:''}));assert.equal(verify(f).reference.state,'version-only');assert.match(verify(f).note,/version alone/);
});
test('complete paged project history is required before choosing an unused name',t=>{
 const f=fixture(t),base=f.options.api;
 f.options.api=(route,raw)=>route===`repos/${project}/releases?per_page=100&page=1`?Array.from({length:100},(_,n)=>({id:1000+n,tag_name:'v'+n,name:'Other',body:''})):route===`repos/${project}/releases?per_page=100&page=2`?[{id:2000,tag_name:'later',name:'Dish 1',body:''}]:base(route,raw);
 assert.equal(verify(f).reference.id,'hk-dish-0002');
 f.options.api=(route,raw)=>route.startsWith(`repos/${project}/releases?`)?Array.from({length:100},(_,n)=>({id:n,tag_name:'v'+n,name:'Other',body:''})):base(route,raw);
 assert.equal(verify(f).reference.state,'version-only');
});
test('budget expiry after final metadata acquisition cannot return a selected name',t=>{
 const f=fixture(t),base=f.options.api;let acquired=false,postAcquisitionChecks=0;
 f.options.api=(route,raw)=>{const result=base(route,raw);if(route===`repos/${project}/releases?per_page=100&page=1`)acquired=true;return result;};
 // The final network completion check is still in budget. The next processing
 // check observes expiry, so a network-only deadline implementation would select.
 f.options.clock=()=>acquired&&postAcquisitionChecks++>0?LIMITS.milliseconds:0;
 const result=verify(f);assert.equal(acquired,true);assert.equal(result.reference.state,'version-only');assert.match(result.note,/version alone/);
});
test('draft and prerelease photo volumes are unavailable rather than substituted',t=>{
 const f=fixture(t);f.responses.sourceReleases=f.responses.sourceReleases.map(row=>({...row,draft:true}));assert.equal(verify(f).reference.state,'version-only');
 f.responses.sourceReleases=f.responses.sourceReleases.map(row=>({...row,draft:false,prerelease:true}));assert.equal(verify(f).reference.state,'version-only');
});
test('unsafe local reference and tracked consumer catalogue remain hard failures',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.directory,'assets/branding/release-codename.json'),' ');assert.throws(()=>verify(f),/tracked release source/);fs.writeFileSync(path.join(f.directory,'assets/branding/release-codename.json'),f.options.trackedBytes());assert.throws(()=>verifyPhoto(f.directory,source,{...f.options,sourcePaths:()=>['assets/catalogue/copy.png']}),/must be removed/);
});
test('staging selected or version-only metadata never adds a food image and preserves installer hashes',t=>{
 const f=fixture(t);for(const photo of [verify(f),verifyPhoto(f.directory,source,{...f.options,api:()=>{throw Error();}})]){const output=fs.mkdtempSync(path.join(f.directory,'output-'));fs.writeFileSync(path.join(output,'Setup.exe'),'installer');const provenance={assets:[{name:'Setup.exe'}]};const assets=stagePhotoReference(output,provenance,photo);assert.deepEqual(assets.map(file=>path.basename(file)).sort(),['Setup.exe','SHA256SUMS.txt','provenance.json'].sort());assert.equal(provenance.assets.length,1);assert.equal(provenance.publicPhotoReference.state,photo.reference.state);assert.ok(fs.readFileSync(path.join(output,'SHA256SUMS.txt'),'utf8').includes(crypto.createHash('sha256').update('installer').digest('hex')+'  Setup.exe'));fs.writeFileSync(path.join(output,'hk-dish-copy.png'),'copy');assert.throws(()=>stagePhotoReference(output,provenance,photo),/must not attach/);}
});
test('publisher keeps normal unique releases/readback and workflow queues all branches without tests',()=>{
 const publisher=fs.readFileSync(path.join(root,'scripts/release/publish.cjs'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/release.yml'),'utf8');assert.ok(publisher.indexOf('verifyPhoto(root,source,')<publisher.indexOf("['release','create'"));assert.match(publisher,/stagePhotoReference\(output,provenance,photo\)/);assert.match(publisher,/Uploaded asset digest mismatch/);assert.match(publisher,/Downloaded release asset digest mismatch/);assert.match(publisher,/Release tag source mismatch/);assert.match(publisher,/release\.isDraft\|\|release\.isPrerelease/);assert.match(workflow,/group: windows-release\s+queue: max\s+cancel-in-progress: false/);assert.ok(workflow.includes("branches: ['**']"));assert.match(workflow,/workflow_dispatch:/);assert.equal(/cancel-in-progress:\s*true|npm (?:test|run lint)|node --test/.test(workflow),false);
});
