"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {
  createPackageAuthoringService,
  validateAuthoringModel,
} = require("../src/main/configuration/package-authoring.cjs");
function model() {
  return {
    name: "demo-tool",
    version: "1.0",
    source: "https://example.invalid/releases/demo-1.0.tar.gz",
    sourceFilename: "demo-1.0.tar.gz",
    homepage: "https://example.invalid/demo",
    license: "MIT",
    licenseFiles: ["LICENSE"],
    buildSystem: "cmake",
    dependencies: ["zlib"],
    configDependencies: ["BR2_PACKAGE_ZLIB"],
    help: "A useful fixture.\nSecond line.",
    hashes: [
      { algorithm: "sha256", digest: "a".repeat(64), file: "demo-1.0.tar.gz" },
      { algorithm: "sha256", digest: "b".repeat(64), file: "LICENSE" },
    ],
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "package-authoring-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, "external.desc"),
    "name: FIXTURE\ndesc: Test tree\n",
  );
  await fs.writeFile(
    path.join(root, "Config.in"),
    "# Preserve configuration\n",
  );
  await fs.writeFile(
    path.join(root, "external.mk"),
    "# Preserve make content\n",
  );
  const service = createPackageAuthoringService({
    resolveExternalTree: async () => ({ granted: true, root }),
    withLock: async (_, work) => work(),
  });
  return { root, service };
}
test("preview and explicit apply create real external package files preserving tree content", async (t) => {
  const { root, service } = await fixture(t);
  const request = { workspaceId: "w", externalTreeId: "e", model: model() };
  const preview = await service.preview(request);
  assert.equal(preview.files.length, 5);
  await assert.rejects(fs.stat(path.join(root, "package")), { code: "ENOENT" });
  const result = await service.apply({
    ...request,
    revision: preview.revision,
    previewHash: preview.previewHash,
  });
  assert.equal(result.applied, true);
  const make = await fs.readFile(
    path.join(root, "package/demo-tool/demo-tool.mk"),
    "utf8",
  );
  assert.match(make, /DEMO_TOOL_DEPENDENCIES = zlib/);
  assert.match(make, /\$\(eval \$\(cmake-package\)\)/);
  assert.match(
    await fs.readFile(path.join(root, "package/demo-tool/Config.in"), "utf8"),
    /depends on BR2_PACKAGE_ZLIB/,
  );
  assert.match(
    await fs.readFile(path.join(root, "Config.in"), "utf8"),
    /^# Preserve configuration\nsource/,
  );
  const second = await service.preview(request);
  assert.equal(
    second.files.find((f) => f.path === "Config.in").before,
    second.files.find((f) => f.path === "Config.in").after,
  );
});
test("stale content or changed model cannot apply a reviewed preview", async (t) => {
  const { root, service } = await fixture(t);
  const request = { model: model() };
  const preview = await service.preview(request);
  await assert.rejects(
    service.apply({
      ...request,
      model: { ...model(), version: "2.0" },
      revision: preview.revision,
      previewHash: preview.previewHash,
    }),
    { code: "PACKAGE_PREVIEW_CONFLICT" },
  );
  await fs.appendFile(path.join(root, "external.mk"), "# external edit\n");
  await assert.rejects(
    service.apply({
      ...request,
      revision: preview.revision,
      previewHash: preview.previewHash,
    }),
    { code: "REVISION_CONFLICT" },
  );
});
test("untrusted fields command injection traversal and symlink paths fail before writing", async (t) => {
  const { root, service } = await fixture(t);
  for (const change of [
    { name: "../escape" },
    { version: "$(shell touch bad)" },
    { source: "https://example.invalid/a#evil" },
    { license: "MIT\nEVIL = yes" },
    { buildCommands: "touch bad" },
    { licenseFiles: ["../LICENSE"] },
  ])
    assert.throws(() => validateAuthoringModel({ ...model(), ...change }));
  await fs.symlink(os.tmpdir(), path.join(root, "package"));
  await assert.rejects(service.preview({ model: model() }), {
    code: "UNSAFE_PACKAGE_PATH",
  });
});
test("partial transaction restores previous files and removes new package directories", async (t) => {
  const { root, service } = await fixture(t);
  const request = { model: model() };
  const preview = await service.preview(request);
  const rename = fs.rename;
  let count = 0;
  fs.rename = async (...args) => {
    if (++count === 1)
      throw Object.assign(new Error("fixture write failure"), { code: "EIO" });
    return rename(...args);
  };
  try {
    await assert.rejects(
      service.apply({
        ...request,
        revision: preview.revision,
        previewHash: preview.previewHash,
      }),
      { code: "EIO" },
    );
  } finally {
    fs.rename = rename;
  }
  assert.equal(
    await fs.readFile(path.join(root, "Config.in"), "utf8"),
    "# Preserve configuration\n",
  );
  assert.equal(
    await fs.readFile(path.join(root, "external.mk"), "utf8"),
    "# Preserve make content\n",
  );
  await assert.rejects(fs.stat(path.join(root, "package")), { code: "ENOENT" });
});
test("standard external wildcard include is retained without duplicate package include", async (t) => {
  const { root, service } = await fixture(t);
  const line =
    "include $(sort $(wildcard $(BR2_EXTERNAL_FIXTURE_PATH)/package/*/*.mk))\n";
  await fs.writeFile(path.join(root, "external.mk"), line);
  const preview = await service.preview({ model: model() });
  assert.equal(preview.files.find((f) => f.path === "external.mk").after, line);
});
test("typed build systems generate documented Buildroot infrastructure macros", () => {
  const {
    renderPackage,
  } = require("../src/main/configuration/package-authoring.cjs");
  for (const [buildSystem, macro] of Object.entries({
    generic: "generic",
    autotools: "autotools",
    cmake: "cmake",
    meson: "meson",
    cargo: "cargo",
    go: "golang",
    python: "python",
  })) {
    const typed = {
      ...model(),
      buildSystem,
      ...(buildSystem === "python"
        ? { pythonSetupType: "setuptools-rust" }
        : {}),
    };
    const recipe = renderPackage(typed, "FIXTURE").files[
      "package/demo-tool/demo-tool.mk"
    ];
    assert.ok(
      recipe.endsWith(`$(eval $(${macro}-package))\n`),
      `${buildSystem} must use ${macro}-package`,
    );
    if (buildSystem === "go")
      assert.equal(recipe.includes("$(go-package)"), false);
    if (buildSystem === "python")
      assert.match(recipe, /DEMO_TOOL_SETUP_TYPE = setuptools-rust/);
  }
});

async function emptyTree(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "external-init-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = createPackageAuthoringService({
    resolveExternalTree: async () => ({ granted: true, root }),
    withLock: async (_, work) => work(),
  });
  return {
    root,
    service,
    request: {
      workspaceId: "workspace",
      externalTreeId: "selected",
      descriptor: { name: "BOARD_1", description: "Board packages" },
    },
  };
}
test("initialization previews and creates a real usable external tree without overwrites", async (t) => {
  const { root, service, request } = await emptyTree(t);
  const preview = await service.previewInitialize(request);
  assert.deepEqual(await fs.readdir(root), []);
  assert.deepEqual(
    preview.files.map((file) => file.path),
    ["external.desc", "Config.in", "external.mk"],
  );
  const result = await service.applyInitialize({
    ...request,
    revision: preview.revision,
    previewHash: preview.previewHash,
  });
  assert.equal(result.initialized, true);
  assert.equal(
    await fs.readFile(path.join(root, "external.desc"), "utf8"),
    "name: BOARD_1\ndesc: Board packages\n",
  );
  const packagePreview = await service.preview({ ...request, model: model() });
  assert.match(
    packagePreview.files.find((file) => file.path === "Config.in").after,
    /BR2_EXTERNAL_BOARD_1_PATH/,
  );
  await assert.rejects(
    service.applyInitialize({
      ...request,
      revision: preview.revision,
      previewHash: preview.previewHash,
    }),
    { code: "EXTERNAL_DIRECTORY_NOT_EMPTY" },
  );
});
test("initialization rejects changed descriptors, directory identity, and conflicting or partial trees", async (t) => {
  const { root, service, request } = await emptyTree(t);
  const preview = await service.previewInitialize(request);
  await assert.rejects(
    service.applyInitialize({
      ...request,
      descriptor: { ...request.descriptor, name: "OTHER" },
      revision: preview.revision,
      previewHash: preview.previewHash,
    }),
    { code: "PACKAGE_PREVIEW_CONFLICT" },
  );
  await fs.rename(root, root + "-previous");
  await fs.mkdir(root);
  t.after(() => fs.rm(root + "-previous", { recursive: true, force: true }));
  await assert.rejects(
    service.applyInitialize({
      ...request,
      revision: preview.revision,
      previewHash: preview.previewHash,
    }),
    { code: "ROOT_NOT_GRANTED" },
  );
  await fs.writeFile(path.join(root, "external.desc"), "name: KEEP\n");
  const regranted = createPackageAuthoringService({
    resolveExternalTree: async () => ({ granted: true, root }),
    withLock: async (_, work) => work(),
  });
  await assert.rejects(regranted.previewInitialize(request), {
    code: "EXTERNAL_DIRECTORY_NOT_EMPTY",
  });
  assert.equal(
    await fs.readFile(path.join(root, "external.desc"), "utf8"),
    "name: KEEP\n",
  );
});
test("initialization rejects descriptor injection and unknown fields", async (t) => {
  const { service, request } = await emptyTree(t);
  for (const descriptor of [
    { name: "../../bad", description: "Safe" },
    { name: "GOOD", description: "Bad\nname: EVIL" },
    { name: "GOOD", description: "$(shell bad)" },
    { name: "GOOD", description: "Safe", root: "/tmp" },
  ])
    await assert.rejects(service.previewInitialize({ ...request, descriptor }));
});
test("failed partial initialization removes only created files and preserves concurrent content", async (t) => {
  const { root, service, request } = await emptyTree(t);
  const preview = await service.previewInitialize(request);
  const link = fs.link;
  let count = 0;
  fs.link = async (...args) => {
    if (++count === 2) {
      await fs.writeFile(path.join(root, "unrelated.txt"), "preserve me");
      throw Object.assign(new Error("injected publication failure"), {
        code: "EIO",
      });
    }
    return link(...args);
  };
  try {
    await assert.rejects(
      service.applyInitialize({
        ...request,
        revision: preview.revision,
        previewHash: preview.previewHash,
      }),
      { code: "EIO" },
    );
  } finally {
    fs.link = link;
  }
  assert.deepEqual(await fs.readdir(root), ["unrelated.txt"]);
  assert.equal(
    await fs.readFile(path.join(root, "unrelated.txt"), "utf8"),
    "preserve me",
  );
});

test("an independent valid recipe update after before-image read invalidates apply", async (t) => {
  const { root, service } = await fixture(t);
  const initial = { model: model() };
  const first = await service.preview(initial);
  await service.apply({
    ...initial,
    revision: first.revision,
    previewHash: first.previewHash,
  });
  const requested = { model: { ...model(), version: "2.0" } };
  const preview = await service.preview(requested);
  const {
    renderPackage,
  } = require("../src/main/configuration/package-authoring.cjs");
  const independent = renderPackage({ ...model(), version: "1.1" }, "FIXTURE")
    .files["package/demo-tool/demo-tool.mk"];
  const target = path.join(root, "package/demo-tool/demo-tool.mk"),
    open = fs.open;
  let changed = false;
  fs.open = async (...args) => {
    const handle = await open(...args);
    if (args[0] === target && !changed) {
      const close = handle.close.bind(handle);
      handle.close = async () => {
        await close();
        if (!changed) {
          changed = true;
          await fs.writeFile(target, independent);
        }
      };
    }
    return handle;
  };
  try {
    await assert.rejects(
      service.apply({
        ...requested,
        revision: preview.revision,
        previewHash: preview.previewHash,
      }),
      { code: "REVISION_CONFLICT" },
    );
  } finally {
    fs.open = open;
  }
  assert.equal(changed, true);
  assert.equal(await fs.readFile(target, "utf8"), independent);
});
test("rollback preserves independently edited published files and reports the conflict", async (t) => {
  const { root, service } = await fixture(t);
  const request = { model: model() },
    preview = await service.preview(request);
  const rename = fs.rename;
  let count = 0;
  const edited = path.join(root, "package/demo-tool/Config.in");
  fs.rename = async (...args) => {
    if (++count === 1) {
      await fs.writeFile(edited, "# Independent edit after publication\n");
      throw Object.assign(new Error("injected later failure"), { code: "EIO" });
    }
    return rename(...args);
  };
  try {
    await assert.rejects(
      service.apply({
        ...request,
        revision: preview.revision,
        previewHash: preview.previewHash,
      }),
      { code: "PACKAGE_ROLLBACK_FAILED" },
    );
  } finally {
    fs.rename = rename;
  }
  assert.equal(
    await fs.readFile(edited, "utf8"),
    "# Independent edit after publication\n",
  );
  assert.equal(
    await fs.readFile(path.join(root, "Config.in"), "utf8"),
    "# Preserve configuration\n",
  );
});

test("target edit during temporary-file preparation is preserved before publish", async (t) => {
  const { root, service } = await fixture(t);
  const first = await service.preview({ model: model() });
  await service.apply({
    model: model(),
    revision: first.revision,
    previewHash: first.previewHash,
  });
  const requested = { model: { ...model(), version: "2.0" } },
    preview = await service.preview(requested);
  const {
    renderPackage,
  } = require("../src/main/configuration/package-authoring.cjs");
  const target = path.join(root, "package/demo-tool/demo-tool.mk");
  const independent = renderPackage({ ...model(), version: "1.1" }, "FIXTURE")
    .files["package/demo-tool/demo-tool.mk"];
  const writeFile = fs.writeFile;
  let changed = false;
  fs.writeFile = async (...args) => {
    const result = await writeFile(...args);
    if (
      !changed &&
      typeof args[0] === "string" &&
      args[0].startsWith(target + ".") &&
      args[0].endsWith(".tmp")
    ) {
      changed = true;
      await writeFile(target, independent);
    }
    return result;
  };
  try {
    await assert.rejects(
      service.apply({
        ...requested,
        revision: preview.revision,
        previewHash: preview.previewHash,
      }),
      { code: "REVISION_CONFLICT" },
    );
  } finally {
    fs.writeFile = writeFile;
  }
  assert.equal(changed, true);
  assert.equal(await fs.readFile(target, "utf8"), independent);
});
test("rollback rechecks after-image ownership after preparing restoration bytes", async (t) => {
  const { root, service } = await fixture(t);
  const first = await service.preview({ model: model() });
  await service.apply({
    model: model(),
    revision: first.revision,
    previewHash: first.previewHash,
  });
  const requested = { model: { ...model(), version: "2.0" } },
    preview = await service.preview(requested);
  const target = path.join(root, "package/demo-tool/demo-tool.mk");
  const rename = fs.rename,
    writeFile = fs.writeFile;
  let failure = false,
    changed = false;
  fs.rename = async (...args) => {
    if (!failure && args[1] === path.join(root, "Config.in")) {
      failure = true;
      throw Object.assign(new Error("later publication failure"), {
        code: "EIO",
      });
    }
    return rename(...args);
  };
  fs.writeFile = async (...args) => {
    const result = await writeFile(...args);
    if (
      failure &&
      !changed &&
      typeof args[0] === "string" &&
      args[0].startsWith(target + ".") &&
      args[0].endsWith(".tmp")
    ) {
      changed = true;
      await writeFile(target, "# Independent edit during restoration\n");
    }
    return result;
  };
  try {
    await assert.rejects(
      service.apply({
        ...requested,
        revision: preview.revision,
        previewHash: preview.previewHash,
      }),
      { code: "PACKAGE_ROLLBACK_FAILED" },
    );
  } finally {
    fs.rename = rename;
    fs.writeFile = writeFile;
  }
  assert.equal(changed, true);
  assert.equal(
    await fs.readFile(target, "utf8"),
    "# Independent edit during restoration\n",
  );
});
test("authoring refuses a selected root redirected to a different canonical directory", async (t) => {
  const { root, service } = await fixture(t);
  await service.preview({ model: model() });
  await fs.rename(root, root + "-selected");
  t.after(() => fs.rm(root + "-selected", { recursive: true, force: true }));
  await fs.symlink(root + "-selected", root);
  await assert.rejects(service.preview({ model: model() }), {
    code: "ROOT_NOT_GRANTED",
  });
});
