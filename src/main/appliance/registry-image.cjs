"use strict";
const {fail}=require('./contract.cjs');
/** Select one compatible immutable descriptor without pulling or executing it. */
function pinRegistryImage(reference, text) {
  let parsed;
  try { parsed=JSON.parse(text); } catch { fail('APPLIANCE_REGISTRY_INSPECTION_UNAVAILABLE'); }
  const descriptors=(Array.isArray(parsed)?parsed:[parsed]).map(value=>value?.Descriptor).filter(Boolean);
  const compatible=descriptors.filter(value=>value.platform?.os==='linux'&&value.platform?.architecture==='amd64');
  if(compatible.length===0)fail('APPLIANCE_IMAGE_PLATFORM_UNSUPPORTED');
  if(compatible.length!==1)fail('APPLIANCE_IMAGE_PLATFORM_AMBIGUOUS');
  const digest=compatible[0].digest;
  if(typeof digest!=='string'||!/^sha256:[a-f0-9]{64}$/.test(digest))fail('APPLIANCE_REGISTRY_INSPECTION_UNAVAILABLE');
  const at=reference.indexOf('@');
  if(at!==-1&&reference.slice(at+1)!==digest)fail('APPLIANCE_REGISTRY_DIGEST_MISMATCH');
  let repository=reference.split('@')[0];
  const colon=repository.lastIndexOf(':');
  if(colon>repository.lastIndexOf('/'))repository=repository.slice(0,colon);
  return {image:repository+'@'+digest,digest,platform:'linux/amd64'};
}
module.exports={pinRegistryImage};
