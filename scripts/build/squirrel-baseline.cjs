'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const {versionParts} = require('./squirrel.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function acquireHostedBaseline(root, version, env = process.env) {
  if (env.MATERIAL_BUILD_SQUIRREL_BASELINE) return {directory:env.MATERIAL_BUILD_SQUIRREL_BASELINE};
  if (env.GITHUB_ACTIONS !== 'true') return {reason:'No previous full-package baseline was supplied for local production.'};
  const repository = env.GITHUB_REPOSITORY, gh = env.MATERIAL_RELEASE_GH;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '') || !gh || !fs.existsSync(gh)) throw Error('Hosted baseline acquisition requires trusted repository identity and the bootstrapped publication CLI.');
  const command = args => {
    const result = cp.spawnSync(gh,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:4*1024*1024});
    if (result.error || result.status !== 0) throw Error('Hosted Squirrel baseline acquisition could not complete its release readback.');
    return result.stdout;
  };
  const api = route => JSON.parse(command(['api',route]));
  const parts = versionParts(version);
  const older = candidate => {
    const prior = versionParts(candidate);
    for (let index=0;index<3;index++) if(prior[index]!==parts[index]) return prior[index]<parts[index];
    return false;
  };
  const releases = api(`repos/${repository}/releases?per_page=30`);
  if (!Array.isArray(releases)) throw Error('Hosted baseline release inventory is invalid.');
  const release = releases.find(item => {
    const match = /^v(\d+\.\d+\.\d+)(?:-build\.\d+\.\d+)?$/.exec(item.tag_name || '');
    return item.draft===false && item.prerelease===false && match && older(match[1]);
  });
  if (!release) return {reason:'No strictly older normal release exists within the bounded thirty-release inventory.'};
  const expectedVersion = /^v(\d+\.\d+\.\d+)/.exec(release.tag_name)[1];
  const assets = release.assets;
  if(!Array.isArray(assets)) throw Error('Baseline release assets are unavailable.');
  const asset = (name,max) => {
    const matches=assets.filter(value=>value.name===name);
    if(matches.length!==1 || !Number.isSafeInteger(matches[0].size) || matches[0].size<=0 || matches[0].size>max) throw Error('Baseline release asset is absent, duplicated or oversized.');
    return matches[0];
  };
  const provenanceAsset=asset('provenance.json',1024*1024);
  const cache=path.join(root,'.cache/squirrel-baselines');
  if(fs.existsSync(cache) && (fs.lstatSync(cache).isSymbolicLink() || fs.readdirSync(cache).length>=8)) throw Error('Baseline cache is linked or has reached its eight-acquisition bound; retained inputs require an explicit maintenance pass.');
  fs.mkdirSync(cache,{recursive:true});
  const directory=fs.mkdtempSync(path.join(cache,'release-'));
  const download = name => command(['release','download',release.tag_name,'--repo',repository,'--pattern',name,'--dir',directory]);
  download('provenance.json');
  if(fs.statSync(path.join(directory,'provenance.json')).size!==provenanceAsset.size) throw Error('Baseline provenance size mismatch.');
  const provenanceBytes=fs.readFileSync(path.join(directory,'provenance.json'));
  if(provenanceBytes.length!==provenanceAsset.size || (provenanceAsset.digest && provenanceAsset.digest!==`sha256:${hash(provenanceBytes)}`)) throw Error('Baseline provenance download integrity mismatch.');
  const provenance=JSON.parse(provenanceBytes);
  if(provenance.schemaVersion!==1 || provenance.version!==expectedVersion || !older(provenance.version) || !/^[a-f0-9]{40}$/.test(provenance.source||'') || provenance.platform!=='windows-x64' || provenance.installer!=='Squirrel.Windows' || provenance.signed!==false || !Array.isArray(provenance.assets)) throw Error('Baseline provenance identity is incompatible.');
  let object=api(`repos/${repository}/git/ref/tags/${release.tag_name}`).object;
  const seen=new Set();
  for(let depth=0;object.type==='tag'&&depth<5;depth++) {
    if(seen.has(object.sha)) throw Error('Baseline tag cycle.');
    seen.add(object.sha);object=api(`repos/${repository}/git/tags/${object.sha}`).object;
  }
  if(object.type!=='commit'||object.sha!==provenance.source) throw Error('Baseline tag differs from its package source.');
  const full=`MaterialBuildroot-${provenance.version}-full.nupkg`;
  for(const [name,max] of [['RELEASES',1024*1024],[full,1500000000]]) {
    const publicAsset=asset(name,max),records=provenance.assets.filter(value=>value.name===name);
    if(records.length!==1 || records[0].bytes!==publicAsset.size || !/^[a-f0-9]{64}$/.test(records[0].sha256||'')) throw Error('Baseline package metadata does not match its release asset.');
    download(name);
    if(fs.statSync(path.join(directory,name)).size!==publicAsset.size) throw Error('Baseline package size mismatch.');
    const bytes=fs.readFileSync(path.join(directory,name)),digest=hash(bytes);
    if(bytes.length!==publicAsset.size || digest!==records[0].sha256 || (publicAsset.digest && publicAsset.digest!==`sha256:${digest}`)) throw Error('Baseline package download integrity mismatch.');
  }
  return {directory,releaseTag:release.tag_name,source:provenance.source,provenanceSha256:hash(provenanceBytes)};
}

module.exports={acquireHostedBaseline};
