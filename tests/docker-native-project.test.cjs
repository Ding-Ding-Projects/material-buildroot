"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), crypto = require("node:crypto");
const source = require.resolve("../src/main/execution/docker-native-project.cjs");
const constants = require(source);
function fixture() {
  const calls = [], volumes = new Map(); let daemon = "fixture-daemon";
  const archivePath = path.resolve("fixture-native-source.tar.gz");
  const seal = { uid: 1000, gid: 1000, identities: { source: [1, 2, 1000, 1000], output: [1, 3, 1000, 1000], cache: [1, 4, 1000, 1000] }, source: { sha256: "a".repeat(64), entries: 10, bytes: 100 }, configurationSha256: "b".repeat(64), configurationBytes: 100 };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(source, "utf8"), { module, exports: module.exports, __dirname: path.dirname(source), Buffer, structuredClone,
    require: name => name === "node:fs" ? { ...fs, lstatSync: file => file === archivePath ? { isFile: () => true, isSymbolicLink: () => false, nlink: 1, size: 15 } : fs.lstatSync(file), readFileSync: (file, options) => file === archivePath ? Buffer.from("fixture-archive") : fs.readFileSync(file, options) } : name === "node:crypto" ? { ...crypto, createHash: () => { let value; return { update(input) { value = input; return this; }, digest() { return String(value) === "fixture-archive" ? constants.ARCHIVE : crypto.createHash("sha256").update(value).digest("hex"); } }; } } : require(name) });
  const service = module.exports.createNativeDockerProjects({ identity: async () => daemon, checkpoint: async (callback, receipt) => callback?.(receipt), cleanup: { stop: async () => {}, inspect: async () => ({ state: "verified-stopped" }) },
    run: (args, options) => {
      calls.push({ args, options }); let stdout = "";
      if (args[0] === "volume" && args[1] === "create") { const name = args.at(-1), Labels = {}; args.forEach((value, index) => { if (value === "--label") { const [key, content] = args[index + 1].split("="); Labels[key] = content; } }); volumes.set(name, { Name: name, Driver: "local", Options: {}, Labels }); stdout = name; }
      if (args[0] === "volume" && args[1] === "inspect") stdout = JSON.stringify([volumes.get(args[2])]);
      if (args[0] === "run" && args.includes("python3")) stdout = JSON.stringify(seal);
      if (args[0] === "run" && args.includes("acquired")) stdout = JSON.stringify({ workspace: seal, cache: { sha256: "c".repeat(64), entries: 1, bytes: 10 } });
      if (args[0] === "run" && args.includes("readmit")) stdout = JSON.stringify({ ...seal, cache: { sha256: "c".repeat(64), entries: 1, bytes: 10 } });
      return { completion: Promise.resolve({ state: "succeeded", code: 0, stdout, stderr: "" }), cancel() {} };
    } });
  return { service, calls, volumes, archivePath, changeDaemon: () => { daemon = "another-daemon"; } };
}
test("native workspace requires source consent and rejects forged receipts before containers", async () => {
  const f = fixture();
  await assert.rejects(f.service.prepare({ archivePath: f.archivePath, profile: constants.PROFILE, consent: false }), { code: "native-docker-consent-required" });
  await assert.rejects(f.service.validate({}, { kind: "docker", image: constants.IMAGE, uid: 1000, gid: 1000 }), { code: "native-docker-authority-required" });
  assert.equal(f.calls.length, 0);
});
test("native volume labels, pinned source and runtime bind immutable admission", async () => {
  const f = fixture(), receipt = await f.service.prepare({ archivePath: f.archivePath, profile: constants.PROFILE, consent: true });
  assert.equal(Object.isFrozen(receipt.seal.identities.source), true); assert.equal(Object.isFrozen(receipt.volumes.source), true);
  const runtime = { kind: "docker", image: constants.IMAGE, uid: 1000, gid: 1000 };
  await assert.rejects(f.service.validate(receipt, { ...runtime, uid: 0 }), { code: "native-docker-authority-required" });
  const volume = f.volumes.get(receipt.volumes.source.name); volume.Labels["io.material-buildroot.role"] = "output";
  await assert.rejects(f.service.validate(receipt, runtime), { code: "native-docker-volume-changed" });
  volume.Labels["io.material-buildroot.role"] = "source"; f.changeDaemon();
  await assert.rejects(f.service.validate(receipt, runtime), { code: "native-docker-authority-required" });
});
test("only explicit acquisition gets network while full firmware execution stays offline and non-root", async () => {
  const f = fixture(), receipt = await f.service.prepare({ archivePath: f.archivePath, profile: constants.PROFILE, consent: true });
  const runtime = { kind: "docker", image: constants.IMAGE, uid: 1000, gid: 1000 };
  await assert.rejects(f.service.acquire(receipt, { consent: false }), { code: "native-docker-cache-consent-required" });
  await assert.rejects(f.service.start(receipt, runtime, "source", 2), { code: "native-docker-build-request-invalid" });
  await assert.rejects(f.service.start(receipt, runtime, "all", 2), { code: "native-docker-configuration-required" });
  await (await f.service.start(receipt, runtime, "olddefconfig", 2)).completion;
  await assert.rejects(f.service.start(receipt, runtime, "all", 2), { code: "native-docker-cache-acquisition-required" });
  await (await f.service.acquire(receipt, { consent: true })).completion;
  await (await f.service.start(receipt, runtime, "all", 2)).completion;
  const build = f.calls.find(call => call.args.includes("native-build") && call.args.at(-1) === "all"); assert.ok(build);
  assert.equal(build.args.includes("--network=none"), true); assert.equal(build.args.includes("--network=bridge"), false);
  assert.equal(build.args[build.args.indexOf("--user") + 1], "1000:1000");
  assert.equal(build.args.some(value => value === `type=volume,src=${receipt.volumes.source.name},dst=/source,readonly`), true);
  const networked = f.calls.filter(call => call.args.includes("--network=bridge")); assert.equal(networked.length, 1); assert.equal(networked[0].args.includes("native-cache-acquire"), true);
  assert.equal(networked[0].args.includes("--privileged"), false);
});
test("saved metadata needs fresh archive-backed consented admission, never a deserialized authority token", async () => {
  const f = fixture(), original = await f.service.prepare({ archivePath: f.archivePath, profile: constants.PROFILE, consent: true });
  const metadata = structuredClone(original), runtime = { kind: "docker", image: constants.IMAGE, uid: 1000, gid: 1000 };
  await assert.rejects(f.service.validate(metadata, runtime), { code: "native-docker-authority-required" });
  await assert.rejects(f.service.readmit({ metadata, archivePath: f.archivePath, configurationSha256: "b".repeat(64), consent: false }), { code: "native-docker-recovery-consent-required" });
  const changed = structuredClone(metadata); changed.volumes.source.name = "unrelated-volume";
  await assert.rejects(f.service.readmit({ metadata: changed, archivePath: f.archivePath, configurationSha256: "b".repeat(64), consent: true }), { code: "native-docker-volume-changed" });
  const receipt = await f.service.readmit({ metadata, archivePath: f.archivePath, configurationSha256: "b".repeat(64), consent: true });
  assert.equal(Object.isFrozen(receipt), true); assert.equal(f.service.isReceipt(receipt), true);
  assert.ok(f.calls.some(call => call.args.includes("readmit") && call.args.includes("--network=none")));
});
test("ExecutionService dispatches admitted native grants without pretending opaque volume identities are host paths", async () => {
  const { ExecutionService } = require("../src/main/execution/index.cjs");
  const service = new ExecutionService(), calls = [];
  const grant = { nativeDockerReceipt: {}, root: "docker-native:fixture", source: "docker-native:fixture:source", output: "docker-native:fixture:output", external: [], identities: {} };
  service.grants.set("native", grant);
  service.nativeDocker = { start: async (receipt, runtime, target, jobs, options) => {
    calls.push({ receipt, runtime, target, jobs });
    await options.onOwnership({ version: 1, kind: "docker", ownerToken: "01234567-89ab-4def-8123-456789abcdef", containerName: "material-buildroot-01234567-89ab-4def-8123-456789abcdef", daemonId: "fixture" });
    return { completion: Promise.resolve({ state: "succeeded", code: 0, cleanup: { state: "verified-stopped" } }), cancel: async () => ({ state: "cancelled" }) };
  } };
  const job = await service.start({ grantId: "native", runtime: { kind: "docker", image: constants.IMAGE, uid: 1000, gid: 1000 }, target: "all", jobs: 2 });
  assert.equal((await job.completion).state, "succeeded"); assert.equal(calls.length, 1); assert.equal(calls[0].target, "all"); assert.equal(service.locks.size, 0);
  await assert.rejects(service.start({ grantId: "native", runtime: {}, target: "all", jobs: 2 }, undefined, { onOwnership: () => service.revoke("native") }), /grant-unavailable/);
  assert.equal(service.locks.size, 0);
});
