"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { fail } = require("./runtime.cjs");
const { safeName } = require("./zip-payload.cjs");
function inside(root, relative) {
  if (!safeName(relative) || relative.endsWith("/")) fail("INVALID_BUNDLED_MANIFEST");
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep)) fail("INVALID_BUNDLED_MANIFEST");
  return target;
}
function loadBundledPayloads(resources = process.resourcesPath) {
  if (!resources) return {};
  const root = path.join(resources, "offline-payloads");
  const file = path.join(root, "manifest.json");
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 ** 2) fail("INVALID_BUNDLED_MANIFEST");
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  if (document.schemaVersion !== 1 || document.platform !== "win32-x64" || !Array.isArray(document.tools) || document.tools.length > 32) fail("INVALID_BUNDLED_MANIFEST");
  const result = Object.create(null);
  for (const item of document.tools) {
    if (!/^[a-z][a-z0-9-]{0,40}$/.test(item.id || "") || Object.hasOwn(result, item.id) || !Array.isArray(item.files) || !item.files.length || item.files.length > 100000 || typeof item.version !== "string") fail("INVALID_BUNDLED_MANIFEST");
    const files = item.files.map(member => {
      if (!/^[a-f0-9]{64}$/.test(member.sha256 || "") || !Number.isSafeInteger(member.bytes) || member.bytes < 0) fail("INVALID_BUNDLED_MANIFEST");
      return { path: inside(root, member.path), sha256: member.sha256, bytes: member.bytes };
    });
    if (new Set(files.map(member => member.path.toLowerCase())).size !== files.length) fail("INVALID_BUNDLED_MANIFEST");
    const executable = inside(root, item.executable);
    const member = files.find(entry => entry.path === executable);
    if (!member) fail("INVALID_BUNDLED_MANIFEST");
    result[item.id] = { path: executable, sha256: member.sha256, version: item.version, files, root };
  }
  return result;
}
module.exports = { loadBundledPayloads };
