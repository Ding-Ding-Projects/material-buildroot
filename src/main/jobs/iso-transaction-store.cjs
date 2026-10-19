"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail = () => { throw Object.assign(Error("ISO transaction storage unavailable"), { code: "ISO_TRANSACTION_STORAGE_UNVERIFIED" }); };
/** Append-only exclusive records. Existing job directories are recovery records, never retry authority. */
function createIsoTransactionStore(directory) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || path.resolve(directory) !== directory) fail();
  function inspect(root) {
    const info = fs.lstatSync(root);
    if (!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync.native(root) !== root) fail();
    return `${info.dev}:${info.ino}`;
  }
  let cursor = path.parse(directory).root;
  for (const part of directory.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { fs.mkdirSync(cursor, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
    inspect(cursor);
  }
  const rootIdentity = inspect(directory);
  function check() { if (inspect(directory) !== rootIdentity) fail(); }
  function syncDirectory(root) {
    if (process.platform === "win32") return;
    const fd = fs.openSync(root, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  return Object.freeze({
    begin(jobId, binding) {
      if (!UUID.test(jobId)) fail();
      check();
      const root = path.join(directory, jobId);
      if (fs.existsSync(root)) throw Object.assign(Error("ISO transaction already recorded"), { code: "EEXIST" });
      // Conservative store-wide reservation survives restart and blocks another job too.
      const reservation = path.join(directory, "active.json");
      const reservationFd = fs.openSync(reservation, "wx", 0o600);
      let reservationIdentity;
      try {
        fs.writeFileSync(reservationFd, JSON.stringify({ version: 1, jobId })); fs.fsyncSync(reservationFd);
        const stat = fs.fstatSync(reservationFd); reservationIdentity = `${stat.dev}:${stat.ino}`;
      } finally { fs.closeSync(reservationFd); }
      syncDirectory(directory);
      // EEXIST intentionally blocks replay, including interrupted preparation.
      fs.mkdirSync(root, { mode: 0o700 }); syncDirectory(directory);
      const identity = inspect(root); let sequence = 0, previous = null, complete = false;
      function append(kind, value) {
        check(); if (inspect(root) !== identity || complete) fail();
        const record = { version: 1, jobId, sequence, previousSha256: previous, kind, value };
        const raw = Buffer.from(JSON.stringify(record)); if (raw.length > 65536) fail();
        const file = path.join(root, String(sequence).padStart(6, "0") + ".json");
        const fd = fs.openSync(file, "wx", 0o600);
        try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        syncDirectory(root);
        previous = crypto.createHash("sha256").update(raw).digest("hex"); sequence++;
        return previous;
      }
      append("begin", binding);
      return Object.freeze({
        append,
        complete(receipt) {
          const sha256 = append("receipt", receipt);
          const stat = fs.lstatSync(reservation);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || `${stat.dev}:${stat.ino}` !== reservationIdentity) fail();
          fs.unlinkSync(reservation); syncDirectory(directory); complete = true; return sha256;
        },
      });
    },
  });
}
module.exports = { createIsoTransactionStore };
