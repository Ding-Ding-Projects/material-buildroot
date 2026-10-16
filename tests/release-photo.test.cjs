'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {verifyPhoto,stagePhoto,decodePhoto}=require('../scripts/release/photo.cjs');
const root=path.resolve(__dirname,'..'),source='a'.repeat(40),filename='hk-dish-0001-classic-har-gow.png';
function fixture(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'release-photo-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  for(const file of ['assets/catalogue/index.json','assets/catalogue/'+filename,'assets/branding/release-codename.json']){fs.mkdirSync(path.dirname(path.join(directory,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(directory,file));}
  const committed=new Map(['assets/catalogue/index.json','assets/catalogue/'+filename].map(file=>[file,fs.readFileSync(path.join(directory,file))]));
  return {directory,options:{trackedBytes:file=>committed.get(file),decode:()=>({width:1254,height:1254})}};
}
test('selected existing original is required and its exact attachment is named',t=>{
  const f=fixture(t),result=verifyPhoto(f.directory,source,f.options);
  assert.equal(path.basename(result.file),filename);assert.match(result.note,/Classic Har Gow/);assert.ok(result.note.includes(filename));assert.match(result.note,/No standalone license/);
});
test('actual Windows decoder renders the pinned original and rejects invalid image bytes', {skip:process.platform!=='win32'},t=>{
  const f=fixture(t);
  // Only source tracking is substituted; decoding uses the production launcher.
  const result=verifyPhoto(f.directory,source,{trackedBytes:f.options.trackedBytes});
  assert.equal(result.dish.width,1254);assert.equal(result.dish.height,1254);
  const invalid=path.join(f.directory,'invalid.png');fs.writeFileSync(invalid,'not an image');
  assert.throws(()=>decodePhoto(invalid),/Required catalogue photo validation failed/);
});
test('missing original prevents publication preparation',t=>{
  const f=fixture(t);fs.unlinkSync(path.join(f.directory,'assets/catalogue',filename));assert.throws(()=>verifyPhoto(f.directory,source,f.options),{code:'ENOENT'});
});
test('changed original and untracked source bytes are rejected before decode',t=>{
  const f=fixture(t);let decoded=false;f.options.decode=()=>{decoded=true;throw Error('unexpected decode');};
  fs.appendFileSync(path.join(f.directory,'assets/catalogue',filename),'changed');
  assert.throws(()=>verifyPhoto(f.directory,source,f.options),/tracked release source/);assert.equal(decoded,false);
  f.options.trackedBytes=file=>fs.readFileSync(path.join(f.directory,file));
  assert.throws(()=>verifyPhoto(f.directory,source,f.options),/hash mismatch/);assert.equal(decoded,false);
});
test('failed native decode or wrong dimensions prevent publication preparation',t=>{
  const f=fixture(t);assert.throws(()=>verifyPhoto(f.directory,source,{...f.options,decode:()=>{throw Error('decode failed');}}),/decode failed/);
  assert.throws(()=>verifyPhoto(f.directory,source,{...f.options,decode:()=>({width:1,height:1})}),/decode dimensions/);
});
test('photo staging preserves installer assets and includes the exact photo in hashes and provenance',t=>{
  const f=fixture(t),photo=verifyPhoto(f.directory,source,f.options),output=path.join(f.directory,'output');fs.mkdirSync(output);
  fs.writeFileSync(path.join(output,'Setup.exe'),'installer fixture');fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),'old');
  const provenance={assets:[{name:'Setup.exe'}]},assets=stagePhoto(output,provenance,photo);
  assert.deepEqual(assets.map(file=>path.basename(file)).sort(),['Setup.exe','SHA256SUMS.txt',filename,'provenance.json'].sort());
  assert.equal(fs.readFileSync(path.join(output,'Setup.exe'),'utf8'),'installer fixture');
  assert.deepEqual(fs.readFileSync(path.join(output,filename)),fs.readFileSync(photo.file));
  assert.ok(fs.readFileSync(path.join(output,'SHA256SUMS.txt'),'utf8').includes(photo.dish.sha256+'  '+filename));
  assert.equal(provenance.releasePhoto.filename,filename);assert.equal(provenance.assets[1].sha256,photo.dish.sha256);
  assert.throws(()=>stagePhoto(output,provenance,photo),/Duplicate release photo/);
});
test('publisher validates before creation and retains uploaded and downloaded digest readback',()=>{
  const publisher=fs.readFileSync(path.join(root,'scripts/release/publish.cjs'),'utf8');
  assert.ok(publisher.indexOf('verifyPhoto(root,source)')<publisher.indexOf("['release','create'"));
  assert.match(publisher,/const assets=stagePhoto\(output,provenance,photo\)/);
  assert.match(publisher,/for\(const file of assets\)/);
  assert.match(publisher,/Uploaded asset digest mismatch/);
  assert.match(publisher,/Downloaded release asset digest mismatch/);
  assert.equal(publisher.includes('Missing catalog evidence never delays publication'),false);
});
