"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { fail, text } = require("./runtime.cjs");
function createToolQueue(directory, execute) {
  let consuming = false,
    disposed = false;
  const idle = [];
  const active = new Map();
  async function prepare() {
    if (!directory || !path.isAbsolute(directory))
      fail("QUEUE_STORAGE_UNAVAILABLE");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  }
  function file(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) fail("INVALID_REQUEST");
    return path.join(directory, id + ".json");
  }
  async function write(record) {
    const destination = file(record.id),
      temporary = destination + ".tmp-" + randomUUID();
    try {
      await fs.writeFile(temporary, JSON.stringify(record), {
        flag: "wx",
        mode: 0o600,
      });
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
  async function page(after = "", limit = 50) {
    await prepare();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      fail("INVALID_REQUEST");
    const records = [];
    const stream = await fs.opendir(directory);
    for await (const entry of stream) {
      if (!entry.name.endsWith(".json")) continue;
      const record = await read(entry.name.slice(0, -5));
      if (record.id > after) {
        records.push(record);
        records.sort((a, b) => a.id.localeCompare(b.id));
        if (records.length > limit) records.pop();
      }
    }
    return {
      items: records,
      next: records.length === limit ? records.at(-1).id : null,
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
          let completed = 0,
            failed = 0;
          try {
            const stream = await fs.opendir(directory);
            for await (const entry of stream) {
              if (disposed || context.signal?.aborted) break;
              if (!entry.name.endsWith(".json")) continue;
              const record = await read(entry.name.slice(0, -5));
              if (disposed || context.signal?.aborted) break;
              if (record.state !== "queued") continue;
              const controller = new AbortController();
              const abort = () => controller.abort();
              context.signal?.addEventListener("abort", abort, { once: true });
              active.set(record.id, controller);
              record.state = "running";
              await write(record);
              if (disposed || context.signal?.aborted) controller.abort();
              try {
                const result = await execute(record.request, {
                  signal: controller.signal,
                  onProgress: (event) =>
                    context.onProgress?.({ jobId: record.id, ...event }),
                });
                record.state = controller.signal.aborted
                  ? "cancelled"
                  : result.ok
                    ? "completed"
                    : "failed";
                record.result = result;
                await write(record);
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
