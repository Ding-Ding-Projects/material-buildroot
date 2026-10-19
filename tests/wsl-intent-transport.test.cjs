"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { DEFAULT_LIMITS } = require("../src/main/jobs/build-intent.cjs");
function fixture({ cancel, revoked = false, unavailableCleanup = false } = {}) {
  const root = path.resolve("fixture-native-authority"), source = path.join(root, "source"), output = path.join(root, "output");
  const receipt = { paths: { source, output }, storage: { distribution: "fixture", rootLinux: "/home/fixture/material-buildroot", sourceLinux: "/home/fixture/material-buildroot/source", outputLinux: "/home/fixture/material-buildroot/output" }, proof: "private-identity-proof" };
  const grant = { wslReceipt: receipt }, calls = []; let stopped = false;
  const execution = { grants: new Map([["grant", grant]]), executables: { wsl: "fixture-wsl" }, validateOwnershipReceipt: value => value,
    reconcileCleanup: async owner => { calls.push({ cleanup: owner }); return unavailableCleanup ? { state: "unknown", reason: "runtime-unavailable" } : stopped ? { state: "verified-stopped" } : { state: "unknown", reason: "owned-runtime-active" }; } };
  const boundedProcess = (_file, args, options) => {
    calls.push({ args });
    if (!args.includes("setsid")) { stopped = true; return { completion: Promise.resolve({ state: "succeeded", code: 0 }) }; }
    let finish;
    const completion = new Promise(resolve => { finish = resolve; });
    const owner = { bootId: "01234567-89ab-4def-8123-456789abcdef", pidNamespace: "pid:[123]", pid: 1234, startTime: "98765" };
    const job = { completion, cancel: () => Promise.resolve(options.onTerminate()).then(() => { finish({ state: "cancelled", code: null, stdout: "", stderr: "" }); }),
      writeInput: input => {
        const parsed = JSON.parse(input); calls.push({ request: parsed.request });
        assert.equal(typeof parsed.helper, "string"); assert.equal(parsed.proof, receipt.proof);
        if (cancel) { cancel.abort(); return true; }
        if (revoked) execution.grants.delete("grant");
        stopped = true;
        const result = { sourceRevision: "a".repeat(64), configRevision: "b".repeat(64), snapshot: { version: 3, entries: 2, bytes: 4, excludesGitObjectHistory: true, symlinkPolicy: "internal-content-and-missing-targets", symlinks: 1, limitations: [], limits: DEFAULT_LIMITS, downloadCache: null } };
        queueMicrotask(() => finish({ state: "succeeded", code: 0, stdout: JSON.stringify({ ok: true, result }), stderr: "" })); return true;
      } };
    queueMicrotask(() => options.onLog({ stream: "stderr", text: "MATERIAL_INTENT_OWNER=" + JSON.stringify(owner) + "\n" })); return job;
  };
  const module = { exports: {} };
  const file = require.resolve("../src/main/jobs/wsl-build-intent.cjs");
  vm.runInNewContext(fs.readFileSync(file, "utf8"), { module, exports: module.exports, __dirname: path.dirname(file), Buffer, queueMicrotask,
    require: name => name === "../execution/index.cjs" ? { boundedProcess } : name === "../execution/wsl-project.cjs" ? { verifyWslProject: async () => {} } : require(name.startsWith(".") ? path.resolve(path.dirname(file), name) : name) });
  return { capture: module.exports.captureWslBuildIntent, execution, calls, input: { execution, grantId: "grant", runtime: { kind: "wsl", distribution: "fixture" }, source, output, ...(cancel ? { signal: cancel.signal } : {}) } };
}
test("native transport keeps admitted roots and proves cleanup before accepting a receipt", async () => {
  const f = fixture(); const result = await f.capture(f.input); assert.equal(result.snapshot.version, 3);
  assert.equal(f.calls.some(call => call.args?.includes("--wait")), true);
  assert.equal(f.calls.find(call => call.request).request.source, "/home/fixture/material-buildroot/source");
  assert.equal(f.calls.filter(call => call.cleanup).length, 1);
});
test("native transport cancellation signals only the exact owned session and never accepts content", async () => {
  const controller = new AbortController(), f = fixture({ cancel: controller });
  await assert.rejects(f.capture(f.input), { code: "BLOCKED_CONTENT_CANCELLED" });
  const signal = f.calls.find(call => call.args?.includes("signal")); assert.ok(signal);
  assert.deepEqual(Array.from(signal.args.slice(-4)), ["1234", "98765", "01234567-89ab-4def-8123-456789abcdef", "pid:[123]"]);
});
test("native transport refuses revoked authority and unavailable cleanup", async () => {
  const revoked = fixture({ revoked: true }); await assert.rejects(revoked.capture(revoked.input), { code: "BLOCKED_CONTENT_AUTHORITY" });
  const unavailable = fixture({ unavailableCleanup: true }); await assert.rejects(unavailable.capture(unavailable.input), { code: "BLOCKED_CONTENT_CLEANUP_UNVERIFIED" });
});
test("current-input ownership is durable before helper input and revalidated after checkpoint",async()=>{
 const f=fixture();let release,reached;const ready=new Promise(resolve=>reached=resolve);
 const pending=f.capture({...f.input,onOwnership:async owner=>{assert.equal(owner.pid,1234);reached();await new Promise(resolve=>release=resolve);}});
 await ready;assert.equal(f.calls.some(call=>call.request),false);release();assert.equal((await pending).snapshot.version,3);
 const revoked=fixture();await assert.rejects(revoked.capture({...revoked.input,onOwnership:async()=>revoked.execution.grants.delete("grant")}),{code:"BLOCKED_CONTENT_AUTHORITY"});assert.equal(revoked.calls.some(call=>call.request),false);
 const failed=fixture();await assert.rejects(failed.capture({...failed.input,onOwnership:async()=>{throw Error("durable checkpoint failed");}}),/durable checkpoint failed/);assert.equal(failed.calls.some(call=>call.request),false);
});
