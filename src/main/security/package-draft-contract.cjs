"use strict";
const fail=()=>{throw Object.assign(new Error("Invalid package draft."),{code:"INVALID_PACKAGE_DRAFT"});};
function object(value,keys,required=keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail();
  const names=Reflect.ownKeys(value);
  if(names.some(key=>typeof key!=="string"||!keys.includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),"value"))||required.some(key=>!Object.hasOwn(value,key)))fail();
}
function text(value,max=4096){if(typeof value!=="string"||value.length>max||/[\x00-\x08\x0b-\x1f\x7f]/.test(value))fail();}
function list(value,validate,max=256){if(!Array.isArray(value)||value.length>max)fail();value.forEach(validate);}
function model(value){
  const required=["name","version","source","sourceFilename","homepage","license","licenseFiles","buildSystem","dependencies","configDependencies","help","hashes"];
  object(value,[...required,"patches","buildOptions","hooks","overlays","pythonSetupType"],required);
  for(const key of ["name","version","source","sourceFilename","homepage","license"])text(value[key]);
  text(value.help,16384);
  for(const key of ["source","homepage"]){if(/^[^:]+:\/\/[^/]*@/.test(value[key]))fail();}
  if(!["generic","autotools","cmake","meson","cargo","go","python"].includes(value.buildSystem))fail();
  for(const key of ["licenseFiles","dependencies","configDependencies"])list(value[key],item=>text(item));
  list(value.hashes,hash=>{object(hash,["algorithm","digest","file"]);if(!["sha256","sha512"].includes(hash.algorithm))fail();text(hash.digest,128);text(hash.file);});
  for(const key of ["patches","buildOptions"])if(Object.hasOwn(value,key))list(value[key],item=>text(item),64);
  if(Object.hasOwn(value,"pythonSetupType")&&!["setuptools","pep517","flit","hatch","poetry","setuptools-rust","maturin"].includes(value.pythonSetupType))fail();
  if(Object.hasOwn(value,"hooks"))list(value.hooks,hook=>{object(hook,["stage","operation","source","destination","mode"]);for(const item of Object.values(hook))text(item);},64);
  if(Object.hasOwn(value,"overlays"))list(value.overlays,overlay=>{object(overlay,["source","destination","mode"]);for(const item of Object.values(overlay))text(item);},64);
  if(Buffer.byteLength(JSON.stringify(value),"utf8")>32768)fail();
  return value;
}
function packageDraft(value){
  object(value,["model","undo","redo"]);model(value.model);list(value.undo,model,10);list(value.redo,model,10);
  if(Buffer.byteLength(JSON.stringify(value),"utf8")>768*1024)fail();
  return value;
}
module.exports={packageDraft};
