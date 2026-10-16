"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { fail, grant, digest } = require("./runtime.cjs");
const { inspectCanonicalPath } = require("../security/file-grants.cjs");
const revision = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function regular(file) { inspectCanonicalPath(file); const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024 ** 2) fail("UNSAFE_EXTENSION_FILE"); }
function createExtensions(options, assertStopped, log) {
  const locks = new Set();
  async function execute(request, context = {}) {
    const root = await grant(options, request.directoryId, "write");
    if (await options.authorizeServerExecution?.(request.directoryId) !== true) fail("SERVER_EXECUTION_CONSENT_REQUIRED");
    if (locks.has(root)) fail("EXTENSION_OPERATION_BUSY");
    locks.add(root);
    let staging, completed = false;
    try {
      const registryPath = path.join(root, ".material-extension-registry.json");
      let registry = { schema: 1, projects: [] };
      try { await regular(registryPath); const stat = await fs.stat(registryPath); if (stat.size > 1048576) fail("EXTENSION_REGISTRY_LIMIT"); registry = JSON.parse(await fs.readFile(registryPath, "utf8")); } catch (error) { if (error.code !== "ENOENT" && !String(error.message).includes("Selected file is unavailable")) throw error; if (error.code !== "ENOENT") { try { await fs.lstat(registryPath); throw error; } catch (missing) { if (missing.code !== "ENOENT") throw missing; } } }
      if (registry.schema !== 1 || !Array.isArray(registry.projects) || registry.projects.length > 100) fail("INVALID_EXTENSION_REGISTRY");
      const safeRecord = record => record && /^[A-Za-z0-9]{1,64}$/.test(record.projectId || "") && (record.current === null || validVersion(record.current)) && Array.isArray(record.history) && record.history.length <= 20 && record.history.every(validVersion);
      if (!registry.projects.every(safeRecord)) fail("INVALID_EXTENSION_REGISTRY");
      if (request.action === "minecraft.extensions.list") {
        let recoveryProject = null;
        try { const marker = path.join(root, ".material-extension-incomplete"); await regular(marker); const saved = JSON.parse(await fs.readFile(marker, "utf8")); if (/^[A-Za-z0-9]{1,64}$/.test(saved.projectId || "")) recoveryProject = saved.projectId; } catch (error) { if (error.code !== "ENOENT" && !String(error.message).includes("Selected file is unavailable")) throw error; }
        return { projects: registry.projects, revision: revision(registry), recoveryProject };
      }
      if (request.confirmStopped !== true || request.acceptPluginCode !== true || request.acceptLicense !== true) fail("PLUGIN_CONSENT_REQUIRED");
      await assertStopped(root);
      if (request.revision !== revision(registry)) fail("EXTENSION_REGISTRY_CHANGED");
      const distributionPath = path.join(root, "material-server-distribution.json");
      await regular(distributionPath);
      const distribution = JSON.parse(await fs.readFile(distributionPath, "utf8"));
      if (distribution.edition !== "java" || distribution.version !== request.gameVersion || distribution.flavour !== request.loader || !["paper", "fabric"].includes(request.loader) || await digest(path.join(root, distribution.entryPoint === "fabric-server-launch.jar" ? "fabric-server-launch.jar" : "server.jar")) !== distribution.sha256) fail("EXTENSION_SERVER_IDENTITY_MISMATCH");
      const folder = path.join(root, request.loader === "fabric" ? "mods" : "plugins");
      await fs.mkdir(folder, { mode: 0o700 }).catch(error => { if (error.code !== "EEXIST") throw error; });
      inspectCanonicalPath(folder);
      const historyRoot = path.join(root, ".material-extension-history");
      await fs.mkdir(historyRoot, { mode: 0o700 }).catch(error => { if (error.code !== "EEXIST") throw error; });
      inspectCanonicalPath(historyRoot);
      if (request.action === "minecraft.extensions.recover") {
        const marker = path.join(root, ".material-extension-incomplete");
        await regular(marker);
        const saved = JSON.parse(await fs.readFile(marker, "utf8"));
        if (saved.schema !== 1 || saved.projectId !== request.projectId || (saved.previous !== null && !validVersion(saved.previous)) || (saved.proposed !== null && !validVersion(saved.proposed))) fail("INVALID_EXTENSION_RECOVERY");
        for (const item of [saved.previous, saved.proposed].filter(Boolean)) if (item.gameVersion !== request.gameVersion || item.loader !== request.loader) fail("EXTENSION_ROLLBACK_INCOMPATIBLE");
        if (saved.proposed) {
          const proposedPath = path.join(folder, saved.proposed.filename);
          let present = false; try { await fs.lstat(proposedPath); present = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
          if (present) {
            await regular(proposedPath); const actual = await digest(proposedPath, "sha512");
            if (saved.previous && saved.previous.filename === saved.proposed.filename && actual === saved.previous.sha512) {}
            else {
              if (actual !== saved.proposed.sha512) fail("EXTENSION_FILE_CHANGED");
              const recovery = path.join(historyRoot, "recovery-" + randomUUID() + ".jar");
              await fs.copyFile(proposedPath, recovery, fs.constants.COPYFILE_EXCL);
              if (await digest(recovery, "sha512") !== actual || await digest(proposedPath, "sha512") !== actual) fail("EXTENSION_FILE_CHANGED");
              await fs.unlink(proposedPath);
            }
          }
        }
        if (saved.previous) {
          const backup = path.join(historyRoot, saved.previous.snapshotId + ".jar"), destination = path.join(folder, saved.previous.filename);
          await regular(backup); if (await digest(backup, "sha512") !== saved.previous.sha512) fail("EXTENSION_BACKUP_CHANGED");
          try { await fs.copyFile(backup, destination, fs.constants.COPYFILE_EXCL); } catch (error) { if (error.code !== "EEXIST") throw error; }
          await regular(destination); if (await digest(destination, "sha512") !== saved.previous.sha512) fail("EXTENSION_FILE_CHANGED");
        }
        let row = registry.projects.find(item => item.projectId === saved.projectId);
        if (!row) { if (registry.projects.length >= 100) fail("EXTENSION_REGISTRY_LIMIT"); row = { projectId: saved.projectId, current: null, history: [] }; registry.projects.push(row); }
        row.current = saved.previous; row.history = row.history.filter(item => item.snapshotId !== saved.previous?.snapshotId);
        const temporary = registryPath + "." + randomUUID();
        await fs.writeFile(temporary, JSON.stringify(registry), { flag: "wx", mode: 0o600 }); await fs.rename(temporary, registryPath);
        await fs.unlink(marker);
        await log("extensions", "recover", "prior-version-restored");
        return { recovered: true, restartRequired: true, revision: revision(registry) };
      }
      let project = registry.projects.find(item => item.projectId === request.projectId), candidate, source;
      if (request.action === "minecraft.extensions.install") {
        staging = path.join(root, ".material-extension-stage-" + randomUUID());
        await fs.mkdir(staging, { mode: 0o700 });
        const result = await require("./minecraft-catalog.cjs").catalog({ ...options, resolveGrant: async (id, mode) => id === "host-extension-stage" && mode === "write" ? staging : options.resolveGrant(id, mode) }, { action: "minecraft.plugin.install", versionId: request.versionId, directoryId: "host-extension-stage", acceptPluginCode: true, acceptLicense: true, gameVersion: request.gameVersion, loader: request.loader }, context);
        if (!/^[A-Za-z0-9]{1,64}$/.test(result.projectId || "") || !result.filename) fail("INVALID_PLUGIN_METADATA");
        project = registry.projects.find(item => item.projectId === result.projectId);
        if (!project) { if (registry.projects.length >= 100) fail("EXTENSION_REGISTRY_LIMIT"); project = { projectId: result.projectId, current: null, history: [] }; registry.projects.push(project); }
        source = path.join(staging, result.filename);
        candidate = { snapshotId: randomUUID(), versionId: request.versionId, filename: result.filename, sha512: result.sha512, bytes: result.bytes, gameVersion: request.gameVersion, loader: request.loader, storedAt: new Date().toISOString() };
      } else {
        if (!project) fail("EXTENSION_NOT_MANAGED");
        if (request.action === "minecraft.extensions.rollback") {
          candidate = project.history.find(item => item.snapshotId === request.snapshotId);
          if (!candidate || candidate.gameVersion !== request.gameVersion || candidate.loader !== request.loader) fail("EXTENSION_ROLLBACK_INCOMPATIBLE");
          source = path.join(historyRoot, candidate.snapshotId + ".jar"); await regular(source);
          if (await digest(source, "sha512") !== candidate.sha512) fail("EXTENSION_BACKUP_CHANGED");
          candidate = { ...candidate, snapshotId: randomUUID(), storedAt: new Date().toISOString() };
        }
      }
      const current = project.current, oldPath = current ? path.join(folder, current.filename) : null;
      if (current) { await regular(oldPath); if (await digest(oldPath, "sha512") !== current.sha512) fail("EXTENSION_FILE_CHANGED"); }
      if (current && project.history.length >= 20) fail("EXTENSION_HISTORY_LIMIT");
      if (context.signal?.aborted) fail("CANCELLED");
      const journal = path.join(root, ".material-extension-incomplete");
      await fs.writeFile(journal, JSON.stringify({ schema: 1, projectId: project.projectId, operation: request.action, previous: current, proposed: candidate || null }), { flag: "wx", mode: 0o600 });
      let removed = false;
      try {
        if (current) {
          const backup = path.join(historyRoot, current.snapshotId + ".jar");
          try { await fs.copyFile(oldPath, backup, fs.constants.COPYFILE_EXCL); } catch (error) { if (error.code !== "EEXIST") throw error; }
          if (await digest(backup, "sha512") !== current.sha512 || await digest(oldPath, "sha512") !== current.sha512) fail("EXTENSION_FILE_CHANGED");
          project.history = project.history.filter(item => item.snapshotId !== current.snapshotId);
          project.history.push(current);
          await fs.unlink(oldPath); removed = true;
        }
        if (candidate) {
          const destination = path.join(folder, candidate.filename);
          await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
          if (await digest(destination, "sha512") !== candidate.sha512) fail("EXTENSION_PAYLOAD_CHANGED");
        }
        project.current = candidate || null;
        const temporary = registryPath + "." + randomUUID();
        await fs.writeFile(temporary, JSON.stringify(registry), { flag: "wx", mode: 0o600 });
        await fs.rename(temporary, registryPath);
        await fs.unlink(journal);
      } catch (error) {
        if (removed && current) { try { await fs.copyFile(path.join(historyRoot, current.snapshotId + ".jar"), oldPath, fs.constants.COPYFILE_EXCL); } catch {} }
        throw error;
      }
      completed = true;
      await log("extensions", request.action.split(".").pop(), "saved-restart-required");
      return { completed: true, projectId: project.projectId, restartRequired: true, revision: revision(registry), rollbackRetained: Boolean(current) };
    } finally {
      if (staging && completed) { const files = await fs.readdir(staging).catch(() => []); for (const file of files) { if (/^[A-Za-z0-9_. -]+\.jar$/.test(file)) await fs.unlink(path.join(staging, file)).catch(() => {}); } await fs.rmdir(staging).catch(() => {}); }
      locks.delete(root);
    }
  }
  return { execute, busy: root => locks.has(root) };
}
function validVersion(value) {
  return value && /^[a-f0-9-]{36}$/.test(value.snapshotId || "") && /^[A-Za-z0-9_. -]+\.jar$/.test(value.filename || "") && !value.filename.startsWith(".") && /^[a-f0-9]{128}$/.test(value.sha512 || "") && Number.isSafeInteger(value.bytes) && value.bytes > 0 && typeof value.gameVersion === "string" && ["paper", "fabric"].includes(value.loader);
}
module.exports = { createExtensions };
