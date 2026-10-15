"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { createBuildQuarantine } = require("../src/main/jobs/quarantine.cjs");
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "build-recovery-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const validateReceipt = (receipt) =>
    assert.deepEqual(Object.keys(receipt), ["ownerToken"]);
  return {
    directory,
    file: path.join(directory, "runtime-recovery.json"),
    create: () => createBuildQuarantine({ directory, validateReceipt }),
  };
}
test("pending ownership survives restart and only explicit clearing releases a record", (t) => {
  const f = fixture(t),
    registry = f.create(),
    jobId = randomUUID(),
    workspaceId = randomUUID();
  assert.equal(registry.initialized, false);
  registry.initialize();
  registry.begin({ jobId, workspaceId });
  assert.equal(f.create().list()[0].receipt, null);
  const receipt = { ownerToken: randomUUID() };
  registry.checkpoint(jobId, receipt);
  assert.deepEqual(f.create().list()[0].receipt, receipt);
  const copy = registry.list();
  copy[0].workspaceId = "changed";
  assert.equal(registry.list()[0].workspaceId, workspaceId);
  registry.clear(jobId);
  assert.deepEqual(f.create().list(), []);
  assert.equal(f.create().initialized, true);
});
test("foreign and malformed recovery data are preserved without replacement", (t) => {
  const f = fixture(t);
  for (const text of [
    '{"version":2,"records":[]}',
    '{"version":1,"records":[],"foreign":true}',
    '{"version":1,"records":[{"__proto__":{}}]}',
    "broken",
  ]) {
    fs.writeFileSync(f.file, text);
    assert.throws(() => f.create());
    assert.equal(fs.readFileSync(f.file, "utf8"), text);
  }
});
test("recovery storage refuses symbolic links, multiple links and replaced parent identity", (t) => {
  const f = fixture(t),
    outside = path.join(f.directory, "outside");
  fs.writeFileSync(outside, '{"version":1,"records":[]}');
  fs.symlinkSync(outside, f.file);
  assert.throws(() => f.create());
  fs.unlinkSync(f.file);
  fs.linkSync(outside, f.file);
  assert.throws(() => f.create());
  fs.unlinkSync(f.file);
  const registry = f.create();
  registry.initialize();
  const moved = f.directory + "-old";
  fs.renameSync(f.directory, moved);
  fs.mkdirSync(f.directory);
  try {
    assert.throws(() =>
      registry.begin({ jobId: randomUUID(), workspaceId: randomUUID() }),
    );
  } finally {
    fs.rmSync(moved, { recursive: true, force: true });
  }
});
test("unknown disk edits and invalid receipts never overwrite existing recovery records", (t) => {
  const f = fixture(t),
    registry = f.create(),
    jobId = randomUUID(),
    workspaceId = randomUUID();
  registry.begin({ jobId, workspaceId });
  const before = fs.readFileSync(f.file, "utf8");
  assert.throws(() => registry.checkpoint(jobId, { path: "/untrusted" }));
  assert.equal(fs.readFileSync(f.file, "utf8"), before);
  fs.writeFileSync(f.file, '{"version":1,"records":[]}');
  assert.throws(() => registry.clear(jobId));
  assert.equal(fs.readFileSync(f.file, "utf8"), '{"version":1,"records":[]}');
});

test("failed atomic publication preserves the previous recovery record", (t) => {
  const f = fixture(t),
    registry = f.create(),
    jobId = randomUUID(),
    workspaceId = randomUUID();
  registry.begin({ jobId, workspaceId });
  const before = fs.readFileSync(f.file, "utf8"),
    rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === f.file)
      throw Object.assign(Error("fixture publication unavailable"), {
        code: "EIO",
      });
    return rename(from, to);
  };
  try {
    assert.throws(() => registry.clear(jobId));
  } finally {
    fs.renameSync = rename;
  }
  assert.equal(fs.readFileSync(f.file, "utf8"), before);
  assert.equal(registry.list().length, 1);
  assert.deepEqual(fs.readdirSync(f.directory), ["runtime-recovery.json"]);
});

test("duplicate recovery keys including escaped aliases are rejected without replacing bytes", (t) => {
  const f = fixture(t),
    jobId = randomUUID(),
    workspaceId = randomUUID();
  const record = `{"jobId":"${jobId}","workspaceId":"${workspaceId}","receipt":null,"createdAt":"2026-10-15T00:00:00.000Z"}`;
  for (const text of [
    '{"version":1,"version":1,"records":[]}',
    `{"version":1,"records":[${record.replace('"workspaceId":', `"workspaceId":"${workspaceId}","workspaceId":`)}]}`,
    '{"version":1,"\\u0076ersion":1,"records":[]}',
  ]) {
    fs.writeFileSync(f.file, text);
    assert.throws(() => f.create(), { code: "QUARANTINE_UNAVAILABLE" });
    assert.equal(fs.readFileSync(f.file, "utf8"), text);
  }
});
