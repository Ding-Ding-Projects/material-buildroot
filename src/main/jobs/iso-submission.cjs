"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {readTransactionFiles}=require("./iso-transaction-read-files.cjs");
const {assertIsoOutputPolicy}=require("./iso-output-policy.cjs");
const {captureWslBuildIntent,validateNativeIntent}=require("./wsl-build-intent.cjs");
const {isWslReceipt}=require("../execution/wsl-project.cjs");
const {validateOwnershipReceipt}=require("../execution/index.cjs");
const {isDeepStrictEqual}=require("node:util");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,SHA=/^[a-f0-9]{64}$/;
const fail=()=>{throw Object.assign(Error("ISO submission recovery unverified"),{code:"ISO_SUBMISSION_UNVERIFIED"});};
const digest=value=>crypto.createHash("sha256").update(value).digest("hex");
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function keys(value,list){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==list.split(",").sort().join())fail();}
function directory(root){const info=fs.lstatSync(root);if(!info.isDirectory()||info.isSymbolicLink()||fs.realpathSync.native(root)!==root)fail();return`${info.dev}:${info.ino}`;}
function sync(root){if(process.platform==="win32")return;const fd=fs.openSync(root,"r");try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function ensure(root){let cursor=path.parse(root).root;for(const part of root.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);try{fs.mkdirSync(cursor,{mode:0o700});}catch(error){if(error.code!=="EEXIST")throw error;}directory(cursor);}}
function assertDescriptor(value){keys(value,"version,id,captureRecordSha256");if(value.version!==1||typeof value.id!=="string"||!UUID.test(value.id)||typeof value.captureRecordSha256!=="string"||!SHA.test(value.captureRecordSha256))fail();return value;}
function capturedIntent(value){validateNativeIntent(value);if(typeof value.sourceRevision!=="string"||!SHA.test(value.sourceRevision)||typeof value.configRevision!=="string"||!SHA.test(value.configRevision))fail();}
function readSubmission(root,id){
 const {records,active}=readTransactionFiles(root,id);if(active!==null||records.length!==5)fail();let previous=null;
 for(let index=0;index<records.length;index++){const row=records[index].value;keys(row,"version,jobId,sequence,previousSha256,kind,value");if(row.version!==1||row.jobId!==id||row.sequence!==index||row.previousSha256!==previous||row.kind!==["begin","owner","cleanup","capture","job"][index])fail();previous=records[index].sha256;}
 const [begin,owner,cleanup,capture,job]=records.map(row=>row.value.value);
 keys(begin,"id,workspaceId,grantId,runtime,projectBindingSha256,policy");keys(begin.runtime,"kind,distribution");assertIsoOutputPolicy(begin.policy,"all");
 if(begin.id!==id||!UUID.test(begin.workspaceId)||typeof begin.grantId!=="string"||!begin.grantId||begin.grantId.length>200||begin.runtime.kind!=="wsl"||typeof begin.runtime.distribution!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(begin.runtime.distribution)||typeof begin.projectBindingSha256!=="string"||!SHA.test(begin.projectBindingSha256))fail();
 validateOwnershipReceipt(owner);if(owner.kind!=="wsl"||owner.distribution!==begin.runtime.distribution||owner.pid===null)fail();
 keys(cleanup,"receipt,verdict");keys(cleanup.verdict,"state,reason");if(!equal(cleanup.receipt,owner)||cleanup.verdict.state!=="verified-stopped"||cleanup.verdict.reason!=="owned-session-absent")fail();
 capturedIntent(capture);if(capture.configRevision!==begin.policy.appliedConfigurationRevision)fail();keys(job,"jobId,captureRecordSha256");if(typeof job.jobId!=="string"||!UUID.test(job.jobId)||job.captureRecordSha256!==records[3].sha256)fail();
 return{begin,capture,job,descriptor:{version:1,id,captureRecordSha256:records[3].sha256}};
}
async function captureIsoSubmission({directory:root,execution,item,workspaceId,runtime,policy,resolveProject,signal,onReserved}){
 if(typeof root!=="string"||!path.isAbsolute(root)||path.resolve(root)!==root)fail();assertIsoOutputPolicy(policy,"all");
 const grant=execution.grants?.get(item.grantId),receipt=grant?.wslReceipt;
 if(!isWslReceipt(receipt)||item.storage?.kind!=="wsl"||runtime.kind!=="wsl"||runtime.distribution!==receipt.storage.distribution||item.externalTrees.length||typeof onReserved!=="function")fail();
 const boundGrant=item.grantId,paths=[grant.root,grant.source,grant.output],proof=receipt.proof;
 function current(){if(signal?.aborted||resolveProject(workspaceId)!==item||item.grantId!==boundGrant||execution.grants.get(boundGrant)!==grant||grant.wslReceipt!==receipt||receipt.proof!==proof||item.source!==grant.source||item.output!==grant.output||item.runtime.kind!==runtime.kind||item.runtime.distribution!==runtime.distribution||paths.some((value,i)=>value!==[grant.root,grant.source,grant.output][i]))fail();}
 current();ensure(root);const rootIdentity=directory(root),id=crypto.randomUUID(),jobRoot=path.join(root,id);fs.mkdirSync(jobRoot,{mode:0o700});onReserved();sync(root);const jobIdentity=directory(jobRoot);let sequence=0,previous=null,owner=null,cleaned=false;
 function append(kind,value){
  if(directory(root)!==rootIdentity||directory(jobRoot)!==jobIdentity||sequence>=5)fail();const raw=Buffer.from(JSON.stringify({version:1,jobId:id,sequence,previousSha256:previous,kind,value}));if(raw.length>65536)fail();const fd=fs.openSync(path.join(jobRoot,String(sequence).padStart(6,"0")+".json"),"wx",0o600);
  try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}sync(jobRoot);sequence++;previous=digest(raw);return previous;
 }
 append("begin",{id,workspaceId,grantId:boundGrant,runtime:{...runtime},projectBindingSha256:digest(JSON.stringify([...paths,proof])),policy});
 const captured=await captureWslBuildIntent({execution,grantId:boundGrant,runtime,source:item.source,output:item.output,externalTrees:[],signal,
  onOwnership:async value=>{current();validateOwnershipReceipt(value);if(owner||value.kind!=="wsl"||value.distribution!==runtime.distribution||value.pid===null)fail();append("owner",value);owner=JSON.parse(JSON.stringify(value));current();},
  onCleanup:async(value,verdict)=>{if(!owner||cleaned||!equal(value,owner))fail();append("cleanup",{receipt:value,verdict});cleaned=true;if(verdict.state!=="verified-stopped"||verdict.reason!=="owned-session-absent")fail();current();}
 });
 current();capturedIntent(captured);if(!owner||!cleaned||captured.configRevision!==policy.appliedConfigurationRevision)fail();
 const captureRecordSha256=append("capture",captured),descriptor=Object.freeze({version:1,id,captureRecordSha256});
 return{captured,descriptor,commitJob(job){current();if(sequence!==4||job.payload.workspaceId!==workspaceId||!equal(job.payload.isoSubmission,descriptor)||job.payload.intent.sourceRevision!==captured.sourceRevision||job.payload.intent.configRevision!==captured.configRevision||!equal(job.payload.runtime,runtime)||!equal(job.payload.isoOutputPolicy,policy))fail();append("job",{jobId:job.id,captureRecordSha256});}};
}
function inspectIsoSubmissions({directory:root,jobs,owner}){
 try{
  if(!fs.existsSync(root)){if(jobs.list(owner).some(job=>Object.hasOwn(job.payload||{},"isoSubmission")))fail();return{state:"verified",grantsRestored:false};}directory(root);const iterator=fs.opendirSync(root),ids=[];
  try{for(let count=0;count<1001;count++){const entry=iterator.readSync();if(!entry)break;if(count===1000||!entry.isDirectory()||entry.isSymbolicLink()||!UUID.test(entry.name))fail();ids.push(entry.name);}}finally{iterator.closeSync();}
  const all=jobs.list(owner);if(all.length>1000)fail();const linked=new Map();
  for(const id of ids){const saved=readSubmission(root,id),matches=all.filter(job=>job.id===saved.job.jobId);if(matches.length!==1)fail();const job=matches[0];assertDescriptor(job.payload.isoSubmission);
   if(job.kind!=="build"||job.payload.workspaceId!==saved.begin.workspaceId||!equal(job.payload.isoSubmission,saved.descriptor)||job.payload.intent.sourceRevision!==saved.capture.sourceRevision||job.payload.intent.configRevision!==saved.capture.configRevision||!isDeepStrictEqual(job.payload.snapshot,saved.capture.snapshot)||!equal(job.payload.runtime,saved.begin.runtime)||!equal(job.payload.isoOutputPolicy,saved.begin.policy))fail();
   if(linked.has(id))fail();linked.set(id,{jobId:saved.job.jobId,descriptor:saved.descriptor});
  }
  const used=new Set();
  for(const job of all)if(Object.hasOwn(job.payload||{},"isoSubmission")){
   const descriptor=assertDescriptor(job.payload.isoSubmission),saved=linked.get(descriptor.id);
   if(!saved||used.has(descriptor.id)||saved.jobId!==job.id||!equal(descriptor,saved.descriptor))fail();used.add(descriptor.id);
  }
  if(used.size!==linked.size)fail();
  return{state:"verified",grantsRestored:false};
 }catch{return{state:"unknown",grantsRestored:false};}
}
module.exports={captureIsoSubmission,inspectIsoSubmissions,assertDescriptor};
