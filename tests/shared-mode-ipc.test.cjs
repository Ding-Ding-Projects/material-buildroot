"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { EventEmitter } = require("node:events");
const {
  createSharedModeIPC,
} = require("../src/main/privacy/shared-mode-ipc.cjs");
const revision = "01234567-89ab-4def-8123-456789abcdef";
const snapshot = {
  available: true,
  watching: true,
  configured: true,
  active: false,
  displayName: "Study preference",
  revision,
  credentialKind: "pin",
};
test("shared preference IPC admits only the exact document and bounded declared operations", async () => {
  let admitted = false,
    calls = 0;
  const ipc = createSharedModeIPC({
    desktop: { admitted: () => admitted },
    service: {
      status() {
        calls++;
        return snapshot;
      },
    },
  });
  const send = (value) =>
    ipc.request({}, typeof value === "string" ? value : JSON.stringify(value));
  assert.equal((await send({ action: "status" })).code, "UNAUTHORIZED");
  assert.equal(calls, 0);
  admitted = true;
  for (const request of [
    "{",
    '{"action":"status","action":"status"}',
    '{"action":"status","act\\u0069on":"status"}',
    { action: "status", path: "unexpected" },
    { action: "unknown" },
    { action: "enter", expectedRevision: "old" },
    { action: "rename", expectedRevision: revision, displayName: "\u0000" },
    { action: "initialize", displayName: "" },
    { action: "initialize", displayName: "界".repeat(6000) },
    {
      action: "enroll",
      expectedRevision: revision,
      kind: "passkey",
      secret: "",
      confirmation: "",
    },
  ]) {
    assert.equal((await send(request)).code, "INVALID_REQUEST");
  }
  assert.equal(calls, 0);
  assert.deepEqual(await send({ action: "status" }), {
    ok: true,
    result: snapshot,
  });
});
test("shared preference credentials reach only their declared service consumer without response echo", async () => {
  const calls = [];
  const service = {
    enrollCredential(input) {
      calls.push(["enroll", input]);
      return snapshot;
    },
    leave(input) {
      calls.push(["leave", input]);
      return snapshot;
    },
    recovery() {
      return {
        directory: "selected private directory",
        record: "selected record",
        disclosure: "Reset information",
      };
    },
    close() {
      calls.push(["close"]);
    },
  };
  const ipc = createSharedModeIPC({
    desktop: { admitted: () => true },
    service,
  });
  const secret = "generated-test-secret",
    currentSecret = "generated-prior-secret";
  const reply = await ipc.request(
    {},
    JSON.stringify({
      action: "enroll",
      expectedRevision: revision,
      kind: "password",
      secret,
      confirmation: secret,
      currentSecret,
    }),
  );
  assert.equal(reply.ok, true);
  assert.equal(JSON.stringify(reply).includes(secret), false);
  assert.deepEqual(calls[0], [
    "enroll",
    {
      expectedRevision: revision,
      kind: "password",
      secret,
      confirmation: secret,
      current: { secret: currentSecret },
    },
  ]);
  assert.equal(
    (
      await ipc.request(
        {},
        JSON.stringify({ action: "leave", expectedRevision: revision, secret }),
      )
    ).ok,
    true,
  );
  assert.deepEqual(calls[1], ["leave", { expectedRevision: revision, secret }]);
  assert.equal(
    (await ipc.request({}, '{"action":"recovery"}')).result.disclosure,
    "Reset information",
  );
  ipc.close();
  assert.equal(
    (await ipc.request({}, '{"action":"status"}')).code,
    "UNAVAILABLE",
  );
});
test("shared preference IPC hides host error details and rechecks document authority after await", async () => {
  let admitted = true,
    finish;
  const service = {
    reload: () => new Promise((resolve) => (finish = resolve)),
    status() {
      throw Object.assign(Error("private host details"), {
        code: "PRIVATE_HOST_DETAIL",
      });
    },
    enter() {
      throw Object.assign(Error("private verification detail"), {
        code: "VERIFICATION_FAILED",
      });
    },
  };
  const ipc = createSharedModeIPC({
    desktop: { admitted: () => admitted },
    service,
  });
  assert.deepEqual(await ipc.request({}, '{"action":"status"}'), {
    ok: false,
    code: "UNAVAILABLE",
  });
  assert.deepEqual(
    await ipc.request(
      {},
      JSON.stringify({ action: "enter", expectedRevision: revision }),
    ),
    { ok: false, code: "VERIFICATION_FAILED" },
  );
  const waiting = ipc.request({}, '{"action":"reload"}');
  admitted = false;
  finish(snapshot);
  assert.deepEqual(await waiting, { ok: false, code: "UNAUTHORIZED" });
  admitted = true;
  let reject;
  service.reload = () =>
    new Promise((_resolve, rejectPromise) => (reject = rejectPromise));
  const rejected = ipc.request({}, '{"action":"reload"}');
  admitted = false;
  reject(
    Object.assign(Error("private detail"), { code: "VERIFICATION_FAILED" }),
  );
  assert.deepEqual(await rejected, { ok: false, code: "UNAUTHORIZED" });
});
test("shared preference preload emits only bounded public snapshots and removes its own listener", async () => {
  let api;
  const ipc = new EventEmitter(),
    calls = [];
  ipc.invoke = async (...args) => {
    calls.push(args);
    return { ok: true, result: snapshot };
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../src/main/preload.cjs"), "utf8"),
    {
      require: () => ({
        ipcRenderer: ipc,
        contextBridge: { exposeInMainWorld: (_name, value) => (api = value) },
      }),
    },
  );
  const events = [],
    other = () => {};
  ipc.on("studio:shared-mode:event", other);
  const off = api.onSharedMode((value) => events.push(value));
  for (const value of [
    { ...snapshot, secret: "unexpected" },
    { ...snapshot, reference: "unexpected" },
    { ...snapshot, displayName: "x".repeat(97) },
    { ...snapshot, available: false },
    { ...snapshot, displayName: "\u0000" },
    { ...snapshot, configured: false, active: true, revision: null },
    { ...snapshot, displayName: null },
    { ...snapshot, revision: null },
    { ...snapshot, active: true, credentialKind: null },
    { ...snapshot, configured: false },
  ])
    ipc.emit("studio:shared-mode:event", {}, value);
  assert.equal(events.length, 0);
  ipc.emit("studio:shared-mode:event", {}, snapshot);
  ipc.emit(
    "studio:shared-mode:event",
    {},
    {
      ...snapshot,
      available: false,
      watching: false,
      configured: null,
      active: null,
      revision: null,
      credentialKind: null,
    },
  );
  assert.equal(events.length, 2);
  assert.ok(Object.isFrozen(events[0]));
  off();
  off();
  assert.equal(ipc.listenerCount("studio:shared-mode:event"), 1);
  assert.equal(
    (await api.sharedMode({ action: "status", oversized: "x".repeat(16385) }))
      .code,
    "INVALID_REQUEST",
  );
  const circular = {};
  circular.self = circular;
  assert.equal((await api.sharedMode(circular)).code, "INVALID_REQUEST");
  await api.sharedMode({ action: "status" });
  await api.sharedModeRecovery();
  assert.deepEqual(
    calls.map((row) => [row[0], JSON.parse(row[1]).action]),
    [
      ["studio:shared-mode", "status"],
      ["studio:shared-mode", "recovery"],
    ],
  );
});
