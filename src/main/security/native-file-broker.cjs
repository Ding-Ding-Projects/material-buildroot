"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { inspectCanonicalPath } = require("./file-grants.cjs");
const capabilities = new WeakSet();
const supported = Object.freeze({ imagemagick: ["png", "jpg", "webp"], ffmpeg: ["wav", "mp3", "flac"] });
function fail(code) { throw Object.assign(new Error(code), { code }); }
function hash(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function relative(value) {
  if (typeof value !== "string" || !value || value.length > 512 ||
      value.includes("\\") || value.split("/").some(part => !part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part))) fail("INVALID_BROKER_PAYLOAD");
  return value;
}
async function verified(file, expected, max) {
  if (!/^[a-f0-9]{64}$/.test(expected || "")) fail("MISSING_VERIFIED_BROKER");
  inspectCanonicalPath(file);
  const handle = await fs.open(file, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > max) fail("BROKER_PAYLOAD_LIMIT");
    const bytes = await handle.readFile();
    if (hash(bytes) !== expected) fail("BROKER_PAYLOAD_HASH_MISMATCH");
    return bytes;
  } finally { await handle.close(); }
}
function execute(file, args, signal) {
  if (signal?.aborted) fail("CANCELLED");
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"], env: { SystemRoot: process.env.SystemRoot || "" } });
    let stdout = "", bytes = 0, reason = null;
    const cancel = () => { reason ||= "CANCELLED"; child.stdin.end("cancel"); };
    // Closing this pipe is itself cancellation in the broker. Never orphan a decoder.
    child.stdin.on("error", () => {});
    const timeout = setTimeout(() => { reason = "BROKER_TIMEOUT"; cancel(); }, 35000);
    const force = setTimeout(() => { reason ||= "BROKER_TIMEOUT"; child.kill(); }, 41000);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    const consume = (chunk, capture) => {
      bytes += chunk.length;
      if (bytes > 4096) { reason = "BROKER_PROTOCOL_LIMIT"; cancel(); }
      else if (capture) stdout += chunk.toString("utf8");
    };
    child.stdout.on("data", chunk => consume(chunk, true));
    child.stderr.on("data", chunk => consume(chunk, false));
    const cleanup = () => { clearTimeout(timeout); clearTimeout(force); signal?.removeEventListener("abort", cancel); };
    child.once("error", () => { cleanup(); reject(Object.assign(new Error("BROKER_UNAVAILABLE"), { code: "BROKER_UNAVAILABLE" })); });
    child.once("close", code => {
      cleanup();
      if (reason || code !== 0) {
        const error = Object.assign(new Error(reason || "BROKER_UNAVAILABLE"), { code: reason || "BROKER_UNAVAILABLE", incompleteOutput: { state: "unknown", publication: "unconfirmed" } });
        try {
          const receipt = JSON.parse(stdout);
          if (receipt.protocol === 1 && receipt.state === "incomplete" && receipt.publication === "not-published" && /^\.material-incomplete-[a-fA-F0-9-]{36}\.tmp$/.test(receipt.temporaryName) && Object.keys(receipt).length === 4)
            error.incompleteOutput = { state: "retained", name: receipt.temporaryName, publication: "not-published" };
        } catch {}
        return reject(error);
      }
      try {
        const receipt = JSON.parse(stdout);
        const operation = args[0];
        const admission = receipt.admission;
        if (receipt.protocol !== 1 || receipt.state !== "completed" || receipt.operation !== operation || receipt.mechanism !== "appcontainer-handle-job" ||
            !Number.isSafeInteger(receipt.outputBytes) || receipt.outputBytes < 1 || receipt.outputBytes > 128 * 1024 * 1024 ||
            !/^[a-f0-9]{64}$/.test(receipt.sourceSha256 || "") || !/^[a-f0-9]{64}$/.test(receipt.outputSha256 || "") ||
            receipt.validation !== "signature-and-decoder-roundtrip" || receipt.publication !== "atomic-no-replace" ||
            !admission || admission.appContainer !== true || admission.lpac !== true || admission.capabilityCount !== 0 || admission.jobAssigned !== true || admission.handleList !== true ||
            Object.keys(admission).length !== 5 || Object.keys(receipt).length !== 10) fail("INVALID_BROKER_RECEIPT");
        resolve(receipt);
      } catch { reject(Object.assign(new Error("INVALID_BROKER_RECEIPT"), { code: "INVALID_BROKER_RECEIPT" })); }
    });
  });
}
/** Host-owned adapter manifests and native grant resolver only. Not an IPC API. */
function createNativeFileBroker({ brokerPath, brokerSha256, payloads, resolveNativeGrant }) {
  if (typeof resolveNativeGrant !== "function") fail("FILE_GRANT_REQUIRED");
  const service = Object.freeze({
    // These are implemented operations, not a claim of runtime acceptance.
    formats: supported,
    async describe(adapterId) {
      try {
        if (process.platform !== "win32" || !supported[adapterId]) fail("BROKER_FORMAT_UNAVAILABLE");
        await verified(brokerPath, brokerSha256, 16 * 1024 * 1024);
        const manifest = payloads?.[adapterId];
        if (!manifest || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 4096 || typeof manifest.root !== "string") fail("MISSING_VERIFIED_PAYLOAD");
        const executable = relative(manifest.executable);
        if (executable.includes("/")) fail("INVALID_BROKER_PAYLOAD");
        let total = 0; const seen = new Set();
        for (const entry of manifest.files) {
          const name = relative(entry.path), key = name.toLowerCase();
          if (seen.has(key)) fail("INVALID_BROKER_PAYLOAD");
          seen.add(key);
          const bytes = await verified(path.join(manifest.root, ...name.split("/")), entry.sha256, 256 * 1024 * 1024);
          total += bytes.length;
          if (total > 1024 * 1024 * 1024) fail("BROKER_PAYLOAD_LIMIT");
        }
        if (!seen.has(executable.toLowerCase())) fail("MISSING_VERIFIED_PAYLOAD");
        return { adapterId, formats: [...supported[adapterId]], attemptAvailable: true, runtimeAcceptance: "unverified", mechanism: "appcontainer-handle-job" };
      } catch (error) {
        return { adapterId, formats: [], attemptAvailable: false, runtimeAcceptance: "unverified", reason: /^[A-Z_]+$/.test(error.code || "") ? error.code : "BROKER_UNAVAILABLE" };
      }
    },
    async run(request, context = {}) {
      if (process.platform !== "win32") fail("NATIVE_BROKER_PLATFORM_REQUIRED");
      const { adapterId, sourceId, destinationId, format } = request;
      if (!supported[adapterId]?.includes(format)) fail("BROKER_FORMAT_UNAVAILABLE");
      const source = await resolveNativeGrant(sourceId, "read");
      const output = await resolveNativeGrant(destinationId, "write");
      if (source.kind !== "file" || source.newOutput || !/^[0-9]+:[0-9]+$/.test(source.identity || "") || output.kind !== "file" || !output.newOutput || !/^[0-9]+:[0-9]+$/.test(output.identity || "") || source.path === output.path) fail("NATIVE_FILE_GRANT_REQUIRED");
      const manifest = payloads?.[adapterId];
      if (!manifest || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 4096 || typeof manifest.root !== "string") fail("MISSING_VERIFIED_PAYLOAD");
      const executable = relative(manifest.executable);
      // Native broker currently admits one executable directly inside the staged root.
      if (executable.includes("/")) fail("INVALID_BROKER_PAYLOAD");
      const brokerBytes = await verified(brokerPath, brokerSha256, 16 * 1024 * 1024);
      const staging = await fs.mkdtemp(path.join(os.tmpdir(), "material-decoder-"));
      let total = 0;
      const seen = new Set();
      try {
        // The broker itself is staged with a fixed hash and never receives renderer argv.
        const localBroker = path.join(staging, "broker.exe");
        await fs.writeFile(localBroker, brokerBytes, { flag: "wx" });
        const runtime = path.join(staging, "runtime");
        await fs.mkdir(runtime);
        for (const entry of manifest.files) {
          const name = relative(entry.path), key = name.toLowerCase();
          if (seen.has(key)) fail("INVALID_BROKER_PAYLOAD");
          seen.add(key);
          const bytes = await verified(path.join(manifest.root, ...name.split("/")), entry.sha256, 256 * 1024 * 1024);
          total += bytes.length;
          if (total > 1024 * 1024 * 1024) fail("BROKER_PAYLOAD_LIMIT");
          const destination = path.join(runtime, ...name.split("/"));
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, bytes, { flag: "wx" });
        }
        if (!seen.has(executable.toLowerCase())) fail("MISSING_VERIFIED_PAYLOAD");
        // Revalidate host grants immediately before crossing into the native broker.
        const currentSource = await resolveNativeGrant(sourceId, "read"), currentOutput = await resolveNativeGrant(destinationId, "write");
        if (JSON.stringify(currentSource) !== JSON.stringify(source) || JSON.stringify(currentOutput) !== JSON.stringify(output)) fail("GRANT_CHANGED");
        const receipt = await execute(localBroker, [adapterId + "-" + format, source.path, output.path, runtime, executable, source.identity, output.identity], context.signal);
        return { ...receipt, destinationId, outputCreated: true };
      } finally {
        // Only the exact newly created private staging root is removed.
        await fs.rm(staging, { recursive: true, force: true });
      }
    },
  });
  capabilities.add(service);
  return service;
}
function isNativeFileBroker(value) { return capabilities.has(value); }
module.exports = { createNativeFileBroker, isNativeFileBroker };
