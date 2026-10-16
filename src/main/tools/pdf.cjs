"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const {fail,grant}=require("./runtime.cjs");
const {isNativeFileBroker}=require("../security/native-file-broker.cjs");
const operations=Object.freeze(["inspect","split","merge","extract","reorder","rotate","metadata"]);
const admittedOperations=Object.freeze(["extract","reorder"]);
function pageSelection(value,count) {
  if(!Number.isInteger(count)||count<1)fail("INVALID_PAGE_SELECTION");
  if(!Array.isArray(value)||!value.length||value.length>1000||value.some(page=>!Number.isInteger(page)||page<1||page>Math.min(count,10000)))fail("INVALID_PAGE_SELECTION");
  return value.join(",");
}
function createPdfService(options) {
  const active=new Set();
  async function admission() {
    const payload=await options.payloadManager?.resolve("qpdf");
    if(!payload?.bundled)fail("BUNDLED_ADAPTER_REQUIRED");
    const broker=options.nativeFileBroker;
    if(!isNativeFileBroker(broker)||typeof broker.describe!=="function")fail(options.nativeFileBrokerError||"NATIVE_BROKER_UNAVAILABLE");
    const description=await broker.describe("qpdf");
    return {broker,description};
  }
  return {
    cancel(){const requested=active.size;for(const controller of active)controller.abort();return {requested};},
    async catalog(){
      let description,reason;
      try{({description}=await admission());}catch(error){reason=/^[A-Z_]+$/.test(error.code||"")?error.code:"NATIVE_BROKER_UNAVAILABLE";}
      return {operations:operations.map(operation=>{
        const supported=admittedOperations.includes(operation);
        const attemptAvailable=supported&&description?.attemptAvailable===true&&description.formats?.includes(operation)&&description.mechanism==="appcontainer-handle-job"&&description.runtimeAcceptance==="unverified";
        return {operation,available:false,attemptAvailable,runtimeVerified:false,reason:!supported?"NATIVE_PDF_OPERATION_UNAVAILABLE":attemptAvailable?"ISOLATED_ATTEMPT_UNVERIFIED":reason||description?.reason||"NATIVE_BROKER_UNAVAILABLE"};
      })};
    },
    async execute(request,context={}) {
      if(!admittedOperations.includes(request.operation))fail("NATIVE_PDF_OPERATION_UNAVAILABLE");
      const ids=request.sourceIds||[request.sourceId];
      if(!Array.isArray(ids)||ids.length!==1)fail("PDF_SINGLE_SOURCE_REQUIRED");
      pageSelection(request.pages,10000);
      const source=await grant(options,ids[0],"read"),destination=await grant(options,request.destinationId,"write");
      if(source===destination)fail("INPUT_OVERWRITE_FORBIDDEN");
      const stat=await fs.stat(source);
      if(!stat.isFile()||stat.size>64*1024*1024)fail("INPUT_LIMIT");
      const handle=await fs.open(source,"r"),signature=Buffer.alloc(5);
      try{await handle.read(signature,0,5,0);}finally{await handle.close();}
      if(signature.toString()!=="%PDF-")fail("UNSUPPORTED_SOURCE");
      const capacity=await fs.statfs(path.dirname(destination));
      if(capacity.bavail*capacity.bsize<512*1024*1024)fail("DESTINATION_STORAGE_LIMIT");
      const {broker,description}=await admission();
      if(description?.attemptAvailable!==true||!description.formats?.includes(request.operation)||description.mechanism!=="appcontainer-handle-job")fail(description?.reason||"NATIVE_BROKER_UNAVAILABLE");
      const controller=new AbortController(),abort=()=>controller.abort();
      context.signal?.addEventListener("abort",abort,{once:true});
      if(context.signal?.aborted)controller.abort();
      active.add(controller);
      try{
        const receipt=await broker.run({adapterId:"qpdf",format:request.operation,sourceId:ids[0],destinationId:request.destinationId,pages:request.pages},{...context,signal:controller.signal});
        const fields=["protocol","state","operation","mechanism","sourceSha256","outputBytes","outputSha256","validation","admission","publication","inputPages","expectedPages","outputPages","destinationId","outputCreated"];
        if(!receipt||Object.keys(receipt).length!==fields.length||fields.some(key=>!Object.hasOwn(receipt,key))||
          receipt.protocol!==1||receipt.state!=="completed"||receipt.operation!=="qpdf-"+request.operation||receipt.mechanism!=="appcontainer-handle-job"||
          receipt.validation!=="qpdf-structure-and-page-count"||receipt.publication!=="atomic-no-replace"||receipt.destinationId!==request.destinationId||receipt.outputCreated!==true||
          !Number.isSafeInteger(receipt.inputPages)||receipt.inputPages<1||receipt.inputPages>10000||receipt.expectedPages!==request.pages.length||receipt.outputPages!==request.pages.length||request.pages.some(page=>page>receipt.inputPages)||
          !Number.isSafeInteger(receipt.outputBytes)||receipt.outputBytes<1||receipt.outputBytes>128*1024*1024||!/^[a-f0-9]{64}$/.test(receipt.sourceSha256||"")||!/^[a-f0-9]{64}$/.test(receipt.outputSha256||"")||
          !receipt.admission||Object.keys(receipt.admission).length!==5||receipt.admission.appContainer!==true||receipt.admission.lpac!==true||receipt.admission.capabilityCount!==0||receipt.admission.jobAssigned!==true||receipt.admission.handleList!==true)
          throw Object.assign(new Error("PDF_OUTPUT_UNVERIFIED"),{code:"PDF_OUTPUT_UNVERIFIED",incompleteOutput:{state:"unknown",publication:"unconfirmed"}});
        return {pages:receipt.outputPages,inputPages:receipt.inputPages,bytes:receipt.outputBytes,sha256:receipt.outputSha256,sourceSha256:receipt.sourceSha256,operation:request.operation,validation:receipt.validation,publication:receipt.publication,visualEquivalenceVerified:false};
      }catch(error){
        if(error?.code==="INVALID_BROKER_RECEIPT"&&!error.incompleteOutput)error.incompleteOutput={state:"unknown",publication:"unconfirmed"};
        throw error;
      }finally{active.delete(controller);context.signal?.removeEventListener("abort",abort);}
    },
  };
}
async function pdfService(options,request,context){return createPdfService(options).execute(request,context);}
module.exports={createPdfService,pdfService,pageSelection};
