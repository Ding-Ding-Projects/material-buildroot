"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createOperationsService,
} = require("../src/main/operations-service.cjs");
function fixture(t, { cancelled = false, hold = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "operations-"));
  const root = path.join(directory, "project"),
    source = path.join(root, "source"),
    output = path.join(root, "output");
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(output);
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
    start: async (input, log) => {
      calls.push(input);
      log?.({ stream: "stdout", text: "actual adapter reply" });
      return { completion, cancel: async () => ({ state: "cancelled" }) };
    },
  };
  const service = createOperationsService({
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
  t.after(() => {
    service.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return {
    request: (r) => service.request(JSON.stringify(r)),
    calls,
    service,
    root,
    source,
    output,
    finish,
    picks,
  };
}
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
  const result = await f.request({
    action: "config.apply",
    workspaceId: adopted.result.workspaceId,
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
  fs.writeFileSync(path.join(root, "external.desc"), "name: FIXTURE\n");
  fs.writeFileSync(path.join(root, "Config.in"), "# preserved\n");
  fs.writeFileSync(path.join(root, "external.mk"), "# preserved\n");
  f.picks.push(root);
  const chosen = await f.request({
    action: "external.choose",
    workspaceId: adopted.result.workspaceId,
  });
  assert.equal(chosen.ok, true);
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
