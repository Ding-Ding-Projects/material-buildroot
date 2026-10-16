'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096 && !/[\x00-\x1f\x7f]/u.test(value);
function reader(root, errors) {
  const base = fs.realpathSync(root);
  return (binding, label, json = false) => {
    if (!plain(binding) || !text(binding.path) || !/^[a-f0-9]{64}$/.test(binding.sha256 || '') || /[\\:]/.test(binding.path) || path.posix.isAbsolute(binding.path) || binding.path.split('/').some(p => !p || p !== p.trim() || p === '.' || p === '..')) { errors.push(`${label}: invalid file binding`); return; }
    try {
      const target = fs.realpathSync(path.resolve(base, binding.path));
      const relative = path.relative(base, target);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !fs.statSync(target).isFile()) throw new Error('outside repository');
      const bytes = fs.readFileSync(target);
      if (sha256(bytes) !== binding.sha256) { errors.push(`${label}: stale file hash ${binding.path}`); return; }
      return json ? JSON.parse(bytes.toString('utf8')) : bytes;
    } catch { errors.push(`${label}: missing, escaped or unreadable file ${binding.path}`); }
  };
}
function validateSurfaceProof(entry, { root, label, surface }) {
  const errors = [];
  const read = reader(root, errors);
  const fail = message => errors.push(`${label}: ${message}`);
  const current = receipt => plain(receipt) && receipt.schemaVersion === 1 && receipt.workId === entry.workId && receipt.sourceRevision === entry.sourceRevision && receipt.builtHash === entry.builtHash && receipt.status === 'verified' && text(receipt.recordedAt) && Number.isFinite(Date.parse(receipt.recordedAt)) && text(receipt.environment);
  const required = ['implementationConsumers', 'articles', 'localizedCopy', 'focusedTests', 'negativeTests'];
  const sourceBindings = required.flatMap(key => Array.isArray(entry[key]) ? entry[key] : []).concat(entry.persistence?.state === 'required' && Array.isArray(entry.persistence.paths) ? entry.persistence.paths : []);
  if (!/^[a-f0-9]{40}$/.test(entry.sourceRevision || '') || !/^[a-f0-9]{64}$/.test(entry.builtHash || '')) fail('invalid source/build identifiers');
  else for (const binding of sourceBindings) {
    if (!plain(binding) || !text(binding.path) || /[\\:\x00-\x1f]/.test(binding.path) || binding.path.startsWith('/') || binding.path.split('/').some(part => !part || part === '.' || part === '..')) { fail('invalid revision file binding'); continue; }
    try {
      const bytes = execFileSync('git', ['show', `${entry.sourceRevision}:${binding.path}`], {cwd: root, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore','pipe','ignore']});
      if (sha256(bytes) !== binding.sha256) fail(`source revision does not contain bound bytes ${binding.path}`);
    } catch { fail(`source revision file unavailable ${binding.path}`); }
  }
  const receipts = {};
  for (const kind of ['source', 'runtime', 'capture', 'parity']) {
    const proof = entry.proof?.[kind];
    const receipt = read(proof?.receipt, `${label}/${kind}/receipt`, true);
    receipts[kind] = receipt;
    if (!current(receipt) || receipt.kind !== kind) { fail(`${kind}: absent or stale receipt contents`); continue; }
    read(receipt.buildArtifact, `${label}/${kind}/build`);
    if (receipt.buildArtifact?.sha256 !== entry.builtHash) fail(`${kind}: build bytes do not match builtHash`);
    if (!Array.isArray(receipt.bindings) || !receipt.bindings.length) { fail(`${kind}: missing current source bindings`); continue; }
    const bindings = new Map();
    for (const binding of receipt.bindings) {
      read(binding, `${label}/${kind}/binding`);
      if (bindings.has(binding?.path)) fail(`${kind}: duplicate source binding`);
      bindings.set(binding?.path, binding?.sha256);
    }
    for (const binding of sourceBindings) if (bindings.get(binding?.path) !== binding?.sha256) fail(`${kind}: missing implementation/article/copy/test/persistence binding`);
    if (kind === 'source') {
      if (!Array.isArray(receipt.articles) || !['en', 'zh-HK'].every(locale => receipt.articles.some(article => article?.locale === locale && (Array.isArray(entry.articles) ? entry.articles : []).some(binding => binding?.path === article.path && binding?.sha256 === article.sha256)))) fail('source: missing current English/Cantonese article bindings');
    } else if (receipt.exitCode !== 0 || !text(receipt.command) || !text(receipt.method)) fail(`${kind}: missing successful execution context`);
  }
  const plan = entry.plannedAdmission?.runtime;
  const axes = ['states', 'languages', 'themes', 'scales', 'viewports'];
  let tuples = [{}];
  for (const axis of axes) {
    const values = plan?.[axis];
    if (!Array.isArray(values) || !values.length || values.length > 64 || new Set(values).size !== values.length) { fail(`missing or duplicate planned ${axis}`); tuples = []; break; }
    if (tuples.length * values.length > 65536) { fail('planned matrix exceeds bounded tuple limit'); tuples = []; break; }
    const key = {states:'state', languages:'language', themes:'theme', scales:'scale', viewports:'viewport'}[axis];
    tuples = tuples.flatMap(tuple => values.map(value => ({...tuple, [key]:value})));
  }
  // Process-only surfaces may provide a separately declared execution matrix, never a fabricated visual waiver.
  if (surface === 'R' && !plan?.viewports) { fail('process surface requires explicit execution/parity matrix before completion'); }
  const template = plan?.tupleIdTemplate;
  for (const kind of ['runtime', 'capture', 'parity']) {
    const receipt = receipts[kind];
    if (!current(receipt)) continue;
    if (!Array.isArray(receipt.tuples)) { fail(`${kind}: missing tuple inventory`); continue; }
    const actual = new Map();
    for (const tuple of receipt.tuples) {
      if (!plain(tuple) || !text(tuple.id) || actual.has(tuple.id)) { fail(`${kind}: invalid or duplicate tuple`); continue; }
      actual.set(tuple.id, tuple);
      if (tuple.status !== 'verified' || tuple.sourceRevision !== entry.sourceRevision || tuple.builtHash !== entry.builtHash) fail(`${kind}: unverified or stale tuple`);
      read(tuple.output, `${label}/${kind}/${tuple.id}/output`);
      if (kind === 'capture' && (tuple.inspected !== true || tuple.privacy !== 'approved' || !text(tuple.method))) fail('capture: missing inspection, privacy or real capture method');
      if (kind === 'parity') {
        read(tuple.reference, `${label}/parity/${tuple.id}/reference`);
        read(tuple.comparison, `${label}/parity/${tuple.id}/comparison`);
        if (tuple.matches !== true || !text(tuple.method)) fail('parity: absent comparison verdict or method');
      }
    }
    for (const tuple of tuples) {
      const id = typeof template === 'string' ? template.replace(/\{(state|language|theme|scale|viewport)\}/g, (_, key) => tuple[key]) : '';
      const found = actual.get(id);
      if (!id || !found || Object.entries(tuple).some(([key, value]) => found[key] !== value)) fail(`${kind}: missing exact planned tuple ${id}`);
    }
    if (actual.size !== tuples.length) fail(`${kind}: tuple inventory differs from planned matrix`);
  }
  return errors;
}
function validateConsumerInventory(section, ledger, {root}) {
  const errors = [];
  const read = reader(root, errors);
  if (!plain(section) || section.workId !== 'PH01-T02-C02' || section.identityCount !== 109 || section.surfaceRecordCount !== 436 || !Array.isArray(section.records)) return ['Invalid surfaceConsumerAdmission inventory'];
  read(section.ledgerBinding, 'surfaceConsumerAdmission/ledger');
  if (section.ledger !== 'docs/planning/feature-evidence.json' || section.ledgerBinding?.path !== section.ledger || !/^[a-f0-9]{40}$/.test(section.sourceRevision || '')) errors.push('Invalid consumer inventory source/ledger binding');
  const expected = new Map((ledger.identities || []).flatMap(identity => ['A','D','C','R'].map(surface => [`${identity.id}/${surface}`, identity.surfaces?.[surface]])));
  const seen = new Set();
  for (const row of section.records) {
    const id = `${row?.identity}/${row?.surface}`;
    const entry = expected.get(id);
    if (!plain(row) || !entry || seen.has(id)) { errors.push(`Unknown or duplicate consumer inventory row ${id}`); continue; }
    seen.add(id);
    if (!['existing-bounded-consumer-pending-admission','historical-source-candidates-pending-current-admission','historically-reported-gap-pending-current-binding','conditional-or-inapplicable-per-ledger-pending-reconciliation','outside-catalogue-runtime-scope-supporting-record-retained'].includes(row.disposition)) errors.push(`${id}: unsupported inventory disposition`);
    if (row.workId !== entry.workId || row.applicability !== entry.applicability || row.accepted !== false || row.independentlyAdmitted !== false || !text(row.limitation)) errors.push(`${id}: inventory cannot claim independent acceptance`);
    if (!Array.isArray(row.consumers)) errors.push(`${id}: missing consumer inventory`);
    for (const binding of Array.isArray(row.consumers) ? row.consumers : []) read(binding, `${id}/bounded-consumer`);
    if (row.disposition !== 'existing-bounded-consumer-pending-admission' && row.consumers?.length) errors.push(`${id}: historical or uninspected candidates cannot be current consumers`);
    // Historical references are deliberately not current-file proofs. Their stale hashes do not establish current absence or acceptance.
    for (const key of ['articles','localizedCopy','persistence','focusedTests']) if (!plain(row[key]) || !Array.isArray(row[key].bindings) || row[key].bindings.length || !/^pending-/.test(row[key].state || '')) errors.push(`${id}: ${key} must remain explicitly unadmitted`);
    for (const key of ['runtime','capture']) if (row[key]?.state !== 'pending' || row[key]?.receipt !== null) errors.push(`${id}: ${key} inventory must not claim execution`);
  }
  if (seen.size !== expected.size || section.records.length !== 436) errors.push('Consumer inventory must preserve all 109 identities and 436 independent surfaces');
  return errors;
}
module.exports = {validateSurfaceProof, validateConsumerInventory};
