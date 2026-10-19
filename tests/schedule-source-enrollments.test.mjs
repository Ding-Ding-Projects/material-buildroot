import fixtureLinks from './helpers/filesystem-links.cjs';
import hostTools from './helpers/host-tools.cjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createSourceEnrollmentStore } from "../src/main/preferences/source-enrollments.mjs";
import { createSchedulePreferencesService } from "../src/main/preferences/service.mjs";
const input = {
  label: "Settings source",
  origin: "https://settings.example",
  kind: "https",
  privateAddresses: [],
};
function fixture(t, extra = {}) {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "source-enrollments-"),
    ),
    values = new Map(),
    writes = [];
  const vault = {
    async write(owner, value) {
      const reference = "vault:" + randomUUID();
      values.set(reference, value);
      writes.push({ owner, reference });
      return reference;
    },
    async read(reference) {
      return values.get(reference);
    },
  };
  const options = { directory, profileId: "desktop", vault, ...extra },
    stores = [];
  const create = () => {
    const store = createSourceEnrollmentStore(options);
    stores.push(store);
    return store;
  };
  t.after(() => {
    stores.forEach((store) => store.close());
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    vault,
    values,
    writes,
    create,
    file: path.join(directory, "schedule-sources-desktop.json"),
  };
}
test("explicit list/save/replace/remove persists across restart and reveals no protected references", async (t) => {
  const f = fixture(t),
    a = f.create(),
    b = f.create();
  assert.deepEqual(await a.list(), {
    available: true,
    revision: null,
    entries: [],
  });
  let saved = await a.save({ ...input, expectedRevision: null });
  const id = saved.entries[0].id;
  assert.match(id, /^[0-9a-f-]{36}$/);
  await assert.rejects(b.save({ ...input, expectedRevision: null }), {
    code: "STALE_REVISION",
  });
  saved = await b.save({
    ...input,
    id,
    label: "Renamed source",
    expectedRevision: saved.revision,
  });
  assert.equal((await a.list()).entries[0].label, "Renamed source");
  assert.equal(f.writes.length, 0);
  const restarted = f.create();
  assert.deepEqual(await restarted.list(), saved);
  saved = await restarted.remove({ id, expectedRevision: saved.revision });
  assert.equal(saved.entries.length, 0);
  assert.equal((await a.list()).entries.length, 0);
});
test("HA enrollment/rotation protects transient token, requires explicit retain and preserves old references", async (t) => {
  const f = fixture(t),
    store = f.create(),
    ha = {
      ...input,
      origin: "https://home.example",
      kind: "home-assistant",
      privateAddresses: ["192.168.1.20", "fd00::20"],
      privateAddressConsent: true,
      token: "generated-neutral-token-A",
    };
  let saved = await store.save({ ...ha, expectedRevision: null });
  assert.equal(saved.entries[0].credentialConfigured, true);
  assert.equal(JSON.stringify(saved).includes("vault:"), false);
  assert.equal(fs.readFileSync(f.file, "utf8").includes(ha.token), false);
  const id = saved.entries[0].id;
  await assert.rejects(
    store.save({
      ...ha,
      id,
      token: undefined,
      expectedRevision: saved.revision,
    }),
    { code: "SOURCE_CREDENTIAL_REQUIRED" },
  );
  saved = await store.save({
    ...ha,
    id,
    token: undefined,
    retainCredential: true,
    expectedRevision: saved.revision,
  });
  assert.equal(f.writes.length, 1);
  saved = await store.save({
    ...ha,
    id,
    token: "generated-neutral-token-B",
    expectedRevision: saved.revision,
  });
  assert.equal(f.writes.length, 2);
  assert.notEqual(f.writes[0].reference, f.writes[1].reference);
  assert.equal(f.values.get(f.writes[0].reference), ha.token);
  assert.equal(JSON.stringify(await store.list()).includes("token"), false);
  assert.equal(JSON.stringify(await store.list()).includes("reference"), false);
});
test("private consent, unsafe addresses/origins, duplicate origin and unknown user capability fields are refused", async (t) => {
  const f = fixture(t),
    store = f.create();
  for (const origin of [
    "http://home.example",
    "https://home.example/path",
    "https://home.example?token=x",
    "https://user:pass@home.example",
    "https://169.254.169.254",
    "https://127.0.0.1",
  ])
    await assert.rejects(
      store.save({ ...input, origin, expectedRevision: null }),
    );
  for (const privateAddresses of [
    ["169.254.169.254"],
    ["127.0.0.1"],
    ["fe80::1"],
    ["::1"],
    ["8.8.8.8"],
  ])
    await assert.rejects(
      store.save({
        ...input,
        kind: "home-assistant",
        privateAddresses,
        privateAddressConsent: true,
        token: "neutral-token",
        expectedRevision: null,
      }),
    );
  await assert.rejects(
    store.save({
      ...input,
      kind: "home-assistant",
      privateAddresses: ["10.0.0.1"],
      token: "neutral-token",
      expectedRevision: null,
    }),
  );
  let saved = await store.save({ ...input, expectedRevision: null });
  await assert.rejects(
    store.save({
      ...input,
      label: "Duplicate",
      expectedRevision: saved.revision,
    }),
  );
  assert.equal(f.writes.length, 0);
});
test("revocation while vault write awaits publishes no record and safely retains orphaned owned vault entry", async (t) => {
  const f = fixture(t);
  let release,
    began,
    authorized = true;
  const barrier = new Promise((resolve) => (release = resolve)),
    started = new Promise((resolve) => (began = resolve)),
    write = f.vault.write;
  f.vault.write = async (...args) => {
    const ref = await write(...args);
    began();
    await barrier;
    return ref;
  };
  const store = f.create(),
    pending = store.save({
      ...input,
      kind: "home-assistant",
      token: "neutral-token",
      expectedRevision: null,
      authorize: () => authorized,
    });
  await started;
  authorized = false;
  release();
  await assert.rejects(pending, { code: "UNAUTHORIZED" });
  assert.equal(fs.existsSync(f.file), false);
  assert.equal(f.writes.length, 1);
  assert.equal((await store.list()).entries.length, 0);
});
test("corrupt/foreign/duplicate/linked metadata is preserved and oversized reads fail closed", async (t) => {
  const f = fixture(t),
    store = f.create();
  for (const text of [
    "broken",
    '{"format":"foreign","version":1,"revision":null,"entries":[]}',
    '{"version":1,"version":1}',
    " ".repeat(131073),
  ]) {
    fs.writeFileSync(f.file, text);
    await assert.rejects(store.list());
    assert.equal(fs.readFileSync(f.file, "utf8"), text);
  }
  await t.test("real file symbolic-link metadata", async linkTest => {
  fs.unlinkSync(f.file);
  const outside = path.join(f.directory, "outside");
  fs.writeFileSync(outside, "foreign");
  try { fixtureLinks.symlinkSync(outside, f.file); } catch (error) { if (process.platform === "win32" && error.code === "EPERM") { linkTest.skip("File symbolic-link privilege is unavailable; linked metadata acceptance remains unverified."); return; } throw error; }
  await assert.rejects(store.list());
  await assert.rejects(store.save({ ...input, expectedRevision: null }));
  assert.equal(fs.readFileSync(outside, "utf8"), "foreign");
  });
});
test("same-revision edits during vault await are preserved as conflicts without publishing new reference", async (t) => {
  const f = fixture(t),
    store = f.create();
  let saved = await store.save({ ...input, expectedRevision: null });
  const original = f.vault.write;
  f.vault.write = async (...args) => {
    const ref = await original(...args),
      edited = JSON.parse(fs.readFileSync(f.file, "utf8"));
    edited.entries[0].label = "External edit";
    fs.writeFileSync(f.file, JSON.stringify(edited));
    return ref;
  };
  await assert.rejects(
    store.save({
      ...input,
      id: saved.entries[0].id,
      kind: "home-assistant",
      token: "neutral-token",
      expectedRevision: saved.revision,
    }),
    { code: "STALE_REVISION" },
  );
  assert.equal((await store.list()).entries[0].label, "External edit");
  assert.equal((await store.list()).entries[0].kind, "https");
});
test("service keeps unenrolled/removed rules readable and local overrides usable without DNS during setup", async (t) => {
  const f = fixture(t);
  let queries = 0;
  const service = createSchedulePreferencesService({
    directory: f.directory,
    profileId: "desktop",
    vault: f.vault,
    clock: () => Date.parse("2026-10-15T12:00:00Z"),
    lookup: async () => {
      queries++;
      return [{ address: "10.0.0.3", family: 4 }];
    },
    baseReader: async () => ({ language: "en", "appearance.profile": null, "appearance.theme": "system" }),
  });
  t.after(() => service.close());
  await service.start();
  const local = {
      id: "local",
      label: "Local",
      enabled: true,
      priority: 0,
      startDate: null,
      endDate: null,
      startTime: "00:00",
      endTime: "00:00",
      days: { type: "everyday" },
      values: { language: "zh-HK" },
      source: { type: "local" },
    },
    remote = {
      ...local,
      id: "remote",
      priority: 5,
      source: {
        type: "https",
        url: "https://settings.example/v1/settings",
        refreshMs: 30000,
        timeoutMs: 100,
        maxResponseBytes: 4096,
      },
      values: { language: "bilingual" },
    };
  await service.replace({
    document: {
      schemaVersion: 1,
      revision: 0,
      timeZone: "UTC",
      rules: [local, remote],
    },
    expectedRevision: null,
  });
  let status = await service.refresh();
  assert.equal(status.available, true);
  assert.equal(status.effective.values.language, "zh-HK");
  assert.equal(status.effective.issues[0].code, "SOURCE_NOT_ENROLLED");
  assert.equal(queries, 0);
  let enrollment = await service.enrollmentSave({
    ...input,
    expectedRevision: null,
  });
  assert.equal(queries, 0);
  assert.equal(service.status().externalAvailable, true);
  await service.enrollmentRemove({
    id: enrollment.entries[0].id,
    expectedRevision: enrollment.revision,
  });
  assert.equal(queries, 0);
  status = await service.refresh();
  assert.equal(status.available, true);
  assert.equal(status.effective.values.language, "zh-HK");
  assert.equal(status.effective.issues[0].code, "SOURCE_NOT_ENROLLED");
  assert.equal((await service.read()).rules.length, 2);
  fs.writeFileSync(f.file, "corrupt");
  await assert.rejects(service.enrollmentList());
  status = service.status();
  assert.equal(status.available, true);
  assert.equal(status.externalAvailable, false);
  assert.equal(status.effective.values.language, "zh-HK");
  assert.equal(
    status.effective.issues[0].code,
    "SOURCE_ENROLLMENTS_UNAVAILABLE",
  );
});

test("unreviewed transport and credential fields are rejected rather than silently ignored", async (t) => {
  const f = fixture(t),
    store = f.create();
  for (const extra of [
    { developmentLoopback: true },
    { trustedCa: "x" },
    { resolver: "x" },
    { credentialReference: "vault:" + randomUUID() },
    { path: "/tmp/example" },
    { privateAddressConsent: "yes" },
    { retainCredential: "yes" },
  ])
    await assert.rejects(
      store.save({ ...input, ...extra, expectedRevision: null }),
      { code: "INVALID_SOURCE_ENROLLMENT" },
    );
  assert.equal((await store.list()).entries.length, 0);
});

test("failed metadata publication preserves previous entry and does not modify an old credential reference", async (t) => {
  const f = fixture(t),
    store = f.create();
  const first = await store.save({
      ...input,
      kind: "home-assistant",
      token: "neutral-token-A",
      expectedRevision: null,
    }),
    before = fs.readFileSync(f.file),
    rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === f.file) throw Error("Injected publication failure");
    return rename(from, to);
  };
  try {
    await assert.rejects(
      store.save({
        ...input,
        id: first.entries[0].id,
        kind: "home-assistant",
        token: "neutral-token-B",
        expectedRevision: first.revision,
      }),
    );
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(fs.readFileSync(f.file).equals(before), true);
  assert.equal(f.writes.length, 2);
  assert.equal(f.values.get(f.writes[0].reference), "neutral-token-A");
  assert.equal(f.values.get(f.writes[1].reference), "neutral-token-B");
  assert.equal((await store.list()).revision, first.revision);
});

test("enrollment inventory reaches exact bound without pruning and rejects further additions", async (t) => {
  const f = fixture(t),
    store = f.create();
  let saved = { revision: null };
  for (let n = 0; n < 32; n++)
    saved = await store.save({
      ...input,
      origin: "https://source" + n + ".example",
      expectedRevision: saved.revision,
    });
  assert.equal(saved.entries.length, 32);
  await assert.rejects(
    store.save({
      ...input,
      origin: "https://overflow.example",
      expectedRevision: saved.revision,
    }),
    { code: "SCHEDULE_ENROLLMENTS_LIMIT" },
  );
  assert.equal((await store.list()).entries.length, 32);
  saved = await store.save({
    ...input,
    id: saved.entries[0].id,
    origin: saved.entries[0].origin,
    label: "Updated retained entry",
    expectedRevision: saved.revision,
  });
  assert.equal(saved.entries.length, 32);
});

test("live enrollment changes and failed reads revoke prior actual HTTPS generations without setup sockets", async (t) => {
  const https = await import("node:https"),
    { execFileSync } = await import("node:child_process"),
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "enrollment-live-"));
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
  const cert = fs.readFileSync(path.join(directory, "cert.pem"));
  let requests = 0,
    queries = 0,
    hold = false,
    heldResponse;
  const server = https.createServer(
    { key: fs.readFileSync(path.join(directory, "key.pem")), cert },
    (req, res) => {
      requests++;
      res.setHeader("content-type", "application/json");
      if (hold) {
        heldResponse = res;
        return;
      }
      res.end(
        JSON.stringify({
          schemaVersion: 1,
          status: "ready",
          values: { language: "bilingual" },
        }),
      );
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "https://localhost:" + server.address().port,
    profile = path.join(directory, "profile"),
    service = createSchedulePreferencesService({
      directory: profile,
      profileId: "desktop",
      tickMs: 60000,
      trustedCa: cert,
      lookup: async () => {
        queries++;
        return [{ address: "127.0.0.1", family: 4 }];
      },
      sourceEnrollments: [
        {
          origin,
          kind: "https",
          privateAddresses: [],
          developmentLoopback: true,
          credentialReference: null,
        },
      ],
      baseReader: async () => ({
        language: "en",
        "appearance.profile": null,
        "appearance.theme": "system",
      }),
    });
  t.after(async () => {
    service.close();
    heldResponse?.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await service.start();
  const local = {
      id: "local",
      label: "Local",
      enabled: true,
      priority: 0,
      startDate: null,
      endDate: null,
      startTime: "00:00",
      endTime: "00:00",
      days: { type: "everyday" },
      values: { language: "zh-HK" },
      source: { type: "local" },
    },
    remote = {
      ...local,
      id: "remote",
      priority: 5,
      values: { language: "bilingual" },
      source: {
        type: "https",
        url: origin + "/v1/settings",
        refreshMs: 30000,
        timeoutMs: 2000,
        maxResponseBytes: 4096,
      },
    };
  await service.replace({
    document: {
      schemaVersion: 1,
      revision: 0,
      timeZone: "UTC",
      rules: [local, remote],
    },
    expectedRevision: null,
  });
  assert.equal(
    (await service.refresh()).effective.values.language,
    "bilingual",
  );
  assert.equal(requests, 1);
  const saved = await service.enrollmentSave({
    ...input,
    expectedRevision: null,
  });
  assert.equal(requests, 1);
  assert.equal(queries, 1);
  assert.equal(service.status().effective.values.language, "zh-HK");
  hold = true;
  const pending = service.refresh();
  for (let n = 0; !heldResponse && n < 100; n++)
    await new Promise((resolve) => setTimeout(resolve, 2));
  assert.ok(heldResponse);
  fs.writeFileSync(
    path.join(profile, "schedule-sources-desktop.json"),
    "corrupt",
  );
  await assert.rejects(service.enrollmentList());
  await pending;
  assert.equal(service.status().available, true);
  assert.equal(service.status().externalAvailable, false);
  assert.equal(service.status().effective.values.language, "zh-HK");
  assert.equal(
    service.status().effective.issues[0].code,
    "SOURCE_ENROLLMENTS_UNAVAILABLE",
  );
  assert.equal((await service.read()).rules.length, 2);
  assert.equal(
    JSON.stringify(service.status()).includes(saved.entries[0].origin),
    false,
  );
});

test("closing during pending credential write rejects publication and releases only its owned mutation lock", async (t) => {
  const f = fixture(t);
  let release, began;
  const barrier = new Promise((resolve) => (release = resolve)),
    started = new Promise((resolve) => (began = resolve)),
    write = f.vault.write;
  f.vault.write = async (...args) => {
    const ref = await write(...args);
    began();
    await barrier;
    return ref;
  };
  const store = f.create(),
    pending = store.save({
      ...input,
      kind: "home-assistant",
      token: "neutral-token",
      expectedRevision: null,
    });
  await started;
  store.close();
  release();
  await assert.rejects(pending, { code: "UNAUTHORIZED" });
  assert.equal(fs.existsSync(f.file + ".lock"), false);
  const restarted = f.create();
  assert.equal((await restarted.list()).entries.length, 0);
  assert.equal(
    (await restarted.save({ ...input, expectedRevision: null })).entries.length,
    1,
  );
});

test("service can change and remove persisted unenrolled origins without network authority", async (t) => {
  const f = fixture(t);
  let queries = 0;
  const service = createSchedulePreferencesService({
    directory: f.directory,
    profileId: "desktop",
    vault: f.vault,
    clock: () => Date.parse("2026-10-15T12:00:00Z"),
    lookup: async () => {
      queries++;
      throw Error("Unexpected network lookup");
    },
    baseReader: async () => ({ language: "en", "appearance.profile": null, "appearance.theme": "system" }),
  });
  t.after(() => service.close());
  await service.start();
  const rule = {
    id: "remote",
    label: "Remote",
    enabled: true,
    priority: 0,
    startDate: null,
    endDate: null,
    startTime: "00:00",
    endTime: "00:00",
    days: { type: "everyday" },
    values: { language: "bilingual" },
    source: {
      type: "https",
      url: "https://settings.example/v1",
      refreshMs: 30000,
      timeoutMs: 100,
      maxResponseBytes: 4096,
    },
  };
  let saved = await service.replace({
    document: { schemaVersion: 1, revision: 0, timeZone: "UTC", rules: [rule] },
    expectedRevision: null,
  });
  saved = await service.replace({
    document: {
      ...saved,
      rules: [
        {
          ...rule,
          source: { ...rule.source, url: "https://replacement.example/v1" },
        },
      ],
    },
    expectedRevision: saved.revision,
  });
  assert.equal(saved.revision, 1);
  assert.equal(
    (await service.read()).rules[0].source.url,
    "https://replacement.example/v1",
  );
  const status = await service.refresh();
  assert.equal(status.effective.issues[0].code, "SOURCE_NOT_ENROLLED");
  assert.equal(status.effective.values.language, "en");
  saved = await service.replace({
    document: { ...saved, rules: [] },
    expectedRevision: saved.revision,
  });
  assert.equal(saved.revision, 2);
  assert.deepEqual((await service.read()).rules, []);
  assert.equal((await service.refresh()).effective.issues.length, 0);
  assert.equal(queries, 0);
  assert.equal(service.status().externalAvailable, false);
});
