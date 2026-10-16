"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  storage = require("./storage.cjs");
const copy = (x) => JSON.parse(JSON.stringify(x));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const text = (x) => typeof x === "string" && x.length > 0 && x.length <= 256;
const count = (x) => Number.isSafeInteger(x) && x >= 0;
const timestamp = (x) =>
  typeof x === "string" && Number.isFinite(Date.parse(x));
function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.jobs))
    throw Error("Invalid job storage");
  const ids = new Set(),
    operations = new Set();
  for (const j of data.jobs) {
    if (
      !j ||
      !uuid.test(j.id) ||
      ids.has(j.id) ||
      !text(j.operationId) ||
      operations.has(j.operationId) ||
      !text(j.ownerId) ||
      !text(j.kind) ||
      ![
        "queued",
        "running",
        "cancelling",
        "cancelled",
        "succeeded",
        "failed",
        "interrupted",
      ].includes(j.state) ||
      !count(j.sequence) ||
      j.sequence < 1 ||
      !count(j.logCount) ||
      !count(j.itemCount) ||
      !timestamp(j.createdAt) ||
      !timestamp(j.updatedAt) ||
      JSON.stringify(j.payload) === undefined ||
      JSON.stringify(j.payload).length > 65536 ||
      (j.retryOf !== undefined && !uuid.test(j.retryOf))
    )
      throw Error("Invalid job storage");
    ids.add(j.id);
    operations.add(j.operationId);
  }
}
function createJobManager({
  directory,
  adapters = {},
  onTransition = () => {},
  now = () => new Date().toISOString(),
}) {
  directory = storage.directory(directory);
  const file = path.join(directory, "jobs.json");
  let data = { version: 1, jobs: [] };
  const active = new Map();
  if (fs.existsSync(file)) {
    data = storage.read(file);
    validate(data);
    const next = copy(data);
    for (const j of next.jobs)
      if (["running", "cancelling"].includes(j.state)) {
        j.state = "interrupted";
        j.error = { code: "OUTCOME_UNKNOWN_AFTER_RESTART", message: "Execution was interrupted. Inspect recorded outcomes and reconcile the owned runtime before an explicit retry." };
        j.sequence++;
        j.updatedAt = now();
      }
    storage.atomic(file, next);
    data = next;
  }
  const find = (id, source = data) => {
    if (typeof id !== "string" || !uuid.test(id)) throw Error("Invalid job ID");
    const j = source.jobs.find((j) => j.id === id);
    if (!j) throw Error("Unknown job");
    return j;
  };
  const authorize = (j, owner) => {
    if (owner !== undefined && j.ownerId !== owner)
      throw Error("Job ownership mismatch");
    return j;
  };
  const owned = (id, owner, seq) => {
    const j = authorize(find(id), owner);
    if (owner === undefined || j.sequence !== seq)
      throw Error("Stale job sequence");
    return j;
  };
  const update = (id, mutate) => {
    const previousState = find(id).state;
    const next = copy(data),
      j = find(id, next);
    mutate(j);
    j.sequence++;
    j.updatedAt = now();
    validate(next);
    storage.atomic(file, next);
    data = next;
    if (j.state !== previousState) { try { onTransition({id:j.id,kind:j.kind,state:j.state}); } catch {} }
    return j;
  };
  const append = (id, channel, value) => {
    const body = JSON.stringify(value);
    if (!body || body.length > 16384) throw Error("Job record too large");
    const j = find(id);
    if (!["running", "cancelling"].includes(j.state))
      throw Error("Job is no longer active");
    const dir = storage.directory(path.join(directory, id)),
      number = j[channel + "Count"] + 1;
    storage.atomic(path.join(dir, channel + "-" + number + ".json"), {
      sequence: number,
      value: JSON.parse(body),
    });
    update(id, (j) => {
      j[channel + "Count"] = number;
    });
    return number;
  };
  const api = {
    enqueue({ kind, payload, ownerId, operationId = crypto.randomUUID() }) {
      if (
        !Object.hasOwn(adapters, kind) ||
        typeof adapters[kind] !== "function"
      )
        throw Error("Unsupported job kind");
      if (!text(ownerId) || !text(operationId))
        throw Error("Invalid job identity");
      const serialized = JSON.stringify(payload);
      if (!serialized || serialized.length > 65536)
        throw Error("Invalid job payload");
      const prior = data.jobs.find((j) => j.operationId === operationId);
      if (prior) {
        if (
          prior.ownerId !== ownerId ||
          prior.kind !== kind ||
          JSON.stringify(prior.payload) !== serialized
        )
          throw Error("Operation conflict");
        return copy(prior);
      }
      const j = {
        id: crypto.randomUUID(),
        operationId,
        ownerId,
        kind,
        payload: JSON.parse(serialized),
        state: "queued",
        sequence: 1,
        logCount: 0,
        itemCount: 0,
        createdAt: now(),
        updatedAt: now(),
      };
      const next = copy(data);
      next.jobs.push(j);
      validate(next);
      storage.atomic(file, next);
      data = next;
      return copy(j);
    },
    get(id, owner) {
      return copy(authorize(find(id), owner));
    },
    list(owner) {
      return data.jobs
        .filter((j) => owner === undefined || j.ownerId === owner)
        .map(copy);
    },
    page(id, channel, { after = 0, limit = 50 } = {}, owner) {
      const j = authorize(find(id), owner);
      if (
        !["log", "item"].includes(channel) ||
        !count(after) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        throw Error("Invalid page");
      const end = Math.min(j[channel + "Count"], after + limit),
        records = [];
      for (let n = after + 1; n <= end; n++) {
        const record = storage.read(
          path.join(directory, id, channel + "-" + n + ".json"),
        );
        if (
          !record ||
          record.sequence !== n ||
          JSON.stringify(record).length > 17000
        )
          throw Error("Invalid job record");
        records.push(record);
      }
      return { records, next: end, hasMore: end < j[channel + "Count"] };
    },
    cancel(id, owner, seq) {
      const j = owned(id, owner, seq);
      if (!["queued", "running"].includes(j.state))
        throw Error("Job cannot be cancelled");
      const result = update(id, (j) => {
        j.state = j.state === "queued" ? "cancelled" : "cancelling";
      });
      active.get(id)?.abort();
      return copy(result);
    },
    retry(id, owner, seq) {
      const j = owned(id, owner, seq);
      if (!["failed", "cancelled", "interrupted"].includes(j.state))
        throw Error("Job cannot be retried");
      if (typeof adapters[j.kind] !== "function") throw Error("Job adapter unavailable");
      const next = copy(data), original = find(id, next), timestamp = now();
      const created = {
        id: crypto.randomUUID(), operationId: crypto.randomUUID(),
        ownerId: owner, kind: j.kind, payload: copy(j.payload),
        state: "queued", sequence: 1, logCount: 0, itemCount: 0,
        createdAt: timestamp, updatedAt: timestamp, retryOf: j.id,
      };
      // Consume the original sequence in the same durable write as the new job.
      // Re-entry with the old sequence cannot create another retry.
      original.sequence++;
      original.updatedAt = timestamp;
      original.lastRetryId = created.id;
      next.jobs.push(created);
      validate(next);
      storage.atomic(file, next);
      data = next;
      return copy(created);
    },
    async run(id, owner, seq) {
      const j = owned(id, owner, seq);
      if (j.state !== "queued") throw Error("Job is not queued");
      if (typeof adapters[j.kind] !== "function")
        throw Error("Job adapter unavailable");
      const controller = new AbortController();
      update(id, (j) => {
        j.state = "running";
      });
      active.set(id, controller);
      let result,
        failed = false,
        callbackFailed = false;
      const record = (fn) => (value) => {
        try {
          return fn(value);
        } catch (error) {
          callbackFailed = true;
          throw error;
        }
      };
      try {
        result = await adapters[j.kind](copy(j.payload), {
          signal: controller.signal,
          jobId: id,
          log: record((value) => append(id, "log", value)),
          item: record((value) => append(id, "item", value)),
          checkpoint: record((value) => {
            if (!["running", "cancelling"].includes(find(id).state))
              throw Error("Job is no longer active");
            const body = JSON.stringify(value);
            if (!body || body.length > 16384)
              throw Error("Checkpoint too large");
            update(id, (j) => {
              j.checkpoint = JSON.parse(body);
            });
          }),
        });
        if (callbackFailed) throw Error("Job recording failed");
        if (result !== undefined) {
          const body = JSON.stringify(result);
          if (!body || body.length > 65536) throw Error("Result too large");
          result = JSON.parse(body);
        }
      } catch (error) {
        failed = true;
      } finally {
        active.delete(id);
      }
      return copy(
        update(id, (j) => {
          const cleanupUnknown = result && result.state === "runtime-cleanup-failed";
          j.state = cleanupUnknown
            ? "interrupted"
            : controller.signal.aborted
            ? "cancelled"
            : failed
              ? "failed"
              : "succeeded";
          if (cleanupUnknown) {
            j.result = result;
            j.error = { code: "RUNTIME_CLEANUP_UNVERIFIED", message: "Runtime cleanup is unverified. Reconcile its owned runtime before starting related work." };
          } else if (failed)
            j.error = {
              code: "ADAPTER_FAILED",
              message:
                "The job did not complete. Review its recorded outcomes before retrying.",
            };
          else if (result !== undefined) j.result = result;
        }),
      );
    },
  };
  return api;
}
module.exports = { createJobManager };
