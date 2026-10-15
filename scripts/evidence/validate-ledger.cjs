'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const expectedRequirements = require('./expected-subrequirements.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
function catalogueRows(text) {
  return text.split(/\r?\n/).map(line => /^\| ([a-z][a-z0-9-]+) \| (.*?) \| (.*?) \|$/.exec(line)).filter(Boolean).map(m => ({ id: m[1], requirement: m[2], surface: m[3] }));
}
function validate(ledger, { root = path.resolve(__dirname, '../..') } = {}) {
  const errors = [];
  const fail = message => errors.push(message);
  if (ledger === null || typeof ledger !== 'object' || Array.isArray(ledger)) return ['Ledger must be a plain object'];
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
  const boundedString = (value, maximum = 4096) => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum && !/[\x00-\x1f\x7f]/u.test(value);
  const relativePath = value => boundedString(value, 512) && !path.posix.isAbsolute(value) && !path.win32.isAbsolute(value) && !/[\\:]/u.test(value) && value.split('/').every(segment => segment.trim().length > 0 && segment === segment.trim() && segment !== '.' && segment !== '..');
  const plannedPath = (value, label) => { if (!relativePath(value)) fail(`${label}: invalid bounded relative planned path`); };
  const plannedString = (value, label, maximum) => { if (!boundedString(value, maximum)) fail(`${label}: invalid bounded planned string`); };
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
    if (!plainObject(record)) { fail('Malformed identity row'); continue; }
    if (seen.has(record.id)) fail(`Duplicate identity: ${record.id}`);
    seen.add(record.id);
    const row = rows.find(r => r.id === record.id);
    if (!row) { fail(`Unknown identity: ${record.id}`); continue; }
    if (record.requirement !== row.requirement || record.catalogueSurface !== row.surface) fail(`${record.id}: stale catalogue record`);
    if (!['applicable', 'conditional', 'canonical-only', 'owner-memory', 'not-applicable'].includes(record.disposition) || !record.reason) fail(`${record.id}: missing disposition/reason`);
    const requirements = record.subrequirements;
    const expectedRecord = expectedRequirements.identities.find(item => item.id === record.id);
    if (!expectedRecord || !Array.isArray(requirements) || JSON.stringify(requirements.map(item => item && ({id:item.id,text:item.text}))) !== JSON.stringify(expectedRecord.subrequirements)) fail(`${record.id}: planned subrequirements differ from independent expected inventory`);
    if (!Array.isArray(requirements) || requirements.length < 1 || requirements.length > 64) fail(`${record.id}: missing or unbounded planned subrequirements`);
    const requirementIds = new Set();
    for (const [index, requirement] of (Array.isArray(requirements) ? requirements : []).entries()) {
      if (!plainObject(requirement)) { fail(`${record.id}: malformed planned subrequirement`); continue; }
      if (requirement.id !== `${record.id}-REQ-${String(index + 1).padStart(2, '0')}` || requirementIds.has(requirement.id) || typeof requirement.text !== 'string' || requirement.text.length < 1 || requirement.text.length > 6000 || requirement.state !== 'planned') fail(`${record.id}: invalid planned subrequirement`);
      requirementIds.add(requirement.id);
    }
    if (record.canonicalReview?.state !== 'pending-full-section-review' || record.canonicalReview?.subrequirementSource !== 'sanitized-catalogue-expansion') fail(`${record.id}: missing canonical review boundary`);
    if (!plainObject(record.surfaces) || Reflect.ownKeys(record.surfaces).length !== 4 || !['A','D','C','R'].every(key => Object.hasOwn(record.surfaces, key))) {
      fail(`${record.id}: surfaces must be a plain object with exactly A/D/C/R keys`);
    }
    for (const surface of ['A','D','C','R']) {
      const label = `${record.id}/${surface}`;
      const entry = record.surfaces?.[surface];
      if (!plainObject(entry)) { fail(`${label}: missing surface or malformed row`); continue; }
      if (entry.workId !== `PH01-T02-${record.id}-${surface}`) fail(`${label}: unstable work ID`);
      const required = row.surface.split(',')[0].split('+').includes(surface);
      const expected = required ? (record.id === 'encrypted-public-builder' ? 'conditional' : 'required') : 'outside-catalogue-scope';
      if (entry.applicability !== expected || !entry.reason) fail(`${label}: incorrect applicability/reason`);
      if (!['unimplemented', 'pending-verification', 'complete', 'not-applicable'].includes(entry.state)) fail(`${label}: invalid state`);
      if (required && entry.state === 'not-applicable') fail(`${label}: required surface cannot be waived`);
      for (const key of ['implementationConsumers','articles','localizedCopy','focusedTests','negativeTests']) if (!Array.isArray(entry[key])) fail(`${label}: missing ${key} inventory`);
      if (!entry.persistence || !['pending','required','not-applicable'].includes(entry.persistence.state)) fail(`${label}: missing persistence disposition`);
      for (const kind of ['source','runtime','capture','parity']) if (!plainObject(entry.proof) || !(kind in entry.proof)) fail(`${label}: missing ${kind} proof slot`);
      const planned = entry.plannedAdmission;
      if (!planned || !Array.isArray(planned.requirementIds) || planned.requirementIds.length !== requirementIds.size || planned.requirementIds.some((id, index) => id !== requirements?.[index]?.id)) fail(`${label}: missing planned requirement bindings`);
      if (required) {
        if (planned?.state !== 'planned-unimplemented' || planned.consumer?.id !== `${surface}.${record.id}.controller` || !planned.consumer?.path || !planned.consumer?.authority) fail(`${label}: missing planned consumer`);
        if (!Array.isArray(planned?.articles) || planned.articles.length !== 2 || !['en','zh-HK'].every((locale,index) => planned.articles[index]?.id === `article.${surface}.${record.id}.${locale}` && planned.articles[index]?.path)) fail(`${label}: missing planned localized articles`);
        if (!Array.isArray(planned?.copy) || planned.copy.length !== 3 || !['en','zh-HK','bilingual'].every((locale,index) => planned.copy[index]?.id === `copy.${surface}.${record.id}.${locale}` && planned.copy[index]?.path)) fail(`${label}: missing planned localized copy`);
        if (planned?.persistence?.id !== `state.${surface}.${record.id}` || !planned.persistence.store) fail(`${label}: missing planned persistence`);
        if (!Array.isArray(planned?.tests) || planned.tests.length !== 2 || !['interaction','negative'].every((kind,index) => planned.tests[index]?.id === `test.${surface}.${record.id}.${kind}` && planned.tests[index]?.path)) fail(`${label}: missing planned tests`);
        if (planned?.runtime?.id !== `runtime.${surface}.${record.id}` || !planned.runtime.tupleIdTemplate || planned.runtime.sourceRevision !== null || planned.runtime.builtHash !== null) fail(`${label}: missing or falsely proven planned runtime`);
      } else if (planned?.state !== 'excluded-pending-canonical-review' || !planned.runtime?.reason) fail(`${label}: missing exact exclusion reason`);
      if (required && plainObject(planned)) {
        if (!plainObject(planned.consumer)) fail(`${label}: malformed planned consumer`);
        plannedPath(planned.consumer?.path, `${label}/consumer`);
        plannedPath(planned.consumer?.requestContract, `${label}/requestContract`);
        for (const field of ['id','operation','authority','behavior']) plannedString(planned.consumer?.[field], `${label}/consumer/${field}`, field === 'operation' || field === 'id' ? 256 : 4096);
        for (const group of ['articles','copy','tests']) for (const item of Array.isArray(planned[group]) ? planned[group] : []) {
          if (!plainObject(item)) { fail(`${label}/${group}: malformed planned row`); continue; }
          plannedPath(item.path, `${label}/${group}`);
          plannedString(item.id, `${label}/${group}/id`, 256);
        }
        const store = planned.persistence?.store;
        if (surface === 'A') plannedPath(store, `${label}/store`);
        else if (!boundedString(store, 512) || store !== (surface === 'R' ? `repository-record:${record.id}` : `browser-local:${surface}:feature:${record.id}`)) fail(`${label}/store: invalid bounded planned store reference`);
        plannedString(planned.runtime?.id, `${label}/runtime/id`, 256);
        plannedString(planned.runtime?.tupleIdTemplate, `${label}/runtime/tuple`, 512);
        if (surface !== 'R') {
          plannedPath(planned.runtime?.capture?.path, `${label}/capture`);
          plannedString(planned.runtime?.capture?.id, `${label}/capture/id`, 256);
          if (JSON.stringify(planned.runtime?.scales) !== JSON.stringify([100,125,150,200])) fail(`${label}: invalid planned display-scale axes`);
          if (surface === 'A' && JSON.stringify(planned.runtime?.viewports) !== JSON.stringify(['minimum-960x640','normal-1440x960'])) fail(`${label}: invalid planned desktop viewport axes`);
        }
      }
      if (entry.state !== 'complete') continue;
      if (!required) fail(`${label}: out-of-scope record cannot claim completion`);
      if (record.reconciliation !== 'reviewed') fail(`${label}: canonical reconciliation not reviewed`);
      if (!sha.test(entry.sourceRevision || '') || !digest.test(entry.builtHash || '')) fail(`${label}: missing source/build binding`);
      for (const key of ['implementationConsumers','articles','localizedCopy','focusedTests','negativeTests']) checkFiles(entry[key], `${label}/${key}`);
      if (entry.persistence?.state === 'pending') fail(`${label}: persistence pending`);
      if (entry.persistence?.state === 'required') checkFiles(entry.persistence.paths, `${label}/persistence`);
      if (entry.persistence?.state === 'not-applicable' && !entry.persistence.reason) fail(`${label}: persistence waiver needs reason`);
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
