"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const {randomUUID,createHash} = require("node:crypto");
const {inflateRawSync} = require("node:zlib");
const {zipInventory,extractZip,safeName} = require("../tools/zip-payload.cjs");
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA=/^[a-f0-9]{40}$/;
const LIMIT=64*1024*1024;
const fail=code=>{throw Object.assign(Error(code),{code});};
const digest=buffer=>createHash("sha256").update(buffer).digest("hex");
const bindingKeys=["repository","workflow","workflowRef","workflowRevision","sourceRevision","sourceRepository","target","defconfig","parallelism","sha256"];
function binding(value){
  if(!value||!SHA.test(value.workflowRevision)||!SHA.test(value.sourceRevision)||! /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository)||! /^[A-Za-z0-9_.-]+\.ya?ml$/.test(value.workflow)||typeof value.workflowRef!=="string"||value.workflowRef.length>200)fail("EXECUTION_BINDING_INVALID");
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.sourceRepository)||! /^[A-Za-z0-9_+-]+_defconfig$/.test(value.defconfig)||typeof value.target!=="string"||! /^[A-Za-z0-9_-]{1,80}$/.test(value.target)||!Number.isInteger(value.parallelism)||value.parallelism<1||value.parallelism>64||!/^[a-f0-9]{64}$/.test(value.sha256)||value.repository.length>201||value.sourceRepository.length>201||value.workflow.length>200||value.defconfig.length>200)fail("EXECUTION_BINDING_INVALID");
  return Object.fromEntries(bindingKeys.map(key=>[key,value[key]]));
}
function createExecutionJobs({setup,workflows,directory,chooseDirectory}){
  const rows=new Map(),grants=new Map(),busy=new Set();
  const file=path.join(directory,"execution-jobs.json");
  let write=Promise.resolve();
  const ready=(async()=>{
    try{const info=await fs.lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>2*1024*1024)fail("EXECUTION_HISTORY_INVALID");const data=JSON.parse(await fs.readFile(file,"utf8"));if(data.version!==1||!Array.isArray(data.jobs)||data.jobs.length>500)fail("EXECUTION_HISTORY_INVALID");
      for(const row of data.jobs){if(!UUID.test(row.id)||!Number.isSafeInteger(row.createdAt)||!(row.runId===null||Number.isSafeInteger(row.runId)&&row.runId>0))fail("EXECUTION_HISTORY_INVALID");rows.set(row.id,{id:row.id,...binding(row),createdAt:row.createdAt,runId:row.runId,state:"reconnect-required",conclusion:null});}
    }catch(error){if(error.code!=="ENOENT")throw error;}
  })();
  function save(){write=write.then(async()=>{await fs.mkdir(directory,{recursive:true,mode:0o700});const tmp=file+"."+randomUUID();await fs.writeFile(tmp,JSON.stringify({version:1,jobs:[...rows.values()].map(r=>({id:r.id,...binding(r),createdAt:r.createdAt,runId:r.runId}))}),{flag:"wx",mode:0o600});await fs.rename(tmp,file);});return write;}
  function view(r){return {...r,connected:grants.has(r.id),htmlUrl:r.runId?`https://github.com/${r.repository}/actions/runs/${r.runId}`:null};}
  async function lock(id,fn){await ready;if(busy.has(id))fail("EXECUTION_JOB_BUSY");busy.add(id);try{return await fn();}finally{busy.delete(id);}}
  function publicSelection(selectionId){const selected=setup.selected(selectionId);if(selected.sourcePrivate!==false||selected.executionPrivate!==false||selected.runner?.kind!=="hosted"||JSON.stringify(selected.runner.labels)!=='["ubuntu-24.04"]')fail("EXECUTION_STANDARD_PUBLIC_HOSTED_REQUIRED");return selected;}
  function owned(id){const row=rows.get(id),selectionId=grants.get(id);if(!row)fail("EXECUTION_JOB_UNKNOWN");if(!selectionId)fail("EXECUTION_RECONNECT_REQUIRED");const selected=publicSelection(selectionId);if(selected.repository!==row.repository||selected.sourceRepository!==row.sourceRepository)fail("EXECUTION_DESTINATION_CHANGED");return {row,selectionId};}
  const call=(selectionId,method,suffix,body)=>setup.call(selectionId,{method,suffix,...(body===undefined?{}:{body})});
  function assertRun(row,run){if(run?.id!==row.runId||run.display_title!==`material-buildroot-${row.id}`||run.head_sha!==row.workflowRevision||run.event!=="workflow_dispatch"||run.path!==`.github/workflows/${row.workflow}`||run.repository?.full_name!==row.repository||run.run_attempt!==1)fail("EXECUTION_RUN_BINDING_MISMATCH");}
  async function observe(id){const {row,selectionId}=owned(id);
    if(!row.runId){let match=null;for(let page=1;page<=5;page++){const response=await call(selectionId,"GET",`/actions/workflows/${encodeURIComponent(row.workflow)}/runs?event=workflow_dispatch&per_page=100&page=${page}`);if(!Array.isArray(response.workflow_runs))fail("EXECUTION_RESPONSE_INVALID");for(const run of response.workflow_runs){if(run.display_title!==`material-buildroot-${id}`)continue;if(match)fail("EXECUTION_RUN_AMBIGUOUS");match=run;}if(response.workflow_runs.length<100)break;}if(!match)return view(row);row.runId=match.id;assertRun(row,match);await save();}
    const run=await call(selectionId,"GET",`/actions/runs/${row.runId}`);assertRun(row,run);
    const states=["queued","in_progress","completed","waiting","pending","requested"];
    if(!states.includes(run.status))fail("EXECUTION_STATE_UNSUPPORTED");row.state=run.status==="completed"?"completed":row.state==="cancel-requested"?"cancel-requested":run.status;row.conclusion=run.status==="completed"?run.conclusion:null;row.observedAt=Date.now();return view(row);
  }
  async function outputs(id){const state=await observe(id);if(state.state!=="completed"||state.conclusion!=="success")fail("EXECUTION_OUTPUT_NOT_READY");const {row,selectionId}=owned(id);const response=await call(selectionId,"GET",`/actions/runs/${row.runId}/artifacts?per_page=100`);if(!Array.isArray(response.artifacts)||response.total_count>100)fail("EXECUTION_OUTPUT_RESPONSE_INVALID");return response.artifacts.filter(a=>a.name==="buildroot-output"&&!a.expired&&Number.isSafeInteger(a.id)&&a.id>0&&Number.isSafeInteger(a.size_in_bytes)&&a.size_in_bytes>0&&a.size_in_bytes<=LIMIT&&/^sha256:[a-f0-9]{64}$/.test(a.digest||"")).map(a=>({id:a.id,name:a.name,bytes:a.size_in_bytes,sha256:a.digest.slice(7)}));}
  return {
    async list(){await ready;return [...rows.values()].map(view);},
    async dispatch({selectionId,consent}){return lock("dispatch",async()=>{if(consent!==true)fail("EXECUTION_DISPATCH_CONSENT_REQUIRED");publicSelection(selectionId);if(rows.size>=500)fail("EXECUTION_HISTORY_FULL");const admission=await workflows.admission({selectionId});const fixed=binding(admission);const current=await call(selectionId,"GET",`/commits/${encodeURIComponent(fixed.workflowRef)}`);if(current.sha!==fixed.workflowRevision)fail("EXECUTION_WORKFLOW_CHANGED");const row={id:randomUUID(),...fixed,createdAt:Date.now(),runId:null,state:"dispatch-unconfirmed",conclusion:null};rows.set(row.id,row);grants.set(row.id,selectionId);await save();
      try{await call(selectionId,"POST",`/actions/workflows/${encodeURIComponent(row.workflow)}/dispatches`,{ref:row.workflowRef,inputs:{operation:row.id}});row.state="dispatch-accepted";}catch{fail("EXECUTION_DISPATCH_UNCONFIRMED");}return view(row);});},
    observe({id}){return lock(id,()=>observe(id));},
    reconnect({id,selectionId,consent}){return lock(id,async()=>{if(consent!==true)fail("EXECUTION_RECONNECT_CONSENT_REQUIRED");const row=rows.get(id);if(!row)fail("EXECUTION_JOB_UNKNOWN");const selection=publicSelection(selectionId);if(selection.repository!==row.repository||selection.sourceRepository!==row.sourceRepository)fail("EXECUTION_DESTINATION_CHANGED");grants.set(id,selectionId);try{return await observe(id);}catch(error){grants.delete(id);throw error;}});},
    cancel({id,consent}){return lock(id,async()=>{if(consent!==true)fail("EXECUTION_CANCEL_CONSENT_REQUIRED");const state=await observe(id);if(!state.runId)fail("EXECUTION_RUN_NOT_OBSERVED");if(state.state==="completed")return state;const {row,selectionId}=owned(id);await call(selectionId,"POST",`/actions/runs/${row.runId}/cancel`);row.state="cancel-requested";return view(row);});},
    outputs({id}){return lock(id,()=>outputs(id));},
    download({id,artifactId,consent}){return lock(id,async()=>{
      if(consent!==true)fail("EXECUTION_DOWNLOAD_CONSENT_REQUIRED");const output=(await outputs(id)).find(a=>a.id===artifactId);if(!output)fail("EXECUTION_OUTPUT_NOT_ADMITTED");const {row,selectionId}=owned(id);const parent=await chooseDirectory();if(!parent)return {cancelled:true};const stat=await fs.lstat(parent);if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(parent)!==parent)fail("EXECUTION_DESTINATION_UNSAFE");
      await observe(id);
      const bytes=await setup.download(selectionId,{artifactId,maxBytes:LIMIT});if(!Buffer.isBuffer(bytes)||bytes.length!==output.bytes||digest(bytes)!==output.sha256)fail("EXECUTION_OUTPUT_DIGEST_MISMATCH");
      const root=await fs.mkdtemp(path.join(parent,"buildroot-output-"));const archive=path.join(root,"output.zip");await fs.writeFile(archive,bytes,{flag:"wx",mode:0o600});
      const inventory=await zipInventory(archive),manifestEntry=inventory.find(e=>e.name==="manifest.json"&&!e.directory);if(!manifestEntry||manifestEntry.bytes>2*1024*1024)fail("EXECUTION_MANIFEST_MISSING");const compressed=bytes.subarray(manifestEntry.dataOffset,manifestEntry.dataOffset+manifestEntry.compressed);const raw=manifestEntry.method===8?inflateRawSync(compressed,{maxOutputLength:2*1024*1024}):compressed;const manifest=JSON.parse(raw.toString("utf8"));
      if(raw.length!==manifestEntry.bytes||manifest.schemaVersion!==1||manifest.operationId!==id||manifest.workflowRevision!==row.workflowRevision||manifest.sourceRevision!==row.sourceRevision||!Array.isArray(manifest.files)||manifest.files.length>9999)fail("EXECUTION_MANIFEST_BINDING_MISMATCH");
      const seen=new Set();let total=0;for(const member of manifest.files){if(!safeName(member.path)||member.path.endsWith("/")||member.path==="manifest.json"||seen.has(member.path.toLowerCase())||!Number.isSafeInteger(member.length)||member.length<0||!/^[a-f0-9]{64}$/.test(member.sha256))fail("EXECUTION_MANIFEST_INVALID");seen.add(member.path.toLowerCase());total+=member.length;if(total>8*1024**3)fail("EXECUTION_EXPANSION_LIMIT");}
      const destination=path.join(root,"files");await fs.mkdir(destination,{mode:0o700});await extractZip(archive,destination,[...manifest.files,{path:"manifest.json",length:raw.length,sha256:digest(raw)}]);return {verified:true,extracted:true,executed:false,files:manifest.files.length,bytes:output.bytes,sha256:output.sha256,destination};
    });}
  };
}
module.exports={createExecutionJobs};
