"use strict";
const fs=require('node:fs'), path=require('node:path'), {randomUUID,createHash}=require('node:crypto');
const {createJobManager}=require('../jobs/manager.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA=/^[a-f0-9]{64}$/;
const KINDS=['linux-process','linux-docker','windows-wsl','windows-docker'];
const LIMIT=32*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail('REMOTE_INVALID_REQUEST');}
function descriptor(v){
 exact(v,['version','name','host','port','username','hostKey','kind','root','distribution','image','uid','gid']);
 if(v.version!==1||typeof v.name!=='string'||!v.name.trim()||v.name.length>80||!KINDS.includes(v.kind)||!/^([a-zA-Z0-9][a-zA-Z0-9.-]{0,252})$/.test(v.host)||!Number.isInteger(v.port)||v.port<1||v.port>65535||! /^[a-z_][a-z0-9_-]{0,31}$/i.test(v.username)||v.username==='root'||! /^ssh-ed25519 [A-Za-z0-9+/]{40,100}={0,2}$/.test(v.hostKey)||typeof v.root!=='string'||v.root.length>512||/[\s,"'`$;|&<>\x00-\x1f]/.test(v.root))fail('REMOTE_DESCRIPTOR_INVALID');
 if(v.kind==='windows-docker'?!/^[A-Z]:\\(?:[A-Za-z0-9._-]+\\)*[A-Za-z0-9._-]+$/.test(v.root):!/^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(v.root))fail('REMOTE_ROOT_INVALID');
 if(v.root.split(/[\\/]/).some(x=>x==='.'||x==='..'))fail('REMOTE_ROOT_INVALID');
 if(v.kind==='windows-wsl'?!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(v.distribution):v.distribution!==null)fail('REMOTE_DISTRIBUTION_INVALID');
 if(v.kind.endsWith('docker')){if(!/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(v.image)||!Number.isInteger(v.uid)||v.uid<1||v.uid>65535||!Number.isInteger(v.gid)||v.gid<1||v.gid>65535)fail('REMOTE_CONTAINER_INVALID');}
 else if(v.image!==null||v.uid!==null||v.gid!==null)fail('REMOTE_DESCRIPTOR_INVALID');
 return structuredClone(v);
}
function createRemoteRuntime({directory,dialog,parentWindow,payloadManager,fileGrants,run}){
 const root=path.join(directory,'remote-runtimes');fs.mkdirSync(root,{recursive:true,mode:0o700});
 const file=path.join(root,'targets.json');let rows=[];const active=new Set(),authorized=new Set();let busy=false,closed=false;
 const helper=fs.readFileSync(path.join(__dirname,'remote-helper.py'),'utf8');const encoded=Buffer.from(helper).toString('base64');
 if(fs.existsSync(file)){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)fail('REMOTE_REGISTRY_INVALID');const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value.version!==1||!Array.isArray(value.targets)||value.targets.length>50)fail('REMOTE_REGISTRY_INVALID');rows=value.targets.map(row=>{if(!UUID.test(row.id)||typeof row.rootIdentity!=='string'||! /^[0-9]+:[0-9]+$/.test(row.rootIdentity))fail('REMOTE_REGISTRY_INVALID');return {id:row.id,descriptor:descriptor(row.descriptor),rootIdentity:row.rootIdentity};});}
 const save=()=>{const tmp=file+'.'+randomUUID();fs.writeFileSync(tmp,JSON.stringify({version:1,targets:rows}),{flag:'wx',mode:0o600});fs.renameSync(tmp,file);};
 const view=row=>({id:row.id,name:row.descriptor.name,kind:row.descriptor.kind,host:row.descriptor.host,port:row.descriptor.port,authorized:authorized.has(row.id)});
 const target=id=>{const row=rows.find(x=>x.id===id);if(!row)fail('REMOTE_TARGET_UNKNOWN');if(!authorized.has(id))fail('REMOTE_RECONNECT_REQUIRED');return row;};
 async function confirm(message){return (await dialog.showMessageBox(parentWindow,{type:'warning',title:'Remote Buildroot / 遠端 Buildroot',message,buttons:['Cancel / 取消','Continue / 繼續'],defaultId:0,cancelId:0,noLink:true})).response===1;}
 async function choose(title,directory=false){const result=await dialog.showOpenDialog(parentWindow,{title,properties:[directory?'openDirectory':'openFile','dontAddToRecent']});return result.canceled?null:result.filePaths[0]||null;}
 async function withFile(title,action){const selected=await choose(title);if(!selected)return {cancelled:true};const grant=fileGrants.importFile({path:selected,owner:'remote-runtime'});try{const granted=fileGrants.resolve({id:grant,owner:'remote-runtime'});return await action(granted.path,()=>fileGrants.resolve({id:grant,owner:'remote-runtime'}));}finally{fileGrants.revoke({id:grant,owner:'remote-runtime'});}}
 async function call(row,body){
  if(closed)fail('REMOTE_CLOSED');const d=row.descriptor,tool=await payloadManager.resolve('ssh');
  const hosts=path.join(root,row.id+'.known_hosts'),expected=`[${d.host}]:${d.port} ${d.hostKey}\n`;
  if(!fs.existsSync(hosts))fs.writeFileSync(hosts,expected,{flag:'wx',mode:0o600});
  if(fs.lstatSync(hosts).isSymbolicLink()||fs.readFileSync(hosts,'utf8')!==expected)fail('REMOTE_HOST_IDENTITY_CHANGED');
  const python=`python3 -I -c "import sys,json,base64,io;v=json.load(sys.stdin);sys.stdin=io.TextIOWrapper(io.BytesIO(json.dumps(v['request']).encode()));exec(base64.b64decode(v['script']))"`;
  const command=d.kind==='windows-wsl'?`wsl.exe --distribution ${d.distribution} --exec ${python}`:d.kind==='windows-docker'?python.replace(/^python3/,'python'):python;
  const args=['-F','none','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UpdateHostKeys=no','-o','GlobalKnownHostsFile=none','-o',`UserKnownHostsFile=${hosts}`,'-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','ConnectTimeout=15','-p',String(d.port),`${d.username}@${d.host}`,command];
  const process=run(tool.path,args,{timeoutMs:10*60*1000,maxBytes:48*1024*1024,inputPipe:true});active.add(process);
  try{if(!process.writeInput(JSON.stringify({script:encoded,request:{...body,root:d.root,kind:d.kind,rootIdentity:row.rootIdentity}})))fail('REMOTE_TRANSPORT_UNAVAILABLE');const result=await process.completion;if(result.state!=='succeeded')fail('REMOTE_OUTCOME_UNKNOWN');let value;try{value=JSON.parse(result.stdout);}catch{fail('REMOTE_RESPONSE_INVALID');}if(!value||value.code)fail('REMOTE_OUTCOME_UNKNOWN');return value;}finally{active.delete(process);}
 }
 const jobs=createJobManager({directory:path.join(root,'queue'),adapters:{'remote-build':async(payload,context)=>{
  const row=target(payload.targetId);context.checkpoint({remoteId:payload.id,targetId:payload.targetId,state:'dispatch-unconfirmed'});
  const response=await call(row,{...payload,action:'start',worker:encoded,uid:row.descriptor.uid,gid:row.descriptor.gid,image:row.descriptor.image});
  context.item({remoteId:payload.id,state:response.state});
  // Local dispatch completion is not remote build completion.
  return {state:'remote-dispatched',remoteId:payload.id,remoteState:response.state};
 }}});
 const recordsFile=path.join(root,'bindings.json');let bindings=[];
 if(fs.existsSync(recordsFile)){const s=fs.lstatSync(recordsFile);if(!s.isFile()||s.isSymbolicLink()||s.size>2*1024*1024)fail('REMOTE_BINDINGS_INVALID');bindings=JSON.parse(fs.readFileSync(recordsFile,'utf8'));if(!Array.isArray(bindings)||bindings.length>500||bindings.some(x=>!UUID.test(x.id)||!UUID.test(x.targetId)||!UUID.test(x.transferId)||!SHA.test(x.sourceDigest)||!['all','sdk','legal-info','source'].includes(x.target)||!Number.isInteger(x.parallelism)||x.parallelism<1||x.parallelism>32))fail('REMOTE_BINDINGS_INVALID');}
 const saveBindings=()=>{const tmp=recordsFile+'.'+randomUUID();fs.writeFileSync(tmp,JSON.stringify(bindings),{flag:'wx',mode:0o600});fs.renameSync(tmp,recordsFile);};
 const transfers=new Map();
 async function perform(q){
  if(!q||typeof q.action!=='string')fail('REMOTE_INVALID_REQUEST');
  const fields={list:[],enroll:[],reconnect:['targetId'],transfer:['targetId'],start:['targetId','transferId','target','parallelism'],observe:['id'],cancel:['id'],outputs:['id'],download:['id','name','sha256']};
  if(!Object.hasOwn(fields,q.action))fail('REMOTE_INVALID_REQUEST');exact(q,['action',...fields[q.action]]);
  for(const key of ['id','targetId','transferId'])if(Object.hasOwn(q,key)&&!UUID.test(q[key]))fail('REMOTE_INVALID_REQUEST');
  if(q.action==='list')return {targets:rows.map(view),jobs:bindings.map(x=>({...x,state:'observation-required'})),queue:jobs.list('remote-runtime')};
  if(busy)fail('REMOTE_BUSY');busy=true;
  try{
   if(q.action==='enroll')return await withFile('Choose remote target enrollment JSON / 選擇遠端目標設定 JSON',async(selected,recheck)=>{
    if(fs.statSync(selected).size>16384)fail('REMOTE_DESCRIPTOR_LIMIT');const d=descriptor(JSON.parse(fs.readFileSync(selected,'utf8')));recheck();
    if(rows.length>=50||rows.some(x=>x.descriptor.host===d.host&&x.descriptor.port===d.port&&x.descriptor.root===d.root&&x.descriptor.kind===d.kind))fail('REMOTE_DUPLICATE_TARGET');
    if(!await confirm(`Connect to ${d.username}@${d.host}:${d.port}, verify the supplied public host key and inspect ${d.kind}? Existing files are preserved. Trust this destination only after checking its host key independently.\n連接已指定目標並核對公鑰；請先獨立確認主機身份，現有檔案會保留。`))return {cancelled:true};
    const row={id:randomUUID(),descriptor:d,rootIdentity:''};const result=await call(row,{action:'inspect'});if(result.protocol!==1||result.kind!==d.kind||! /^[0-9]+:[0-9]+$/.test(result.rootIdentity))fail('REMOTE_ENROLLMENT_INVALID');row.rootIdentity=result.rootIdentity;rows.push(row);save();authorized.add(row.id);return view(row);
   });
   if(q.action==='reconnect'){const row=rows.find(x=>x.id===q.targetId);if(!row)fail('REMOTE_TARGET_UNKNOWN');if(!await confirm(`Reconnect to ${row.descriptor.name} using its pinned host identity?\n使用已鎖定主機身份重新連接？`))return {cancelled:true};const result=await call(row,{action:'inspect'});if(result.rootIdentity!==row.rootIdentity)fail('REMOTE_IDENTITY_CHANGED');authorized.add(row.id);return view(row);}
   if(q.action==='transfer'){const row=target(q.targetId);return await withFile('Choose trusted Buildroot source ZIP / 選擇可信 Buildroot 來源 ZIP',async(selected,recheck)=>{const stat=fs.statSync(selected);if(stat.size<1||stat.size>LIMIT)fail('REMOTE_TRANSFER_LIMIT');const bytes=fs.readFileSync(selected);recheck();if(!await confirm('Transfer this source ZIP to a new exclusive remote directory? Later builds execute its trusted Makefiles. Include a reviewed .config at the archive root.\n傳送來源 ZIP 到全新遠端目錄？日後建置會執行當中 Makefile，根目錄需包含已檢視嘅 .config。'))return {cancelled:true};const id=randomUUID(),sha256=hash(bytes);const result=await call(row,{action:'transfer',id,archive:bytes.toString('base64'),sha256});if(result.state!=='transferred'||result.id!==id||result.sha256!==sha256||!SHA.test(result.sourceDigest))fail('REMOTE_TRANSFER_UNKNOWN');transfers.set(id,{targetId:row.id,sourceDigest:result.sourceDigest});return result;});}
   if(q.action==='start'){
    const row=target(q.targetId),transfer=transfers.get(q.transferId);if(!transfer||transfer.targetId!==row.id||!['all','sdk','legal-info','source'].includes(q.target)||!Number.isInteger(q.parallelism)||q.parallelism<1||q.parallelism>32)fail('REMOTE_BUILD_INVALID');
    if(!await confirm(`Execute ${q.target} from the transferred source on ${row.descriptor.name} with ${q.parallelism} CPU slots? Source code may execute commands on this trusted target.\n喺可信遠端目標執行已傳送來源嘅建置？來源程式碼可執行指令。`))return {cancelled:true};
    if(bindings.length>=500)fail('REMOTE_HISTORY_FULL');const binding={id:randomUUID(),targetId:q.targetId,transferId:q.transferId,sourceDigest:transfer.sourceDigest,target:q.target,parallelism:q.parallelism};bindings.push(binding);saveBindings();
    const job=jobs.enqueue({kind:'remote-build',payload:binding,ownerId:'remote-runtime',operationId:binding.id});await jobs.run(job.id,'remote-runtime',job.sequence);return {...binding,state:'observation-required'};
   }
   const binding=bindings.find(x=>x.id===q.id);if(!binding)fail('REMOTE_JOB_UNKNOWN');const row=target(binding.targetId);
   if(q.action==='cancel'&&!await confirm('Request cancellation of this exact remote job? Acknowledgement is not proof that its processes have stopped.\n要求取消呢項遠端工作？收到要求並唔代表程序已停止。'))return {cancelled:true};
   if(q.action==='download'){
    if(!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,199}$/.test(q.name)||!SHA.test(q.sha256))fail('REMOTE_OUTPUT_INVALID');const outputs=await call(row,{...binding,action:'outputs'});const expected=outputs.files?.find(x=>x.name===q.name&&x.sha256===q.sha256);if(!expected||!Number.isSafeInteger(expected.bytes)||expected.bytes<0||expected.bytes>LIMIT)fail('REMOTE_OUTPUT_NOT_ADMITTED');
    const selected=await choose('Choose output destination / 選擇輸出位置',true);if(!selected)return {cancelled:true};const g=fileGrants.grant({path:selected,kind:'directory',access:'read-write',owner:'remote-runtime'});
    try{const directory=fileGrants.resolve({id:g,owner:'remote-runtime'}).path;const destination=fs.mkdtempSync(path.join(directory,'remote-output-'));const receipt=path.join(destination,'receipt.json');fs.writeFileSync(receipt,JSON.stringify({state:'incomplete',id:q.id,name:q.name,sha256:q.sha256}),{flag:'wx',mode:0o600});const result=await call(row,{...binding,action:'download',name:q.name,sha256:q.sha256});fileGrants.resolve({id:g,owner:'remote-runtime'});const bytes=Buffer.from(result.archive||'','base64');if(bytes.length!==expected.bytes||hash(bytes)!==q.sha256)fail('REMOTE_OUTPUT_DIGEST_MISMATCH');fs.writeFileSync(path.join(destination,q.name),bytes,{flag:'wx',mode:0o600});fs.writeFileSync(receipt,JSON.stringify({state:'verified',id:q.id,sourceDigest:binding.sourceDigest,name:q.name,sha256:q.sha256,bytes:bytes.length,executed:false}),{mode:0o600});return {state:'verified',destination,bytes:bytes.length,executed:false};}finally{fileGrants.revoke({id:g,owner:'remote-runtime'});}
   }
   return call(row,{...binding,action:q.action});
  }finally{busy=false;}
 }
 return {perform,dispose(){closed=true;authorized.clear();for(const process of active)process.cancel();},active:()=>busy};
}
module.exports={createRemoteRuntime,descriptor};


