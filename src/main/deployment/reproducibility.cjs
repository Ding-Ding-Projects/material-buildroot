"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const LOCK_KEYS = ["sourceRevision", "configurationSha256", "toolchainSha256", "buildrootRevision", "environmentSha256"];
const MAX_RECORD_BYTES = 4 * 1024 * 1024;
function fail(code) { throw Object.assign(new Error(code), { code }); }
function normalizeLocks(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("invalid-source-lock");
  const result = {};
  for (const key of Object.keys(value).sort()) {
    const pattern = key.endsWith("Revision") ? /^[a-f0-9]{7,64}$/ : /^[a-f0-9]{64}$/;
    if (!LOCK_KEYS.includes(key) || typeof value[key] !== "string" || !pattern.test(value[key])) fail("invalid-source-lock");
    result[key] = value[key];
  }
  return result;
}
function manifestPayload(value) {
  if (!value || value.schemaVersion !== 1 || value.algorithm !== "sha256" || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 10000) fail("invalid-manifest");
  const seen = new Set();
  const entries = value.entries.map(entry => {
    if (!entry || typeof entry.path !== "string" || !entry.path || entry.path.length > 4096 || /[\\\0\r\n]/.test(entry.path) || entry.path.startsWith("/") || /^[a-z]:/i.test(entry.path) || entry.path.split("/").some(part => !part || part === "." || part === "..") || seen.has(entry.path) || !Number.isSafeInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) fail("invalid-manifest");
    seen.add(entry.path);
    return { path: entry.path, size: entry.size, sha256: entry.sha256 };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { schemaVersion: 1, algorithm: "sha256", locks: normalizeLocks(value.locks), entries };
}
function digest(payload) { return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }
function createRecord(value) { const payload = manifestPayload(value); return { ...payload, digest: digest(payload) }; }
function validateRecord(value) {
  const payload = manifestPayload(value);
  if (value.digest !== digest(payload)) fail("manifest-digest-mismatch");
  return payload;
}
function readBoundedText(file, maxBytes = MAX_RECORD_BYTES) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.size > BigInt(maxBytes)) fail("record-size-limit");
    const buffer = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < buffer.length) {
      const count = fs.readSync(fd, buffer, offset, buffer.length - offset, offset);
      if (!count) fail("record-changed-during-read");
      offset += count;
    }
    const after = fs.fstatSync(fd, { bigint: true });
    if (["dev", "ino", "size", "mtimeNs", "ctimeNs"].some(key => before[key] !== after[key])) fail("record-changed-during-read");
    if (buffer.includes(0)) fail("invalid-record-text");
    return buffer.toString("utf8");
  } finally { fs.closeSync(fd); }
}
function readManifest(file) {
  let value;
  try { value = JSON.parse(readBoundedText(file)); } catch (error) { if (error.code) throw error; fail("invalid-manifest-json"); }
  validateRecord(value);
  return value;
}
function compareRecords(before, after) {
  const left = validateRecord(before), right = validateRecord(after);
  const a = new Map(left.entries.map(entry => [entry.path, entry]));
  const b = new Map(right.entries.map(entry => [entry.path, entry]));
  const differences = [];
  for (const name of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const previous = a.get(name), current = b.get(name);
    if (!previous || !current || previous.sha256 !== current.sha256 || previous.size !== current.size) differences.push({ path: name, kind: !previous ? "added" : !current ? "removed" : "content-changed", before: previous || null, after: current || null });
  }
  const lockDifferences = LOCK_KEYS.filter(key => left.locks[key] !== right.locks[key]).map(key => ({ key, before: left.locks[key] || null, after: right.locks[key] || null }));
  const missingLocks = ["sourceRevision", "configurationSha256"].filter(key => !left.locks[key] || !right.locks[key]);
  const reproducible = !differences.length && !lockDifferences.length && !missingLocks.length;
  return { reproducible, status: differences.length ? "nonreproducible" : lockDifferences.length ? "input-locks-differ" : missingLocks.length ? "insufficient-input-locks" : "selected-outputs-match", differences, locksChanged: lockDifferences.length > 0, lockDifferences, missingLocks, interpretation: reproducible ? "Selected output bytes and recorded input locks match. This does not prove build-time provenance, unselected outputs or runtime behavior." : "Comparison is not reproducibility proof. Reported byte differences, changed locks and missing input locks require investigation; timestamps and randomness are possible causes, not diagnosed causes." };
}
// Parse complete bounded RFC 4180-style rows, never a truncated preview.
function parseLegalManifest(text) {
  const rows = []; let row = [], field = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"') { if (field || closed) fail("invalid-legal-manifest-csv"); quoted = true; }
    else if (ch === "," || ch === "\n") { row.push(field); field = ""; closed = false; if (ch === "\n") { rows.push(row); row = []; } }
    else if (ch === "\r" && text[i + 1] === "\n") { /* CRLF handled by following LF. */ }
    else { if (closed) fail("invalid-legal-manifest-csv"); field += ch; }
    if (field.length > 65536 || row.length > 32 || rows.length > 10000) fail("legal-manifest-limit");
  }
  if (quoted) fail("invalid-legal-manifest-csv");
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = (rows.shift() || []).map(header => header.trim().toLowerCase().replace(/[-_]+/g, " "));
  const name = headers.indexOf("package"), version = headers.indexOf("version"), license = headers.indexOf("license");
  if (name < 0 || version < 0 || license < 0 || new Set(headers).size !== headers.length) fail("unsupported-legal-manifest-columns");
  return rows.filter(values => values.some(value => value.trim())).map(values => {
    if (values.length !== headers.length || !values[name].trim()) fail("invalid-legal-manifest-row");
    return { name: values[name].trim(), version: values[version].trim(), sourceLicenseDeclaration: values[license].trim(), sourceFields: Object.fromEntries(headers.map((header, i) => [header, values[i]])) };
  });
}
module.exports = { normalizeLocks, createRecord, readManifest, readBoundedText, compareRecords, parseLegalManifest };
