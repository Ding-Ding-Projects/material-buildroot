"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { fail, grant, digest } = require("./runtime.cjs");
const { inspectCanonicalPath } = require("../security/file-grants.cjs");
function name(value) { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) fail("INVALID_WORLD_NAME"); return value; }
async function inventory(root, signal) {
  inspectCanonicalPath(root);
  const files = []; let bytes = 0;
  async function walk(directory, relative = "") {
    if (signal?.aborted) fail("CANCELLED");
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".material-world-backup.json") continue;
      if (!require("./zip-payload.cjs").safeName(entry.name)) fail("UNSAFE_WORLD_PATH");
      const file = path.join(directory, entry.name), rel = relative ? relative + "/" + entry.name : entry.name;
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) fail("UNSAFE_WORLD_PATH");
      if (stat.isDirectory()) { if (rel.split("/").length > 32) fail("WORLD_DEPTH_LIMIT"); await walk(file, rel); }
      else if (stat.isFile()) {
        bytes += stat.size;
        if (files.length >= 100000 || bytes > 16 * 1024 ** 3) fail("WORLD_TRANSFER_LIMIT");
        const sha256 = await digest(file), after = await fs.lstat(file);
        if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ino !== after.ino) fail("WORLD_CHANGED");
        files.push({ path: rel, bytes: stat.size, sha256 });
      } else fail("UNSAFE_WORLD_PATH");
    }
  }
  await walk(root);
  if (!files.some(file => file.path === "level.dat")) fail("WORLD_LEVEL_DATA_REQUIRED");
  if (files.some(file => file.path === ".material-transfer-incomplete")) fail("WORLD_TRANSFER_INCOMPLETE");
  return { files, bytes, sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex") };
}
function createWorlds(options, assertStopped, log) {
  const previews = new Map(), active = new Set();
  async function execute(request, context = {}) {
    if (request.action === "minecraft.world.list") {
      const directory = await grant(options, request.directoryId, "write");
      const root = request.edition === "bedrock" ? path.join(directory, "worlds") : directory;
      inspectCanonicalPath(root);
      const worlds = [];
      for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.isSymbolicLink() || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(entry.name)) continue;
        try { const file = path.join(root, entry.name, "level.dat"); inspectCanonicalPath(file); if ((await fs.lstat(file)).isFile()) worlds.push({ name: entry.name }); } catch {}
        if (worlds.length >= 1000) fail("WORLD_LIST_LIMIT");
      }
      return { worlds };
    }
    if (request.action === "minecraft.world.preview") {
      if (request.confirmStopped !== true) fail("STOPPED_SERVER_CONFIRMATION_REQUIRED");
      const directory = await grant(options, request.directoryId, "write");
      await assertStopped(directory);
      const destinationRoot = await grant(options, request.destinationId, "write");
      const world = name(request.world), destinationName = name(request.destinationName);
      const source = request.operation === "backup" ? path.join(directory, ...(request.edition === "bedrock" ? ["worlds"] : []), world) : await grant(options, request.sourceId, "read");
      const destination = path.join(destinationRoot, destinationName);
      if (path.resolve(source) === path.resolve(destination) || path.resolve(destination).startsWith(path.resolve(source) + path.sep)) fail("WORLD_DESTINATION_OVERLAP");
      try { await fs.lstat(destination); fail("OUTPUT_ALREADY_EXISTS"); } catch (error) { if (error.code !== "ENOENT") throw error; }
      const content = await inventory(source, context.signal);
      if (request.operation === "restore") {
        const manifest = path.join(source, ".material-world-backup.json");
        inspectCanonicalPath(manifest);
        const stat = await fs.lstat(manifest);
        if (!stat.isFile() || stat.size > 32 * 1024 * 1024) fail("INVALID_WORLD_BACKUP");
        const saved = JSON.parse(await fs.readFile(manifest, "utf8"));
        if (saved.schema !== 1 || saved.edition !== request.edition || saved.version !== request.version || saved.flavour !== request.flavour || saved.sha256 !== content.sha256) fail("WORLD_BACKUP_COMPATIBILITY_MISMATCH");
      }
      for (const [id, preview] of previews) if (preview.expires < Date.now()) previews.delete(id);
      if (previews.size >= 10) fail("WORLD_PREVIEW_LIMIT");
      const previewId = randomUUID();
      previews.set(previewId, { ...request, source, destination, directory, content, expires: Date.now() + 600000 });
      return { previewId, operation: request.operation, world, destinationName, files: content.files.length, bytes: content.bytes, sha256: content.sha256, expiresAt: new Date(Date.now() + 600000).toISOString(), overwrite: false, worldActivated: false };
    }
    const preview = previews.get(request.previewId);
    if (!preview || preview.expires < Date.now() || preview.content.sha256 !== request.confirmSha256) fail("WORLD_PREVIEW_REQUIRED");
    if (active.has(preview.directory)) fail("SERVER_BUSY");
    active.add(preview.directory); previews.delete(request.previewId);
    let destinationCreated = false;
    try {
      await assertStopped(preview.directory);
      await grant(options, preview.directoryId, "write"); await grant(options, preview.destinationId, "write");
      if (preview.sourceId) await grant(options, preview.sourceId, "read");
      const current = await inventory(preview.source, context.signal);
      if (current.sha256 !== preview.content.sha256) fail("WORLD_CHANGED");
      await fs.mkdir(preview.destination, { mode: 0o700 }); destinationCreated = true;
      await fs.writeFile(path.join(preview.destination, ".material-transfer-incomplete"), "Transfer is incomplete. Do not run this copy.\n", { flag: "wx", mode: 0o600 });
      for (const file of current.files) {
        if (context.signal?.aborted) fail("CANCELLED");
        const source = path.join(preview.source, file.path), destination = path.join(preview.destination, file.path);
        inspectCanonicalPath(source);
        await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
        inspectCanonicalPath(path.dirname(destination));
        await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
        if (await digest(destination) !== file.sha256 || await digest(source) !== file.sha256) fail("WORLD_CHANGED");
      }
      const final = await inventory(preview.source, context.signal);
      if (final.sha256 !== current.sha256) fail("WORLD_CHANGED");
      if (preview.operation === "backup") await fs.writeFile(path.join(preview.destination, ".material-world-backup.json"), JSON.stringify({ schema: 1, edition: preview.edition, version: preview.version, flavour: preview.flavour, createdAt: new Date().toISOString(), ...current }), { flag: "wx", mode: 0o600 });
      await fs.unlink(path.join(preview.destination, ".material-transfer-incomplete"));
      await log("worlds", preview.operation, "completed");
      return { completed: true, files: current.files.length, bytes: current.bytes, destinationName: preview.destinationName, worldActivated: false };
    } catch (error) { if (destinationCreated) await log("worlds", preview.operation, "incomplete-copy-preserved"); throw error; }
    finally { active.delete(preview.directory); }
  }
  execute.busy = directory => active.has(directory);
  return execute;
}
module.exports = { createWorlds, name, inventory };
