'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const os = require('node:os');
const {packageIdentity,stageBaseline} = require('./squirrel.cjs');
const {acquireHostedBaseline} = require('./squirrel-baseline.cjs');
const root = path.resolve(__dirname, '../..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function contained(base, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => p === '..' || p === '.' || !p || p.includes(':'))) throw new Error('Invalid relative build path.');
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(path.resolve(base) + path.sep)) throw new Error('Build path escapes its root.');
  let cursor = resolved;
  while (cursor !== path.dirname(cursor)) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Build path contains a symbolic link or junction.');
    cursor = path.dirname(cursor);
  }
  return resolved;
}

function execute(executable, args, options = {}) {
  const result = cp.spawnSync(executable, args, {cwd:root, windowsHide:true, stdio:'inherit', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`Build subprocess stopped with exit ${result.status ?? result.signal}.`);
    error.exitCode = Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    throw error;
  }
  return result.stdout;
}

function sourceIdentity(base, git, manifestBytes) {
  const query = args => {
    const result = cp.spawnSync(git, args, {cwd:base, windowsHide:true, encoding:'utf8'});
    if (result.error || result.status !== 0) throw new Error('Source identity could not be established.');
    return result.stdout.trim();
  };
  if (query(['status', '--porcelain=v1', '--untracked-files=all'])) throw new Error('Build requires an unchanged committed source tree and index, with no untracked source files.');
  const identity = {commit:query(['rev-parse','HEAD']), tree:query(['rev-parse','HEAD^{tree}']), indexTree:query(['write-tree']), manifestSha256:sha256(manifestBytes), manifestSchema:1};
  if (identity.tree !== identity.indexTree) throw new Error('Source and index trees disagree.');
  return identity;
}

function assertIdentity(expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Source, index or manifest changed while producing this output.');
}

function inventory(directory) {
  const files = [];
  function walk(relative) {
    for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
      const child = relative ? `${relative}/${name}` : name;
      const full = contained(directory, child);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error('Output contains a link.');
      if (stat.isDirectory()) walk(child);
      else if (stat.isFile()) files.push({path:child, bytes:stat.size, sha256:sha256(fs.readFileSync(full))});
      else throw new Error('Output contains a nonregular entry.');
    }
  }
  walk('');
  if (!files.length) throw new Error('Build output is empty.');
  return files;
}

function nonempty(directory, relative) {
  const full = contained(directory, relative);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile() || fs.statSync(full).size === 0) throw new Error(`Expected output is absent or empty: ${relative}`);
  return full;
}

function verifyInstaller(directory) {
  const files = inventory(directory);
  const setup = files.find(file => /(^|\/)Setup\.exe$/i.test(file.path));
  const releases = files.find(file => /(^|\/)RELEASES$/.test(file.path));
  if (!setup || !releases || !files.some(file => /-full\.nupkg$/.test(file.path))) throw new Error('Squirrel output lacks Setup.exe, RELEASES or a full package.');
  if (fs.readFileSync(nonempty(directory,setup.path)).subarray(0,2).toString() !== 'MZ') throw new Error('Setup.exe is not a PE executable.');
  const releaseRoot = path.dirname(contained(directory,releases.path));
  const lines = fs.readFileSync(nonempty(directory,releases.path),'utf8').trim().split(/\r?\n/);
  for (const line of lines) {
    const match = /^([0-9a-f]{40}) ([A-Za-z0-9_.-]+\.nupkg) ([0-9]+)$/i.exec(line);
    if (!match) throw new Error('Malformed Squirrel RELEASES record.');
    const bytes = fs.readFileSync(nonempty(releaseRoot,match[2]));
    if (bytes.length !== Number(match[3]) || crypto.createHash('sha1').update(bytes).digest('hex') !== match[1].toLowerCase() || bytes.subarray(0,2).toString() !== 'PK') throw new Error('Squirrel package does not match its RELEASES record.');
  }
  return files;
}

function verifiedOutput(directory) {
  try {
    const receipt = JSON.parse(fs.readFileSync(contained(directory,'build-receipt.json'),'utf8'));
    if (receipt.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(receipt.source.commit) || !/^[a-f0-9]{64}$/.test(receipt.source.manifestSha256) || !Array.isArray(receipt.files)) return false;
    return JSON.stringify(inventory(directory).filter(file => file.path !== 'build-receipt.json')) === JSON.stringify(receipt.files);
  } catch { return false; }
}

function outputJournal(base, relative) {
  return contained(base,`.cache/output-${sha256(relative).slice(0,16)}.json`);
}

function recoverOutput(base, relative) {
  const journal = outputJournal(base,relative);
  if (!fs.existsSync(journal)) return;
  const destination = contained(base,relative);
  if (verifiedOutput(destination)) { fs.renameSync(journal,`${journal}.recovered-${crypto.randomUUID()}`); return; }
  // Enumerate only this target's previous generations; never use journal-supplied paths.
  const parent = path.dirname(destination), prefix = path.basename(destination)+'.previous-';
  if (fs.existsSync(parent)) for (const name of fs.readdirSync(parent).sort()) {
    if (!name.startsWith(prefix) || !/^[a-f0-9-]{36}$/.test(name.slice(prefix.length))) continue;
    const candidate = contained(base,path.relative(base,path.join(parent,name)).split(path.sep).join('/'));
    if (!verifiedOutput(candidate)) continue;
    if (fs.existsSync(destination)) fs.renameSync(destination,`${destination}.invalid-${crypto.randomUUID()}`);
    fs.renameSync(candidate,destination);
    fs.renameSync(journal,`${journal}.recovered-${crypto.randomUUID()}`);
    return;
  }
  throw new Error('Interrupted output activation has no verified active or previous output. Recovery journal retained.');
}

function activateOutput(base, relative, produced) {
  recoverOutput(base,relative);
  const destination = contained(base,relative);
  if (!verifiedOutput(produced)) throw new Error('Produced output failed its receipt verification.');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  const journal = outputJournal(base,relative);
  fs.mkdirSync(path.dirname(journal),{recursive:true});
  const previous = `${destination}.previous-${crypto.randomUUID()}`;
  const fd = fs.openSync(journal,'wx');
  try {fs.writeFileSync(fd,JSON.stringify({schemaVersion:1,target:relative,previous:path.basename(previous)}));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  try {
    if (fs.existsSync(destination)) fs.renameSync(destination,previous);
    try { fs.renameSync(produced,destination); }
    catch(error) {
      if(error.code!=='EXDEV') throw error;
      fs.cpSync(produced,destination,{recursive:true,errorOnExist:true,force:false});
    }
    if (!verifiedOutput(destination)) throw new Error('Activated output failed its receipt verification.');
    fs.renameSync(journal,`${journal}.complete-${crypto.randomUUID()}`);
  } catch(error) {
    if (!fs.existsSync(destination) && verifiedOutput(previous)) fs.renameSync(previous,destination);
    throw error;
  }
  return destination;
}

async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 is the supported build host.');
  const args = process.argv.slice(2);
  const targetName = args[args.indexOf('--target') + 1];
  const installer = args.includes('--installer');
  const dependenciesOnly = args.includes('--dependencies-only');
  const manifestPath = path.join(root,'build-manifest.json');
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  if (manifest.schemaVersion !== 1 || !Object.hasOwn(manifest.targets,targetName)) throw new Error('Unsupported build manifest or target.');
  const target = manifest.targets[targetName];
  if (installer && !target.installable) throw new Error('Selected target cannot produce an installer.');
  const node = process.env.MATERIAL_BUILD_NODE;
  const git = process.env.MATERIAL_BUILD_GIT;
  const npm = process.env.MATERIAL_BUILD_NPM;
  if (![node,git,npm].every(value => value && fs.existsSync(value))) throw new Error('Use the root build entrypoint to establish verified portable tools.');
  const packageRoot = target.packageDirectory ? contained(root,target.packageDirectory) : root;
  const packageLock = path.join(packageRoot,'package-lock.json');
  if (!fs.existsSync(packageLock)) throw new Error('The reviewed target package-lock.json is required.');
  if (!dependenciesOnly) {
    nonempty(root,target.input);
    if (target.rendererInput) nonempty(root,target.rendererInput);
  }
  execute(node,[path.join(root,'scripts/check-vocabulary.cjs')]);
  const before = dependenciesOnly ? null : sourceIdentity(root,git,manifestBytes);
  console.log('Installing exact locked npm packages with lifecycle scripts disabled.');
  execute(node,[npm,'ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:packageRoot});
  if (dependenciesOnly) { console.log('Locked dependencies acquired. No build or runtime verification is claimed.'); return; }
  assertIdentity(before,sourceIdentity(root,git,fs.readFileSync(manifestPath)));
  recoverOutput(root,installer ? target.installerOutput : target.output);
  const generation = crypto.randomUUID();
  let staging;
  if(installer) {
    const temporary=fs.realpathSync(os.tmpdir());
    // Genuine NuGet uses legacy path limits. Keep its owned producer tree short.
    staging=fs.mkdtempSync(path.join(temporary,'mbr-'));
    contained(temporary,path.basename(staging));
    fs.writeFileSync(path.join(staging,'producer-owner.json'),JSON.stringify({schemaVersion:1,source:before.commit,root,createdAt:new Date().toISOString(),purpose:'Squirrel installer production'}));
    console.log(`Private retained producer staging: ${staging}`);
  } else {
    staging = contained(root,`.cache/builds/${generation}`);
    fs.mkdirSync(staging,{recursive:true});
  }
  const output = path.join(staging,'output');
  const template = installer ? target.installerCommand : target.command;
  if (!Array.isArray(template) || !template.length) throw new Error('Canonical package command is missing.');
  if (target.rendererCommand) execute(node,target.rendererCommand);
  const command = template.map(arg => arg.replaceAll('{output}',output));
  const childEnv = {...process.env, CSC_IDENTITY_AUTO_DISCOVERY:'false'};
  let packageVersion = null, packageVersionSource = null, delta = null, payloads = {status:'core-only',complete:false};
  if (target.kind === 'desktop') {
    if (!process.env.MATERIAL_BUILD_ELECTRON_DIST) throw new Error('Verified desktop runtime directory is unavailable.');
    const identity = packageIdentity(JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8')).version);
    packageVersion = identity.version;
    packageVersionSource = identity.source;
    fs.writeFileSync(path.join(root,'dist/build-info.json'),JSON.stringify({version:packageVersion,source:before.commit,updatedAt:new Date().toISOString()})+'\n');
    command.push(`--config.extraMetadata.version=${packageVersion}`);
    command.push(`--config.electronDist=${process.env.MATERIAL_BUILD_ELECTRON_DIST}`);
    if (installer) {
      const cache = contained(root,'.cache/payload-downloads');
      fs.mkdirSync(cache,{recursive:true});
      if (args.includes('--payload-cache')) {
        const input = args[args.indexOf('--payload-cache')+1];
        if (!input || !path.isAbsolute(input)) throw Error('Payload cache input must be an absolute directory.');
        const origin = path.resolve(input);
        for(let cursor=origin;;cursor=path.dirname(cursor)) {
          if(fs.lstatSync(cursor).isSymbolicLink()) throw Error('Payload cache input contains a linked ancestor.');
          if(cursor===path.dirname(cursor)) break;
        }
        const registry = require('./offline-payloads.json');
        for(const item of [...registry.tools,registry.extractor,registry.fullExtractor].filter(Boolean)) {
          const name = `${item.sha256}.zip`, source = path.join(origin,name), destination = path.join(cache,name);
          if(fs.existsSync(source)&&!fs.existsSync(destination)) {
            const stat=fs.lstatSync(source);
            if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==item.bytes) throw Error('Payload input cache member does not match its pinned size.');
            fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);
          }
        }
      }
      console.log('Assembling the complete declared offline payload inventory. Original cache inputs are read only.');
      const assembled = await require('./payloads.cjs').assemblePayloads({output:path.join(staging,'offline-payloads'),cache,complete:true});
      if(assembled.manifest.complete!==true) throw Error('Normal installer production requires the complete offline payload inventory.');
      const longest = Math.max(...assembled.manifest.tools.flatMap(tool=>tool.files.map(file=>file.path.length)));
      if(path.join(output,'win-unpacked/resources/offline-payloads').length+1+longest>=240) throw Error('Exclusive producer staging is still too long for the genuine package toolchain. Outputs retained.');
      const configuration = {...JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8')).build,extraResources:[assembled.extraResources]};
      const configurationPath = path.join(staging,'installer-config.json');
      fs.writeFileSync(configurationPath,JSON.stringify(configuration));
      command.push(`--config=${configurationPath}`);
      payloads={status:'assembled',complete:true,manifestSha256:sha256(fs.readFileSync(path.join(assembled.directory,'manifest.json'))),tools:assembled.manifest.tools.map(tool=>({id:tool.id,version:tool.version,archive:tool.archive,license:tool.license,sourceUrl:tool.sourceUrl}))};
      const baseline = acquireHostedBaseline(root,packageVersion);
      delta = stageBaseline(baseline.directory,output,packageVersion);
      if (!baseline.directory) delta.reason = baseline.reason;
      if (baseline.releaseTag) delta = {...delta,releaseTag:baseline.releaseTag,source:baseline.source,provenanceSha256:baseline.provenanceSha256};
    }
  }
  execute(node,command,{env:childEnv});
  if (target.kind === 'desktop') {
    const asar = require('@electron/asar');
    const packaged = JSON.parse(asar.extractFile(nonempty(output,'win-unpacked/resources/app.asar'),'package.json').toString('utf8'));
    if (packaged.version !== packageVersion) throw new Error('Packaged application metadata differs from the installed package version.');
    if(installer) {
      const bundled=nonempty(output,'win-unpacked/resources/offline-payloads/manifest.json');
      if(sha256(fs.readFileSync(bundled))!==payloads.manifestSha256) throw Error('Packaged offline payload manifest differs from the complete assembled inventory.');
      nonempty(output,'win-unpacked/resources/offline-payloads/THIRD-PARTY-NOTICES.txt');
    }
  }
  if (target.checkCommand) execute(node,target.checkCommand.map(arg => arg.replaceAll('{output}',output)));
  if (installer) verifyInstaller(output);
  else {
    nonempty(output,target.entry);
    if (target.archive) nonempty(output,target.archive);
  }
  assertIdentity(before,sourceIdentity(root,git,fs.readFileSync(manifestPath)));
  const files = inventory(output);
  if (installer && target.kind === 'desktop') {
    for(const file of files.filter(file=>/(^|\/)(Setup\.exe|RELEASES|[^/]+\.nupkg)$/.test(file.path))) {
      console.log(`Installer transfer asset: ${path.basename(file.path)} (${file.bytes} bytes).`);
      if(file.bytes>1400000000) throw Error('Installer asset exceeds the supported 1.4 GB transfer budget; original output is retained and no release is permitted.');
    }
    const expectedFull = files.find(file => path.basename(file.path) === `MaterialBuildroot-${packageVersion}-full.nupkg`);
    if (!expectedFull) throw new Error('Squirrel full package identity differs from the requested installed version.');
    const generatedDelta = files.find(file => path.basename(file.path) === `MaterialBuildroot-${packageVersion}-delta.nupkg`);
    if (delta.status === 'staged' && !generatedDelta) throw new Error('Squirrel did not produce a delta from the supplied baseline.');
    if (generatedDelta) {
      const baseline = {...delta};delete baseline.status;
      delta = {status:'produced',baseline,package:path.basename(generatedDelta.path),sha256:generatedDelta.sha256};
    }
    console.log(delta.status === 'produced' ? `Squirrel delta produced for ${packageVersion}.` : `Squirrel delta unavailable: ${delta.reason}`);
  }
  const receipt = {schemaVersion:1, source:before, target:targetName, kind:target.kind, installer, packageVersion, packageVersionSource, delta, payloads, canonicalCommand:template, targetMetadata:target, packageLockSha256:sha256(fs.readFileSync(packageLock)), files, producedAt:new Date().toISOString(), runtimeVerified:false};
  fs.writeFileSync(path.join(output,'build-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  const destination = activateOutput(root,installer ? target.installerOutput : target.output,output);
  console.log(`Built ${targetName}${installer ? ' unsigned Squirrel.Windows installer' : ''} from ${before.commit}.`);
  console.log(`Output: ${path.relative(root,destination)}; receipt SHA-256: ${sha256(fs.readFileSync(path.join(destination,'build-receipt.json')))}`);
  if (installer) console.log('Unsigned output can trigger unknown-publisher or SmartScreen warnings. No release was published.');
  let run = args.includes('--run');
  if (!run && !installer && target.launch && !args.includes('--silent') && process.stdin.isTTY) {
    const readline = require('node:readline/promises').createInterface({input:process.stdin,output:process.stdout});
    try { run = /^y(es)?$/i.test((await readline.question('Launch the built application? [y/N] ')).trim()); } finally { readline.close(); }
  }
  if (run) {
    if (installer || !target.launch) throw new Error('This output has no supported launch action.');
    assertIdentity(before,sourceIdentity(root,git,fs.readFileSync(manifestPath)));
    if (JSON.stringify(inventory(destination).filter(file => file.path !== 'build-receipt.json')) !== JSON.stringify(files)) throw new Error('Output changed before launch.');
    const child = cp.spawn(nonempty(destination,target.launch),[],{cwd:destination,detached:true,stdio:'ignore'});
    await new Promise((resolve,reject) => {child.once('spawn',resolve);child.once('error',reject);});
    child.unref();
    console.log('Launched the source-bound packaged executable. Runtime acceptance remains separate.');
  }
}

module.exports = {contained,sourceIdentity,assertIdentity,inventory,nonempty,verifyInstaller,verifiedOutput,outputJournal,recoverOutput,activateOutput};
if (require.main === module) main().catch(error => {console.error(`Build stopped: ${error.message}`);process.exitCode=error.exitCode || 1;});
