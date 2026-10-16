"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {pipeline}=require("node:stream/promises");
const {Transform}=require("node:stream");
const storage=require("../jobs/storage.cjs");
const {createJobManager}=require("../jobs/manager.cjs");
const {hashFile}=require("./artifacts.cjs");
const {credentials,provider,github}=require("./cloud-providers.cjs");
const fail=code=>{throw Object.assign(new Error(code),{code});};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const same=(a,b)=>["dev","ino","size","mtimeMs","ctimeMs"].every(k=>a[k]===b[k]);
function profile(input) {
  if(!input||Object.getPrototypeOf(input)!==Object.prototype||!["s3","azure","gcs","github"].includes(input.provider))fail("CLOUD_PROFILE_INVALID");
  const keys={s3:["endpoint","bucket","region","prefix"],azure:["account","container","prefix"],gcs:["bucket","prefix"],github:["repository","tag"]}[input.provider];
  if(Object.keys(input).some(k=>!["provider","label",...keys].includes(k))||typeof input.label!=="string"||!input.label.trim()||input.label.length>80||/[\x00-\x1f]/.test(input.label))fail("CLOUD_PROFILE_INVALID");
  const out={provider:input.provider,label:input.label};
  for(const key of keys){if(typeof input[key]!=="string"||input[key].length>256||/[\x00-\x20\\?#%]/.test(input[key]))fail("CLOUD_PROFILE_INVALID");out[key]=input[key];}
  if(input.provider!=="github") {
    if(!out.prefix||!/^([A-Za-z0-9_-]+\/)+$/.test(out.prefix))fail("CLOUD_PREFIX_REQUIRED");
    if(out.bucket&&!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(out.bucket))fail("CLOUD_PROFILE_INVALID");
  }
  if(out.provider==="s3") {let u;try{u=new URL(out.endpoint);}catch{fail("CLOUD_ENDPOINT_INVALID");}if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash||u.port||! /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(u.hostname)||u.hostname.endsWith(".localhost")||! /^[a-z0-9-]{1,40}$/.test(out.region))fail("CLOUD_ENDPOINT_INVALID");out.endpoint=u.origin;}
  if(out.provider==="azure"&&(!/^[a-z0-9]{3,24}$/.test(out.account)||! /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(out.container)))fail("CLOUD_PROFILE_INVALID");
  if(out.provider==="github"&&(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(out.repository)||! /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(out.tag)))fail("CLOUD_PROFILE_INVALID");
  return out;
}
class CloudDestinations {
  constructor({directory,vault,viewer,dialog,parentWindow,resolveGh}) {
    this.root=storage.directory(directory);this.vault=vault;this.viewer=viewer;this.dialog=dialog;this.parentWindow=parentWindow;this.resolveGh=resolveGh;
    this.profileFile=path.join(this.root,"destinations.json");this.profiles=[];this.previews=new Map();this.active=new Set();this.closed=false;this.importing=false;
    if(fs.existsSync(this.profileFile)) {const data=storage.read(this.profileFile);if(data.version!==1||!Array.isArray(data.profiles)||data.profiles.length>32)fail("CLOUD_STORAGE_INVALID");this.profiles=data.profiles.map(p=>{if(!uuid.test(p.id)||!/^vault:[0-9a-f-]{36}$/.test(p.credentialRef))fail("CLOUD_STORAGE_INVALID");const {id,credentialRef,...publicProfile}=p;return {...profile(publicProfile),id,credentialRef};});}
    this.jobs=createJobManager({directory:path.join(this.root,"jobs"),adapters:{"cloud-upload":(payload,context)=>this.transfer(payload,context)}});
  }
  list(){return {profiles:this.profiles.map(({credentialRef,...p})=>p),jobs:this.jobs.list("cloud").map(j=>({id:j.id,state:j.state,sequence:j.sequence,createdAt:j.createdAt,updatedAt:j.updatedAt,destinationId:j.payload.destinationId,object:j.payload.object,sha256:j.payload.sha256,size:j.payload.size,retryOf:j.retryOf,checkpoint:j.checkpoint,result:j.result})),credentialStorage:this.vault?.availability().available===true};}
  destination(id){const p=this.profiles.find(p=>p.id===id);if(!p)fail("CLOUD_PROFILE_NOT_FOUND");return p;}
  async importProfile(){
    if(this.importing||this.closed)fail("CLOUD_BUSY");this.importing=true;
    try {
      if(!this.vault?.availability().available)fail("CLOUD_VAULT_UNAVAILABLE");
      if(this.profiles.length>=32)fail("CLOUD_PROFILE_LIMIT");
      const choice=await this.dialog.showOpenDialog(this.parentWindow,{title:"Import a destination profile and scoped credential",properties:["openFile","dontAddToRecent"],filters:[{name:"Destination enrollment",extensions:["json"]}]});
      if(choice.canceled||choice.filePaths.length!==1)return {state:"cancelled"};
      const file=choice.filePaths[0],stat=fs.lstatSync(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.size>32768||fs.realpathSync(file)!==file)fail("CLOUD_ENROLLMENT_INVALID");
      const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));let enrollment;
      try{if(!same(stat,fs.fstatSync(fd)))fail("CLOUD_ENROLLMENT_CHANGED");enrollment=JSON.parse(fs.readFileSync(fd,"utf8"));if(!same(stat,fs.fstatSync(fd)))fail("CLOUD_ENROLLMENT_CHANGED");}finally{fs.closeSync(fd);}
      if(!enrollment||enrollment.version!==1||Object.keys(enrollment).sort().join()!=="credential,profile,version")fail("CLOUD_ENROLLMENT_INVALID");
      const p=profile(enrollment.profile),secret=enrollment.credential;
      if(!secret||Object.getPrototypeOf(secret)!==Object.prototype)fail("CLOUD_CREDENTIAL_INVALID");
      const allowed=p.provider==="s3"?["accessKeyId","secretAccessKey","sessionToken"]:["accessToken"];
      if(Object.keys(secret).some(k=>!allowed.includes(k))||Object.values(secret).some(v=>typeof v!=="string"||!v||v.length>16384||/[\r\n]/.test(v))||(p.provider==="s3"?(!secret.accessKeyId||!secret.secretAccessKey):!secret.accessToken))fail("CLOUD_CREDENTIAL_INVALID");
      const response=await this.dialog.showMessageBox(this.parentWindow,{type:"warning",buttons:["Cancel","Save private destination"],defaultId:0,cancelId:0,title:"Review destination scope",message:`${p.label}\n${p.provider}\n${p.endpoint||p.account||p.repository||p.bucket}\n${p.bucket||p.container||p.tag}\n${p.prefix||"Existing release only"}`,detail:"This stores the credential in encrypted local storage. It performs no network request. Uploads require a separate exact-file preview and private destination readback. The input file is not deleted."});
      if(response.response!==1)return {state:"cancelled"};
      const id=crypto.randomUUID(),credentialRef=this.vault.write(`cloud_${id}`,JSON.stringify(secret));
      const next=[...this.profiles,{...p,id,credentialRef}];storage.atomic(this.profileFile,{version:1,profiles:next});this.profiles=next;
      return {state:"saved",id};
    }catch(error){if(/^CLOUD_/.test(error.code||""))throw error;fail("CLOUD_ENROLLMENT_INVALID");}finally{this.importing=false;}
  }
  remove(id){if(this.active.size)fail("CLOUD_BUSY");this.destination(id);const next=this.profiles.filter(p=>p.id!==id);storage.atomic(this.profileFile,{version:1,profiles:next});this.profiles=next;for(const [key,p]of this.previews)if(p.destinationId===id)this.previews.delete(key);return {state:"removed"};}
  async preview({fileId,destinationId}) {
    if(this.closed||this.active.size)fail("CLOUD_BUSY");const p=this.destination(destinationId),{file,current,grant}=this.viewer.resolve(fileId,"file");
    if(current.size<1||current.size>1024**3)fail("CLOUD_FILE_SIZE_LIMIT");
    const name=path.basename(file);if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(name))fail("CLOUD_FILE_NAME_INVALID");
    const sha256=await hashFile(file);this.viewer.resolve(fileId,"file");
    const id=crypto.randomUUID(),object=p.provider==="github"?`${id}-${name}`:`${p.prefix}${id}/${name}`;
    const record={id,fileId,destinationId,object,sha256,size:current.size,relative:grant.relative,expiresAt:Date.now()+120000};
    for(const [key,pending]of this.previews)if(pending.expiresAt<Date.now())this.previews.delete(key);
    if(this.previews.size>=32)fail("CLOUD_PREVIEW_LIMIT");this.previews.set(id,record);
    return {...record,fileId:undefined,destination:{provider:p.provider,label:p.label,scope:p.endpoint||p.account||p.repository||"storage.googleapis.com",bucket:p.bucket||p.container||p.tag,visibility:"private-required"},overwrite:false,networkState:"not-contacted"};
  }
  async start(request) {if(this.starting)fail("CLOUD_BUSY");this.starting=true;try{return await this.startUpload(request);}finally{this.starting=false;}}
  async startUpload({id,consent}) {
    if(consent!==true)fail("CLOUD_CONSENT_REQUIRED");if(this.closed||this.active.size)fail("CLOUD_BUSY");
    const preview=this.previews.get(id);if(!preview||preview.expiresAt<Date.now())fail("CLOUD_PREVIEW_EXPIRED");this.previews.delete(id);
    const p=this.destination(preview.destinationId),{file,current}=this.viewer.resolve(preview.fileId,"file");
    const answer=await this.dialog.showMessageBox(this.parentWindow,{type:"warning",buttons:["Cancel","Upload exact file"],defaultId:0,cancelId:0,title:"Confirm external upload",message:`${preview.relative}\n${preview.size} bytes\nSHA-256: ${preview.sha256}`,detail:`Destination: ${p.label} (${p.provider})\nScope: ${p.endpoint||p.account||p.repository||p.bucket}\nContainer: ${p.bucket||p.container||p.tag}\nObject: ${preview.object}\nPrivate access must be verified. No existing object is replaced. Network transfer and provider charges may apply.`});
    if(answer.response!==1)return {state:"cancelled"};
    if(preview.expiresAt<Date.now()||this.active.size)fail("CLOUD_PREVIEW_EXPIRED");
    const folder=storage.directory(path.join(this.root,"transfers",crypto.randomUUID())),snapshot=path.join(folder,p.provider==="github"?preview.object:path.basename(file));
    const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
    try{
      if(!same(current,fs.fstatSync(fd)))fail("CLOUD_FILE_CHANGED");let bytes=0;const hash=crypto.createHash("sha256");
      const meter=new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;if(bytes>preview.size)return callback(new Error("CLOUD_FILE_CHANGED"));hash.update(chunk);callback(null,chunk);}});
      await pipeline(fs.createReadStream(file,{fd,autoClose:false}),meter,fs.createWriteStream(snapshot,{flags:"wx",mode:0o600}));
      if(bytes!==preview.size||hash.digest("hex")!==preview.sha256||!same(current,fs.fstatSync(fd)))fail("CLOUD_FILE_CHANGED");
    }finally{fs.closeSync(fd);}
    const job=this.jobs.enqueue({kind:"cloud-upload",ownerId:"cloud",payload:{destinationId:p.id,object:preview.object,sha256:preview.sha256,size:preview.size,snapshot,folder}});this.launch(job);return {id:job.id,state:"queued"};
  }
  launch(job){this.active.add(job.id);void this.jobs.run(job.id,"cloud",job.sequence).catch(()=>{}).finally(()=>this.active.delete(job.id));}
  cancel(id){const job=this.jobs.get(id,"cloud"),result=this.jobs.cancel(id,"cloud",job.sequence);return {id:result.id,state:result.state};}
  async retry({id,consent}){if(consent!==true)fail("CLOUD_CONSENT_REQUIRED");if(this.closed||this.active.size)fail("CLOUD_BUSY");const job=this.jobs.get(id,"cloud");this.destination(job.payload.destinationId);const answer=await this.dialog.showMessageBox(this.parentWindow,{type:"warning",buttons:["Cancel","Verify retained object"],defaultId:0,cancelId:0,title:"Retry cloud readback",message:job.payload.object,detail:"This retry reads the exact retained object and compares its bytes. It never uploads again or replaces an object. For a missing object, create a new upload preview."});if(answer.response!==1)return {state:"cancelled"};const next=this.jobs.retry(id,"cloud",job.sequence);this.launch(next);return {id:next.id,state:"queued"};}
  async transfer(payload,context){
    const signal=AbortSignal.any([context.signal,AbortSignal.timeout(600000)]);let stage="admission";
    try {
      const p=this.destination(payload.destinationId),secret=credentials(p,this.vault);
      const adapter=p.provider==="github"?github(p,secret,signal,await this.resolveGh(),payload.folder):provider(p,secret,signal);
      context.checkpoint({stage,state:"checking-private-scope",partial:"retained-if-created"});await adapter.privateScope();signal.throwIfAborted();
      const job=this.jobs.get(context.jobId,"cloud");
      if(!job.retryOf){storage.assertSafe(payload.snapshot);if(fs.statSync(payload.snapshot).size!==payload.size||await hashFile(payload.snapshot)!==payload.sha256)fail("CLOUD_SNAPSHOT_CHANGED");stage="upload";context.checkpoint({stage,state:"uploading",partial:"retained-if-created"});await adapter.put(payload.object,payload.snapshot,payload.sha256,payload.size);}
      stage="readback";context.checkpoint({stage,state:"verifying",partial:"retained"});
      const verified=await adapter.readback(payload.object,payload.sha256,payload.size);await adapter.privateScope();signal.throwIfAborted();
      context.checkpoint({stage:"complete",state:"verified",partial:"none"});return {state:"verified",object:payload.object,...verified,verifiedAt:new Date().toISOString()};
    }catch(error){context.checkpoint({stage,state:context.signal.aborted?"cancelled":signal.aborted?"timeout":"unverified",partial:"retained-if-created",code:/^CLOUD_[A-Z_]+$/.test(error.code||"")?error.code:"CLOUD_TRANSFER_UNVERIFIED"});throw new Error("Cloud transfer remains unverified.");}
  }
  dispose(){this.closed=true;this.previews.clear();for(const id of this.active){const job=this.jobs.get(id,"cloud");if(job.state==="running")this.jobs.cancel(id,"cloud",job.sequence);}}
}
module.exports={CloudDestinations};
