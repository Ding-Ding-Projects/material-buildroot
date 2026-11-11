'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createHaosService } = require('../src/main/execution/haos-service.cjs');
const { discoverContainerRecipe, planContainerImageBuild } = require('../src/main/execution/haos-container-image.cjs');

function repository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'haos-repo-'));
  const osDir = path.join(root, 'operating-system');
  for (const dir of ['buildroot', 'buildroot-external/configs', 'core', 'build', 'frontend']) fs.mkdirSync(path.join(root, dir.startsWith('buildroot') ? path.join('operating-system', dir) : dir), { recursive: true });
  for (const [name, text] of [['Makefile', ''], ['Dockerfile', ''], ['buildroot/Makefile', ''], ['buildroot-external/external.desc', 'name: HAOS\n'], ['buildroot-external/configs/ova_defconfig', '']]) fs.writeFileSync(path.join(osDir, name), text);
  fs.writeFileSync(path.join(root, 'versions.json'), JSON.stringify({ core: '2026.11.1', core_base_image: '2026.10.3' }));
  for (const name of ['core/Dockerfile', 'build/frontend.Dockerfile', 'build/translations.Dockerfile', 'frontend/package.json']) fs.writeFileSync(path.join(root, name), '');
  return root;
}

function service(picks) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'haos-out-'));
  const dialog = { showOpenDialog: async () => { const next = picks.shift(); return next ? { canceled: false, filePaths: [next] } : { canceled: true, filePaths: [] }; } };
  return { output, haos: createHaosService({ dialog, parentWindow: () => null, defaultOutput: output }) };
}

test('choosing a repository lists its boards and its container recipe', async () => {
  const root = repository();
  const { haos, output } = service([root]);
  const reply = await haos.request({ action: 'choose-source' });
  assert.equal(reply.ok, true);
  assert.deepEqual(reply.result.source.defconfigs, ['ova']);
  assert.equal(reply.result.source.containerRecipe, true);
  assert.equal(reply.result.source.core, '2026.11.1');
  assert.equal(reply.result.output, output);
  assert.equal(reply.result.job, null);
});

test('a cancelled folder choice keeps the previous state', async () => {
  const { haos } = service([]);
  const reply = await haos.request({ action: 'choose-source' });
  assert.equal(reply.ok, true);
  assert.equal(reply.result.source, null);
});

test('an unrelated folder is refused', async () => {
  const { haos } = service([fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'))]);
  assert.equal((await haos.request({ action: 'choose-source' })).code, 'HAOS_SOURCE_UNRECOGNISED');
});

test('start needs a source and a board the tree lists, and requests are validated', async () => {
  const { haos } = service([repository()]);
  assert.equal((await haos.request({ action: 'start', kind: 'image', defconfig: 'ova' })).code, 'HAOS_SOURCE_REQUIRED');
  await haos.request({ action: 'choose-source' });
  assert.equal((await haos.request({ action: 'start', kind: 'image', defconfig: 'rpi5_64' })).code, 'HAOS_DEFCONFIG_UNKNOWN');
  assert.equal((await haos.request({ action: 'start', kind: 'shell' })).code, 'INVALID_REQUEST');
  assert.equal((await haos.request({ action: 'run-command' })).code, 'INVALID_REQUEST');
  assert.equal((await haos.request(null)).code, 'INVALID_REQUEST');
  assert.equal((await haos.request({ action: 'cancel' })).code, 'HAOS_NO_RUNNING_JOB');
});

test('the container plan follows the repository recipe and never pushes', () => {
  const root = repository();
  const recipe = discoverContainerRecipe(root);
  const stage = path.join(os.tmpdir(), 'stage'), scratch = path.join(os.tmpdir(), 'scratch');
  const steps = planContainerImageBuild({ recipe, stage, scratch, commit: 'a'.repeat(40) });
  assert.deepEqual(steps.map(s => s.id), ['frontend-wheel', 'translations', 'translations-extract', 'image-origin', 'core-image', 'inspect']);
  const core = steps.find(s => s.id === 'core-image').args;
  assert.ok(core.includes('BUILD_FROM=ghcr.io/home-assistant/amd64-homeassistant-base:2026.10.3'));
  assert.ok(core.includes('home-assistant-material:local'));
  assert.ok(steps.every(s => !s.args?.includes('push')));
  assert.throws(() => planContainerImageBuild({ recipe, stage, scratch, commit: 'HEAD' }), /container-commit-invalid/);
  assert.throws(() => planContainerImageBuild({ recipe, stage, scratch, commit: 'a'.repeat(40), tag: 'Bad Tag' }), /container-tag-invalid/);
});

test('stage cleanup removes read-only files such as Git pack files', () => {
  const { removeTree } = require('../src/main/execution/haos-runner.cjs');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'haos-stage-'));
  const packs = path.join(folder, '.git', 'objects', 'pack');
  fs.mkdirSync(packs, { recursive: true });
  const pack = path.join(packs, 'pack-1.pack');
  fs.writeFileSync(pack, 'x');
  fs.chmodSync(pack, 0o444);
  removeTree(folder);
  assert.equal(fs.existsSync(folder), false);
});
