'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function versionParts(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw Error('Squirrel package version must contain three numeric components.');
  const parts = version.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part) || part > 65534)) throw Error('Squirrel package version component exceeds the supported Windows version range.');
  return parts;
}

function older(left, right) {
  const a = versionParts(left), b = versionParts(right);
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index] < b[index];
  return false;
}

function packageIdentity(baseVersion, env = process.env) {
  const base = versionParts(baseVersion);
  if (env.MATERIAL_BUILD_VERSION) {
    versionParts(env.MATERIAL_BUILD_VERSION);
    return {version:env.MATERIAL_BUILD_VERSION,source:'explicit'};
  }
  if (env.GITHUB_RUN_NUMBER) {
    if (!/^[1-9]\d*$/.test(env.GITHUB_RUN_NUMBER)) throw Error('Invalid hosted release sequence.');
    const version = `${base[0]}.${base[1]}.${env.GITHUB_RUN_NUMBER}`;
    versionParts(version);
    return {version,source:'workflow-sequence'};
  }
  return {version:baseVersion,source:'local-base'};
}

function stageBaseline(directory, output, version) {
  versionParts(version);
  if (!directory) return {status:'unavailable', reason:'No previous full-package baseline was supplied.'};
  const base = path.resolve(directory);
  for (let cursor = base; ; cursor = path.dirname(cursor)) {
    if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('Squirrel baseline contains a linked ancestor.');
    if (cursor === path.dirname(cursor)) break;
  }
  const releasesPath = path.join(base,'RELEASES');
  if (fs.lstatSync(releasesPath).isSymbolicLink() || fs.statSync(releasesPath).size > 1024 * 1024) throw Error('Invalid baseline RELEASES file.');
  const candidates = fs.readFileSync(releasesPath,'utf8').trim().split(/\r?\n/).map(line => {
    const match = /^([a-f0-9]{40}) (MaterialBuildroot-((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))-full\.nupkg) ([1-9]\d*)$/i.exec(line);
    return match && older(match[3],version) ? {sha1:match[1].toLowerCase(),name:match[2],version:match[3],bytes:Number(match[4])} : null;
  }).filter(Boolean).sort((a,b) => older(a.version,b.version) ? 1 : older(b.version,a.version) ? -1 : 0);
  if (!candidates.length) throw Error('Baseline has no strictly older compatible full package.');
  const selected = candidates[0], source = path.join(base,selected.name), stat = fs.lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== selected.bytes || stat.size > 1500000000) throw Error('Invalid baseline full package size or type.');
  const bytes = fs.readFileSync(source);
  if (bytes.subarray(0,2).toString() !== 'PK' || crypto.createHash('sha1').update(bytes).digest('hex') !== selected.sha1) throw Error('Baseline full package does not match RELEASES.');
  const target = path.join(output,'squirrel-windows');
  fs.mkdirSync(target,{recursive:true});
  fs.writeFileSync(path.join(target,selected.name),bytes,{flag:'wx'});
  fs.writeFileSync(path.join(target,'RELEASES'),`${selected.sha1} ${selected.name} ${selected.bytes}\n`,{flag:'wx'});
  return {status:'staged',version:selected.version,package:selected.name,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}

module.exports = {versionParts,packageIdentity,stageBaseline};
