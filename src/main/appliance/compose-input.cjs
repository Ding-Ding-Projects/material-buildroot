"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { inspectCanonicalPath } = require('../security/file-grants.cjs');
const { fail } = require('./contract.cjs');
const NAMES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];
/** Admit only a self-contained prebuilt workload, never the surrounding checkout. */
function inspectComposeInput(directory) {
  inspectCanonicalPath(directory);
  const names = NAMES.filter(name => fs.existsSync(path.join(directory, name)));
  if (names.length !== 1) fail('COMPOSE_MANIFEST_REQUIRED');
  const name = names[0], file = path.join(directory, name);
  inspectCanonicalPath(file);
  if (!fs.statSync(file).isFile() || fs.statSync(file).size > 1024 * 1024) fail('INVALID_COMPOSE_PROJECT');
  const bytes = fs.readFileSync(file), text = bytes.toString('utf8');
  // Environment resolution must not silently import local deployment values.
  if (/\$(?:\{|[A-Za-z_])/.test(text)) fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
  let document;
  try { document = require('yaml').parse(text, { maxAliasCount: 100, uniqueKeys: true }); }
  catch { fail('INVALID_COMPOSE_PROJECT'); }
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(document) || !object(document.services) || !Object.keys(document.services).length || Object.keys(document).some(key => !['name','version','services','networks','volumes'].includes(key))) fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
  for (const service of Object.values(document.services)) {
    if (!object(service) || typeof service.image !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,254}$/.test(service.image)) fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
    if (['build','env_file','secrets','configs','extends','develop','label_file','credential_spec'].some(key => Object.hasOwn(service,key))) fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
    if(service.environment!==undefined) {
      if(!object(service.environment)||Object.entries(service.environment).some(([key,value])=>!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)||typeof value!=='string'||value.length>8192||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)))fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
    }
    if (service.volumes !== undefined) {
      if (!Array.isArray(service.volumes)) fail('INVALID_COMPOSE_PROJECT');
      for (const volume of service.volumes) {
        if (typeof volume === 'string') {
          const parts=volume.split(':');
          if (parts.length<2 || parts.length>3 || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(parts[0]) || !parts[1].startsWith('/') || /docker\.sock|containerd\.sock/.test(parts[1])) fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
        } else if (!object(volume) || volume.type!=='volume' || typeof volume.source!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(volume.source) || typeof volume.target!=='string' || !volume.target.startsWith('/')) fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
      }
    }
  }
  for (const category of ['volumes','networks']) {
    if(document[category]!==undefined && !object(document[category]))fail('INVALID_COMPOSE_PROJECT');
    for(const value of Object.values(document[category]||{})) {
      if(value!==null && (!object(value) || Object.keys(value).some(key=>!['name','labels'].includes(key))))fail('APPLIANCE_COMPOSE_PREPARATION_REQUIRED');
    }
  }
  return { name, file, bytes, services: Object.entries(document.services).map(([name,service])=>({name,image:service.image,environment:service.environment||{}})) };
}
module.exports={inspectComposeInput};
