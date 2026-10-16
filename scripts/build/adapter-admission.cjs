'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// This inventory records source admission, never runtime or legal acceptance.
function loadAdapterAdmission(root) {
  const sources = [];
  function read(relative) {
    const bytes = fs.readFileSync(path.join(root, relative));
    sources.push({path:relative, sha256:hash(bytes)});
    return JSON.parse(bytes.toString('utf8'));
  }
  const records = [];
  for (const prefix of ['', 'website/']) {
    const manifest = read(prefix + 'package.json');
    const lock = read(prefix + 'package-lock.json');
    for (const [name, version] of Object.entries(manifest.dependencies || {})) {
      const entry = lock.packages?.['node_modules/' + name];
      if (!entry || entry.version !== version || !entry.integrity || !entry.resolved || !/^https:\/\//.test(entry.resolved))
        throw new Error(`Adapter package is not exactly locked: ${prefix}${name}`);
      records.push({id:prefix + name, kind:'bundled-package', version, provenance:{source:prefix + 'package-lock.json', url:entry.resolved, integrity:entry.integrity},
        license:{declared:entry.license || null, redistribution:'unreviewed'}, compatibility:'unverified', runtime:'unverified',
        offline:{mode:'bundled-code', acquisition:'cache-or-network', completePayload:'unverified'}});
    }
  }
  const manifest = read('build-manifest.json');
  for (const entry of [...manifest.toolchains, manifest.electron]) {
    if (!entry.id || !entry.version || !/^[a-f0-9]{64}$/.test(entry.sha256 || '') || !/^https:\/\//.test(entry.url || ''))
      throw new Error('Build adapter has incomplete provenance.');
    records.push({id:'build/' + entry.id, kind:'build-tool', version:entry.version,
      provenance:{source:'build-manifest.json', url:entry.url, sha256:entry.sha256},
      license:{declared:null, redistribution:'unreviewed'}, compatibility:'unverified', runtime:'unverified',
      offline:{mode:'verified-cache-or-network', bundledWithProduct:entry.id === 'electron', completePayload:'unverified'}});
  }
  const policy = read('scripts/build/adapter-admission.json');
  const icons = read('src/renderer/assets/material-icons/provenance.json');
  records.push({id:'material-icons', kind:'bundled-assets', version:icons.revision,
    provenance:{source:'src/renderer/assets/material-icons/provenance.json', url:icons.upstream},
    license:{declared:icons.license, redistribution:'unreviewed'}, compatibility:'unverified', runtime:'unverified',
    offline:{mode:'bundled-assets', completePayload:'unverified'}});
  const payloads = read('scripts/build/offline-payloads.json');
  const bundledIds = new Set(payloads.requiredBundledToolIds);
  if (bundledIds.size !== payloads.requiredBundledToolIds.length) throw new Error('Duplicate bundled adapter identity.');
  const admittedIds = new Set();
  for (const entry of payloads.tools) {
    if (!bundledIds.has(entry.id) || admittedIds.has(entry.id) || !entry.version || !/^[a-f0-9]{64}$/.test(entry.sha256 || '') || !entry.sourceUrl || !entry.license)
      throw new Error('Bundled adapter provenance is incomplete or duplicated.');
    admittedIds.add(entry.id);
    records.push({id:entry.id, kind:'bundled-tool', version:entry.version,
      provenance:{source:'scripts/build/offline-payloads.json', url:entry.url, sourceUrl:entry.sourceUrl, sha256:entry.sha256},
      license:{declared:entry.license, files:entry.licenseFiles || [], redistribution:'unreviewed'},
      composition:entry.composition || null, excludedMembers:entry.excludedMembers || [], sourceInventory:entry.sourceInventory || null,
      compatibility:'unverified', runtime:'unverified', offline:{mode:'bundled-payload-required', completePayload:'unverified'}});
  }
  if ([...bundledIds].some(id => !admittedIds.has(id))) throw new Error('Required bundled adapter has no source record.');
  for (const entry of payloads.externalTools || []) {
    if (admittedIds.has(entry.id)) throw new Error('Adapter has conflicting bundled and external classifications.');
    admittedIds.add(entry.id);
    records.push({id:entry.id, kind:entry.classification, version:null, provenance:{source:'scripts/build/offline-payloads.json'},
      license:{declared:null, redistribution:entry.licenseBoundary}, compatibility:'unverified', runtime:'unverified',
      offline:{mode:entry.acquisition, completePayload:'unverified'}});
  }
  for (const entry of policy.adapters) records.push({...entry, compatibility:'unverified', runtime:'unverified'});
  return {schemaVersion:1, scope:'recorded-source-inventory', accepted:false, records, sources,
    components:policy.materialComponents, wholeToolsetOffline:false,
    installer:{maximumBytes:policy.maximumInstallerBytes, measuredBytes:null, payloadEmbedding:'unverified'},
    gaps:['Runtime component registration is not established by import records.', 'Declared licenses are not redistribution approval.', 'External tool versions and complete offline payloads require separate admission.', 'Full installer payload embedding and size must come from the actual package.']};
}

function assertInstallerAdmission(admission, installerFiles) {
  const packages = installerFiles.filter(file => /-full\.nupkg$/i.test(file.path));
  if (!packages.length || packages.some(file => !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > admission.installer.maximumBytes))
    throw new Error('Full installer package is missing, has unknown size, or exceeds the admission limit.');
  return {...admission.installer, measuredBytes:Math.max(...packages.map(file => file.size)), payloadEmbedding:'unverified'};
}
module.exports = {loadAdapterAdmission, assertInstallerAdmission};
