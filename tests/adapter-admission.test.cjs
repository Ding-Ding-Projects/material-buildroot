'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {loadAdapterAdmission,assertInstallerAdmission}=require('../scripts/build/adapter-admission.cjs');
const {INSTALLER_TRANSFER_LIMIT}=require('../scripts/build/squirrel-finalize.cjs');
const root=path.resolve(__dirname,'..');

test('actual installer admission uses the established transfer ceiling and real output size',()=>{
  const admission=loadAdapterAdmission(root);
  assert.equal(admission.installer.maximumBytes,INSTALLER_TRANSFER_LIMIT);
  for(const size of [1423570997,INSTALLER_TRANSFER_LIMIT]){
    const result=assertInstallerAdmission(admission,[{path:'squirrel-windows/MaterialBuildroot-0.1.1-full.nupkg',size}]);
    assert.equal(result.measuredBytes,size);assert.equal(result.payloadEmbedding,'unverified');
  }
  for(const files of [[],[{path:'only-delta.nupkg',size:1}],[{path:'app-full.nupkg',size:0}],[{path:'app-full.nupkg',size:INSTALLER_TRANSFER_LIMIT+1}],[{path:'app-full.nupkg',size:NaN}]])assert.throws(()=>assertInstallerAdmission(admission,files));
});

test('a conflicting adapter-policy ceiling stops admission before package acquisition',()=>{
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'adapter-budget-'));
  try {
    for(const file of ['package.json','package-lock.json','website/package.json','website/package-lock.json','build-manifest.json','scripts/build/adapter-admission.json','scripts/build/offline-payloads.json','src/renderer/assets/material-icons/provenance.json']){
      const dest=path.join(fixture,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);
    }
    const policyPath=path.join(fixture,'scripts/build/adapter-admission.json'),policy=JSON.parse(fs.readFileSync(policyPath));
    policy.maximumInstallerBytes=1400000000;fs.writeFileSync(policyPath,JSON.stringify(policy));
    assert.throws(()=>loadAdapterAdmission(fixture),/Installer admission policy differs from the transfer ceiling/);
  }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
