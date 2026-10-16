"use strict";
const { createHash } = require("node:crypto");
const OWNER = "io.material-buildroot.cache";
const IMAGE = /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/;
function validate(runtime) {
  if (runtime?.kind !== "docker" || !IMAGE.test(runtime.image || "") || !Number.isSafeInteger(runtime.uid) || runtime.uid < 1 || runtime.uid > 65535 || !Number.isSafeInteger(runtime.gid) || runtime.gid < 1 || runtime.gid > 65535) throw new Error("invalid-container-runtime");
}
function failure(result) {
  if (result.state === "unavailable") return "client-unavailable";
  if (/permission denied|access is denied|access denied/i.test(result.stderr || "")) return "permission-denied";
  if (/cannot connect|is the docker daemon running|error during connect|connection refused/i.test(result.stderr || "")) return "daemon-unavailable";
  return "runtime-unavailable";
}
function createDockerRuntime({ run, identity }) {
  const checked = async (args) => {
    const result = await run(args);
    if (result.state !== "succeeded") throw new Error(failure(result));
    return result.stdout;
  };
  const descriptor = (grant, runtime, daemonId) => {
    validate(runtime);
    const key = createHash("sha256").update(JSON.stringify([grant.root, grant.source, runtime.image, runtime.uid, runtime.gid, daemonId])).digest("hex");
    return { name: `material-buildroot-cache-${key.slice(0, 32)}`, key, daemonId, uid: runtime.uid, gid: runtime.gid };
  };
  const inspect = async (value) => {
    const items = JSON.parse(await checked(["volume", "inspect", value.name]));
    const item = Array.isArray(items) && items.length === 1 ? items[0] : null;
    if (item?.Name !== value.name || item?.Driver !== "local" || Object.keys(item.Options || {}).length !== 0 || item?.Labels?.[OWNER] !== value.key) throw new Error("managed-volume-ownership-mismatch");
    if (await identity() !== value.daemonId) throw new Error("runtime-namespace-changed");
    return value;
  };
  return {
    async discover() {
      const result = await run(["version", "--format", "{{.Server.Os}}"]);
      const available = result.state === "succeeded" && result.stdout.trim() === "linux";
      const reason = available ? "ready" : result.state === "succeeded" ? "linux-engine-required" : failure(result);
      const images = [];
      let imageState = "unavailable";
      if (available) {
        const listed = await run(["image", "ls", "--digests", "--format", "{{json .}}"]);
        imageState = listed.state;
        if (listed.state === "succeeded") {
          for (const line of listed.stdout.trim().split(/\r?\n/).filter(Boolean)) {
            try { const item = JSON.parse(line); const reference = `${item.Repository}@${item.Digest}`; if (IMAGE.test(reference) && !images.includes(reference)) images.push(reference); } catch { imageState = "invalid-response"; }
          }
        }
      }
      return { state: result.state, code: result.code, stdout: "", stderr: "", available, reason, images: images.slice(0, 200), imageState };
    },
    async prepare(grant, runtime) {
      const value = descriptor(grant, runtime, await identity());
      // Inspect the pinned local image before creating persistent storage. No pull is performed.
      await checked(["image", "inspect", runtime.image]);
      const names = (await checked(["volume", "ls", "--format", "{{.Name}}", "--filter", `name=^${value.name}$`])).trim().split(/\r?\n/);
      if (!names.includes(value.name)) await checked(["volume", "create", "--driver", "local", "--label", `${OWNER}=${value.key}`, value.name]);
      return { ...await inspect(value), state: "prepared", permissions: "unverified", retained: true };
    },
    async requireCache(grant, runtime) {
      return inspect(descriptor(grant, runtime, await identity()));
    },
  };
}
module.exports = { createDockerRuntime };
