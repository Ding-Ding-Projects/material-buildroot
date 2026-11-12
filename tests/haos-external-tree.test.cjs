'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { discoverHaosTree, planHaosBuild, planHaosCollect, planHaosCleanup, versionFromMeta } = require('../src/main/execution/haos-external-tree.cjs');

function fixture(defconfigs = ['ova', 'rpi5_64']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'haos-tree-'));
  const osDir = path.join(root, 'operating-system');
  for (const dir of ['buildroot', 'buildroot-external/configs']) fs.mkdirSync(path.join(osDir, dir), { recursive: true });
  fs.writeFileSync(path.join(osDir, 'Makefile'), 'all:\n');
  fs.writeFileSync(path.join(osDir, 'Dockerfile'), 'FROM debian:trixie\n');
  fs.writeFileSync(path.join(osDir, 'buildroot/Makefile'), '');
  fs.writeFileSync(path.join(osDir, 'buildroot-external/external.desc'), 'name: HAOS\ndesc: tree\n');
  fs.writeFileSync(path.join(osDir, 'buildroot-external/meta'), 'VERSION_MAJOR="18"\nVERSION_MINOR="5"\n');
  for (const name of defconfigs) fs.writeFileSync(path.join(osDir, 'buildroot-external/configs', `${name}_defconfig`), '');
  fs.writeFileSync(path.join(osDir, 'buildroot-external/configs', 'README'), '');
  return { root, osDir };
}

test('discovers the external tree from a repository root or the tree itself', () => {
  const { root, osDir } = fixture();
  const fromRoot = discoverHaosTree(root);
  assert.equal(fromRoot.osDir, osDir);
  assert.deepEqual(fromRoot.defconfigs, ['ova', 'rpi5_64']);
  assert.equal(fromRoot.externalName, 'HAOS');
  assert.equal(fromRoot.version, '18.5');
  assert.equal(discoverHaosTree(osDir).osDir, osDir);
});

test('discovery refuses incomplete trees and relative paths', () => {
  const { root, osDir } = fixture();
  fs.rmSync(path.join(osDir, 'buildroot-external/external.desc'));
  assert.equal(discoverHaosTree(root), null);
  assert.equal(discoverHaosTree(fixture([]).root), null);
  assert.throws(() => discoverHaosTree('relative/path'), /haos-root-must-be-absolute/);
});

test('reads quoted and unquoted versions from meta', () => {
  assert.equal(versionFromMeta('VERSION_MAJOR=17\nVERSION_MINOR=2\n'), '17.2');
  assert.equal(versionFromMeta('VERSION_MAJOR="18"\nVERSION_MINOR="5"\n'), '18.5');
  assert.equal(versionFromMeta('nothing'), null);
});

test('plans the tree recipe with a volume-backed source and an unprivileged builder user', () => {
  const tree = discoverHaosTree(fixture().root);
  const { names, steps } = planHaosBuild({ tree, defconfig: 'ova', workspaceId: 'abcdef012345' });
  assert.deepEqual(steps.map(s => s.id), ['builder-image', 'build-volume', 'cache-volume', 'source-export', 'image-build']);
  assert.equal(steps[0].args.at(-1), '-');
  assert.equal(steps[0].stdinFrom, 'archive');
  assert.equal(steps.find(s => s.id === 'source-export').stdinFrom, 'archive');
  const build = steps.at(-1).args;
  assert.ok(build.includes('BUILDER_UID=1000') && build.includes('BUILDER_GID=1000'));
  assert.ok(build.includes(`${names.buildVolume}:/build`) && build.includes(`${names.cacheVolume}:/cache`));
  assert.equal(build.at(-1), 'make ova');
  assert.ok(!build.some(arg => arg.includes(tree.osDir)), 'the source checkout is never mounted into the build');
});

test('a pinned version feed is copied in and passed to make', () => {
  const tree = discoverHaosTree(fixture().root);
  const { steps } = planHaosBuild({ tree, defconfig: 'rpi5_64', workspaceId: 'abcdef012345', versionJson: '{"supervisor":"1"}' });
  assert.equal(steps.find(s => s.id === 'version-pin').stdinFrom, 'versionJson');
  // make runs as the builder user, so the root-written file must be handed over.
  assert.match(steps.find(s => s.id === 'version-pin').args.at(-1), /chown 1000:1000 \/build\/version-pinned\.json$/);
  assert.equal(steps.at(-1).args.at(-1), 'make HAOS_VERSION_JSON=/build/version-pinned.json rpi5_64');
  assert.throws(() => planHaosBuild({ tree, defconfig: 'ova', workspaceId: 'abcdef012345', versionJson: 'not json' }));
});

test('rejects unknown defconfigs, bad workspace ids and unsafe destinations', () => {
  const tree = discoverHaosTree(fixture().root);
  assert.throws(() => planHaosBuild({ tree, defconfig: 'ova; rm -rf /', workspaceId: 'abcdef012345' }), /haos-defconfig-unknown/);
  assert.throws(() => planHaosBuild({ tree, defconfig: 'ova', workspaceId: '../x' }), /haos-workspace-id-invalid/);
  assert.throws(() => planHaosCollect({ workspaceId: 'abcdef012345', destination: 'relative' }), /haos-destination-invalid/);
  assert.throws(() => planHaosCollect({ workspaceId: 'abcdef012345', destination: path.resolve('a,b') }), /haos-destination-invalid/);
});

test('collect reads the build volume read-only and cleanup keeps the shared cache', () => {
  const destination = path.resolve('out-images');
  const collect = planHaosCollect({ workspaceId: 'abcdef012345', destination });
  assert.ok(collect.args.includes('material-buildroot-haos-abcdef012345-build:/build:ro'));
  assert.ok(collect.args.includes(`${destination}:/out`));
  const cleanup = planHaosCleanup({ workspaceId: 'abcdef012345' });
  assert.ok(cleanup.every(step => !step.args.includes('material-buildroot-haos-cache')));
});
