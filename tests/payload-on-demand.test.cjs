'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {createPayloadManager} = require('../src/main/tools/payload-manager.cjs');
const registry = require('../scripts/build/offline-payloads.json');
const {installOnDemandPayload} = require('../scripts/build/payloads.cjs');

const hash = value => createHash('sha256').update(value).digest('hex');
async function fixture(work) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'payload-on-demand-'));
  try { await work(directory); } finally { await fs.rm(directory, {recursive:true, force:true}); }
}
// Writes the same folder layout the real installer produces: manifest.json plus <id>/<files>.
async function fakeInstall(root, id) {
  const target = path.join(root, id), bytes = Buffer.from('tool bytes for ' + id);
  await fs.mkdir(path.join(target, id), {recursive:true});
  await fs.writeFile(path.join(target, id, id + '.exe'), bytes);
  const manifest = {schemaVersion:1, platform:'win32-x64', scope:'on-demand-payload',
    tools:[{id, version:'1.0', executable:id + '/' + id + '.exe', files:[{path:id + '/' + id + '.exe', bytes:bytes.length, sha256:hash(bytes)}]}]};
  await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest));
  return target;
}
function manager(directory, install) {
  return createPayloadManager({directory, bundledManifest:{}, onDemand:{ids:['pandoc'], install}});
}

test('listing reports an on-demand tool without starting a download', () => fixture(async directory => {
  let calls = 0;
  const list = await manager(directory, async () => { calls++; }).list();
  const pandoc = list.find(item => item.toolId === 'pandoc');
  assert.equal(pandoc.available, false);
  assert.equal(pandoc.onDemand, true);
  assert.equal(pandoc.code, 'ON_DEMAND_NOT_DOWNLOADED');
  assert.equal(list.find(item => item.toolId === 'qpdf').onDemand, false);
  assert.equal(calls, 0);
}));

test('the first operation downloads once, and later operations reuse the verified copy', () => fixture(async directory => {
  let calls = 0;
  const install = async id => { calls++; await new Promise(resolve => setTimeout(resolve, 20)); return fakeInstall(path.join(directory, 'on-demand'), id); };
  const payloads = manager(directory, install);
  const [first, second] = await Promise.all([payloads.resolve('pandoc'), payloads.resolve('pandoc')]);
  assert.equal(calls, 1);
  assert.equal(first.origin, 'on-demand');
  assert.equal(first.path, second.path);
  await payloads.resolve('pandoc');
  assert.equal((await manager(directory, install).resolve('pandoc')).origin, 'on-demand');
  assert.equal(calls, 1);
}));

test('a failed download is reported, leaves nothing behind, and can be retried', () => fixture(async directory => {
  let fail = true;
  const payloads = manager(directory, async id => { if (fail) throw new Error('offline'); return fakeInstall(path.join(directory, 'on-demand'), id); });
  await assert.rejects(payloads.resolve('pandoc'), {code:'ON_DEMAND_DOWNLOAD_FAILED'});
  fail = false;
  assert.equal((await payloads.resolve('pandoc')).origin, 'on-demand');
}));

test('a changed downloaded file fails closed instead of being trusted or replaced', () => fixture(async directory => {
  const payloads = manager(directory, id => fakeInstall(path.join(directory, 'on-demand'), id));
  const record = await payloads.resolve('pandoc');
  await fs.appendFile(record.path, 'changed');
  await assert.rejects(payloads.resolve('pandoc'), {code:'PAYLOAD_HASH_MISMATCH'});
}));

test('the registry splits pinned tools into bundled and on-demand sets with no overlap', async () => {
  const bundled = new Set(registry.requiredBundledToolIds), onDemand = new Set(registry.onDemandToolIds);
  assert.ok(onDemand.size > 0);
  for (const id of onDemand) assert.ok(!bundled.has(id));
  for (const id of [...bundled, ...onDemand]) assert.ok(registry.tools.some(tool => tool.id === id), id);
  // The native file broker loads these from installed resources only.
  for (const id of ['magick', 'ffmpeg', 'qpdf']) assert.ok(bundled.has(id), id);
  await assert.rejects(installOnDemandPayload({id:'qpdf', directory:os.tmpdir(), cache:os.tmpdir()}), /not an on-demand payload/);
});
