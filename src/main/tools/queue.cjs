"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { fail, text, grant } = require("./runtime.cjs");
function createToolQueue(directory, execute, options = {}) {
  let consuming = false,
    disposed = false;
  let paused = false, controlLoaded = false;
  const idle = [];
  const active = new Map();
  const writes = new Map();
  const transitions = new Map();
  async function transition(id, work) {
    const previous = transitions.get(id) || Promise.resolve();
    const pending = previous.catch(() => {}).then(work);
    transitions.set(id, pending);
    try { return await pending; }
    finally { if (transitions.get(id) === pending) transitions.delete(id); }
  }
  function retainOutcome(record) {
    if (!record.result) return;
    const outcomes = record.previousOutcomes || [];
    if (!Array.isArray(outcomes) || outcomes.length >= 10) fail("QUEUE_HISTORY_LIMIT");
    record.previousOutcomes = [...outcomes, {state:record.state,finishedAt:record.finishedAt,result:record.result}];
    delete record.result;
    delete record.finishedAt;
    delete record.cancelRequested;
  }
  async function prepare() {
    if (!directory || !path.isAbsolute(directory))
      fail("QUEUE_STORAGE_UNAVAILABLE");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    if (!controlLoaded) {
      try { paused = (await fs.readFile(path.join(directory, "queue.control"), "utf8")) === "paused"; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      controlLoaded = true;
    }
  }
  function file(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) fail("INVALID_REQUEST");
    return path.join(directory, id + ".json");
  }
  async function write(record) {
    const serialized = JSON.stringify(record);
    if (Buffer.byteLength(serialized) > 131072) fail("QUEUE_RECORD_LIMIT");
    const prior = writes.get(record.id) || Promise.resolve();
    const pending = prior.catch(() => {}).then(() => writeRecord(record.id, serialized));
    writes.set(record.id, pending);
    try { await pending; }
    finally { if (writes.get(record.id) === pending) writes.delete(record.id); }
  }
  async function writeRecord(id, serialized) {
    const destination = file(id),
      temporary = destination + ".tmp-" + randomUUID();
    try {
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
      await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  async function read(id) {
    const target = file(id),
      stat = await fs.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 131072)
      fail("INVALID_QUEUE_RECORD");
    const record = JSON.parse(await fs.readFile(target, "utf8"));
    if (
      record.id !== id ||
      ![
        "queued",
        "running",
        "cancelling",
        "interrupted",
        "completed",
        "failed",
        "cancelled",
      ].includes(record.state) ||
      !["converter.convert", "ollama.pull", "pdf.execute", "transfer.download"].includes(
        record.request?.action,
      )
    )
      fail("INVALID_QUEUE_RECORD");
    record.request = require("./request-contract.cjs").admit(record.request);
    return record;
  }
  function grants(request) { return [...(request.sourceIds || [request.sourceId]),request.destinationId].filter(Boolean); }
  async function releaseUnused(record) {
    if (!options.releaseGrants) return;
    const candidates = new Set(grants(record.request));
    const stream = await fs.opendir(directory);
    for await (const entry of stream) {
      if (!entry.name.endsWith(".json") || entry.name === record.id + ".json") continue;
      const other = await read(entry.name.slice(0,-5));
      if (["queued","running","cancelling","interrupted"].includes(other.state)) for (const id of grants(other.request)) candidates.delete(id);
    }
    await options.releaseGrants([...candidates]);
  }
  async function exportHistory(destinationId, context) {
    const destination = await grant(options,destinationId,"write");
    const temporary = path.join(path.dirname(destination),".queue-history-"+randomUUID());
    const handle = await fs.open(temporary,"wx",0o600);
    let count=0, bytes=0;
    try {
      const stream=await fs.opendir(directory);
      for await(const entry of stream) {
        if(context.signal?.aborted) fail("CANCELLED");
        if(!entry.name.endsWith(".json")) continue;
        const r=await read(entry.name.slice(0,-5));
        const row={id:r.id,action:r.request.action,category:r.request.category,format:r.request.format,operation:r.request.operation,state:r.state,createdAt:r.createdAt,finishedAt:r.finishedAt,bytes:r.result?.bytes,sha256:r.result?.sha256,code:r.result?.code,incompleteOutput:r.result?.incompleteOutput};
        const line=JSON.stringify(row)+"\n";bytes+=Buffer.byteLength(line);
        await handle.writeFile(line);count++;
      }
      await handle.sync();await handle.close();
      await grant(options,destinationId,"write");
      if(context.signal?.aborted)fail("CANCELLED");
      await fs.link(temporary,destination);
      return {count,bytes};
    } finally {await handle.close().catch(()=>{});await fs.rm(temporary,{force:true});}
  }
  async function page(after = "", limit = 50) {
    await prepare();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      fail("INVALID_REQUEST");
    const records = [];
    let more = false;
    const stream = await fs.opendir(directory);
    for await (const entry of stream) {
      if (!entry.name.endsWith(".json")) continue;
      const record = await read(entry.name.slice(0, -5));
      if (record.id > after) {
        records.push(record);
        records.sort((a, b) => a.id.localeCompare(b.id));
        if (records.length > limit) { records.pop(); more = true; }
      }
    }
    return {
      items: records,
      next: more ? records.at(-1).id : null,
      paused,
    };
  }
  return {
    async dispose() {
      disposed = true;
      for (const entry of active.values()) entry.controller.abort();
      if (consuming) await new Promise((resolve) => idle.push(resolve));
    },
    async dispatch(request, context) {
      if (disposed) fail("SERVICE_DISPOSED");
      await prepare();
      switch (request.action) {
        case "queue.export":
          return exportHistory(request.destinationId,context);
        case "queue.pause":
          paused = true;
          await fs.writeFile(path.join(directory,"queue.control"), "paused", {mode:0o600});
          return { paused, running: consuming };
        case "queue.rebind": {
          return transition(request.id, async () => {
          const record = await read(request.id);
          if (consuming || active.has(record.id) || record.state === "completed") fail("INVALID_QUEUE_STATE");
          if (record.request.action !== request.job.action) fail("INVALID_REQUEST");
          if (record.request.action === "transfer.download" && (request.job.accepted !== true || request.job.destinationId === record.request.destinationId)) fail("FRESH_TRANSFER_CONSENT_REQUIRED");
          const previous={...record};
          retainOutcome(record);
          record.request = require("./request-contract.cjs").admit(request.job);
          record.state = "queued";
          delete record.result;
          await write(record);
          await releaseUnused(previous);
          return {job:record};
          });
        }
        case "queue.add":
          if (
            !request.job ||
            !["converter.convert", "ollama.pull", "pdf.execute", "transfer.download"].includes(
              request.job.action,
            )
          )
            fail("INVALID_REQUEST");
          {
            const admitted = require("./request-contract.cjs").admit(
              request,
            ).job;
            if (admitted.destinationId && options.resolveGrant) {
              const destination=await grant(options,admitted.destinationId,"write");
              const storage=await fs.statfs(path.dirname(destination));
              if(storage.bavail*storage.bsize<512*1024*1024)fail("DESTINATION_STORAGE_LIMIT");
            }
            const record = {
              id: randomUUID(),
              state: "queued",
              request: admitted,
              createdAt: new Date().toISOString(),
            };
            if (Buffer.byteLength(JSON.stringify(record)) > 65536)
              fail("REQUEST_LIMIT");
            await write(record);
            return { job: record };
          }
        case "queue.page":
          return page(request.after || "", request.limit || 50);
        case "queue.cancel": {
          text(request.id, 36);
          return transition(request.id, async () => {
          const current = active.get(request.id);
          if (current) {
            current.record.cancelRequested = true;
            if (current.record.state === "running") current.record.state = "cancelling";
            const pending = write(current.record);
            current.controller.abort();
            await pending;
            return { job: current.record };
          }
          const record = await read(request.id);
          if (active.has(request.id)) fail("QUEUE_STATE_CHANGED");
          if (record.state === "queued") {
            record.state = "cancelled";
            await write(record);
            if (!active.has(record.id)) await releaseUnused(record);
          } else if (["running", "cancelling", "interrupted"].includes(record.state)) {
            // No owned live controller means cancellation cannot prove rollback.
            record.state = "interrupted";
            record.result ||= {ok:false,code:"QUEUE_OUTCOME_UNKNOWN",incompleteOutput:{state:"unknown",publication:"unconfirmed"}};
            await write(record);
          }
          return { job: record };
          });
        }
        case "queue.recover": {
          if (consuming) fail("QUEUE_ALREADY_RUNNING");
          const stream = await fs.opendir(directory);
          let recovered = 0;
          for await (const entry of stream) {
            if (!entry.name.endsWith(".json")) continue;
            const record = await read(entry.name.slice(0, -5));
            if (["running", "cancelling"].includes(record.state) && !active.has(record.id)) {
              record.state = "interrupted";
              record.result ||= {ok:false,code:"QUEUE_OUTCOME_UNKNOWN",incompleteOutput:{state:"unknown",publication:"unconfirmed"}};
              await write(record);
              recovered++;
            }
          }
          return { recovered };
        }
        case "queue.resume": {
          return transition(request.id, async () => {
          const record = await read(request.id);
          if (consuming || active.has(record.id)) fail("QUEUE_ALREADY_RUNNING");
          if (record.request.action === "transfer.download") fail("FRESH_TRANSFER_CONSENT_REQUIRED");
          if (record.state === "interrupted" || record.result?.incompleteOutput?.state === "unknown") fail("QUEUE_OUTCOME_UNKNOWN");
          if (!["interrupted", "failed", "cancelled"].includes(record.state))
            fail("INVALID_QUEUE_STATE");
          retainOutcome(record);
          record.state = "queued";
          delete record.result;
          await write(record);
          return { job: record };
          });
        }
        case "queue.run": {
          if (consuming) fail("QUEUE_ALREADY_RUNNING");
          consuming = true;
          paused = false;
          let completed = 0,
            failed = 0;
          const outcomes = [];
          try {
            await fs.writeFile(path.join(directory,"queue.control"), "running", {mode:0o600});
            const stream = await fs.opendir(directory);
            for await (const entry of stream) {
              if (disposed || paused || context.signal?.aborted) break;
              if (!entry.name.endsWith(".json")) continue;
              let record = await read(entry.name.slice(0, -5));
              if (disposed || paused || context.signal?.aborted) break;
              if (record.state !== "queued") continue;
              const controller = new AbortController();
              const abort = () => controller.abort();
              context.signal?.addEventListener("abort", abort, { once: true });
              let claimed;
              try {
                claimed = await transition(record.id, async () => {
                  record = await read(record.id);
                  if (record.state !== "queued") return false;
                  active.set(record.id, {controller, record});
                  record.startedAt = new Date().toISOString();
                  record.state = "running";
                  await write(record);
                  return true;
                });
              } catch (error) {
                active.delete(record.id);
                context.signal?.removeEventListener("abort", abort);
                throw error;
              }
              if (!claimed) { context.signal?.removeEventListener("abort", abort); continue; }
              if (disposed || context.signal?.aborted) controller.abort();
              try {
                let result;
                try { result = await execute(record.request, {
                  signal: controller.signal,
                  onProgress: async (event) => {
                    if (record.request.action === "transfer.download" && event?.type === "transfer" && Number.isSafeInteger(event.bytes) && event.bytes >= 0 && event.bytes <= 536870912 && (event.total === null || Number.isSafeInteger(event.total) && event.total >= event.bytes && event.total <= 536870912) && Number.isSafeInteger(event.bytesPerSecond) && event.bytesPerSecond >= 0 && (event.etaSeconds === null || Number.isSafeInteger(event.etaSeconds) && event.etaSeconds >= 0)) {
                      record.progress = {bytes:event.bytes,total:event.total,bytesPerSecond:event.bytesPerSecond,etaSeconds:event.etaSeconds};
                      await write(record);
                    }
                    context.onProgress?.({ jobId: record.id, ...event });
                  },
                }); } catch {
                  result = {ok:false,code:"QUEUE_ADAPTER_OUTCOME_UNKNOWN",incompleteOutput:{state:"unknown",publication:"unconfirmed"}};
                }
                if (!result || typeof result.ok !== "boolean") result = {ok:false,code:"QUEUE_ADAPTER_OUTCOME_UNKNOWN",incompleteOutput:{state:"unknown",publication:"unconfirmed"}};
                // A validated published result wins over a cancellation arriving after completion.
                record.state = result.ok ? "completed" : result.incompleteOutput?.state === "unknown" ? "interrupted" : controller.signal.aborted ? "cancelled" : "failed";
                record.finishedAt = new Date().toISOString();
                record.result = result;
                await write(record);
                if (record.state !== "interrupted") await releaseUnused(record);
                outcomes.push({id:record.id,state:record.state,code:record.result.code,...(record.result.incompleteOutput?{incompleteOutput:record.result.incompleteOutput}:{})});
                if (outcomes.length > 100) outcomes.shift();
                if (record.state === "completed") completed++;
                else failed++;
              } finally {
                active.delete(record.id);
                context.signal?.removeEventListener("abort", abort);
              }
            }
            return {
              completed,
              failed,
              outcomes,
              outcomeCount: completed + failed,
              outcomesTruncated: completed + failed > outcomes.length,
              cancelled: context.signal?.aborted === true,
              paused,
            };
          } finally {
            consuming = false;
            for (const resolve of idle.splice(0)) resolve();
          }
        }
        default:
          fail("INVALID_REQUEST");
      }
    },
  };
}
module.exports = { createToolQueue };

