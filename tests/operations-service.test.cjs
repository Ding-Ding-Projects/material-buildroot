"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createOperationsService,
} = require("../src/main/operations-service.cjs");
function fixture(t, { cancelled = false, hold = false, createService = createOperationsService } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "operations-"));
  const root = path.join(directory, "project"),
    source = path.join(root, "source"),
    output = path.join(root, "output");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(source, "Makefile"), "BR2_VERSION = 2025.02.1\n");
  const picks = [root, source, output];
  const calls = [];
  let finish;
  const completion = hold
    ? new Promise((resolve) => {
        finish = () => resolve({ state: "succeeded", code: 0 });
      })
    : Promise.resolve({ state: "succeeded", code: 0 });
  const execution = {
    discover: async () => ({
      docker: { available: false },
      wsl: { distributions: [] },
    }),
    grantProject: (input) => {
      calls.push(input);
      return { grantId: "host-only-grant" };
    },
    probeResources: async () => ({
      cpuSlots: 32,
      memoryAvailableBytes: 32 * 1024 ** 3,
      storageAvailableBytes: 128 * 1024 ** 3,
      observedAt: new Date().toISOString(),
      constraintModel: "cgroup-v2-and-affinity",
    }),
    start: async (input, log) => {
      calls.push(input);
      log?.({ stream: "stdout", text: "actual adapter reply" });
      return { completion, cancel: async () => ({ state: "cancelled" }) };
    },
  };
  const service = createService({
    directory: path.join(directory, "state"),
    dialog: {
      showOpenDialog: async () => ({
        canceled: cancelled,
        filePaths: cancelled ? [] : [picks.shift()],
      }),
    },
    parentWindow: null,
    version: "0.1.0",
    source: null,
    execution,
  });
  t.after(async () => {
    if (hold) finish();
    await service.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return {
    request: (r) => service.request(JSON.stringify(r)),
    calls,
    execution,
    directory,
    service,
    root,
    source,
    output,
    finish,
    picks,
  };
}
test("guided ISO jobs persist exact host output intent while renderer injection and ordinary jobs stay separate", async t => {
  // Keep the real dispatcher, project admission, ISO service and job store.
  // Supply only an inert configuration adapter; no native command is executed.
  const modulePath = require.resolve("../src/main/operations-service.cjs"), nativeRequire = require("node:module").createRequire(modulePath);
  let revision = "a".repeat(64), values = { BR2_x86_64: true, BR2_LINUX_KERNEL: true };
  const names = ["BR2_x86_64", "BR2_LINUX_KERNEL", "BR2_TARGET_GRUB2", "BR2_TARGET_GRUB2_I386_PC", "BR2_TARGET_ROOTFS_ISO9660", "BR2_TARGET_ROOTFS_ISO9660_GRUB2", "BR2_TARGET_ROOTFS_ISO9660_INITRD", "BR2_TARGET_ROOTFS_ISO9660_BOOT_MENU", "BR2_TARGET_GRUB2_BUILTIN_CONFIG_PC", "BR2_TARGET_GRUB2_BOOT_PARTITION", "BR2_TARGET_GRUB2_BUILTIN_MODULES_PC"];
  const configuration = {
    inspect: async () => ({ revision, values, semantics: { available: true, tree: { children: names.map(symbol => ({ symbol, type: /BOOT_MENU|BUILTIN_CONFIG|BOOT_PARTITION|BUILTIN_MODULES/.test(symbol) ? "string" : "bool", value: values[symbol] })) } } }),
    apply: async input => { values = { ...values, ...Object.fromEntries(Object.entries(input.changes).map(([name, change]) => [name, change.value])) }; revision = "b".repeat(64); return { revision, values }; },
  };
  const loaded = { exports: {} };
  require("node:vm").runInThisContext(require("node:module").wrap(fs.readFileSync(modulePath, "utf8")), { filename: modulePath })(loaded.exports,
    name => name === "./configuration/index.cjs" ? { createConfigurationService: () => configuration } : nativeRequire(name), loaded, modulePath, path.dirname(modulePath));
  const f = fixture(t, { createService: loaded.exports.createOperationsService }), chosen = await f.request({ action: "project.choose" });
  const adopted = await f.request({ action: "project.adopt", selectionId: chosen.result.selectionId, trust: true });
  assert.equal(adopted.ok, true); const workspaceId = adopted.result.workspaceId, runtime = { kind: "wsl", distribution: "Fixture" };
  const applied = await f.request({ action: "imagePreset.isoApply", workspaceId, revision });
  assert.equal(applied.ok, true); assert.equal(applied.result.effective, true);
  const request = { action: "imagePreset.isoBuild", workspaceId, revision: applied.result.revision, profile: applied.result.profile, runtime, jobs: 2 };
  const policy = { version: 1, profile: "x86_64-bios-grub2-initrd", appliedConfigurationRevision: revision, path: "images/rootfs.iso9660", freshness: "required", state: "intent-only" };
  for (const extra of [{ isoOutputPolicy: policy }, { path: "other.iso" }, { command: "anything" }]) assert.equal((await f.request({ ...request, ...extra })).code, "INVALID_REQUEST");
  assert.equal((await f.request({ ...request, profile: "other" })).code, "INVALID_REQUEST");
  const submitted = await f.request(request); assert.equal(submitted.ok, true); assert.deepEqual(submitted.result.payload.isoOutputPolicy, policy);
  const file = path.join(f.directory, "state", "jobs", "jobs.json"), saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(saved.jobs.find(job => job.id === submitted.result.id).payload.isoOutputPolicy, policy);
  const ordinary = { action: "build.submit", workspaceId, target: "all", runtime, jobs: 2 };
  assert.equal((await f.request({ ...ordinary, isoOutputPolicy: policy })).code, "INVALID_REQUEST");
  const normal = await f.request(ordinary); assert.equal(normal.ok, true); assert.equal(Object.hasOwn(normal.result.payload, "isoOutputPolicy"), false);
  assert.equal(Object.hasOwn(submitted.result, "freshnessVerified"), false);
});

test("operations reject arbitrary actions, fields, paths and source execution without consent", async (t) => {
  const f = fixture(t);
  for (const request of [
    { action: "execute", command: "anything" },
    { action: "runtime.discover", path: "/tmp" },
    { action: "project.adopt", selectionId: "forged", trust: true },
    { action: "tools", request: { action: "forge.publish" } },
  ])
    assert.equal((await f.request(request)).ok, false);
  const chosen = await f.request({ action: "project.choose" });
  assert.equal(chosen.ok, true);
  assert.equal(
    (
      await f.request({
        action: "project.adopt",
        selectionId: chosen.result.selectionId,
        trust: false,
      })
    ).code,
    "SOURCE_CONSENT_REQUIRED",
  );
  assert.equal(f.calls.length, 0);
  const adopted = await f.request({
    action: "project.adopt",
    selectionId: chosen.result.selectionId,
    trust: true,
  });
  assert.equal(adopted.ok, true);
  assert.equal(f.calls.length, 1);
  assert.equal(
    (
      await f.request({
        action: "project.adopt",
        selectionId: chosen.result.selectionId,
        trust: true,
      })
    ).ok,
    false,
  );
  const forged = await f.request({
    action: "build.submit",
    workspaceId: adopted.result.workspaceId,
    target: "all;id",
    runtime: { kind: "wsl", distribution: "Ubuntu" },
    jobs: 1,
  });
  assert.equal(forged.code, "INVALID_TARGET");
});
test("admitted project routes build output into owned durable job records", async (t) => {
  const f = fixture(t),
    selection = await f.request({ action: "project.choose" }),
    adopted = await f.request({
      action: "project.adopt",
      selectionId: selection.result.selectionId,
      trust: true,
    });
  const result = await f.request({
    action: "build.submit",
    workspaceId: adopted.result.workspaceId,
    target: "all",
    runtime: { kind: "wsl", distribution: "Ubuntu" },
    jobs: 1,
  });
  assert.equal(result.ok, true);
  let list;
  for (let i = 0; i < 20; i++) {
    list = await f.request({ action: "jobs.list" });
    if (list.result[0].state === "succeeded") break;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(list.result[0].state, "succeeded");
  const page = await f.request({
    action: "jobs.page",
    id: result.result.id,
    after: 0,
    limit: 50,
  });
  assert.equal(page.result.records[0].value.text, "actual adapter reply");
  assert.equal(f.calls[1].grantId, "host-only-grant");
});
test("cancelled native picker creates no executable project", async (t) => {
  const f = fixture(t, { cancelled: true });
  assert.equal(
    (await f.request({ action: "project.choose" })).code,
    "CANCELLED",
  );
  assert.equal(f.calls.length, 0);
});

test("official catalogue actions use host-owned storage and reject renderer source overrides", async (t) => {
  const f = fixture(t);
  const status = await f.request({
    action: "tools",
    request: { action: "ollama.catalogue.status" },
  });
  assert.equal(status.ok, true);
  assert.equal(status.result.available, false);
  assert.equal(status.result.revision, null);
  const page = await f.request({
    action: "tools",
    request: {
      action: "ollama.catalogue.page",
      query: "model",
      offset: 0,
      limit: 10,
    },
  });
  assert.equal(page.ok, true);
  assert.deepEqual(page.result.items, []);
  assert.equal(page.result.next, null);
  const cancel = await f.request({
    action: "tools",
    request: { action: "ollama.catalogue.cancel" },
  });
  assert.equal(cancel.ok, true);
  assert.equal(cancel.result.cancelling, false);
  for (const request of [
    { action: "ollama.catalogue.page", limit: 101 },
    { action: "ollama.catalogue.status", directory: "/untrusted" },
    { action: "ollama.catalogue.refresh", url: "https://untrusted.example/" },
    {
      action: "ollama.catalogue.refresh",
      headers: { Authorization: "untrusted" },
    },
  ])
    assert.equal((await f.request({ action: "tools", request })).ok, false);
});
test("running build blocks configuration before any file mutation", async (t) => {
  const f = fixture(t, { hold: true }),
    selection = await f.request({ action: "project.choose" }),
    adopted = await f.request({
      action: "project.adopt",
      selectionId: selection.result.selectionId,
      trust: true,
    });
  const file = path.join(f.output, ".config");
  fs.writeFileSync(file, "BR2_TEST=y\n");
  await f.request({
    action: "build.submit",
    workspaceId: adopted.result.workspaceId,
    target: "all",
    runtime: { kind: "wsl", distribution: "Ubuntu" },
    jobs: 1,
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    const listed = await f.request({ action: "jobs.list" });
    if (listed.result.some((job) => job.state === "running")) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const result = await f.request({
    action: "config.apply",
    workspaceId: adopted.result.workspaceId,
    domain: "buildroot",
    revision: "0".repeat(64),
    changes: { BR2_TEST: { type: "bool", value: false } },
  });
  assert.equal(result.code, "PROJECT_BUSY");
  assert.equal(fs.readFileSync(file, "utf8"), "BR2_TEST=y\n");
  f.finish();
  for (let i = 0; i < 20; i++) {
    if (
      (await f.request({ action: "jobs.list" })).result[0].state === "succeeded"
    )
      break;
    await new Promise((r) => setTimeout(r, 5));
  }
});
test("adopted directory identity is checked again before configuration reads", async (t) => {
  const f = fixture(t),
    selection = await f.request({ action: "project.choose" }),
    adopted = await f.request({
      action: "project.adopt",
      selectionId: selection.result.selectionId,
      trust: true,
    });
  fs.renameSync(f.source, f.source + "-previous");
  fs.mkdirSync(f.source);
  assert.equal(
    (
      await f.request({
        action: "config.inspect",
        workspaceId: adopted.result.workspaceId,
        domain: "buildroot",
      })
    ).code,
    "PROJECT_PATH_CHANGED",
  );
});

test("canvas layouts require current project authority and retain revision-checked positions", async (t) => {
  const f = fixture(t),
    selection = await f.request({ action: "project.choose" }),
    adopted = await f.request({
      action: "project.adopt",
      selectionId: selection.result.selectionId,
      trust: true,
    });
  const identity = {
    workspaceId: adopted.result.workspaceId,
    canvasId: "package-dependencies",
  };
  const layout = {
    nodes: [{ id: "package/zlib", x: 20, y: 30 }],
    viewport: { x: 2, y: 3, scale: 1.25 },
  };
  assert.equal(
    (
      await f.request({
        action: "canvas.read",
        ...identity,
        workspaceId: "forged",
      })
    ).code,
    "PROJECT_NOT_ADOPTED",
  );
  assert.equal(
    (await f.request({ action: "canvas.read", ...identity })).result.revision,
    0,
  );
  const saved = await f.request({
    action: "canvas.write",
    ...identity,
    expectedRevision: 0,
    layout,
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.result.revision, 1);
  assert.equal(
    (
      await f.request({
        action: "canvas.write",
        ...identity,
        expectedRevision: 0,
        layout,
      })
    ).code,
    "REVISION_CONFLICT",
  );
  assert.deepEqual(
    (await f.request({ action: "canvas.read", ...identity })).result.layout,
    layout,
  );
  assert.equal(
    (
      await f.request({
        action: "canvas.read",
        ...identity,
        canvasId: "guest-topology",
      })
    ).result.revision,
    0,
  );
  fs.renameSync(f.source, f.source + "-previous");
  fs.mkdirSync(f.source);
  assert.equal(
    (
      await f.request({
        action: "canvas.write",
        ...identity,
        expectedRevision: 1,
        layout,
      })
    ).code,
    "PROJECT_PATH_CHANGED",
  );
});
test("native external-tree selection binds package preview and actual apply to the adopted project", async (t) => {
  const f = fixture(t),
    selection = await f.request({ action: "project.choose" }),
    adopted = await f.request({
      action: "project.adopt",
      selectionId: selection.result.selectionId,
      trust: true,
    });
  const root = path.join(f.root, "external");
  fs.mkdirSync(root);
  f.picks.push(root);
  const chosen = await f.request({
    action: "external.choose",
    workspaceId: adopted.result.workspaceId,
  });
  assert.equal(chosen.ok, true);
  const initialization = {
    workspaceId: adopted.result.workspaceId,
    externalTreeId: chosen.result.externalTreeId,
    descriptor: { name: "FIXTURE", description: "Example packages" },
  };
  const initialPreview = await f.request({
    action: "external.previewInitialize",
    ...initialization,
  });
  assert.equal(initialPreview.ok, true);
  assert.deepEqual(fs.readdirSync(root), []);
  const initialized = await f.request({
    action: "external.initialize",
    ...initialization,
    revision: initialPreview.result.revision,
    previewHash: initialPreview.result.previewHash,
  });
  assert.equal(initialized.ok, true);
  assert.equal(initialized.result.initialized, true);
  assert.match(
    fs.readFileSync(path.join(root, "external.desc"), "utf8"),
    /name: FIXTURE/,
  );
  assert.equal(
    (
      await f.request({
        action: "external.previewInitialize",
        ...initialization,
      })
    ).code,
    "EXTERNAL_DIRECTORY_NOT_EMPTY",
  );
  const model = {
    name: "demo",
    version: "1.0",
    source: "https://example.invalid/demo.tar.gz",
    sourceFilename: "demo.tar.gz",
    homepage: "https://example.invalid",
    license: "MIT",
    licenseFiles: ["LICENSE"],
    buildSystem: "cmake",
    dependencies: ["zlib"],
    configDependencies: ["BR2_PACKAGE_ZLIB"],
    help: "Demo package",
    hashes: [
      { algorithm: "sha256", digest: "a".repeat(64), file: "demo.tar.gz" },
      { algorithm: "sha256", digest: "b".repeat(64), file: "LICENSE" },
    ],
  };
  const input = {
    workspaceId: adopted.result.workspaceId,
    externalTreeId: chosen.result.externalTreeId,
    model,
  };
  assert.equal(
    (
      await f.request({
        action: "package.preview",
        ...input,
        externalTreeId: "forged",
      })
    ).code,
    "EXTERNAL_TREE_NOT_GRANTED",
  );
  const preview = await f.request({ action: "package.preview", ...input });
  assert.equal(preview.ok, true);
  assert.equal(fs.existsSync(path.join(root, "package")), false);
  const applied = await f.request({
    action: "package.apply",
    ...input,
    revision: preview.result.revision,
    previewHash: preview.result.previewHash,
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.result.applied, true);
  assert.match(
    fs.readFileSync(path.join(root, "package/demo/demo.mk"), "utf8"),
    /DEMO_DEPENDENCIES = zlib/,
  );
  const discovery = await f.request({
    action: "package.discover",
    workspaceId: input.workspaceId,
    query: "demo",
    offset: 0,
    limit: 20,
  });
  assert.equal(discovery.ok, true);
  assert.equal(discovery.result.total, 1);
  assert.equal(discovery.result.packages[0].treeId, input.externalTreeId);
  const imported = await f.request({
    action: "package.import",
    workspaceId: input.workspaceId,
    packageId: discovery.result.packages[0].id,
    revision: discovery.result.revision,
  });
  assert.equal(imported.ok, true);
  assert.equal(imported.result.roundTripAllowed, true);
  assert.deepEqual(imported.result.draft, model);
  assert.equal(
    (
      await f.request({
        action: "package.discover",
        workspaceId: "forged",
        query: "",
        offset: 0,
        limit: 20,
      })
    ).code,
    "PROJECT_NOT_ADOPTED",
  );
  assert.equal(
    (
      await f.request({
        action: "package.apply",
        ...input,
        revision: preview.result.revision,
        previewHash: preview.result.previewHash,
      })
    ).code,
    "REVISION_CONFLICT",
  );
});

test("ordered external activation persists options but requires renewed folder authority after restart", async (t) => {
  const f = fixture(t);
  const selected = await f.request({ action: "project.choose" });
  const adopted = await f.request({
    action: "project.adopt",
    selectionId: selected.result.selectionId,
    trust: true,
  });
  const workspaceId = adopted.result.workspaceId;
  const chosenRuntime = { kind: "wsl", distribution: "Ubuntu" };
  assert.equal(
    (
      await f.request({
        action: "project.runtime",
        workspaceId,
        runtime: chosenRuntime,
      })
    ).result.revision,
    1,
  );
  const external = path.join(f.root, "external");
  fs.mkdirSync(external);
  for (const [name, contents] of Object.entries({
    "external.desc": "name: FIXTURE\n",
    "Config.in": "# packages\n",
    "external.mk": "# recipes\n",
  }))
    fs.writeFileSync(path.join(external, name), contents);
  f.picks.push(external);
  const choice = await f.request({ action: "external.choose", workspaceId });
  const activation = {
    workspaceId,
    externalTreeIds: [choice.result.externalTreeId],
    expectedRevision: 1,
    trust: true,
  };
  assert.equal(
    (
      await f.request({
        action: "external.activate",
        ...activation,
        trust: false,
      })
    ).code,
    "SOURCE_CONSENT_REQUIRED",
  );
  assert.equal(
    (
      await f.request({
        action: "external.activate",
        ...activation,
        expectedRevision: 0,
      })
    ).code,
    "REVISION_CONFLICT",
  );
  const active = await f.request({
    action: "external.activate",
    ...activation,
  });
  assert.equal(active.ok, true);
  assert.equal(active.result.revision, 2);
  assert.deepEqual(active.result.externalTrees, [
    { path: external, name: "FIXTURE" },
  ]);
  assert.deepEqual(f.calls.at(-1).externalTrees, [external]);
  assert.equal(f.calls.at(-1).trustedExternalTrees, true);
  const options = await f.request({ action: "project.options", workspaceId });
  assert.equal(options.result.externalTreesAuthorized, true);
  assert.deepEqual(options.result.runtime, chosenRuntime);
  await f.service.dispose();
  const picks = [f.root, f.source, f.output, external];
  const service = createOperationsService({
    directory: path.join(f.directory, "state"),
    dialog: {
      showOpenDialog: async () => ({
        canceled: false,
        filePaths: [picks.shift()],
      }),
    },
    version: "0.1.0",
    source: null,
    execution: f.execution,
  });
  const request = (r) => service.request(JSON.stringify(r));
  try {
    const list = await request({ action: "project.list" });
    assert.equal(list.result[0].authorized, false);
    const choice2 = await request({ action: "project.choose" });
    const restored = await request({
      action: "project.adopt",
      selectionId: choice2.result.selectionId,
      trust: true,
    });
    assert.equal(restored.result.workspaceId, workspaceId);
    const restoredOptions = await request({
      action: "project.options",
      workspaceId,
    });
    assert.equal(restoredOptions.result.externalTreesAuthorized, false);
    assert.deepEqual(restoredOptions.result.runtime, chosenRuntime);
    assert.equal(
      (
        await request({
          action: "build.submit",
          workspaceId,
          runtime: chosenRuntime,
          target: "all",
          jobs: 1,
        })
      ).code,
      "EXTERNAL_TREES_NOT_AUTHORIZED",
    );
    const renewed = await request({ action: "external.choose", workspaceId });
    assert.equal(
      (
        await request({
          action: "external.activate",
          workspaceId,
          externalTreeIds: [renewed.result.externalTreeId],
          expectedRevision: 2,
          trust: true,
        })
      ).ok,
      true,
    );
    assert.equal(
      (await request({ action: "project.options", workspaceId })).result
        .externalTreesAuthorized,
      true,
    );
  } finally {
    await service.dispose();
  }
});

async function queueFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "operations-queue-"));
  const picks = [],
    grants = new Map(),
    started = [];
  const capacity = {
    cpuSlots: 16,
    memoryAvailableBytes: 32 * 1024 ** 3,
    storageAvailableBytes: 128 * 1024 ** 3,
  };
  let unavailable = false,
    probes = 0,
    service;
  const execution = {
    grantProject(input) {
      const grantId = require("node:crypto").randomUUID();
      grants.set(grantId, input);
      return { grantId };
    },
    revoke(id) {
      grants.delete(id);
    },
    discover: async () => ({}),
    async probeResources(input) {
      probes++;
      assert.ok(grants.has(input.grantId));
      if (unavailable) throw Error("Runtime unavailable");
      return {
        ...capacity,
        observedAt: new Date().toISOString(),
        constraintModel: "cgroup-v2-and-affinity",
      };
    },
    async start(input) {
      assert.ok(grants.has(input.grantId));
      let resolve;
      const completion = new Promise((done) => {
        resolve = done;
      });
      const item = {
        input,
        source: grants.get(input.grantId).source,
        cancelRequested: false,
        finish(state = "succeeded") {
          resolve({ state, code: state === "succeeded" ? 0 : 1 });
        },
      };
      started.push(item);
      return {
        completion,
        cancel: async () => {
          item.cancelRequested = true;
          return completion;
        },
      };
    },
  };
  function create() {
    service = createOperationsService({
      directory: path.join(directory, "state"),
      dialog: {
        showOpenDialog: async () => ({
          canceled: false,
          filePaths: [picks.shift()],
        }),
      },
      version: "0.1.0",
      source: null,
      execution,
    });
    return service;
  }
  create();
  const request = (value) => service.request(JSON.stringify(value));
  async function adopt(name, existing) {
    const root = existing?.root || path.join(directory, name),
      source = existing?.source || path.join(root, "source"),
      output = existing?.output || path.join(root, "output");
    if (!existing) {
      fs.mkdirSync(source, { recursive: true });
      fs.mkdirSync(output);
      fs.writeFileSync(
        path.join(source, "Makefile"),
        "BR2_VERSION = 2025.02.1\nall:\n\ttrue\n",
      );
    }
    picks.push(root, source, output);
    const selected = await request({ action: "project.choose" });
    const admitted = await request({
      action: "project.adopt",
      selectionId: selected.result.selectionId,
      trust: true,
    });
    assert.equal(admitted.ok, true);
    return { root, source, output, workspaceId: admitted.result.workspaceId };
  }
  async function wait(predicate) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const result = await request({ action: "jobs.list" });
      if (predicate(result.result)) return result.result;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw Error("Expected queue state was not observed");
  }
  async function waitStarted(count) {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (started.length >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw Error("Expected runtime start was not observed");
  }
  const submit = (item, target = "all", resources) =>
    request({
      action: "build.submit",
      workspaceId: item.workspaceId,
      runtime: { kind: "wsl", distribution: "Fixture" },
      target,
      jobs: 1,
      ...(resources ? { resources } : {}),
    });
  t.after(async () => {
    const disposal = service.dispose();
    for (const item of started) item.finish("cancelled");
    await disposal;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    picks,
    capacity,
    started,
    execution,
    request,
    adopt,
    wait,
    waitStarted,
    submit,
    probes: () => probes,
    unavailable: (value) => {
      unavailable = value;
    },
    async restart() {
      await service.dispose();
      create();
    },
    dispose: () => service.dispose(),
  };
}

test("real host scheduler admits independent projects concurrently and holds same-project FIFO through cancellation cleanup", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("a"),
    b = await f.adopt("b");
  const a1 = await f.submit(a, "all");
  await f.wait(
    (jobs) => jobs.find((job) => job.id === a1.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  const a2 = await f.submit(a, "source"),
    a3 = await f.submit(a, "show-info"),
    b1 = await f.submit(b, "graph-depends");
  await f.wait(
    (jobs) => jobs.filter((job) => job.state === "running").length === 2,
  );
  await f.waitStarted(2);
  await f.request({ action: "jobs.pump" });
  const status = (await f.request({ action: "scheduler.status" })).result;
  assert.equal(status.running.length, 2);
  assert.equal(status.counts.queued, 2);
  assert.equal(
    status.blocked.find((item) => item.jobId === a3.result.id).reason,
    "BLOCKED_PROJECT_FIFO",
  );
  assert.equal(JSON.stringify(status).includes(f.directory), false);
  assert.deepEqual(
    f.started.map((item) => item.input.target),
    ["all", "graph-depends"],
  );
  f.started[0].finish();
  await f.wait(
    (jobs) => jobs.find((job) => job.id === a2.result.id)?.state === "running",
  );
  await f.waitStarted(3);
  const second = (await f.request({ action: "jobs.list" })).result.find(
    (job) => job.id === a2.result.id,
  );
  await f.request({
    action: "jobs.cancel",
    id: second.id,
    sequence: second.sequence,
  });
  await f.wait(
    (jobs) => jobs.find((job) => job.id === second.id)?.state === "cancelling",
  );
  assert.equal(
    (await f.request({ action: "scheduler.status" })).result.running.length,
    2,
  );
  assert.equal(f.started[2].cancelRequested, true);
  assert.equal(
    f.started.some((item) => item.input.target === "show-info"),
    false,
  );
  f.started[2].finish("cancelled");
  await f.wait(
    (jobs) => jobs.find((job) => job.id === a3.result.id)?.state === "running",
  );
  await f.waitStarted(4);
  assert.equal(f.started[3].input.target, "show-info");
  for (const item of f.started) item.finish();
  await f.wait((jobs) =>
    jobs.every((job) => ["succeeded", "cancelled"].includes(job.state)),
  );
});

test("unknown capacity and every reservation limit stay queued until actual resource refresh admits the build", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("resource");
  f.unavailable(true);
  const submitted = await f.submit(a);
  let status = (await f.request({ action: "jobs.pump" })).result;
  assert.equal(status.blocked[0].reason, "BLOCKED_RESOURCE_UNKNOWN");
  assert.equal(f.started.length, 0);
  f.unavailable(false);
  f.capacity.cpuSlots = 1;
  assert.equal(
    (await f.request({ action: "jobs.pump" })).result.blocked[0].reason,
    "BLOCKED_CPU_LIMIT",
  );
  f.capacity.cpuSlots = 8;
  f.capacity.memoryAvailableBytes = 3 * 1024 ** 3;
  assert.equal(
    (await f.request({ action: "jobs.pump" })).result.blocked[0].reason,
    "BLOCKED_MEMORY_LIMIT",
  );
  f.capacity.memoryAvailableBytes = 16 * 1024 ** 3;
  f.capacity.storageAvailableBytes = 7 * 1024 ** 3;
  assert.equal(
    (await f.request({ action: "jobs.pump" })).result.blocked[0].reason,
    "BLOCKED_STORAGE_LIMIT",
  );
  f.capacity.storageAvailableBytes = 32 * 1024 ** 3;
  await f.request({ action: "jobs.pump" });
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === submitted.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  assert.ok(f.probes() >= 5);
  assert.equal(f.started.length, 1);
});

test("queued source and configuration content remain immutable across retry; only a new submission captures changed intent", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("stale");
  f.unavailable(true);
  const submitted = await f.submit(a);
  await f.request({ action: "jobs.pump" });
  fs.appendFileSync(path.join(a.source, "Makefile"), "# independent edit\n");
  fs.writeFileSync(path.join(a.output, ".config"), "BR2_PACKAGE_BUSYBOX=y\n");
  f.unavailable(false);
  assert.equal(
    (await f.request({ action: "jobs.pump" })).result.blocked.find(
      (item) => item.jobId === submitted.result.id,
    ).reason,
    "BLOCKED_INTENT_CHANGED",
  );
  const cancelled = await f.request({
    action: "jobs.cancel",
    id: submitted.result.id,
    sequence: submitted.result.sequence,
  });
  const retry = await f.request({
    action: "jobs.retry",
    id: submitted.result.id,
    sequence: cancelled.result.sequence,
  });
  assert.deepEqual(
    retry.result.payload.intent,
    submitted.result.payload.intent,
  );
  assert.equal(
    (await f.request({ action: "jobs.pump" })).result.blocked.find(
      (item) => item.jobId === retry.result.id,
    ).reason,
    "BLOCKED_INTENT_CHANGED",
  );
  await f.request({
    action: "jobs.cancel",
    id: retry.result.id,
    sequence: retry.result.sequence,
  });
  const fresh = await f.submit(a);
  assert.notEqual(
    fresh.result.payload.intent.sourceRevision,
    submitted.result.payload.intent.sourceRevision,
  );
  assert.notEqual(
    fresh.result.payload.intent.configRevision,
    submitted.result.payload.intent.configRevision,
  );
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === fresh.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  assert.equal(f.started.length, 1);
  assert.equal(
    fs.readFileSync(path.join(a.output, ".config"), "utf8"),
    "BR2_PACKAGE_BUSYBOX=y\n",
  );
  assert.equal(JSON.stringify(fresh.result.payload).includes(a.source), false);
});

test("restart retains queued intent but requires renewed native authority before any resource probe or execution", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("restart");
  f.unavailable(true);
  const submitted = await f.submit(a);
  await f.request({ action: "jobs.pump" });
  const before = f.probes();
  await f.restart();
  f.unavailable(false);
  const blocked = (await f.request({ action: "jobs.pump" })).result;
  assert.equal(blocked.blocked[0].reason, "BLOCKED_AUTHORIZATION_REQUIRED");
  assert.equal(f.probes(), before);
  assert.equal(f.started.length, 0);
  const renewed = await f.adopt("restart", a);
  assert.equal(renewed.workspaceId, a.workspaceId);
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === submitted.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  assert.deepEqual(
    (await f.request({ action: "jobs.list" })).result[0].payload.intent,
    submitted.result.payload.intent,
  );
  assert.equal(f.started.length, 1);
});

test("running leases deny same-source configuration, external/package and source mutations while independent metadata and artifact reads remain available", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("leased"),
    b = await f.adopt("independent");
  const { execFileSync } = require("node:child_process");
  execFileSync("git", ["init", "--quiet"], { cwd: a.source });
  execFileSync("git", ["add", "Makefile"], { cwd: a.source });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      "Fixture source",
    ],
    { cwd: a.source },
  );
  const external = path.join(f.directory, "external");
  fs.mkdirSync(external);
  for (const [name, contents] of Object.entries({
    "external.desc": "name: FIXTURE\n",
    "Config.in": "# packages\n",
    "external.mk": "# recipes\n",
  }))
    fs.writeFileSync(path.join(external, name), contents);
  f.picks.push(external);
  const selected = await f.request({
    action: "external.choose",
    workspaceId: a.workspaceId,
  });
  const activation = {
    action: "external.activate",
    workspaceId: a.workspaceId,
    externalTreeIds: [selected.result.externalTreeId],
    expectedRevision: 0,
    trust: true,
  };
  assert.equal((await f.request(activation)).ok, true);
  const submitted = await f.submit(a);
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === submitted.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  assert.equal(
    (
      await f.request({
        action: "config.apply",
        workspaceId: a.workspaceId,
        domain: "buildroot",
        revision: "a".repeat(64),
        changes: [],
      })
    ).code,
    "PROJECT_BUSY",
  );
  assert.equal(
    (await f.request({ ...activation, expectedRevision: 1 })).code,
    "PROJECT_BUSY",
  );
  assert.equal(
    (
      await f.request({
        action: "external.initialize",
        workspaceId: a.workspaceId,
        externalTreeId: selected.result.externalTreeId,
        descriptor: { name: "OTHER", description: "Fixture" },
        revision: "a".repeat(64),
        previewHash: "b".repeat(64),
      })
    ).code,
    "PROJECT_BUSY",
  );
  const sourceResult = await f.request({
    action: "source",
    request: { action: "source.ref", workspaceId: a.workspaceId, ref: "HEAD" },
  });
  assert.equal(sourceResult.code, "SOURCE_BUSY");
  f.picks.push(a.root);
  const destination = await f.request({
    action: "source",
    request: { action: "source.choose" },
  });
  const clone = await f.request({
    action: "source",
    request: {
      action: "source.clone",
      selectionId: destination.result.selectionId,
      directory: "new-checkout",
      url: "https://example.invalid/source.git",
      ref: "HEAD",
      trust: true,
    },
  });
  assert.equal(clone.code, "SOURCE_BUSY");
  assert.equal(fs.existsSync(path.join(a.root, "new-checkout")), false);
  assert.equal(
    (
      await f.request({
        action: "project.runtime",
        workspaceId: b.workspaceId,
        runtime: { kind: "wsl", distribution: "Fixture" },
      })
    ).ok,
    true,
  );
  assert.equal(
    (await f.request({ action: "artifacts.list", workspaceId: a.workspaceId }))
      .ok,
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(external, "external.desc"), "utf8"),
    "name: FIXTURE\n",
  );
});

test("strict optional reservation admission rejects unsafe input and dispose waits for actual cancellation cleanup", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("dispose");
  for (const resources of [
    { cpuSlots: 0, memoryBytes: 4 * 1024 ** 3, storageBytes: 0 },
    { cpuSlots: 2, memoryBytes: 1, storageBytes: 0 },
    { cpuSlots: 2, memoryBytes: 4 * 1024 ** 3, storageBytes: 0, command: "id" },
  ])
    assert.equal((await f.submit(a, "all", resources)).ok, false);
  assert.equal(
    (await f.request({ action: "scheduler.status", path: "/outside" })).code,
    "INVALID_REQUEST",
  );
  const submitted = await f.submit(a);
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === submitted.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  let settled = false;
  const disposal = f.dispose().then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(settled, false);
  assert.equal(f.started[0].cancelRequested, true);
  f.started[0].finish("cancelled");
  await disposal;
  assert.equal(settled, true);
  assert.equal((await f.request({ action: "jobs.pump" })).code, "UNAVAILABLE");
});

test("native external content changes invalidate queued work and ancestor-selected mutation leases exclude another project's build", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("external-intent"),
    b = await f.adopt("ancestor-owner");
  const external = path.join(f.directory, "shared-external");
  fs.mkdirSync(external);
  for (const [name, contents] of Object.entries({
    "external.desc": "name: SHARED\n",
    "Config.in": "# packages\n",
    "external.mk": "# recipes\n",
  }))
    fs.writeFileSync(path.join(external, name), contents);
  f.picks.push(external);
  const choice = await f.request({
    action: "external.choose",
    workspaceId: a.workspaceId,
  });
  await f.request({
    action: "external.activate",
    workspaceId: a.workspaceId,
    externalTreeIds: [choice.result.externalTreeId],
    expectedRevision: 0,
    trust: true,
  });
  f.unavailable(true);
  const queued = await f.submit(a);
  await f.request({ action: "jobs.pump" });
  fs.appendFileSync(
    path.join(external, "external.mk"),
    "# independent recipe edit\n",
  );
  f.unavailable(false);
  assert.equal(
    (await f.request({ action: "jobs.pump" })).result.blocked.find(
      (item) => item.jobId === queued.result.id,
    ).reason,
    "BLOCKED_INTENT_CHANGED",
  );
  await f.request({
    action: "jobs.cancel",
    id: queued.result.id,
    sequence: queued.result.sequence,
  });
  const fresh = await f.submit(a);
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === fresh.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  f.picks.push(a.root);
  const ancestor = await f.request({
    action: "external.choose",
    workspaceId: b.workspaceId,
  });
  const denied = await f.request({
    action: "external.initialize",
    workspaceId: b.workspaceId,
    externalTreeId: ancestor.result.externalTreeId,
    descriptor: { name: "NESTED", description: "Fixture" },
    revision: "a".repeat(64),
    previewHash: "b".repeat(64),
  });
  assert.equal(denied.code, "PROJECT_BUSY");
  assert.equal(
    fs.readFileSync(path.join(external, "external.mk"), "utf8"),
    "# recipes\n# independent recipe edit\n",
  );
});

test("explicit bounded reservations are admission budgets and a zero disk floor is honored without changing runtime arguments", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("explicit-reservations");
  f.capacity.cpuSlots = 1;
  f.capacity.memoryAvailableBytes = 2 * 1024 ** 3;
  f.capacity.storageAvailableBytes = 0;
  const resources = { cpuSlots: 1, memoryBytes: 1024 ** 3, storageBytes: 0 };
  const submitted = await f.submit(a, "all", resources);
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === submitted.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  assert.deepEqual(
    (await f.request({ action: "scheduler.status" })).result.reservations,
    resources,
  );
  assert.deepEqual(Object.keys(f.started[0].input).sort(), [
    "grantId",
    "jobs",
    "runtime",
    "target",
  ]);
  assert.equal(f.started[0].input.jobs, 1);
});

test("Docker defaults reserve its full fixed envelope against shared capacity instead of the probe leaf", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("docker-capacity");
  f.capacity.cpuSlots = 4;
  f.capacity.memoryAvailableBytes = 7 * 1024 ** 3;
  const selectedRuntime = {
    kind: "docker",
    image: `registry.example/buildroot@sha256:${"a".repeat(64)}`,
    uid: 1000,
    gid: 1000,
  };
  const request = {
    action: "build.submit",
    workspaceId: a.workspaceId,
    target: "all",
    runtime: selectedRuntime,
    jobs: 8,
  };
  const submitted = await f.request(request);
  assert.equal(submitted.ok, true);
  assert.deepEqual(submitted.result.payload.resources, {
    cpuSlots: 2,
    memoryBytes: 4 * 1024 ** 3,
    storageBytes: 8 * 1024 ** 3,
  });
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === submitted.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  assert.deepEqual(f.started[0].input.runtime, selectedRuntime);
  assert.equal(f.started[0].input.jobs, 8);
  const invalid = await f.request({
    ...request,
    resources: { cpuSlots: 2, memoryBytes: 3 * 1024 ** 3, storageBytes: 0 },
  });
  assert.equal(invalid.code, "INVALID_RESERVATION");
});

test("replaced external directories require a renewed native grant before content inspection or admission", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("external-authority");
  const external = path.join(f.directory, "authorized-external");
  fs.mkdirSync(external);
  const descriptor = {
    "external.desc": "name: ORIGINAL\n",
    "Config.in": "# packages\n",
    "external.mk": "# recipes\n",
  };
  for (const [name, contents] of Object.entries(descriptor))
    fs.writeFileSync(path.join(external, name), contents);
  f.picks.push(external);
  const chosen = await f.request({
    action: "external.choose",
    workspaceId: a.workspaceId,
  });
  await f.request({
    action: "external.activate",
    workspaceId: a.workspaceId,
    externalTreeIds: [chosen.result.externalTreeId],
    expectedRevision: 0,
    trust: true,
  });
  f.unavailable(true);
  const submitted = await f.submit(a);
  await f.request({ action: "jobs.pump" });
  fs.renameSync(external, `${external}-original`);
  fs.mkdirSync(external);
  for (const [name, contents] of Object.entries(descriptor))
    fs.writeFileSync(path.join(external, name), contents);
  const blocked = await f.request({ action: "jobs.pump" });
  assert.equal(
    blocked.result.blocked.find((item) => item.jobId === submitted.result.id)
      .reason,
    "BLOCKED_EXTERNAL_AUTHORIZATION_REQUIRED",
  );
  assert.equal(f.started.length, 0);
  f.picks.push(external);
  const renewed = await f.request({
    action: "external.choose",
    workspaceId: a.workspaceId,
  });
  assert.equal(
    (
      await f.request({
        action: "external.activate",
        workspaceId: a.workspaceId,
        externalTreeIds: [renewed.result.externalTreeId],
        expectedRevision: 1,
        trust: true,
      })
    ).ok,
    true,
  );
  f.unavailable(false);
  await f.request({ action: "jobs.pump" });
  await f.wait(
    (jobs) =>
      jobs.find((job) => job.id === submitted.result.id)?.state === "running",
  );
  await f.waitStarted(1);
  assert.equal(
    fs.readFileSync(path.join(`${external}-original`, "external.desc"), "utf8"),
    "name: ORIGINAL\n",
  );
});

test("a last-moment source change after scheduler admission cannot launch and records a bounded recovery reason", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("dispatch-race");
  const promises = require("node:fs/promises"),
    open = promises.open,
    makefile = path.join(a.source, "Makefile");
  let reads = 0;
  promises.open = async function (selected, ...args) {
    const handle = await open.call(this, selected, ...args);
    if (selected === makefile && ++reads === 4)
      fs.appendFileSync(makefile, "# independent final-dispatch edit\n");
    return handle;
  };
  try {
    const submitted = await f.submit(a);
    assert.equal(submitted.ok, true);
    const jobs = await f.wait(
      (items) =>
        items.find((job) => job.id === submitted.result.id)?.state === "failed",
    );
    const failed = jobs.find((job) => job.id === submitted.result.id);
    assert.equal(f.started.length, 0);
    assert.equal(failed.logCount, 1);
    const log = await f.request({
      action: "jobs.page",
      id: failed.id,
      after: 0,
      limit: 10,
    });
    assert.match(
      log.result.records[0].value.text,
      /Build was not started: BLOCKED_CONTENT_CHANGED/,
    );
    assert.equal(JSON.stringify(log).includes(a.source), false);
    assert.match(
      fs.readFileSync(makefile, "utf8"),
      /independent final-dispatch edit/,
    );
  } finally {
    promises.open = open;
  }
});

test("unverified cancellation cleanup remains quarantined through restart until owned runtime and capacity reconciliation", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("quarantined"),
    b = await f.adopt("independent");
  const receipt = { ownerToken: require("node:crypto").randomUUID() };
  f.execution.validateOwnershipReceipt = (value) =>
    assert.deepEqual(value, receipt);
  const start = f.execution.start;
  f.execution.start = async (input, log, options) => {
    await options.onOwnership(receipt);
    return start(input, log);
  };
  let verified = false;
  f.execution.reconcileCleanup = async (value) => {
    assert.deepEqual(value, receipt);
    return {
      state: verified ? "verified-stopped" : "unknown",
      reason: "OWNED_RUNTIME_UNKNOWN",
    };
  };
  const submitted = (await f.submit(a)).result;
  await f.waitStarted(1);
  const current = (await f.request({ action: "jobs.list" })).result.find(
    (job) => job.id === submitted.id,
  );
  await f.request({
    action: "jobs.cancel",
    id: current.id,
    sequence: current.sequence,
  });
  f.started[0].finish("runtime-cleanup-failed");
  await f.wait((items) =>
    items.some((job) => job.id === submitted.id && job.state === "interrupted"),
  );
  const queued = (await f.submit(b)).result;
  await f.request({ action: "jobs.pump" });
  assert.equal(f.started.length, 1);
  let status = (await f.request({ action: "scheduler.status" })).result;
  assert.equal(status.quarantine.records[0].jobId, submitted.id);
  assert.equal(status.quarantinedReservations.memoryBytes, 4 * 1024 ** 3);
  assert.ok(!JSON.stringify(status).includes(receipt.ownerToken));
  assert.equal(
    (
      await f.request({
        action: "project.runtime",
        workspaceId: a.workspaceId,
        runtime: { kind: "wsl", distribution: "Fixture" },
      })
    ).code,
    "RUNTIME_RECOVERY_REQUIRED",
  );
  assert.equal(
    (await f.request({ action: "jobs.reconcile", id: submitted.id, receipt }))
      .code,
    "INVALID_REQUEST",
  );
  await f.restart();
  assert.equal(
    (await f.request({ action: "jobs.reconcile", id: submitted.id })).code,
    "PROJECT_NOT_ADOPTED",
  );
  await f.adopt("quarantined", a);
  await f.adopt("independent", b);
  assert.equal(
    (await f.request({ action: "jobs.reconcile", id: submitted.id })).code,
    "RECOVERY_UNVERIFIED",
  );
  verified = true;
  f.capacity.memoryAvailableBytes = null;
  assert.equal(
    (await f.request({ action: "jobs.reconcile", id: submitted.id })).code,
    "RECOVERY_CAPACITY_UNKNOWN",
  );
  assert.equal(f.started.length, 1);
  f.capacity.memoryAvailableBytes = 32 * 1024 ** 3;
  assert.equal(
    (await f.request({ action: "jobs.reconcile", id: submitted.id })).result
      .reconciled,
    true,
  );
  await f.waitStarted(2);
  assert.equal(f.started[1].source, b.source);
  status = (await f.request({ action: "scheduler.status" })).result;
  assert.deepEqual(status.quarantine.records, []);
  f.started[1].finish();
  await f.wait(
    (items) => items.find((job) => job.id === queued.id)?.state === "succeeded",
  );
});

test("a missing runtime identity after an interrupted start never receives guessed recovery authority", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("missing-receipt");
  f.execution.start = async () => {
    throw Error("Runtime launch response unavailable");
  };
  const job = (await f.submit(a)).result;
  await f.wait(
    (items) =>
      items.find((item) => item.id === job.id)?.state === "interrupted",
  );
  assert.equal(
    (await f.request({ action: "jobs.reconcile", id: job.id })).code,
    "RECOVERY_IDENTITY_UNAVAILABLE",
  );
  await f.restart();
  await f.adopt("missing-receipt", a);
  assert.equal(
    (await f.request({ action: "jobs.reconcile", id: job.id })).code,
    "RECOVERY_IDENTITY_UNAVAILABLE",
  );
  assert.equal(
    (await f.request({ action: "scheduler.status" })).result.quarantine
      .records[0].reason,
    "RUNTIME_IDENTITY_UNAVAILABLE",
  );
});

test("a trusted pre-effect runtime failure remains failed without inventing an unknown live runtime", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("unavailable-preflight");
  const start = f.execution.start;
  f.execution.start = async () => {
    throw Object.assign(Error("Known pre-effect failure"), {
      code: "RUNTIME_NOT_STARTED",
    });
  };
  const job = (await f.submit(a)).result;
  await f.wait(
    (items) => items.find((item) => item.id === job.id)?.state === "failed",
  );
  assert.deepEqual(
    (await f.request({ action: "scheduler.status" })).result.quarantine.records,
    [],
  );
  f.execution.start = start;
  await f.submit(a);
  await f.waitStarted(1);
  f.started[0].finish();
});

test("duplicate journal keys block queued admission and preserve corrupt storage", async (t) => {
  const f = await queueFixture(t),
    a = await f.adopt("duplicate-journal");
  f.capacity.cpuSlots = 0;
  const job = (await f.submit(a)).result;
  await f.request({ action: "jobs.pump" });
  assert.equal(f.started.length, 0);
  const file = path.join(
    f.directory,
    "state",
    "build-recovery",
    "runtime-recovery.json",
  );
  const corrupt = '{"version":1,"version":1,"records":[]}';
  fs.writeFileSync(file, corrupt);
  f.capacity.cpuSlots = 16;
  assert.equal(
    (await f.request({ action: "jobs.pump" })).code,
    "QUARANTINE_UNAVAILABLE",
  );
  assert.equal(f.started.length, 0);
  assert.equal(
    (await f.request({ action: "jobs.list" })).result.find(
      (item) => item.id === job.id,
    ).state,
    "queued",
  );
  assert.equal(fs.readFileSync(file, "utf8"), corrupt);
});
