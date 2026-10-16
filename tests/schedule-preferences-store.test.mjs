import fixtureLinks from './helpers/filesystem-links.cjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createSqliteScheduleAdapter } from "../src/main/preferences/schedule-store.mjs";
import { createScheduleStore } from "../src/shared/scheduled-settings.mjs";
const registry = {
  language: (v) => ["en", "zh-HK", "bilingual"].includes(v),
  "appearance.theme": (v) => ["system", "light", "dark"].includes(v),
};
const document = (rules) => ({
  schemaVersion: 1,
  revision: 0,
  timeZone: "UTC",
  rules,
});
const rule = (n) => ({
  id: "rule-" + n,
  label: "x".repeat(160),
  enabled: true,
  priority: 0,
  startDate: null,
  endDate: null,
  startTime: "00:00",
  endTime: "00:00",
  days: { type: "everyday" },
  values: { language: "en", "appearance.theme": "dark" },
  source: { type: "local" },
});
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-db-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const create = (profileId = "desktop", extra = {}) =>
    createSqliteScheduleAdapter({ directory, profileId, registry, ...extra });
  return { directory, create };
}
test("real SQLite commits document and append-only profile-scoped paged history atomically across instances", async (t) => {
  const f = fixture(t),
    a = f.create(),
    b = f.create(),
    sa = createScheduleStore({ adapter: a, registry }),
    sb = createScheduleStore({ adapter: b, registry });
  assert.equal(await sa.load(), null);
  let state = await sa.replace(document([]), { expectedRevision: null });
  await assert.rejects(
    sb.replace(document([rule(1)]), { expectedRevision: null }),
    { code: "STALE_REVISION" },
  );
  for (let n = 0; n < 4; n++)
    state = await sb.replace(document([rule(n)]), {
      expectedRevision: state.revision,
    });
  assert.equal((await sa.load()).revision, 4);
  const page = await a.history({ limit: 2 });
  assert.equal(page.records.length, 2);
  assert.equal(page.hasMore, true);
  assert.equal(
    (await a.history({ after: page.next, limit: 100 })).records.length,
    3,
  );
  const other = f.create("other");
  assert.equal(await other.read(), null);
  assert.equal((await other.history()).records.length, 0);
  a.close();
  b.close();
  other.close();
  const restarted = f.create();
  assert.equal(
    (await createScheduleStore({ adapter: restarted, registry }).load())
      .revision,
    4,
  );
  assert.equal((await restarted.history()).records.length, 5);
  restarted.close();
});
test("failure between actual row writes rolls back document and history together", async (t) => {
  const f = fixture(t),
    base = f.create(),
    store = createScheduleStore({ adapter: base, registry });
  await store.replace(document([]), { expectedRevision: null });
  const failing = f.create("desktop", {
    afterWrite() {
      throw Error("private failure");
    },
  });
  await assert.rejects(
    createScheduleStore({ adapter: failing, registry }).replace(
      document([rule(1)]),
      { expectedRevision: 0 },
    ),
    { code: "STORAGE_UNAVAILABLE" },
  );
  assert.equal((await store.load()).revision, 0);
  assert.equal((await base.history()).records.length, 1);
  base.close();
  failing.close();
});
test("actual killed writer reopens owned journal and rolls back uncommitted document/history", async (t) => {
  const f = fixture(t),
    a = f.create(),
    store = createScheduleStore({ adapter: a, registry });
  await store.replace(document([]), { expectedRevision: null });
  a.close();
  const script = `import fs from 'node:fs';import {createSqliteScheduleAdapter} from ${JSON.stringify(new URL("../src/main/preferences/schedule-store.mjs", import.meta.url).href)};import {createScheduleStore} from ${JSON.stringify(new URL("../src/shared/scheduled-settings.mjs", import.meta.url).href)};const registry={language:v=>['en','zh-HK','bilingual'].includes(v),'appearance.theme':v=>['system','light','dark'].includes(v)};const adapter=createSqliteScheduleAdapter({directory:${JSON.stringify(f.directory)},profileId:'desktop',registry,afterWrite(){fs.writeSync(1,'TRANSACTION_READY\\n');process.kill(process.pid,'SIGKILL')}});await createScheduleStore({adapter,registry}).replace(${JSON.stringify(document(Array.from({ length: 256 }, (_, i) => rule(i))))},{expectedRevision:0});`;
  const writerDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-writer-"));
  t.after(() => fs.rmSync(writerDirectory, {recursive:true, force:true}));
  const writer = path.join(writerDirectory, "writer.mjs");
  fs.writeFileSync(writer, script);
  let killed = false;
  try {
    execFileSync(process.execPath, [writer], {
      stdio: "pipe",
    });
  } catch (error) {
    killed = error.signal === "SIGKILL" || (process.platform === "win32" && error.status === 1 && String(error.stdout).includes("TRANSACTION_READY"));
  }
  assert.equal(killed, true);
  assert.equal(
    fs.existsSync(path.join(f.directory, "scheduled-settings.sqlite-journal")),
    true,
  );
  const reopened = f.create();
  assert.equal(
    (await createScheduleStore({ adapter: reopened, registry }).load())
      .revision,
    0,
  );
  assert.equal((await reopened.history()).records.length, 1);
  const next = await createScheduleStore({
    adapter: reopened,
    registry,
  }).replace(document([rule(1)]), { expectedRevision: 0 });
  assert.equal(next.revision, 1);
  reopened.close();
});
test("foreign headers, unknown sidecars, linked files and corrupt receipt checkpoint are preserved", async (t) => {
  const f = fixture(t),
    file = path.join(f.directory, "scheduled-settings.sqlite");
  fs.writeFileSync(file, "foreign");
  assert.throws(() => f.create());
  assert.equal(fs.readFileSync(file, "utf8"), "foreign");
  fs.unlinkSync(file);
  const a = f.create();
  a.close();
  const before = fs.readFileSync(file);
  fs.writeFileSync(file + "-wal", "foreign");
  assert.throws(() => f.create());
  assert.equal(fs.readFileSync(file).equals(before), true);
  fs.unlinkSync(file + "-wal");
  fs.writeFileSync(file + "-journal", "unknown");
  assert.throws(() => f.create());
  assert.equal(fs.readFileSync(file + "-journal", "utf8"), "unknown");
  fs.unlinkSync(file + "-journal");
  const alias = file + ".alias";
  fs.linkSync(file, alias);
  assert.throws(() => f.create());
  fs.unlinkSync(alias);
  const checkpoint = path.join(f.directory, "scheduled-settings-journal.json");
  fs.writeFileSync(checkpoint, '{"version":1,"version":1}');
  assert.throws(() => f.create());
  assert.equal(
    fs.readFileSync(checkpoint, "utf8"),
    '{"version":1,"version":1}',
  );
});

test("oversized exact-schema rows and history are refused by bounded single-query projection", async (t) => {
  const { DatabaseSync } = await import("node:sqlite");
  const f = fixture(t),
    adapter = f.create(),
    store = createScheduleStore({ adapter, registry });
  await store.replace(document([]), { expectedRevision: null });
  const database = path.join(f.directory, "scheduled-settings.sqlite");
  let db = new DatabaseSync(database);
  db.prepare("UPDATE documents SET document=? WHERE profile=?").run(
    Buffer.alloc(2 * 1024 * 1024, 32),
    "desktop",
  );
  db.close();
  await assert.rejects(adapter.read(), { code: "SCHEDULE_STORAGE_INVALID" });
  const next = new TextEncoder().encode(JSON.stringify(document([])));
  await assert.rejects(
    adapter.commit({
      expectedBytes: next,
      bytes: next,
      receipt: {
        schemaVersion: 1,
        action: "schedule.created",
        fromRevision: null,
        toRevision: 0,
      },
    }),
    { code: "SCHEDULE_STORAGE_INVALID" },
  );
  db = new DatabaseSync(database);
  db.prepare("UPDATE history SET receipt=?").run("x".repeat(2 * 1024 * 1024));
  db.close();
  await assert.rejects(adapter.history(), { code: "SCHEDULE_STORAGE_INVALID" });
  adapter.close();
});

test("journal checkpoint reads use bounded retained descriptors and preserve oversized metadata", async (t) => {
  const f = fixture(t),
    adapter = f.create(),
    checkpoint = path.join(f.directory, "scheduled-settings-journal.json"),
    read = fs.readFileSync;
  fs.readFileSync = (file, ...args) => {
    if (file === checkpoint) throw Error("Unbounded checkpoint read forbidden");
    return read(file, ...args);
  };
  try {
    assert.equal(await adapter.read(), null);
  } finally {
    fs.readFileSync = read;
  }
  adapter.close();
  fs.writeFileSync(checkpoint, Buffer.alloc(2049, 32));
  assert.throws(() => f.create());
  assert.equal(fs.statSync(checkpoint).size, 2049);
});

test("unexpected active journal replacement survives SQLite cleanup and latches profile unavailable", {skip:process.platform === "win32" ? "Active SQLite journal replacement is blocked by Windows file sharing; native blocked-attack rollback is tested separately. Foreign-evidence retention remains unverified here." : false}, async (t) => {
  const f = fixture(t),
    base = f.create(),
    store = createScheduleStore({ adapter: base, registry });
  await store.replace(document([]), { expectedRevision: null });
  base.close();
  const journal = path.join(f.directory, "scheduled-settings.sqlite-journal"),
    foreign = "foreign replacement journal";
  const attacked = f.create("desktop", {
    afterWrite() {
      fs.unlinkSync(journal);
      fs.writeFileSync(journal, foreign);
    },
  });
  await assert.rejects(
    createScheduleStore({ adapter: attacked, registry }).replace(
      document([rule(1)]),
      { expectedRevision: 0 },
    ),
    { code: "STORAGE_UNAVAILABLE" },
  );
  assert.equal(fs.readFileSync(journal, "utf8"), foreign);
  const retained = fs
    .readdirSync(f.directory)
    .filter((name) => name.startsWith("scheduled-journal-retained-"));
  assert.equal(retained.length, 1);
  assert.equal(
    fs.readFileSync(path.join(f.directory, retained[0]), "utf8"),
    foreign,
  );
  assert.ok(
    fs.existsSync(path.join(f.directory, "scheduled-settings-incident.json")),
  );
  await assert.rejects(attacked.read(), {
    code: "SCHEDULE_RECOVERY_UNAVAILABLE",
  });
  attacked.close();
  assert.throws(() => f.create());
});

test("unexpected symlink journal is retained without following it or changing its target", {skip:process.platform === "win32" ? "Active SQLite journal replacement is blocked by Windows file sharing; native blocked-attack rollback is tested separately. Foreign-evidence retention remains unverified here." : false}, async (t) => {
  const f = fixture(t),
    base = f.create(),
    store = createScheduleStore({ adapter: base, registry });
  await store.replace(document([]), { expectedRevision: null });
  base.close();
  const journal = path.join(f.directory, "scheduled-settings.sqlite-journal"),
    outside = path.join(f.directory, "foreign-target");
  fs.writeFileSync(outside, "untouched");
  const attacked = f.create("desktop", {
    afterWrite() {
      fs.unlinkSync(journal);
      fixtureLinks.symlinkSync(outside, journal);
    },
  });
  await assert.rejects(
    createScheduleStore({ adapter: attacked, registry }).replace(
      document([rule(1)]),
      { expectedRevision: 0 },
    ),
  );
  assert.equal(fs.readFileSync(outside, "utf8"), "untouched");
  const incident = JSON.parse(
    fs.readFileSync(
      path.join(f.directory, "scheduled-settings-incident.json"),
      "utf8",
    ),
  );
  assert.equal(incident.kind, "symlink");
  assert.equal(
    fs
      .lstatSync(path.join(f.directory, incident.quarantineName))
      .isSymbolicLink(),
    true,
  );
  assert.equal(fs.lstatSync(journal).isSymbolicLink(), true);
  await assert.rejects(attacked.read());
  attacked.close();
});

test("incident publication failure still closes SQLite and preserves foreign incident/journal evidence", {skip:process.platform === "win32" ? "Active SQLite journal replacement is blocked by Windows file sharing; native blocked-attack rollback is tested separately. Foreign-evidence retention remains unverified here." : false}, async (t) => {
  const { DatabaseSync } = await import("node:sqlite"),
    f = fixture(t),
    base = f.create(),
    store = createScheduleStore({ adapter: base, registry });
  await store.replace(document([]), { expectedRevision: null });
  base.close();
  const file = path.join(f.directory, "scheduled-settings.sqlite"),
    journal = file + "-journal",
    incident = path.join(f.directory, "scheduled-settings-incident.json"),
    adapter = f.create("desktop", {
      afterWrite() {
        fs.unlinkSync(journal);
        fs.writeFileSync(journal, "retained foreign journal");
        fs.writeFileSync(incident, "foreign incident");
      },
    });
  await assert.rejects(
    createScheduleStore({ adapter, registry }).replace(document([rule(1)]), {
      expectedRevision: 0,
    }),
  );
  assert.equal(fs.readFileSync(incident, "utf8"), "foreign incident");
  assert.equal(fs.readFileSync(journal, "utf8"), "retained foreign journal");
  const retained = fs
    .readdirSync(f.directory)
    .find((name) => name.startsWith("scheduled-journal-retained-"));
  assert.equal(
    fs.readFileSync(path.join(f.directory, retained), "utf8"),
    "retained foreign journal",
  );
  adapter.close();
  const db = new DatabaseSync(file, { timeout: 0 });
  try {
    db.exec("BEGIN IMMEDIATE;ROLLBACK;");
  } finally {
    db.close();
  }
  assert.throws(() => f.create());
});

test("pre-retention rename failure uses exclusive link retention and releases the owned SQLite connection", {skip:process.platform === "win32" ? "Active SQLite journal replacement is blocked by Windows file sharing; native blocked-attack rollback is tested separately. Foreign-evidence retention remains unverified here." : false}, async (t) => {
  const { DatabaseSync } = await import("node:sqlite"),
    f = fixture(t),
    base = f.create(),
    store = createScheduleStore({ adapter: base, registry });
  await store.replace(document([]), { expectedRevision: null });
  base.close();
  const file = path.join(f.directory, "scheduled-settings.sqlite"),
    journal = file + "-journal",
    rename = fs.renameSync,
    adapter = f.create("desktop", {
      afterWrite() {
        fs.unlinkSync(journal);
        fs.writeFileSync(journal, "foreign before rename");
      },
    });
  fs.renameSync = (from, to) => {
    if (from === journal)
      throw Object.assign(Error("Injected retention rename failure"), {
        code: "EIO",
      });
    return rename(from, to);
  };
  try {
    await assert.rejects(
      createScheduleStore({ adapter, registry }).replace(document([rule(1)]), {
        expectedRevision: 0,
      }),
    );
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(fs.readFileSync(journal, "utf8"), "foreign before rename");
  const retained = fs
    .readdirSync(f.directory)
    .find((name) => name.startsWith("scheduled-journal-retained-"));
  assert.equal(
    fs.readFileSync(path.join(f.directory, retained), "utf8"),
    "foreign before rename",
  );
  adapter.close();
  const db = new DatabaseSync(file, { timeout: 0 });
  try {
    db.exec("BEGIN IMMEDIATE;ROLLBACK;");
  } finally {
    db.close();
  }
});


test("Windows file sharing blocks active-journal replacement and rollback preserves the prior document", {skip:process.platform !== "win32"}, async t => {
  const f=fixture(t), initial=f.create();
  await createScheduleStore({adapter:initial, registry}).replace(document([]), {expectedRevision:null});
  initial.close();
  const journal=path.join(f.directory,"scheduled-settings.sqlite-journal");
  let blocked;
  const attacked=f.create("desktop", {afterWrite() {
    try { fs.unlinkSync(journal); }
    catch(error) { blocked=error; throw error; }
    assert.fail("This host allowed active-journal removal; use the foreign-journal retention acceptance route instead.");
  }});
  await assert.rejects(createScheduleStore({adapter:attacked,registry}).replace(document([rule(1)]),{expectedRevision:0}),{code:"STORAGE_UNAVAILABLE"});
  assert.ok(blocked,"Attack setup must reach the native sharing boundary.");
  assert.ok(["EPERM","EBUSY","EACCES"].includes(blocked.code),blocked.code);
  attacked.close();
  assert.equal(fs.existsSync(journal),false);
  assert.equal(fs.existsSync(path.join(f.directory,"scheduled-settings-incident.json")),false);
  const reopened=f.create();
  assert.equal((await createScheduleStore({adapter:reopened,registry}).load()).revision,0);
  assert.equal((await reopened.history()).records.length,1);
  reopened.close();
});
