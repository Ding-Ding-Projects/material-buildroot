"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { fail, grant } = require("./runtime.cjs");
const ID = /^[A-Za-z0-9_-]{1,64}$/;
function profile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_SERVER_PROFILE");
  const keys = ["id", "edition", "version", "flavour", "target", "memoryMiB", "port"];
  if (Object.keys(input).some(key => !keys.includes(key)) || !ID.test(input.id || "") || !["java", "bedrock"].includes(input.edition) || !["vanilla", "paper", "fabric"].includes(input.flavour) || !["local-process", "local-container", "ssh-process", "ssh-container"].includes(input.target) || typeof input.version !== "string" || !/^[A-Za-z0-9_.+-]{1,80}$/.test(input.version) || !Number.isInteger(input.memoryMiB) || input.memoryMiB < 512 || input.memoryMiB > 32768 || !Number.isInteger(input.port) || input.port < 1024 || input.port > 65535) fail("INVALID_SERVER_PROFILE");
  if (input.edition === "bedrock" && input.flavour !== "vanilla") fail("INVALID_SERVER_PROFILE");
  return structuredClone(input);
}
function createRecords(options) {
  let tail = Promise.resolve();
  const root = options.minecraftManagedDirectory;
  async function read() {
    if (typeof root !== "string" || !path.isAbsolute(root)) fail("SERVER_RECORD_STORE_UNAVAILABLE");
    const file = path.join(root, "records.json");
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4194304) fail("INVALID_SERVER_RECORD_STORE");
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      if (data.schema !== 1 || !Array.isArray(data.profiles) || !Array.isArray(data.history) || !Array.isArray(data.ownership) || !Array.isArray(data.schedules) || data.profiles.length > 100 || data.ownership.length > 100 || data.schedules.length > 100 || data.history.length > 1000) fail("INVALID_SERVER_RECORD_STORE");
      data.profiles.forEach(profile);
      return data;
    } catch (error) { if (error.code === "ENOENT") return { schema: 1, profiles: [], history: [], ownership: [], schedules: [] }; throw error; }
  }
  async function update(work) {
    const task = tail.then(async () => {
      const data = await read(), result = await work(data);
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      const stat = await fs.lstat(root);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail("INVALID_SERVER_RECORD_STORE");
      const temporary = path.join(root, ".records-" + randomUUID());
      try { await fs.writeFile(temporary, JSON.stringify(data), { flag: "wx", mode: 0o600 }); await fs.rename(temporary, path.join(root, "records.json")); }
      finally { await fs.rm(temporary, { force: true }); }
      return result;
    });
    tail = task.catch(() => {}); return task;
  }
  function event(data, serverId, operation, state) {
    data.history.push({ id: randomUUID(), at: new Date().toISOString(), serverId, operation, state });
    data.history = data.history.slice(-1000);
  }
  async function log(serverId, operation, state) { return update(data => event(data, serverId, operation, state)); }
  async function ownership(serverId, record) {
    return update(data => {
      data.ownership = data.ownership.filter(row => row.serverId !== serverId);
      if (data.ownership.length >= 100) fail("SERVER_RECORD_LIMIT");
      data.ownership.push({ serverId, target: record.target, edition: record.edition, version: record.version, flavour: record.flavour, containerName: record.containerName, host: record.host || null, directory: record.directory, sourceDigest: record.sourceDigest, image: record.image || null, state: record.state, updatedAt: new Date().toISOString() });
      event(data, serverId, "lifecycle", record.state);
    });
  }
  async function execute(request) {
    if (request.action === "minecraft.records.list") { const data = await read(); return { profiles: data.profiles, history: data.history.slice(-100), schedules: data.schedules, ownership: data.ownership.map(({ serverId, target, state, updatedAt }) => ({ serverId, target, state, updatedAt, adoptionVerified: false })) }; }
    if (request.action === "minecraft.records.save") {
      const value = profile(request.profile);
      return update(data => { const index = data.profiles.findIndex(item => item.id === value.id); if (index < 0) { if (data.profiles.length >= 100) fail("SERVER_PROFILE_LIMIT"); data.profiles.push(value); } else data.profiles[index] = value; event(data, value.id, "profile-save", "saved"); return { saved: true }; });
    }
    if (request.action === "minecraft.records.export") {
      const data = await read(), destination = await grant(options, request.destinationId, "write");
      await fs.writeFile(destination, JSON.stringify({ schema: 1, kind: "minecraft-server-profiles", profiles: data.profiles }, null, 2), { flag: "wx", mode: 0o600 });
      return { exported: data.profiles.length, includesCredentials: false, includesPaths: false, includesAuthority: false };
    }
    if (request.action === "minecraft.records.import") {
      const source = await grant(options, request.sourceId, "read"), stat = await fs.lstat(source);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 131072) fail("INVALID_PROFILE_IMPORT");
      const input = JSON.parse(await fs.readFile(source, "utf8"));
      if (input.schema !== 1 || input.kind !== "minecraft-server-profiles" || Object.keys(input).some(key => !["schema", "kind", "profiles"].includes(key)) || !Array.isArray(input.profiles) || input.profiles.length > 100) fail("INVALID_PROFILE_IMPORT");
      const values = input.profiles.map(profile);
      if (new Set(values.map(p => p.id)).size !== values.length) fail("DUPLICATE_SERVER_PROFILE");
      return update(data => { if (values.some(p => data.profiles.some(old => old.id === p.id))) fail("PROFILE_ALREADY_EXISTS"); if (data.profiles.length + values.length > 100) fail("SERVER_PROFILE_LIMIT"); data.profiles.push(...values); event(data, "profiles", "profile-import", "saved"); return { imported: values.length, executionAuthorized: false }; });
    }
    fail("INVALID_REQUEST");
  }
  return { read, update, log, ownership, execute, event };
}
module.exports = { createRecords, profile };
