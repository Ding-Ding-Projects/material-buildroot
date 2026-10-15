"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {
  createPackageDiscoveryService,
} = require("../src/main/configuration/package-discovery.cjs");
const {
  renderPackage,
  createPackageAuthoringService,
} = require("../src/main/configuration/package-authoring.cjs");
function model(name = "demo") {
  return {
    name,
    version: "1.0",
    source: "https://example.invalid/demo.tar.gz",
    sourceFilename: "demo.tar.gz",
    homepage: "https://example.invalid/demo",
    license: "MIT",
    licenseFiles: ["LICENSE"],
    buildSystem: "cmake",
    dependencies: [],
    configDependencies: [],
    help: "Discovered useful package.",
    hashes: [
      { algorithm: "sha256", digest: "a".repeat(64), file: "demo.tar.gz" },
      { algorithm: "sha256", digest: "b".repeat(64), file: "LICENSE" },
    ],
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "package-discovery-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, "source"),
    external = path.join(root, "external");
  await fs.mkdir(sourceRoot);
  await fs.mkdir(external);
  for (const tree of [sourceRoot, external]) {
    await fs.mkdir(path.join(tree, "package"));
  }
  await fs.writeFile(path.join(external, "external.desc"), "name: FIXTURE\n");
  await fs.writeFile(path.join(external, "Config.in"), "# Existing\n");
  await fs.writeFile(path.join(external, "external.mk"), "# Existing\n");
  async function recipe(tree, name) {
    for (const [relative, text] of Object.entries(
      renderPackage(model(name), "FIXTURE").files,
    )) {
      await fs.mkdir(path.dirname(path.join(tree, relative)), {
        recursive: true,
      });
      await fs.writeFile(path.join(tree, relative), text);
    }
  }
  await recipe(sourceRoot, "upstream");
  await recipe(external, "local");
  const service = createPackageDiscoveryService({
    resolveRoots: async () => ({
      granted: true,
      sourceRoot,
      externalTrees: [{ id: "external-id", root: external }],
    }),
    withLock: async (_, work) => work(),
  });
  return { root, sourceRoot, external, service, recipe };
}
test("actual source and external identities paginate search and expose literal symbol provenance", async (t) => {
  const { service } = await fixture(t);
  const page = await service.discover({ workspaceId: "w", limit: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.packages.length, 1);
  assert.equal(page.packages[0].treeId, "source");
  assert.equal(page.packages[0].symbols[0].name, "BR2_PACKAGE_UPSTREAM");
  assert.deepEqual(page.packages[0].symbols[0].location, {
    path: "package/upstream/Config.in",
    line: 1,
  });
  const filtered = await service.discover({
    workspaceId: "w",
    query: "br2_package_local",
    limit: 100,
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.packages[0].treeId, "external-id");
  assert.equal(filtered.revision, page.revision);
  await assert.rejects(service.discover({ workspaceId: "w", limit: 101 }), {
    code: "INVALID_DISCOVERY_REQUEST",
  });
});
test("generator-compatible existing recipes import as typed drafts with exact byte receipts", async (t) => {
  const { service, external } = await fixture(t);
  const page = await service.discover({ workspaceId: "w", query: "local" });
  const result = await service.importPackage({
    workspaceId: "w",
    packageId: page.packages[0].id,
    revision: page.revision,
  });
  assert.equal(result.roundTripAllowed, true);
  assert.deepEqual(result.draft, model("local"));
  assert.match(result.symbols[0].help, /Discovered useful package/);
  for (const file of result.files)
    assert.deepEqual(
      Buffer.from(file.bytesBase64, "base64"),
      await fs.readFile(path.join(external, "package/local", file.path)),
    );
});
test("custom recipes retain exact bytes and cannot be overwritten through authoring preview", async (t) => {
  const { service, external } = await fixture(t);
  const file = path.join(external, "package/local/local.mk");
  await fs.appendFile(
    file,
    "\ndefine LOCAL_BUILD_CMDS\n\t$(MAKE) -C $(@D)\nendef\n",
  );
  const original = await fs.readFile(file);
  const page = await service.discover({ workspaceId: "w", query: "local" });
  const imported = await service.importPackage({
    workspaceId: "w",
    packageId: page.packages[0].id,
    revision: page.revision,
  });
  assert.equal(imported.roundTripAllowed, false);
  assert.equal(imported.draft, null);
  assert.ok(imported.unsupportedReasons.length);
  const authoring = createPackageAuthoringService({
    resolveExternalTree: async () => ({ granted: true, root: external }),
    withLock: async (_, work) => work(),
  });
  await assert.rejects(authoring.preview({ model: model("local") }), {
    code: "PACKAGE_MANUAL_EDIT_REQUIRED",
  });
  assert.deepEqual(await fs.readFile(file), original);
});
test("comments remain byte-preserved and block lossy roundtrip while exposing a useful draft", async (t) => {
  const { service, external } = await fixture(t);
  const file = path.join(external, "package/local/local.mk");
  await fs.appendFile(file, "# Maintainer rationale\r\n");
  const page = await service.discover({ workspaceId: "w", query: "local" });
  const imported = await service.importPackage({
    workspaceId: "w",
    packageId: page.packages[0].id,
    revision: page.revision,
  });
  assert.equal(imported.roundTripAllowed, false);
  assert.equal(imported.draft.name, "local");
  assert.ok(
    imported.unsupportedReasons.some((reason) => reason.includes("comments")),
  );
});
test("stale discovery symlink escapes and oversized response content are bounded", async (t) => {
  const { service, external, sourceRoot } = await fixture(t);
  const page = await service.discover({ workspaceId: "w", query: "local" });
  await fs.appendFile(
    path.join(external, "package/local/local.mk"),
    "# changed\n",
  );
  await assert.rejects(
    service.importPackage({
      workspaceId: "w",
      packageId: page.packages[0].id,
      revision: page.revision,
    }),
    { code: "REVISION_CONFLICT" },
  );
  await fs.writeFile(
    path.join(external, "package/local/large.patch"),
    Buffer.alloc(100000, 65),
  );
  const updated = await service.discover({ workspaceId: "w", query: "local" });
  const imported = await service.importPackage({
    workspaceId: "w",
    packageId: updated.packages[0].id,
    revision: updated.revision,
  });
  const large = imported.files.find((file) => file.path === "large.patch");
  assert.equal(large.available, false);
  assert.equal(large.size, 100000);
  assert.equal(large.sha256.length, 64);
  assert.equal(large.bytesBase64, undefined);
  assert.equal(imported.roundTripAllowed, false);
  await fs.symlink(os.tmpdir(), path.join(sourceRoot, "package/escape"));
  const discovered = await service.discover({ workspaceId: "w" });
  assert.ok(
    discovered.warnings.some((warning) => warning.reason === "Symlink skipped"),
  );
  await fs.symlink(
    path.join(sourceRoot, "package/upstream/upstream.mk"),
    path.join(external, "package/local/escape.mk"),
  );
  await assert.rejects(
    service.importPackage({
      workspaceId: "w",
      packageId: updated.packages[0].id,
      revision: (await service.discover({ workspaceId: "w" })).revision,
    }),
    { code: "UNSAFE_PACKAGE_PATH" },
  );
});
test(
  "actual downloaded Buildroot package catalogue exposes real identifiers without accepting custom roundtrip",
  { skip: !process.env.MATERIAL_BUILDROOT_KCONFIG_SOURCE },
  async () => {
    const service = createPackageDiscoveryService({
      resolveRoots: async () => ({
        granted: true,
        sourceRoot: process.env.MATERIAL_BUILDROOT_KCONFIG_SOURCE,
      }),
      withLock: async (_, work) => work(),
    });
    const all = await service.discover({ workspaceId: "w", limit: 1 });
    assert.ok(all.total > 3000);
    const found = await service.discover({
      workspaceId: "w",
      query: "busybox",
      limit: 100,
    });
    const busybox = found.packages.find((item) => item.name === "busybox");
    assert.ok(
      busybox.symbols.some((symbol) => symbol.name === "BR2_PACKAGE_BUSYBOX"),
    );
    const zlib = (
      await service.discover({ workspaceId: "w", query: "zlib", limit: 100 })
    ).packages.find((item) => item.name === "zlib");
    const imported = await service.importPackage({
      workspaceId: "w",
      packageId: zlib.id,
      revision: found.revision,
    });
    assert.equal(imported.roundTripAllowed, false);
    assert.ok(imported.files.length);
  },
);
test("host-only and recipes without Kconfig declarations remain searchable", async (t) => {
  const { service, sourceRoot, recipe } = await fixture(t);
  await recipe(sourceRoot, "host-only");
  await fs.rename(
    path.join(sourceRoot, "package/host-only/Config.in"),
    path.join(sourceRoot, "package/host-only/Config.in.host"),
  );
  await recipe(sourceRoot, "no-config");
  await fs.rm(path.join(sourceRoot, "package/no-config/Config.in"));
  const host = await service.discover({ workspaceId: "w", query: "host-only" });
  assert.equal(host.total, 1);
  assert.equal(
    host.packages[0].symbols[0].location.path,
    "package/host-only/Config.in.host",
  );
  const missing = await service.discover({
    workspaceId: "w",
    query: "no-config",
  });
  assert.equal(missing.total, 1);
  assert.equal(missing.packages[0].symbols.length, 0);
});
test("changed granted roots and symlink substitutions fail instead of silently granting a replacement", async (t) => {
  const { service, sourceRoot } = await fixture(t);
  await service.discover({ workspaceId: "w" });
  await fs.rename(sourceRoot, sourceRoot + "-original");
  await fs.mkdir(sourceRoot);
  await assert.rejects(service.discover({ workspaceId: "w" }), {
    code: "ROOT_NOT_GRANTED",
  });
  await fs.rmdir(sourceRoot);
  await fs.symlink(sourceRoot + "-original", sourceRoot);
  await assert.rejects(service.discover({ workspaceId: "w" }), {
    code: "ROOT_NOT_GRANTED",
  });
});
test("file changes during an open bounded read invalidate discovery before returning content", async (t) => {
  const { service, sourceRoot } = await fixture(t);
  const target = path.join(sourceRoot, "package/upstream/upstream.mk");
  const originalOpen = fs.open;
  let injected = false;
  fs.open = async (...args) => {
    const handle = await originalOpen(...args);
    if (args[0] === target && !injected) {
      injected = true;
      const read = handle.read.bind(handle);
      handle.read = async (...readArgs) => {
        const result = await read(...readArgs);
        await fs.appendFile(target, "# concurrent edit\n");
        return result;
      };
    }
    return handle;
  };
  try {
    await assert.rejects(service.discover({ workspaceId: "w" }), {
      code: "PACKAGE_SOURCE_CHANGED",
    });
  } finally {
    fs.open = originalOpen;
  }
});
test("discovery request rejects unknown fields and caller paths", async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(service.discover({ workspaceId: "w", root: "/tmp" }), {
    code: "INVALID_DISCOVERY_REQUEST",
  });
  await assert.rejects(
    service.importPackage({
      workspaceId: "w",
      packageId: "../escape",
      revision: "a".repeat(64),
    }),
    { code: "INVALID_DISCOVERY_REQUEST" },
  );
});
test("outside-grant hardlinked files are rejected by discovery and import", async (t) => {
  const { service, external, root } = await fixture(t);
  const page = await service.discover({ workspaceId: "w", query: "local" });
  const outside = path.join(root, "outside-fixture.txt");
  await fs.writeFile(outside, "harmless outside grant fixture");
  await fs.link(outside, path.join(external, "package/local/outside.txt"));
  await assert.rejects(
    service.importPackage({
      workspaceId: "w",
      packageId: page.packages[0].id,
      revision: page.revision,
    }),
    { code: "UNSAFE_PACKAGE_PATH" },
  );
  await fs.unlink(path.join(external, "package/local/local.mk"));
  await fs.link(outside, path.join(external, "package/local/local.mk"));
  await assert.rejects(service.discover({ workspaceId: "w" }), {
    code: "UNSAFE_PACKAGE_PATH",
  });
  assert.equal(
    await fs.readFile(outside, "utf8"),
    "harmless outside grant fixture",
  );
});
test("shared config receipts and retained symbols are bounded independently of recipe multiplicity", async (t) => {
  const { service, external } = await fixture(t);
  const directory = path.join(external, "package/shared");
  await fs.mkdir(directory);
  const declarations = Array.from(
    { length: 600 },
    (_, i) =>
      `config BR2_SHARED_${i}\n bool "Shared ${i}"\n help\n\t  ${"Bounded help. ".repeat(50)}\n`,
  ).join("");
  await fs.writeFile(path.join(directory, "Config.in"), declarations);
  for (let i = 0; i < 60; i++)
    await fs.writeFile(
      path.join(directory, `recipe-${i}.mk`),
      `# Actual recipe fixture ${i}\n`,
    );
  const page = await service.discover({
    workspaceId: "w",
    query: "recipe-",
    limit: 100,
  });
  assert.equal(page.total, 60);
  assert.equal(page.symbolStats.declaredCount, 602);
  assert.ok(page.symbolStats.retainedCount <= 514);
  assert.ok(page.symbolStats.retainedBytes <= 131072 + 4096);
  assert.ok(page.symbolStats.revisionInputBytes < 32768);
  assert.ok(page.symbolStats.truncated);
  assert.equal(page.packages[0].symbolCount, 600);
  assert.equal(page.packages[0].symbolsTruncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(page)) < 600000);
  const changed = declarations.replace("BR2_SHARED_599", "BR2_CHANGED_599");
  await fs.writeFile(path.join(directory, "Config.in"), changed);
  const newer = await service.discover({
    workspaceId: "w",
    query: "recipe-",
    limit: 1,
  });
  assert.notEqual(page.revision, newer.revision);
});
