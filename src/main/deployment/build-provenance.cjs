"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const storage = require("../jobs/storage.cjs");
const { captureBuildIntent } = require("../jobs/build-intent.cjs");
const { ArtifactStore } = require("./artifacts.cjs");
const { readBoundedText, createRecord } = require("./reproducibility.cjs");
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fail(code) { throw Object.assign(Error(code), { code }); }
function identity(item) {
  return [item.source, item.output, ...item.externalTrees].map(root => {
    const stat = fs.lstatSync(root, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(root) !== root) fail("PROVENANCE_ROOT_CHANGED");
    return { pathHash: hash(root), dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) };
  });
}
function createBuildProvenance({ directory, getJob, listJobs }) {
  directory = storage.directory(directory);
  function receiptPath(jobId) {
    if (typeof jobId !== "string" || !/^[a-f0-9-]{36}$/.test(jobId)) fail("INVALID_PROVENANCE_JOB");
    return path.join(directory, jobId + ".json");
  }
  function begin(item, payload) {
    return { roots: identity(item), intentDigest: hash(payload.intent), runtimeDigest: hash(payload.runtime) };
  }
  async function complete({ item, payload, jobId, signal, lineage }) {
    if (payload.target !== "all") return { state: "unbound", reason: "non-image-build-target" };
    if (!fs.existsSync(path.join(item.output, ".config"))) return { state: "unbound", reason: "missing-configuration" };
    const roots = identity(item), started = Date.now();
    if (!lineage || hash(lineage.roots) !== hash(roots) || lineage.intentDigest !== hash(payload.intent) || lineage.runtimeDigest !== hash(payload.runtime)) fail("PROVENANCE_ROOT_CHANGED");
    const check = () => { if (signal?.aborted) fail("PROVENANCE_CANCELLED"); if (Date.now() - started > 60000) fail("PROVENANCE_TIME_LIMIT"); };
    const capture = () => captureBuildIntent({ source: item.source, output: item.output, externalTrees: item.externalTrees, signal });
    const before = await capture();
    if (before.sourceRevision !== payload.intent.sourceRevision || before.configRevision !== payload.intent.configRevision || before.snapshot.symlinks) fail("PROVENANCE_INPUTS_CHANGED");
    const store = new ArtifactStore(item.output), pending = ["images"], paths = [];
    let bytes = 0, entries = 0;
    while (pending.length) {
      check();
      for (const entry of await store.listArtifacts(pending.pop())) {
        check();
        if (++entries > 10000) fail("PROVENANCE_ENTRY_LIMIT");
        if (entry.kind === "directory") pending.push(entry.path);
        else { bytes += entry.size; if (bytes > 4 * 1024 ** 3) fail("PROVENANCE_BYTE_LIMIT"); paths.push(entry.path); }
      }
    }
    if (!paths.length) return { state: "unbound", reason: "no-image-outputs" };
    const manifest = await store.createManifest({ paths, locks: { sourceRevision: before.sourceRevision, configurationSha256: before.configRevision } });
    check();
    const after = await capture();
    if (after.sourceRevision !== before.sourceRevision || after.configRevision !== before.configRevision || hash(identity(item)) !== hash(roots)) fail("PROVENANCE_INPUTS_CHANGED");
    const record = { version: 1, jobId, workspaceId: payload.workspaceId, roots, intent: payload.intent, runtimeDigest: hash(payload.runtime), manifest, capturedAt: new Date().toISOString(), policy: "successful-build-post-output-snapshot" };
    if (Buffer.byteLength(JSON.stringify(record), "utf8") > 4 * 1024 * 1024 - 256) fail("PROVENANCE_RECORD_LIMIT");
    const digest = hash(record);
    storage.atomic(receiptPath(jobId), { ...record, digest });
    return { state: "recorded", jobId, digest, manifestDigest: manifest.digest, outputCount: paths.length, policy: record.policy };
  }
  function bind(manifest, item, workspaceId, hint = null) {
    let candidates;
    try { candidates = hint ? [getJob(hint.jobId)] : listJobs().filter(job => job.kind === "build" && job.payload?.workspaceId === workspaceId && job.state === "succeeded" && job.result?.reproducibility?.state === "recorded").reverse().slice(0, 100); }
    catch { candidates = []; }
    for (const job of candidates) {
      try {
        if (job.kind !== "build" || job.state !== "succeeded" || job.payload?.workspaceId !== workspaceId || job.payload.target !== "all" || job.result?.reproducibility?.state !== "recorded") continue;
        storage.assertSafe(receiptPath(job.id));
        const saved = JSON.parse(readBoundedText(receiptPath(job.id)));
        const { digest, ...record } = saved;
        if (hash(record) !== digest || digest !== job.result.reproducibility.digest || (hint && hint.receiptDigest !== digest) || record.workspaceId !== workspaceId || record.jobId !== job.id || hash(record.intent) !== hash(job.payload.intent) || record.runtimeDigest !== hash(job.payload.runtime) || hash(record.roots) !== hash(identity(item))) continue;
        if (createRecord(record.manifest).digest !== record.manifest.digest || record.manifest.digest !== job.result.reproducibility.manifestDigest || hash(record.manifest.locks) !== hash(manifest.locks)) continue;
        const outputs = new Map(record.manifest.entries.map(entry => [entry.path, entry]));
        if (!manifest.entries.every(entry => { const built = outputs.get(entry.path); return built && built.sha256 === entry.sha256 && built.size === entry.size; })) continue;
        return { kind: record.policy, buildTimeBinding: true, jobId: job.id, receiptDigest: digest, capturedAt: record.capturedAt, outputScope: "selected-files-from-post-build-images", incrementalBuild: "unchanged outputs may be reused by Buildroot", runtimeDigest: record.runtimeDigest };
      } catch { /* Missing, stale or malformed host evidence never admits a binding. */ }
    }
    return { kind: "current-input-observation", buildTimeBinding: false, reason: "no-matching-successful-job-output-lineage" };
  }
  return Object.freeze({ begin, complete, bind });
}
module.exports = { createBuildProvenance };
