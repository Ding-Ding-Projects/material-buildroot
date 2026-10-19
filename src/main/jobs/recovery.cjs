"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const storage = require("./storage.cjs");
const fail = code => { throw Object.assign(Error(code), { code }); };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// This journal records batch receipts only. The existing job manager remains
// the authority for execution, ownership, sequence checks and cancellation.
function createJobRecovery({ directory, jobs, owner, perform }) {
  const file = path.join(storage.directory(directory), "batches.json");
  let batches = [];
  let active = null;
  if (fs.existsSync(file)) {
    if (fs.statSync(storage.assertSafe(file)).size > 2 * 1024 * 1024) fail("RECOVERY_STORAGE_INVALID");
    const data = storage.read(file);
    if (data.version !== 1 || !Array.isArray(data.batches) || data.batches.length > 100) fail("RECOVERY_STORAGE_INVALID");
    batches = data.batches;
    for (const batch of batches) {
      if (!uuid.test(batch.id) || !["cancel", "retry"].includes(batch.action) || !Array.isArray(batch.items) || batch.items.length > 100) fail("RECOVERY_STORAGE_INVALID");
      for (const item of batch.items) {
        if (!uuid.test(item.id) || !Number.isSafeInteger(item.sequence) || !["pending", "requesting", "accepted", "not-confirmed", "skipped", "unknown"].includes(item.state)) fail("RECOVERY_STORAGE_INVALID");
        if (item.state === "requesting") item.state = "unknown";
        if (item.state === "pending") item.state = "skipped";
      }
      if (batch.state === "running") batch.state = "interrupted";
    }
    storage.atomic(file, { version: 1, batches });
  }
  const save = () => storage.atomic(file, { version: 1, batches });
  const clone = value => JSON.parse(JSON.stringify(value));
  return {
    snapshot() {
      return {
        jobs: jobs.list(owner).map(job => ({
          id: job.id, sequence: job.sequence, state: job.state,
          workspaceId: job.payload.workspaceId, target: job.payload.target,
          retryOf: job.retryOf || null, logCount: job.logCount, itemCount: job.itemCount,
          updatedAt: job.updatedAt,
          recovery: job.state === "interrupted" ? "renew-access-and-reconcile" :
            ["failed", "cancelled"].includes(job.state) ? "review-outcomes-before-retry" : "none",
        })),
        batches: clone(batches), activeBatchId: active?.id || null,
      };
    },
    cancelBatch(id) {
      if (!active || active.id !== id) fail("BATCH_NOT_ACTIVE");
      active.stop = true;
      return { id, state: "stop-requested" };
    },
    async bulk({ kind, items }) {
      if (active) fail("BATCH_BUSY");
      if (!["cancel", "retry"].includes(kind) || !Array.isArray(items) || items.length < 1 || items.length > 100) fail("INVALID_REQUEST");
      const seen = new Set();
      for (const item of items) {
        if (!item || Object.keys(item).sort().join() !== "id,sequence" || !uuid.test(item.id) || !Number.isSafeInteger(item.sequence) || item.sequence < 1 || seen.has(item.id)) fail("INVALID_REQUEST");
        seen.add(item.id);
        jobs.get(item.id, owner);
      }
      if (batches.length >= 100) fail("BATCH_HISTORY_FULL");
      const batch = { id: randomUUID(), action: kind, state: "running", createdAt: new Date().toISOString(), items: items.map(item => ({ ...item, state: "pending" })) };
      batches.push(batch);
      save();
      const operation = { id: batch.id, stop: false };
      active = operation;
      try {
        for (const item of batch.items) {
          if (operation.stop) { item.state = "skipped"; item.code = "BATCH_STOP_REQUESTED"; save(); continue; }
          item.state = "requesting";
          save();
          try {
            const result = await perform({ action: `jobs.${kind}`, id: item.id, sequence: item.sequence });
            item.state = "accepted";
            item.resultId = result.id;
            item.resultState = result.state;
          } catch (error) {
            item.state = "not-confirmed";
            item.code = /^[A-Z_]{1,80}$/.test(error.code || "") ? error.code : "ACTION_NOT_CONFIRMED";
          }
          save();
          // Yield between items so a stop request can prevent remaining work.
          await new Promise(resolve => setImmediate(resolve));
        }
        batch.state = operation.stop ? "stopped" : "finished";
        save();
        return clone(batch);
      } finally { active = null; }
    },
  };
}
module.exports = { createJobRecovery };
