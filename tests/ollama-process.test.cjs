"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough, Writable } = require("node:stream");
const {
  createWindowsOllamaProcessAdapter,
} = require("../src/main/tools/ollama-process.cjs");
function nativeProtocolFixture({
  wrongPid = false,
  active = 0,
  wrongPath = false,
  splitUtf8 = false,
} = {}) {
  const calls = [];
  let launch,
    ended = false;
  const helper = new EventEmitter();
  helper.stdout = new PassThrough();
  helper.stderr = new PassThrough();
  const reply = (value) => {
    const bytes = Buffer.from(JSON.stringify(value) + "\n", "utf8");
    if (splitUtf8) {
      for (let offset = 0; offset < bytes.length; offset++)
        helper.stdout.write(bytes.subarray(offset, offset + 1));
    } else helper.stdout.write(bytes);
  };
  function cleanup() {
    if (ended) return;
    ended = true;
    reply({
      type: "cleanup",
      nonce: launch.nonce,
      pid: 42,
      creation: "123456789",
      settled: true,
      active: 0,
    });
    setImmediate(() => helper.emit("close", 0, null));
  }
  let pending = "";
  helper.stdin = new Writable({
    write(chunk, _encoding, done) {
      pending += chunk;
      let at;
      while ((at = pending.indexOf("\n")) >= 0) {
        const request = JSON.parse(pending.slice(0, at));
        pending = pending.slice(at + 1);
        calls.push(request);
        if (request.action === "launch") {
          launch = request;
          queueMicrotask(() =>
            reply({
              type: "started",
              nonce: request.nonce,
              pid: 42,
              creation: "123456789",
              executable: wrongPath
                ? "C:\\unrelated\\ollama.exe"
                : request.executable,
            }),
          );
        }
        if (request.action === "verify")
          queueMicrotask(() =>
            reply({
              type: "verified",
              id: request.id,
              nonce: request.nonce,
              pid: wrongPid ? 99 : 42,
              creation: "123456789",
              verified: true,
            }),
          );
        if (request.action === "stop")
          queueMicrotask(() => {
            reply({
              type: "stopped",
              id: request.id,
              nonce: request.nonce,
              pid: 42,
              creation: "123456789",
              settled: active === 0,
              active,
            });
            if (active === 0) cleanup();
          });
      }
      done();
    },
  });
  helper.stdin.once("finish", () => cleanup());
  const adapter = createWindowsOllamaProcessAdapter({
    platform: "win32",
    systemRoot: "C:\\Windows",
    spawnImpl: (file, args, options) => {
      assert.equal(
        file,
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      );
      assert.equal(options.shell, false);
      assert.ok(args.includes("-NoProfile"));
      assert.ok(!args.includes("-ExecutionPolicy"));
      return helper;
    },
  });
  return { adapter, calls, helper, setActive: (value) => (active = value) };
}
const launchOptions = {
  executable: "C:\\Owned\\versions\\ollama.exe",
  directory: "C:\\Owned\\versions",
  models: "C:\\Owned\\models",
  members: [{ path: "ollama.exe", length: 1, sha256: "0".repeat(64) }],
};
test("Windows process protocol fixture binds exact identity, checks listener and serializes owned stop", async () => {
  const fixture = nativeProtocolFixture();
  const { child } = await fixture.adapter.launch(launchOptions);
  assert.equal(child.pid, 42);
  assert.equal(
    (
      await fixture.adapter.verifyListener({
        pid: 42,
        host: "127.0.0.1",
        port: 11434,
      })
    ).verified,
    true,
  );
  await assert.rejects(
    fixture.adapter.stopOwnedTree({ pid: 42, child: new EventEmitter() }),
    { code: "OWNED_PROCESS_HANDLE_MISMATCH" },
  );
  const results = await Promise.all([
    fixture.adapter.stopOwnedTree({ pid: 42, child }),
    fixture.adapter.stopOwnedTree({ pid: 42, child }),
  ]);
  assert.equal(results[0].settled, true);
  assert.equal(results[1].settled, true);
  assert.equal(
    fixture.calls.filter((call) => call.action === "stop").length,
    1,
  );
  await fixture.adapter.dispose();
});
test("Windows protocol fixture refuses PID reuse and wrong launch image", async () => {
  const wrong = nativeProtocolFixture({ wrongPid: true });
  const { child } = await wrong.adapter.launch(launchOptions);
  await assert.rejects(
    wrong.adapter.verifyListener({ pid: 42, host: "127.0.0.1", port: 11434 }),
    { code: "NATIVE_PROCESS_IDENTITY_MISMATCH" },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    (await wrong.adapter.stopOwnedTree({ pid: 42, child })).settled,
    true,
  );
  const image = nativeProtocolFixture({ wrongPath: true });
  await assert.rejects(image.adapter.launch(launchOptions), {
    code: "NATIVE_PROCESS_IDENTITY_MISMATCH",
  });
});
test("Windows protocol fixture refuses unproved job settlement and retains ownership for retry", async () => {
  const fixture = nativeProtocolFixture({ active: 1 });
  const { child } = await fixture.adapter.launch(launchOptions);
  await assert.rejects(fixture.adapter.stopOwnedTree({ pid: 42, child }), {
    code: "OWNED_PROCESS_STOP_UNVERIFIED",
  });
  fixture.setActive(0);
  assert.equal(
    (await fixture.adapter.stopOwnedTree({ pid: 42, child })).settled,
    true,
  );
});
test("Windows protocol fixture aborts retained helper and verifies native cleanup", async () => {
  const fixture = nativeProtocolFixture(),
    abort = new AbortController();
  const { child } = await fixture.adapter.launch({
    ...launchOptions,
    signal: abort.signal,
  });
  abort.abort();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    (await fixture.adapter.stopOwnedTree({ pid: 42, child })).settled,
    true,
  );
});
test("native adapter is unavailable on Linux without explicit fixture injection", () => {
  if (process.platform !== "win32")
    assert.throws(() => createWindowsOllamaProcessAdapter(), {
      code: "WINDOWS_PROCESS_ADAPTER_UNAVAILABLE",
    });
});
test("Windows protocol fixture settles launch racing with disposal without adopting a process", async () => {
  const fixture = nativeProtocolFixture();
  const pending = fixture.adapter.launch(launchOptions);
  const rejected = assert.rejects(pending, { code: "SERVICE_DISPOSED" });
  await fixture.adapter.dispose();
  await rejected;
  await assert.rejects(fixture.adapter.launch(launchOptions), {
    code: "SERVICE_DISPOSED",
  });
});

test("Windows protocol fixture preserves Unicode identity across split UTF-8 byte chunks", async () => {
  const fixture = nativeProtocolFixture({ splitUtf8: true });
  const options = {
    ...launchOptions,
    directory: "C:\\用戶\\廣東話\\versions",
    executable: "C:\\用戶\\廣東話\\versions\\ollama.exe",
    models: "C:\\用戶\\廣東話\\models",
  };
  const { child } = await fixture.adapter.launch(options);
  assert.equal(fixture.calls[0].executable, options.executable);
  assert.equal(
    (
      await fixture.adapter.verifyListener({
        pid: child.pid,
        host: "127.0.0.1",
        port: 11434,
      })
    ).verified,
    true,
  );
  assert.equal(
    (await fixture.adapter.stopOwnedTree({ pid: child.pid, child })).settled,
    true,
  );
});
