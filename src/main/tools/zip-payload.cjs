"use strict";
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createInflateRaw } = require("node:zlib");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { fail } = require("./runtime.cjs");
function safeName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length < 256 &&
    !name.includes("\\") &&
    !name.includes(":") &&
    !/[\x00-\x1f]/.test(name) &&
    name
      .replace(/\/$/, "")
      .split("/")
      .every(
        (part) =>
          part &&
          ![".", ".."].includes(part) &&
          !/[. ]$/.test(part) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  );
}
async function zipInventory(file) {
  const handle = await fsp.open(file, "r");
  try {
    const size = (await handle.stat()).size;
    if (size < 22) fail("INVALID_ZIP");
    const tail = Buffer.alloc(Math.min(size, 65557));
    await handle.read(tail, 0, tail.length, size - tail.length);
    let eocd = -1;
    for (let offset = tail.length - 22; offset >= 0; offset--)
      if (
        tail.readUInt32LE(offset) === 0x06054b50 &&
        offset + 22 + tail.readUInt16LE(offset + 20) === tail.length
      ) {
        eocd = offset;
        break;
      }
    if (eocd < 0 || tail.readUInt16LE(eocd + 4) || tail.readUInt16LE(eocd + 6))
      fail("UNSUPPORTED_ZIP");
    const count = tail.readUInt16LE(eocd + 10),
      length = tail.readUInt32LE(eocd + 12),
      start = tail.readUInt32LE(eocd + 16);
    if (
      !count ||
      count > 10000 ||
      length > 16 * 1024 * 1024 ||
      start + length > size - tail.length + eocd ||
      count !== tail.readUInt16LE(eocd + 8)
    )
      fail("ZIP_LIMIT");
    const central = Buffer.alloc(length);
    await handle.read(central, 0, length, start);
    let cursor = 0,
      total = 0;
    const entries = [],
      seen = new Set();
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > length || central.readUInt32LE(cursor) !== 0x02014b50)
        fail("INVALID_ZIP");
      const flags = central.readUInt16LE(cursor + 8),
        method = central.readUInt16LE(cursor + 10),
        compressed = central.readUInt32LE(cursor + 20),
        bytes = central.readUInt32LE(cursor + 24),
        nameLength = central.readUInt16LE(cursor + 28),
        extra = central.readUInt16LE(cursor + 30),
        comment = central.readUInt16LE(cursor + 32),
        external = central.readUInt32LE(cursor + 38),
        offset = central.readUInt32LE(cursor + 42);
      const name = central
        .subarray(cursor + 46, cursor + 46 + nameLength)
        .toString("utf8");
      cursor += 46 + nameLength + extra + comment;
      const key = name.toLowerCase();
      if (
        cursor > length ||
        !safeName(name) ||
        seen.has(key) ||
        flags & 1 ||
        ![0, 8].includes(method) ||
        compressed === 0xffffffff ||
        bytes === 0xffffffff ||
        offset === 0xffffffff ||
        ((external >>> 16) & 0xf000) === 0xa000
      )
        fail("UNSUPPORTED_ZIP_MEMBER");
      seen.add(key);
      total += bytes;
      if (total > 8 * 1024 ** 3) fail("ZIP_EXPANSION_LIMIT");
      const local = Buffer.alloc(30);
      await handle.read(local, 0, 30, offset);
      if (
        local.readUInt32LE(0) !== 0x04034b50 ||
        local.readUInt16LE(8) !== method ||
        local.readUInt16LE(6) & 1
      )
        fail("INVALID_ZIP");
      const localName = Buffer.alloc(local.readUInt16LE(26));
      await handle.read(localName, 0, localName.length, offset + 30);
      if (localName.toString("utf8") !== name) fail("ZIP_MEMBER_NAME_MISMATCH");
      const dataOffset =
        offset + 30 + localName.length + local.readUInt16LE(28);
      if (dataOffset + compressed > start) fail("INVALID_ZIP");
      entries.push({
        name,
        bytes,
        compressed,
        method,
        dataOffset,
        directory: name.endsWith("/"),
      });
    }
    if (cursor !== length) fail("INVALID_ZIP");
    return entries;
  } finally {
    await handle.close();
  }
}
async function extractZip(file, directory, members, context = {}) {
  const inventory = await zipInventory(file),
    expected = new Map(members.map((member) => [member.path, member]));
  const files = inventory.filter((entry) => !entry.directory);
  if (
    files.length !== members.length ||
    files.some(
      (entry) =>
        !expected.has(entry.name) ||
        (expected.get(entry.name).length !== undefined &&
          expected.get(entry.name).length !== entry.bytes),
    )
  )
    fail("ARCHIVE_MEMBER_NOT_ADMITTED");
  let completed = 0;
  const total = files.reduce((sum, entry) => sum + entry.bytes, 0);
  for (const entry of inventory) {
    if (context.signal?.aborted) fail("CANCELLED");
    const destination = path.join(directory, entry.name);
    if (entry.directory) {
      await fsp.mkdir(destination, { recursive: true, mode: 0o700 });
      continue;
    }
    await fsp.mkdir(path.dirname(destination), {
      recursive: true,
      mode: 0o700,
    });
    const hash = createHash("sha256");
    let bytes = 0;
    const verify = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        completed += chunk.length;
        if (bytes > entry.bytes) {
          callback(
            Object.assign(new Error("ZIP_EXPANSION_LIMIT"), {
              code: "ZIP_EXPANSION_LIMIT",
            }),
          );
          return;
        }
        hash.update(chunk);
        context.onProgress?.({
          type: "ollama-install",
          phase: "extract",
          completed,
          total,
        });
        callback(null, chunk);
      },
    });
    const input = entry.compressed
      ? fs.createReadStream(file, {
          start: entry.dataOffset,
          end: entry.dataOffset + entry.compressed - 1,
        })
      : require("node:stream").Readable.from([]);
    const output = fs.createWriteStream(destination, {
      flags: "wx",
      mode: 0o600,
    });
    const streams =
      entry.method === 8
        ? [input, createInflateRaw(), verify, output]
        : [input, verify, output];
    await pipeline(...streams, { signal: context.signal });
    if (
      bytes !== entry.bytes ||
      hash.digest("hex") !== expected.get(entry.name).sha256
    )
      fail("PAYLOAD_HASH_MISMATCH");
  }
}
module.exports = { zipInventory, extractZip, safeName };
