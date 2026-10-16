'use strict';
const {randomUUID}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function fail(code){throw Object.assign(new Error('Companion consumer unavailable.'),{code});}
function exact(args,keys){if(!args||Object.getPrototypeOf(args)!==Object.prototype||Reflect.ownKeys(args).length!==keys.length||keys.some(key=>!Object.hasOwn(args,key)))fail('INVALID_REQUEST');}
const id=value=>typeof value==='string'&&UUID.test(value);
const contract=(scope,keys,check=()=>true)=>Object.freeze({scope,validate(args){exact(args,keys);if(!check(args))fail('INVALID_REQUEST');}});
const project=args=>id(args.workspaceId);
const actionContracts=Object.freeze({
 'workspace.read':contract('workspace:read',[]),
 'projects.list':contract('projects:read',[]),
 'jobs.list':contract('jobs:read',[]),
 'jobs.get':contract('jobs:read',['jobId'],a=>id(a.jobId)),
 'jobs.cancel':contract('jobs:cancel',['jobId','expectedSequence'],a=>id(a.jobId)&&Number.isSafeInteger(a.expectedSequence)&&a.expectedSequence>=0),
 'source.status':contract('source:read',['workspaceId'],project),
 'project.options':contract('projects:read',['workspaceId'],project),
 'defconfig.catalog':contract('configuration:read',['workspaceId'],project),
 'build.targets':contract('projects:read',['workspaceId'],project),
 'outputs.browse':contract('outputs:read',['workspaceId','directoryId'],a=>project(a)&&(a.directoryId==='root'||id(a.directoryId))),
 'outputs.inspect':contract('outputs:read',['workspaceId','fileId'],a=>project(a)&&id(a.fileId)),
 'outputs.checksum':contract('outputs:read',['workspaceId','fileId','expected'],a=>project(a)&&id(a.fileId)&&typeof a.expected==='string'&&/^(?:[a-fA-F0-9]{64})?$/.test(a.expected)),
});
const summary=job=>({id:job.id,kind:job.kind,state:job.state,sequence:job.sequence,createdAt:job.createdAt,updatedAt:job.updatedAt,logCount:job.logCount,itemCount:job.itemCount});
/** Named host adapters only. Never accept a general IPC dispatcher or browser-supplied consent. */
function createCompanionConsumers(host){
 const sessions=new Map();
 function admitted(context,scope){if(!context||typeof context.isAuthorized!=='function'||!context.isAuthorized()||!context.scopes.includes(scope))fail('UNAUTHORIZED');}
 function state(context){let current=sessions.get(context.sessionId);if(!current){if(sessions.size>=100)fail('SESSION_LIMIT');current={origin:context.origin,files:new Map(),jobs:new Set(),viewers:new Map()};sessions.set(context.sessionId,current);}if(current.origin!==context.origin)fail('UNAUTHORIZED');return current;}
 function file(state,args,kind){const entry=state.files.get(args.fileId||args.directoryId);if(!entry||entry.workspaceId!==args.workspaceId||entry.kind!==kind)fail('FILE_NOT_ADMITTED');return entry.id;}
 return Object.freeze({actionContracts,async dispatch(request,context){
  const definition=actionContracts[request.action];if(!definition)fail('ACTION_NOT_ADMITTED');definition.validate(request.args);admitted(context,definition.scope);const owned=state(context),a=request.args;
  if(a.workspaceId)host.authorizeProject(a.workspaceId);
  function viewer(){let value=owned.viewers.get(a.workspaceId);if(!value){if(owned.viewers.size>=100)fail('PROJECT_LIMIT');value=host.openOutputs(a.workspaceId);owned.viewers.set(a.workspaceId,value);}return value;}
  let result;
  switch(request.action){
   case 'workspace.read':result=host.readWorkspace();break;
   case 'projects.list':result={projects:host.listProjects()};break;
   case 'jobs.list':{const jobs=host.listJobs();for(const job of jobs)owned.jobs.add(job.id);result={jobs:jobs.map(summary)};break;}
   case 'jobs.get':if(!owned.jobs.has(a.jobId))fail('JOB_NOT_ADMITTED');result={job:summary(host.getJob(a.jobId))};break;
   case 'jobs.cancel':{if(!owned.jobs.has(a.jobId))fail('JOB_NOT_ADMITTED');const job=host.getJob(a.jobId);if(job.payload?.workspaceId)host.authorizeProject(job.payload.workspaceId);admitted(context,definition.scope);host.cancelJob(a.jobId,a.expectedSequence);result={job:summary(host.getJob(a.jobId)),cancellation:'requested-not-confirmed'};break;}
   case 'source.status':{const value=await host.sourceStatus(a.workspaceId);if(value.ok===false)fail('SOURCE_UNAVAILABLE');result={revision:value.revision,branch:value.branch,dirty:value.dirty,snapshotCount:value.snapshots?.length||0};break;}
   case 'project.options':{const value=host.projectOptions(a.workspaceId);result={revision:value.revision,runtime:value.runtime?.kind||'unconfigured',externalTreesAuthorized:value.externalTreesAuthorized,externalTreeCount:value.availableTrees?.length||0};break;}
   case 'defconfig.catalog':{const value=await host.defconfigCatalog(a.workspaceId);result={revision:value.revision,entries:value.entries.slice(0,200).map(({id,name,origin,order,sha256})=>({id,name,origin,order,sha256})),truncated:value.entries.length>200,apply:'native-only'};break;}
   case 'build.targets':{const value=host.buildTargets(a.workspaceId);result={targets:value.targets.filter(target=>target!=='clean'),packages:value.packages.slice(0,200),packageActions:value.packageActions.filter(action=>action!=='dirclean'),packageAvailability:value.packageAvailability,submission:'native-only'};break;}
   case 'outputs.browse':{const directory=a.directoryId==='root'?'root':file(owned,a,'directory');const value=viewer().browse(directory);if(a.directoryId==='root')for(const [key,item]of owned.files)if(item.workspaceId===a.workspaceId)owned.files.delete(key);if(owned.files.size+value.rows.length>4000)fail('FILE_LIMIT');result={truncated:value.truncated,rows:value.rows.map(item=>{const handle=randomUUID();owned.files.set(handle,{workspaceId:a.workspaceId,kind:item.kind,id:item.id});return {id:handle,name:item.name,kind:item.kind,size:item.size};})};break;}
   case 'outputs.inspect':{const value=await viewer().inspect(file(owned,a,'file'));result={fileId:a.fileId,name:value.name,size:value.size,format:value.format,sectorBytes:value.sectorBytes,checksumState:value.checksumState,truncated:value.truncated,preview:'native-only'};break;}
   case 'outputs.checksum':{const value=await viewer().checksum(file(owned,a,'file'),a.expected);result={fileId:a.fileId,sha256:value.sha256,matches:value.matches};break;}
  }
  // Reads completing after revocation disclose no newly obtained result. Cancellation is not completion.
  admitted(context,definition.scope);if(a.workspaceId)host.authorizeProject(a.workspaceId);return result;
 },forget(sessionId){sessions.delete(sessionId);}});
}
module.exports={actionContracts,createCompanionConsumers};


