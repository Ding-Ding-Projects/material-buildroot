"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ExecutionService,
  boundedProcess,
} = require("../src/main/execution/index.cjs");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "execution-"));
  const source = path.join(root, "source"),
    output = path.join(root, "output");
  fs.mkdirSync(source);
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(source, "Makefile"), "all:\n\t@echo built\n");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, source, output, trustedSource: true };
}
test("execution rejects untrusted source, escaping and aliased directories", (t) => {
  const service = new ExecutionService(),
    dirs = fixture(t);
  assert.throws(
    () => service.grantProject({ ...dirs, trustedSource: false }),
    /consent/,
  );
  assert.throws(
    () => service.grantProject({ ...dirs, output: os.tmpdir() }),
    /boundary/,
  );
  const special = path.join(dirs.root, "output$(id)");
  fs.mkdirSync(special);
  assert.throws(
    () => service.grantProject({ ...dirs, output: special }),
    /unsupported-build-path/,
  );
  const alias = path.join(dirs.root, "alias");
  fs.symlinkSync(os.tmpdir(), alias);
  assert.throws(
    () => service.grantProject({ ...dirs, output: alias }),
    /boundary/,
  );
  assert.throws(
    () => service.grantProject({ ...dirs, output: dirs.source }),
    /boundary/,
  );
});
test("execution rejects arbitrary targets, fields and root fixture execution", async (t) => {
  const service = new ExecutionService({ linuxFixture: true }),
    grant = service.grantProject(fixture(t));
  for (const target of ["all;touch /tmp/unsafe", "--eval=x", "clean"])
    await assert.rejects(
      service.start({
        grantId: grant.grantId,
        target,
        runtime: { kind: "linux-fixture" },
      }),
      /invalid/,
    );
  await assert.rejects(
    service.start({ grantId: grant.grantId, target: "all", command: "id" }),
    /unknown/,
  );
  if (process.getuid?.() === 0)
    await assert.rejects(
      service.start({
        grantId: grant.grantId,
        target: "all",
        runtime: { kind: "linux-fixture" },
      }),
      /non-root/,
    );
});
test("process runner preserves argv without shell interpretation and bounds output", async () => {
  const value = "$(touch /tmp/not-executed); `id`";
  const result = await boundedProcess(process.execPath, [
    "-e",
    "process.stdout.write(process.argv[1])",
    value,
  ]).completion;
  assert.equal(result.stdout, value);
  assert.equal(result.state, "succeeded");
  const large = await boundedProcess(
    process.execPath,
    [
      "-e",
      'process.stdout.write("x".repeat(100000)); setInterval(()=>{},1000)',
    ],
    { maxBytes: 64 },
  ).completion;
  assert.equal(large.state, "output-limit");
  assert.equal(large.stdout, "");
});
test("process runner times out and cancellation owns a Linux process group", async () => {
  const timeout = await boundedProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    { timeoutMs: 50 },
  ).completion;
  assert.equal(timeout.state, "timed-out");
  const job = boundedProcess(process.execPath, [
    "-e",
    'require("child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"inherit"});setInterval(()=>{},1000)',
  ]);
  setTimeout(() => job.cancel(), 100);
  assert.equal((await job.completion).state, "cancelled");
});
test("discovery returns missing tools explicitly without provisioning", async () => {
  const result = await new ExecutionService({
    executables: { docker: "/nonexistent/material-docker" },
  }).discover();
  assert.equal(result.docker.available, false);
  assert.equal(result.docker.state, "unavailable");
});
test("granted source alias replacement is rejected at execution", async (t) => {
  const service = new ExecutionService({ linuxFixture: true }),
    dirs = fixture(t),
    grant = service.grantProject(dirs);
  fs.renameSync(dirs.source, path.join(dirs.root, "previous"));
  fs.symlinkSync(os.tmpdir(), dirs.source);
  await assert.rejects(
    service.start({
      grantId: grant.grantId,
      target: "all",
      runtime: { kind: "linux-fixture" },
    }),
    /changed/,
  );
});
test(
  "a real non-root Linux fixture builds separate output and streams logs",
  { skip: process.platform === "win32" },
  async (t) => {
    const dirs = fixture(t);
    fs.chmodSync(dirs.root, 0o755);
    fs.chmodSync(dirs.output, 0o777);
    fs.writeFileSync(
      path.join(dirs.source, "Makefile"),
      'all:\n\t@printf "fixture-output" > "$(O)/image.txt"\n\t@echo fixture-built\n',
    );
    const script = `const {ExecutionService}=require(${JSON.stringify(require.resolve("../src/main/execution/index.cjs"))});(async()=>{const s=new ExecutionService({linuxFixture:true});const g=s.grantProject(${JSON.stringify(dirs)});const j=await s.start({grantId:g.grantId,target:'all',runtime:{kind:'linux-fixture'}},e=>process.stdout.write(e.text));const r=await j.completion;if(r.state!=='succeeded')throw Error(JSON.stringify(r));})().catch(e=>{console.error(e);process.exitCode=1});`;
    const result =
      process.getuid() === 0
        ? await boundedProcess("/usr/sbin/runuser", [
            "-u",
            "nobody",
            "--",
            process.execPath,
            "-e",
            script,
          ]).completion
        : await boundedProcess(process.execPath, ["-e", script]).completion;
    assert.equal(result.state, "succeeded", result.stderr);
    assert.match(result.stdout, /fixture-built/);
    assert.equal(
      fs.readFileSync(path.join(dirs.output, "image.txt"), "utf8"),
      "fixture-output",
    );
    assert.equal(fs.existsSync(path.join(dirs.source, "image.txt")), false);
  },
);
test("Docker launcher uses pinned non-root isolated argv and rejects floating images", async (t) => {
  const dirs = fixture(t),
    executable = path.join(dirs.root, "docker-fixture");
  fs.writeFileSync(
    executable,
    "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify(process.argv.slice(2)));\n",
  );
  fs.chmodSync(executable, 0o755);
  const service = new ExecutionService({ executables: { docker: executable } }),
    grant = service.grantProject(dirs);
  await assert.rejects(
    service.start({
      grantId: grant.grantId,
      target: "all",
      runtime: { kind: "docker", image: "build:latest", uid: 1000, gid: 1000 },
    }),
    /runtime/,
  );
  await assert.rejects(
    service.start({
      grantId: grant.grantId,
      target: "all",
      runtime: {
        kind: "docker",
        image: "build@sha256:" + "a".repeat(64),
        uid: 0,
        gid: 1000,
      },
    }),
    /runtime/,
  );
  const job = await service.start({
    grantId: grant.grantId,
    target: "all",
    runtime: {
      kind: "docker",
      image: "build@sha256:" + "a".repeat(64),
      uid: 1000,
      gid: 1000,
    },
  });
  const result = await job.completion;
  assert.equal(result.state, "succeeded");
  const argv = JSON.parse(result.stdout);
  assert.ok(argv.includes("--network=none"));
  assert.equal(argv[argv.indexOf("--user") + 1], "1000:1000");
  assert.ok(argv.includes(`type=bind,src=${dirs.source},dst=/source,readonly`));
  assert.ok(!argv.some((value) => value.includes("docker.sock")));
});
test("termination cleanup failure remains explicit", async () => {
  const job = boundedProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    {
      onTerminate: async () => {
        throw Error("fixture");
      },
    },
  );
  job.cancel();
  assert.equal((await job.completion).state, "runtime-cleanup-failed");
});
function externalTree(root, name) {
  const tree = path.join(root, name);
  fs.mkdirSync(tree);
  for (const [file, content] of Object.entries({
    "external.desc": `name: ${name}\ndesc: Fixture\n`,
    "Config.in": "# Fixture\n",
    "external.mk": "# Fixture\n",
  }))
    fs.writeFileSync(path.join(tree, file), content);
  return tree;
}
test("external grants require explicit trust, bounded unique paths and ordinary descriptors", (t) => {
  const dirs = fixture(t),
    tree = externalTree(dirs.root, "externalA"),
    service = new ExecutionService();
  const original = service.grantProject(dirs);
  assert.throws(
    () => service.grantProject({ ...dirs, externalTrees: [tree] }),
    /external-execution-consent/,
  );
  assert.throws(
    () =>
      service.grantProject({
        ...dirs,
        externalTrees: [tree, tree],
        trustedExternalTrees: true,
      }),
    /duplicate-external/,
  );
  assert.throws(
    () =>
      service.grantProject({
        ...dirs,
        externalTrees: Array(33).fill(tree),
        trustedExternalTrees: true,
      }),
    /invalid-external/,
  );
  const alias = path.join(dirs.root, "externalAlias");
  fs.symlinkSync(tree, alias);
  assert.throws(
    () =>
      service.grantProject({
        ...dirs,
        externalTrees: [alias],
        trustedExternalTrees: true,
      }),
    /unsupported-external/,
  );
  fs.unlinkSync(path.join(tree, "Config.in"));
  fs.symlinkSync(path.join(tree, "external.mk"), path.join(tree, "Config.in"));
  assert.throws(
    () =>
      service.grantProject({
        ...dirs,
        externalTrees: [tree],
        trustedExternalTrees: true,
      }),
    /descriptor/,
  );
  assert.ok(service.grants.has(original.grantId));
  assert.deepEqual(service.grants.get(original.grantId).external, []);
});
test("external descriptor replacement or deletion invalidates execution before launch", async (t) => {
  const dirs = fixture(t),
    tree = externalTree(dirs.root, "externalA"),
    service = new ExecutionService();
  const grant = service.grantProject({
    ...dirs,
    externalTrees: [tree],
    trustedExternalTrees: true,
  });
  fs.renameSync(path.join(tree, "external.mk"), path.join(tree, "previous.mk"));
  fs.writeFileSync(path.join(tree, "external.mk"), "# replaced");
  await assert.rejects(
    service.start({
      grantId: grant.grantId,
      target: "all",
      runtime: { kind: "docker" },
    }),
    /external-path-changed/,
  );
  fs.unlinkSync(path.join(tree, "external.mk"));
  await assert.rejects(
    service.start({
      grantId: grant.grantId,
      target: "all",
      runtime: { kind: "docker" },
    }),
    /external-path-changed/,
  );
});
test("Docker preserves external tree order using separate read-only mounts and one positional list", async (t) => {
  const dirs = fixture(t),
    first = externalTree(dirs.root, "externalA"),
    second = externalTree(dirs.root, "externalB");
  const executable = path.join(dirs.root, "docker-externals-fixture");
  fs.writeFileSync(
    executable,
    "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify(process.argv.slice(2)));\n",
  );
  fs.chmodSync(executable, 0o755);
  const service = new ExecutionService({ executables: { docker: executable } });
  const grant = service.grantProject({
    ...dirs,
    externalTrees: [second, first],
    trustedExternalTrees: true,
  });
  const job = await service.start({
    grantId: grant.grantId,
    target: "all",
    runtime: {
      kind: "docker",
      image: "build@sha256:" + "a".repeat(64),
      uid: 1000,
      gid: 1000,
    },
  });
  const argv = JSON.parse((await job.completion).stdout);
  assert.ok(argv.includes(`type=bind,src=${second},dst=/external/0,readonly`));
  assert.ok(argv.includes(`type=bind,src=${first},dst=/external/1,readonly`));
  assert.equal(argv.at(-1), "/external/0:/external/1");
  assert.ok(argv.some((value) => value.includes('"BR2_EXTERNAL=$5"')));
});
test(
  "real non-root Linux make receives ordered external trees without changing descriptors",
  { skip: process.platform === "win32" },
  async (t) => {
    const dirs = fixture(t),
      first = externalTree(dirs.root, "externalA"),
      second = externalTree(dirs.root, "externalB");
    fs.chmodSync(dirs.root, 0o755);
    fs.chmodSync(dirs.output, 0o777);
    fs.writeFileSync(
      path.join(dirs.source, "Makefile"),
      'all:\n\t@printf "%s" "$(BR2_EXTERNAL)" > "$(O)/externals.txt"\n',
    );
    const script = `const {ExecutionService}=require(${JSON.stringify(require.resolve("../src/main/execution/index.cjs"))});(async()=>{const s=new ExecutionService({linuxFixture:true});const g=s.grantProject(${JSON.stringify({ ...dirs, externalTrees: [second, first], trustedExternalTrees: true })});const j=await s.start({grantId:g.grantId,target:'all',runtime:{kind:'linux-fixture'}});const r=await j.completion;if(r.state!=='succeeded')throw Error(JSON.stringify(r));})().catch(e=>{console.error(e);process.exitCode=1});`;
    const result =
      process.getuid() === 0
        ? await boundedProcess("/usr/sbin/runuser", [
            "-u",
            "nobody",
            "--",
            process.execPath,
            "-e",
            script,
          ]).completion
        : await boundedProcess(process.execPath, ["-e", script]).completion;
    assert.equal(result.state, "succeeded", result.stderr);
    assert.equal(
      fs.readFileSync(path.join(dirs.output, "externals.txt"), "utf8"),
      `${second}:${first}`,
    );
    assert.equal(
      fs.readFileSync(path.join(first, "external.mk"), "utf8"),
      "# Fixture\n",
    );
  },
);
test("environment probe uses pinned isolated Docker argv and normalizes bounded results", async (t) => {
  const dirs = fixture(t),
    executable = path.join(dirs.root, "docker-environment-fixture"),
    record = path.join(dirs.root, "argv.json");
  fs.writeFileSync(
    executable,
    '#!/usr/bin/env node\nrequire("fs").writeFileSync(' +
      JSON.stringify(record) +
      ',JSON.stringify(process.argv.slice(2)));process.stdout.write("x86_64-linux-gnu\\n12.2.0\\n");\n',
  );
  fs.chmodSync(executable, 0o755);
  const service = new ExecutionService({ executables: { docker: executable } }),
    grant = service.grantProject(dirs);
  const runtime = {
    kind: "docker",
    image: "build@sha256:" + "a".repeat(64),
    uid: 1000,
    gid: 1000,
  };
  assert.deepEqual(
    await service.probeEnvironment({ grantId: grant.grantId, runtime }),
    { hostArchitecture: "x86_64", hostGccVersion: "12.2.0" },
  );
  const argv = JSON.parse(fs.readFileSync(record, "utf8"));
  for (const option of [
    "--pull=never",
    "--read-only",
    "--network=none",
    "--cap-drop=ALL",
  ])
    assert.ok(argv.includes(option));
  assert.equal(argv[argv.indexOf("--user") + 1], "1000:1000");
  assert.ok(!argv.includes("--mount"));
  assert.match(
    argv.at(-1),
    /gcc -dumpmachine; gcc -dumpfullversion -dumpversion/,
  );
  await assert.rejects(
    service.probeEnvironment({
      grantId: grant.grantId,
      runtime,
      command: "id",
    }),
    /invalid-environment-probe/,
  );
  await assert.rejects(
    service.probeEnvironment({
      grantId: grant.grantId,
      runtime: { ...runtime, uid: 0 },
    }),
    /invalid-container-runtime/,
  );
  fs.writeFileSync(
    executable,
    '#!/usr/bin/env node\nprocess.stdout.write("x86_64\\n12.2.0\\nextra\\n");\n',
  );
  await assert.rejects(
    service.probeEnvironment({ grantId: grant.grantId, runtime }),
    /invalid-environment-output/,
  );
});
test(
  "real Linux environment probe observes actual compiler as non-root and rejects stale grants",
  { skip: process.platform === "win32" },
  async (t) => {
    const dirs = fixture(t);
    fs.chmodSync(dirs.root, 0o755);
    const script = `const {ExecutionService}=require(${JSON.stringify(require.resolve("../src/main/execution/index.cjs"))});(async()=>{const s=new ExecutionService({linuxFixture:true});const g=s.grantProject(${JSON.stringify(dirs)});process.stdout.write(JSON.stringify(await s.probeEnvironment({grantId:g.grantId,runtime:{kind:'linux-fixture'}})));})().catch(e=>{console.error(e);process.exitCode=1});`;
    const result =
      process.getuid() === 0
        ? await boundedProcess("/usr/sbin/runuser", [
            "-u",
            "nobody",
            "--",
            process.execPath,
            "-e",
            script,
          ]).completion
        : await boundedProcess(process.execPath, ["-e", script]).completion;
    assert.equal(result.state, "succeeded", result.stderr);
    const environment = JSON.parse(result.stdout);
    assert.match(environment.hostArchitecture, /^[a-z0-9_][a-z0-9_.-]*$/);
    assert.match(environment.hostGccVersion, /^\d+(?:\.\d+)*$/);
    const service = new ExecutionService({ linuxFixture: true }),
      grant = service.grantProject(dirs);
    if (process.getuid() === 0)
      await assert.rejects(
        service.probeEnvironment({
          grantId: grant.grantId,
          runtime: { kind: "linux-fixture" },
        }),
        /non-root-required/,
      );
    service.revoke(grant.grantId);
    await assert.rejects(
      service.probeEnvironment({
        grantId: grant.grantId,
        runtime: { kind: "linux-fixture" },
      }),
      /grant-unavailable/,
    );
  },
);

test("compiler target architecture follows Buildroot normalization independently of the kernel", async (t) => {
  const dirs = fixture(t),
    executable = path.join(dirs.root, "compiler-target-fixture");
  const service = new ExecutionService({ executables: { docker: executable } }),
    grant = service.grantProject(dirs);
  const runtime = {
    kind: "docker",
    image: "build@sha256:" + "a".repeat(64),
    uid: 1000,
    gid: 1000,
  };
  for (const [target, expected] of [
    ["i386-linux-gnu", "x86"],
    ["i686-linux-gnu", "x86"],
    ["sun4u-linux-gnu", "sparc64"],
    ["armv7l-linux-gnueabihf", "arm"],
    ["sa110-linux-gnu", "arm"],
    ["ppc64-linux-gnu", "powerpc64"],
    ["ppc-linux-gnu", "powerpc"],
    ["macppc-linux-gnu", "powerpc"],
    ["sh4-linux-gnu", "sh"],
    ["aarch64-linux-gnu", "aarch64"],
    ["x86_64-linux-gnu", "x86_64"],
    ["riscv64-linux-gnu", "riscv64"],
  ]) {
    fs.writeFileSync(
      executable,
      "#!/usr/bin/env node\nprocess.stdout.write(" +
        JSON.stringify(target + "\n13.3.0\n") +
        ");\n",
    );
    fs.chmodSync(executable, 0o755);
    const result = await service.probeEnvironment({
      grantId: grant.grantId,
      runtime,
    });
    assert.equal(result.hostArchitecture, expected, target);
    assert.equal(result.hostGccVersion, "13.3.0");
  }
});
test('resource probe uses read-only output mount and preserves explicitly unknown measurements', async t => {
  const dirs = fixture(t), executable = path.join(dirs.root, 'docker-resources-fixture'), record = path.join(dirs.root, 'resource-argv.json');
  fs.writeFileSync(executable, '#!/usr/bin/env node\nrequire("fs").writeFileSync(' + JSON.stringify(record) + ',JSON.stringify(process.argv.slice(2)));process.stdout.write("2\\n2048\\n4096\\n");\n'); fs.chmodSync(executable, 0o755);
  const service = new ExecutionService({ executables: { docker: executable } }), grant = service.grantProject(dirs), runtime = { kind: 'docker', image: 'build@sha256:' + 'a'.repeat(64), uid: 1000, gid: 1000 };
  const result = await service.probeResources({ grantId: grant.grantId, runtime }); assert.equal(result.cpuSlots, 2); assert.equal(result.memoryAvailableBytes, 2048); assert.equal(result.storageAvailableBytes, 4096); assert.equal(result.constraintModel, 'cgroup-v2-and-affinity');
  const argv = JSON.parse(fs.readFileSync(record, 'utf8')); assert.ok(argv.includes(`type=bind,src=${dirs.output},dst=/output,readonly`)); assert.ok(argv.includes('--read-only')); assert.ok(argv.includes('--network=none')); assert.ok(argv.some(value => value.includes('memory.current')));
  fs.writeFileSync(executable, '#!/usr/bin/env node\nprocess.stdout.write("unknown\\nunknown\\n4096\\n");\n'); const unknown = await service.probeResources({ grantId: grant.grantId, runtime }); assert.equal(unknown.cpuSlots, null); assert.equal(unknown.memoryAvailableBytes, null); assert.equal(unknown.constraintModel, 'unknown');
  await assert.rejects(service.probeResources({ grantId: grant.grantId, runtime, script: 'id' }), /invalid-resource-probe/);
});
test('real non-root Linux resources probe reports available filesystem bytes without modifying output', { skip: process.platform === 'win32' }, async t => {
  const dirs = fixture(t); fs.chmodSync(dirs.root, 0o755);
  const script = `const {ExecutionService}=require(${JSON.stringify(require.resolve('../src/main/execution/index.cjs'))});(async()=>{const s=new ExecutionService({linuxFixture:true});const g=s.grantProject(${JSON.stringify(dirs)});process.stdout.write(JSON.stringify(await s.probeResources({grantId:g.grantId,runtime:{kind:'linux-fixture'}})));})().catch(e=>{console.error(e);process.exitCode=1});`;
  const result = process.getuid() === 0 ? await boundedProcess('/usr/sbin/runuser', ['-u', 'nobody', '--', process.execPath, '-e', script]).completion : await boundedProcess(process.execPath, ['-e', script]).completion;
  assert.equal(result.state, 'succeeded', result.stderr); const resources = JSON.parse(result.stdout); assert.ok(Number.isSafeInteger(resources.storageAvailableBytes)); assert.ok(resources.storageAvailableBytes >= 0); assert.ok(resources.cpuSlots === null || Number.isSafeInteger(resources.cpuSlots)); assert.deepEqual(fs.readdirSync(dirs.output), []);
});
test('Docker aggregate probe excludes only its verified owned leaf and preserves parent constraints', async t => {
  const dirs = fixture(t); fs.chmodSync(dirs.root, 0o755);
  const cgroupRoot = path.join(dirs.root, 'cgroups'), parent = path.join(cgroupRoot, 'parent'), leaf = path.join(parent, 'leaf'); fs.mkdirSync(leaf, { recursive: true });
  function metrics(directory, cpu, maximum, current) { fs.writeFileSync(path.join(directory, 'cpu.max'), cpu + '\n'); fs.writeFileSync(path.join(directory, 'memory.max'), maximum + '\n'); fs.writeFileSync(path.join(directory, 'memory.current'), current + '\n'); }
  metrics(cgroupRoot, 'max 100000', 'max', '0'); metrics(parent, '400000 100000', '8589934592', '1073741824'); metrics(leaf, '200000 100000', '4294967296', '104857600');
  const groupFile = path.join(dirs.root, 'self-cgroup'), statusFile = path.join(dirs.root, 'self-status'), memoryFile = path.join(dirs.root, 'meminfo');
  fs.writeFileSync(groupFile, '0::/parent/leaf\n'); fs.writeFileSync(statusFile, 'Cpus_allowed_list:\t0-7\n'); fs.writeFileSync(memoryFile, 'MemAvailable: 16777216 kB\n');
  const source = fs.readFileSync(require.resolve('../src/main/execution/index.cjs'), 'utf8');
  const script = source.match(/const RESOURCE_SCRIPT = `([\s\S]*?)`;/)[1].replaceAll('/proc/self/cgroup', groupFile).replaceAll('/proc/self/status', statusFile).replaceAll('/proc/meminfo', memoryFile).replaceAll('/sys/fs/cgroup', cgroupRoot);
  const probe = async mode => {
    const args = ['-c', script, 'resources', dirs.output, mode];
    const result = process.getuid() === 0 ? await boundedProcess('/usr/sbin/runuser', ['-u', 'nobody', '--', '/bin/sh', ...args]).completion : await boundedProcess('/bin/sh', args).completion;
    assert.equal(result.state, 'succeeded', result.stderr); return result.stdout.trim().split('\n').slice(0, 2);
  };
  assert.deepEqual(await probe('docker-owned-probe'), ['4', '7516192768']);
  assert.deepEqual(await probe('runtime'), ['2', '4190109696']);
  for (const file of ['cpu.max', 'memory.max', 'memory.current']) fs.unlinkSync(path.join(cgroupRoot, file));
  fs.writeFileSync(path.join(cgroupRoot, 'cgroup.controllers'), 'cpu memory\n');
  assert.deepEqual(await probe('docker-owned-probe'), ['4', '7516192768']);
  metrics(parent, '100000 100000', '3221225472', '1073741824');
  assert.deepEqual(await probe('docker-owned-probe'), ['1', '2147483648']);
  metrics(leaf, '100000 100000', '4294967296', '104857600');
  assert.deepEqual(await probe('docker-owned-probe'), ['unknown', 'unknown']);
  fs.writeFileSync(groupFile, '0::/\n');
  assert.deepEqual(await probe('docker-owned-probe'), ['unknown', 'unknown']);
});
