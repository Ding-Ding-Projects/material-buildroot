"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const digest = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const NAME = /^[A-Za-z0-9_.+-]+_defconfig$/;
async function safeFile(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4 * 1024 * 1024 || await fs.realpath(file) !== file) fail("UNSAFE_DEFCONFIG_PATH");
  return fs.readFile(file, "utf8");
}
function createDefconfigWorkflows({ resolveProject, authorize, configuration, execute }) {
  async function context(workspaceId) {
    const item = resolveProject(workspaceId);
    const trust = await authorize(workspaceId);
    if (item.source === item.output) fail("SEPARATE_OUTPUT_REQUIRED");
    return { item, trust, roots: [item.source, ...item.externalTrees] };
  }
  async function catalog(input) {
    const { item, trust, roots } = await context(input.workspaceId);
    const entries = [];
    for (const [order, root] of roots.entries()) {
      const directory = path.join(root, "configs");
      const stat = await fs.lstat(directory).catch(error => { if (error.code === "ENOENT") return null; throw error; });
      if (!stat) continue;
      if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(directory) !== directory) fail("UNSAFE_DEFCONFIG_PATH");
      const names = await fs.readdir(directory);
      if (names.length > 10000 || entries.length + names.length > 20000) fail("DEFCONFIG_LIMIT");
      for (const name of names.sort()) {
        if (!NAME.test(name)) continue;
        const text = await safeFile(path.join(directory, name));
        entries.push({ id: digest(JSON.stringify([order, root, name])), name, origin: order === 0 ? "buildroot" : "external", order, root, sha256: digest(text) });
      }
    }
    resolveProject(input.workspaceId);
    await authorize(input.workspaceId);
    const revision = digest(JSON.stringify({ source: trust.sourceRevision, configuration: trust.configRevision, roots, entries }));
    return { revision, sourceRoot: item.source, outputRoot: item.output, externalTrees: item.externalTrees, entries };
  }
  async function apply(input) {
    const listing = await catalog(input);
    if (listing.revision !== input.revision) fail("DEFCONFIG_CATALOG_CHANGED");
    const entry = listing.entries.find(value => value.id === input.id);
    if (!entry) fail("INVALID_DEFCONFIG");
    const text = await safeFile(path.join(entry.root, "configs", entry.name));
    if (digest(text) !== entry.sha256) fail("DEFCONFIG_CATALOG_CHANGED");
    const current = await configuration.inspect({ workspaceId: input.workspaceId });
    const result = await configuration.applySnapshot({ workspaceId: input.workspaceId, revision: current.revision }, text);
    return { ...result, provenance: { name: entry.name, origin: entry.origin, order: entry.order, sha256: entry.sha256, externalTrees: listing.externalTrees, outputRoot: listing.outputRoot } };
  }
  async function save(input) {
    const listing = await catalog(input);
    if (listing.revision !== input.revision) fail("DEFCONFIG_CATALOG_CHANGED");
    const { item, trust } = await context(input.workspaceId);
    const output = path.join(item.output, "material-minimal-defconfig");
    // The fixed runtime target must never follow an old output link or overwrite a file.
    if (await fs.lstat(output).catch(error => { if (error.code === "ENOENT") return null; throw error; })) fail("MINIMAL_OUTPUT_EXISTS");
    const result = await execute(input.workspaceId);
    if (result.state !== "succeeded") fail("SAVEDEFCONFIG_FAILED");
    resolveProject(input.workspaceId);
    const text = await safeFile(output);
    const provenance = { version: 1, operation: "savedefconfig", sha256: digest(text), sourceRevision: trust.sourceRevision, configRevision: trust.configRevision, externalTrees: item.externalTrees, runtime: item.runtime, savedAt: new Date().toISOString() };
    const receiptName = "material-minimal-defconfig." + randomUUID() + ".json";
    await fs.writeFile(path.join(item.output, receiptName), JSON.stringify(provenance, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    return { path: "material-minimal-defconfig", receipt: receiptName, content: text, provenance };
  }
  return { catalog, apply, save };
}
module.exports = { createDefconfigWorkflows };
