'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
function catalogueRows(text) {
  return text.split(/\r?\n/).map(line => /^\| ([a-z][a-z0-9-]+) \| (.*?) \| (.*?) \|$/.exec(line)).filter(Boolean).map(m => ({ id: m[1], requirement: m[2], surface: m[3] }));
}
function validate(ledger, { root = path.resolve(__dirname, '../..') } = {}) {
  const errors = [];
  const fail = message => errors.push(message);
  const catalogue = fs.readFileSync(path.join(root, 'docs/planning/feature-coverage.md'));
  const rows = catalogueRows(catalogue.toString());
  if (ledger.schemaVersion !== 1) fail('Unsupported schemaVersion');
  if (rows.length !== 105 || new Set(rows.map(r => r.id)).size !== 105) fail('Catalogue must contain exactly 105 unique identities');
  if (ledger.catalogueSha256 !== hash(catalogue)) fail('Stale catalogue hash');
  const records = Array.isArray(ledger.identities) ? ledger.identities : [];
  if (records.length !== 105) fail('Ledger must contain exactly 105 identities');
  const seen = new Set();
  const realRoot = fs.realpathSync(root);
  const within = (base, target) => {
    const relative = path.relative(base, target);
    return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
  };
  const plainObject = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
  const checkFiles = (files, label) => {
    if (!Array.isArray(files) || !files.length) { fail(`${label}: missing files`); return; }
    for (const file of files) {
      if (!file || typeof file.path !== 'string' || !digest.test(file.sha256 || '')) { fail(`${label}: malformed file proof`); continue; }
      const target = path.resolve(root, file.path);
      if (path.isAbsolute(file.path) || !within(path.resolve(root), target)) { fail(`${label}: path escapes repository`); continue; }
      try {
        const realTarget = fs.realpathSync(target);
        if (!within(realRoot, realTarget)) { fail(`${label}: resolved path escapes repository`); continue; }
        if (!fs.statSync(realTarget).isFile()) { fail(`${label}: proof is not a regular file`); continue; }
        if (hash(fs.readFileSync(realTarget)) !== file.sha256) fail(`${label}: stale file hash ${file.path}`);
      }
      catch { fail(`${label}: missing file ${file.path}`); }
    }
  };
  for (const record of records) {
    if (seen.has(record.id)) fail(`Duplicate identity: ${record.id}`);
    seen.add(record.id);
    const row = rows.find(r => r.id === record.id);
    if (!row) { fail(`Unknown identity: ${record.id}`); continue; }
    if (record.requirement !== row.requirement || record.catalogueSurface !== row.surface) fail(`${record.id}: stale catalogue record`);
    if (!['applicable', 'conditional', 'canonical-only', 'owner-memory', 'not-applicable'].includes(record.disposition) || !record.reason) fail(`${record.id}: missing disposition/reason`);
    if (!plainObject(record.surfaces) || Reflect.ownKeys(record.surfaces).length !== 4 || !['A','D','C','R'].every(key => Object.hasOwn(record.surfaces, key))) {
      fail(`${record.id}: surfaces must be a plain object with exactly A/D/C/R keys`);
    }
    for (const surface of ['A','D','C','R']) {
      const label = `${record.id}/${surface}`;
      const entry = record.surfaces?.[surface];
      if (!entry) { fail(`${label}: missing surface`); continue; }
      if (entry.workId !== `PH01-T02-${record.id}-${surface}`) fail(`${label}: unstable work ID`);
      const required = row.surface.split(',')[0].split('+').includes(surface);
      const expected = required ? (record.id === 'encrypted-public-builder' ? 'conditional' : 'required') : 'outside-catalogue-scope';
      if (entry.applicability !== expected || !entry.reason) fail(`${label}: incorrect applicability/reason`);
      if (!['unimplemented', 'pending-verification', 'complete', 'not-applicable'].includes(entry.state)) fail(`${label}: invalid state`);
      if (required && entry.state === 'not-applicable') fail(`${label}: required surface cannot be waived`);
      for (const key of ['implementationConsumers','articles','localizedCopy','focusedTests','negativeTests']) if (!Array.isArray(entry[key])) fail(`${label}: missing ${key} inventory`);
      if (!entry.persistence || !['pending','required','not-applicable'].includes(entry.persistence.state)) fail(`${label}: missing persistence disposition`);
      for (const kind of ['source','runtime','capture','parity']) if (!entry.proof || !(kind in entry.proof)) fail(`${label}: missing ${kind} proof slot`);
      if (entry.state !== 'complete') continue;
      if (!required) fail(`${label}: out-of-scope record cannot claim completion`);
      if (record.reconciliation !== 'reviewed') fail(`${label}: canonical reconciliation not reviewed`);
      if (!sha.test(entry.sourceRevision || '') || !digest.test(entry.builtHash || '')) fail(`${label}: missing source/build binding`);
      for (const key of ['implementationConsumers','articles','localizedCopy','focusedTests','negativeTests']) checkFiles(entry[key], `${label}/${key}`);
      if (entry.persistence.state === 'pending') fail(`${label}: persistence pending`);
      if (entry.persistence.state === 'required') checkFiles(entry.persistence.paths, `${label}/persistence`);
      if (entry.persistence.state === 'not-applicable' && !entry.persistence.reason) fail(`${label}: persistence waiver needs reason`);
      for (const kind of ['source','runtime','capture','parity']) {
        const proof = entry.proof?.[kind];
        if (!proof || proof.status !== 'verified' || proof.sourceRevision !== entry.sourceRevision || proof.builtHash !== entry.builtHash) { fail(`${label}/${kind}: absent or stale proof binding`); continue; }
        checkFiles(proof.files, `${label}/${kind}`);
      }
    }
  }
  for (const row of rows) if (!seen.has(row.id)) fail(`Missing identity: ${row.id}`);
  return errors;
}
if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'docs/planning/feature-evidence.json'), 'utf8'));
  const errors = validate(ledger, { root });
  if (errors.length) { process.stderr.write(errors.join('\n') + '\n'); process.exitCode = 1; }
  else console.log('PASS: 105 identities, 420 surface records; admission integrity only, product completion unverified.');
}
module.exports = { validate, catalogueRows, hash };
