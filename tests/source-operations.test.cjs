"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { execFileSync } = require("node:child_process");
const { createSourceOperations } = require("../src/main/source-operations.cjs");
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-operations-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const origin = path.join(root, "origin");
  fs.mkdirSync(origin);
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-C",
        origin,
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        ...args,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  git("init", "-b", "main");
  fs.writeFileSync(path.join(origin, "Makefile"), "all:\n\t@echo first\n");
  git("add", ".");
  git("commit", "-m", "first");
  const first = git("rev-parse", "HEAD");
  fs.appendFileSync(path.join(origin, "Makefile"), "# next\n");
  git("commit", "-am", "next");
  const second = git("rev-parse", "HEAD");
  const workspaces = new Map();
  let busy = false;
  const operations = createSourceOperations({
    chooseDirectory: async () => root,
    resolveWorkspace: async (id) => workspaces.get(id),
    onSourceAdopted: async ({ root: selectedRoot, source }) => {
      assert.equal(selectedRoot, root);
      if (options.adoptionRequired)
        throw Object.assign(Error("existing output"), {
          code: "ADOPTION_REQUIRED",
        });
      workspaces.set("workspace-1", { source });
      return { workspaceId: "workspace-1" };
    },
    sourceOptions: { allowLocalFixture: true },
    acquireSourceLock: async () => {
      if (busy) throw Object.assign(Error("busy"), { code: "SOURCE_BUSY" });
      return () => {};
    },
  });
  t.after(() => operations.dispose());
  return {
    operations,
    root,
    origin,
    first,
    second,
    setBusy: (value) => (busy = value),
  };
}
async function clone(f) {
  const selected = await f.operations.handle({ action: "source.choose" });
  assert.equal(selected.ok, true);
  const result = await f.operations.handle({
    action: "source.clone",
    selectionId: selected.selectionId,
    directory: "checkout",
    url: f.origin,
    ref: f.first,
    trust: true,
  });
  assert.equal(result.ok, true);
  return result;
}
test("host-selected clone, exact fetch, preview, explicit apply and rollback use opaque workspace handles", async (t) => {
  const f = fixture(t),
    created = await clone(f);
  assert.equal(created.revision, f.first);
  assert.equal(Object.hasOwn(created, "source"), false);
  const fetched = await f.operations.handle({
    action: "source.ref",
    workspaceId: created.workspaceId,
    ref: "main",
  });
  assert.equal(fetched.fetchedRevision, f.second);
  assert.equal(fetched.revision, f.first);
  const preview = await f.operations.handle({
    action: "source.upgrade.preview",
    workspaceId: created.workspaceId,
    revision: f.second,
  });
  assert.equal(preview.ok, true);
  const applied = await f.operations.handle({
    action: "source.upgrade.apply",
    workspaceId: created.workspaceId,
    previewId: preview.previewId,
    expectedRevision: f.first,
    consent: true,
  });
  assert.equal(applied.revision, f.second);
  const rollback = await f.operations.handle({
    action: "source.rollback.preview",
    workspaceId: created.workspaceId,
    rollbackId: applied.rollbackId,
  });
  assert.equal(rollback.toRevision, f.first);
  const restored = await f.operations.handle({
    action: "source.rollback.apply",
    workspaceId: created.workspaceId,
    previewId: rollback.previewId,
    expectedRevision: f.second,
    consent: true,
  });
  assert.equal(restored.revision, f.first);
});
test("renderer paths, unselected destinations, missing trust and foreign previews fail closed", async (t) => {
  const f = fixture(t);
  assert.deepEqual(
    await f.operations.handle({ action: "source.choose", root: f.root }),
    { ok: false, code: "INVALID_REQUEST" },
  );
  assert.deepEqual(
    await f.operations.handle({
      action: "source.clone",
      selectionId: "foreign",
      directory: "checkout",
      url: f.origin,
      ref: f.first,
      trust: true,
    }),
    { ok: false, code: "SOURCE_SELECTION_UNAVAILABLE" },
  );
  const selected = await f.operations.handle({ action: "source.choose" });
  assert.deepEqual(
    await f.operations.handle({
      action: "source.clone",
      selectionId: selected.selectionId,
      directory: "checkout",
      url: f.origin,
      ref: f.first,
      trust: false,
    }),
    { ok: false, code: "SOURCE_TRUST_REQUIRED" },
  );
  const created = await clone(f);
  assert.deepEqual(
    await f.operations.handle({
      action: "source.upgrade.apply",
      workspaceId: created.workspaceId,
      previewId: "foreign",
      expectedRevision: f.first,
      consent: true,
    }),
    { ok: false, code: "PREVIEW_UNAVAILABLE" },
  );
});
test("dirty source, stale revision and active build locks preserve checkout and untracked files", async (t) => {
  const f = fixture(t),
    created = await clone(f);
  const preview = await f.operations.handle({
    action: "source.upgrade.preview",
    workspaceId: created.workspaceId,
    revision: f.second,
  });
  const apply = () =>
    f.operations.handle({
      action: "source.upgrade.apply",
      workspaceId: created.workspaceId,
      previewId: preview.previewId,
      expectedRevision: f.first,
      consent: true,
    });
  assert.equal(
    (
      await f.operations.handle({
        action: "source.upgrade.apply",
        workspaceId: created.workspaceId,
        previewId: preview.previewId,
        expectedRevision: f.second,
        consent: true,
      })
    ).code,
    "REVISION_CONFLICT",
  );
  f.setBusy(true);
  assert.equal((await apply()).code, "SOURCE_BUSY");
  f.setBusy(false);
  assert.equal(
    (
      await f.operations.handle({
        action: "source.upgrade.apply",
        workspaceId: created.workspaceId,
        previewId: preview.previewId,
        expectedRevision: f.first,
        consent: false,
      })
    ).code,
    "SOURCE_APPLY_CONSENT_REQUIRED",
  );
  fs.writeFileSync(path.join(f.root, "checkout", "notes"), "keep");
  assert.equal((await apply()).code, "SOURCE_CHANGED_OR_DIRTY");
  assert.equal(
    fs.readFileSync(path.join(f.root, "checkout", "notes"), "utf8"),
    "keep",
  );
  assert.equal(
    (
      await f.operations.handle({
        action: "source.status",
        workspaceId: created.workspaceId,
      })
    ).revision,
    f.first,
  );
});

test("existing output registration conflict retains the cloned source and output tree", async (t) => {
  const f = fixture(t, { adoptionRequired: true });
  const output = path.join(f.root, "checkout-output");
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, "retained"), "keep");
  const selection = await f.operations.handle({ action: "source.choose" });
  const result = await f.operations.handle({
    action: "source.clone",
    selectionId: selection.selectionId,
    directory: "checkout",
    url: f.origin,
    ref: f.first,
    trust: true,
  });
  assert.deepEqual(result, { ok: false, code: "ADOPTION_REQUIRED" });
  assert.ok(fs.existsSync(path.join(f.root, "checkout", "Makefile")));
  assert.equal(fs.readFileSync(path.join(output, "retained"), "utf8"), "keep");
});
