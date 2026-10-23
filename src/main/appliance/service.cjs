"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { validateSpec, fail } = require('./contract.cjs');
const { inspectComposeInput } = require('./compose-input.cjs');
const {validateFailure,parseFailure}=require('./failure-diagnostic.cjs');
const { createToolFiles } = require('../security/tool-files.cjs');
const { inspectCanonicalPath } = require('../security/file-grants.cjs');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const PHASES = new Set(['preparing', 'source', 'configuring', 'building', 'packaging', 'complete']);
function linuxPath(value) {
  if (!/^[A-Za-z]:\\/.test(value) || /[\r\n\0]/.test(value)) fail('APPLIANCE_PATH_UNSUPPORTED');
  return '/mnt/' + value[0].toLowerCase() + value.slice(2).replaceAll('\\', '/');
}
async function fileDigest(file) {
  inspectCanonicalPath(file);
  const digest = createHash('sha256');
  const before = fs.statSync(file, { bigint: true });
  if (!before.isFile()) fail('UNSAFE_PATH');
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  const after = fs.statSync(file, { bigint: true });
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs) fail('APPLIANCE_INPUT_CHANGED');
  return { sha256: digest.digest('hex'), size: Number(after.size) };
}
function createApplianceService({ directory, dialog, parentWindow, run, wslExecutable, scriptDirectory, downloadsDirectory }) {
  const files = createToolFiles({ dialog, parentWindow, purpose: 'external-tree' });
  const previews = new Map(), jobs = new Map(), preparedArchives = new Map();
  const preparation = require('./preparation.cjs').createPreparationService({directory,dialog,parentWindow,run,wslExecutable,scriptDirectory,linuxPath,fileDigest,grantArchive:(archive,identity)=>{const id=randomUUID();preparedArchives.set(id,{archive,identity});return {id,name:path.basename(archive),kind:'file'};}});
  let closed = false, admitting = false;
  const root = path.join(directory, 'appliance');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  function state(job) {
    return { id: job.id, state: job.state, sequence: job.sequence, privateArtifact: job.privateArtifact === true,
      logs: [...job.logs], ...(job.diagnosticStatus?{diagnosticStatus:job.diagnosticStatus}:{}), ...(job.diagnostic?{diagnostic:{...job.diagnostic}}:{}), ...(job.verification ? {verification:{...job.verification}} : {}), ...(job.code ? { code: job.code } : {}),
      ...(job.outputName ? { outputName: job.outputName } : {}) };
  }
  function persist(job) {
    const stored = { ...state(job), schemaVersion: 1, sha256: job.sha256, size: job.size, distribution: job.distribution };
    const target = path.join(job.folder, 'job.json'), temporary = target + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(stored), { mode: 0o600 });
    fs.renameSync(temporary, target);
  }
  for (const id of fs.readdirSync(root).filter(name => UUID.test(name)).slice(0, 32)) {
    const folder = path.join(root, id), record = path.join(folder, 'job.json');
    try {
      inspectCanonicalPath(record);
      if (fs.statSync(record).size > 131072) continue;
      const stored = JSON.parse(fs.readFileSync(record, 'utf8'));
      if (stored.schemaVersion !== 1 || stored.id !== id || !Array.isArray(stored.logs)) continue;
      const interrupted = ['running', 'cancelling'].includes(stored.state);
      const job = { ...stored, folder, outputDirectory: path.join(folder, 'output'),
        state: interrupted ? 'interrupted' : stored.state,
        verification: stored.verification?.state==='pending' ? {state:'unverified',bootVerified:false,code:'APPLIANCE_VERIFICATION_INTERRUPTED'} : stored.verification,
        logs: stored.logs.filter(line => typeof line === 'string' && /^Phase: (preparing|source|configuring|building|packaging|complete)$/.test(line)).slice(-200),
        ...(interrupted ? { code: 'APPLIANCE_RESTART_RECONCILIATION_REQUIRED' } : {}) };
      if (job.outputName && (path.basename(job.outputName) !== job.outputName || !/^[a-z0-9-]+\.iso$/.test(job.outputName))) continue;
      job.diagnostic=validateFailure(stored.diagnostic);
      job.diagnosticStatus=job.diagnostic?'available':['unavailable','invalid'].includes(stored.diagnosticStatus)?stored.diagnosticStatus:undefined;
      jobs.set(id, job); persist(job);
    } catch { /* Corrupt records never grant execution or output authority. */ }
  }
  const get = id => { const job = jobs.get(id); if (!job) fail('APPLIANCE_JOB_NOT_FOUND'); return job; };
  async function wslRun(distribution, args, options = {}) {
    if (typeof wslExecutable !== 'string' || !wslExecutable) fail('WSL_UNAVAILABLE');
    return run(wslExecutable, ['--distribution', distribution, '--exec', ...args], { timeoutMs: 15000, maxBytes: 65536, ...options }).completion;
  }
  async function verifyUser(distribution) {
    const result = await wslRun(distribution, ['id', '-u']);
    if (result.state !== 'succeeded' || !/^[1-9][0-9]*\s*$/.test(result.stdout || '')) fail('APPLIANCE_NON_ROOT_WSL_REQUIRED');
  }
  async function inspect(spec) {
    const selected = {}, identity = {}; let composeReview;
    if (spec.source.kind === 'archive') {
      const prepared=preparedArchives.get(spec.source.fileId);
      selected.archivePath = prepared?prepared.archive:files.resolve(spec.source.fileId, 'read');
      if(prepared&&JSON.stringify(await fileDigest(prepared.archive))!==JSON.stringify(prepared.identity))fail('APPLIANCE_INPUT_CHANGED');
      if (!/\.(tar|tar\.gz|tgz)$/i.test(selected.archivePath)) fail('INVALID_IMAGE_ARCHIVE');
      identity.archive = await fileDigest(selected.archivePath);
    }
    if(spec.source.kind==='prepared'){
      const bundle=await preparation.resolveBundle(spec.source.bundleId);
      selected.archivePath=bundle.archivePath;selected.composePath=bundle.composePath;selected.preparedManifestPath=bundle.preparedManifestPath;
      identity.archive=bundle.archive;identity.compose=bundle.bundleFiles.map(item=>({...item,path:item.path.split('/').join(path.sep)}));identity.preparedManifest=await fileDigest(bundle.preparedManifestPath);
    }
    if (spec.source.kind === 'compose') {
      selected.composePath = files.resolve(spec.source.directoryId, 'read');
      if (!fs.lstatSync(selected.composePath).isDirectory()) fail('INVALID_COMPOSE_PROJECT');
      const manifest=inspectComposeInput(selected.composePath);
      identity.compose=[{path:manifest.name,...await fileDigest(manifest.file)}];composeReview=manifest.services;
    }
    if (spec.wordingFileId) {
      selected.wordingPath = files.resolve(spec.wordingFileId, 'read');
      if (fs.statSync(selected.wordingPath).size > 256*1024) fail('INVALID_WORDING_FILE');
      const { parseVocabularyBytes } = await import('../../shared/personal-vocabulary.mjs');
      parseVocabularyBytes(fs.readFileSync(selected.wordingPath));
      identity.wording = await fileDigest(selected.wordingPath);
    }
    return { selected, identity, composeReview };
  }
  async function stageInputs(selected, expected, folder) {
    const staged = {};
    for (const [key, source] of Object.entries(selected)) {
      if (key === 'composePath') {
        const target = path.join(folder, 'compose'); fs.mkdirSync(target, { mode: 0o700 });
        for (const item of expected.compose) {
          const destination = path.join(target, item.path); fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
          fs.copyFileSync(path.join(source, item.path), destination, fs.constants.COPYFILE_EXCL);
        }
        if(expected.preparedManifest){for(const item of expected.compose){const actual=await fileDigest(path.join(target,item.path));if(actual.sha256!==item.sha256||actual.size!==item.size)fail('APPLIANCE_INPUT_CHANGED');}}else{const manifest=inspectComposeInput(target);if (JSON.stringify([{path:manifest.name,...await fileDigest(manifest.file)}]) !== JSON.stringify(expected.compose)) fail('APPLIANCE_INPUT_CHANGED');}
        staged[key] = target;
      } else {
        const target = path.join(folder, key === 'wordingPath' ? 'personal-wording.json' : key==='preparedManifestPath'?'prepared-manifest.json':'image.tar');
        fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
        if (JSON.stringify(await fileDigest(target)) !== JSON.stringify(expected[key === 'wordingPath' ? 'wording' : key==='preparedManifestPath'?'preparedManifest':'archive'])) fail('APPLIANCE_INPUT_CHANGED');
        staged[key] = target;
      }
    }
    return staged;
  }
  async function verifyOutput(job) {
    const output = path.join(job.outputDirectory, job.outputName);
    const actual = await fileDigest(output);
    if (actual.sha256 !== job.sha256 || actual.size !== job.size) fail('APPLIANCE_OUTPUT_CHANGED');
    return output;
  }
  function readFailure(job) {
    const file=path.join(job.outputDirectory,'failure.json');
    job.diagnostic=null;job.diagnosticStatus='unavailable';
    try {
      if(!fs.existsSync(file))return;
      inspectCanonicalPath(file);
      const info=fs.statSync(file);
      if(!info.isFile()||info.size===0||info.size>1024){job.diagnosticStatus='invalid';return;}
      job.diagnostic=parseFailure(fs.readFileSync(file));job.diagnosticStatus=job.diagnostic?'available':'invalid';
    } catch {job.diagnosticStatus='invalid';}
  }
  async function control(job, action) {
    const result = await wslRun(job.distribution, ['python3', linuxPath(path.join(scriptDirectory,'control-appliance.py')), '--receipt', linuxPath(path.join(job.outputDirectory,'process.json')), '--action', action]);
    if (result.state !== 'succeeded') return { state: 'unverified' };
    try { return JSON.parse(result.stdout); } catch { return { state: 'unverified' }; }
  }
  async function cancelVerification(job) {
    if(!job.verificationActive&&job.verification?.code!=='APPLIANCE_VERIFICATION_CLEANUP_UNVERIFIED')return;
    job.verificationCancelledEpoch=job.verificationEpoch;
    let stopped=false;
    try {
      const result=await wslRun(job.distribution,['python3',linuxPath(path.join(scriptDirectory,'control-appliance.py')),'--receipt',linuxPath(path.join(job.verificationDirectory,'process.json')),'--action','cancel']);
      stopped=result.state==='succeeded'&&JSON.parse(result.stdout).state==='verified-stopped';
    } catch {}
    if(stopped){await job.verificationHandle?.cancel();await job.verificationPromise;}
    job.verification={state:'unverified',bootVerified:false,code:stopped?'CANCELLED':'APPLIANCE_VERIFICATION_CLEANUP_UNVERIFIED',cleanupVerified:stopped};
    job.sequence++;persist(job);
  }
  return {
    prepare: preparation,
    async choose(kind) {
      if (closed) fail('UNAVAILABLE');
      if (!['archive','compose','wording'].includes(kind)) fail('INVALID_REQUEST');
      const choice=await files.choose({ access: 'read', kind: kind === 'compose' ? 'directory' : 'file' });
      if(kind==='wording'){try{const selected=files.resolve(choice.id,'read');if(fs.statSync(selected).size>256*1024)fail('INVALID_WORDING_FILE');const {parseVocabularyBytes}=await import('../../shared/personal-vocabulary.mjs');parseVocabularyBytes(fs.readFileSync(selected));}catch(error){files.release([choice.id]);throw error;}}
      return choice;
    },
    async preview(spec) {
      if (closed) fail('UNAVAILABLE');
      const clean = validateSpec(spec); await verifyUser(clean.distribution);
      let registry;
      if(clean.source.kind==='registry'){
        const result=await wslRun(clean.distribution,['docker','manifest','inspect','--verbose',clean.source.image],{timeoutMs:45000,maxBytes:2*1024*1024});
        if(result.state!=='succeeded')fail('APPLIANCE_REGISTRY_INSPECTION_UNAVAILABLE');
        registry={requestedImage:clean.source.image,...require('./registry-image.cjs').pinRegistryImage(clean.source.image,result.stdout)};clean.source.image=registry.image;
      }
      const inspected = await inspect(clean);
      if (previews.size >= 32) fail('LIMIT_REACHED');
      const previewId = randomUUID(); previews.set(previewId, { spec: clean, identity: inspected.identity });
      return { previewId, spec: clean, summary: { architecture: 'x86_64', boot: 'bios', output: 'iso', namedTunnelSetup: 'guest-only', includesPersonalWording: !!clean.wordingFileId, privateArtifact:!!clean.wordingFileId||clean.source.kind==='prepared', ...(registry?{registry}:{}), ...(inspected.composeReview?{composeServices:inspected.composeReview}:{}) } };
    },
    async build(previewId, consent) {
      if (closed) fail('UNAVAILABLE');
      if (consent !== true) fail('SOURCE_CONSENT_REQUIRED');
      const preview = previews.get(previewId); if (!preview) fail('APPLIANCE_PREVIEW_REQUIRED');
      if (admitting || [...jobs.values()].some(job => ['running','cancelling','interrupted'].includes(job.state))) fail('APPLIANCE_BUILD_BUSY');
      if (jobs.size >= 32) fail('LIMIT_REACHED');
      admitting = true;
      let staged, job;
      try {
        const { spec } = preview; await verifyUser(spec.distribution);
        const inspected = await inspect(spec);
        if (JSON.stringify(inspected.identity) !== JSON.stringify(preview.identity)) fail('APPLIANCE_INPUT_CHANGED');
        previews.delete(previewId);
        const id = randomUUID(), folder = path.join(root,id), output = path.join(folder,'output');
        fs.mkdirSync(output,{recursive:true,mode:0o700});
        staged = await stageInputs(inspected.selected, inspected.identity, folder);
        const nativeSpec = { ...spec, source: { ...spec.source } };
        delete nativeSpec.source.fileId; delete nativeSpec.source.directoryId; delete nativeSpec.source.bundleId; delete nativeSpec.wordingFileId;
        for (const [key, value] of Object.entries(staged)) nativeSpec[key] = linuxPath(value);
        const specPath = path.join(folder,'spec.json'); fs.writeFileSync(specPath,JSON.stringify(nativeSpec),{flag:'wx',mode:0o600});
        job = { id, privateArtifact: !!spec.wordingFileId||spec.source.kind==='prepared', state:'running', sequence:0, logs:[], folder, outputDirectory:output, distribution:spec.distribution };
        jobs.set(id,job); persist(job);
        let pending = '';
        const append = ({text}) => {
          pending = (pending + String(text)).slice(-8192); const lines = pending.split(/\r?\n/); pending = lines.pop();
          for (const line of lines) { const phase = /^APPLIANCE_PHASE:([a-z]+)$/.exec(line); if (phase && PHASES.has(phase[1])) { job.logs.push('Phase: '+phase[1]); job.logs=job.logs.slice(-200); job.sequence++; persist(job); } }
        };
        job.handle = run(wslExecutable,['--distribution',spec.distribution,'--exec','bash',linuxPath(path.join(scriptDirectory,'build-appliance.sh')),'--spec',linuxPath(specPath),'--output',linuxPath(output)],{timeoutMs:3600000,maxBytes:16*1024*1024,maxCapturedCharacters:8192,onLog:append});
        job.done = job.handle.completion.then(async result => {
          job.sequence++;
          if (job.state === 'cancelling') {
            const observed = await control(job,'status');
            job.state = observed.state === 'verified-stopped' ? 'cancelled' : 'interrupted';
            job.code = job.state === 'cancelled' ? 'CANCELLED' : 'APPLIANCE_CLEANUP_UNVERIFIED';
            return;
          }
          job.producerSucceeded=result.state==='succeeded';
          if (result.state !== 'succeeded') { readFailure(job); const cleanup=await control(job,'cancel');job.state=cleanup.state==='verified-stopped'?'failed':'interrupted';job.code=job.state==='failed'?'APPLIANCE_BUILD_FAILED':'APPLIANCE_CLEANUP_UNVERIFIED'; return; }
          const manifestPath = path.join(output,'manifest.json'); inspectCanonicalPath(manifestPath);
          if (fs.statSync(manifestPath).size > 65536) fail('APPLIANCE_OUTPUT_MISSING');
          const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'));
          if (manifest.schemaVersion !== 1 || manifest.status !== 'built' || typeof manifest.iso?.path !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.iso.sha256) || !Number.isSafeInteger(manifest.iso.size) || manifest.iso.size < 32768) fail('APPLIANCE_OUTPUT_MISSING');
          job.outputName=path.basename(manifest.iso.path); job.sha256=manifest.iso.sha256; job.size=manifest.iso.size;
          if (!/^[a-z0-9-]+\.iso$/.test(job.outputName)) fail('APPLIANCE_OUTPUT_MISSING');
          await verifyOutput(job);job.state='succeeded';
        }).catch(() => {readFailure(job);job.state=job.producerSucceeded?'failed':'interrupted';job.code=job.producerSucceeded?'APPLIANCE_OUTPUT_UNVERIFIED':'APPLIANCE_CLEANUP_UNVERIFIED';}).finally(() => {if(staged?.wordingPath)fs.rmSync(staged.wordingPath,{force:true});persist(job);});
        return state(job);
      } catch (error) {
        if (staged?.wordingPath) fs.rmSync(staged.wordingPath,{force:true});
        if (job) { job.state='failed';job.code='APPLIANCE_START_FAILED';persist(job); }
        throw error;
      } finally { admitting=false; }
    },
    state(id) { return state(get(id)); },
    async cancel(id) {
      const job=get(id);
      if(job.verificationAdmission){job.verificationEpoch=randomUUID();job.verificationAdmission=false;job.verification={state:'unverified',bootVerified:false,code:'CANCELLED',cleanupVerified:true};job.sequence++;persist(job);return state(job);}
      if(job.verificationActive||job.verification?.code==='APPLIANCE_VERIFICATION_CLEANUP_UNVERIFIED'){await cancelVerification(job);return state(job);}
      if (['running','interrupted'].includes(job.state)) {
        job.state='cancelling';job.sequence++;persist(job);
        const stopped=await control(job,'cancel');
        if (stopped.state !== 'verified-stopped') {job.state='interrupted';job.code='APPLIANCE_CLEANUP_UNVERIFIED';persist(job);return state(job);}
        await job.handle?.cancel(); await job.done;
        job.state='cancelled';job.code='CANCELLED';persist(job);
      }
      return state(job);
    },
    async verify(id) {
      if(closed)fail('UNAVAILABLE');
      const job=get(id);
      if(job.state!=='succeeded'||!job.outputName)fail('APPLIANCE_OUTPUT_UNAVAILABLE');
      if(job.verificationActive||job.verificationAdmission||job.verification?.code==='APPLIANCE_VERIFICATION_CLEANUP_UNVERIFIED')return state(job);
      const epoch=randomUUID();job.verificationEpoch=epoch;job.verificationAdmission=true;
      job.verification={state:'pending',bootVerified:false};job.sequence++;persist(job);
      const current=()=>{if(closed||job.verificationEpoch!==epoch||!job.verificationAdmission)fail('CANCELLED');};
      try {
        const output=await verifyOutput(job);current();await verifyUser(job.distribution);current();
        inspectCanonicalPath(job.outputDirectory);
        const verificationDirectory=path.join(job.outputDirectory,'verification-'+epoch);
        if(fs.existsSync(verificationDirectory))fail('APPLIANCE_VERIFICATION_OUTPUT_EXISTS');
        const receipt=path.join(verificationDirectory,'boot-verification.json');
        job.verificationDirectory=verificationDirectory;job.verificationActive=true;job.verificationAdmission=false;
        job.verificationHandle=run(wslExecutable,['--distribution',job.distribution,'--exec','python3',linuxPath(path.join(scriptDirectory,'verify-boot.py')),'--iso',linuxPath(output),'--sha256',job.sha256,'--output',linuxPath(verificationDirectory)],{timeoutMs:660000,maxBytes:65536});
        job.verificationPromise=job.verificationHandle.completion.then(async result=>{
          if(job.verificationEpoch!==epoch||job.verificationCancelledEpoch===epoch)return;
          if(result.state!=='succeeded')fail('APPLIANCE_BOOT_UNVERIFIED');
          inspectCanonicalPath(receipt);if(fs.statSync(receipt).size>65536)fail('APPLIANCE_BOOT_UNVERIFIED');
          const proof=JSON.parse(fs.readFileSync(receipt,'utf8'));
          if(proof.schemaVersion!==1||proof.isoSha256!==job.sha256||proof.bootVerified!==true||proof.kernelBooted!==true||proof.runtimeReady!==true||proof.workloadReady!==true||proof.method!=='qemu-serial')fail('APPLIANCE_BOOT_UNVERIFIED');
          await verifyOutput(job);
          if(job.verificationEpoch!==epoch||job.verificationCancelledEpoch===epoch)return;
          job.verification={state:'verified',bootVerified:true,kernelBooted:true,runtimeReady:true,workloadReady:true,method:'qemu-serial'};
        }).catch(()=>{if(job.verificationEpoch===epoch&&job.verificationCancelledEpoch!==epoch)job.verification={state:'unverified',bootVerified:false,code:'APPLIANCE_BOOT_UNVERIFIED'};}).finally(()=>{if(job.verificationEpoch===epoch){job.verificationActive=false;job.sequence++;persist(job);}});
        return state(job);
      } catch(error) {
        if(job.verificationEpoch===epoch){job.verificationActive=false;job.verification={state:'unverified',bootVerified:false,code:error.code==='CANCELLED'?'CANCELLED':'APPLIANCE_BOOT_UNVERIFIED'};job.sequence++;persist(job);}
        throw error;
      } finally {if(job.verificationEpoch===epoch)job.verificationAdmission=false;}
    },
    async export(id) {
      const job=get(id);
      if (job.state !== 'succeeded' || !job.outputName) fail('APPLIANCE_OUTPUT_UNAVAILABLE');
      const output=await verifyOutput(job), destination=downloadsDirectory();inspectCanonicalPath(destination);
      const name=path.basename(job.outputName,'.iso')+'-'+id.slice(0,8)+'.iso', target=path.join(destination,name);
      const owned=[];
      try {
        const handle=await fs.promises.open(target,'wx',0o600);owned.push(target);
        await pipeline(fs.createReadStream(output),handle.createWriteStream());
        const actual=await fileDigest(target);
        if(actual.sha256!==job.sha256||actual.size!==job.size)fail('APPLIANCE_OUTPUT_CHANGED');
        for(const [suffix,body] of [['.sha256',job.sha256+'  '+name+'\n'],['.receipt.json',JSON.stringify({schemaVersion:1,name,sha256:job.sha256,size:job.size,privateArtifact:job.privateArtifact===true,bootVerified:job.verification?.bootVerified===true})]]) {
          const file=target+suffix;fs.writeFileSync(file,body,{flag:'wx',mode:0o600});owned.push(file);
        }
        return {name,bytes:actual.size,sha256:actual.sha256,privateArtifact:job.privateArtifact===true};
      } catch(error) {for(const file of owned)fs.rmSync(file,{force:true});throw error;}
    },
    async dispose() {
      closed=true;files.dispose();await preparation.dispose();
      await Promise.allSettled([...jobs.values()].filter(job=>job.state==='running'||job.verificationActive||job.verificationAdmission||job.verification?.code==='APPLIANCE_VERIFICATION_CLEANUP_UNVERIFIED').map(job=>this.cancel(job.id)));
      await Promise.allSettled([...jobs.values()].map(job=>job.done).filter(Boolean));
    }
  };
}
module.exports={createApplianceService,linuxPath};
