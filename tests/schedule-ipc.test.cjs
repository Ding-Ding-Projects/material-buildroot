"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const os = require("node:os");
const path = require("node:path");
const {
  createScheduleIPC,
} = require("../src/main/preferences/schedule-ipc.cjs");
test("schedule IPC rejects unknown authority and exact-envelope violations before effects", async () => {
  let called = 0;
  const ipc = createScheduleIPC({
    desktop: { admitted: (event) => event === "owner" },
    service: {
      read() {
        called++;
        return null;
      },
    },
  });
  assert.equal(
    (await ipc.request("foreign", '{"action":"read"}')).code,
    "UNAUTHORIZED",
  );
  for (const value of [
    '{"action":"read","directory":"/foreign"}',
    '{"action":"read","action":"read"}',
    '{"action":"source.enroll","origin":"https://untrusted.example"}',
    '{"action":"history","after":0,"limit":101}',
    '{"action":"evaluate","at":0}',
    '{"action":"replace","document":{},"expectedRevision":-1}',
    JSON.stringify({
      action: "replace",
      document: "x".repeat(264193),
      expectedRevision: null,
    }),
  ])
    assert.equal((await ipc.request("owner", value)).code, "INVALID_REQUEST");
  assert.equal(called, 0);
  assert.deepEqual(await ipc.request("owner", '{"action":"read"}'), {
    ok: true,
    result: null,
  });
});
test("schedule IPC withholds revoked replies and supplies a live commit authorizer", async () => {
  let admitted = true,
    resume,
    commits = 0;
  const wait = new Promise((resolve) => (resume = resolve));
  const ipc = createScheduleIPC({
    desktop: { admitted: () => admitted },
    service: {
      async replace({ authorize }) {
        await wait;
        if (!authorize())
          throw Object.assign(Error(), { code: "UNAUTHORIZED" });
        commits++;
        return {};
      },
    },
  });
  const reply = ipc.request(
    {},
    JSON.stringify({ action: "replace", document: {}, expectedRevision: null }),
  );
  admitted = false;
  resume();
  assert.deepEqual(await reply, { ok: false, code: "UNAUTHORIZED" });
  assert.equal(commits, 0);
});
test("source enrollment IPC rejects private host configuration and rechecks mutation authority", async () => {
  let admitted = true,
    resume,
    effects = 0;
  const pending = new Promise((resolve) => {
    resume = resolve;
  });
  const ipc = createScheduleIPC({
    desktop: { admitted: () => admitted },
    service: {
      async enrollmentSave({ authorize }) {
        await pending;
        if (!authorize())
          throw Object.assign(Error(), { code: "UNAUTHORIZED" });
        effects++;
        return {};
      },
    },
  });
  const request = {
    action: "enrollment.save",
    expectedRevision: null,
    label: "Schedule source",
    origin: "https://settings.example",
    kind: "https",
  };
  for (const extra of [
    { authorize: true },
    { trustedCa: "untrusted" },
    { lookup: "override" },
    { directory: "/foreign" },
    { developmentLoopback: true },
    { credentialReference: "vault:00000000-0000-4000-8000-000000000000" },
  ])
    assert.equal(
      (await ipc.request({}, JSON.stringify({ ...request, ...extra }))).code,
      "INVALID_REQUEST",
    );
  assert.equal(
    (await ipc.request({}, JSON.stringify({ ...request, expectedRevision: 0 })))
      .code,
    "INVALID_REQUEST",
  );
  assert.equal(
    (
      await ipc.request(
        {},
        JSON.stringify({
          action: "enrollment.remove",
          expectedRevision: null,
          id: "foreign",
        }),
      )
    ).code,
    "INVALID_REQUEST",
  );
  const reply = ipc.request({}, JSON.stringify(request));
  admitted = false;
  resume();
  assert.deepEqual(await reply, { ok: false, code: "UNAUTHORIZED" });
  assert.equal(effects, 0);
});
test("source enrollment bridge stores protected references without returning secrets or making setup requests", async () => {
  const { randomUUID } = require("node:crypto");
  const { createSchedulePreferencesService } = await import(
    "../src/main/preferences/service.mjs"
  );
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "schedule-enrollment-ipc-"),
  );
  const protectedWrites = [],
    token = "generated-fixture-secret";
  let network = 0;
  const service = createSchedulePreferencesService({
    directory,
    profileId: "desktop",
    baseReader: () => ({ language: "en", "appearance.profile": null, "appearance.theme": "light" }),
    vault: {
      write(owner, secret) {
        protectedWrites.push({ owner, secret });
        return "vault:" + randomUUID();
      },
      read() {
        throw Error("No setup read");
      },
    },
    lookup() {
      network++;
      throw Error("No setup DNS");
    },
  });
  const ipc = createScheduleIPC({ desktop: { admitted: () => true }, service });
  const call = (request) => ipc.request({}, JSON.stringify(request));
  try {
    await service.start();
    const saved = await call({
      action: "enrollment.save",
      expectedRevision: null,
      label: "Home schedule",
      origin: "https://home.example",
      kind: "home-assistant",
      token,
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.result.entries.length, 1);
    assert.equal(saved.result.entries[0].credentialConfigured, true);
    assert.deepEqual(
      protectedWrites.map((write) => write.secret),
      [token],
    );
    assert.doesNotMatch(
      JSON.stringify(saved),
      /generated-fixture-secret|vault:|credentialReference/,
    );
    assert.deepEqual(
      (await call({ action: "enrollment.list" })).result,
      saved.result,
    );
    assert.equal(
      (
        await call({
          action: "enrollment.remove",
          expectedRevision: null,
          id: saved.result.entries[0].id,
        })
      ).code,
      "STALE_REVISION",
    );
    const removed = await call({
      action: "enrollment.remove",
      expectedRevision: saved.result.revision,
      id: saved.result.entries[0].id,
    });
    assert.equal(removed.ok, true);
    assert.deepEqual(removed.result.entries, []);
    assert.equal(network, 0);
    assert.equal(protectedWrites.length, 1);
  } finally {
    await ipc.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("schedule IPC maps private errors to a generic outcome and closes owned service", async () => {
  let closed = false;
  const ipc = createScheduleIPC({
    desktop: { admitted: () => true },
    service: {
      async refresh() {
        throw Object.assign(Error("private response"), {
          code: "PRIVATE_TOKEN_DETAIL",
        });
      },
      close() {
        closed = true;
      },
    },
  });
  assert.deepEqual(await ipc.request({}, '{"action":"refresh"}'), {
    ok: false,
    code: "UNAVAILABLE",
  });
  ipc.close();
  assert.equal(closed, true);
  assert.equal(
    (await ipc.request({}, '{"action":"status"}')).code,
    "UNAUTHORIZED",
  );
});
test("preload admits bounded schedule events without private fields and owns its listener cleanup", async () => {
  let api;
  const listeners = new Map(),
    invocations = [];
  const ipcRenderer = {
    invoke: (...args) => {
      invocations.push(args);
      return Promise.resolve(null);
    },
    on: (channel, callback) => listeners.set(channel, callback),
    removeListener: (channel, callback) => {
      if (listeners.get(channel) === callback) listeners.delete(channel);
    },
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../src/main/preload.cjs"), "utf8"),
    {
      require: () => ({
        contextBridge: { exposeInMainWorld: (_name, value) => (api = value) },
        ipcRenderer,
      }),
    },
  );
  const received = [];
  const stop = api.onScheduledPreferences((value) => received.push(value));
  const emit = listeners.get("studio:scheduled-preferences:event");
  const value = {
    available: true,
    watching: true,
    running: true,
    revision: 0,
    externalAvailable: false,
    effective: {
      values: { language: "en", "appearance.profile": null, "appearance.theme": "dark" },
      provenance: { language: null, "appearance.profile": null, "appearance.theme": "night" },
      appliedRuleIds: ["night"],
      issues: [],
    },
    evaluatedAt: Date.now(),
  };
  emit({}, value);
  assert.equal(received.length, 1);
  assert.equal(Object.isFrozen(received[0].effective.values), true);
  for (const invalid of [
    { ...value, credential: "private" },
    {
      ...value,
      effective: { ...value.effective, source: "https://private.example" },
    },
    {
      ...value,
      effective: {
        ...value.effective,
        issues: [{ ruleId: "night", code: "private response" }],
      },
    },
  ])
    emit({}, invalid);
  assert.equal(received.length, 1);
  stop();
  emit({}, value);
  assert.equal(received.length, 1);
  assert.equal(listeners.size, 0);
  assert.equal(
    (
      await api.scheduledPreferences({
        action: "replace",
        document: "x".repeat(264193),
        expectedRevision: null,
      })
    ).ok,
    false,
  );
  await api.scheduledPreferences({ action: "read" });
  assert.equal(invocations[0][0], "studio:scheduled-preferences");
});

test("desktop schedule boundary commits actual private storage and returns temporary overrides with history", async (t) => {
  const { createSchedulePreferencesService } = await import(
    "../src/main/preferences/service.mjs"
  );
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-ipc-"));
  const base = { language: "en", "appearance.profile": null, "appearance.theme": "system" };
  const service = createSchedulePreferencesService({
    directory,
    profileId: "desktop",
    baseReader: () => base,
  });
  const ipc = createScheduleIPC({
    desktop: { admitted: (event) => event === "owner" },
    service,
  });
  t.after(() => {
    ipc.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await service.start();
  const request = (value) => ipc.request("owner", JSON.stringify(value));
  const document = {
    schemaVersion: 1,
    revision: 0,
    timeZone: "UTC",
    rules: [
      {
        id: "day",
        label: "Preferences",
        enabled: true,
        priority: 0,
        startDate: null,
        endDate: null,
        startTime: "00:00",
        endTime: "00:00",
        days: { type: "everyday" },
        values: { language: "bilingual", "appearance.theme": "dark" },
        source: { type: "local" },
      },
    ],
  };
  const saved = await request({
    action: "replace",
    document,
    expectedRevision: null,
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.result.revision, 0);
  const refreshed = await request({ action: "refresh" });
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.result.available, true);
  assert.deepEqual(refreshed.result.effective.values, {
    language: "bilingual",
    "appearance.theme": "dark",
    "appearance.profile": null,
  });
  assert.deepEqual(base, { language: "en", "appearance.profile": null, "appearance.theme": "system" });
  assert.equal(refreshed.result.externalAvailable, false);
  assert.equal(
    (await request({ action: "replace", document, expectedRevision: null }))
      .code,
    "STALE_REVISION",
  );
  const history = await request({ action: "history", after: 0, limit: 10 });
  assert.equal(history.ok, true);
  assert.equal(history.result.records.length, 1);
  assert.equal(history.result.records[0].receipt.action, "schedule.created");
  assert.equal((await request({ action: "read" })).result.rules.length, 1);
});
