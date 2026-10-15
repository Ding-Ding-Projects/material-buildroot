'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const phases = Array.from({length: 11}, (_, i) => `PH${String(i).padStart(2, '0')}`);
function validate(ledger, {root = path.resolve(__dirname, '../..')} = {}) {
  const errors = [];
  const fail = message => errors.push(message);
  const plain = x => x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype;
  const text = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 4096 && !/[\x00-\x1f]/.test(x);
  if (!plain(ledger) || ledger.schemaVersion !== 1 || !Array.isArray(ledger.phases)) return ['Invalid admission schema'];
  const realRoot = fs.realpathSync(root);
  const inside = p => {const r = path.relative(realRoot, p); return r && !r.startsWith(`..${path.sep}`) && r !== '..' && !path.isAbsolute(r);};
  const file = (item, label, prefix) => {
    if (!plain(item) || !text(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256 || '')) {fail(`${label}: invalid file binding`); return;}
    if (path.isAbsolute(item.path) || /[\\:]/.test(item.path) || item.path.split('/').some(p => !p || p === '.' || p === '..') || (prefix && !item.path.startsWith(prefix))) {fail(`${label}: invalid repository path`); return;}
    try {const resolved = fs.realpathSync(path.resolve(root, item.path)); if (!inside(resolved) || !fs.statSync(resolved).isFile()) fail(`${label}: outside repository or not a file`); else if (hash(fs.readFileSync(resolved)) !== item.sha256) fail(`${label}: stale hash ${item.path}`);} catch {fail(`${label}: missing file ${item.path}`);}
  };
  const ids = new Set();
  for (const row of ledger.phases) {
    if (!plain(row)) {fail('Invalid phase'); continue;}
    if (!phases.includes(row.id) || ids.has(row.id)) fail('Unknown or duplicate phase');
    ids.add(row.id);
    const label = row.id;
    if (!text(row.contract) || !text(row.authority) || !text(row.persistence) || !text(row.acceptanceGap)) fail(`${label}: missing concrete architecture contract`);
    if (!['planned', 'authored', 'tested', 'native-deferred'].includes(row.state)) fail(`${label}: invalid state`);
    if (row.accepted !== false) fail(`${label}: phase acceptance is outside this registry`);
    if (!/^[a-f0-9]{40}$/.test(row.sourceRevision || '')) fail(`${label}: invalid source revision`);
    for (const [key, prefix] of [['consumers', null], ['tests', 'tests/'], ['documents', 'docs/']]) {
      if (!Array.isArray(row[key]) || (row.state !== 'planned' && !row[key].length)) {fail(`${label}: missing ${key}`); continue;}
      const paths = new Set();
      for (const item of row[key]) {file(item, `${label}.${key}`, prefix); if (paths.has(item?.path)) fail(`${label}: duplicate ${key} path`); paths.add(item?.path); if(key === 'consumers' && !/^(src\/|scripts\/|docs\/site\/)/.test(item?.path || '')) fail(`${label}: invalid consumer location`);}
    }
    if (row.state === 'planned' && (row.consumers?.length || row.tests?.length)) fail(`${label}: planned records cannot claim implementation`);
    if (!Array.isArray(row.receipts)) {fail(`${label}: missing receipts`); continue;}
    if (row.state === 'tested' && !row.receipts.length) fail(`${label}: tested state requires receipts`);
    for (const receipt of row.receipts) {
      if (!plain(receipt) || receipt.sourceRevision !== row.sourceRevision || !/^[a-f0-9]{64}$/.test(receipt.builtHash || '') || receipt.exitCode !== 0 || !text(receipt.command) || !text(receipt.environment) || !Number.isFinite(Date.parse(receipt.recordedAt))) {fail(`${label}: invalid test receipt`); continue;}
      file(receipt.output, `${label}.receipt.output`);
      file(receipt.buildArtifact, `${label}.receipt.buildArtifact`);
      if (receipt.buildArtifact?.sha256 !== receipt.builtHash) fail(`${label}: build hash is not bound to artifact`);
      if (!Array.isArray(receipt.bindings) || !receipt.bindings.length) fail(`${label}: receipt lacks source bindings`);
      const receiptBindings = Array.isArray(receipt.bindings) ? receipt.bindings : [];
      const bindings = new Map(receiptBindings.filter(plain).map(x => [x.path, x.sha256]));
      for (const binding of [...(Array.isArray(row.consumers) ? row.consumers : []), ...(Array.isArray(row.tests) ? row.tests : [])].filter(plain)) if (bindings.get(binding.path) !== binding.sha256) fail(`${label}: receipt missing current source/test binding`);
      for (const binding of receiptBindings) file(binding, `${label}.receipt.binding`);
    }
    if (row.state === 'native-deferred' && !text(row.deferredReason)) fail(`${label}: native deferral requires a reason`);
    if (row.state === 'authored' && row.receipts.length) fail(`${label}: authored state cannot claim test receipts`);
  }
  for (const phase of phases) if (!ids.has(phase)) fail(`Missing ${phase}`);
  return errors;
}
if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const errors = validate(JSON.parse(fs.readFileSync(path.join(root, 'docs/planning/implementation-admission.json'), 'utf8')), {root});
  if (errors.length) {console.error(errors.join('\n')); process.exitCode = 1;} else console.log('Implementation admission bindings valid; phase acceptance remains separate.');
}
module.exports = {validate, hash};
