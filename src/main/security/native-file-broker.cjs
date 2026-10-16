"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { inspectCanonicalPath } = require("./file-grants.cjs");
const capabilities = new WeakSet();
const supported = Object.freeze({ imagemagick: Object.freeze(["png", "jpg", "webp"]), ffmpeg: Object.freeze(["wav", "mp3", "flac", "mp4", "webm"]), qpdf: Object.freeze(["extract", "reorder", "merge", "rotate", "metadata"]) });
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
        const pdf = operation.startsWith("qpdf-");
        const merge = operation === "qpdf-merge", rotate = operation === "qpdf-rotate", metadata = operation === "qpdf-metadata";
        const selection = pdf && !merge && !metadata ? args[7].split(",").map(Number) : [];
        const validation = rotate ? "qpdf-structure-page-count-and-rotation" : metadata ? "qpdf-structure-page-count-and-metadata" : pdf ? "qpdf-structure-and-page-count" : "signature-and-decoder-roundtrip";
        if (receipt.protocol !== 1 || receipt.state !== "completed" || receipt.operation !== operation || receipt.mechanism !== "appcontainer-handle-job" ||
            !Number.isSafeInteger(receipt.outputBytes) || receipt.outputBytes < 1 || receipt.outputBytes > 128 * 1024 * 1024 ||
            !/^[a-f0-9]{64}$/.test(receipt.sourceSha256 || "") || !/^[a-f0-9]{64}$/.test(receipt.outputSha256 || "") ||
            receipt.validation !== validation || receipt.publication !== "atomic-no-replace" ||
            !admission || admission.appContainer !== true || admission.lpac !== true || admission.capabilityCount !== 0 || admission.jobAssigned !== true || admission.handleList !== true ||
            Object.keys(admission).length !== 5 || Object.keys(receipt).length !== (merge || rotate || metadata ? 15 : pdf ? 13 : 10)) fail("INVALID_BROKER_RECEIPT");
        if (pdf && (!Number.isSafeInteger(receipt.inputPages) || receipt.inputPages < 1 || receipt.inputPages > 10000 ||
            receipt.expectedPages !== (merge || rotate || metadata ? receipt.inputPages : selection.length) || receipt.outputPages !== receipt.expectedPages || selection.some(page => page > receipt.inputPages))) fail("INVALID_BROKER_RECEIPT");
        if (merge) {
          const count = (args.length - 8) / 2 + 1;
          if (!Array.isArray(receipt.sourceSha256s) || receipt.sourceSha256s.length !== count || receipt.sourceSha256s[0] !== receipt.sourceSha256 || receipt.sourceSha256s.some(value => !/^[a-f0-9]{64}$/.test(value || "")) ||
              !Array.isArray(receipt.inputPageCounts) || receipt.inputPageCounts.length !== count || receipt.inputPageCounts.some(value => !Number.isSafeInteger(value) || value < 1 || value > 10000) || receipt.inputPageCounts.reduce((sum, value) => sum + value, 0) !== receipt.inputPages) fail("INVALID_BROKER_RECEIPT");
        }
        if (rotate && (receipt.degrees !== Number(args[8]) || receipt.rotationVerified !== true)) fail("INVALID_BROKER_RECEIPT");
        if (metadata && (receipt.metadataMode !== "remove" || receipt.metadataAbsent !== true)) fail("INVALID_BROKER_RECEIPT");
        resolve(receipt);
      } catch { reject(Object.assign(new Error("INVALID_BROKER_RECEIPT"), { code: "INVALID_BROKER_RECEIPT", incompleteOutput: { state: "unknown", publication: "unconfirmed" } })); }
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
      const pdf = adapterId === "qpdf";
      const merge = pdf && format === "merge", rotate = pdf && format === "rotate", metadata = pdf && format === "metadata";
      if (pdf && !merge && !metadata && (!Array.isArray(request.pages) || !request.pages.length || request.pages.length > 1000 || request.pages.some(page => !Number.isInteger(page) || page < 1 || page > 10000))) fail("INVALID_PAGE_SELECTION");
      if (rotate && (![90, 180, 270].includes(request.degrees) || new Set(request.pages).size !== request.pages.length)) fail("INVALID_ROTATION");
      if (metadata && request.mode !== "remove") fail("UNSUPPORTED_METADATA_MODE");
      const ids = merge ? request.sourceIds : [sourceId];
      if (!Array.isArray(ids) || !ids.length || ids.length > 8 || ids.some(id => typeof id !== "string")) fail("INPUT_LIMIT");
      const sources = await Promise.all(ids.map(id => resolveNativeGrant(id, "read")));
      const source = sources[0];
      const output = await resolveNativeGrant(destinationId, "write");
      if (source.kind !== "file" || source.newOutput || !/^[0-9]+:[0-9]+$/.test(source.identity || "") || output.kind !== "file" || !output.newOutput || !/^[0-9]+:[0-9]+$/.test(output.identity || "") || source.path === output.path) fail("NATIVE_FILE_GRANT_REQUIRED");
      if (sources.some(item => item.kind !== "file" || item.newOutput || !/^[0-9]+:[0-9]+$/.test(item.identity || "") || item.path === output.path)) fail("NATIVE_FILE_GRANT_REQUIRED");
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
        const currentSources = await Promise.all(ids.map(id => resolveNativeGrant(id, "read"))), currentOutput = await resolveNativeGrant(destinationId, "write");
        if (JSON.stringify(currentSources) !== JSON.stringify(sources) || JSON.stringify(currentOutput) !== JSON.stringify(output)) fail("GRANT_CHANGED");
        const args = [adapterId + "-" + format, source.path, output.path, runtime, executable, source.identity, output.identity];
        if (pdf) args.push(merge ? "merge" : metadata ? "remove" : request.pages.join(","));
        if (rotate) args.push(String(request.degrees));
        if (merge) for (const item of sources.slice(1)) args.push(item.path, item.identity);
        if (args.reduce((total, value) => total + value.length + 3, localBroker.length) > 24000) fail("BROKER_ARGUMENT_LIMIT");
        const receipt = await execute(localBroker, args, context.signal);
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
