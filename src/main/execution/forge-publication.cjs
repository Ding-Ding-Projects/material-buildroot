"use strict";
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {pipeline}=require('node:stream/promises');
const {Transform}=require('node:stream');
const storage=require('../jobs/storage.cjs');
const {createJobManager}=require('../jobs/manager.cjs');
const {hashFile}=require('../deployment/artifacts.cjs');
const {environment}=require('./setup-host.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const same=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs'].every(k=>a[k]===b[k]);
const fingerprint=s=>JSON.stringify([s.repository,s.sourceRepository,s.account.id,s.sourcePrivate,s.executionPrivate]);
class ForgePublication {
  constructor({directory,setup,viewer,manifest,dialog,parentWindow}) {
    this.root=storage.directory(directory);Object.assign(this,{setup,viewer,manifest,dialog,parentWindow});
    this.previews=new Map();this.active=new Set();this.connections=new Map();this.closed=false;this.busy=false;
    this.jobs=createJobManager({directory:path.join(this.root,'jobs'),adapters:{'forge-release':(p,c)=>this.publish(p,c)}});
  }
  list(){return this.jobs.list('forge').map(j=>({id:j.id,state:j.state,tag:j.payload.tag,repository:j.payload.repository,sourceRevision:j.payload.sourceRevision,sourceDigest:j.payload.manifest.locks.sourceRevision,assets:j.payload.assets.map(({name,size,sha256})=>({name,size,sha256})),checkpoint:j.checkpoint,result:j.result,createdAt:j.createdAt}));}
  async inspect({repository}) {
    const selected=await this.setup.inspect({sourceRepository:repository,executionRepository:repository,mode:'source'});
    if(!selected.sourcePrivate||!selected.executionPrivate) {this.setup.revoke(selected.selectionId);fail('FORGE_PRIVATE_DESTINATION_REQUIRED');}
    return selected;
  }
  async admission(selectionId,expected,revision) {
    const selected=this.setup.selected(selectionId);
    if(!selected.sourcePrivate||!selected.executionPrivate||selected.repository!==selected.sourceRepository||(expected&&fingerprint(selected)!==expected))fail('FORGE_SELECTION_CHANGED');
    const repo=await this.setup.call(selectionId,{suffix:''});
    if(repo.full_name!==selected.repository||repo.private!==true||repo.archived||repo.disabled||!repo.permissions?.push)fail('FORGE_PRIVATE_DESTINATION_REQUIRED');
    if(revision)await this.setup.sourceCommit(selectionId,revision);
    return selected;
  }
  async run(selectionId,args,signal,cwd) {
    await this.admission(selectionId);signal.throwIfAborted();
    const executable=await this.setup.host.executable();
    return new Promise((resolve,reject)=>{
      const child=spawn(executable,args,{cwd,shell:false,windowsHide:true,env:environment(),stdio:['ignore','pipe','ignore'],signal});
      let bytes=0;const chunks=[];
      child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>2097152)child.kill();else chunks.push(chunk);});
      child.once('error',()=>reject(Error('FORGE_CLI_UNAVAILABLE')));
      child.once('close',code=>code===0&&bytes<=2097152?resolve(Buffer.concat(chunks).toString('utf8')):reject(Error('FORGE_OPERATION_UNVERIFIED')));
    });
  }
  async api(selectionId,suffix,signal){const s=this.setup.selected(selectionId);return JSON.parse(await this.run(selectionId,['api','--hostname','github.com',`repos/${s.repository}${suffix}`],signal));}
  async lineage(selectionId,revision,signal) {
    const repo=await this.setup.call(selectionId,{suffix:''});
    if(typeof repo.default_branch!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_./-]{0,199}$/.test(repo.default_branch)||repo.default_branch.includes('..'))fail('FORGE_DEFAULT_BRANCH_INVALID');
    const head=await this.setup.call(selectionId,{suffix:`/commits/${encodeURIComponent(repo.default_branch)}`});
    if(!/^[a-f0-9]{40}$/.test(head.sha||''))fail('FORGE_SOURCE_INVALID');
    const compared=await this.api(selectionId,`/compare/${revision}...${head.sha}`,signal);
    if(!['ahead','identical'].includes(compared.status)||compared.merge_base_commit?.sha!==revision)fail('FORGE_MAIN_LINEAGE_REQUIRED');
    return head.sha;
  }
  async preview({selectionId,sourceRevision,fileIds,visibility}) {
    if(this.closed||this.busy||this.active.size)fail('FORGE_BUSY');
    if(visibility!=='private'||! /^[a-f0-9]{40}$/.test(sourceRevision||'')||!Array.isArray(fileIds)||fileIds.length<1||fileIds.length>16||new Set(fileIds).size!==fileIds.length)fail('FORGE_REQUEST_INVALID');
    this.busy=true;
    try {
      const selected=await this.admission(selectionId,null,sourceRevision),signal=AbortSignal.timeout(120000);
      const mainRevision=await this.lineage(selectionId,sourceRevision,signal);
      const assets=fileIds.map(fileId=>{const {file,current,grant}=this.viewer.resolve(fileId,'file');const name=path.basename(file);if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(name)||current.size<1||current.size>1024**3)fail('FORGE_ASSET_INVALID');return {fileId,relative:grant.relative,name,size:current.size};});
      if(new Set(assets.map(a=>a.name.toLowerCase())).size!==assets.length||assets.reduce((n,a)=>n+a.size,0)>1024**3)fail('FORGE_ASSET_LIMIT');
      const manifest=await this.manifest(assets.map(a=>a.relative));
      if(!manifest.provenance?.buildTimeBinding)fail('FORGE_BUILD_PROVENANCE_REQUIRED');
      for(const asset of assets){const entry=manifest.entries.find(e=>e.path===asset.relative);if(!entry||entry.size!==asset.size||! /^[a-f0-9]{64}$/.test(entry.sha256))fail('FORGE_ASSET_CHANGED');asset.sha256=entry.sha256;this.viewer.resolve(asset.fileId,'file');}
      for(const [id,p]of this.previews)if(p.expiresAt<Date.now())this.previews.delete(id);
      if(this.previews.size>=16)fail('FORGE_PREVIEW_LIMIT');
      const id=crypto.randomUUID(),tag=`build-${new Date().toISOString().replace(/[-:.]/g,'')}-${id}`;
      const p={id,selectionId,identity:fingerprint(selected),repository:selected.repository,accountId:selected.account.id,account:selected.account.login,sourceRevision,mainRevision,visibility,tag,manifest,assets,expiresAt:Date.now()+120000};
      this.previews.set(id,p);return {id,repository:p.repository,account:p.account,sourceRevision,mainRevision,sourceDigest:manifest.locks.sourceRevision,manifestDigest:manifest.digest,buildJobId:manifest.provenance.jobId,visibility,tag,assets:assets.map(({name,size,sha256})=>({name,size,sha256})),expiresAt:p.expiresAt};
    }finally{this.busy=false;}
  }
  async start({id,consent}) {
    if(consent!==true)fail('FORGE_CONFIRMATION_REQUIRED');if(this.busy||this.closed||this.active.size)fail('FORGE_BUSY');this.busy=true;
    try {
      const p=this.previews.get(id);if(!p||p.expiresAt<Date.now())fail('FORGE_PREVIEW_EXPIRED');this.previews.delete(id);
      const response=await this.dialog.showMessageBox(typeof this.parentWindow==='function'?this.parentWindow():this.parentWindow,{type:'warning',buttons:['Cancel / 取消','Publish new private release / 發佈新私人版本'],defaultId:0,cancelId:0,title:'Confirm release publication / 確認版本發佈',message:`${p.repository}\n${p.account}\n${p.tag}\n${p.sourceRevision}`,detail:`Private destination only / 只限私人目的地\n${p.assets.map(a=>`${a.name}: ${a.size} bytes, SHA-256 ${a.sha256}`).join('\n')}\nSource snapshot / 來源快照: ${p.manifest.locks.sourceRevision}\nThe tag revision and local source snapshot are separate identities. This does not claim they contain identical source. / 標籤修訂同本機來源快照係獨立識別，並不代表內容完全相同。\nCreates a normal release. Network transfer and charges may apply. No existing tag or asset is replaced. Cancellation may leave a partial release. / 建立正式版本，可能產生網絡傳輸同收費，唔會取代現有標籤或資產，取消後可能保留部分發佈。`});
      if(response.response!==1)return {state:'cancelled'};
      if(this.closed||p.expiresAt<Date.now())fail('FORGE_PREVIEW_EXPIRED');
      await this.admission(p.selectionId,p.identity,p.sourceRevision);
      const fresh=await this.manifest(p.assets.map(a=>a.relative));
      if(fresh.digest!==p.manifest.digest||!fresh.provenance?.buildTimeBinding||fresh.provenance.receiptDigest!==p.manifest.provenance.receiptDigest)fail('FORGE_SOURCE_CHANGED');
      const folder=storage.directory(path.join(this.root,'snapshots',p.id));
      for(const asset of p.assets){
        const {file,current}=this.viewer.resolve(asset.fileId,'file'),fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
        try{if(!same(current,fs.fstatSync(fd)))fail('FORGE_ASSET_CHANGED');let bytes=0;const hash=crypto.createHash('sha256');
          const meter=new Transform({transform(chunk,encoding,callback){bytes+=chunk.length;if(bytes>asset.size)return callback(Error('FORGE_ASSET_CHANGED'));hash.update(chunk);callback(null,chunk);}});
          await pipeline(fs.createReadStream(file,{fd,autoClose:false}),meter,fs.createWriteStream(path.join(folder,asset.name),{flags:'wx',mode:0o600}));
          if(bytes!==asset.size||hash.digest('hex')!==asset.sha256||!same(current,fs.fstatSync(fd)))fail('FORGE_ASSET_CHANGED');
        }finally{fs.closeSync(fd);}
      }
      if(this.closed)fail('FORGE_CLOSED');
      const {selectionId,identity,expiresAt,...payload}=p;payload.folder=folder;payload.assets=payload.assets.map(({fileId,...asset})=>asset);
      const job=this.jobs.enqueue({kind:'forge-release',ownerId:'forge',payload});this.connections.set(job.id,{selectionId,identity});this.launch(job);return {id:job.id,state:'queued'};
    }finally{this.busy=false;}
  }
  launch(job){this.active.add(job.id);void this.jobs.run(job.id,'forge',job.sequence).catch(()=>{}).finally(()=>this.active.delete(job.id));}
  cancel(id){const j=this.jobs.get(id,'forge');const next=this.jobs.cancel(id,'forge',j.sequence);return {id:next.id,state:next.state};}
  async readback({id,selectionId,consent}) {
    if(consent!==true)fail('FORGE_CONFIRMATION_REQUIRED');if(this.busy||this.closed||this.active.size)fail('FORGE_BUSY');this.busy=true;
    try {const j=this.jobs.get(id,'forge'),s=await this.admission(selectionId);
      if(s.repository!==j.payload.repository||s.account.id!==j.payload.accountId)fail('FORGE_SELECTION_CHANGED');
      const result=await this.dialog.showMessageBox(typeof this.parentWindow==='function'?this.parentWindow():this.parentWindow,{type:'question',buttons:['Cancel / 取消','Read retained release / 讀回保留版本'],defaultId:0,cancelId:0,message:`${j.payload.repository}\n${j.payload.tag}`,detail:'Read only. This never creates, uploads, overwrites or deletes a release. / 只供讀取，唔會建立、上載、取代或刪除發佈。'});
      if(result.response!==1)return {state:'cancelled'};const next=this.jobs.retry(id,'forge',j.sequence);this.connections.set(next.id,{selectionId,identity:fingerprint(s)});this.launch(next);return {id:next.id,state:'queued'};
    }finally{this.busy=false;}
  }
  async verifyTag(selectionId,p,signal) {
    let ref=await this.api(selectionId,`/git/ref/tags/${encodeURIComponent(p.tag)}`,signal),object=ref.object;const seen=new Set();
    for(let depth=0;depth<8;depth++){if(object?.type==='commit'&&object.sha===p.sourceRevision)return;if(object?.type!=='tag'||! /^[a-f0-9]{40}$/.test(object.sha||'')||seen.has(object.sha))fail('FORGE_TAG_UNVERIFIED');seen.add(object.sha);object=(await this.api(selectionId,`/git/tags/${object.sha}`,signal)).object;}
    fail('FORGE_TAG_UNVERIFIED');
  }
  async publish(p,context) {
    let stage='admission';const signal=AbortSignal.any([context.signal,AbortSignal.timeout(600000)]);
    try {
      const connection=this.connections.get(context.jobId);if(!connection)fail('FORGE_RECONNECT_REQUIRED');const {selectionId,identity}=connection;
      await this.admission(selectionId,identity,p.sourceRevision);await this.lineage(selectionId,p.sourceRevision,signal);
      const job=this.jobs.get(context.jobId,'forge');
      if(!job.retryOf){
        for(const asset of p.assets){const file=path.join(p.folder,asset.name);storage.assertSafe(file);if(fs.statSync(file).size!==asset.size||await hashFile(file)!==asset.sha256)fail('FORGE_SNAPSHOT_CHANGED');}
        // Matching refs can be empty without confusing authentication failures with absence.
        const refs=await this.api(selectionId,`/git/matching-refs/tags/${encodeURIComponent(p.tag)}`,signal);
        if(!Array.isArray(refs)||refs.length)fail('FORGE_TAG_OCCUPIED');
        const notes=path.join(storage.directory(path.join(p.folder,'metadata')),'publication-notes.txt');
        fs.writeFileSync(notes,`Build outputs\n\nRelease target commit: ${p.sourceRevision}\nLocal source snapshot SHA-256: ${p.manifest.locks.sourceRevision}\nOutput manifest SHA-256: ${p.manifest.digest}\nBuild provenance: ${p.manifest.provenance.jobId}\n\nThe remote commit and local source snapshot are separate identities; their source equivalence is not asserted.\n\n${p.assets.map(a=>`${a.name}: ${a.size} bytes; SHA-256 ${a.sha256}`).join('\n')}\n`,{flag:'wx',mode:0o600});
        stage='publication';context.checkpoint({stage,state:'writing',partial:'retained-if-created'});
        await this.run(selectionId,['release','create',p.tag,...p.assets.map(a=>path.join(p.folder,a.name)),'--repo',p.repository,'--target',p.sourceRevision,'--title',p.tag,'--notes-file',notes],signal,p.folder);
      }
      stage='readback';context.checkpoint({stage,state:'verifying',partial:'retained'});
      await this.verifyTag(selectionId,p,signal);
      const release=await this.api(selectionId,`/releases/tags/${encodeURIComponent(p.tag)}`,signal);
      if(release.draft!==false||release.prerelease!==false||release.tag_name!==p.tag||!Array.isArray(release.assets)||release.assets.length!==p.assets.length)fail('FORGE_RELEASE_UNVERIFIED');
      for(const asset of p.assets){const matches=release.assets.filter(a=>a.name===asset.name);if(matches.length!==1||matches[0].size!==asset.size||!matches[0].browser_download_url?.startsWith(`https://github.com/${p.repository}/releases/download/`))fail('FORGE_ASSET_UNVERIFIED');}
      const destination=fs.mkdtempSync(path.join(p.folder,'readback-'));
      await this.run(selectionId,['release','download',p.tag,'--repo',p.repository,'--dir',destination,...p.assets.flatMap(a=>['--pattern',a.name])],signal,p.folder);
      for(const asset of p.assets){const file=path.join(destination,asset.name);storage.assertSafe(file);if(fs.statSync(file).size!==asset.size||await hashFile(file)!==asset.sha256)fail('FORGE_READBACK_MISMATCH');}
      const finalRelease=await this.api(selectionId,`/releases/tags/${encodeURIComponent(p.tag)}`,signal);
      if(finalRelease.id!==release.id||finalRelease.draft!==false||finalRelease.prerelease!==false||finalRelease.tag_name!==p.tag||!Array.isArray(finalRelease.assets)||finalRelease.assets.length!==p.assets.length||!release.assets.every(a=>finalRelease.assets.some(b=>b.id===a.id&&b.name===a.name&&b.size===a.size)))fail('FORGE_RELEASE_CHANGED');
      await this.verifyTag(selectionId,p,signal);await this.admission(selectionId,identity,p.sourceRevision);signal.throwIfAborted();
      context.checkpoint({stage:'complete',state:'verified',partial:'none'});
      return {state:'verified',verifiedAt:new Date().toISOString(),tag:p.tag,sourceRevision:p.sourceRevision,manifestDigest:p.manifest.digest,assets:p.assets.map(({name,size,sha256})=>({name,size,sha256}))};
    }catch(error){context.checkpoint({stage,state:signal.aborted?'cancelled-or-timeout':'unverified',partial:'retained-if-created',code:/^FORGE_[A-Z_]+$/.test(error.code||'')?error.code:'FORGE_PUBLICATION_UNVERIFIED'});throw Error('Release publication remains unverified; any partial publication is retained.');}
    finally{this.connections.delete(context.jobId);}
  }
  dispose(){this.closed=true;this.previews.clear();for(const id of this.active){const job=this.jobs.get(id,'forge');if(['queued','running'].includes(job.state))this.cancel(id);}}
}
module.exports={ForgePublication};
