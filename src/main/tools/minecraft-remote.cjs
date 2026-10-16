"use strict";
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { createHash, randomUUID } = require("node:crypto");
const { fail, grant, executable, digest } = require("./runtime.cjs");
const { inspectCanonicalPath } = require("../security/file-grants.cjs");
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function validate(request) {
  const keys = (required, optional = []) => {
    if (required.some(key => !Object.hasOwn(request, key)) || Object.keys(request).some(key => !["action", ...required, ...optional].includes(key))) fail("INVALID_REQUEST");
  };
  if (request.action === "minecraft.remote.list") { keys([]); return; }
  if (request.action === "minecraft.remote.preview") {
    keys(["kind", "directoryId", "edition", "version", "flavour", "target", "host", "destination", "confirmStopped", "acceptEula"]);
    if (!["server", "world"].includes(request.kind) || !["java", "bedrock"].includes(request.edition) || !["vanilla", "paper", "fabric"].includes(request.flavour) || !["ssh-process", "ssh-container"].includes(request.target) || typeof request.directoryId !== "string" || !/^[A-Za-z0-9_.+-]{1,80}$/.test(request.version || "") || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(request.host || "") || typeof request.destination !== "string" || request.destination.length > 512 || !/^\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)+[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(request.destination) || request.confirmStopped !== true || typeof request.acceptEula !== "boolean") fail("INVALID_REMOTE_TRANSFER");
    if (request.kind === "server" && (request.edition !== "java" || request.acceptEula !== true)) fail("REMOTE_DISTRIBUTION_NOT_ADMITTED");
    if (request.edition === "bedrock" && request.flavour !== "vanilla") fail("INVALID_REMOTE_TRANSFER");
  } else if (request.action === "minecraft.remote.execute") {
    keys(["previewId", "confirmSha256"]);
    if (!/^[a-f0-9-]{36}$/.test(request.previewId || "") || !/^[a-f0-9]{64}$/.test(request.confirmSha256 || "")) fail("INVALID_REQUEST");
  } else if (["minecraft.remote.cancel", "minecraft.remote.status"].includes(request.action)) {
    keys(["previewId"]);
    if (!/^[a-f0-9-]{36}$/.test(request.previewId || "")) fail("INVALID_REQUEST");
  } else fail("INVALID_REQUEST");
}
async function readFile(file, limit) {
  inspectCanonicalPath(file);
  const stat = await fsp.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) fail("REMOTE_SOURCE_LIMIT");
  return fsp.readFile(file);
}
async function sourceInventory(options, request, signal) {
  const root = await grant(options, request.directoryId, "read");
  inspectCanonicalPath(root);
  if (request.kind === "world") {
    const document = JSON.parse((await readFile(path.join(root, ".material-world-backup.json"), 32 * 1024 * 1024)).toString("utf8"));
    const content = await require("./minecraft-worlds.cjs").inventory(root, signal);
    if (document.schema !== 1 || document.edition !== request.edition || document.version !== request.version || document.flavour !== request.flavour || document.sha256 !== content.sha256) fail("WORLD_BACKUP_COMPATIBILITY_MISMATCH");
    if (content.files.length > 10000 || content.bytes > 8 * 1024 ** 3 || content.files.some(file => file.path.length > 512 || file.path === ".material-transfer-receipt.json")) fail("REMOTE_TRANSFER_LIMIT");
    return { root, files: content.files.map(file => ({ ...file, source: path.join(root, file.path) })), bytes: content.bytes };
  }
  const receipt = JSON.parse((await readFile(path.join(root, "material-server-distribution.json"), 65536)).toString("utf8"));
  const entryPoint = receipt.entryPoint === "fabric-server-launch.jar" ? "fabric-server-launch.jar" : "server.jar";
  const server = path.join(root, entryPoint);
  inspectCanonicalPath(server);
  const stat = await fsp.lstat(server);
  if (!stat.isFile() || stat.size < 1 || stat.size > 256 * 1024 * 1024 || receipt.schema !== 1 || receipt.edition !== "java" || receipt.version !== request.version || receipt.flavour !== request.flavour || !/^[a-f0-9]{64}$/.test(receipt.sha256 || "") || await digest(server) !== receipt.sha256) fail("REMOTE_DISTRIBUTION_IDENTITY_MISMATCH");
  const original = (await readFile(path.join(root, "server.properties"), 1048576)).toString("utf8");
  const values = { "online-mode": true, "white-list": true };
  const known = ["server-port", "max-players", "difficulty", "gamemode", "white-list", "motd", "level-name"];
  for (const line of original.split(/\r?\n/)) {
    const match = /^([a-z-]+)=(.*)$/.exec(line);
    if (!match || !known.includes(match[1])) continue;
    if (match[1] === "white-list" && !["true", "false"].includes(match[2])) fail("INVALID_SERVER_PROPERTY");
    values[match[1]] = ["server-port", "max-players"].includes(match[1]) ? Number(match[2]) : match[1] === "white-list" ? match[2] === "true" : match[2];
  }
  const properties = require("./minecraft-managed.cjs").configuration(values, "java");
  const safeReceipt = { schema: 1, edition: "java", version: request.version, flavour: request.flavour, sha256: receipt.sha256, entryPoint };
  const generated = {
    "server.properties": Object.entries(properties).map(([key, value]) => key + "=" + value).join("\n") + "\n",
    "eula.txt": "eula=true\n",
    "material-server-distribution.json": JSON.stringify(safeReceipt) + "\n",
  };
  const files = [{ path: entryPoint, source: server, bytes: stat.size, sha256: receipt.sha256 }];
  if (entryPoint === "fabric-server-launch.jar") {
    if (!/^[a-f0-9]{40}$/.test(receipt.vanillaSha1 || "") || !Array.isArray(receipt.libraries) || receipt.libraries.length > 200) fail("FABRIC_LIBRARY_INVENTORY_UNAVAILABLE");
    const required = [{ path: "server.jar", sha1: receipt.vanillaSha1 }, ...receipt.libraries];
    for (const item of required) {
      if (typeof item.path !== "string" || !require("./zip-payload.cjs").safeName(item.path) || (item.path !== "server.jar" && !item.path.startsWith("libraries/")) || !/^[a-f0-9]{40}$/.test(item.sha1 || "")) fail("FABRIC_LIBRARY_IDENTITY_UNAVAILABLE");
      const file = path.join(root, item.path); inspectCanonicalPath(file); const itemStat = await fs.lstat(file);
      if (!itemStat.isFile() || itemStat.size > 256 * 1024 ** 2 || await digest(file, "sha1") !== item.sha1) fail("FABRIC_LIBRARY_HASH_MISMATCH");
      files.push({ path: item.path, source: file, bytes: itemStat.size, sha256: await digest(file) });
    }
  }
  for (const [name, text] of Object.entries(generated)) {
    const content = Buffer.from(text, "utf8");
    files.push({ path: name, content, bytes: content.length, sha256: hash(content) });
  }
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  if (total > 2 * 1024 ** 3 || new Set(files.map(file => file.path.toLowerCase())).size !== files.length) fail("REMOTE_TRANSFER_LIMIT");
  return { root, files, bytes: total };
}
async function ssh(options, host, script, { input, signal, timeout = 120000, maxBytes = 65536 } = {}) {
  const command = await executable(options, "ssh");
  if (signal?.aborted) fail("CANCELLED");
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2", "--", host, script], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    let done = false, output = "", bytes = 0, reason;
    const end = error => {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel);
      if (error) reject(Object.assign(new Error(error), { code: error })); else resolve(output.trim());
    };
    const cancel = () => {
      reason = "CANCELLED"; child.stdin.destroy(); child.kill();
      setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }, 1000).unref();
    };
    const timer = setTimeout(() => { cancel(); reason = "REMOTE_TRANSFER_TIMEOUT"; }, timeout); timer.unref();
    signal?.addEventListener("abort", cancel, { once: true });
    child.stdout.on("data", chunk => { bytes += chunk.length; if (bytes > maxBytes) { cancel(); reason = "REMOTE_RESPONSE_LIMIT"; } else output += chunk.toString("utf8"); });
    child.on("error", () => end("SSH_START_FAILED"));
    child.on("close", code => end(reason || (code === 0 ? null : "REMOTE_TRANSFER_FAILED")));
    child.once("spawn", () => {
      const stream = input ? typeof input === "string" ? fs.createReadStream(input) : Readable.from([input]) : Readable.from([]);
      pipeline(stream, child.stdin, { signal }).catch(() => { if (!done) { cancel(); reason = signal?.aborted ? "CANCELLED" : "REMOTE_INPUT_FAILED"; } });
    });
  });
}
function createRemote(options, assertStopped, store) {
  const log = store.log;
  const previews = new Map(), jobs = new Map();
  let disposed = false;
  const running = state => ["confirming", "connecting", "transferring", "verifying", "cancelling"].includes(state);
  function summary(id, job) { return { previewId: id, state: job.state, completed: job.completed, total: job.total, bytesCompleted: job.bytesCompleted, bytesTotal: job.bytesTotal, hostIdentityVerified: job.hostIdentityVerified, remoteDestinationMayExist: job.remoteDestinationMayExist, host: job.host, destination: job.destination, kind: job.kind, code: job.code || null, updatedAt: new Date().toISOString() }; }
  async function persist(id, job) { return store.update(data => { const entries = (data.transfers || []).filter(row => row.previewId !== id); entries.push(summary(id, job)); data.transfers = entries.slice(-100); }); }
  async function execute(request, context = {}) {
    validate(request);
    if (disposed) fail("SERVICE_DISPOSED");
    if (request.action === "minecraft.remote.list") { const data = await store.read(); return { transfers: (data.transfers || []).map(row => jobs.has(row.previewId) ? summary(row.previewId, jobs.get(row.previewId)) : { ...row, state: running(row.state) ? "interrupted-remote-state-unknown" : row.state }) }; }
    if (request.action === "minecraft.remote.cancel") {
      const job = jobs.get(request.previewId);
      if (!job || !["confirming", "connecting", "transferring", "verifying"].includes(job.state)) fail("TRANSFER_NOT_CANCELLABLE");
      job.controller.abort(); job.state = "cancelling"; return { cancelling: true, remoteStateVerified: false };
    }
    if (request.action === "minecraft.remote.status") {
      const job = jobs.get(request.previewId);
      if (job) return summary(request.previewId, job);
      const saved = ((await store.read()).transfers || []).find(row => row.previewId === request.previewId);
      return saved ? { ...saved, state: running(saved.state) ? "interrupted-remote-state-unknown" : saved.state } : { state: "not-started" };
    }
    if (request.action === "minecraft.remote.preview") {
      const source = await sourceInventory(options, request, context.signal);
      await assertStopped(source.root);
      for (const [id, preview] of previews) if (preview.expires < Date.now()) previews.delete(id);
      if (previews.size >= 10) fail("REMOTE_PREVIEW_LIMIT");
      const files = source.files.map(({ path: relative, bytes, sha256 }) => ({ path: relative, bytes, sha256 }));
      const sha256 = hash(JSON.stringify({ kind: request.kind, target: request.target, host: request.host, destination: request.destination, edition: request.edition, version: request.version, flavour: request.flavour, files }));
      const previewId = randomUUID();
      previews.set(previewId, { request: structuredClone(request), root: source.root, files, sha256, expires: Date.now() + 600000 });
      return { previewId, sha256, files, bytes: source.bytes, destination: request.destination, host: request.host, target: request.target, hostIdentityVerified: false, remoteState: "not-contacted", overwrite: false, excludesExtensionsAndPrivateConfiguration: request.kind === "server", serverStarted: false, expiresAt: new Date(Date.now() + 600000).toISOString() };
    }
    const preview = previews.get(request.previewId);
    if (!preview || preview.expires < Date.now() || preview.sha256 !== request.confirmSha256 || jobs.has(request.previewId)) fail("REMOTE_PREVIEW_REQUIRED");
    if ([...jobs.values()].some(job => ["confirming", "connecting", "transferring", "verifying", "cancelling"].includes(job.state))) fail("REMOTE_TRANSFER_BUSY");
    previews.delete(request.previewId);
    const controller = new AbortController();
    const signal = context.signal ? AbortSignal.any([context.signal, controller.signal, AbortSignal.timeout(3600000)]) : AbortSignal.any([controller.signal, AbortSignal.timeout(3600000)]);
    const job = { controller, root: preview.root, state: "confirming", completed: 0, total: preview.files.length, bytesCompleted: 0, bytesTotal: preview.files.reduce((sum, file) => sum + file.bytes, 0), hostIdentityVerified: false, remoteDestinationMayExist: false };
    if (jobs.size >= 100) { for (const [id, previous] of jobs) { if (["completed", "cancelled-remote-state-unknown", "failed-remote-state-unknown"].includes(previous.state)) { jobs.delete(id); break; } } }
    jobs.set(request.previewId, job);
    job.host = preview.request.host; job.destination = preview.request.destination; job.kind = preview.request.kind;
    const config = preview.request, nonce = randomUUID(), destination = config.destination, marker = destination + "/.material-transfer-incomplete";
    try {
      await persist(request.previewId, job);
      if (!options.dialog?.showMessageBox) fail("NATIVE_CONSENT_UNAVAILABLE");
      const notice = { type: "warning", title: "Transfer to a new remote Minecraft directory", message: "Create this new destination and upload the reviewed files?", detail: config.host + ":" + destination + "\n" + config.target + "\n" + job.total + " files; " + job.bytesTotal + " bytes\n\nThe existing SSH host key must already be trusted. Existing destinations are refused. Incomplete remote files remain marked and are never deleted automatically. No server, container or runtime installer is started. Server provisioning excludes extensions and all nonallowlisted configuration.", buttons: ["Cancel", "Create and transfer"], defaultId: 0, cancelId: 0, noLink: true };
      const accepted = options.parentWindow ? await options.dialog.showMessageBox(options.parentWindow, notice) : await options.dialog.showMessageBox(notice);
      if (accepted.response !== 1 || signal.aborted) fail("CANCELLED");
      const source = await sourceInventory(options, config, signal);
      await assertStopped(source.root);
      if (JSON.stringify(source.files.map(({ path: relative, bytes, sha256 }) => ({ path: relative, bytes, sha256 }))) !== JSON.stringify(preview.files)) fail("REMOTE_SOURCE_CHANGED");
      const parent = destination.slice(0, destination.lastIndexOf("/"));
      const user = config.target === "ssh-container" ? "test \"$(id -u)\" = 1000" : "test \"$(id -u)\" -ne 0";
      job.state = "connecting";
      const preflight = user + " && command -v sha256sum >/dev/null && command -v realpath >/dev/null && dd --version >/dev/null && test \"$(realpath -e -- " + quote(parent) + ")\" = " + quote(parent) + " && test ! -e " + quote(destination) + " && test ! -L " + quote(destination) + " && printf '%s\\n' READY";
      if (await ssh(options, config.host, preflight, { signal, timeout: 20000 }) !== "READY") fail("REMOTE_DESTINATION_UNAVAILABLE");
      job.hostIdentityVerified = true;
      job.remoteDestinationMayExist = true;
      await persist(request.previewId, job);
      const create = user + " && umask 077 && mkdir -- " + quote(destination) + " && (printf '%s\\n' " + quote(nonce) + " | dd conv=excl status=none of=" + quote(marker) + ") && printf '%s\\n' CREATED";
      if (await ssh(options, config.host, create, { signal, timeout: 20000 }) !== "CREATED") fail("REMOTE_DESTINATION_CREATION_UNVERIFIED");
      const ownership = user + " && test \"$(realpath -e -- " + quote(destination) + ")\" = " + quote(destination) + " && test ! -L " + quote(marker) + " && test \"$(cat -- " + quote(marker) + ")\" = " + quote(nonce);
      job.state = "transferring";
      for (const file of source.files) {
        if (signal.aborted) fail("CANCELLED");
        if (file.source) { inspectCanonicalPath(file.source); if (await digest(file.source) !== file.sha256) fail("REMOTE_SOURCE_CHANGED"); }
        const relativeParts = file.path.split("/"); let directory = destination, directories = "";
        for (const part of relativeParts.slice(0, -1)) {
          directory += "/" + part;
          directories += " && (test -d " + quote(directory) + " || mkdir -- " + quote(directory) + ") && test \"$(realpath -e -- " + quote(directory) + ")\" = " + quote(directory);
        }
        const target = destination + "/" + file.path;
        const write = ownership + " && umask 077" + directories + " && test ! -e " + quote(target) + " && test ! -L " + quote(target) + " && dd conv=excl status=none of=" + quote(target) + " && sha256sum -- " + quote(target);
        const output = await ssh(options, config.host, write, { input: file.source || file.content, signal });
        if (!output.startsWith(file.sha256 + "  ")) fail("REMOTE_PAYLOAD_HASH_MISMATCH");
        if (file.source && await digest(file.source) !== file.sha256) fail("REMOTE_SOURCE_CHANGED");
        job.completed++; job.bytesCompleted += file.bytes;
      }
      job.state = "verifying";
      for (const file of preview.files) { const result = await ssh(options, config.host, ownership + " && sha256sum -- " + quote(destination + "/" + file.path), { signal, timeout: 120000 }); if (!result.startsWith(file.sha256 + "  ")) fail("REMOTE_PAYLOAD_HASH_MISMATCH"); }
      const finalSource = await sourceInventory(options, config, signal);
      if (JSON.stringify(finalSource.files.map(({ path: relative, bytes, sha256 }) => ({ path: relative, bytes, sha256 }))) !== JSON.stringify(preview.files)) fail("REMOTE_SOURCE_CHANGED");
      const receipt = Buffer.from(JSON.stringify({ schema: 1, kind: config.kind, edition: config.edition, version: config.version, flavour: config.flavour, files: preview.files, createdAt: new Date().toISOString(), sourcePathsIncluded: false, serverStarted: false }), "utf8");
      const receiptPath = destination + "/.material-transfer-receipt.json";
      const receiptWrite = ownership + " && dd conv=excl status=none of=" + quote(receiptPath) + " && sha256sum -- " + quote(receiptPath);
      if (!(await ssh(options, config.host, receiptWrite, { input: receipt, signal })).startsWith(hash(receipt) + "  ")) fail("REMOTE_RECEIPT_UNVERIFIED");
      if (await ssh(options, config.host, ownership + " && rm -- " + quote(marker) + " && printf '%s\\n' COMPLETE", { signal, timeout: 20000 }) !== "COMPLETE") fail("REMOTE_COMPLETION_UNVERIFIED");
      job.state = "completed"; await persist(request.previewId, job); await log("remote-transfer", config.kind, "completed");
      return { completed: true, files: job.total, bytes: job.bytesTotal, hostIdentityVerified: true, destination: config.destination, serverStarted: false, runtimeVerified: false, worldActivated: false };
    } catch (error) {
      job.state = signal.aborted || error.code === "CANCELLED" ? "cancelled-remote-state-unknown" : "failed-remote-state-unknown";
      job.code = /^[A-Z_]+$/.test(error.code || "") ? error.code : "REMOTE_TRANSFER_FAILED";
      await persist(request.previewId, job).catch(() => {});
      await log("remote-transfer", config.kind, job.state).catch(() => {});
      throw Object.assign(new Error(job.code), { code: job.code });
    }
  }
  return { execute, busy: directory => [...jobs.values()].some(job => job.root === directory && ["confirming", "connecting", "transferring", "verifying", "cancelling"].includes(job.state)), dispose() { disposed = true; for (const job of jobs.values()) job.controller.abort(); } };
}
module.exports = { createRemote, validate };
