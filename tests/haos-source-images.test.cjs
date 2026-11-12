'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { discoverSourceImages, boardOf, selectImages, registriesConf, planSourceImages, planPush, planSourceCleanup, verifyEmbedded, planLoad, buildTag } = require('../src/main/execution/haos-source-images.cjs');
const { discoverHaosTree, planHaosBuild } = require('../src/main/execution/haos-external-tree.cjs');

const WS = 'abcdef012345', SHA = 'a'.repeat(40);
const FEED = JSON.stringify({
  supervisor: '2026.11.0.132', homeassistant: { default: '2026.11.1.132' },
  images: { core: 'ghcr.io/ding-ding-projects/{machine}-homeassistant', supervisor: 'ghcr.io/ding-ding-projects/{arch}-hassio-supervisor',
    cli: 'ghcr.io/home-assistant/{arch}-hassio-cli', dns: 'ghcr.io/home-assistant/{arch}-hassio-dns' },
});

function repository({ sources = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'haos-src-'));
  const osDir = path.join(root, 'operating-system');
  for (const dir of ['buildroot', 'buildroot-external/configs']) fs.mkdirSync(path.join(osDir, dir), { recursive: true });
  fs.writeFileSync(path.join(osDir, 'Makefile'), 'all:\n');
  fs.writeFileSync(path.join(osDir, 'Dockerfile'), 'FROM debian:trixie\n');
  fs.writeFileSync(path.join(osDir, 'buildroot/Makefile'), '');
  fs.writeFileSync(path.join(osDir, 'buildroot-external/external.desc'), 'name: HAOS\n');
  fs.writeFileSync(path.join(osDir, 'buildroot-external/configs/ova_defconfig'), 'BR2_PACKAGE_HASSIO_ARCH="amd64"\nBR2_PACKAGE_HASSIO_MACHINE="qemux86-64"\n');
  fs.writeFileSync(path.join(osDir, 'buildroot-external/configs/rpi5_64_defconfig'), 'BR2_PACKAGE_HASSIO_ARCH="aarch64"\nBR2_PACKAGE_HASSIO_MACHINE="raspberrypi5-64"\n');
  fs.writeFileSync(path.join(root, 'versions.json'), JSON.stringify({ registry_owner: 'ding-ding-projects' }));
  if (sources) for (const dir of ['supervisor', 'landingpage']) { fs.mkdirSync(path.join(root, dir)); fs.writeFileSync(path.join(root, dir, 'Dockerfile'), 'FROM scratch\n'); }
  return { root, osDir };
}

test('finds image sources beside the OS tree and reads the board', () => {
  const { root, osDir } = repository();
  assert.deepEqual(discoverSourceImages(root), { repositoryRoot: root, prefix: 'ghcr.io/ding-ding-projects' });
  assert.equal(discoverSourceImages(repository({ sources: false }).root), null);
  assert.deepEqual(boardOf(osDir, 'ova'), { arch: 'amd64', machine: 'qemux86-64', platform: 'linux/amd64' });
  assert.deepEqual(boardOf(osDir, 'rpi5_64'), { arch: 'aarch64', machine: 'raspberrypi5-64', platform: 'linux/arm64' });
  assert.throws(() => discoverSourceImages('relative'), /must-be-absolute/);
});

test('builds the repository-owned Supervisor and landing page and leaves upstream plug-ins to the recipe', () => {
  const discovered = discoverSourceImages(repository().root);
  const selection = selectImages({ discovered, versionJson: FEED, arch: 'amd64', machine: 'qemux86-64' });
  assert.deepEqual(selection.fromSource.map(i => [i.id, i.image, i.tag]), [
    ['supervisor', 'ghcr.io/ding-ding-projects/amd64-hassio-supervisor', '2026.11.0.132'],
    ['landingpage', 'ghcr.io/ding-ding-projects/qemux86-64-homeassistant', 'landingpage'],
  ]);
  assert.deepEqual(selection.fetched, ['ghcr.io/home-assistant/amd64-hassio-cli', 'ghcr.io/home-assistant/amd64-hassio-dns']);
  // A feed that names someone else's registry builds nothing from source.
  const upstream = JSON.stringify({ supervisor: '1', images: { supervisor: 'ghcr.io/home-assistant/{arch}-hassio-supervisor', core: 'ghcr.io/home-assistant/{machine}-homeassistant' } });
  assert.equal(selectImages({ discovered, versionJson: upstream, arch: 'amd64', machine: 'qemux86-64' }).fromSource.length, 0);
});

test('plans a private registry, builds from committed contexts under build-only names, and stores them under the tree names', () => {
  const discovered = discoverSourceImages(repository().root);
  const selection = selectImages({ discovered, versionJson: FEED, arch: 'amd64', machine: 'qemux86-64' });
  const { names, steps } = planSourceImages({ selection, workspaceId: WS, platform: 'linux/amd64', commit: SHA, labels: ['--label', 'x=y'] });
  assert.deepEqual(steps.map(s => s.id), ['registry-network', 'registry', 'build-supervisor', 'build-landingpage']);
  assert.match(steps[1].args.join(' '), new RegExp(`--network material-buildroot-haos-${WS}-net registry@sha256:[a-f0-9]{64}$`));
  assert.ok(!steps[1].args.includes('--publish'), 'the registry publishes no port on this computer');
  const supervisor = steps[2];
  assert.equal(supervisor.stdinFrom, 'context:supervisor');
  assert.ok(supervisor.args.includes('--provenance=false') && supervisor.args.includes('BUILD_VERSION=2026.11.0.132'));
  assert.ok(supervisor.args.includes(`org.opencontainers.image.revision=${SHA}`));
  // Never tagged with the published name on this computer.
  assert.ok(!supervisor.args.some(a => a.startsWith('ghcr.io/')));
  assert.equal(supervisor.args.at(-2), buildTag(WS, selection.fromSource[0]));
  assert.equal(names.registry, `material-buildroot-haos-${WS}-registry`);
  const load = planLoad({ item: selection.fromSource[0], prefix: discovered.prefix, workspaceId: WS, builderImage: `material-buildroot-haos-builder:${WS}` });
  assert.equal(load.destination, `material-buildroot-haos-${WS}-registry:5000/ding-ding-projects/amd64-hassio-supervisor:2026.11.0.132`);
  assert.equal(load.step.stdinFrom, 'save:' + buildTag(WS, selection.fromSource[0]));
  assert.deepEqual(load.step.args.slice(0, 5), ['run', '-i', '--rm', '--network', `material-buildroot-haos-${WS}-net`]);
  assert.ok(load.step.args.at(-1).includes(`--digestfile /tmp/digest docker-archive:/tmp/image.tar docker://${load.destination} >&2; cat /tmp/digest`));
  assert.throws(() => planLoad({ item: { ...selection.fromSource[0], image: 'ghcr.io/other/x' }, prefix: discovered.prefix, workspaceId: WS, builderImage: 'b' }), /name-invalid/);
  assert.throws(() => planSourceImages({ selection, workspaceId: WS, platform: 'linux/amd64', commit: 'HEAD', labels: [] }), /commit-invalid/);
  const cleanup = planSourceCleanup({ workspaceId: WS, selection });
  assert.deepEqual(cleanup.map(s => s.args.slice(0, 2).join(' ')), ['rm --force', 'network rm', 'image rm', 'image rm']);
});

test('redirects only the repository prefix to the private registry', () => {
  const text = registriesConf({ prefix: 'ghcr.io/ding-ding-projects', workspaceId: WS });
  assert.match(text, /prefix = "ghcr\.io\/ding-ding-projects"/);
  assert.match(text, new RegExp(`location = "material-buildroot-haos-${WS}-registry:5000/ding-ding-projects"`));
  assert.match(text, /insecure = true/);
  assert.throws(() => registriesConf({ prefix: 'docker.io/library', workspaceId: WS }), /prefix-invalid/);
});

test('the OS build joins the registry network and gives the builder user the registries file', () => {
  const tree = discoverHaosTree(repository().root);
  const { steps } = planHaosBuild({ tree, defconfig: 'ova', workspaceId: WS, versionJson: FEED, registries: 'x', network: 'material-buildroot-haos-abcdef012345-net' });
  assert.deepEqual(steps.map(s => s.id), ['builder-image', 'build-volume', 'cache-volume', 'source-export', 'version-pin', 'registries', 'image-build']);
  const build = steps.at(-1).args;
  assert.deepEqual(build.slice(build.indexOf('--network'), build.indexOf('--network') + 2), ['--network', 'material-buildroot-haos-abcdef012345-net']);
  assert.match(build.at(-1), /^mkdir -p ~\/\.config\/containers && cp \/build\/\.material-buildroot\/registries\.conf ~\/\.config\/containers\/registries\.conf && make HAOS_VERSION_JSON=\/build\/version-pinned\.json ova$/);
  assert.throws(() => planHaosBuild({ tree, defconfig: 'ova', workspaceId: WS, registries: 'x', network: 'bad network' }), /haos-registries-invalid/);
  assert.ok(!planHaosBuild({ tree, defconfig: 'ova', workspaceId: WS }).steps.at(-1).args.includes('--network'));
});

test('accepts the OS image only when it embedded the digests built from source', () => {
  const d1 = 'sha256:' + '1'.repeat(64), d2 = 'sha256:' + '2'.repeat(64);
  const built = [{ id: 'supervisor', image: 'ghcr.io/o/amd64-hassio-supervisor', tag: '1.2', digest: d1 }, { id: 'landingpage', image: 'ghcr.io/o/qemux86-64-homeassistant', tag: 'landingpage', digest: d2 }];
  const log = `Fetching image: ghcr.io/o/amd64-hassio-supervisor:1.2 (digest ${d1})\nSkipping download of existing image: ghcr.io/o/qemux86-64-homeassistant:landingpage (digest ${d2})\n`;
  assert.deepEqual(verifyEmbedded({ log, built }).map(i => i.matches), [true, true]);
  const published = log.replace(d1, 'sha256:' + '9'.repeat(64));
  assert.deepEqual(verifyEmbedded({ log: published, built }).map(i => i.matches), [false, true]);
  assert.deepEqual(verifyEmbedded({ log: '', built }).map(i => i.embeddedDigest), [null, null]);
});
