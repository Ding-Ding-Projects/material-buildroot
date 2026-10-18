"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const IMAGE = "registry.gitlab.com/buildroot.org/buildroot/base@sha256:340aa0de68e8e13e4eca70a00aaf94ec68d3a3891c28f3e7495d844829a8c958";
const ARCHIVE = "33ba6d3f5907e18041a5ed079776cc9269df59703700427f93dc61c3387801c0";
const PROFILE = "buildroot-2025.02-x86_64-bios";
const admitted = new WeakSet();
const fail = code => { throw Object.assign(new Error(code), { code }); };
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
function freeze(value) { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function createNativeDockerProjects({ run, identity, cleanup, checkpoint }) {
  const configurations = new WeakMap();
  const expected = receipt => ({ ...receipt.seal, configurationSha256: configurations.get(receipt)?.sha256 || receipt.seal.configurationSha256, ...(configurations.get(receipt)?.cache ? { cache: configurations.get(receipt).cache } : {}) });
  const helper = () => fs.readFileSync(path.resolve(__dirname, "../../../scripts/configuration/docker-native-workspace.py"), "utf8");
  async function checked(args, options) {
    const result = await run(args, options).completion;
    if (result.state !== "succeeded") fail("native-docker-operation-failed");
    return result.stdout;
  }
  async function validate(receipt, runtime) {
    if (!admitted.has(receipt) || runtime?.kind !== "docker" || runtime.image !== IMAGE || runtime.uid !== 1000 || runtime.gid !== 1000 || await identity() !== receipt.daemonId) fail("native-docker-authority-required");
    for (const [role, volume] of Object.entries(receipt.volumes)) {
      const rows = JSON.parse(await checked(["volume", "inspect", volume.name]));
      const item = rows?.[0];
      if (rows.length !== 1 || item.Name !== volume.name || item.Driver !== "local" || Object.keys(item.Options || {}).length || item.Labels?.["io.material-buildroot.native"] !== volume.key || item.Labels?.["io.material-buildroot.role"] !== role || item.Labels?.["io.material-buildroot.workspace"] !== receipt.id) fail("native-docker-volume-changed");
    }
  }
  function mounts(receipt, sourceWritable = false) {
    return Object.entries(receipt.volumes).flatMap(([role, volume]) => ["--mount", `type=volume,src=${volume.name},dst=/${role}${role === "source" && !sourceWritable ? ",readonly" : ""}`]);
  }
  async function owned(receipt, args, { onLog, onOwnership, timeoutMs = 60000 } = {}) {
    const runtime = { kind: "docker", image: IMAGE, uid: 1000, gid: 1000 };
    await validate(receipt, runtime);
    const ownerToken = crypto.randomUUID(), ownership = { version: 1, kind: "docker", ownerToken, containerName: `material-buildroot-${ownerToken}`, daemonId: receipt.daemonId };
    await checkpoint(onOwnership, ownership);
    const job = run(["run", "--rm", "--pull=never", "--name", ownership.containerName, "--label", `io.material-buildroot.operation=${ownerToken}`, ...args], { timeoutMs, maxBytes: 256 * 1024 * 1024, maxCapturedCharacters: 1024 * 1024, onLog, onTerminate: () => cleanup.stop(ownership) });
    const completion = job.completion.then(async result => { const verdict = await cleanup.inspect(ownership); return { ...result, ...(verdict.state !== "verified-stopped" ? { processState: result.state, state: "runtime-cleanup-failed" } : {}), ownership, cleanup: verdict }; });
    return { ownership, completion, cancel: async () => { job.cancel(); return completion; } };
  }
  function isolation(network = "none") {
    return ["--network=" + network, "--read-only", "--user", "1000:1000", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=512", "--memory=4g", "--cpus=2", "--tmpfs", "/tmp:rw,nosuid,nodev,size=256m"];
  }
  async function inspect(receipt, mode = "verify") {
    const job = await owned(receipt, [...isolation(), ...mounts(receipt), "--entrypoint", "python3", IMAGE, "-I", "-B", "-c", helper(), mode, JSON.stringify(expected(receipt))]);
    const result = await job.completion;
    if (result.state !== "succeeded" || result.cleanup.state !== "verified-stopped") fail("native-docker-verification-failed");
    return JSON.parse(result.stdout);
  }
  async function prepare({ archivePath, profile, consent, onProgress }) {
    if (profile !== PROFILE || consent !== true || typeof archivePath !== "string" || !path.isAbsolute(archivePath) || /[,\0\r\n]/.test(archivePath)) fail("native-docker-consent-required");
    const stat = fs.lstatSync(archivePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 64 * 1024 * 1024 || digest(fs.readFileSync(archivePath)) !== ARCHIVE) fail("native-docker-source-archive-mismatch");
    await checked(["image", "inspect", IMAGE]);
    const id = crypto.randomUUID(), daemonId = await identity(), volumes = {};
    for (const role of ["source", "output", "cache"]) {
      const name = `material-buildroot-native-${id}-${role}`, key = digest(JSON.stringify([id, role, daemonId, IMAGE, ARCHIVE, 1000, 1000]));
      const existing = (await checked(["volume", "ls", "--format", "{{.Name}}", "--filter", `name=^${name}$`])).trim();
      if (existing) fail("native-docker-volume-exists");
      await checked(["volume", "create", "--driver", "local", "--label", `io.material-buildroot.native=${key}`, "--label", `io.material-buildroot.role=${role}`, "--label", `io.material-buildroot.workspace=${id}`, name]);
      volumes[role] = { name, key };
      await onProgress?.({ workspaceId: id, daemonId, phase: "volume-created", volumes: structuredClone(volumes) });
    }
    const receipt = { id, daemonId, image: IMAGE, uid: 1000, gid: 1000, profile, archiveSha256: ARCHIVE, volumes, seal: null };
    admitted.add(receipt);
    await validate(receipt, { kind: "docker", image: IMAGE, uid: 1000, gid: 1000 });
    // Root is used solely to assign the three newly created owned mount roots.
    // Buildroot source/configuration/build commands always use the non-root UID.
    const permissions = await owned(receipt, ["--network=none", "--read-only", "--user", "0:0", "--cap-drop=ALL", "--cap-add=CHOWN", ...mounts(receipt, true), "--entrypoint", "chown", IMAGE, "1000:1000", "/source", "/output", "/cache"]);
    const permissionResult = await permissions.completion;
    if (permissionResult.state !== "succeeded" || permissionResult.cleanup.state !== "verified-stopped") fail("native-docker-permission-setup-failed");
    const job = await owned(receipt, [...isolation(), ...mounts(receipt, true), "--mount", `type=bind,src=${archivePath},dst=/archive.tar.gz,readonly`, "--entrypoint", "python3", IMAGE, "-I", "-B", "-c", helper(), "prepare"]);
    const result = await job.completion;
    if (result.state !== "succeeded" || result.cleanup.state !== "verified-stopped") fail("native-docker-prepare-failed");
    receipt.seal = JSON.parse(result.stdout);
    if (receipt.seal.uid !== 1000 || receipt.seal.gid !== 1000 || !/^[a-f0-9]{64}$/.test(receipt.seal.source?.sha256 || "")) fail("native-docker-prepare-failed");
    configurations.set(receipt, { sha256: receipt.seal.configurationSha256, reconciled: false });
    return freeze(receipt);
  }
  async function readmit({ metadata, archivePath, configurationSha256, consent }) {
    if (consent !== true || !metadata || Object.keys(metadata).sort().join() !== "archiveSha256,daemonId,gid,id,image,profile,seal,uid,volumes" || !/^[a-f0-9-]{36}$/.test(metadata.id || "") || metadata.image !== IMAGE || metadata.profile !== PROFILE || metadata.uid !== 1000 || metadata.gid !== 1000 || metadata.archiveSha256 !== ARCHIVE || !/^[a-f0-9]{64}$/.test(configurationSha256 || "")) fail("native-docker-recovery-consent-required");
    if (typeof archivePath !== "string" || !path.isAbsolute(archivePath) || /[,\0\r\n]/.test(archivePath)) fail("native-docker-source-archive-mismatch");
    const stat = fs.lstatSync(archivePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 64 * 1024 * 1024 || digest(fs.readFileSync(archivePath)) !== ARCHIVE) fail("native-docker-source-archive-mismatch");
    const receipt = structuredClone(metadata), daemonId = await identity();
    if (receipt.daemonId !== daemonId || Object.keys(receipt.volumes || {}).sort().join() !== "cache,output,source") fail("native-docker-volume-changed");
    for (const [role, volume] of Object.entries(receipt.volumes)) {
      if (volume.name !== `material-buildroot-native-${receipt.id}-${role}` || volume.key !== digest(JSON.stringify([receipt.id, role, daemonId, IMAGE, ARCHIVE, 1000, 1000]))) fail("native-docker-volume-changed");
    }
    admitted.add(receipt);
    const job = await owned(receipt, [...isolation(), ...mounts(receipt), "--mount", `type=bind,src=${archivePath},dst=/archive.tar.gz,readonly`, "--entrypoint", "python3", IMAGE, "-I", "-B", "-c", helper(), "readmit", JSON.stringify({ source: receipt.seal.source, configurationSha256 })]);
    const result = await job.completion;
    if (result.state !== "succeeded" || result.cleanup.state !== "verified-stopped") fail("native-docker-recovery-verification-failed");
    receipt.seal = JSON.parse(result.stdout);
    if (receipt.seal.uid !== 1000 || receipt.seal.gid !== 1000 || receipt.seal.configurationSha256 !== configurationSha256 || JSON.stringify(receipt.seal.source) !== JSON.stringify(metadata.seal.source) || !/^[a-f0-9]{64}$/.test(receipt.seal.cache?.sha256 || "")) fail("native-docker-recovery-verification-failed");
    configurations.set(receipt, { sha256: configurationSha256, reconciled: true, cache: receipt.seal.cache });
    return freeze(receipt);
  }
  async function start(receipt, runtime, target, jobs, options = {}) {
    if (!["all", "olddefconfig", "show-info"].includes(target) || !Number.isInteger(jobs) || jobs < 1 || jobs > 8) fail("native-docker-build-request-invalid");
    await validate(receipt, runtime); await inspect(receipt);
    if (target !== "olddefconfig" && !configurations.get(receipt)?.reconciled) fail("native-docker-configuration-required");
    if (target === "all" && !configurations.get(receipt)?.cache) fail("native-docker-cache-acquisition-required");
    const script = 'set -eu; python3 -I -B -c "$1" verify "$2"; exec make -C /source O=/output DL_DIR=/cache "-j$3" "$4"';
    const job = await owned(receipt, [...isolation(), ...mounts(receipt), "--workdir", "/source", "--entrypoint", "/bin/sh", IMAGE, "-c", script, "native-build", helper(), JSON.stringify(expected(receipt)), String(jobs), target], { ...options, timeoutMs: 60 * 60 * 1000 });
    const completion = job.completion.then(async result => {
      if (result.state === "succeeded" && result.cleanup.state === "verified-stopped") {
        const current = await inspect(receipt, target === "olddefconfig" ? "reconciled" : "verify");
        if (target === "olddefconfig") configurations.set(receipt, { ...configurations.get(receipt), sha256: current.configurationSha256, reconciled: true });
      }
      return result;
    });
    return { ...job, completion };
  }
  async function acquire(receipt, { consent, onLog, onOwnership } = {}) {
    if (consent !== true) fail("native-docker-cache-consent-required");
    await inspect(receipt);
    if (!configurations.get(receipt)?.reconciled) fail("native-docker-configuration-required");
    const script = 'set -eu; python3 -I -B -c "$1" verify "$2"; exec make -C /source O=/output DL_DIR=/cache -j2 source';
    // This separately consented acquisition operation is the only networked
    // container. Firmware execution above remains network=none.
    const job = await owned(receipt, [...isolation("bridge"), ...mounts(receipt), "--workdir", "/source", "--entrypoint", "/bin/sh", IMAGE, "-c", script, "native-cache-acquire", helper(), JSON.stringify(expected(receipt))], { onLog, onOwnership, timeoutMs: 60 * 60 * 1000 });
    return { ...job, completion: job.completion.then(async result => { if (result.state === "succeeded" && result.cleanup.state === "verified-stopped") { const current = await inspect(receipt, "acquired"); configurations.set(receipt, { ...configurations.get(receipt), cache: current.cache }); return { ...result, cacheReceipt: current.cache }; } return result; }) };
  }
  return { prepare, readmit, validate, inspect, start, acquire, isReceipt: value => admitted.has(value) };
}
module.exports = { createNativeDockerProjects, IMAGE, PROFILE, ARCHIVE };
