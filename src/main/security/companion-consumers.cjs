'use strict';
const {randomUUID}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function fail(code){throw Object.assign(new Error('Companion consumer unavailable.'),{code});}
function exact(args,keys){if(!args||Object.getPrototypeOf(args)!==Object.prototype||Reflect.ownKeys(args).length!==keys.length||keys.some(key=>!Object.hasOwn(args,key)))fail('INVALID_REQUEST');}
const id=value=>typeof value==='string'&&UUID.test(value);
const contract=(scope,keys,check=()=>true)=>Object.freeze({scope,validate(args){exact(args,keys);if(!check(args))fail('INVALID_REQUEST');}});
const project=args=>id(args.workspaceId);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const domain=value=>['buildroot','linux','busybox','uboot'].includes(value);
const symbol=value=>typeof value==='string'&&/^(BR2_|CONFIG_)[A-Z0-9_]{1,160}$/.test(value)&&!/(PASSWORD|SECRET|TOKEN|PRIVATE_KEY|CREDENTIAL)/.test(value);
function change(value){if(!value||typeof value!=='object')return false;exact(value,['type','value']);switch(value.type){case 'bool':return typeof value.value==='boolean';case 'tristate':return ['y','m','n'].includes(value.value);case 'int':return typeof value.value==='string'&&/^-?[0-9]{1,20}$/.test(value.value);case 'hex':return typeof value.value==='string'&&/^0x[a-fA-F0-9]{1,16}$/.test(value.value);default:return false;}}
function configProjection(value){return {revision:value.revision,undoDepth:value.undoDepth||0,semanticsAvailable:value.semantics?.available===true,entries:(value.entries||[]).filter(item=>symbol(item.symbol)&&['bool','tristate','int','hex'].includes(item.type)).slice(0,200).map(({symbol,type,value})=>({symbol,type,value})),truncated:(value.entries?.length||0)>200,stringEditing:'native-only'};}
const actionContracts=Object.freeze({
 'config.inspect':contract('configuration:read',['workspaceId','domain'],a=>project(a)&&domain(a.domain)),
 'config.apply':contract('configuration:write',['workspaceId','domain','revision','symbol','change'],a=>project(a)&&domain(a.domain)&&hash(a.revision)&&symbol(a.symbol)&&change(a.change)),
 'config.undo':contract('configuration:write',['workspaceId','domain','revision'],a=>project(a)&&domain(a.domain)&&hash(a.revision)),
 'defconfig.apply':contract('configuration:write',['workspaceId','revision','id'],a=>project(a)&&hash(a.revision)&&hash(a.id)),
 'cloud.start':contract('deployment:write',['workspaceId','id'],a=>project(a)&&id(a.id)),
 'cloud.list':contract('deployment:read',['workspaceId'],project),
 'cloud.preview':contract('deployment:write',['workspaceId','fileId','destinationId'],a=>project(a)&&id(a.fileId)&&id(a.destinationId)),
 'models.status':contract('tools:read',[]),
 'models.list':contract('tools:read',[]),
 'workspace.read':contract('workspace:read',[]),
 'projects.list':contract('projects:read',[]),
 'jobs.list':contract('jobs:read',[]),
 'jobs.get':contract('jobs:read',['jobId'],a=>id(a.jobId)),
 'jobs.cancel':contract('jobs:cancel',['jobId','expectedSequence'],a=>id(a.jobId)&&Number.isSafeInteger(a.expectedSequence)&&a.expectedSequence>=0),
 'source.choose':contract('source:write',[]),
 'source.clone.official':contract('source:write',['selectionId','directory','ref'],a=>id(a.selectionId)&&typeof a.directory==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(a.directory)&&typeof a.ref==='string'&&/^[A-Za-z0-9][A-Za-z0-9_./-]{0,119}$/.test(a.ref)),
 'source.status':contract('source:read',['workspaceId'],project),
 'project.options':contract('projects:read',['workspaceId'],project),
 'defconfig.catalog':contract('configuration:read',['workspaceId'],project),
 'builds.submit':contract('builds:submit',['workspaceId','target','jobs'],a=>project(a)&&['all','sdk','source','legal-info','show-info','graph-depends'].includes(a.target)&&Number.isSafeInteger(a.jobs)&&a.jobs>=1&&a.jobs<=32),
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
 function state(context){let current=sessions.get(context.sessionId);if(!current){if(sessions.size>=100)fail('SESSION_LIMIT');current={origin:context.origin,files:new Map(),jobs:new Set(),viewers:new Map(),destinations:new Map(),cloudPreviews:new Map(),sourceSelections:new Set()};sessions.set(context.sessionId,current);}if(current.origin!==context.origin)fail('UNAUTHORIZED');return current;}
 function file(state,args,kind){const entry=state.files.get(args.fileId||args.directoryId);if(!entry||entry.workspaceId!==args.workspaceId||entry.kind!==kind)fail('FILE_NOT_ADMITTED');return entry.id;}
 return Object.freeze({actionContracts,async dispatch(request,context){
  const definition=actionContracts[request.action];if(!definition)fail('ACTION_NOT_ADMITTED');definition.validate(request.args);admitted(context,definition.scope);const owned=state(context),a=request.args;
  if(a.workspaceId)host.authorizeProject(a.workspaceId);
  function viewer(){let value=owned.viewers.get(a.workspaceId);if(!value){if(owned.viewers.size>=100)fail('PROJECT_LIMIT');value=host.openOutputs(a.workspaceId);owned.viewers.set(a.workspaceId,value);}return value;}
  let result;
  switch(request.action){
   case 'config.inspect':result=configProjection(await host.inspectConfiguration(a));break;
   case 'config.apply':case 'config.undo':case 'defconfig.apply':{
    const confirm=await host.confirmMutation({action:request.action,args:a,origin:context.origin,deviceName:context.deviceName},()=>admitted(context,definition.scope));
    admitted(context,definition.scope);host.authorizeProject(a.workspaceId);
    if(!confirm){result={state:'cancelled',changed:false};break;}
    if(request.action==='config.apply')await host.applyConfiguration(a);
    else if(request.action==='config.undo')await host.undoConfiguration(a);
    else await host.applyDefconfig(a);
    result={state:'completed',configuration:configProjection(await host.inspectConfiguration({workspaceId:a.workspaceId,domain:a.domain||'buildroot'}))};break;
   }
   case 'models.status':{const value=await host.modelStatus();if(value.ok===false)fail('MODEL_SERVICE_UNAVAILABLE');result={version:typeof value.version==='string'?value.version:'unavailable'};break;}
   case 'models.list':{const value=await host.modelList();if(value.ok===false||!Array.isArray(value.models))fail('MODEL_SERVICE_UNAVAILABLE');result={models:value.models.slice(0,100).map(item=>({name:item.name,size:item.size,digest:item.digest,modifiedAt:item.modified_at}))};break;}
   case 'cloud.start':{const preview=owned.cloudPreviews.get(a.id);if(!preview||preview.workspaceId!==a.workspaceId||preview.expiresAt<=Date.now())fail('PREVIEW_NOT_ADMITTED');owned.cloudPreviews.delete(a.id);result=await host.startCloud(a.workspaceId,a.id,()=>{admitted(context,definition.scope);host.authorizeProject(a.workspaceId);});break;}
   case 'cloud.list':{const value=host.cloudList(a.workspaceId);owned.destinations.set(a.workspaceId,new Set(value.profiles.map(item=>item.id)));result={credentialStorage:value.credentialStorage,profiles:value.profiles.map(({id,label,provider})=>({id,label,provider})),jobs:value.jobs.slice(0,100).map(({id,state,sequence,createdAt,updatedAt,sha256,size})=>({id,state,sequence,createdAt,updatedAt,sha256,size}))};break;}
   case 'cloud.preview':{if(!owned.destinations.get(a.workspaceId)?.has(a.destinationId))fail('DESTINATION_NOT_ADMITTED');const value=await host.previewCloud(a.workspaceId,viewer(),file(owned,a,'file'),a.destinationId);owned.cloudPreviews.set(value.id,{workspaceId:a.workspaceId,expiresAt:value.expiresAt});result={id:value.id,sha256:value.sha256,size:value.size,expiresAt:value.expiresAt,destination:{provider:value.destination.provider,label:value.destination.label},networkState:value.networkState,overwrite:value.overwrite};break;}
   case 'workspace.read':result=host.readWorkspace();break;
   case 'projects.list':result={projects:host.listProjects()};break;
   case 'jobs.list':{const jobs=host.listJobs();for(const job of jobs)owned.jobs.add(job.id);result={jobs:jobs.map(summary)};break;}
   case 'jobs.get':if(!owned.jobs.has(a.jobId))fail('JOB_NOT_ADMITTED');result={job:summary(host.getJob(a.jobId))};break;
   case 'jobs.cancel':{if(!owned.jobs.has(a.jobId))fail('JOB_NOT_ADMITTED');const job=host.getJob(a.jobId);if(job.payload?.workspaceId)host.authorizeProject(job.payload.workspaceId);admitted(context,definition.scope);host.cancelJob(a.jobId,a.expectedSequence);result={job:summary(host.getJob(a.jobId)),cancellation:'requested-not-confirmed'};break;}
   case 'source.choose':{const value=await host.chooseSource();if(value.ok===false)fail('SOURCE_SELECTION_UNAVAILABLE');if(value.cancelled){result={cancelled:true};break;}owned.sourceSelections.add(value.selectionId);result={cancelled:false,selectionId:value.selectionId,name:value.name};break;}
   case 'source.clone.official':{if(!owned.sourceSelections.has(a.selectionId))fail('SOURCE_SELECTION_NOT_ADMITTED');const approved=await host.confirmSource(a,context,()=>admitted(context,definition.scope));admitted(context,definition.scope);if(!approved){result={cancelled:true};break;}owned.sourceSelections.delete(a.selectionId);const value=await host.cloneOfficial(a);if(value.ok===false)fail('SOURCE_CLONE_UNAVAILABLE');result={cancelled:false,workspaceId:value.workspaceId,revision:value.revision,branch:value.branch,dirty:value.dirty};break;}
   case 'source.status':{const value=await host.sourceStatus(a.workspaceId);if(value.ok===false)fail('SOURCE_UNAVAILABLE');result={revision:value.revision,branch:value.branch,dirty:value.dirty,snapshotCount:value.snapshots?.length||0};break;}
   case 'project.options':{const value=host.projectOptions(a.workspaceId);result={revision:value.revision,runtime:value.runtime?.kind||'unconfigured',externalTreesAuthorized:value.externalTreesAuthorized,externalTreeCount:value.availableTrees?.length||0};break;}
   case 'defconfig.catalog':{const value=await host.defconfigCatalog(a.workspaceId);result={revision:value.revision,entries:value.entries.slice(0,200).map(({id,name,origin,order,sha256})=>({id,name,origin,order,sha256})),truncated:value.entries.length>200,apply:'native-only'};break;}
   case 'builds.submit':{const job=await host.submitBuild(a,()=>admitted(context,definition.scope));owned.jobs.add(job.id);result={job:summary(job)};break;}
   case 'build.targets':{const value=host.buildTargets(a.workspaceId);result={targets:value.targets.filter(target=>target!=='clean'),packages:value.packages.slice(0,200),packageActions:value.packageActions.filter(action=>action!=='dirclean'),packageAvailability:value.packageAvailability,submission:'approved-scope-required'};break;}
   case 'outputs.browse':{const directory=a.directoryId==='root'?'root':file(owned,a,'directory');const value=viewer().browse(directory);if(a.directoryId==='root')for(const [key,item]of owned.files)if(item.workspaceId===a.workspaceId)owned.files.delete(key);if(owned.files.size+value.rows.length>4000)fail('FILE_LIMIT');result={truncated:value.truncated,rows:value.rows.map(item=>{const handle=randomUUID();owned.files.set(handle,{workspaceId:a.workspaceId,kind:item.kind,id:item.id});return {id:handle,name:item.name,kind:item.kind,size:item.size};})};break;}
   case 'outputs.inspect':{const value=await viewer().inspect(file(owned,a,'file'));result={fileId:a.fileId,name:value.name,size:value.size,format:value.format,sectorBytes:value.sectorBytes,checksumState:value.checksumState,truncated:value.truncated,preview:'native-only'};break;}
   case 'outputs.checksum':{const value=await viewer().checksum(file(owned,a,'file'),a.expected);result={fileId:a.fileId,sha256:value.sha256,matches:value.matches};break;}
  }
  // Reads completing after revocation disclose no newly obtained result. Cancellation is not completion.
  admitted(context,definition.scope);if(a.workspaceId)host.authorizeProject(a.workspaceId);return result;
 },forget(sessionId){sessions.delete(sessionId);}});
}
module.exports={actionContracts,createCompanionConsumers};







