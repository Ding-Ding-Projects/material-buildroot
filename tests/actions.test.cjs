'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const crypto = require('node:crypto');
const { ActionsService, generateWorkflow, validateExpertWorkflow } = require('../src/main/execution/actions.cjs');
const model = { sourceRepository: 'example/buildroot', defconfig: 'qemu_x86_64_defconfig', runner: { kind: 'hosted', labels: ['ubuntu-24.04'] } }; const revision = 'a'.repeat(40);
function fixture(t, overrides = {}) {
  const calls = []; let operationId; const data = Buffer.from('verified-archive-fixture'); const digest = crypto.createHash('sha256').update(data).digest('hex');
  const service = new ActionsService({ getCredential: async ref => { assert.equal(ref, 'vault-ref'); return 'private-token'; }, request: async request => {
    calls.push(request); assert.equal(request.headers.Authorization, 'Bearer private-token'); assert.ok(request.url.startsWith('https://api.github.com/repos/example/execution/'));
    if (overrides.request) { const response = await overrides.request(request); if (response) return response; }
    const url = new URL(request.url);
    if (url.pathname.includes('/commits/')) return { status: 200, body: { sha: revision } };
    if (url.pathname.includes('/contents/')) return { status: 200, body: { encoding: 'base64', content: Buffer.from(generateWorkflow(model)).toString('base64') } };
    if (url.pathname.endsWith('/dispatches')) { operationId = request.body.inputs.operation; return { status: 204 }; }
    if (url.pathname.endsWith('/runs')) return { status: 200, body: { workflow_runs: [{ id: 7, display_title: `material-buildroot-${operationId}`, event: 'workflow_dispatch' }] } };
    if (url.pathname.endsWith('/runs/7')) return { status: 200, body: { id: 7, display_title: `material-buildroot-${operationId}`, event: 'workflow_dispatch', head_sha: revision, status: 'completed', conclusion: 'success' } };
    if (url.pathname.endsWith('/cancel')) return { status: 202 };
    if (url.pathname.endsWith('/runners')) return { status: 200, body: { runners: [{ id: 1, name: 'linux', os: 'linux', status: 'online', busy: false, labels: [{ name: 'Linux' }] }, { id: 2, os: 'windows', labels: [] }] } };
    if (url.pathname.endsWith('/artifacts')) return { status: 200, body: { artifacts: [{ id: 9, name: 'buildroot-output', size_in_bytes: data.length, digest: `sha256:${digest}`, expired: false }] } };
    throw Error('unexpected-fixture-request');
  }, download: overrides.download || (async request => { assert.equal(request.stripCredentialsOnRedirect, true); request.onChunk(data.subarray(0, 4)); request.onChunk(data.subarray(4)); }) });
  const selected = service.selectRepository({ repository: 'example/execution', credentialRef: 'vault-ref', trustedSource: true, runner: model.runner });
  return { service, repositoryId: selected.repositoryId, calls, digest, data };
}
async function reviewed(f) { await f.service.reviewWorkflow({ repositoryId: f.repositoryId, workflowRef: 'build-v1', text: generateWorkflow(model), model }); }
async function dispatched(f) { await reviewed(f); return f.service.dispatch({ repositoryId: f.repositoryId, workflowRef: 'build-v1', revision, target: 'all', consent: true }); }
test('workflow generator pins actions, validates a strict supported YAML grammar and rejects expert effects', () => {
  const text = generateWorkflow(model); assert.match(text, /actions\/checkout@[a-f0-9]{40}/); assert.match(text, /persist-credentials: false/); assert.match(text, /qemu_x86_64_defconfig/); assert.equal(validateExpertWorkflow(text, model).valid, true); assert.equal(validateExpertWorkflow(text.replace(/\n/g, '\r\n'), model).valid, true);
  assert.throws(() => validateExpertWorkflow(text.replace('contents: read', 'contents: write'), model), /unsupported/); assert.throws(() => validateExpertWorkflow(text + '\nother: &alias effect', model), /unsupported/);
  assert.throws(() => generateWorkflow({ ...model, runner: { kind: 'hosted', labels: ['ubuntu-latest-64-cores'] } }), /runner/);
  assert.throws(() => generateWorkflow({ ...model, runner: { kind: 'self-hosted', labels: ['self-hosted', 'Linux', 'X64'] } }), /billing/);
  assert.throws(() => generateWorkflow({ ...model, defconfig: 'all;id' }), /defconfig/);
});
test('runner discovery is read-only and filters incompatible systems', async t => {
  const f = fixture(t); const result = await f.service.discoverRunners(f.repositoryId); assert.equal(result.selfHosted.length, 1); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].method, 'GET');
});
test('dispatch requires explicit reviewed repository workflow and resolves owned run before cancel', async t => {
  const f = fixture(t); await assert.rejects(f.service.dispatch({ repositoryId: f.repositoryId, workflowRef: 'build-v1', revision, target: 'all', consent: true }), /review/);
  const job = await dispatched(f); assert.equal(job.state, 'dispatch-accepted'); assert.equal((await f.service.observe(job.operationId)).conclusion, 'success');
  assert.deepEqual(await f.service.cancel({ operationId: job.operationId, consent: true }), { state: 'cancel-requested', cancelled: false }); await assert.rejects(f.service.observe('foreign-operation'), /owned/);
  const dispatch = f.calls.find(call => call.url.endsWith('/dispatches')); assert.equal(dispatch.body.ref, 'build-v1'); assert.equal(dispatch.body.inputs.revision, revision); assert.ok(!JSON.stringify(dispatch.body).includes('private-token'));
});
test('remote workflow changes fail review and mutation admission', async t => {
  const f = fixture(t, { request: async request => request.url.includes('/contents/') ? { status: 200, body: { encoding: 'base64', content: Buffer.from('name: malicious').toString('base64') } } : null }); await assert.rejects(reviewed(f), /mismatch/); assert.ok(f.calls.every(call => call.method === 'GET'));
});
test('artifact download verifies ownership, exact size and digest without extraction or replacement', async t => {
  const f = fixture(t), job = await dispatched(f); await f.service.observe(job.operationId); const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); const destination = path.join(root, 'output.zip');
  const result = await f.service.downloadArtifact({ operationId: job.operationId, artifactId: 9, destination, expectedSha256: f.digest, consent: true }); assert.equal(result.extracted, false); assert.deepEqual(fs.readFileSync(destination), f.data);
  await assert.rejects(f.service.downloadArtifact({ operationId: job.operationId, artifactId: 9, destination, expectedSha256: f.digest, consent: true }), /destination/);
  await assert.rejects(f.service.downloadArtifact({ operationId: job.operationId, artifactId: 9, destination: path.join(root, 'wrong.zip'), expectedSha256: 'b'.repeat(64), consent: true }), /admitted/);
});
test('truncated artifact removes partial files and redacts transport failures', async t => {
  const f = fixture(t, { download: async request => { request.onChunk(Buffer.from('bad')); } }), job = await dispatched(f); await f.service.observe(job.operationId);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await assert.rejects(f.service.downloadArtifact({ operationId: job.operationId, artifactId: 9, destination: path.join(root, 'output.zip'), expectedSha256: f.digest, consent: true }), /download-failed/); assert.deepEqual(fs.readdirSync(root), []);
  const service = new ActionsService({ request: async () => { throw Error('private-token'); }, getCredential: async () => 'private-token' }); const selected = service.selectRepository({ repository: 'example/execution', credentialRef: 'vault', trustedSource: true, runner: model.runner }); await assert.rejects(service.discoverRunners(selected.repositoryId), error => error.message === 'actions-transport-failed');
});
test('production HTTP transport strips credentials on signed storage redirects and bounds bodies', async () => {
  const { createGitHubTransport } = require('../src/main/execution/actions.cjs'); const calls = []; let content = '';
  const transport = createGitHubTransport({ fetch: async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://productionresultssa9.blob.core.windows.net/container/archive?signature=private' } }) : new Response('artifact'); } });
  await transport.download({ url: 'https://api.github.com/repos/example/execution/actions/artifacts/9/zip', headers: { Authorization: 'Bearer private-token' }, maxBytes: 100, onChunk: chunk => { content += chunk; } }); assert.equal(content, 'artifact'); assert.deepEqual(calls[1].options.headers, {});
  const bad = createGitHubTransport({ fetch: async () => new Response(null, { status: 302, headers: { location: 'https://evil.invalid/archive' } }) }); await assert.rejects(bad.download({ url: 'https://api.github.com/repos/example/execution/actions/artifacts/9/zip', headers: {}, maxBytes: 100, onChunk() {} }), /unsafe/);
  const large = createGitHubTransport({ fetch: async () => new Response('long-artifact') }); await assert.rejects(large.download({ url: 'https://api.github.com/repos/example/execution/actions/artifacts/9/zip', headers: {}, maxBytes: 1, onChunk() {} }), /size-limit/);
});
test('owned run observation rejects workflow revision mismatch', async t => {
  const f = fixture(t, { request: async request => request.url.endsWith('/runs/7') ? { status: 200, body: { id: 7, event: 'workflow_dispatch', display_title: 'wrong-operation', head_sha: 'b'.repeat(40) } } : null }); const job = await dispatched(f); await assert.rejects(f.service.observe(job.operationId), /ownership/);
});
test('saved operation receipt reconnects only to its verified run', async t => {
  const f = fixture(t), job = await dispatched(f); await f.service.observe(job.operationId); const receipt = f.service.receipt(job.operationId); assert.equal(receipt.repository, 'example/execution'); f.service.operations.clear(); await assert.rejects(f.service.observe(job.operationId), /owned/); assert.equal((await f.service.reconnect({ repositoryId: f.repositoryId, ...receipt })).conclusion, 'success');
  await assert.rejects(f.service.reconnect({ repositoryId: f.repositoryId, ...receipt, workflowRevision: 'b'.repeat(40) }), /ownership/);
});
