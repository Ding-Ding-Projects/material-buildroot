"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs");
const HASH="a".repeat(64),JOB="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function payload(){return{workspaceId:"workspace",target:"all",runtime:{kind:"wsl",distribution:"Fixture"},jobs:2,intent:{projectId:"workspace",sourceRevision:HASH,configRevision:HASH},isoOutputPolicy:createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"})};}
function intercepted(){
 let calls=0;const module={exports:{}},file=require.resolve("../src/main/jobs/iso-host-build-snapshot.cjs");
 const fn=vm.runInThisContext("(function(require,module,Buffer,AbortSignal,JSON){"+fs.readFileSync(file,"utf8")+"\n})",{filename:file});
 fn(name=>require("../src/main/jobs/iso-output-policy.cjs"),module,Buffer,AbortSignal,{stringify(){calls++;throw Error("safe serialization sentinel");}});
 return{snapshot:module.exports.snapshotIsoBuild,calls:()=>calls};
}
for(const kind of["sparse","aggregate strings","escaped string"])test(`snapshot rejects ${kind} before serialization`,()=>{
 const f=intercepted(),value=payload();
 if(kind==="sparse"){const sparse=[];sparse[1000000000]="one";value.snapshot={nested:sparse};}
 if(kind==="aggregate strings")value.resources={first:"a".repeat(40000),second:"b".repeat(40000)};
 if(kind==="escaped string")value.snapshot={nested:"\0".repeat(20000)};
 assert.throws(()=>f.snapshot(value,{jobId:JOB,log:()=>{}}),{code:"ISO_HOST_REQUEST_INVALID"});assert.equal(f.calls(),0);
});
test("ordinary dense data and original cancellation remain accepted",()=>{
 const {snapshotIsoBuild}=require("../src/main/jobs/iso-host-build-snapshot.cjs"),controller=new AbortController(),value=payload();value.snapshot={items:["hello","香港",0,true,null,["nested"]]};
 const result=snapshotIsoBuild(value,{jobId:JOB,log:()=>{},signal:controller.signal});assert.deepEqual(result.payload.snapshot,value.snapshot);assert.equal(result.context.signal,controller.signal);
});
