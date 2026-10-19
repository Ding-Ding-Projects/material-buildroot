import hostTools from './helpers/host-tools.cjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import {
  createSchedulePreferencesService,
  CURRENT_SCHEDULE_REGISTRY,
} from "../src/main/preferences/service.mjs";
import { createSqliteScheduleAdapter } from "../src/main/preferences/schedule-store.mjs";
const rule = (startTime = "09:00", endTime = "17:00") => ({
  id: "rule-1",
  label: "Day preferences",
  enabled: true,
  priority: 0,
  startDate: null,
  endDate: null,
  startTime,
  endTime,
  days: { type: "everyday" },
  values: { language: "zh-HK", "appearance.theme": "dark" },
  source: { type: "local" },
});
const document = (rules) => ({
  schemaVersion: 1,
  revision: 0,
  timeZone: "UTC",
  rules,
});
function setup(t, extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-service-"));
  let time = Date.parse("2026-10-15T12:00:00Z");
  const service = createSchedulePreferencesService({
    directory,
    profileId: "desktop",
    baseReader: async () => ({ language: "en", "appearance.profile": null, "appearance.theme": "system" }),
    clock: () => time,
    tickMs: 1000,
    ...extra,
  });
  t.after(() => {
    service.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { service, directory, setTime: (value) => (time = value) };
}
async function waitFor(service, predicate) {
  if (predicate(service.status())) return service.status();
  return new Promise((resolve, reject) => {
    let stop;
    const timer = setTimeout(() => {
      stop?.();
      reject(Error("Status did not settle"));
    }, 2000);
    stop = service.subscribe((state) => {
      if (predicate(state)) {
        clearTimeout(timer);
        stop?.();
        resolve(state);
      }
    });
  });
}
test("actual profile service watches SQLite saves, evaluates live clock, and keeps preview evaluation out of events", async (t) => {
  const { service, directory, setTime } = setup(t),
    initial = await service.start();
  assert.equal(initial.available, true);
  assert.equal(initial.externalAvailable, false);
  assert.equal(await service.read(), null);
  const saved = await service.replace({
    document: document([rule()]),
    expectedRevision: null,
  });
  assert.equal(saved.revision, 0);
  await waitFor(
    service,
    (state) => state.effective?.values.language === "zh-HK",
  );
  const before = service.status().evaluatedAt,
    preview = await service.evaluate({
      at: Date.parse("2026-10-15T18:00:00Z"),
    });
  assert.equal(preview.values.language, "en");
  assert.equal(service.status().evaluatedAt, before);
  assert.equal(service.status().effective.values.language, "zh-HK");
  const other = createSqliteScheduleAdapter({
    directory,
    profileId: "desktop",
    registry: CURRENT_SCHEDULE_REGISTRY,
  });
  const { createScheduleStore } = await import(
    "../src/shared/scheduled-settings.mjs"
  );
  await createScheduleStore({
    adapter: other,
    registry: CURRENT_SCHEDULE_REGISTRY,
  }).replace(document([]), { expectedRevision: 0 });
  await waitFor(
    service,
    (state) =>
      state.revision === 1 && state.effective?.values.language === "en",
  );
  assert.equal((await service.history()).records.length, 2);
  setTime(Date.parse("2026-10-16T12:00:00Z"));
  assert.equal((await service.refresh()).available, true);
  assert.equal((await service.cancel()).externalAvailable, false);
  other.close();
});
test("a revoked frame while scoped read awaits cannot commit the actual SQLite document/history", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-auth-")),
    actual = createSqliteScheduleAdapter({
      directory,
      profileId: "desktop",
      registry: CURRENT_SCHEDULE_REGISTRY,
    });
  let block = false,
    release,
    began;
  const entered = new Promise((resolve) => (began = resolve)),
    barrier = new Promise((resolve) => (release = resolve)),
    adapter = {
      ...actual,
      async read() {
        const bytes = await actual.read();
        if (block) {
          began();
          await barrier;
        }
        return bytes;
      },
    };
  const service = createSchedulePreferencesService({
    directory,
    profileId: "desktop",
    storageAdapter: adapter,
    baseReader: async () => ({ language: "en", "appearance.profile": null, "appearance.theme": "system" }),
  });
  t.after(() => {
    service.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await service.start();
  let authorized = true;
  block = true;
  const replacing = service.replace({
    document: document([rule()]),
    expectedRevision: null,
    authorize: () => authorized,
  });
  await entered;
  authorized = false;
  release();
  await assert.rejects(replacing, { code: "UNAUTHORIZED" });
  assert.equal(await actual.read(), null);
  assert.equal((await actual.history()).records.length, 0);
});
test("watcher failure and real storage corruption expose unavailable without invented base state", async (t) => {
  const watchers = [],
    factory = () => {
      const w = new EventEmitter();
      w.close = () => {};
      watchers.push(w);
      return w;
    };
  const { service, directory } = setup(t, { watchFactory: factory });
  await service.start();
  watchers[0].emit("error", Error("private watcher detail"));
  assert.equal(service.status().available, false);
  assert.equal(service.status().effective, null);
  await waitFor(service, (state) => state.available);
  assert.equal(watchers.length, 2);
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(
    path.join(directory, "scheduled-settings.sqlite"),
  );
  db.prepare("INSERT INTO documents(profile,document) VALUES(?,?)").run(
    "desktop",
    Buffer.from("{"),
  );
  db.close();
  assert.equal((await service.refresh()).available, false);
  assert.equal(service.status().effective, null);
});
test("service close rejects mutations and protected events contain only admitted snapshot fields", async (t) => {
  const { service } = setup(t),
    events = [];
  service.subscribe((state) => events.push(state));
  await service.start();
  await service.replace({
    document: document([rule()]),
    expectedRevision: null,
  });
  await waitFor(
    service,
    (state) => state.effective?.values.language === "zh-HK",
  );
  for (const state of events)
    assert.deepEqual(
      Object.keys(state).sort(),
      [
        "available",
        "watching",
        "running",
        "revision",
        "externalAvailable",
        "effective",
        "evaluatedAt",
      ].sort(),
    );
  assert.equal(JSON.stringify(events).includes("source"), false);
  service.close();
  await assert.rejects(
    service.replace({ document: document([]), expectedRevision: 0 }),
    { code: "SCHEDULE_SERVICE_CLOSED" },
  );
});

test("five actual HTTPS rules receive bounded worker attempts and failures emit one precise issue per rule", async (t) => {
  const https = await import("node:https"),
    { execFileSync } = await import("node:child_process"),
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-workers-"));
  execFileSync(
    hostTools.hostTool('openssl'),
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost",
      "-keyout",
      path.join(directory, "key.pem"),
      "-out",
      path.join(directory, "cert.pem"),
    ],
    { stdio: "ignore" },
  );
  const cert = fs.readFileSync(path.join(directory, "cert.pem")),
    seen = [];
  let active = 0,
    maximum = 0,
    failed = false,
    time = Date.now();
  const server = https.createServer(
    { key: fs.readFileSync(path.join(directory, "key.pem")), cert },
    (req, res) => {
      seen.push(req.url);
      maximum = Math.max(maximum, ++active);
      setTimeout(() => {
        active--;
        res.setHeader("content-type", "application/json");
        if (failed) {
          res.writeHead(401);
          res.end("{}");
        } else
          res.end(
            JSON.stringify({
              schemaVersion: 1,
              status: "ready",
              values: { language: "bilingual", "appearance.theme": "dark" },
            }),
          );
      }, 15);
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "https://localhost:" + server.address().port,
    service = createSchedulePreferencesService({
      directory: path.join(directory, "profile"),
      profileId: "desktop",
      baseReader: async () => ({
        language: "en",
        "appearance.profile": null,
        "appearance.theme": "system",
      }),
      clock: () => time,
      trustedCa: cert,
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
      sourceEnrollments: [
        {
          origin,
          kind: "https",
          privateAddresses: [],
          developmentLoopback: true,
          credentialReference: null,
        },
      ],
    });
  t.after(async () => {
    service.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const local = {
      ...rule("00:00", "00:00"),
      id: "local",
      values: { language: "zh-HK", "appearance.theme": "light" },
    },
    rules = Array.from({ length: 5 }, (_, n) => ({
      ...rule("00:00", "00:00"),
      id: "remote-" + n,
      source: {
        type: "https",
        url: origin + "/v1/rule" + n,
        refreshMs: 30000,
        // This integration check tests worker bounds, not the timeout boundary.
        timeoutMs: 10000,
        maxResponseBytes: 4096,
      },
      values: { language: "bilingual", "appearance.theme": "dark" },
    }));
  await service.start();
  await service.replace({
    document: document([local, ...rules]),
    expectedRevision: null,
  });
  let state = await service.refresh();
  assert.equal(seen.length, 5);
  assert.ok(maximum <= 2);
  assert.equal(state.effective.values.language, "bilingual");
  assert.equal(state.effective.issues.length, 0);
  failed = true;
  time += 30001;
  state = await service.refresh();
  assert.equal(seen.length, 10);
  assert.equal(state.effective.issues.length, 5);
  assert.ok(
    state.effective.issues.every(
      (issue) => issue.code === "SOURCE_AUTH_REQUIRED",
    ),
  );
  assert.equal(
    new Set(state.effective.issues.map((issue) => issue.ruleId)).size,
    5,
  );
  assert.equal(state.effective.values.language, "zh-HK");
  assert.equal(state.effective.values["appearance.theme"], "light");
  assert.equal(JSON.stringify(state).includes(origin), false);
});
