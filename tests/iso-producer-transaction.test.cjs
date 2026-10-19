"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { createIsoProducerTransactions } = require("../src/main/execution/iso-producer-transaction.cjs");
const { createIsoOutputPolicy } = require("../src/main/jobs/iso-output-policy.cjs");
const HASH = "a".repeat(64), JOB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function faultedFactory(target, operation) {
  const vm = require("node:vm"), Module = require("node:module"), descriptors = new Map();
  const faultyFs = { ...fs,
    openSync(file, ...args) { const fd = fs.openSync(file, ...args); descriptors.set(fd, String(file)); return fd; },
    closeSync(fd) { descriptors.delete(fd); return fs.closeSync(fd); },
    [operation](fd, ...args) {
      if (descriptors.get(fd)?.endsWith(target)) throw Object.assign(Error("injected storage failure"), { code: "EIO" });
      return fs[operation](fd, ...args);
    },
  };
  function load(relative, replacement) {
    const filename = require.resolve(relative), module = { exports: {} };
    vm.runInThisContext(Module.wrap(fs.readFileSync(filename, "utf8")), { filename })(module.exports, replacement, module, filename, path.dirname(filename));
    return module.exports;
  }
  const store = load("../src/main/jobs/iso-transaction-store.cjs", name => name === "node:fs" ? faultyFs : require(name));
  return load("../src/main/execution/iso-producer-transaction.cjs", name => name === "../jobs/iso-transaction-store.cjs" ? store : name === "../jobs/iso-output-policy.cjs" ? require("../src/main/jobs/iso-output-policy.cjs") : name === "./iso-producer-owner.cjs" ? require("../src/main/execution/iso-producer-owner.cjs") : require(name)).createIsoProducerTransactions;
}
function fixture(t, mode = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iso-transaction-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const grant = { root: "root", source: "source", output: "output", wslReceipt: { storage: { distribution: "Fixture" } } };
  const execution = { grants: new Map([["grant", grant]]), locks: new Set() }, calls = [], controller = new AbortController();
  const request = { jobId: JOB, grantId: "grant", runtime: { kind: "wsl", distribution: "Fixture" }, policy: createIsoOutputPolicy({ revision: HASH, profile: "x86_64-bios-grub2-initrd" }) };
  let phase = "initial", service;
  const owner = { kind: "wsl", distribution: "Fixture", pid: 123, startTime: "456" };
  const observation = { state: "prepared-unbound", jobId: JOB, preparationSha256: HASH, prior: mode.stale ? { identity: Array(9).fill("1") } : null, jobBound: false, bootVerified: false };
  const adapters = {
    current: async () => ({ sourceSha256: HASH, projectProofSha256: HASH, configurationSha256: mode.changedConfig && phase === "produced" ? "b".repeat(64) : HASH }),
    validateOwner: value => { assert.equal(value.kind, "wsl"); },
    inspectCleanup: async () => ({ state: mode.unknownCleanup && phase === "produced" ? "unknown" : "verified-stopped" }),
    prepare: async (input, options) => {
      service.assertLease(input.lease, JOB); calls.push("prepare"); await options.onOwnership(owner);
      if (mode.competing) await assert.rejects(service.run({ ...request, jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }), { code: "ISO_TRANSACTION_PROJECT_BUSY" });
      if (mode.crossJob) assert.throws(() => service.assertLease(input.lease, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), { code: "ISO_TRANSACTION_LEASE_REQUIRED" });
      return { state: "succeeded", code: 0, observation };
    },
    produce: async (input, options) => {
      calls.push("produce"); await options.onOwnership({ ...owner, pid: null, startTime: null }); await options.onOwnership(owner); phase = "produced";
      if (mode.crash) throw Error("simulated crash after preparation");
      if (mode.cancel) controller.abort();
      if (mode.changedGrant) execution.grants.set("grant", { ...grant });
      return { state: "succeeded", code: 0 };
    },
    capture: async (input, options) => {
      calls.push("capture"); await options.onOwnership(owner);
      return { state: "succeeded", code: 0, observation: { state: "fresh-file-observed-unbound", jobId: mode.replayedCapture ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" : JOB, preparationSha256: HASH, jobBound: false, producerVerified: false, cleanupVerified: false, bootVerified: false, output: { sha256: HASH, bytes: 51200, identity: Array(9).fill("1"), structure: { descriptorValid: true, withinImage: true, biosCatalogValid: true, bootVerified: false } } } };
    },
  };
  service = (mode.factory || createIsoProducerTransactions)({ execution, directory, adapters });
  const records = () => fs.readdirSync(path.join(directory, JOB)).sort().map(name => JSON.parse(fs.readFileSync(path.join(directory, JOB, name))));
  return { service, request, execution, calls, records, controller, directory, adapters };
}
for (const target of ["active.json", "000000.json"]) for (const operation of ["writeFileSync", "fsyncSync"]) {
  test(`exclusive reservation survives ${target} ${operation} failure`, async t => {
    const f = fixture(t, { factory: faultedFactory(target, operation) });
    await assert.rejects(f.service.run(f.request), { code: "EIO" });
    assert.equal(fs.existsSync(path.join(f.directory, "active.json")), true);
    const jobRoot = path.join(f.directory, JOB);
    assert.equal(fs.existsSync(jobRoot), target !== "active.json");
    if (fs.existsSync(jobRoot)) assert.deepEqual(fs.readdirSync(jobRoot), ["000000.json"]);
    assert.deepEqual(f.calls, []); assert.equal(f.execution.locks.size, 3);
    // An ordinary writer's existing busy check must continue to see these locks.
    assert.equal(["root", "source", "output"].some(root => f.execution.locks.has(root)), true);
    await assert.rejects(f.service.run({ ...f.request, jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }), { code: "ISO_TRANSACTION_PROJECT_BUSY" });
    const freshExecution = { grants: f.execution.grants, locks: new Set() };
    const restarted = createIsoProducerTransactions({ execution: freshExecution, directory: f.directory, adapters: f.adapters });
    await assert.rejects(restarted.run({ ...f.request, jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }), { code: "EEXIST" });
  });
}
test("pre-acquisition conflict releases only the attempted transaction's memory locks", async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.directory, "active.json"), "existing recovery record", { flag: "wx" });
  await assert.rejects(f.service.run(f.request), { code: "EEXIST" });
  assert.equal(f.execution.locks.size, 0); assert.deepEqual(f.calls, []);
  assert.equal(fs.existsSync(path.join(f.directory, JOB)), false);
  assert.equal(fs.readFileSync(path.join(f.directory, "active.json"), "utf8"), "existing recovery record");
});
test("exclusive transaction retains every stage owner, binds output and never claims boot", async t => {
  const f = fixture(t, { competing: true, crossJob: true });
  assert.throws(() => f.service.assertLease({}, JOB), { code: "ISO_TRANSACTION_LEASE_REQUIRED" });
  const result = await f.service.run(f.request);
  assert.equal(result.receipt.jobBound, true); assert.equal(result.receipt.bootVerified, false); assert.equal(Object.isFrozen(result.receipt.output), true);
  assert.deepEqual(f.calls, ["prepare", "produce", "capture"]); assert.equal(f.execution.locks.size, 0);
  assert.deepEqual(f.records().filter(row => row.kind === "ownership").map(row => row.value.stage), ["prepare", "produce", "produce", "capture"]);
  assert.equal(f.records().at(-1).kind, "receipt");
  await assert.rejects(f.service.run(f.request), { code: "EEXIST" });
});
for (const [mode, code, capture] of [["crash", undefined, false], ["unknownCleanup", "ISO_TRANSACTION_CLEANUP_UNVERIFIED", false], ["cancel", "ISO_TRANSACTION_CANCELLED", false], ["changedConfig", "ISO_TRANSACTION_INPUT_CHANGED", false], ["changedGrant", "ISO_TRANSACTION_LEASE_REQUIRED", false], ["stale", "ISO_TRANSACTION_STALE_OUTPUT", true], ["replayedCapture", "ISO_TRANSACTION_OUTPUT_UNVERIFIED", true]]) {
  test(`${mode} retains incomplete evidence without accepting ISO bytes`, async t => {
    const f = fixture(t, { [mode]: true });
    await assert.rejects(f.service.run(f.request, { signal: f.controller.signal }), code ? { code } : /simulated crash/);
    assert.equal(f.calls.includes("capture"), capture); assert.equal(f.records().some(row => row.kind === "receipt"), false);
    assert.equal(f.records().at(-1).kind, "incomplete"); assert.equal(f.execution.locks.size, 3);
    await assert.rejects(f.service.run(f.request), { code: "ISO_TRANSACTION_PROJECT_BUSY" });
    const freshExecution = { grants: f.execution.grants, locks: new Set() };
    const freshAdapters = { ...f.adapters, current: async () => ({ sourceSha256: HASH, projectProofSha256: HASH, configurationSha256: HASH }) };
    const restarted = createIsoProducerTransactions({ execution: freshExecution, directory: f.directory, adapters: freshAdapters });
    await assert.rejects(restarted.run(f.request), { code: "EEXIST" });
    await assert.rejects(restarted.run({ ...f.request, jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }), { code: "EEXIST" });
  });
}
