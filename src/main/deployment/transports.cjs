'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { safePath, hashFile } = require('./artifacts.cjs');
class DeploymentTransports {
  constructor({ store, http = globalThis.fetch, destinations = [], remoteTargets = [], remoteTransport, flashAdapter }) {
    this.store = store; this.http = http; this.destinations = new Map(); this.remotes = new Map(); this.uploads = new Map(); this.flashes = new Map(); this.jobs = new Map(); this.remoteTransport = remoteTransport; this.flashAdapter = flashAdapter;
    for (const d of destinations) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(d.id) || !['s3', 'azure', 'gcs', 'github'].includes(d.provider) || this.destinations.has(d.id)) throw new Error('invalid-cloud-destination');
      for (const url of [d.uploadUrl, d.readUrl]) { const u = new URL(url); if (u.protocol !== 'https:' || u.username || u.password || u.hash || !d.allowedHosts?.includes(u.hostname)) throw new Error('invalid-cloud-endpoint'); }
      if (!['PUT', 'POST'].includes(d.method || 'PUT') || (d.provider !== 'github' && d.method === 'POST')) throw new Error('invalid-cloud-method');
      this.destinations.set(d.id, { ...d });
    }
    for (const t of remoteTargets) { if (!/^[a-zA-Z0-9_-]{1,64}$/.test(t.id) || !['linux-process', 'linux-docker', 'windows-wsl', 'windows-docker'].includes(t.kind) || !/^SHA256:[A-Za-z0-9+/]{43}=?$/.test(t.hostKey || '') || !/^[A-Za-z0-9.-]+$/.test(t.host || '') || !Number.isInteger(t.port) || t.port < 1 || t.port > 65535) throw new Error('invalid-remote-target'); this.remotes.set(t.id, { ...t }); }
  }
  async previewUpload({ artifact, destinationId }) { const destination = this.destinations.get(destinationId); if (!destination) throw new Error('cloud-destination-not-enrolled'); const inspection = await this.store.inspectArtifact(artifact), id = crypto.randomUUID(); this.uploads.set(id, { artifact, destinationId, sha256: inspection.sha256, size: inspection.size, expiresAt: Date.now() + 300000 }); return { id, artifact, destinationId, provider: destination.provider, object: destination.objectLabel || 'configured object', size: inspection.size, sha256: inspection.sha256, expiresAt: Date.now() + 300000 }; }
  async upload({ id, signal }) {
    signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(600000)]) : AbortSignal.timeout(600000);
    const p = this.uploads.get(id); if (!p) throw new Error('upload-preview-required'); this.uploads.delete(id); const d = this.destinations.get(p.destinationId), file = safePath(this.store.root, p.artifact);
    if (Date.now() > p.expiresAt || await hashFile(file) !== p.sha256) throw new Error('upload-preview-stale');
    const credentialHeaders = d.authorize ? await d.authorize() : {};
    const headers = { 'content-type': 'application/octet-stream', 'content-length': String(p.size), ...credentialHeaders };
    if (d.provider === 'azure') headers['x-ms-blob-type'] = 'BlockBlob';
    if (d.provider === 'gcs') headers['x-goog-meta-sha256'] = p.sha256;
    if (d.provider === 's3') headers['x-amz-meta-sha256'] = p.sha256;
    const response = await this.http(d.uploadUrl, { method: d.method || 'PUT', headers, body: fs.createReadStream(file), duplex: 'half', redirect: 'error', signal });
    if (!response.ok) { await response.body?.cancel?.(); throw new Error(`cloud-upload-http-${response.status}`); }
    await response.body?.cancel?.();
    const readback = await this.http(d.readUrl, { method: 'GET', headers: d.readAuthorize ? await d.readAuthorize() : credentialHeaders, redirect: 'error', signal });
    if (!readback.ok || !readback.body) throw new Error('cloud-readback-unavailable');
    let bytes = 0; const hash = crypto.createHash('sha256');
    try { for await (const chunk of readback.body) { bytes += chunk.length; if (bytes > p.size) throw new Error('cloud-readback-size-mismatch'); hash.update(chunk); } } catch (error) { await readback.body.cancel?.().catch(() => {}); throw error; }
    const sha256 = hash.digest('hex'); if (bytes !== p.size || sha256 !== p.sha256) throw new Error('cloud-readback-checksum-mismatch');
    return { destinationId: p.destinationId, artifact: p.artifact, size: bytes, sha256, state: 'verified' };
  }
  target(id) { const target = this.remotes.get(id); if (!target || !this.remoteTransport) throw new Error('remote-target-unavailable'); return target; }
  async requestRemote(target, request) {
    // The transport must verify the supplied host key before opening the fixed subsystem.
    const response = await this.remoteTransport({ host: target.host, port: target.port, hostKey: target.hostKey, credentialRef: target.credentialRef, subsystem: 'material-buildroot-v1', request, timeoutMs: 30000, maxBytes: 1024 * 1024 });
    if (!response || response.hostKey !== target.hostKey || response.protocol !== 1) throw new Error('remote-identity-or-protocol-mismatch'); return response;
  }
  async enrollRemote({ targetId }) { const t = this.target(targetId), r = await this.requestRemote(t, { operation: 'capabilities' }); if (r.uid === 0 || !r.kinds?.includes(t.kind)) throw new Error('remote-capability-unavailable'); return { targetId, kind: t.kind, enrolled: true, capabilities: r.kinds }; }
  async startRemote({ targetId, manifest, target = 'all', jobs = 1 }) {
    if (!['all', 'olddefconfig', 'legal-info', 'source', 'show-info'].includes(target) || !Number.isInteger(jobs) || jobs < 1 || jobs > 64 || !/^[a-f0-9]{64}$/.test(manifest || '')) throw new Error('invalid-remote-build');
    const t = this.target(targetId), id = crypto.randomUUID(); const r = await this.requestRemote(t, { operation: 'start', id, kind: t.kind, manifest, target, jobs }); if (r.id !== id || !['queued', 'running'].includes(r.state)) throw new Error('invalid-remote-job-response'); this.jobs.set(id, { targetId, manifest }); return { id, state: r.state };
  }
  async observeRemote({ id }) { const j = this.jobs.get(id); if (!j) throw new Error('remote-job-not-owned'); const r = await this.requestRemote(this.target(j.targetId), { operation: 'observe', id }); if (r.id !== id) throw new Error('remote-job-identity-mismatch'); return { id, state: r.state, outputManifest: r.outputManifest || null }; }
  async cancelRemote({ id }) { const j = this.jobs.get(id); if (!j) throw new Error('remote-job-not-owned'); const r = await this.requestRemote(this.target(j.targetId), { operation: 'cancel', id }); if (r.id !== id || r.state !== 'cancelled') throw new Error('remote-cancellation-unverified'); return { id, state: 'cancelled' }; }
  async previewFlash({ artifact, deviceId }) {
    if (!this.flashAdapter) throw new Error('flash-adapter-unavailable'); const image = await this.store.inspectArtifact(artifact); if (!['raw-disk', 'gpt-disk', 'iso9660'].includes(image.format)) throw new Error('unsupported-flash-image'); const device = await this.flashAdapter.inspect(deviceId);
    if (!device || device.id !== deviceId || typeof device.identity !== 'string' || !device.identity || !Number.isSafeInteger(device.bytes) || device.bytes < image.size || device.system || device.mounted || !device.removable && !device.explicitPhysicalDriveAdmission) throw new Error('unsafe-flash-device');
    const token = crypto.randomBytes(32).toString('hex'), expiresAt = Date.now() + 120000; this.flashes.set(token, { artifact, sha256: image.sha256, size: image.size, deviceId, identity: device.identity, bytes: device.bytes, expiresAt }); return { token, artifact, sha256: image.sha256, deviceId, identity: device.identity, deviceBytes: device.bytes, imageBytes: image.size, expiresAt, warning: 'All data on the selected device will be overwritten.' };
  }
  async confirmFlash({ token, reviewedIdentity, signal }) {
    const p = this.flashes.get(token); if (!p) throw new Error('flash-preview-required'); this.flashes.delete(token);
    if (Date.now() > p.expiresAt || reviewedIdentity !== p.identity) throw new Error('flash-confirmation-invalid'); const device = await this.flashAdapter.inspect(p.deviceId);
    if (device.identity !== p.identity || device.bytes !== p.bytes || device.system || device.mounted || !device.removable && !device.explicitPhysicalDriveAdmission || await hashFile(safePath(this.store.root, p.artifact)) !== p.sha256) throw new Error('flash-preview-stale');
    const r = await this.flashAdapter.writeAndVerify({ file: safePath(this.store.root, p.artifact), deviceId: p.deviceId, expectedIdentity: p.identity, bytes: p.size, sha256: p.sha256, signal });
    if (r?.sha256 !== p.sha256 || r?.bytes !== p.size || r?.identity !== p.identity) throw new Error('flash-verification-failed'); return { deviceId: p.deviceId, state: 'verified', sha256: p.sha256, bytes: p.size };
  }
}
module.exports = { DeploymentTransports };
