"use strict";
const {assertIsoOutputPolicy}=require("./iso-output-policy.cjs");
const fail=()=>{throw Object.assign(Error("ISO host request invalid"),{code:"ISO_HOST_REQUEST_INVALID"});};
const SHA=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function charge(budget,bytes){budget.bytes+=bytes;if(budget.bytes>65536)fail();}
function chargeString(value,budget){
 if(value.length>65536)fail();charge(budget,2);
 for(const character of value){
  const code=character.codePointAt(0);
  const escaped=code===34||code===92||[8,9,10,12,13].includes(code);
  charge(budget,escaped?2:code<32||(code>=0xd800&&code<=0xdfff)?6:code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4);
 }
}
function immutableData(value,depth=0,budget={nodes:0,bytes:0}){
 if(depth>12||++budget.nodes>5000)fail();
 if(value===null||typeof value==="boolean"){charge(budget,value===null||value===true?4:5);return value;}
 if(typeof value==="string"){chargeString(value,budget);return value;}
 if(typeof value==="number"){if(!Number.isFinite(value))fail();charge(budget,String(value).length);return value;}
 if(!value||typeof value!=="object"||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype))fail();
 const array=Array.isArray(value);
 if(array&&value.length>5000-budget.nodes)fail();
 const ownKeys=Reflect.ownKeys(value);
 if(array&&(ownKeys.length!==value.length+1||ownKeys.some((key,index)=>index<value.length?key!==String(index):key!=="length")))fail();
 const result=array?[]:{};charge(budget,2);let members=0;
 for(const key of ownKeys){
  if(array&&key==="length")continue;
  if(typeof key!=="string"||["__proto__","constructor","prototype"].includes(key))fail();
  const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!Object.hasOwn(descriptor,"value"))fail();
  if(members++)charge(budget,1);if(!array){chargeString(key,budget);charge(budget,1);}
  result[key]=immutableData(descriptor.value,depth+1,budget);
 }
 return Object.freeze(result);
}
function snapshotIsoBuild(payload,context){
 const fixed=immutableData(payload),required=["workspaceId","target","runtime","jobs","intent","isoOutputPolicy"],allowed=[...required,"resources","snapshot"];
 if(!fixed||required.some(key=>!Object.hasOwn(fixed,key))||Object.keys(fixed).some(key=>!allowed.includes(key))||Buffer.byteLength(JSON.stringify(fixed))>65536)fail();
 if(typeof fixed.workspaceId!=="string"||!fixed.workspaceId||fixed.workspaceId.length>200||fixed.target!=="all"||!Number.isInteger(fixed.jobs)||fixed.jobs<1||fixed.jobs>32)fail();
 if(!fixed.runtime||Object.keys(fixed.runtime).sort().join()!=="distribution,kind"||fixed.runtime.kind!=="wsl"||typeof fixed.runtime.distribution!=="string"||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(fixed.runtime.distribution))fail();
 if(!fixed.intent||Object.keys(fixed.intent).sort().join()!=="configRevision,projectId,sourceRevision"||fixed.intent.projectId!==fixed.workspaceId||![fixed.intent.sourceRevision,fixed.intent.configRevision].every(value=>typeof value==="string"&&SHA.test(value)))fail();
 assertIsoOutputPolicy(fixed.isoOutputPolicy,"all");
 if(fixed.isoOutputPolicy.appliedConfigurationRevision!==fixed.intent.configRevision)fail();
 if(!context||typeof context!=="object")fail();
 const captured={};
 for(const key of["jobId","signal","log"]){
  const descriptor=Object.getOwnPropertyDescriptor(context,key);
  if(!descriptor){if(key!=="signal")fail();captured[key]=undefined;continue;}
  if(!Object.hasOwn(descriptor,"value"))fail();captured[key]=descriptor.value;
 }
 if(typeof captured.jobId!=="string"||!UUID.test(captured.jobId)||typeof captured.log!=="function"||(captured.signal!==undefined&&!(captured.signal instanceof AbortSignal)))fail();
 // Capture the original cancellation capability; never clone or freeze its internals.
 return Object.freeze({payload:fixed,context:Object.freeze(captured)});
}
module.exports={snapshotIsoBuild};
