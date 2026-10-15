"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {
  createKconfigAdapter,
} = require("../src/main/configuration/kconfig-adapter.cjs");
const adapter = () =>
  createKconfigAdapter({
    pythonExecutable: "/usr/bin/python3",
    admitted: true,
  });
function flatten(tree) {
  return [tree, ...tree.children.flatMap(flatten)];
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "external-kconfig-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, "source"),
    outputRoot = path.join(root, "output");
  await fs.mkdir(sourceRoot);
  await fs.mkdir(outputRoot);
  await fs.writeFile(
    path.join(sourceRoot, "Config.in"),
    'mainmenu "Buildroot fixture"\nsource "$BR2_BASE_DIR/.br2-external.in.paths"\nsource "$BR2_BASE_DIR/.br2-external.in.menus"\nsource "$BR2_BASE_DIR/.br2-external.in.jpeg"\n',
  );
  const externalRoots = [];
  for (const name of ["SECOND", "FIRST"]) {
    const external = path.join(root, name);
    await fs.mkdir(external);
    await fs.writeFile(
      path.join(external, "external.desc"),
      `name: ${name}\ndesc: ${name} packages\n`,
    );
    await fs.mkdir(path.join(external, "package"));
    await fs.writeFile(
      path.join(external, "Config.in"),
      `source "$BR2_EXTERNAL_${name}_PATH/package/Config.in"\n`,
    );
    await fs.writeFile(
      path.join(external, "package/Config.in"),
      `config BR2_PACKAGE_${name}\n bool "${name} package"\n default y\n`,
    );
    externalRoots.push(external);
  }
  return {
    root,
    sourceRoot,
    outputRoot,
    kconfig: { buildroot: true, externalRoots },
  };
}
test("ordered external descriptors feed actual package and provider Kconfig read-only", async (t) => {
  const roots = await fixture(t);
  await fs.mkdir(path.join(roots.kconfig.externalRoots[0], "provides"));
  await fs.writeFile(
    path.join(roots.kconfig.externalRoots[0], "provides/jpeg.in"),
    'config BR2_PROVIDER_FIXTURE\n bool "Provider fixture"\n default y\n',
  );
  await fs.writeFile(
    path.join(roots.outputRoot, ".config"),
    "BR2_PACKAGE_FIRST=y\n# BR2_PACKAGE_SECOND is not set\n",
  );
  const result = await adapter()(roots);
  assert.deepEqual(
    result.externalTrees.map((tree) => tree.name),
    ["SECOND", "FIRST"],
  );
  const nodes = flatten(result.tree);
  const packages = nodes.filter((node) =>
    /^BR2_PACKAGE_(SECOND|FIRST)$/.test(node.symbol),
  );
  assert.deepEqual(
    packages.map((node) => node.symbol),
    ["BR2_PACKAGE_SECOND", "BR2_PACKAGE_FIRST"],
  );
  assert.equal(packages[0].value, "n");
  assert.equal(packages[1].value, "y");
  assert.equal(
    nodes.find((node) => node.symbol === "BR2_PROVIDER_FIXTURE").value,
    "y",
  );
  assert.deepEqual(await fs.readdir(roots.outputRoot), [".config"]);
});
test("external duplicate descriptors and symlink escape are rejected", async (t) => {
  const roots = await fixture(t);
  await fs.writeFile(
    path.join(roots.kconfig.externalRoots[1], "external.desc"),
    "name: SECOND\n",
  );
  await assert.rejects(adapter()(roots), {
    code: "INVALID_EXTERNAL_DESCRIPTOR",
  });
  await fs.writeFile(
    path.join(roots.kconfig.externalRoots[1], "external.desc"),
    "name: FIRST\n",
  );
  await fs.rm(path.join(roots.kconfig.externalRoots[0], "package/Config.in"));
  const outside = path.join(roots.root, "outside.in");
  await fs.writeFile(outside, 'config BR2_ESCAPE\n bool "Escape"\n');
  await fs.symlink(
    outside,
    path.join(roots.kconfig.externalRoots[0], "package/Config.in"),
  );
  await assert.rejects(adapter()(roots), { code: "KCONFIG_HELPER_FAILED" });
});
test(
  "actual downloaded Buildroot source menu inspection with a granted external package",
  { skip: !process.env.MATERIAL_BUILDROOT_KCONFIG_SOURCE },
  async (t) => {
    const roots = await fixture(t);
    roots.sourceRoot = process.env.MATERIAL_BUILDROOT_KCONFIG_SOURCE;
    roots.kconfig.environment = {
      BR2_VERSION_FULL: "2025.02.1",
      HOSTARCH: "x86_64",
      HOST_GCC_VERSION: "12",
    };
    const result = await adapter()(roots);
    const nodes = flatten(result.tree);
    assert.ok(nodes.length > 10000);
    assert.ok(nodes.some((node) => node.symbol === "BR2_PACKAGE_BUSYBOX"));
    assert.ok(nodes.some((node) => node.symbol === "BR2_PACKAGE_FIRST"));
    assert.equal(
      nodes.find((node) => node.symbol === "BR2_PACKAGE_FIRST").value,
      "y",
    );
    assert.deepEqual(await fs.readdir(roots.outputRoot), []);
  },
);

test("Windows native paths become literal forward-slash Kconfig values without changing identities", async (t) => {
  const {
    kconfigPath,
  } = require("../src/main/configuration/kconfig-adapter.cjs");
  const drive = String.raw`C:\work\external-board`;
  const unc = String.raw`\\server\share\board`;
  assert.equal(kconfigPath(drive, true), "C:/work/external-board");
  assert.equal(kconfigPath(unc, true), "//server/share/board");
  assert.equal(drive, String.raw`C:\work\external-board`);
  assert.equal(
    kconfigPath("/work/external-board", false),
    "/work/external-board",
  );
  for (const unsafe of ['C:\\bad"path', "C:\\bad$path", "C:\\bad\npath"])
    assert.throws(() => kconfigPath(unsafe, true), {
      code: "INVALID_KCONFIG_PATH",
    });
  const roots = await fixture(t);
  await fs.appendFile(
    path.join(roots.sourceRoot, "Config.in"),
    `\nconfig BR2_WINDOWS_DRIVE\n string\n default "${kconfigPath(drive, true)}"\nconfig BR2_WINDOWS_UNC\n string\n default "${kconfigPath(unc, true)}"\n`,
  );
  const nodes = flatten((await adapter()(roots)).tree);
  assert.equal(
    nodes.find((node) => node.symbol === "BR2_WINDOWS_DRIVE").value,
    "C:/work/external-board",
  );
  assert.equal(
    nodes.find((node) => node.symbol === "BR2_WINDOWS_UNC").value,
    "//server/share/board",
  );
});
