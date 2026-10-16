import { parseStoredSchedule } from "./schedule-validation.mjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import {
  parseScheduleBytes,
  validateScheduleDocument,
  SCHEDULE_LIMITS,
} from "../../shared/scheduled-settings.mjs";
const require = createRequire(import.meta.url),
  { parse } = require("../security/workspace-contract.cjs"),
  storage = require("../jobs/storage.cjs");
const APP_ID = 0x4d425253 + 1;
const DISCARD_MODE = Symbol("schedule-discard-mode");
const DISCARD_OPERATIONS = Symbol("schedule-discard-operations");
const DISCARD_SCHEMA = "CREATE TABLE discarded_drafts(sequence INTEGER PRIMARY KEY AUTOINCREMENT,discarded_at INTEGER NOT NULL,document BLOB NOT NULL) STRICT";
export const SCHEDULE_DRAFT_LIMITS = Object.freeze({records:64, totalBytes:16777216, page:20});
const SCHEMA = [
  "CREATE TABLE guard(id INTEGER PRIMARY KEY CHECK(id=1),value INTEGER NOT NULL) STRICT",
  "CREATE TABLE documents(profile TEXT PRIMARY KEY,document BLOB NOT NULL) STRICT",
  "CREATE TABLE history(sequence INTEGER PRIMARY KEY AUTOINCREMENT,profile TEXT NOT NULL,receipt TEXT NOT NULL) STRICT",
];
const EXPECTED = [
  ...SCHEMA.map((sql) => ({
    type: "table",
    name: /CREATE TABLE (\w+)/.exec(sql)[1],
    sql,
  })),
  {
    type: "table",
    name: "sqlite_sequence",
    sql: "CREATE TABLE sqlite_sequence(name,seq)",
  },
  { type: "index", name: "sqlite_autoindex_documents_1", sql: null },
].sort((a, b) => a.name.localeCompare(b.name));
export class ScheduleStorageError extends Error {
  constructor(code = "SCHEDULE_STORAGE_UNAVAILABLE") {
    super("Scheduled settings storage is unavailable.");
    this.name = "ScheduleStorageError";
    this.code = code;
  }
}
const fail = (code) => {
  throw new ScheduleStorageError(code);
};
const exact = (v, keys) =>
  v &&
  Object.getPrototypeOf(v) === Object.prototype &&
  Reflect.ownKeys(v).length === keys.length &&
  keys.every((key) => Object.hasOwn(v, key));
const exists = (file) => {
  try {
    fs.lstatSync(file);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
};
function identity(file) {
  storage.assertSafe(file);
  const s = fs.lstatSync(file, { bigint: true });
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1n) fail();
  return `${s.dev}:${s.ino}:${s.birthtimeNs}`;
}
function schema(db, expected = EXPECTED) {
  const rows = db
    .prepare(
      "SELECT CASE WHEN length(type)<=16 THEN type ELSE NULL END AS type,CASE WHEN length(CAST(name AS BLOB))<=128 THEN name ELSE NULL END AS name,CASE WHEN length(CAST(sql AS BLOB))<=1024 THEN sql ELSE NULL END AS sql FROM sqlite_master ORDER BY name LIMIT 7",
    )
    .all()
    .map((row) => ({ ...row }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (JSON.stringify(rows) !== JSON.stringify(expected)) fail();
}
function receiptValid(receipt) {
  if (
    !exact(receipt, [
      "schemaVersion",
      "action",
      "fromRevision",
      "toRevision",
    ]) ||
    receipt.schemaVersion !== 1 ||
    !["schedule.created", "schedule.updated"].includes(receipt.action) ||
    !(
      receipt.fromRevision === null ||
      (Number.isSafeInteger(receipt.fromRevision) && receipt.fromRevision >= 0)
    ) ||
    !Number.isSafeInteger(receipt.toRevision) ||
    receipt.toRevision < 0 ||
    receipt.toRevision !== (receipt.fromRevision ?? -1) + 1 ||
    receipt.action !==
      (receipt.fromRevision === null ? "schedule.created" : "schedule.updated")
  )
    fail("INVALID_SCHEDULE_TRANSACTION");
}
/** SQLite owns document and history atomicity; the caller owns profile and registry admission. */
export function createSqliteScheduleAdapter({
  directory,
  profileId,
  afterWrite,
  allowUnenrolledSources = false,
  [DISCARD_MODE]: discardMode = false,
  ...options
}) {
  const schemaDefinition = discardMode ? [...SCHEMA, DISCARD_SCHEMA] : SCHEMA;
  const schemaExpected = discardMode ? [...EXPECTED, {type:"table",name:"discarded_drafts",sql:DISCARD_SCHEMA}].sort((a,b)=>a.name.localeCompare(b.name)) : EXPECTED;
  const applicationId = discardMode ? APP_ID + 1 : APP_ID;
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    typeof profileId !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(profileId) ||
    (afterWrite !== undefined && typeof afterWrite !== "function")
  )
    fail("INVALID_SCHEDULE_STORAGE");
  try {
    directory = storage.directory(directory);
  } catch {
    fail();
  }
  const file = path.join(directory, "scheduled-settings.sqlite"),
    checkpoint = path.join(directory, "scheduled-settings-journal.json"),
    root = fs.statSync(directory, { bigint: true }),
    incidentFile = path.join(directory, "scheduled-settings-incident.json");
  let closed = false,
    databaseIdentity;
  const guard = (allowIncident = false) => {
    if (closed) fail();
    storage.assertSafe(directory);
    const now = fs.statSync(directory, { bigint: true });
    if (now.dev !== root.dev || now.ino !== root.ino) fail();
    if (databaseIdentity && identity(file) !== databaseIdentity) fail();
    if (discardMode && exists(file) && fs.statSync(file).size > 67108864) fail("SCHEDULE_STORAGE_INVALID");
    if (!allowIncident) {
      const listing = fs.opendirSync(directory);
      try {
        for (let count = 0; ; count++) {
          const entry = listing.readSync();
          if (!entry) break;
          if (
            count >= 1024 ||
            entry.name === "scheduled-settings-incident.json" ||
            entry.name.startsWith("scheduled-journal-retained-")
          )
            fail("SCHEDULE_RECOVERY_UNAVAILABLE");
        }
      } finally {
        listing.closeSync();
      }
    }
  };
  const marker = () => {
    if (!exists(checkpoint)) return null;
    const before = fs.lstatSync(checkpoint, { bigint: true });
    identity(checkpoint);
    if (before.size > 2048n) fail();
    const signature = (s) =>
      [s.dev, s.ino, s.birthtimeNs, s.size, s.mtimeNs, s.ctimeNs, s.nlink]
        .map(String)
        .join(":");
    const fd = fs.openSync(
      checkpoint,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    let value;
    try {
      const opened = fs.fstatSync(fd, { bigint: true });
      if (signature(opened) !== signature(before)) fail();
      const bytes = Buffer.alloc(2049);
      let length = 0;
      while (length < bytes.length) {
        const count = fs.readSync(
          fd,
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (!count) break;
        length += count;
      }
      if (
        length > 2048 ||
        signature(opened) !== signature(fs.fstatSync(fd, { bigint: true })) ||
        signature(opened) !==
          signature(fs.lstatSync(checkpoint, { bigint: true }))
      )
        fail();
      value = parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          bytes.subarray(0, length),
        ),
      );
    } finally {
      fs.closeSync(fd);
    }
    if (
      !exact(value, ["format", "version", "database", "journal"]) ||
      value.format !== "scheduled-settings-journal" ||
      value.version !== 1 ||
      value.database !== databaseIdentity ||
      (value.journal !== null &&
        (typeof value.journal !== "string" ||
          !/^\d+:\d+:\d+$/.test(value.journal)))
    )
      fail();
    return value;
  };
  function sidecars() {
    for (const suffix of ["-wal", "-shm"]) if (exists(file + suffix)) fail();
    const saved = marker();
    if (
      exists(file + "-journal") &&
      (!saved || identity(file + "-journal") !== saved.journal)
    )
      fail("SCHEDULE_RECOVERY_UNAVAILABLE");
  }
  function header() {
    identity(file);
    const fd = fs.openSync(
      file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    try {
      const b = Buffer.alloc(100);
      if (
        fs.readSync(fd, b, 0, b.length, 0) !== 100 ||
        b.toString("binary", 0, 16) !== "SQLite format 3\0" ||
        b.readUInt32BE(68) !== applicationId ||
        b.readUInt32BE(60) !== 1 ||
        b[18] !== 1 ||
        b[19] !== 1
      )
        fail();
    } finally {
      fs.closeSync(fd);
    }
  }
  function open() {
    guard();
    header();
    sidecars();
    const db = new DatabaseSync(file, { allowExtension: false, timeout: 0 });
    try {
      db.exec(
        "PRAGMA trusted_schema=OFF;PRAGMA synchronous=FULL;PRAGMA cache_size=-64;",
      );
      schema(db, schemaExpected);
      return db;
    } catch (error) {
      db.close();
      throw error;
    }
  }
  function publishMarker(journal) {
    guard();
    if (exists(checkpoint)) marker();
    storage.atomic(checkpoint, {
      format: "scheduled-settings-journal",
      version: 1,
      database: databaseIdentity,
      journal,
    });
    if (process.platform !== "win32") {
      const fd = fs.openSync(directory, "r");
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
  }
  function preserveUnexpectedJournal(expected) {
    if (!expected || !exists(file + "-journal")) return null;
    let actual;
    try {
      actual = identity(file + "-journal");
    } catch {}
    if (actual === expected) return null;
    guard(true);
    const journal = file + "-journal",
      before = fs.lstatSync(journal, { bigint: true }),
      quarantineName = "scheduled-journal-retained-" + randomUUID(),
      quarantine = path.join(directory, quarantineName);
    let linkBytes = null;
    if (before.isSymbolicLink()) {
      linkBytes = fs.readlinkSync(journal, { encoding: "buffer" });
      if (linkBytes.length > 4096) fail("SCHEDULE_RECOVERY_UNAVAILABLE");
    }
    const description = {
      format: "scheduled-settings-incident",
      version: 1,
      database: databaseIdentity,
      quarantineName,
      identity: [before.dev, before.ino, before.birthtimeNs]
        .map(String)
        .join(":"),
      bytes: String(before.isSymbolicLink() ? linkBytes.length : before.size),
      kind: before.isSymbolicLink()
        ? "symlink"
        : before.isFile()
          ? "file"
          : "special",
      linkDigest: linkBytes
        ? createHash("sha256").update(linkBytes).digest("hex")
        : null,
      status: "retained",
    };
    const current = fs.lstatSync(journal, { bigint: true });
    if (
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs ||
      exists(quarantine)
    )
      fail("SCHEDULE_RECOVERY_UNAVAILABLE");
    try {
      fs.renameSync(journal, quarantine);
    } catch {
      if (!exists(quarantine)) {
        fs.linkSync(journal, quarantine);
        const linked = fs.lstatSync(quarantine, { bigint: true }),
          source = fs.lstatSync(journal, { bigint: true });
        if (
          linked.dev !== before.dev ||
          linked.ino !== before.ino ||
          linked.birthtimeNs !== before.birthtimeNs ||
          source.dev !== before.dev ||
          source.ino !== before.ino ||
          source.birthtimeNs !== before.birthtimeNs
        )
          fail("SCHEDULE_RECOVERY_UNAVAILABLE");
        fs.unlinkSync(journal);
      }
    }
    const retained = fs.lstatSync(quarantine, { bigint: true });
    if (
      retained.dev !== before.dev ||
      retained.ino !== before.ino ||
      retained.birthtimeNs !== before.birthtimeNs
    )
      fail("SCHEDULE_RECOVERY_UNAVAILABLE");
    let fd;
    try {
      fd = fs.openSync(incidentFile, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(description));
      fs.fsyncSync(fd);
    } catch {
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    return { description, quarantine };
  }
  function restoreRetained(incident) {
    guard(true);
    const { description, quarantine } = incident,
      current = fs.lstatSync(quarantine, { bigint: true });
    if (
      [current.dev, current.ino, current.birthtimeNs].map(String).join(":") !==
      description.identity
    )
      fail("SCHEDULE_RECOVERY_UNAVAILABLE");
    // link() creates the original name only if absent and never overwrites a new replacement.
    // Keep the retained name and incident record permanently for explicit owner recovery.
    try {
      fs.linkSync(quarantine, file + "-journal");
    } catch (error) {
      if (error.code !== "EEXIST") fail("SCHEDULE_RECOVERY_UNAVAILABLE");
    }
  }

  try {
    guard();
    if (exists(file)) {
      databaseIdentity = identity(file);
      header();
      sidecars();
      const db = open();
      db.close();
    } else {
      if (
        exists(checkpoint) ||
        ["-wal", "-shm", "-journal"].some((suffix) => exists(file + suffix))
      )
        fail();
      const fd = fs.openSync(file, "wx", 0o600);
      fs.closeSync(fd);
      databaseIdentity = identity(file);
      const db = new DatabaseSync(file, { allowExtension: false, timeout: 0 });
      try {
        db.exec(
          `PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA trusted_schema=OFF;BEGIN IMMEDIATE;${schemaDefinition.join(";")};INSERT INTO guard VALUES(1,0);PRAGMA application_id=${applicationId};PRAGMA user_version=1;COMMIT;`,
        );
        schema(db, schemaExpected);
      } finally {
        db.close();
      }
      publishMarker(null);
    }
  } catch {
    fail();
  }
  const safe = (fn) => {
    try {
      return fn();
    } catch (error) {
      if (error instanceof ScheduleStorageError) throw error;
      if (
        error.code === "ERR_SQLITE_ERROR" &&
        /locked|busy/i.test(error.message)
      )
        fail("SCHEDULE_STORAGE_BUSY");
      fail();
    }
  };
  const localDraft = (document) => {
    try {
      validateScheduleDocument(document, {registry:options.registry});
      if (document.rules.some(rule => rule.source.type !== "local")) throw Error();
      const bytes = Buffer.from(JSON.stringify(document), "utf8");
      return {bytes, document:parseScheduleBytes(bytes,{registry:options.registry})};
    } catch { fail("INVALID_SCHEDULE_DRAFT"); }
  };
  const draftBounds = (db) => {
    if (!discardMode) fail("INVALID_REQUEST");
    const row=db.prepare("SELECT count(*) AS count,coalesce(sum(length(document)),0) AS bytes,min(length(document)) AS smallest,max(length(document)) AS largest FROM discarded_drafts").get();
    if (row.count>SCHEDULE_DRAFT_LIMITS.records || row.bytes>SCHEDULE_DRAFT_LIMITS.totalBytes || (row.count && (row.smallest<1 || row.largest>SCHEDULE_LIMITS.documentBytes))) fail("SCHEDULE_STORAGE_INVALID");
    return row;
  };
  const draftMeta = row => {
    if (!Number.isSafeInteger(row.sequence) || row.sequence<1 || !Number.isSafeInteger(row.discardedAt) || row.discardedAt<0 || row.discardedAt>8640000000000000) fail("SCHEDULE_STORAGE_INVALID");
    return {sequence:row.sequence,discardedAt:row.discardedAt};
  };
  const permission = authorize => {
    let allowed=false;
    try { allowed=!closed && typeof authorize === "function" && authorize() === true; } catch {}
    if (!allowed) fail("UNAUTHORIZED");
  };
  return Object.freeze({
    [DISCARD_OPERATIONS]: Object.freeze({
      async append({document,discardedAt,authorize=()=>true}) {
        permission(authorize);
        const candidate=localDraft(document);
        if (!Number.isSafeInteger(discardedAt) || discardedAt<0 || discardedAt>8640000000000000) fail("INVALID_SCHEDULE_DRAFT");
        return safe(()=>{
          const db=open(); let transaction=false,journal;
          try {
            db.exec("BEGIN IMMEDIATE"); transaction=true;
            const totals=draftBounds(db);
            if (totals.count>=SCHEDULE_DRAFT_LIMITS.records || totals.bytes+candidate.bytes.length>SCHEDULE_DRAFT_LIMITS.totalBytes) fail("SCHEDULE_DRAFT_LIMIT");
            permission(authorize);
            db.exec("UPDATE guard SET value=1-value WHERE id=1");
            journal=identity(file+"-journal"); publishMarker(journal);
            const inserted=db.prepare("INSERT INTO discarded_drafts(discarded_at,document) VALUES(?,?)").run(discardedAt,candidate.bytes);
            const receipt=draftMeta({sequence:Number(inserted.lastInsertRowid),discardedAt});
            const hook=afterWrite?.();
            if (hook!==undefined) { if(hook && typeof hook.then==="function") Promise.resolve(hook).catch(()=>{}); fail("INVALID_SCHEDULE_TRANSACTION"); }
            permission(authorize); guard();
            if(identity(file+"-journal")!==journal) fail();
            db.exec("COMMIT"); transaction=false; guard();
            return receipt;
          } finally {
            let incident,preservationError;
            if(transaction) {
              try { incident=preserveUnexpectedJournal(journal); } catch(error) { preservationError=error; }
              try { db.exec("ROLLBACK"); } catch {}
            }
            try { db.close(); } finally {
              if(incident) { restoreRetained(incident); fail("SCHEDULE_RECOVERY_UNAVAILABLE"); }
              if(preservationError) throw preservationError;
            }
          }
        });
      },
      async list({after=0,limit=20,authorize=()=>true}={}) {
        permission(authorize);
        if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>SCHEDULE_DRAFT_LIMITS.page) fail("INVALID_HISTORY_PAGE");
        return safe(()=>{
          const db=open();
          try {
            draftBounds(db);
            const rows=db.prepare("SELECT sequence,discarded_at AS discardedAt FROM discarded_drafts WHERE sequence>? ORDER BY sequence LIMIT ?").all(after,limit+1);
            const records=rows.slice(0,limit).map(draftMeta);
            permission(authorize);
            return {records,next:records.at(-1)?.sequence??after,hasMore:rows.length>limit};
          } finally { db.close(); }
        });
      },
      async read({sequence,authorize=()=>true}) {
        permission(authorize);
        if(!Number.isSafeInteger(sequence)||sequence<1) fail("INVALID_HISTORY_PAGE");
        return safe(()=>{
          const db=open();
          try {
            draftBounds(db);
            const row=db.prepare("SELECT sequence,discarded_at AS discardedAt,CASE WHEN length(document) BETWEEN 1 AND 262144 THEN document ELSE NULL END AS document FROM discarded_drafts WHERE sequence=?").get(sequence);
            if(!row) return null;
            if(row.document===null) fail("SCHEDULE_STORAGE_INVALID");
            const document=localDraft(parseScheduleBytes(new Uint8Array(row.document),{registry:options.registry})).document;
            permission(authorize);
            return {...draftMeta(row),document};
          } finally { db.close(); }
        });
      },
    }),
    async read() {
      return safe(() => {
        const db = open();
        try {
          const row = db
            .prepare(
              "SELECT length(document) AS bytes,CASE WHEN length(document) BETWEEN 1 AND 262144 THEN document ELSE NULL END AS document FROM documents WHERE profile=?",
            )
            .get(profileId);
          if (!row) return null;
          if (row.document === null) fail("SCHEDULE_STORAGE_INVALID");
          const bytes = new Uint8Array(row.document);
          (allowUnenrolledSources ? parseStoredSchedule : parseScheduleBytes)(
            bytes,
            options,
          );
          return bytes;
        } finally {
          db.close();
        }
      });
    },
    async commit({ expectedBytes, bytes, receipt }) {
      return safe(() => {
        receiptValid(receipt);
        if (
          !(bytes instanceof Uint8Array) ||
          bytes.byteLength > SCHEDULE_LIMITS.documentBytes ||
          (expectedBytes !== null && !(expectedBytes instanceof Uint8Array))
        )
          fail("INVALID_SCHEDULE_TRANSACTION");
        const candidate = (
          allowUnenrolledSources ? parseStoredSchedule : parseScheduleBytes
        )(bytes, options);
        if (candidate.revision !== receipt.toRevision)
          fail("INVALID_SCHEDULE_TRANSACTION");
        const db = open();
        let transaction = false,
          journal;
        try {
          db.exec("BEGIN IMMEDIATE");
          transaction = true;
          const row = db
            .prepare(
              "SELECT length(document) AS bytes,CASE WHEN length(document) BETWEEN 1 AND 262144 THEN document ELSE NULL END AS document FROM documents WHERE profile=?",
            )
            .get(profileId);
          if (row && row.document === null) fail("SCHEDULE_STORAGE_INVALID");
          const current = row ? new Uint8Array(row.document) : null;
          if (
            current === null
              ? expectedBytes !== null
              : expectedBytes === null ||
                !Buffer.from(current).equals(Buffer.from(expectedBytes))
          ) {
            db.exec("ROLLBACK");
            transaction = false;
            return false;
          }
          if (current) {
            const prior = (
              allowUnenrolledSources ? parseStoredSchedule : parseScheduleBytes
            )(current, options);
            if (prior.revision !== receipt.fromRevision)
              fail("INVALID_SCHEDULE_TRANSACTION");
          } else if (receipt.fromRevision !== null)
            fail("INVALID_SCHEDULE_TRANSACTION");
          // Force journal creation, then durably bind its inode before user state/history changes.
          db.exec("UPDATE guard SET value=1-value WHERE id=1");
          journal = identity(file + "-journal");
          publishMarker(journal);
          db.prepare(
            "INSERT INTO documents VALUES(?,?) ON CONFLICT(profile) DO UPDATE SET document=excluded.document",
          ).run(profileId, bytes);
          db.prepare("INSERT INTO history(profile,receipt) VALUES(?,?)").run(
            profileId,
            JSON.stringify(receipt),
          );
          const hookResult = afterWrite?.();
          if (hookResult !== undefined) {
            if (hookResult && typeof hookResult.then === "function")
              Promise.resolve(hookResult).catch(() => {});
            fail("INVALID_SCHEDULE_TRANSACTION");
          }
          guard();
          if (identity(file + "-journal") !== journal) fail();
          db.exec("COMMIT");
          transaction = false;
          guard();
          return true;
        } finally {
          let incident, preservationError;
          if (transaction) {
            try {
              incident = preserveUnexpectedJournal(journal);
            } catch (error) {
              preservationError = error;
            }
            try {
              db.exec("ROLLBACK");
            } catch {}
          }
          try {
            db.close();
          } finally {
            if (incident) {
              restoreRetained(incident);
              fail("SCHEDULE_RECOVERY_UNAVAILABLE");
            }
            if (preservationError) throw preservationError;
          }
        }
      });
    },
    async history({ after = 0, limit = 50 } = {}) {
      return safe(() => {
        if (
          !Number.isSafeInteger(after) ||
          after < 0 ||
          !Number.isSafeInteger(limit) ||
          limit < 1 ||
          limit > 100
        )
          fail("INVALID_HISTORY_PAGE");
        const db = open();
        try {
          const rows = db
            .prepare(
              "SELECT sequence,CASE WHEN length(CAST(receipt AS BLOB)) BETWEEN 1 AND 512 THEN receipt ELSE NULL END AS receipt FROM history WHERE profile=? AND sequence>? ORDER BY sequence LIMIT ?",
            )
            .all(profileId, after, limit + 1);
          const records = rows.slice(0, limit).map((row) => {
            if (row.receipt === null) fail("SCHEDULE_STORAGE_INVALID");
            const receipt = parse(row.receipt);
            receiptValid(receipt);
            return { sequence: row.sequence, receipt };
          });
          return {
            records,
            next: records.at(-1)?.sequence ?? after,
            hasMore: rows.length > limit,
          };
        } finally {
          db.close();
        }
      });
    },
    close() {
      closed = true;
    },
  });
}

/** Separate append-only drafts never enter active documents or mutation receipts. */
export function createSqliteScheduleDiscardStore({directory,profileId,registry,clock=Date.now,afterWrite}={}) {
  if(typeof profileId!=="string" || !/^[A-Za-z0-9_-]{1,80}$/.test(profileId) || typeof clock!=="function" || typeof directory!=="string" || !path.isAbsolute(directory)) fail("INVALID_SCHEDULE_STORAGE");
  // Reuse the same exact-schema, path, journal ownership and incident recovery checks.
  const adapter=createSqliteScheduleAdapter({directory:path.join(directory,"schedule-discard-history-"+profileId),profileId,registry,afterWrite,[DISCARD_MODE]:true});
  const operations=adapter[DISCARD_OPERATIONS];
  return Object.freeze({
    append({document,authorize=()=>true}) { return operations.append({document,authorize,discardedAt:clock()}); },
    list:operations.list,
    read:operations.read,
    close:adapter.close,
  });
}
