"use strict";
const fail = code => { throw Object.assign(Error(code), {code}); };
function exact(value, keys, required = keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(k => !keys.includes(k)) || required.some(k => !Object.hasOwn(value,k))) fail('INVALID_REQUEST');
}
function validateSpec(value) {
  exact(value,['version','name','distribution','source','mode','kioskUrl','persistence','tunnel','wordingFileId'],['version','name','distribution','source','mode','kioskUrl','persistence','tunnel']);
  if (value.version !== 1 || !/^[a-z][a-z0-9-]{0,47}$/.test(value.name) || typeof value.distribution !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/.test(value.distribution) || !['console','kiosk'].includes(value.mode) || typeof value.persistence !== 'boolean') fail('INVALID_REQUEST');
  const source=value.source;
  if(source?.kind==='registry') exact(source,['kind','image']);
  else if(source?.kind==='archive') exact(source,['kind','fileId','image']);
  else if(source?.kind==='compose') exact(source,['kind','directoryId']);
  else if(source?.kind==='prepared') exact(source,['kind','bundleId']);
  else fail('INVALID_REQUEST');
  if(!['compose','prepared'].includes(source.kind) && (typeof source.image !== 'string' || source.image.length>255 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@-]*$/.test(source.image))) fail('INVALID_IMAGE_REFERENCE');
  for(const id of [source.fileId,source.directoryId,source.bundleId,value.wordingFileId].filter(v=>v!==undefined)) if(typeof id!=='string'|| !/^[a-f0-9-]{36}$/.test(id)) fail('INVALID_REQUEST');
  if(typeof value.kioskUrl!=='string'||value.kioskUrl.length>2048) fail('INVALID_REQUEST');
  if(value.mode==='kiosk') {let url;try{url=new URL(value.kioskUrl);}catch{fail('INVALID_KIOSK_URL');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail('INVALID_KIOSK_URL');}
  else if(value.kioskUrl!=='') fail('INVALID_KIOSK_URL');
  exact(value.tunnel,['mode','hostname'],['mode']);
  if(!['off','quick','named'].includes(value.tunnel.mode))fail('INVALID_REQUEST');
  if(value.tunnel.hostname!==undefined && (value.tunnel.mode!=='named'||typeof value.tunnel.hostname!=='string'|| !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value.tunnel.hostname))) fail('INVALID_TUNNEL_HOSTNAME');
  return structuredClone(value);
}
module.exports={validateSpec,exact,fail};
