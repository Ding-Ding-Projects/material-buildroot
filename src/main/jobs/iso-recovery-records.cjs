"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {readTransactionFiles}=require("./iso-transaction-read-files.cjs");
const {readIsoTransaction}=require("./iso-transaction-readback.cjs");
const {assertIsoOutputPolicy}=require("./iso-output-policy.cjs");
const {validateOwnershipReceipt}=require("../execution/index.cjs");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,SHA=/^[a-f0-9]{64}$/;
const fail=()=>{throw Object.assign(Error("ISO recovery evidence unverified"),{code:"ISO_RECOVERY_UNVERIFIED"});};
const digest=raw=>crypto.createHash("sha256").update(raw).digest("hex");
function keys(value,list){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==list.split(",").sort().join())fail();}
function normalized(value){return Array.isArray(value)?value.map(normalized):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalized(value[key])])):value;}
function equal(a,b){if(JSON.stringify(normalized(a))!==JSON.stringify(normalized(b)))fail();}
function binding(value){
 keys(value,"jobId,workspaceId,grantId,runtime,journalKey,sourceSha256,configurationSha256,projectProofSha256,policy");keys(value.runtime,"kind,distribution");
 if(typeof value.jobId!=="string"||!UUID.test(value.jobId)||value.journalKey!==value.jobId||![value.workspaceId,value.grantId].every(item=>typeof item==="string"&&item.length>0&&item.length<=200)||value.runtime.kind!=="wsl"||typeof value.runtime.distribution!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value.runtime.distribution)||![value.sourceSha256,value.configurationSha256,value.projectProofSha256].every(item=>typeof item==="string"&&SHA.test(item)))fail();
 assertIsoOutputPolicy(value.policy,"all");if(value.policy.appliedConfigurationRevision!==value.configurationSha256)fail();
 return JSON.parse(JSON.stringify(value));
}
function directoryIdentity(root){const stat=fs.lstatSync(root);if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync.native(root)!==root)fail();return`${stat.dev}:${stat.ino}`;}
function syncDirectory(root){if(process.platform==="win32")return;const fd=fs.openSync(root,"r");try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
/** Separate append-only recovery inventory. Never edits the legacy quarantine schema or releases locks. */
function createIsoRecoveryRecords({directory,journalDirectory}){
 if([directory,journalDirectory].some(root=>typeof root!=="string"||!path.isAbsolute(root)||path.resolve(root)!==root)||directory===journalDirectory)fail();
 let cursor=path.parse(directory).root;for(const part of directory.slice(cursor.length).split(path.sep).filter(Boolean)){
  cursor=path.join(cursor,part);try{fs.mkdirSync(cursor,{mode:0o700});}catch(error){if(error.code!=="EEXIST")throw error;}directoryIdentity(cursor);
 }
 const rootIdentity=directoryIdentity(directory);
 function check(){if(directoryIdentity(directory)!==rootIdentity)fail();}
 function expectedReadback(bound,anchor){return{jobId:bound.jobId,grantId:bound.grantId,runtime:bound.runtime,policy:bound.policy,binding:{sourceSha256:bound.sourceSha256,configurationSha256:bound.configurationSha256,projectProofSha256:bound.projectProofSha256},receiptRecordSha256:anchor};}
 function complete(bound,anchor){if(readIsoTransaction({directory:journalDirectory,expected:expectedReadback(bound,anchor)}).state!=="complete")fail();}
 function inspect(bound){
  check();const data=readTransactionFiles(directory,bound.jobId);if(data.active!==null)fail();
  const state={owners:[],cleanups:[],reference:{state:"pending",receiptRecordSha256:null}},rows=data.records;let previous=null;
  for(let index=0;index<rows.length;index++){
   const row=rows[index].value;keys(row,"version,jobId,sequence,previousSha256,kind,value");
   if(row.version!==1||row.jobId!==bound.jobId||row.sequence!==index||row.previousSha256!==previous)fail();previous=rows[index].sha256;
   if(index===0){if(row.kind!=="begin")fail();binding(row.value);equal(row.value,bound);continue;}
   apply(state,bound,row.kind,row.value);
  }
  check();return{state,rows,previous};
 }
 function apply(state,bound,kind,value){
  if(kind==="current-owner"){
   if(state.reference.state!=="pending"||state.owners.length>=24)fail();validateOwnershipReceipt(value);
   if(value.kind!=="wsl"||value.distribution!==bound.runtime.distribution||value.pid===null||state.owners.some(owner=>owner.ownerToken===value.ownerToken))fail();state.owners.push(value);return;
  }
  if(kind==="current-cleanup"){
   keys(value,"receipt,verdict");keys(value.verdict,"state,reason");validateOwnershipReceipt(value.receipt);
   const owner=state.owners.find(item=>item.ownerToken===value.receipt.ownerToken);
   if(!owner||state.cleanups.some(item=>item.receipt.ownerToken===owner.ownerToken)||!["unknown","verified-stopped"].includes(value.verdict.state)||typeof value.verdict.reason!=="string"||value.verdict.reason.length>200||(value.verdict.state==="verified-stopped"&&value.verdict.reason!=="owned-session-absent"))fail();equal(owner,value.receipt);state.cleanups.push(value);return;
  }
  if(kind==="reference"){
   keys(value,"state,receiptRecordSha256");if(typeof value.receiptRecordSha256!=="string"||!SHA.test(value.receiptRecordSha256))fail();
   if(value.state==="receipt-recorded"){if(state.reference.state!=="pending")fail();}
   else if(value.state==="verified"){
    if(state.reference.state!=="receipt-recorded"||value.receiptRecordSha256!==state.reference.receiptRecordSha256||!state.owners.length||state.owners.length!==state.cleanups.length||state.cleanups.some(item=>item.verdict.state!=="verified-stopped"))fail();
    complete(bound,value.receiptRecordSha256);
   }else fail();state.reference=value;return;
  }
  fail();
 }
 function append(bound,kind,value){
  const before=inspect(bound);apply(before.state,bound,kind,value);if(before.rows.length>=64)fail();
  // Re-read before exclusive append. Another writer wins without replacement.
  const current=inspect(bound);if(current.previous!==before.previous||current.rows.length!==before.rows.length)fail();
  return write(bound,before.rows.length,before.previous,kind,value);
 }
 function write(bound,sequence,previous,kind,value){
  check();const raw=Buffer.from(JSON.stringify({version:1,jobId:bound.jobId,sequence,previousSha256:previous,kind,value}));if(raw.length>65536)fail();
  const root=path.join(directory,bound.jobId);directoryIdentity(root);const fd=fs.openSync(path.join(root,String(sequence).padStart(6,"0")+".json"),"wx",0o600);
  try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}syncDirectory(root);return digest(raw);
 }
 return Object.freeze({
  begin(value){const bound=binding(value);check();const root=path.join(directory,bound.jobId);fs.mkdirSync(root,{mode:0o700});syncDirectory(directory);return write(bound,0,null,"begin",bound);},
  checkpointOwner(value,owner){const bound=binding(value);return append(bound,"current-owner",owner);},
  checkpointCleanup(value,owner,verdict){const bound=binding(value);return append(bound,"current-cleanup",{receipt:owner,verdict});},
  recordReference(value,reference){const bound=binding(value);return append(bound,"reference",reference);},
  read(value){
   let jobId=null;try{const bound=binding(value);jobId=bound.jobId;const {state}=inspect(bound);
    return{state:state.reference.state==="verified"?"complete":"incomplete",jobId,reference:state.reference,owners:state.owners,cleanups:state.cleanups,grantsAuthority:false};
   }catch{return{state:"unknown",jobId,reference:null,owners:[],cleanups:[],grantsAuthority:false};}
  }
 });
}
module.exports={createIsoRecoveryRecords};
