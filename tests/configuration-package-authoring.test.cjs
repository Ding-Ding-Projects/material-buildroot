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
    if (++count === 4)
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
