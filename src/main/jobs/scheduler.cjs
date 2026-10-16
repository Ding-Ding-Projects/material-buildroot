"use strict";
const fs = require("node:fs");
const path = require("node:path");
const safeInteger = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const text = value => typeof value === "string" && value.length > 0 && value.length <= 256;
function fail(code) { throw Object.assign(Error(code), { code }); }
function canonical(value) {
  if (typeof value !== "string" || value.length > 4096 || !path.isAbsolute(value) || fs.realpathSync(value) !== value || !fs.lstatSync(value).isDirectory() || fs.lstatSync(value).isSymbolicLink()) fail("INVALID_ADMISSION_PATH");
  return value;
}
function overlap(a, b) { const relative = path.relative(a, b); return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`)); }
function conflicts(a, b) {
  return a.projectId === b.projectId || [a.source, a.output, ...(a.externalTrees || [])].some(left => [b.source, b.output, ...(b.externalTrees || [])].some(right => overlap(left, right) || overlap(right, left)));
}
function createBuildScheduler({ jobs, ownerId, resolveAdmission, observeResources, limits, acquireLease = null, maxScan = 100, callbackTimeoutMs = 15000 } = {}) {
  if (!jobs || !text(ownerId) || typeof resolveAdmission !== "function" || typeof observeResources !== "function" || !limits || !["maxConcurrent", "cpuSlots", "memoryBytes"].every(key => safeInteger(limits[key], 1)) || !safeInteger(limits.storageBytes) || !safeInteger(maxScan, 1) || maxScan > 1000 || !safeInteger(callbackTimeoutMs, 1) || callbackTimeoutMs > 60000) fail("INVALID_SCHEDULER_OPTIONS");
  limits = { ...limits };
  const running = new Map(), leases = new Set(), blocked = new Map(), faulted = new Set();
  let pumping = null, requested = false, closed = false, scanOffset = 0, budgetRevision = 0;
  async function boundedCallback(work, releaseLate = false) {
    let expired = false, timer;
    const result = Promise.resolve().then(work).then(value => {
      if (expired && releaseLate && typeof value === "function") { try { value(); } catch {} }
      return value;
    });
    try {
      return await Promise.race([result, new Promise((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(Object.assign(Error("Admission callback timed out"), { code: "BLOCKED_ADMISSION_TIMEOUT" })); }, callbackTimeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  }
  function acquireMutationLease({ projectId, source, output, externalTrees = [] }, notify = true) {
    if (!Array.isArray(externalTrees) || externalTrees.length > 32) fail("INVALID_LEASE");
    const descriptor = { projectId, source: canonical(source), output: canonical(output), externalTrees: externalTrees.map(canonical) };
    if (!text(projectId)) fail("INVALID_LEASE");
    if ([...leases].some(lease => conflicts(lease, descriptor))) fail("SOURCE_BUSY");
    leases.add(descriptor); let released = false;
    return () => { if (!released) { released = true; leases.delete(descriptor); if (notify && !closed) pump(); } };
  }
  function usage(filter = () => true) {
    return [...running.values()].filter(filter).reduce((sum, item) => ({ cpuSlots: sum.cpuSlots + item.admission.cpuSlots, memoryBytes: sum.memoryBytes + item.admission.memoryBytes, storageBytes: sum.storageBytes + item.admission.storageBytes }), { cpuSlots: 0, memoryBytes: 0, storageBytes: 0 });
  }
  function intent(job, admission) {
    const expected = job.payload?.intent;
    if (!expected || !text(expected.projectId) || !text(expected.sourceRevision) || !text(expected.configRevision) || admission.projectId !== expected.projectId || admission.intent?.sourceRevision !== expected.sourceRevision || admission.intent?.configRevision !== expected.configRevision) fail("BLOCKED_INTENT_CHANGED");
    canonical(admission.source); canonical(admission.output);
    if (!Array.isArray(admission.externalTrees || []) || (admission.externalTrees || []).length > 32) fail("BLOCKED_INVALID_ADMISSION");
    for (const external of admission.externalTrees || []) canonical(external);
    if (!text(admission.resourceDomain) || !text(admission.storageDomain) || !safeInteger(admission.cpuSlots, 1) || !safeInteger(admission.memoryBytes, 1) || !safeInteger(admission.storageBytes)) fail("BLOCKED_INVALID_ADMISSION");
  }
  function reason(admission, observed) {
    if (!observed || observed.resourceDomain !== admission.resourceDomain || observed.storageDomain !== admission.storageDomain || !safeInteger(observed.cpuSlots) || !safeInteger(observed.memoryAvailableBytes) || !safeInteger(observed.storageAvailableBytes)) return "BLOCKED_RESOURCE_UNKNOWN";
    if ([...leases].some(lease => conflicts(lease, admission))) return "BLOCKED_SOURCE_BUSY";
    if (running.size >= limits.maxConcurrent) return "BLOCKED_CONCURRENCY_LIMIT";
    const global = usage(), domain = usage(item => item.admission.resourceDomain === admission.resourceDomain), storage = usage(item => item.admission.storageDomain === admission.storageDomain);
    if (global.cpuSlots + admission.cpuSlots > limits.cpuSlots || domain.cpuSlots + admission.cpuSlots > observed.cpuSlots) return "BLOCKED_CPU_LIMIT";
    if (global.memoryBytes + admission.memoryBytes > limits.memoryBytes || domain.memoryBytes + admission.memoryBytes > observed.memoryAvailableBytes) return "BLOCKED_MEMORY_LIMIT";
    if (global.storageBytes + admission.storageBytes > limits.storageBytes || storage.storageBytes + admission.storageBytes > observed.storageAvailableBytes) return "BLOCKED_STORAGE_LIMIT";
    return null;
  }
  async function scan() {
    const queue = jobs.list(ownerId).filter(job => job.state === "queued");
    const queuedIds = new Set(queue.map(job => job.id)); for (const jobId of blocked.keys()) if (!queuedIds.has(jobId)) blocked.delete(jobId);
    const projectHeads = new Map();
    for (const job of queue) { const key = job.payload?.intent?.projectId; if (!projectHeads.has(key)) projectHeads.set(key, job.id); }
    const offset = queue.length ? scanOffset % queue.length : 0;
    const window = [...queue.slice(offset), ...queue.slice(0, offset)].slice(0, maxScan);
    scanOffset = queue.length ? (offset + window.length) % queue.length : 0;
    for (const job of window) {
      if (closed) break;
      if (faulted.has(job.id)) { blocked.set(job.id, "BLOCKED_RUN_START_FAILED"); continue; }
      const projectId = job.payload?.intent?.projectId;
      if (text(projectId) && projectHeads.get(projectId) !== job.id) { blocked.set(job.id, "BLOCKED_PROJECT_FIFO"); continue; }
      let release, externalRelease, admission;
      try {
        admission = structuredClone(await boundedCallback(() => resolveAdmission(job))); intent(job, admission);
        const observed = await boundedCallback(() => observeResources(admission));
        if (closed) break;
        const current = jobs.get(job.id, ownerId);
        if (current.state !== "queued" || current.sequence !== job.sequence) { blocked.delete(job.id); continue; }
        const admittedBudgetRevision = budgetRevision;
        const why = reason(admission, observed); if (why) { blocked.set(job.id, why); continue; }
        release = acquireMutationLease(admission, false);
        if (acquireLease) { externalRelease = await boundedCallback(() => acquireLease(admission), true); if (typeof externalRelease !== "function") fail("BLOCKED_LEASE_UNAVAILABLE"); }
        const confirmed = structuredClone(await boundedCallback(() => resolveAdmission(jobs.get(job.id, ownerId))));
        intent(job, confirmed);
        for (const key of ["projectId", "source", "output", "resourceDomain", "storageDomain", "cpuSlots", "memoryBytes", "storageBytes"]) if (confirmed[key] !== admission[key]) fail("BLOCKED_ADMISSION_CHANGED");
        if (JSON.stringify(confirmed.externalTrees || []) !== JSON.stringify(admission.externalTrees || [])) fail("BLOCKED_ADMISSION_CHANGED");
        if (closed) { release(); externalRelease?.(); break; }
        const latest = jobs.get(job.id, ownerId);
        if (latest.state !== "queued" || latest.sequence !== job.sequence) { release(); externalRelease?.(); continue; }
        blocked.delete(job.id);
        const item = { admission, promise: null }; running.set(job.id, item);
        const releaseLocal = release, releaseExternal = externalRelease; release = null; externalRelease = null;
        item.promise = Promise.resolve().then(() => jobs.run(job.id, ownerId, job.sequence)).catch(() => { faulted.add(job.id); }).finally(() => {
          try { releaseExternal?.(); } finally { releaseLocal(); running.delete(job.id); if (!closed) pump(); }
        }).catch(() => {});
      } catch (error) {
        try { externalRelease?.(); } finally { release?.(); }
        blocked.set(job.id, typeof error.code === "string" && /^BLOCKED_[A-Z_]+$/.test(error.code) ? error.code : error.code === "SOURCE_BUSY" ? "BLOCKED_SOURCE_BUSY" : error.code === "INVALID_ADMISSION_PATH" ? "BLOCKED_PATH_CHANGED" : "BLOCKED_ADMISSION_UNAVAILABLE");
      }
    }
    const scanned = new Set(window.map(job => job.id));
    for (const job of queue) if (!scanned.has(job.id) && !blocked.has(job.id)) blocked.set(job.id, "BLOCKED_SCAN_LIMIT");
  }
  function pump() {
    if (closed) return Promise.resolve();
    requested = true;
    if (!pumping) pumping = (async () => { do { requested = false; await scan(); } while (requested && !closed); })().finally(() => { pumping = null; });
    return pumping;
  }
  return {
    pump,
    setLimits(next) {
      if (!next || Object.keys(next).length !== 4 || !["maxConcurrent", "cpuSlots", "memoryBytes"].every(key => safeInteger(next[key], 1)) || !safeInteger(next.storageBytes)) fail("INVALID_SCHEDULER_LIMITS");
      limits = { ...next };
      budgetRevision++;
    },
    acquireMutationLease,
    status() { return { closed, running: [...running].map(([jobId, item]) => ({ jobId, projectId: item.admission.projectId, cpuSlots: item.admission.cpuSlots, memoryBytes: item.admission.memoryBytes, storageBytes: item.admission.storageBytes })), blocked: [...blocked].map(([jobId, reason]) => ({ jobId, reason })), reservations: usage() }; },
    async awaitIdle() { for (;;) { await pumping; const active = [...running.values()].map(item => item.promise); if (!active.length && !pumping) return; await Promise.allSettled(active); } },
    close() { closed = true; requested = false; },
  };
}
module.exports = { createBuildScheduler };
