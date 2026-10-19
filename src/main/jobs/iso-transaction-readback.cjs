"use strict";
const {readTransactionFiles}=require("./iso-transaction-read-files.cjs");
const {assertIsoOutputPolicy}=require("./iso-output-policy.cjs");
const {validateOwnershipReceipt}=require("../execution/index.cjs");
const {createIsoProducerOwner}=require("../execution/iso-producer-owner.cjs");
const SHA=/^[a-f0-9]{64}$/,decimal=value=>typeof value==="string"&&/^(0|[1-9][0-9]{0,19})$/.test(value);
const fail=()=>{throw Error("ISO_TRANSACTION_READ_UNVERIFIED");};
function keys(value,list){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==list.split(",").sort().join())fail();}
function equal(a,b){if(JSON.stringify(normalize(a))!==JSON.stringify(normalize(b)))fail();}
function normalize(value){return Array.isArray(value)?value.map(normalize):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])])):value;}
function file(value,structured){
 keys(value,"sha256,bytes,identity"+(structured?",structure":""));
 if(typeof value.sha256!=="string"||!SHA.test(value.sha256)||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>4*1024**3||!Array.isArray(value.identity)||value.identity.length!==9||!value.identity.every(decimal))fail();
 if(structured){keys(value.structure,"descriptorValid,withinImage,biosCatalogValid,bootVerified");equal(value.structure,{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false});}
}
function validateExpected(expected){
 keys(expected,"jobId,grantId,runtime,policy,binding,receiptRecordSha256");keys(expected.runtime,"kind,distribution");keys(expected.binding,"sourceSha256,configurationSha256,projectProofSha256");
 if(typeof expected.grantId!=="string"||!expected.grantId||expected.grantId.length>200||expected.runtime.kind!=="wsl"||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(expected.runtime.distribution)||!Object.values(expected.binding).every(hash=>typeof hash==="string"&&SHA.test(hash))||(expected.receiptRecordSha256!==null&&!SHA.test(expected.receiptRecordSha256||"")))fail();
 assertIsoOutputPolicy(expected.policy,"all");if(expected.binding.configurationSha256!==expected.policy.appliedConfigurationRevision)fail();
}
function inspect(records,active,expected){
 let previous=null,stage=null,index=-1,owners=[],cleanups=[],result=false,preparation=null,receipt=null,incomplete=false,producerOwner=null;
 const stages=["prepare","produce","capture"];
 function finished(){
  if(!result||!owners.length)fail();
  let required=owners;
  if(stage==="produce")required=[producerOwner.precise()];
  if(cleanups.length!==required.length)fail();required.forEach((owner,i)=>{equal(cleanups[i].receipt,owner);if(cleanups[i].verdict.state!=="verified-stopped")fail();});
 }
 for(let sequence=0;sequence<records.length;sequence++){
  const {value:row,sha256}=records[sequence];keys(row,"version,jobId,sequence,previousSha256,kind,value");
  if(row.version!==1||row.jobId!==expected.jobId||row.sequence!==sequence||row.previousSha256!==previous||incomplete)fail();previous=sha256;
  const value=row.value;
  if(sequence===0){if(row.kind!=="begin")fail();keys(value,"grantId,jobId,runtime,policy,binding");equal(value,{grantId:expected.grantId,jobId:expected.jobId,runtime:expected.runtime,policy:expected.policy,binding:expected.binding});continue;}
  if(row.kind==="incomplete"){
   keys(value,"stage,code");if(value.stage!==(stage||"admission")||!/^ISO_TRANSACTION_[A-Z_]+$/.test(value.code))fail();incomplete=true;continue;
  }
  if(receipt)fail();
  switch(row.kind){
   case"stage":
    keys(value,"stage");if(stage){finished();if(stage==="prepare"&&!preparation)fail();}
    if(value.stage!==stages[++index])fail();stage=value.stage;owners=[];cleanups=[];result=false;producerOwner=stage==="produce"?createIsoProducerOwner(validateOwnershipReceipt,expected.runtime.distribution):null;break;
   case"ownership":
    keys(value,"stage,receipt");if(!stage||value.stage!==stage||result)fail();validateOwnershipReceipt(value.receipt);
    if(value.receipt.kind!=="wsl"||value.receipt.distribution!==expected.runtime.distribution||(stage!=="produce"&&value.receipt.pid===null))fail();producerOwner?.observe(value.receipt);owners.push(value.receipt);break;
   case"result":keys(value,"stage,state,code");if(!stage||value.stage!==stage||result||!owners.length||value.state!=="succeeded"||value.code!==0)fail();producerOwner?.precise();result=true;break;
   case"cleanup":
    keys(value,"stage,receipt,verdict");keys(value.verdict,"state,reason");if(!result||value.stage!==stage||!["verified-stopped","unknown"].includes(value.verdict.state)||typeof value.verdict.reason!=="string"||value.verdict.reason.length>200)fail();validateOwnershipReceipt(value.receipt);equal(value.receipt,(producerOwner?[producerOwner.precise()]:owners)[cleanups.length]);cleanups.push(value);break;
   case"preparation":
    if(stage!=="prepare"||preparation)fail();finished();keys(value,"state,jobId,preparationSha256,prior,jobBound,bootVerified");
    if(value.state!=="prepared-unbound"||value.jobId!==expected.jobId||!SHA.test(value.preparationSha256||"")||value.jobBound!==false||value.bootVerified!==false)fail();if(value.prior!==null)file(value.prior,false);preparation=value;break;
   case"receipt":
    if(stage!=="capture"||!preparation)fail();finished();keys(value,"version,jobId,runtime,policy,binding,preparationSha256,output,jobBound,producerVerified,cleanupVerified,bootVerified");
    equal({version:value.version,jobId:value.jobId,runtime:value.runtime,policy:value.policy,binding:value.binding,preparationSha256:value.preparationSha256,jobBound:value.jobBound,producerVerified:value.producerVerified,cleanupVerified:value.cleanupVerified,bootVerified:value.bootVerified},{version:1,jobId:expected.jobId,runtime:expected.runtime,policy:expected.policy,binding:expected.binding,preparationSha256:preparation.preparationSha256,jobBound:true,producerVerified:true,cleanupVerified:true,bootVerified:false});
    file(value.output,true);if(preparation.prior&&JSON.stringify(preparation.prior.identity)===JSON.stringify(value.output.identity))fail();receipt=value;break;
   default:fail();
  }
 }
 if(active!==null){keys(active,"version,jobId");if(active.version!==1||typeof active.jobId!=="string"||!/^[a-f0-9-]{36}$/.test(active.jobId))fail();}
 if(incomplete||!receipt){if(active?.jobId!==expected.jobId)fail();return{state:"incomplete",jobId:expected.jobId,receipt:null,reason:"retained-transaction-prefix"};}
 if(active?.jobId===expected.jobId)return{state:"incomplete",jobId:expected.jobId,receipt:null,reason:"reservation-still-present"};
 if(!expected.receiptRecordSha256||previous!==expected.receiptRecordSha256)fail();
 return{state:"complete",jobId:expected.jobId,receipt,receiptRecordSha256:previous,reason:"anchored-records-consistent"};
}
/** Historical record verification only. Grants no runtime, retry, cleanup or lock-release authority. */
function readIsoTransaction({directory,expected}){
 try{validateExpected(expected);const data=readTransactionFiles(directory,expected.jobId);return inspect(data.records,data.active,expected);}
 catch{return{state:"unknown",jobId:typeof expected?.jobId==="string"?expected.jobId:null,receipt:null,reason:"ISO_TRANSACTION_READ_UNVERIFIED"};}
}
module.exports={readIsoTransaction};
