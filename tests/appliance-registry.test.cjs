"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {pinRegistryImage}=require('../src/main/appliance/registry-image.cjs');
const descriptor=(architecture,digit='a',os='linux')=>({Descriptor:{digest:'sha256:'+digit.repeat(64),platform:{os,architecture}}});
test('registry compatibility pins single and multi-architecture inputs to one immutable Linux image',()=>{
 const single=pinRegistryImage('registry.example:5000/team/app:current',JSON.stringify(descriptor('amd64')));assert.equal(single.image,'registry.example:5000/team/app@sha256:'+'a'.repeat(64));
 const multi=pinRegistryImage('nginx:latest',JSON.stringify([descriptor('arm64','b'),descriptor('amd64','c')]));assert.equal(multi.image,'nginx@sha256:'+'c'.repeat(64));assert.equal(multi.platform,'linux/amd64');
});
test('registry compatibility refuses unsupported, ambiguous, malformed and changed descriptors',()=>{
 assert.throws(()=>pinRegistryImage('image:tag',JSON.stringify(descriptor('arm64'))),{code:'APPLIANCE_IMAGE_PLATFORM_UNSUPPORTED'});
 assert.throws(()=>pinRegistryImage('image:tag',JSON.stringify([descriptor('amd64','a'),descriptor('amd64','b')])),{code:'APPLIANCE_IMAGE_PLATFORM_AMBIGUOUS'});
 assert.throws(()=>pinRegistryImage('image:tag','invalid'),{code:'APPLIANCE_REGISTRY_INSPECTION_UNAVAILABLE'});
 assert.throws(()=>pinRegistryImage('image@sha256:'+'b'.repeat(64),JSON.stringify(descriptor('amd64'))),{code:'APPLIANCE_REGISTRY_DIGEST_MISMATCH'});
});
