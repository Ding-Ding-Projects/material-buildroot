'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { TARGETS } = require('./index.cjs');
const CHECKOUT = '11bd71901bbe5b1630ceea73d27597364c9af683';
const UPLOAD = 'ea165f8d65b6e75b540449e92b4886f43607fa02';
const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
function repository(value) { if (!repoPattern.test(value || '') || value.split('/').some(x => x === '.' || x === '..')) throw Error('invalid-repository'); return value; }
function exact(value, keys) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw Error('unsupported-action-field'); }
function runner(selection) {
  exact(selection, ['kind', 'labels', 'billedRunnerConsent']);
  if (selection.kind === 'hosted' && JSON.stringify(selection.labels) === '["ubuntu-24.04"]') return selection.labels;
  if (selection.kind !== 'self-hosted' || !Array.isArray(selection.labels) || selection.labels.length < 3 || selection.labels.length > 8 || !selection.labels.includes('self-hosted') || !selection.labels.includes('Linux') || !selection.labels.includes('X64') || selection.labels.some(label => typeof label !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(label))) throw Error('unsupported-runner-selection');
  // Custom runner labels may represent paid capacity. Selection always requires explicit consent.
  if (selection.billedRunnerConsent !== true) throw Error('runner-billing-consent-required'); return selection.labels;
}
function workflowModel(model) { exact(model, ['sourceRepository', 'runner', 'defconfig']); if (!/^[A-Za-z0-9_+-]+_defconfig$/.test(model.defconfig || '')) throw Error('invalid-defconfig'); repository(model.sourceRepository); runner(model.runner); return model; }
function generateWorkflow(model) {
  workflowModel(model);
  return `name: Buildroot managed build\non:\n  workflow_dispatch:\n    inputs:\n      operation:\n        required: true\n        type: string\n      revision:\n        required: true\n        type: string\n      target:\n        required: true\n        type: choice\n        options: [${TARGETS.join(', ')}]\npermissions:\n  contents: read\nrun-name: material-buildroot-\${{ inputs.operation }}\njobs:\n  build:\n    runs-on: ${JSON.stringify(runner(model.runner))}\n    timeout-minutes: 360\n    steps:\n      - name: Validate request\n        env:\n          REVISION: \${{ inputs.revision }}\n          TARGET: \${{ inputs.target }}\n          OPERATION: \${{ inputs.operation }}\n        run: |\n          set -eu\n          test "$(id -u)" -ne 0\n          printf '%s' "$REVISION" | grep -Eq '^[a-f0-9]{40}$'\n          printf '%s' "$OPERATION" | grep -Eq '^[a-f0-9-]{36}$'\n          case "$TARGET" in ${TARGETS.join('|')}) ;; *) exit 64 ;; esac\n      - uses: actions/checkout@${CHECKOUT}\n        with:\n          repository: ${model.sourceRepository}\n          ref: \${{ inputs.revision }}\n          persist-credentials: false\n          submodules: false\n          path: source\n      - name: Build selected revision\n        env:\n          TARGET: \${{ inputs.target }}\n        run: |\n          set -eu\n          test "$(id -u)" -ne 0\n          case "$TARGET" in ${TARGETS.join('|')}) ;; *) exit 64 ;; esac\n          make -C source O="$GITHUB_WORKSPACE/output" ${model.defconfig}\n          make -C source O="$GITHUB_WORKSPACE/output" -j2 "$TARGET"\n      - uses: actions/upload-artifact@${UPLOAD}\n        with:\n          name: buildroot-output\n          path: output/\n          if-no-files-found: error\n          retention-days: 7\n`;
}
function validateExpertWorkflow(text, model) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 65536 || /\0/.test(text)) throw Error('invalid-workflow');
  // Deliberately recognizes only this reviewed grammar, not general YAML.
  const canonical = generateWorkflow(model);
  if (text.replace(/\r\n/g, '\n').trimEnd() !== canonical.trimEnd()) throw Error('unsupported-expert-workflow');
  return { valid: true, model: structuredClone(model), sha256: crypto.createHash('sha256').update(canonical).digest('hex'), canonical };
}
class ActionsService {
  constructor({ request, getCredential, download, apiOrigin = 'https://api.github.com' } = {}) {
    if (typeof request !== 'function' || typeof getCredential !== 'function') throw Error('actions-transport-required');
    if (apiOrigin !== 'https://api.github.com') throw Error('unsupported-actions-api');
    this.request = request; this.getCredential = getCredential; this.download = download; this.repositories = new Map(); this.operations = new Map(); this.admissions = new Map();
  }
  selectRepository({ repository: name, credentialRef, trustedSource, workflow = 'material-buildroot.yml', runner: selectedRunner }) {
    repository(name); if (trustedSource !== true || typeof credentialRef !== 'string' || !credentialRef || credentialRef.length > 200 || !/^[A-Za-z0-9_.-]+\.ya?ml$/.test(workflow)) throw Error('repository-consent-required'); runner(selectedRunner);
    const repositoryId = crypto.randomUUID(); this.repositories.set(repositoryId, { repository: name, credentialRef, workflow, runner: structuredClone(selectedRunner) }); return { repositoryId, repository: name, workflow, runner: selectedRunner };
  }
  selected(id) { const selected = this.repositories.get(id); if (!selected) throw Error('repository-not-selected'); return selected; }
  revoke(repositoryId) { this.repositories.delete(repositoryId); }
  async call(selected, method, suffix, body) {
    const token = await this.getCredential(selected.credentialRef); if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) throw Error('credential-unavailable');
    let response;
    try { response = await this.request({ method, url: `https://api.github.com/repos/${selected.repository}${suffix}`, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, ...(body === undefined ? {} : { body }), timeoutMs: 30000, maxBytes: 2 * 1024 * 1024, redirect: 'error' }); } catch { throw Error('actions-transport-failed'); }
    if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status >= 300) { const error = Error('actions-api-failed'); error.status = response?.status; throw error; }
    return response.body;
  }
  async discoverRunners(repositoryId) {
    const selected = this.selected(repositoryId); let runners = [];
    for (let page = 1; page <= 10; page++) {
      const result = await this.call(selected, 'GET', `/actions/runners?per_page=100&page=${page}`); if (!Array.isArray(result?.runners)) throw Error('invalid-runner-response');
      runners.push(...result.runners.map(item => ({ id: item.id, name: item.name, os: item.os, status: item.status, busy: item.busy, labels: Array.isArray(item.labels) ? item.labels.map(x => x.name) : [] })).filter(item => Number.isSafeInteger(item.id) && item.os === 'linux'));
      if (result.runners.length < 100) return { hosted: ['ubuntu-24.04'], selfHosted: runners, truncated: false };
    }
    return { hosted: ['ubuntu-24.04'], selfHosted: runners, truncated: true };
  }
  async reviewWorkflow({ repositoryId, workflowRef, text, model }) {
    const selected = this.selected(repositoryId);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.\/-]{0,199}$/.test(workflowRef || '') || workflowRef.includes('..')) throw Error('invalid-workflow-ref');
    if (JSON.stringify(model.runner) !== JSON.stringify(selected.runner)) throw Error('workflow-runner-mismatch');
    const review = validateExpertWorkflow(text, model);
    if (selected.runner.kind === 'self-hosted') {
      const available = await this.discoverRunners(repositoryId);
      if (!available.selfHosted.some(item => item.status === 'online' && selected.runner.labels.every(label => item.labels.includes(label)))) throw Error('selected-runner-unavailable');
    }
    const commit = await this.call(selected, 'GET', `/commits/${encodeURIComponent(workflowRef)}`);
    if (!/^[a-f0-9]{40}$/.test(commit?.sha || '')) throw Error('invalid-workflow-revision');
    const content = await this.call(selected, 'GET', `/contents/.github/workflows/${encodeURIComponent(selected.workflow)}?ref=${commit.sha}`);
    if (content?.encoding !== 'base64' || typeof content.content !== 'string' || content.content.length > 100000 || Buffer.from(content.content, 'base64').toString('utf8') !== review.canonical) throw Error('remote-workflow-review-mismatch');
    this.admissions.set(`${repositoryId}:${workflowRef}`, { revision: commit.sha, sha256: review.sha256 });
    return { workflowRef, revision: commit.sha, sha256: review.sha256 };
  }
  async dispatch({ repositoryId, workflowRef, revision, target, consent }) {
    const selected = this.selected(repositoryId);
    if (consent !== true || !/^[a-f0-9]{40}$/.test(revision || '') || !TARGETS.includes(target)) throw Error('invalid-actions-dispatch');
    const admission = this.admissions.get(`${repositoryId}:${workflowRef}`); if (!admission) throw Error('workflow-review-required');
    const current = await this.call(selected, 'GET', `/commits/${encodeURIComponent(workflowRef)}`); if (current?.sha !== admission.revision) throw Error('workflow-revision-changed');
    const operationId = crypto.randomUUID();
    await this.call(selected, 'POST', `/actions/workflows/${encodeURIComponent(selected.workflow)}/dispatches`, { ref: workflowRef, inputs: { operation: operationId, revision, target } });
    this.operations.set(operationId, { repositoryId, repository: selected.repository, createdAt: Date.now(), workflowRevision: admission.revision, runId: null });
    return { operationId, state: 'dispatch-accepted', runId: null };
  }
  operation(operationId) { const operation = this.operations.get(operationId); if (!operation) throw Error('operation-not-owned'); const selected = this.selected(operation.repositoryId); if (selected.repository !== operation.repository) throw Error('operation-repository-changed'); return { operation, selected }; }
  async observe(operationId) {
    const { operation, selected } = this.operation(operationId);
    if (!operation.runId) {
      const result = await this.call(selected, 'GET', `/actions/workflows/${encodeURIComponent(selected.workflow)}/runs?event=workflow_dispatch&per_page=100`);
      if (!Array.isArray(result?.workflow_runs)) throw Error('invalid-run-response');
      const matches = result.workflow_runs.filter(run => run.display_title === `material-buildroot-${operationId}` && run.event === 'workflow_dispatch' && Number.isSafeInteger(run.id));
      if (matches.length > 1) throw Error('ambiguous-owned-run'); if (!matches.length) return { operationId, state: 'awaiting-run', runId: null };
      operation.runId = matches[0].id;
    }
    const run = await this.call(selected, 'GET', `/actions/runs/${operation.runId}`);
    if (run.id !== operation.runId || run.display_title !== `material-buildroot-${operationId}` || run.event !== 'workflow_dispatch' || run.head_sha !== operation.workflowRevision) throw Error('run-ownership-mismatch');
    return { operationId, runId: run.id, state: run.status, conclusion: run.conclusion || null, htmlUrl: `https://github.com/${selected.repository}/actions/runs/${run.id}` };
  }
  async reconnect({ repositoryId, operationId, runId, workflowRevision }) {
    const selected = this.selected(repositoryId);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(operationId || '') || !Number.isSafeInteger(runId) || runId < 1 || !/^[a-f0-9]{40}$/.test(workflowRevision || '')) throw Error('invalid-reconnect-receipt');
    const run = await this.call(selected, 'GET', `/actions/runs/${runId}`);
    if (run.display_title !== `material-buildroot-${operationId}` || run.head_sha !== workflowRevision || run.event !== 'workflow_dispatch' || run.id !== runId) throw Error('run-ownership-mismatch');
    this.operations.set(operationId, { repositoryId, repository: selected.repository, workflowRevision, runId, createdAt: Date.now() });
    return this.observe(operationId);
  }
  receipt(operationId) { const { operation } = this.operation(operationId); return { operationId, repository: operation.repository, runId: operation.runId, workflowRevision: operation.workflowRevision }; }
  async jobs(operationId) {
    const { operation, selected } = this.operation(operationId); if (!operation.runId) throw Error('run-not-observed');
    const result = await this.call(selected, 'GET', `/actions/runs/${operation.runId}/jobs?per_page=100`);
    if (!Array.isArray(result?.jobs)) throw Error('invalid-job-response');
    return { jobs: result.jobs.filter(job => Number.isSafeInteger(job.id)).map(job => ({ id: job.id, name: job.name, status: job.status, conclusion: job.conclusion, runnerId: job.runner_id || null, runnerName: job.runner_name || null })), truncated: result.total_count > result.jobs.length };
  }
  async cancel({ operationId, consent }) {
    if (consent !== true) throw Error('cancel-consent-required'); const { operation, selected } = this.operation(operationId); if (!operation.runId) await this.observe(operationId); if (!operation.runId) return { state: 'awaiting-run', cancelled: false };
    await this.call(selected, 'POST', `/actions/runs/${operation.runId}/cancel`); return { state: 'cancel-requested', cancelled: false };
  }
  async artifacts(operationId) {
    const { operation, selected } = this.operation(operationId); if (!operation.runId) throw Error('run-not-observed'); const result = await this.call(selected, 'GET', `/actions/runs/${operation.runId}/artifacts?per_page=100`);
    if (!Array.isArray(result?.artifacts)) throw Error('invalid-artifact-response');
    return result.artifacts.map(item => ({ id: item.id, name: item.name, size: item.size_in_bytes, digest: item.digest, expired: item.expired })).filter(item => Number.isSafeInteger(item.id) && Number.isSafeInteger(item.size) && item.size >= 0);
  }
  async downloadArtifact({ operationId, artifactId, destination, expectedSha256, maxBytes = 1024 * 1024 * 1024, consent }) {
    if (consent !== true || typeof this.download !== 'function' || !Number.isSafeInteger(artifactId) || !/^[a-f0-9]{64}$/.test(expectedSha256 || '') || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 4 * 1024 * 1024 * 1024) throw Error('invalid-artifact-download');
    const { selected } = this.operation(operationId); const artifact = (await this.artifacts(operationId)).find(item => item.id === artifactId);
    if (!artifact || artifact.expired || artifact.size > maxBytes || (artifact.digest && artifact.digest !== `sha256:${expectedSha256}`)) throw Error('artifact-not-admitted');
    if (!path.isAbsolute(destination) || fs.existsSync(destination) || fs.realpathSync(path.dirname(destination)) !== path.dirname(destination)) throw Error('invalid-artifact-destination');
    const token = await this.getCredential(selected.credentialRef); if (typeof token !== 'string' || !token || /[\r\n]/.test(token)) throw Error('credential-unavailable');
    const temporary = `${destination}.partial-${crypto.randomUUID()}`; const fd = fs.openSync(temporary, 'wx', 0o600); let bytes = 0; const hash = crypto.createHash('sha256');
    try {
      await this.download({ url: `https://api.github.com/repos/${selected.repository}/actions/artifacts/${artifactId}/zip`, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, maxBytes, timeoutMs: 600000, allowedRedirectOrigins: ['https://productionresultssa0.blob.core.windows.net'], stripCredentialsOnRedirect: true, onChunk(chunk) { if (!Buffer.isBuffer(chunk)) throw Error('invalid-artifact-chunk'); bytes += chunk.length; if (bytes > maxBytes || bytes > artifact.size) throw Error('artifact-size-limit'); hash.update(chunk); let offset = 0; while (offset < chunk.length) { const written = fs.writeSync(fd, chunk, offset, chunk.length - offset); if (written <= 0) throw Error('artifact-write-failed'); offset += written; } } });
      if (bytes !== artifact.size || hash.digest('hex') !== expectedSha256) throw Error('artifact-verification-failed'); fs.fsyncSync(fd); fs.closeSync(fd); fs.linkSync(temporary, destination); fs.unlinkSync(temporary);
      return { destination, bytes, sha256: expectedSha256, extracted: false };
    } catch { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(temporary); } catch {} throw Error('artifact-download-failed'); }
  }
}
module.exports = { ActionsService, generateWorkflow, validateExpertWorkflow };

// Transport is host-owned. Redirected object storage never receives API credentials.
function createGitHubTransport({ fetch: fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw Error('fetch-unavailable');
  function apiUrl(value) { const url = new URL(value); if (url.origin !== 'https://api.github.com' || url.username || url.password || !url.pathname.startsWith('/repos/')) throw Error('unsafe-api-url'); return url; }
  async function chunks(response, limit, consume) {
    if (!response.body || typeof response.body.getReader !== 'function') throw Error('response-body-unavailable');
    const reader = response.body.getReader(); let bytes = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > limit) throw Error('response-size-limit'); consume(Buffer.from(value)); } } finally { await reader.cancel().catch(() => {}); }
  }
  return {
    async request({ method, url, headers, body, timeoutMs = 30000, maxBytes = 2097152 }) {
      apiUrl(url); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { method, headers: { ...headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, redirect: 'error' });
        if (response.status === 204 || response.status === 202) return { status: response.status, body: null };
        const parts = []; await chunks(response, maxBytes, chunk => parts.push(chunk)); const text = Buffer.concat(parts).toString('utf8');
        return { status: response.status, body: text ? JSON.parse(text) : null };
      } finally { clearTimeout(timer); }
    },
    async download({ url, headers, timeoutMs = 600000, maxBytes, onChunk }) {
      apiUrl(url); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); let current = url;
      try {
        for (let redirect = 0; redirect < 4; redirect++) {
          const response = await fetchImpl(current, { method: 'GET', headers: redirect === 0 ? headers : {}, signal: controller.signal, redirect: 'manual' });
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get('location'); if (!location) throw Error('missing-artifact-redirect');
            const next = new URL(location, current);
            if (next.protocol !== 'https:' || next.username || next.password || !/^productionresultssa\d+\.blob\.core\.windows\.net$/.test(next.hostname)) throw Error('unsafe-artifact-redirect');
            await response.body?.cancel(); current = next.href; continue;
          }
          if (response.status !== 200) throw Error('artifact-http-failed'); await chunks(response, maxBytes, onChunk); return;
        }
        throw Error('artifact-redirect-limit');
      } finally { clearTimeout(timer); }
    }
  };
}
module.exports.createGitHubTransport = createGitHubTransport;
