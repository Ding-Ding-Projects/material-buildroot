"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {TextDecoder}=require("node:util");
const {parse}=require("../security/workspace-contract.cjs");
const fail=()=>{throw Error("ISO_TRANSACTION_READ_UNVERIFIED");};
const same=(a,b)=>["dev","ino","size","mtimeMs","ctimeMs","nlink"].every(key=>a[key]===b[key]);
function directory(root){const stat=fs.lstatSync(root);if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync.native(root)!==root)fail();return stat;}
function readFile(file){
 const before=fs.lstatSync(file);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size<1||before.size>65536)fail();
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  if(!same(before,fs.fstatSync(fd)))fail();const raw=Buffer.alloc(before.size);let at=0;
  while(at<raw.length){const count=fs.readSync(fd,raw,at,raw.length-at,at);if(!count)fail();at+=count;}
  if(!same(before,fs.fstatSync(fd))||!same(before,fs.lstatSync(file)))fail();
  return{value:parse(new TextDecoder("utf-8",{fatal:true}).decode(raw)),sha256:crypto.createHash("sha256").update(raw).digest("hex")};
 }finally{fs.closeSync(fd);}
}
/** No writes, mkdir, reservation removal or runtime calls occur here. */
function readTransactionFiles(root,jobId){
 if(typeof root!=="string"||!path.isAbsolute(root)||path.resolve(root)!==root||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(jobId))fail();
 const parent=directory(root),job=path.join(root,jobId),before=directory(job),names=fs.readdirSync(job).sort();
 if(!names.length||names.length>64||names.some((name,index)=>name!==String(index).padStart(6,"0")+".json"))fail();
 const activeFile=path.join(root,"active.json");let active=null;
 try{active=readFile(activeFile);}catch(error){if(error.code!=="ENOENT")throw error;}
 const records=names.map(name=>readFile(path.join(job,name)));
 const currentNames=fs.readdirSync(job).sort();
 if(JSON.stringify(names)!==JSON.stringify(currentNames)||!same(before,directory(job))||!same(parent,directory(root)))fail();
 for(let index=0;index<names.length;index++)if(readFile(path.join(job,names[index])).sha256!==records[index].sha256)fail();
 let activeAfter=null;try{activeAfter=readFile(activeFile);}catch(error){if(error.code!=="ENOENT")throw error;}
 if(active?.sha256!==activeAfter?.sha256)fail();
 return{records,active:active?.value??null};
}
module.exports={readTransactionFiles};
