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
    const destination = file(record.id),
      temporary = destination + ".tmp-" + randomUUID();
    try {
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); } finally { await handle.close(); }
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
        "interrupted",
        "completed",
        "failed",
        "cancelled",
      ].includes(record.state) ||
      !["converter.convert", "ollama.pull", "pdf.execute"].includes(
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
      if (["queued","running","interrupted"].includes(other.state)) for (const id of grants(other.request)) candidates.delete(id);
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
      for (const controller of active.values()) controller.abort();
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
          const record = await read(request.id);
          if (consuming || active.has(record.id) || record.state === "completed") fail("INVALID_QUEUE_STATE");
          if (record.request.action !== request.job.action) fail("INVALID_REQUEST");
          const previous={...record};
          record.request = require("./request-contract.cjs").admit(request.job);
          record.state = "queued";
          delete record.result;
          await write(record);
          await releaseUnused(previous);
          return {job:record};
        }
        case "queue.add":
          if (
            !request.job ||
            !["converter.convert", "ollama.pull", "pdf.execute"].includes(
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
          active.get(request.id)?.abort();
          const record = await read(request.id);
          if (["queued", "running", "interrupted"].includes(record.state)) {
            record.state = "cancelled";
            await write(record);
            if (!active.has(record.id)) await releaseUnused(record);
          }
          return { job: record };
        }
        case "queue.recover": {
          const stream = await fs.opendir(directory);
          let recovered = 0;
          for await (const entry of stream) {
            if (!entry.name.endsWith(".json")) continue;
            const record = await read(entry.name.slice(0, -5));
            if (record.state === "running" && !active.has(record.id)) {
              record.state = "interrupted";
              await write(record);
              recovered++;
            }
          }
          return { recovered };
        }
        case "queue.resume": {
          const record = await read(request.id);
          if (!["interrupted", "failed", "cancelled"].includes(record.state))
            fail("INVALID_QUEUE_STATE");
          record.state = "queued";
          delete record.result;
          await write(record);
          return { job: record };
        }
        case "queue.run": {
          if (consuming) fail("QUEUE_ALREADY_RUNNING");
          consuming = true;
          paused = false;
          await fs.writeFile(path.join(directory,"queue.control"), "running", {mode:0o600});
          let completed = 0,
            failed = 0;
          try {
            const stream = await fs.opendir(directory);
            for await (const entry of stream) {
              if (disposed || paused || context.signal?.aborted) break;
              if (!entry.name.endsWith(".json")) continue;
              const record = await read(entry.name.slice(0, -5));
              if (disposed || paused || context.signal?.aborted) break;
              if (record.state !== "queued") continue;
              const controller = new AbortController();
              const abort = () => controller.abort();
              context.signal?.addEventListener("abort", abort, { once: true });
              active.set(record.id, controller);
              record.startedAt = new Date().toISOString();
              record.state = "running";
              await write(record);
              if (disposed || context.signal?.aborted) controller.abort();
              try {
                const result = await execute(record.request, {
                  signal: controller.signal,
                  onProgress: (event) =>
                    context.onProgress?.({ jobId: record.id, ...event }),
                });
                // A validated published result wins over a cancellation arriving after completion.
                record.state = result.ok ? "completed" : controller.signal.aborted ? "cancelled" : "failed";
                record.finishedAt = new Date().toISOString();
                record.result = result;
                await write(record);
                await releaseUnused(record);
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
