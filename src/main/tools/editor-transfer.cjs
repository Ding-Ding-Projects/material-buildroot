"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const https = require("node:https");
const dns = require("node:dns/promises");
const { fail, grant, digest } = require("./runtime.cjs");
const { inspectCanonicalPath: inspect } = require("../security/file-grants.cjs");
const EDITORS = { "code.exe": "vscode", "code - insiders.exe": "vscode", "notepad++.exe": "notepad-plus", "notepad.exe": "notepad" };
const MAX = 512 * 1024 * 1024;
function release(version) {
  if (typeof version !== "string" || !/^20[0-9]{2}\.(?:02|05|08|11)(?:\.[1-9][0-9]?)?$/.test(version)) fail("INVALID_RELEASE");
  return `https://buildroot.org/downloads/buildroot-${version}.tar.gz`;
}
function validate(request) {
  const fields = {
    "editor.choose": [], "editor.discover": [], "editor.chooseDetected": ["candidateId"], "editor.status": [], "editor.handoffs": [],
    "editor.rebind": ["id", "sourceId"],
    "editor.open": ["sourceId", "accepted", "visibility"],
    "editor.reconcile": ["id"], "editor.acknowledge": ["id", "sha256"],
    "transfer.preview": ["version", "sha256", "destinationId"],
    "transfer.download": ["version", "sha256", "destinationId", "accepted"],
    "transfer.browser": ["version", "accepted", "visibility"],
    "transfer.visibility": ["alwaysOnTop", "accepted"],
  }[request.action];
  if (!fields || Object.keys(request).some(k => !["action", ...fields].includes(k)) || fields.some(k => !Object.hasOwn(request, k))) fail("INVALID_REQUEST");
  for (const key of ["sourceId", "destinationId", "id", "candidateId"]) if (fields.includes(key) && (typeof request[key] !== "string" || !/^[0-9a-f-]{36}$/.test(request[key]))) fail("INVALID_REQUEST");
  if (fields.includes("sha256") && (typeof request.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(request.sha256))) fail("INVALID_HASH");
  if (fields.includes("version")) release(request.version);
  if (fields.includes("accepted") && request.accepted !== true) fail("CONSENT_REQUIRED");
  if (fields.includes("alwaysOnTop") && typeof request.alwaysOnTop !== "boolean") fail("INVALID_REQUEST");
  if (fields.includes("visibility") && request.visibility !== "foreground") fail("EXPLICIT_FOREGROUND_REQUIRED");
  return request;
}
function publicAddress(address) {
  const p = address.split(".").map(Number);
  return p.length === 4 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    ![0, 10, 127].includes(p[0]) && p[0] < 224 &&
    !(p[0] === 169 && p[1] === 254) && !(p[0] === 172 && p[1] >= 16 && p[1] <= 31) &&
    !(p[0] === 192 && [0, 168].includes(p[1])) && !(p[0] === 100 && p[1] >= 64 && p[1] <= 127) &&
    !(p[0] === 198 && [18, 19, 51].includes(p[1])) && !(p[0] === 203 && p[1] === 0 && p[2] === 113);
}
async function fingerprint(file) {
  inspect(file);
  const before = await fs.stat(file);
  if (before.isDirectory()) {
    const hash = createHash("sha256");
    let entries = 0, bytes = 0;
    const started = Date.now();
    async function walk(folder, relative = "") {
      inspect(folder);
      const names = await fs.readdir(folder);
      if (names.length + entries > 1000) fail("PROJECT_FINGERPRINT_LIMIT");
      names.sort();
      for (const name of names) {
        if (++entries > 1000 || Date.now() - started > 30000) fail("PROJECT_FINGERPRINT_LIMIT");
        const target = path.join(folder, name), rel = relative ? relative + "/" + name : name;
        inspect(target);
        const stat = await fs.lstat(target);
        if (stat.isDirectory()) { hash.update(JSON.stringify([rel, "directory"])); await walk(target, rel); }
        else { const entry = await fingerprint(target); bytes += entry.bytes; if (bytes > 64 * 1024 * 1024) fail("PROJECT_FINGERPRINT_LIMIT"); hash.update(JSON.stringify([rel, entry.sha256, entry.bytes])); }
      }
    }
    await walk(file);
    const after = await fs.stat(file);
    if (before.ino !== after.ino || before.mtimeMs !== after.mtimeMs) fail("DOCUMENT_CHANGED");
    return { sha256: hash.digest("hex"), bytes, entries, kind: "directory" };
  }
  if (!before.isFile() || before.size > 64 * 1024 * 1024) fail("DOCUMENT_LIMIT");
  const sha256 = await digest(file), after = await fs.stat(file);
  inspect(file);
  if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) fail("DOCUMENT_CHANGED");
  return { sha256, bytes: after.size, kind: "file" };
}
function createEditorTransfer(options) {
  const sessions = new Map();
  const candidates = new Map();
  let loaded = false;
  let selecting = false;
  const admissionFile = options.editorTransferDirectory && path.join(options.editorTransferDirectory, "editor.json");
  const historyFile = options.editorTransferDirectory && path.join(options.editorTransferDirectory, "handoffs.json");
  let historyTail = Promise.resolve();
  async function loadHistory() {
    if (loaded) return;
    if (!historyFile) fail("EDITOR_STORAGE_UNAVAILABLE");
    let content;
    try { inspect(historyFile); if ((await fs.stat(historyFile)).size > 1048576) fail("EDITOR_HISTORY_LIMIT"); content = JSON.parse(await fs.readFile(historyFile, "utf8")); }
    catch (error) { if (error.code === "ENOENT") { loaded = true; return; } throw error; }
    if (content.version !== 1 || !Array.isArray(content.records) || content.records.length > 100) fail("INVALID_EDITOR_HISTORY");
    for (const record of content.records) {
      if (!record || typeof record.id !== "string" || !/^[0-9a-f-]{36}$/.test(record.id) || typeof record.file !== "string" || !path.isAbsolute(record.file) || typeof record.parent !== "string" || !/^[0-9a-f]{64}$/.test(record.before?.sha256) || !["launching", "launched", "unknown", "acknowledged"].includes(record.state)) fail("INVALID_EDITOR_HISTORY");
      sessions.set(record.id, { ...record, sourceId: null, state: record.state === "acknowledged" ? "acknowledged" : "unknown" });
    }
    loaded = true;
  }
  function saveHistory() {
    const content = JSON.stringify({ version: 1, records: [...sessions.values()].map(({ sourceId, ...record }) => record) });
    const work = async () => {
      await fs.mkdir(options.editorTransferDirectory, { recursive: true, mode: 0o700 }); inspect(options.editorTransferDirectory);
      const temporary = historyFile + "." + randomUUID();
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
      await fs.rename(temporary, historyFile);
    };
    historyTail = historyTail.then(work, work); return historyTail;
  }
  const display = record => ({ id: record.id, name: path.basename(record.file), before: record.before, state: record.state, requiresReselection: !record.sourceId });
  async function admitted() {
    if (!admissionFile) fail("EDITOR_STORAGE_UNAVAILABLE");
    inspect(admissionFile);
    if ((await fs.stat(admissionFile)).size > 16384) fail("INVALID_EDITOR_RECEIPT");
    const entry = JSON.parse(await fs.readFile(admissionFile, "utf8"));
    if (entry.version !== 1 || EDITORS[path.basename(entry.path).toLowerCase()] !== entry.kind || !/^[0-9a-f]{64}$/.test(entry.sha256)) fail("INVALID_EDITOR_RECEIPT");
    inspect(entry.path);
    if (await digest(entry.path) !== entry.sha256) fail("EDITOR_IDENTITY_CHANGED");
    return entry;
  }
  async function download(request, context) {
    const destination = await grant(options, request.destinationId, "write");
    const parent = JSON.stringify(inspect(path.dirname(destination)));
    const partial = destination + ".partial-" + randomUUID();
    const receiptPath = partial + ".json";
    const receipt = { version: 1, source: release(request.version), destination: path.basename(destination), partial: path.basename(partial), expectedSha256: request.sha256, bytes: 0, state: "incomplete", publication: "not-published" };
    let file, receiptHandle, response;
    async function saveReceipt() {
      if (!receiptHandle) return;
      const bytes = Buffer.from(JSON.stringify(receipt));
      await receiptHandle.write(bytes, 0, bytes.length, 0);
      await receiptHandle.truncate(bytes.length);
      await receiptHandle.sync();
    }
    const signal = context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(600000)]) : AbortSignal.timeout(600000);
    try {
      if (signal.aborted) fail("CANCELLED");
      let dnsTimer;
      const addresses = await Promise.race([dns.lookup("buildroot.org", { all: true, family: 4 }), new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(Object.assign(Error("TRANSFER_DNS_TIMEOUT"), { code: "TRANSFER_DNS_TIMEOUT" })), 10000); })]).finally(() => clearTimeout(dnsTimer));
      if (!addresses.length || addresses.some(x => !publicAddress(x.address))) fail("UNSAFE_TRANSFER_ADDRESS");
      if (JSON.stringify(inspect(path.dirname(destination))) !== parent) fail("GRANT_CHANGED");
      await grant(options, request.destinationId, "write");
      file = await fs.open(partial, "wx", 0o600);
      receiptHandle = await fs.open(receiptPath, "wx", 0o600);
      await saveReceipt();
      response = await new Promise((resolve, reject) => {
        const req = https.get(receipt.source, { signal, agent: false, lookup: (_host, _opts, callback) => callback(null, addresses[0].address, 4), headers: { "Accept-Encoding": "identity" } }, resolve);
        req.setTimeout(30000, () => req.destroy(Object.assign(new Error("TRANSFER_TIMEOUT"), { code: "TRANSFER_TIMEOUT" })));
        req.on("error", reject);
      });
      if (response.statusCode !== 200 || response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") fail("TRANSFER_HTTP_FAILED");
      const total = response.headers["content-length"] === undefined ? null : Number(response.headers["content-length"]);
      if (total !== null && (!Number.isSafeInteger(total) || total <= 0 || total > MAX)) fail("TRANSFER_LIMIT");
      const hash = createHash("sha256"), started = Date.now();
      let last = 0;
      for await (const chunk of response) {
        if (signal.aborted) fail("CANCELLED");
        receipt.bytes += chunk.length;
        if (receipt.bytes > MAX) fail("TRANSFER_LIMIT");
        await file.writeFile(chunk); hash.update(chunk);
        if (Date.now() - last >= 500) {
          last = Date.now();
          const elapsed = Math.max(1, (last - started) / 1000), rate = Math.floor(receipt.bytes / elapsed);
          await context.onProgress?.({ type: "transfer", bytes: receipt.bytes, total, bytesPerSecond: rate, etaSeconds: total && rate ? Math.max(0, Math.ceil((total - receipt.bytes) / rate)) : null });
          await file.sync();
          await saveReceipt();
        }
      }
      receipt.sha256 = hash.digest("hex");
      if (!receipt.bytes || total !== null && total !== receipt.bytes || receipt.sha256 !== request.sha256) fail("TRANSFER_HASH_MISMATCH");
      await file.sync();
      const opened = await file.stat();
      const named = await fs.lstat(partial);
      if (opened.ino !== named.ino || opened.dev !== named.dev || named.isSymbolicLink() || named.nlink !== 1 || await digest(partial) !== receipt.sha256) fail("TRANSFER_OUTPUT_CHANGED");
      await file.close(); file = null;
      if (JSON.stringify(inspect(path.dirname(destination))) !== parent) fail("GRANT_CHANGED");
      await grant(options, request.destinationId, "write");
      inspect(partial);
      await fs.link(partial, destination);
      receipt.state = "completed"; receipt.publication = "published";
      await saveReceipt();
      return { transfer: { ...receipt, receipt: path.basename(receiptPath) } };
    } catch (error) {
      receipt.code = /^[A-Z_]+$/.test(error.code || "") ? error.code : signal.aborted ? "CANCELLED" : "TRANSFER_FAILED";
      if (file) { await file.sync().catch(() => {}); await file.close().catch(() => {}); file = null; }
      if (receipt.publication === "published") receipt.state = "completed";
      await saveReceipt().catch(() => {});
      return { ok: false, code: receipt.code, incompleteOutput: { state: receipt.publication === "published" ? "unknown" : receiptHandle ? "retained" : "not-created", publication: receipt.publication, bytes: receipt.bytes, ...(receiptHandle ? { partial: receipt.partial, receipt: path.basename(receiptPath) } : {}) } };
    } finally { response?.destroy(); if (file) await file.close(); if (receiptHandle) await receiptHandle.close(); }
  }
  return async function execute(request, context = {}) {
    validate(request);
    if (request.action === "transfer.visibility") {
      const window = options.parentWindow;
      if (!window || window.isDestroyed() || typeof window.setAlwaysOnTop !== "function") fail("TRANSFER_WINDOW_UNAVAILABLE");
      window.setAlwaysOnTop(request.alwaysOnTop);
      return { alwaysOnTop: window.isAlwaysOnTop() };
    }
    if (request.action.startsWith("editor.")) await loadHistory();
    if (request.action === "editor.discover") {
      candidates.clear();
      const roots = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs"), process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean);
      const files = roots.flatMap(root => [path.join(root, "Microsoft VS Code", "Code.exe"), path.join(root, "Microsoft VS Code Insiders", "Code - Insiders.exe"), path.join(root, "Notepad++", "notepad++.exe")]);
      if (process.env.SystemRoot) files.push(path.join(process.env.SystemRoot, "System32", "notepad.exe"));
      const seen = new Set();
      for (const file of files) {
        if (seen.has(file.toLowerCase())) continue; seen.add(file.toLowerCase());
        try { inspect(file); const stat = await fs.lstat(file); if (!stat.isFile()) continue;
          const id = randomUUID(), kind = EDITORS[path.basename(file).toLowerCase()];
          candidates.set(id, { file, kind });
        } catch { /* An absent or unsafe fixed-root candidate is not admitted. */ }
      }
      return { candidates: [...candidates].map(([id, entry]) => ({ id, kind: entry.kind, name: path.basename(path.dirname(entry.file)) + "/" + path.basename(entry.file), admitted: false })) };
    }
    if (request.action === "editor.handoffs") return { handoffs: [...sessions.values()].map(display) };
    if (request.action === "editor.rebind") {
      const record = sessions.get(request.id); if (!record || record.state === "acknowledged") fail("EDITOR_HANDOFF_EXPIRED");
      const file = await grant(options, request.sourceId, "read");
      if (file !== record.file || JSON.stringify(inspect(path.dirname(file))) !== record.parent) fail("DOCUMENT_SELECTION_MISMATCH");
      record.sourceId = request.sourceId;
      return { handoff: display(record) };
    }
    if (["editor.choose", "editor.chooseDetected"].includes(request.action)) {
      if (selecting) fail("PICKER_BUSY"); selecting = true;
      try {
        const candidate = request.action === "editor.chooseDetected" ? candidates.get(request.candidateId) : null;
        if (request.action === "editor.chooseDetected" && !candidate) fail("EDITOR_CANDIDATE_EXPIRED");
        const picked = await options.dialog.showOpenDialog(options.parentWindow, { title: "Select a trusted editor executable", ...(candidate ? { defaultPath: candidate.file } : {}), properties: ["openFile", "dontAddToRecent"], filters: [{ name: "Editor executable", extensions: ["exe"] }] });
        if (picked.canceled || picked.filePaths?.length !== 1) fail("CANCELLED");
        const file = picked.filePaths[0], kind = EDITORS[path.basename(file).toLowerCase()];
        if (!kind) fail("EDITOR_NOT_SUPPORTED"); inspect(file);
        const sha256 = await digest(file);
        const consent = await options.dialog.showMessageBox(options.parentWindow, { type: "warning", title: "Trust this editor", message: "This executable can read and modify selected documents with your account permissions.", detail: `${file}\nSHA-256: ${sha256}\nOnly fixed document arguments will be passed.`, buttons: ["Cancel", "Trust editor"], defaultId: 0, cancelId: 0, noLink: true });
        if (consent.response !== 1) fail("CONSENT_REQUIRED");
        inspect(file); if (await digest(file) !== sha256) fail("EDITOR_IDENTITY_CHANGED");
        if (!admissionFile) fail("EDITOR_STORAGE_UNAVAILABLE");
        await fs.mkdir(options.editorTransferDirectory, { recursive: true, mode: 0o700 }); inspect(options.editorTransferDirectory);
        const temporary = admissionFile + "." + randomUUID();
        await fs.writeFile(temporary, JSON.stringify({ version: 1, kind, path: file, sha256 }), { flag: "wx", mode: 0o600 });
        await fs.rename(temporary, admissionFile);
        return { editor: { kind, sha256 } };
      } finally { selecting = false; }
    }
    if (request.action === "editor.status") { try { const e = await admitted(); return { editor: { kind: e.kind, sha256: e.sha256 } }; } catch { return { editor: null }; } }
    if (request.action === "editor.open") {
      if (sessions.size >= 100) fail("EDITOR_SESSION_LIMIT");
      const editor = await admitted(), file = context.resolveEditorSource ? await context.resolveEditorSource() : await grant(options, request.sourceId, "read");
      if (context.requireCode && editor.kind !== "vscode") fail("CODE_ADMISSION_REQUIRED");
      const before = await fingerprint(file), id = randomUUID();
      if (before.kind === "directory" && editor.kind !== "vscode") fail("EDITOR_FOLDER_UNSUPPORTED");
      const args = editor.kind === "vscode" ? ["--new-window", "--", file] : [file];
      const record = { id, file, sourceId: request.sourceId, before, parent: JSON.stringify(inspect(path.dirname(file))), state: "launching" };
      sessions.set(id, record);
      await saveHistory();
      try {
        if (context.resolveEditorSource && await context.resolveEditorSource() !== file) fail("DOCUMENT_CHANGED");
        await new Promise((resolve, reject) => { const child = spawn(editor.path, args, { shell: false, windowsHide: false, detached: true, stdio: "ignore" }); child.once("error", () => reject(Object.assign(new Error("EDITOR_LAUNCH_FAILED"), { code: "EDITOR_LAUNCH_FAILED" }))); child.once("spawn", () => { child.unref(); resolve(); }); });
        record.state = "launched";
        await saveHistory();
      } catch (error) { record.state = "unknown"; await saveHistory(); throw error; }
      return { handoff: { id, name: path.basename(file), before, state: record.state } };
    }
    if (["editor.reconcile", "editor.acknowledge"].includes(request.action)) {
      const record = sessions.get(request.id); if (!record) fail("EDITOR_HANDOFF_EXPIRED");
      if (!record.sourceId || record.state === "acknowledged") fail("EDITOR_RESELECTION_REQUIRED");
      if (JSON.stringify(inspect(path.dirname(record.file))) !== record.parent) fail("GRANT_CHANGED");
      const current = await fingerprint(record.file), changed = current.sha256 !== record.before.sha256;
      if (request.action === "editor.acknowledge") { if (request.sha256 !== current.sha256) fail("DOCUMENT_CHANGED"); record.state = "acknowledged"; record.current = current; record.sourceId = null; await saveHistory(); }
      return { reconciliation: { id: record.id, changed, before: record.before, current, acknowledged: request.action === "editor.acknowledge", requiresReload: changed } };
    }
    if (request.action === "transfer.browser") { if (!options.openTransferBrowser) fail("BROWSER_UNAVAILABLE"); await options.openTransferBrowser("https://buildroot.org/download.html", { activate: true }); return { opened: true }; }
    if (request.action === "transfer.preview") { const destination = await grant(options, request.destinationId, "write"); return { preview: { source: release(request.version), name: path.basename(destination), maxBytes: MAX, sha256: request.sha256 } }; }
    if (request.action === "transfer.download") return download(request, context);
    fail("INVALID_REQUEST");
  };
}
module.exports = { createEditorTransfer, validate, release };
