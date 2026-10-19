"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {createIsoProducerTransactions}=require("../src/main/execution/iso-producer-transaction.cjs");
const {readIsoTransaction}=require("../src/main/jobs/iso-transaction-readback.cjs");
const {createIsoOutputPolicy}=require("../src/main/jobs/iso-output-policy.cjs");
const {validateOwnershipReceipt}=require("../src/main/execution/index.cjs");
const JOB="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",HASH="a".repeat(64);
async function fixture(t,crash=false){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"iso-readback-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const owner={version:1,kind:"wsl",ownerToken:JOB,distribution:"Fixture",bootId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",pidNamespace:"pid:[123]",pid:42,startTime:"456"};
 const execution={grants:new Map([["grant",{root:"root",source:"source",output:"output",wslReceipt:{storage:{distribution:"Fixture"}}}]]),locks:new Set()};
 const binding={sourceSha256:HASH,configurationSha256:HASH,projectProofSha256:HASH},policy=createIsoOutputPolicy({revision:HASH,profile:"x86_64-bios-grub2-initrd"});
 const request={grantId:"grant",jobId:JOB,runtime:{kind:"wsl",distribution:"Fixture"},policy};
 const stage=async(options,observation)=>{await options.onOwnership(owner);return{state:"succeeded",code:0,observation};};
 const service=createIsoProducerTransactions({execution,directory,adapters:{current:async()=>binding,validateOwner:validateOwnershipReceipt,inspectCleanup:async()=>({state:"verified-stopped",reason:"owned-session-absent"}),
  prepare:async(input,options)=>stage(options,{state:"prepared-unbound",jobId:JOB,preparationSha256:HASH,prior:null,jobBound:false,bootVerified:false}),
  produce:async(input,options)=>{await options.onOwnership({...owner,pid:null,startTime:null});if(crash)throw Error("interrupted");await options.onOwnership(owner);return{state:"succeeded",code:0};},
  capture:async(input,options)=>stage(options,{state:"fresh-file-observed-unbound",jobId:JOB,preparationSha256:HASH,jobBound:false,producerVerified:false,cleanupVerified:false,bootVerified:false,output:{sha256:HASH,bytes:51200,identity:Array(9).fill("1"),structure:{descriptorValid:true,withinImage:true,biosCatalogValid:true,bootVerified:false}}})
 }});
 let result;try{result=await service.run(request);}catch(error){if(!crash)throw error;}
 const expected={...request,binding,receiptRecordSha256:result?.receiptRecordSha256??null},root=path.join(directory,JOB);
 const read=()=>readIsoTransaction({directory,expected});
 function rewrite(mutate){const files=fs.readdirSync(root).sort(),rows=files.map(name=>JSON.parse(fs.readFileSync(path.join(root,name))));mutate(rows);let previous=null;rows.forEach((row,index)=>{row.sequence=index;row.previousSha256=previous;const raw=JSON.stringify(row);fs.writeFileSync(path.join(root,files[index]),raw);previous=crypto.createHash("sha256").update(raw).digest("hex");});expected.receiptRecordSha256=previous;}
 return{directory,root,expected,read,rewrite,execution};
}
test("actual writer output reads as anchored complete without any mutation",async t=>{
 const f=await fixture(t),before=fs.readdirSync(f.root).map(name=>fs.readFileSync(path.join(f.root,name))),result=f.read();
 assert.equal(result.state,"complete");assert.equal(result.receipt.bootVerified,false);assert.equal(fs.existsSync(path.join(f.directory,"active.json")),false);
 assert.deepEqual(fs.readdirSync(f.root).map(name=>fs.readFileSync(path.join(f.root,name))),before);assert.equal(f.execution.locks.size,0);
});
test("interrupted owner prefix stays incomplete and never clears reservation or locks",async t=>{
 const f=await fixture(t,true),active=fs.readFileSync(path.join(f.directory,"active.json"));assert.equal(f.read().state,"incomplete");
 assert.deepEqual(fs.readFileSync(path.join(f.directory,"active.json")),active);assert.equal(f.execution.locks.size,3);
});
for(const [name,mutate]of[
 ["unknown record",rows=>rows[2].kind="invented"],
 ["missing successful result",rows=>rows.find(row=>row.kind==="result").value.code=2],
 ["wrong cleanup owner",rows=>rows.find(row=>row.kind==="cleanup").value.receipt.pid=99],
 ["unknown cleanup",rows=>rows.find(row=>row.kind==="cleanup").value.verdict.state="unknown"],
 ["changed refinement token",rows=>rows.find(row=>row.kind==="ownership"&&row.value.stage==="produce"&&row.value.receipt.pid!==null).value.receipt.ownerToken="cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
 ["wrong preparation",rows=>rows.at(-1).value.preparationSha256="b".repeat(64)],
 ["optimistic boot",rows=>rows.at(-1).value.bootVerified=true],
 ["duplicate stage",rows=>rows.find(row=>row.kind==="stage"&&row.value.stage==="capture").value.stage="produce"],
 ["foreign source",rows=>rows.at(-1).value.binding.sourceSha256="b".repeat(64)],
])test(`semantic readback rejects ${name} despite a recomputed chain`,async t=>{const f=await fixture(t);f.rewrite(mutate);assert.equal(f.read().state,"unknown");});
for(const mode of["missing","missing-tail","truncated","oversized","duplicate-key","tampered","unanchored","another-job","foreign-grant","unknown-file"]){
 test(`readback rejects ${mode}`,async t=>{
  const f=await fixture(t),first=path.join(f.root,"000000.json");
  if(mode==="missing")fs.unlinkSync(first);
  if(mode==="missing-tail")fs.unlinkSync(path.join(f.root,fs.readdirSync(f.root).sort().at(-1)));
  if(mode==="truncated")fs.writeFileSync(first,"{");
  if(mode==="oversized")fs.writeFileSync(first," ".repeat(65537));
  if(mode==="duplicate-key")fs.writeFileSync(first,'{"version":1,"version":1}');
  if(mode==="tampered")fs.appendFileSync(first," ");
  if(mode==="unanchored")f.expected.receiptRecordSha256=null;
  if(mode==="another-job")f.expected.jobId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  if(mode==="foreign-grant")f.expected.grantId="other";
  if(mode==="unknown-file")fs.writeFileSync(path.join(f.root,"extra.json"),"{}");
  assert.equal(f.read().state,"unknown");
 });
}
test("receipt plus retained reservation remains incomplete",async t=>{const f=await fixture(t);fs.writeFileSync(path.join(f.directory,"active.json"),JSON.stringify({version:1,jobId:JOB}));assert.equal(f.read().state,"incomplete");assert.equal(fs.existsSync(path.join(f.directory,"active.json")),true);});
