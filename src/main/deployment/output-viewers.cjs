"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { headerInfo } = require("./artifacts.cjs");
const LIMIT = 1024 * 1024, ENTRIES = 1000;
function fail(code) { throw Object.assign(new Error(code), { code }); }
function inside(root, file) {
  const rel = path.relative(root, file);
  return rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
function unchanged(a, b) { return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs; }
function archiveName(name) { return name.length <= 512 && !/[\x00-\x1f\\:]/.test(name) && !name.startsWith("/") && !name.split("/").includes(".."); }
function read(fd, size, offset, total) {
  if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || size > LIMIT || offset + size > total) fail("OUTPUT_INVALID_BOUNDS");
  const b = Buffer.alloc(size);
  if (fs.readSync(fd, b, 0, size, offset) !== size) fail("OUTPUT_SHORT_READ");
  return b;
}
function tarEntries(fd, size) {
  const rows = []; let offset = 0, complete = false;
  while (offset + 512 <= size && rows.length < ENTRIES) {
    const b = read(fd, 512, offset, size);
    if (b.every(x => x === 0)) { complete = true; break; }
    const octal = (start, length) => { const value = b.subarray(start, start + length).toString("ascii").replace(/\0.*$/, "").trim(); if (!/^[0-7]+$/.test(value)) fail("OUTPUT_ARCHIVE_HEADER"); return parseInt(value, 8); };
    const expected = octal(148, 8);
    const checksum = b.reduce((sum, value, i) => sum + (i >= 148 && i < 156 ? 32 : value), 0);
    if (expected !== checksum) fail("OUTPUT_ARCHIVE_CHECKSUM");
    const text = (a, z) => b.subarray(a, z).toString("utf8").replace(/\0.*$/, "");
    const prefix = text(345, 500), name = (prefix ? prefix + "/" : "") + text(0, 100), bytes = octal(124, 12), type = b[156];
    if (!Number.isSafeInteger(bytes) || offset + 512 + bytes > size) fail("OUTPUT_ARCHIVE_BOUNDS");
    rows.push({ name, bytes, kind: type === 53 ? "directory" : type === 48 || type === 0 ? "file" : "link-or-extension", safeName: archiveName(name) });
    offset += 512 + Math.ceil(bytes / 512) * 512;
  }
  return { kind: "tar", rows, complete, extraction: false };
}
function zipEntries(fd, size) {
  const tail = read(fd, Math.min(size, 65557), size - Math.min(size, 65557), size);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break; }
  if (end < 0) fail("OUTPUT_ARCHIVE_DIRECTORY");
  const count = tail.readUInt16LE(end + 10), bytes = tail.readUInt32LE(end + 12), start = tail.readUInt32LE(end + 16);
  if (tail.readUInt16LE(end + 4) || tail.readUInt16LE(end + 6) || count !== tail.readUInt16LE(end + 8) || count > ENTRIES || bytes > LIMIT || start + bytes > size - tail.length + end) fail("OUTPUT_ARCHIVE_UNSUPPORTED_LIMIT");
  const directory = read(fd, bytes, start, size), rows = []; let at = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes || directory.readUInt32LE(at) !== 0x02014b50) fail("OUTPUT_ARCHIVE_DIRECTORY");
    const length = directory.readUInt16LE(at + 28), next = at + 46 + length + directory.readUInt16LE(at + 30) + directory.readUInt16LE(at + 32);
    if (length > 512 || next > bytes) fail("OUTPUT_ARCHIVE_DIRECTORY");
    const name = directory.subarray(at + 46, at + 46 + length).toString("utf8");
    rows.push({ name, bytes: directory.readUInt32LE(at + 24), compressedBytes: directory.readUInt32LE(at + 20), kind: name.endsWith("/") ? "directory" : "file", encrypted: Boolean(directory.readUInt16LE(at + 8) & 1), safeName: archiveName(name) }); at = next;
  }
  return { kind: "zip", rows, complete: true, extraction: false };
}
function isoEntries(fd, size) {
  const pvd = read(fd, 2048, 16 * 2048, size);
  if (pvd[0] !== 1 || pvd.subarray(1, 6).toString() !== "CD001" || pvd.readUInt16LE(128) !== 2048) fail("OUTPUT_ISO_UNSUPPORTED");
  const start = pvd.readUInt32LE(158) * 2048, bytes = pvd.readUInt32LE(166);
  if (bytes > LIMIT) fail("OUTPUT_ISO_DIRECTORY_LIMIT");
  const data = read(fd, bytes, start, size), rows = []; let at = 0;
  while (at < data.length && rows.length < ENTRIES) {
    const length = data[at]; if (!length) { at = (Math.floor(at / 2048) + 1) * 2048; continue; }
    if (length < 34 || at + length > data.length || data[at + 32] > length - 33) fail("OUTPUT_ISO_DIRECTORY");
    const name = data.subarray(at + 33, at + 33 + data[at + 32]).toString("ascii");
    if (name !== "\0" && name !== "\x01") rows.push({name, bytes: data.readUInt32LE(at + 10), kind: data[at + 25] & 2 ? "directory" : "file", safeName: archiveName(name)});
    at += length;
  }
  return { kind: "iso9660-root", rows, complete: at >= data.length, extraction: false };
}
function csvRows(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length && rows.length < 201; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === "," || c === "\n")) { row.push(cell.slice(0, 4096)); cell = ""; if (row.length > 32) fail("OUTPUT_TABLE_LIMIT"); if (c === "\n") { rows.push(row); row = []; } }
    else if (c !== "\r") cell += c;
  }
  if (row.length || cell) { row.push(cell.slice(0, 4096)); rows.push(row); }
  return { rows, complete: rows.length < 201 && !quoted, interpretation: "Source records only; no license conclusions." };
}
class OutputViewers {
  constructor(root) { this.root = fs.realpathSync(root); this.rootIdentity = fs.statSync(this.root); this.grants = new Map(); }
  admit(relative, kind) {
    if (this.grants.size >= 10000) fail("OUTPUT_REFRESH_REQUIRED");
    const id = randomUUID(), file = path.join(this.root, relative), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (kind === "directory" ? !stat.isDirectory() : !stat.isFile())) fail("OUTPUT_TYPE_CHANGED");
    this.grants.set(id, { relative, kind, stat, expires: Date.now() + 15 * 60000 }); return id;
  }
  resolve(id, kind) {
    if (!unchangedRoot(this.rootIdentity, fs.lstatSync(this.root))) fail("OUTPUT_ROOT_CHANGED");
    const grant = id === "root" && kind === "directory" ? { relative: "", kind, stat: this.rootIdentity, expires: Infinity } : this.grants.get(id);
    if (!grant || grant.kind !== kind || grant.expires < Date.now()) fail("OUTPUT_REFRESH_REQUIRED");
    const file = path.join(this.root, grant.relative);
    if (!inside(this.root, file) || fs.realpathSync(file) !== file) fail("OUTPUT_PATH_CHANGED");
    const current = fs.lstatSync(file);
    if (current.isSymbolicLink() || current.dev !== grant.stat.dev || current.ino !== grant.stat.ino) fail("OUTPUT_PATH_CHANGED");
    if (kind === "file" && !unchanged(grant.stat, current)) fail("OUTPUT_CHANGED_REFRESH");
    return { file, grant, current };
  }
  browse(directoryId) {
    for (const [id, grant] of this.grants) if (grant.expires < Date.now()) this.grants.delete(id);
    if (directoryId === "root") this.grants.clear();
    const { file, grant } = this.resolve(directoryId, "directory"), rows = [];
    const directory = fs.opendirSync(file); let truncated = false;
    try {
      for (let entry = directory.readSync(), seen = 0; entry; entry = directory.readSync()) {
        if (++seen > ENTRIES) { truncated = true; break; }
        if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) continue;
        const relative = path.join(grant.relative, entry.name), candidate = path.join(this.root, relative);
        if (!inside(this.root, fs.realpathSync(candidate)) || fs.realpathSync(candidate) !== candidate) continue;
        const kind = entry.isDirectory() ? "directory" : "file", id = this.admit(relative, kind);
        rows.push({ id, name: entry.name, kind, size: this.grants.get(id).stat.size });
      }
    } finally { directory.closeSync(); }
    return { directoryId, path: grant.relative.split(path.sep).join("/") || "/", rows: rows.sort((a,b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)), truncated };
  }
  async inspect(fileId) {
    const {file, grant, current} = this.resolve(fileId, "file"), fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const before = fs.fstatSync(fd); if (!before.isFile() || !unchanged(current, before)) fail("OUTPUT_CHANGED_REFRESH");
      const header = read(fd, Math.min(before.size, LIMIT), 0, before.size);
      const parserHeader = header.length < 1024 ? Buffer.concat([header, Buffer.alloc(1024-header.length)]) : header;
      const info = headerInfo(parserHeader, before.size);
      const result = { fileId, name: path.basename(file), size: before.size, format: info.format, partitions: info.partitions, sectorBytes: 512, sha256: null, checksumState: "not-requested", preview: null, truncated: before.size > LIMIT, archive: null, table: null, graph: null, filesystem: null };
      if (info.format === "tar") result.archive = tarEntries(fd, before.size);
      if (info.format === "zip") result.archive = zipEntries(fd, before.size);
      if (info.format === "iso9660") result.archive = isoEntries(fd, before.size);
      if (header.length >= 2048 && header.readUInt16LE(1080) === 0xef53 && header.readUInt32LE(1048) <= 6) result.filesystem = { kind: "ext-family", blockBytes: 1024 * 2 ** header.readUInt32LE(1048), blocks: header.readUInt32LE(1028), label: header.subarray(1144,1160).toString("utf8").replace(/\0.*$/,""), mounted: false, completeness: "superblock-metadata-only" };
      if (!header.subarray(0, 8192).includes(0) && info.format === "unknown") {
        result.preview = header.toString("utf8");
        if (/\.csv$/i.test(file)) result.table = csvRows(result.preview);
        if (/\.(?:dot|gv)$/i.test(file)) {
          const edges = [], nodes = new Set();
          const pattern = /(?:"([\w.+:/-]{1,128})"|([\w.+:/-]{1,128}))\s*->\s*(?:"([\w.+:/-]{1,128})"|([\w.+:/-]{1,128}))/g;
          for (const match of result.preview.matchAll(pattern)) { if (edges.length >= 200) break; const from = match[1] || match[2], to = match[3] || match[4]; nodes.add(from); nodes.add(to); edges.push({from,to}); }
          result.graph = { nodes: [...nodes], edges, completeness: "bounded-simple-directed-edge-subset" };
        }
      }
      if (!unchanged(before, fs.fstatSync(fd))) fail("OUTPUT_CHANGED_DURING_READ");
      this.resolve(fileId,"file"); return result;
    } finally { fs.closeSync(fd); }
  }
  async checksum(fileId, expected) {
    if (expected !== "" && !/^[a-fA-F0-9]{64}$/.test(expected)) fail("OUTPUT_INVALID_CHECKSUM");
    const {file,current} = this.resolve(fileId,"file");
    if (current.size > 16 * 1024 ** 3) fail("OUTPUT_CHECKSUM_SIZE_LIMIT");
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const before = fs.fstatSync(fd); if (!unchanged(current,before) || !before.isFile()) fail("OUTPUT_CHANGED_REFRESH");
      const hash = createHash("sha256"), started = Date.now();
      for await (const chunk of fs.createReadStream(file,{fd,autoClose:false})) { if(Date.now()-started > 120000) fail("OUTPUT_CHECKSUM_TIMEOUT"); hash.update(chunk); }
      if (!unchanged(before,fs.fstatSync(fd))) fail("OUTPUT_CHANGED_DURING_READ");
      this.resolve(fileId,"file"); const sha256 = hash.digest("hex");
      return {fileId,sha256,matches: expected ? sha256 === expected.toLowerCase() : null};
    } finally { fs.closeSync(fd); }
  }
}
function unchangedRoot(a,b) { return b.isDirectory() && !b.isSymbolicLink() && a.dev === b.dev && a.ino === b.ino; }
module.exports = { OutputViewers };
