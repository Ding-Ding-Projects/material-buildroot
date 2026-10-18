'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const { execFileSync } = require('node:child_process');
const { SourceService } = require('../src/main/execution/source.cjs');
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const origin = path.join(root, 'origin'); fs.mkdirSync(origin);
  const git = (...args) => execFileSync('git', ['-C', origin, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main'); fs.writeFileSync(path.join(origin, 'Makefile'), 'all:\n\t@echo first\n'); git('add', '.'); git('commit', '-m', 'first'); const first = git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(origin, 'Makefile'), 'all:\n\t@echo second\n'); git('commit', '-am', 'second'); const second = git('rev-parse', 'HEAD');
  const service = new SourceService({ allowLocalFixture: true, acquireSourceLock: async () => () => {}, ...options }); t.after(() => service.dispose()); const grant = service.grantRoot(root); return { root, origin, first, second, service, grant };
}
test('valid synthetic repository adoption uses a bound private empty global configuration', async t => {
  const { service, grant, second } = fixture(t);
  const adopted = await service.adopt({ grantId: grant.grantId, directory: 'origin', trustedSource: true });
  assert.equal(adopted.revision, second);
  assert.equal(fs.lstatSync(service.globalConfig).isFile(), true);
  assert.equal(fs.lstatSync(service.globalConfig).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(service.globalConfig).length, 0);
  const hooks = service.hooks; service.dispose(); assert.equal(fs.existsSync(hooks), false);
});
test('empty source global configuration rejects content, replacement and aliases before native commands', async t => {
  for (const kind of ['content', 'replacement', 'hardlink', 'junction']) {
    const { service, grant, root } = fixture(t);
    const target = path.join(root, 'harmless-empty-config'); fs.writeFileSync(target, '');
    if (kind === 'content') fs.writeFileSync(service.globalConfig, '[alias]\nfixture = status\n');
    else {
      fs.renameSync(service.globalConfig, service.globalConfig + '-original');
      if (kind === 'replacement') fs.writeFileSync(service.globalConfig, '');
      else if (kind === 'hardlink') fs.linkSync(target, service.globalConfig);
      else fs.symlinkSync(root, service.globalConfig, process.platform === 'win32' ? 'junction' : 'dir');
    }
    await assert.rejects(service.adopt({ grantId: grant.grantId, directory: 'origin', trustedSource: true }), { code: 'SOURCE_GLOBAL_CONFIG_CHANGED' });
    assert.equal(fs.readFileSync(target).length, 0);
  }
});
test('source disposal refuses a replaced hooks directory and preserves its replacement', t => {
  const {service,root}=fixture(t),original=service.hooks+'-original';
  fs.renameSync(service.hooks,original);fs.mkdirSync(service.hooks);const marker=path.join(service.hooks,'marker');fs.writeFileSync(marker,'public fixture');
  try{assert.throws(()=>service.dispose(),/source-global-config-changed/);assert.equal(fs.readFileSync(marker,'utf8'),'public fixture');}
  finally{fs.rmSync(service.hooks,{recursive:true});fs.renameSync(original,service.hooks);}
});

test('clone preserves destination and upgrades only reviewed clean immutable revision', async t => {
  const { origin, first, second, service, grant } = fixture(t);
  const clone = await service.clone({ grantId: grant.grantId, directory: 'checkout', url: origin, ref: first, trustedSource: true }); assert.equal(clone.revision, first); assert.equal(clone.dirty, false);
  const preview = await service.previewUpgrade({ projectId: clone.projectId, revision: second }); assert.match(preview.diff, /Makefile/);
  const result = await service.applyUpgrade({ previewId: preview.previewId, expectedRevision: first, consent: true }); assert.equal(result.revision, second); assert.equal(result.rollbackRevision, first);
  const rollback = await service.previewUpgrade({ projectId: clone.projectId, revision: first }); assert.equal((await service.applyUpgrade({ previewId: rollback.previewId, expectedRevision: second, consent: true })).revision, first);
});
test('dirty tracked and untracked content survives rejected upgrade', async t => {
  const { origin, first, second, service, grant } = fixture(t); const clone = await service.clone({ grantId: grant.grantId, directory: 'checkout', url: origin, ref: first, trustedSource: true }); const preview = await service.previewUpgrade({ projectId: clone.projectId, revision: second });
  fs.writeFileSync(path.join(clone.source, 'notes.txt'), 'keep'); fs.appendFileSync(path.join(clone.source, 'Makefile'), '# dirty\n');
  await assert.rejects(service.applyUpgrade({ previewId: preview.previewId, expectedRevision: first, consent: true }), /dirty/); assert.equal(fs.readFileSync(path.join(clone.source, 'notes.txt'), 'utf8'), 'keep'); assert.equal((await service.status(clone.projectId)).revision, first);
});
test('source acquisition rejects protocols, traversal, nonempty roots, refs and missing trust', async t => {
  const { root, service, grant, origin } = fixture(t);
  for (const url of ['ssh://host/repo', 'https://user:secret@example.invalid/repo', 'https://example.invalid/a?token=x', 'ext::id', 'https://example.invalid/a\n']) assert.throws(() => service.url(url), /unsafe/);
  assert.throws(() => service.destination(grant.grantId, '../escape'), /grant/);
  await assert.rejects(service.clone({ grantId: grant.grantId, directory: 'origin', url: origin, trustedSource: true }), /not-empty/);
  await assert.rejects(service.clone({ grantId: grant.grantId, directory: 'new', url: origin, trustedSource: false }), /trust/);
  await assert.rejects(service.clone({ grantId: grant.grantId, directory: 'new', url: origin, ref: '--upload-pack=id', trustedSource: true }), /ref/);
  require('./helpers/filesystem-links.cjs').symlinkSync(origin, path.join(root, 'alias')); assert.throws(() => service.destination(grant.grantId, 'alias'), /alias/);
  const production = new SourceService(); t.after(() => production.dispose()); assert.throws(() => production.url(origin), /unsafe/);
});
test('external source-lock denial prevents upgrade writes', async t => {
  let blocked = false; const { origin, first, second, service, grant } = fixture(t, { acquireSourceLock: async () => { if (blocked) throw Error('active-build'); return () => {}; } });
  const clone = await service.clone({ grantId: grant.grantId, directory: 'checkout', url: origin, ref: first, trustedSource: true }); const preview = await service.previewUpgrade({ projectId: clone.projectId, revision: second }); blocked = true;
  await assert.rejects(service.applyUpgrade({ previewId: preview.previewId, expectedRevision: first, consent: true }), /active-build/); assert.equal((await service.status(clone.projectId)).revision, first);
});
test('fetch acquires exact ref without changing current source', async t => {
  const { origin, first, second, service, grant } = fixture(t); const clone = await service.clone({ grantId: grant.grantId, directory: 'checkout', url: origin, ref: first, trustedSource: true }); const fetched = await service.acquireRef({ projectId: clone.projectId, ref: 'main' }); assert.equal(fetched.fetchedRevision, second); assert.equal(fetched.revision, first);
});
test('upgrade refuses mutation without a host source ownership lock', async t => {
  const { origin, first, second, service, grant } = fixture(t, { acquireSourceLock: null }); const clone = await service.clone({ grantId: grant.grantId, directory: 'checkout', url: origin, ref: first, trustedSource: true }); const preview = await service.previewUpgrade({ projectId: clone.projectId, revision: second }); await assert.rejects(service.applyUpgrade({ previewId: preview.previewId, expectedRevision: first, consent: true }), /lock-unavailable/); assert.equal((await service.status(clone.projectId)).revision, first);
});
