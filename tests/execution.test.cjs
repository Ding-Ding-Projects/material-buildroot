'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ExecutionService, boundedProcess } = require('../src/main/execution/index.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'execution-')); const source = path.join(root, 'source'), output = path.join(root, 'output'); fs.mkdirSync(source); fs.mkdirSync(output); fs.writeFileSync(path.join(source, 'Makefile'), 'all:\n\t@echo built\n'); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return { root, source, output, trustedSource: true };
}
test('execution rejects untrusted source, escaping and aliased directories', t => {
  const service = new ExecutionService(), dirs = fixture(t);
  assert.throws(() => service.grantProject({ ...dirs, trustedSource: false }), /consent/);
  assert.throws(() => service.grantProject({ ...dirs, output: os.tmpdir() }), /boundary/);
  const special = path.join(dirs.root, 'output$(id)'); fs.mkdirSync(special); assert.throws(() => service.grantProject({ ...dirs, output: special }), /unsupported-build-path/);
  const alias = path.join(dirs.root, 'alias'); fs.symlinkSync(os.tmpdir(), alias); assert.throws(() => service.grantProject({ ...dirs, output: alias }), /boundary/);
  assert.throws(() => service.grantProject({ ...dirs, output: dirs.source }), /boundary/);
});
test('execution rejects arbitrary targets, fields and root fixture execution', async t => {
  const service = new ExecutionService({ linuxFixture: true }), grant = service.grantProject(fixture(t));
  for (const target of ['all;touch /tmp/unsafe', '--eval=x', 'clean']) await assert.rejects(service.start({ grantId: grant.grantId, target, runtime: { kind: 'linux-fixture' } }), /invalid/);
  await assert.rejects(service.start({ grantId: grant.grantId, target: 'all', command: 'id' }), /unknown/);
  if (process.getuid?.() === 0) await assert.rejects(service.start({ grantId: grant.grantId, target: 'all', runtime: { kind: 'linux-fixture' } }), /non-root/);
});
test('process runner preserves argv without shell interpretation and bounds output', async () => {
  const value = '$(touch /tmp/not-executed); `id`'; const result = await boundedProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', value]).completion; assert.equal(result.stdout, value); assert.equal(result.state, 'succeeded');
  const large = await boundedProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(100000)); setInterval(()=>{},1000)'], { maxBytes: 64 }).completion; assert.equal(large.state, 'output-limit'); assert.equal(large.stdout, '');
});
test('process runner times out and cancellation owns a Linux process group', async () => {
  const timeout = await boundedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 50 }).completion; assert.equal(timeout.state, 'timed-out');
  const job = boundedProcess(process.execPath, ['-e', 'require("child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"inherit"});setInterval(()=>{},1000)']); setTimeout(() => job.cancel(), 100); assert.equal((await job.completion).state, 'cancelled');
});
test('discovery returns missing tools explicitly without provisioning', async () => {
  const result = await new ExecutionService({ executables: { docker: '/nonexistent/material-docker' } }).discover(); assert.equal(result.docker.available, false); assert.equal(result.docker.state, 'unavailable');
});
test('granted source alias replacement is rejected at execution', async t => {
  const service = new ExecutionService({ linuxFixture: true }), dirs = fixture(t), grant = service.grantProject(dirs); fs.renameSync(dirs.source, path.join(dirs.root, 'previous')); fs.symlinkSync(os.tmpdir(), dirs.source); await assert.rejects(service.start({ grantId: grant.grantId, target: 'all', runtime: { kind: 'linux-fixture' } }), /changed/);
});
test('a real non-root Linux fixture builds separate output and streams logs', { skip: process.platform === 'win32' }, async t => {
  const dirs = fixture(t);
  fs.chmodSync(dirs.root, 0o755); fs.chmodSync(dirs.output, 0o777);
  fs.writeFileSync(path.join(dirs.source, 'Makefile'), 'all:\n\t@printf "fixture-output" > "$(O)/image.txt"\n\t@echo fixture-built\n');
  const script = `const {ExecutionService}=require(${JSON.stringify(require.resolve('../src/main/execution/index.cjs'))});(async()=>{const s=new ExecutionService({linuxFixture:true});const g=s.grantProject(${JSON.stringify(dirs)});const j=await s.start({grantId:g.grantId,target:'all',runtime:{kind:'linux-fixture'}},e=>process.stdout.write(e.text));const r=await j.completion;if(r.state!=='succeeded')throw Error(JSON.stringify(r));})().catch(e=>{console.error(e);process.exitCode=1});`;
  const result = process.getuid() === 0
    ? await boundedProcess('/usr/sbin/runuser', ['-u', 'nobody', '--', process.execPath, '-e', script]).completion
    : await boundedProcess(process.execPath, ['-e', script]).completion;
  assert.equal(result.state, 'succeeded', result.stderr); assert.match(result.stdout, /fixture-built/); assert.equal(fs.readFileSync(path.join(dirs.output, 'image.txt'), 'utf8'), 'fixture-output'); assert.equal(fs.existsSync(path.join(dirs.source, 'image.txt')), false);
});
test('Docker launcher uses pinned non-root isolated argv and rejects floating images', async t => {
  const dirs = fixture(t), executable = path.join(dirs.root, 'docker-fixture'); fs.writeFileSync(executable, '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify(process.argv.slice(2)));\n'); fs.chmodSync(executable, 0o755);
  const service = new ExecutionService({ executables: { docker: executable } }), grant = service.grantProject(dirs);
  await assert.rejects(service.start({ grantId: grant.grantId, target: 'all', runtime: { kind: 'docker', image: 'build:latest', uid: 1000, gid: 1000 } }), /runtime/);
  await assert.rejects(service.start({ grantId: grant.grantId, target: 'all', runtime: { kind: 'docker', image: 'build@sha256:' + 'a'.repeat(64), uid: 0, gid: 1000 } }), /runtime/);
  const job = await service.start({ grantId: grant.grantId, target: 'all', runtime: { kind: 'docker', image: 'build@sha256:' + 'a'.repeat(64), uid: 1000, gid: 1000 } }); const result = await job.completion; assert.equal(result.state, 'succeeded');
  const argv = JSON.parse(result.stdout); assert.ok(argv.includes('--network=none')); assert.equal(argv[argv.indexOf('--user') + 1], '1000:1000'); assert.ok(argv.includes(`type=bind,src=${dirs.source},dst=/source,readonly`)); assert.ok(!argv.some(value => value.includes('docker.sock')));
});
test('termination cleanup failure remains explicit', async () => {
  const job = boundedProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { onTerminate: async () => { throw Error('fixture'); } }); job.cancel(); assert.equal((await job.completion).state, 'runtime-cleanup-failed');
});
