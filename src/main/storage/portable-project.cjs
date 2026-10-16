"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("../security/workspace-contract.cjs");
const { validateProjectOptions } = require("./project-options-store.cjs");
const MAX_BYTES = 256 * 1024;
const fail = () => { throw Object.assign(Error("Invalid portable project descriptor."), { code: "INVALID_PROJECT_DESCRIPTOR" }); };
function exact(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value,key))) fail();
}
function text(value, max) { if(typeof value!=="string" || !value.length || value.length>max || /[\x00-\x1f\x7f]/.test(value))fail(); }
function validate(value) {
  exact(value,["format","version","name","options","source"]);
  if(value.format!=="material-buildroot-project" || value.version!==1)fail();
  text(value.name,80);
  exact(value.options,["runtime","externalTrees"]);
  validateProjectOptions(value.options);
  exact(value.source,["revision","branch","dirty","observedAt","state"]);
  const source=value.source;
  if(!["observed","unavailable"].includes(source.state))fail();
  if(source.revision!==null && (typeof source.revision!=="string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(source.revision)))fail();
  if(source.branch!==null)text(source.branch,256);
  if(source.dirty!==null && typeof source.dirty!=="boolean")fail();
  if(typeof source.observedAt!=="string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(source.observedAt) || !Number.isFinite(Date.parse(source.observedAt)))fail();
  if(source.state==="observed" && (source.revision===null || source.dirty===null))fail();
  if(source.state==="unavailable" && (source.revision!==null || source.branch!==null || source.dirty!==null))fail();
  if(Buffer.byteLength(JSON.stringify(value))>MAX_BYTES)fail();
  return value;
}
function read(file) {
  const info=fs.lstatSync(file);
  if(!info.isFile() || info.isSymbolicLink() || info.size>MAX_BYTES)fail();
  const fd=fs.openSync(file,"r");
  let bytes;
  try {
    const opened=fs.fstatSync(fd);
    if(!opened.isFile() || opened.dev!==info.dev || opened.ino!==info.ino || opened.size>MAX_BYTES)fail();
    const buffer=Buffer.alloc(MAX_BYTES+1);
    let length=0;
    while(length<buffer.length) {
      const count=fs.readSync(fd,buffer,length,buffer.length-length,null);
      if(count===0)break;
      length+=count;
    }
    if(length>MAX_BYTES)fail();
    bytes=buffer.subarray(0,length);
  } finally {fs.closeSync(fd);}
  const serialized=bytes.toString("utf8");
  if(!Buffer.from(serialized).equals(bytes))fail();
  return validate(parse(serialized));
}
function retain(directory,id,descriptor) {
  if(!/^[a-f0-9-]{36}$/.test(id))fail();
  validate(descriptor);
  const root=path.join(directory,"imported-projects");
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  const info=fs.lstatSync(root);
  if(!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync(root)!==root)fail();
  fs.writeFileSync(path.join(root,`${id}.json`),JSON.stringify(descriptor),{flag:"wx",mode:0o600});
}
function retained(directory,id) {
  if(!/^[a-f0-9-]{36}$/.test(id))fail();
  const file=path.join(directory,"imported-projects",`${id}.json`);
  return fs.existsSync(file)?read(file):null;
}
module.exports={read,validate,retain,retained};
