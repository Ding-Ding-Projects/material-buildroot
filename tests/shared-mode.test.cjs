"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const {
  createSharedModeService,
} = require("../src/main/privacy/shared-mode-service.cjs");
const filename = "shared-mode-v1.json";
function setup(t, extra = {}) {
  const sharedDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shared-mode-"),
  );
  const values = new Map();
  const owners = [];
  const vault = {
    async write(owner, secret) {
      owners.push(owner);
      const reference = "vault:" + crypto.randomUUID();
      values.set(reference, secret);
      return reference;
    },
    async read(reference, owner) {
      owners.push(owner);
      if (!values.has(reference)) throw Error("Unavailable");
      return values.get(reference);
    },
  };
  const options = { sharedDirectory, vault, ...extra },
    services = [];
  const create = (overrides) => {
    const service = createSharedModeService({ ...options, ...overrides });
    services.push(service);
    return service;
  };
  t.after(() => {
    for (const service of services) service.close();
    fs.rmSync(sharedDirectory, { recursive: true, force: true });
  });
  return {
    sharedDirectory,
    file: path.join(sharedDirectory, filename),
    create,
    vault,
    values,
    owners,
  };
}
function waitFor(service, predicate, timeout = 2000) {
  if (predicate(service.status())) return Promise.resolve(service.status());
  return new Promise((resolve, reject) => {
    let unsubscribe;
    const timer = setTimeout(() => {
      unsubscribe?.();
      reject(Error("Timed out waiting for shared state"));
    }, timeout);
    unsubscribe = service.subscribe((state) => {
      if (predicate(state)) {
        clearTimeout(timer);
        unsubscribe?.();
        resolve(state);
      }
    });
  });
}
async function initialized(service) {
  await service.start();
  return service.initialize({ displayName: "Study focus" });
}
async function credential(service, revision, extra = {}) {
  return service.enrollCredential({
    expectedRevision: revision,
    kind: "pin",
    secret: "4378",
    confirmation: "4378",
    ...extra,
  });
}

test("two real instances watch enter, exact rename, credential replacement, restart and reset", async (t) => {
  const { create, file, owners } = setup(t);
  const a = create(),
    b = create();
  const initial = await initialized(a);
  await b.start();
  assert.equal(b.status().displayName, "Study focus");
  let current = await credential(a, initial.revision);
  await waitFor(b, (s) => s.revision === current.revision);
  current = await a.enter({ expectedRevision: current.revision });
  await waitFor(b, (s) => s.active === true);
  const renamed = 'Exam room: "revision": readable';
  current = await b.rename({
    expectedRevision: current.revision,
    displayName: renamed,
  });
  await waitFor(a, (s) => s.displayName === renamed);
  assert.equal(a.status().displayName, renamed);
  assert.equal(JSON.stringify(a.status()).includes("reference"), false);
  const old = current.revision;
  await assert.rejects(a.leave({ expectedRevision: old, secret: "0000" }), {
    code: "VERIFICATION_FAILED",
  });
  assert.equal(a.status().active, true);
  current = await a.enrollCredential({
    expectedRevision: old,
    kind: "password",
    secret: "new-local-password",
    confirmation: "new-local-password",
    current: { secret: "4378" },
  });
  await waitFor(b, (s) => s.credentialKind === "password");
  await assert.rejects(
    b.leave({ expectedRevision: current.revision, secret: "4378" }),
    { code: "VERIFICATION_FAILED" },
  );
  current = await b.leave({
    expectedRevision: current.revision,
    secret: "new-local-password",
  });
  await waitFor(a, (s) => s.active === false);
  a.close();
  const restarted = create();
  await restarted.start();
  assert.equal(restarted.status().displayName, renamed);
  assert.equal(restarted.status().credentialKind, "password");
  fs.unlinkSync(file);
  await waitFor(b, (s) => s.available && s.configured === false);
  assert.equal(b.status().displayName, null);
  const reset = await b.initialize({ displayName: "Fresh preference" });
  assert.equal(reset.credentialKind, null);
  assert.equal(reset.active, false);
  assert.ok(owners.every((owner) => owner === "shared_experience_mode_v1"));
});

test("stale revisions and token lock contention preserve committed data", async (t) => {
  const { create, file, sharedDirectory } = setup(t);
  const a = create(),
    b = create();
  let current = await initialized(a);
  await b.start();
  const initial = current.revision;
  current = await credential(a, current.revision);
  await assert.rejects(
    b.rename({ expectedRevision: initial, displayName: "Stale choice" }),
    { code: "STALE_REVISION" },
  );
  const before = fs.readFileSync(file, "utf8"),
    lock = path.join(sharedDirectory, filename + ".lock");
  fs.writeFileSync(lock, "unowned");
  await assert.rejects(a.enter({ expectedRevision: current.revision }), {
    code: "MUTATION_BUSY",
  });
  assert.equal(fs.readFileSync(lock, "utf8"), "unowned");
  assert.equal(fs.readFileSync(file, "utf8"), before);
  fs.unlinkSync(lock);
  assert.equal(
    (await b.enter({ expectedRevision: current.revision })).active,
    true,
  );
});

test("watch failures retry boundedly, preserve chosen name, and never report inactive defaults", async (t) => {
  const watchers = [];
  let calls = 0;
  const factory = () => {
    calls++;
    const watcher = new EventEmitter();
    watcher.close = () => {};
    watchers.push(watcher);
    return watcher;
  };
  const { create } = setup(t, {
    watchFactory: factory,
    watchRetries: 1,
    retryDelayMs: 5,
  });
  const service = create();
  const current = await initialized(service);
  watchers[0].emit("error", Error("private watcher detail"));
  const failed = service.status();
  assert.equal(failed.available, false);
  assert.equal(failed.active, null);
  assert.equal(failed.displayName, "Study focus");
  await assert.rejects(
    service.rename({
      expectedRevision: current.revision,
      displayName: "Later",
    }),
    { code: "WATCH_UNAVAILABLE" },
  );
  await waitFor(service, (s) => s.available);
  assert.equal(calls, 2);
  watchers[1].emit("error", Error("failure"));
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(calls, 2);
  assert.equal(service.status().available, false);
});

test("corrupt, foreign, duplicate, symlink and hardlink records refuse mutations without overwriting", async (t) => {
  const { create, file, sharedDirectory } = setup(t);
  const service = create();
  const state = await initialized(service);
  const valid = fs.readFileSync(file, "utf8");
  for (const invalid of [
    "{",
    JSON.stringify({ protocol: "foreign", schemaVersion: 1 }),
    valid.replace('"active":false', '"active":false,"active":false'),
    valid.replace('"schemaVersion":1', '"schemaVersion":2'),
    valid.replace('"credential":null', '"credential":null,"extra":true'),
  ]) {
    fs.writeFileSync(file, invalid);
    assert.equal((await service.reload()).available, false);
    assert.equal(service.status().displayName, "Study focus");
    await assert.rejects(
      service.rename({
        expectedRevision: state.revision,
        displayName: "Ignored",
      }),
    );
    assert.equal(fs.readFileSync(file, "utf8"), invalid);
  }
  fs.writeFileSync(file, valid);
  assert.equal((await service.reload()).available, true);
  const other = path.join(sharedDirectory, "other");
  fs.renameSync(file, other);
  await require('./helpers/filesystem-links.cjs').fileLinkCase(t,"real symbolic-link shared record",async()=>{
require('./helpers/filesystem-links.cjs').symlinkSync(other, file);
  assert.equal((await service.reload()).available, false);
  await assert.rejects(service.initialize());
  assert.equal(fs.readFileSync(other, "utf8"), valid);
  fs.unlinkSync(file);

});
  fs.linkSync(other, file);
  assert.equal((await service.reload()).available, false);
  fs.unlinkSync(file);
  fs.renameSync(other, file);
  assert.equal((await service.reload()).available, true);
});

test("linked ancestors and directory identity replacement fail closed", async (t) => {
  const { create, sharedDirectory } = setup(t);
  const service = create();
  await initialized(service);
  const link = path.join(sharedDirectory, "alias");
  require('./helpers/filesystem-links.cjs').symlinkSync(sharedDirectory, link, "dir");
  const linked = create({ sharedDirectory: path.join(link, "child") });
  await assert.rejects(linked.start());
  const moved = sharedDirectory + "-moved";
  fs.renameSync(sharedDirectory, moved);
  fs.mkdirSync(sharedDirectory);
  t.after(() => fs.rmSync(moved, { recursive: true, force: true }));
  assert.equal((await service.reload()).available, false);
  await assert.rejects(service.initialize());
});

test("unavailable vault and absent passkey adapter preserve current state", async (t) => {
  const { create, vault, file } = setup(t);
  const service = create();
  let current = await initialized(service);
  await assert.rejects(service.enter({ expectedRevision: current.revision }), {
    code: "CREDENTIAL_REQUIRED",
  });
  await assert.rejects(
    service.enrollCredential({
      expectedRevision: current.revision,
      kind: "passkey",
    }),
    { code: "PASSKEY_UNAVAILABLE" },
  );
  current = await credential(service, current.revision);
  const before = fs.readFileSync(file, "utf8");
  vault.read = async () => {
    throw Error("raw private material");
  };
  await assert.rejects(
    service.leave({ expectedRevision: current.revision, secret: "4378" }),
    (error) =>
      error.code === "VAULT_UNAVAILABLE" &&
      !error.message.includes("raw private material"),
  );
  await assert.rejects(
    service.enrollCredential({
      expectedRevision: current.revision,
      kind: "pin",
      secret: "9999",
      confirmation: "9999",
      current: { secret: "4378" },
    }),
    { code: "VAULT_UNAVAILABLE" },
  );
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.equal(before.includes("secret"), false);
  assert.equal(before.includes("hash"), false);
});

test("another process cannot mutate while a token-owned lock is held", async (t) => {
  const { promisify } = require("node:util"),
    { execFile } = require("node:child_process");
  const { create, vault, sharedDirectory } = setup(t);
  const service = create();
  let current = await initialized(service);
  current = await credential(service, current.revision);
  let release, began;
  const started = new Promise((resolve) => (began = resolve));
  const paused = new Promise((resolve) => (release = resolve)),
    read = vault.read;
  vault.read = async (...args) => {
    began();
    await paused;
    return read(...args);
  };
  const leaving = service.leave({
    expectedRevision: current.revision,
    secret: "4378",
  });
  await started;
  const source = `const {createSharedModeService}=require(${JSON.stringify(require.resolve("../src/main/privacy/shared-mode-service.cjs"))}); (async()=>{const s=createSharedModeService({sharedDirectory:${JSON.stringify(sharedDirectory)},vault:{read(){},write(){}}});await s.start();try{await s.rename({expectedRevision:${JSON.stringify(current.revision)},displayName:'Other process'});process.stdout.write('unexpected');}catch(e){process.stdout.write(e.code);}finally{s.close();}})().catch(()=>process.exitCode=1);`;
  try {
    const result = await promisify(execFile)(process.execPath, ["-e", source], {
      timeout: 3000,
    });
    assert.equal(result.stdout, "MUTATION_BUSY");
  } finally {
    release();
  }
  await leaving;
  assert.equal(service.status().displayName, "Study focus");
});

test("lost lock ownership and persistence failure never overwrite the prior record", async (t) => {
  const { create, vault, sharedDirectory, file } = setup(t);
  const service = create();
  let current = await initialized(service);
  current = await credential(service, current.revision);
  const before = fs.readFileSync(file, "utf8"),
    originalRead = vault.read;
  vault.read = async (...args) => {
    const lock = path.join(sharedDirectory, filename + ".lock");
    fs.unlinkSync(lock);
    fs.writeFileSync(lock, "foreign replacement");
    return originalRead(...args);
  };
  await assert.rejects(
    service.leave({ expectedRevision: current.revision, secret: "4378" }),
    { code: "LOCK_OWNERSHIP_LOST" },
  );
  assert.equal(fs.readFileSync(file, "utf8"), before);
  const lock = path.join(sharedDirectory, filename + ".lock");
  assert.equal(fs.readFileSync(lock, "utf8"), "foreign replacement");
  fs.unlinkSync(lock);
  vault.read = originalRead;
  const rename = fs.renameSync;
  fs.renameSync = () => {
    throw Error("private failure");
  };
  try {
    await assert.rejects(
      service.rename({
        expectedRevision: current.revision,
        displayName: "Uncommitted",
      }),
      (error) =>
        error.code === "STORAGE_UNAVAILABLE" &&
        !error.message.includes("private failure"),
    );
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(fs.readFileSync(file, "utf8"), before);
  assert.equal(service.status().displayName, "Study focus");
  assert.equal(
    fs.readdirSync(sharedDirectory).some((name) => name.endsWith(".tmp")),
    false,
  );
});

test("same-revision external byte edits and inode replacement survive asynchronous verification", async (t) => {
  const { create, vault, file } = setup(t);
  const service = create();
  let current = await initialized(service);
  current = await credential(service, current.revision);
  current = await service.enter({ expectedRevision: current.revision });
  const originalRead = vault.read;
  for (const kind of ["changed-bytes", "same-bytes-new-inode"]) {
    const before = fs.readFileSync(file, "utf8");
    let external;
    vault.read = async (...args) => {
      if (kind === "changed-bytes") {
        const edited = JSON.parse(before);
        edited.displayName = "External exact rename";
        external = JSON.stringify(edited);
        fs.writeFileSync(file, external);
      } else {
        external = before;
        const replacement = file + ".external";
        fs.writeFileSync(replacement, external);
        fs.renameSync(replacement, file);
      }
      return originalRead(...args);
    };
    await assert.rejects(
      service.leave({ expectedRevision: current.revision, secret: "4378" }),
      { code: "STALE_REVISION" },
    );
    assert.equal(fs.readFileSync(file, "utf8"), external);
    assert.equal(JSON.parse(external).active, true);
    vault.read = originalRead;
    await service.reload();
    current = service.status();
  }
});

test("final publication reread catches edits occurring while the temporary file is flushed", async (t) => {
  const { create, file } = setup(t);
  const service = create();
  const current = await initialized(service),
    originalSync = fs.fsyncSync;
  let flushes = 0,
    external;
  fs.fsyncSync = (descriptor) => {
    originalSync(descriptor);
    if (++flushes === 2) {
      const edited = JSON.parse(fs.readFileSync(file, "utf8"));
      edited.displayName = "External during flush";
      external = JSON.stringify(edited);
      fs.writeFileSync(file, external);
    }
  };
  try {
    await assert.rejects(
      service.rename({
        expectedRevision: current.revision,
        displayName: "Uncommitted rename",
      }),
      { code: "STALE_REVISION" },
    );
  } finally {
    fs.fsyncSync = originalSync;
  }
  assert.equal(flushes, 2);
  assert.equal(fs.readFileSync(file, "utf8"), external);
});

test("failed owned lock initialization cleans only its original partial or complete token", async (t) => {
  const { create, file, sharedDirectory } = setup(t);
  const service = create();
  let current = await initialized(service);
  const lock = path.join(sharedDirectory, filename + ".lock"),
    before = fs.readFileSync(file, "utf8");
  const originalSync = fs.fsyncSync;
  fs.fsyncSync = () => {
    throw Error("Injected flush failure");
  };
  try {
    await assert.rejects(
      service.rename({
        expectedRevision: current.revision,
        displayName: "Not committed",
      }),
      { code: "STORAGE_UNAVAILABLE" },
    );
  } finally {
    fs.fsyncSync = originalSync;
  }
  assert.equal(fs.existsSync(lock), false);
  assert.equal(fs.readFileSync(file, "utf8"), before);
  current = await service.rename({
    expectedRevision: current.revision,
    displayName: "Retry succeeded",
  });
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = (descriptor, bytes, ...args) => {
    if (
      typeof descriptor === "number" &&
      typeof bytes === "string" &&
      /^[0-9a-f-]{36}$/.test(bytes)
    ) {
      fs.writeSync(descriptor, bytes.slice(0, 7));
      throw Error("Injected partial token write");
    }
    return originalWrite(descriptor, bytes, ...args);
  };
  try {
    await assert.rejects(
      service.rename({
        expectedRevision: current.revision,
        displayName: "Not committed",
      }),
      { code: "STORAGE_UNAVAILABLE" },
    );
  } finally {
    fs.writeFileSync = originalWrite;
  }
  assert.equal(fs.existsSync(lock), false);
  assert.equal(
    (
      await service.rename({
        expectedRevision: current.revision,
        displayName: "Retry again",
      })
    ).displayName,
    "Retry again",
  );
});

test("failed lock initialization never removes a foreign replacement", async (t) => {
  const { create, sharedDirectory } = setup(t);
  const service = create();
  const current = await initialized(service),
    lock = path.join(sharedDirectory, filename + ".lock"),
    originalSync = fs.fsyncSync;
  fs.fsyncSync = () => {
    fs.unlinkSync(lock);
    fs.writeFileSync(lock, "unowned lock");
    throw Error("Injected lock replacement");
  };
  try {
    await assert.rejects(
      service.rename({
        expectedRevision: current.revision,
        displayName: "Not committed",
      }),
      { code: "STORAGE_UNAVAILABLE" },
    );
  } finally {
    fs.fsyncSync = originalSync;
  }
  assert.equal(fs.readFileSync(lock, "utf8"), "unowned lock");
  await assert.rejects(
    service.rename({
      expectedRevision: current.revision,
      displayName: "Not committed",
    }),
    { code: "MUTATION_BUSY" },
  );
});
