"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const {fail,grant}=require("./runtime.cjs");
const {isNativeFileBroker}=require("../security/native-file-broker.cjs");
const operations=Object.freeze(["inspect","split","merge","extract","reorder","rotate","metadata"]);
const admittedOperations=Object.freeze(["extract","reorder","merge","rotate","metadata"]);
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
      const merge=request.operation==="merge",rotate=request.operation==="rotate",metadata=request.operation==="metadata";
      const ids=request.sourceIds||[request.sourceId];
      if(!Array.isArray(ids)||!ids.length||ids.length>(merge?8:1))fail(merge?"PDF_SOURCE_LIMIT":"PDF_SINGLE_SOURCE_REQUIRED");
      const pages=merge||metadata?[]:request.pages;
      if(!merge&&!metadata)pageSelection(pages,10000);
      if(rotate&&(![90,180,270].includes(request.degrees)||new Set(pages).size!==pages.length))fail("INVALID_ROTATION");
      if(metadata&&request.mode!=="remove")fail("UNSUPPORTED_METADATA_MODE");
      const destination=await grant(options,request.destinationId,"write");
      let total=0;
      for(const id of ids){
        const source=await grant(options,id,"read");
        if(source===destination)fail("INPUT_OVERWRITE_FORBIDDEN");
        const stat=await fs.stat(source);total+=stat.size;
        if(!stat.isFile()||total>64*1024*1024)fail("INPUT_LIMIT");
        const handle=await fs.open(source,"r"),signature=Buffer.alloc(5);
        try{await handle.read(signature,0,5,0);}finally{await handle.close();}
        if(signature.toString()!=="%PDF-")fail("UNSUPPORTED_SOURCE");
      }
      const capacity=await fs.statfs(path.dirname(destination));
      if(capacity.bavail*capacity.bsize<512*1024*1024)fail("DESTINATION_STORAGE_LIMIT");
      const {broker,description}=await admission();
      if(description?.attemptAvailable!==true||!description.formats?.includes(request.operation)||description.mechanism!=="appcontainer-handle-job")fail(description?.reason||"NATIVE_BROKER_UNAVAILABLE");
      const controller=new AbortController(),abort=()=>controller.abort();
      context.signal?.addEventListener("abort",abort,{once:true});
      if(context.signal?.aborted)controller.abort();
      active.add(controller);
      try{
        const operation={adapterId:"qpdf",format:request.operation,destinationId:request.destinationId,
          ...(merge?{sourceIds:ids}:{sourceId:ids[0]}),
          ...(!merge&&!metadata?{pages}:{}),...(rotate?{degrees:request.degrees}:{}),...(metadata?{mode:"remove"}:{})};
        const receipt=await broker.run(operation,{...context,signal:controller.signal});
        const validation=rotate?"qpdf-structure-page-count-and-rotation":metadata?"qpdf-structure-page-count-and-metadata":"qpdf-structure-and-page-count";
        const extra=merge?["sourceSha256s","inputPageCounts"]:rotate?["degrees","rotationVerified"]:metadata?["metadataMode","metadataAbsent"]:[];
        const fields=["protocol","state","operation","mechanism","sourceSha256","outputBytes","outputSha256","validation","admission","publication","inputPages","expectedPages","outputPages","destinationId","outputCreated",...extra];
        const invalid=()=>{throw Object.assign(new Error("PDF_OUTPUT_UNVERIFIED"),{code:"PDF_OUTPUT_UNVERIFIED",incompleteOutput:{state:"unknown",publication:"unconfirmed"}});};
        if(!receipt||Object.keys(receipt).length!==fields.length||fields.some(key=>!Object.hasOwn(receipt,key))||
          receipt.protocol!==1||receipt.state!=="completed"||receipt.operation!=="qpdf-"+request.operation||receipt.mechanism!=="appcontainer-handle-job"||
          receipt.validation!==validation||receipt.publication!=="atomic-no-replace"||receipt.destinationId!==request.destinationId||receipt.outputCreated!==true||
          !Number.isSafeInteger(receipt.inputPages)||receipt.inputPages<1||receipt.inputPages>10000||receipt.expectedPages!==(merge||rotate||metadata?receipt.inputPages:pages.length)||receipt.outputPages!==receipt.expectedPages||pages.some(page=>page>receipt.inputPages)||
          !Number.isSafeInteger(receipt.outputBytes)||receipt.outputBytes<1||receipt.outputBytes>128*1024*1024||!/^[a-f0-9]{64}$/.test(receipt.sourceSha256||"")||!/^[a-f0-9]{64}$/.test(receipt.outputSha256||"")||
          !receipt.admission||Object.keys(receipt.admission).length!==5||receipt.admission.appContainer!==true||receipt.admission.lpac!==true||receipt.admission.capabilityCount!==0||receipt.admission.jobAssigned!==true||receipt.admission.handleList!==true)invalid();
        if(merge&&(!Array.isArray(receipt.sourceSha256s)||receipt.sourceSha256s.length!==ids.length||receipt.sourceSha256s[0]!==receipt.sourceSha256||receipt.sourceSha256s.some(hash=>!/^[a-f0-9]{64}$/.test(hash||""))||
          !Array.isArray(receipt.inputPageCounts)||receipt.inputPageCounts.length!==ids.length||receipt.inputPageCounts.some(count=>!Number.isSafeInteger(count)||count<1||count>10000)||receipt.inputPageCounts.reduce((sum,count)=>sum+count,0)!==receipt.inputPages))invalid();
        if(rotate&&(receipt.degrees!==request.degrees||receipt.rotationVerified!==true))invalid();
        if(metadata&&(receipt.metadataMode!=="remove"||receipt.metadataAbsent!==true))invalid();
        return {pages:receipt.outputPages,inputPages:receipt.inputPages,bytes:receipt.outputBytes,sha256:receipt.outputSha256,sourceSha256:receipt.sourceSha256,
          ...(merge?{sourceSha256s:receipt.sourceSha256s,inputPageCounts:receipt.inputPageCounts}:{}),
          ...(rotate?{degrees:receipt.degrees,rotationVerified:true}:{}),...(metadata?{metadataMode:"remove",metadataAbsent:true}:{}),
          operation:request.operation,validation:receipt.validation,publication:receipt.publication,visualEquivalenceVerified:false};
      }catch(error){
        if(error?.code==="INVALID_BROKER_RECEIPT"&&!error.incompleteOutput)error.incompleteOutput={state:"unknown",publication:"unconfirmed"};
        throw error;
      }finally{active.delete(controller);context.signal?.removeEventListener("abort",abort);}
    },
  };
}
async function pdfService(options,request,context){return createPdfService(options).execute(request,context);}
module.exports={createPdfService,pdfService,pageSelection};
