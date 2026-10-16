"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { fail, grant } = require("./runtime.cjs");
const { inspectCanonicalPath } = require("../security/file-grants.cjs");
const hash = text => createHash("sha256").update(text).digest("hex");
function player(input, edition, collection) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_PLAYER");
  const allowed = edition === "java" ? ["uuid", "name", "level", "bypassesPlayerLimit"] : ["name", "xuid", "ignoresPlayerLimit", "permission"];
  if (Object.keys(input).some(key => !allowed.includes(key))) fail("INVALID_PLAYER");
  if (edition === "java") {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.uuid || "") || !/^[A-Za-z0-9_]{1,16}$/.test(input.name || "")) fail("INVALID_PLAYER_IDENTITY");
    if (collection === "permissions" && (!Number.isInteger(input.level) || input.level < 1 || input.level > 4 || typeof input.bypassesPlayerLimit !== "boolean")) fail("INVALID_PLAYER_PERMISSION");
  } else {
    if (collection === "allowlist" && (typeof input.name !== "string" || !/^[A-Za-z0-9 _-]{1,64}$/.test(input.name) || typeof input.ignoresPlayerLimit !== "boolean")) fail("INVALID_PLAYER_IDENTITY");
    if ((collection === "permissions" || input.xuid) && !/^[0-9]{1,20}$/.test(input.xuid || "")) fail("INVALID_PLAYER_IDENTITY");
    if (collection === "permissions" && !["visitor", "member", "operator"].includes(input.permission)) fail("INVALID_PLAYER_PERMISSION");
  }
  return structuredClone(input);
}
function command(request, record) {
  if (request.operation === "list") return "list";
  if (!record.versionVerified) fail("SERVER_VERSION_NOT_VERIFIED");
  if (request.operation === "say") {
    if (typeof request.message !== "string" || !request.message.length || request.message.length > 256 || /[\r\n\x00-\x1f]/.test(request.message)) fail("INVALID_SERVER_MESSAGE");
    return "say " + request.message;
  }
  if (request.operation === "difficulty") {
    if (!["peaceful", "easy", "normal", "hard"].includes(request.value)) fail("INVALID_COMMAND_VALUE");
    return "difficulty " + request.value;
  }
  if (request.operation === "rule") {
    const rules = record.edition === "bedrock" ? ["keepinventory", "dodaylightcycle", "doweathercycle", "mobgriefing"] : ["keepInventory", "doDaylightCycle", "doWeatherCycle", "mobGriefing"];
    // Java 1.21.9 and newer changed configuration/rule semantics. Do not infer them.
    if (record.edition === "java") {
      const match = /^1\.(\d+)(?:\.(\d+))?$/.exec(record.version || "");
      if (!match || Number(match[1]) < 13 || Number(match[1]) > 21 || (Number(match[1]) === 21 && Number(match[2] || 0) > 8)) fail("RULE_VERSION_UNAVAILABLE");
    } else fail("BEDROCK_VERSION_DESCRIPTOR_UNAVAILABLE");
    if (!rules.includes(request.rule) || typeof request.value !== "boolean") fail("INVALID_COMMAND_VALUE");
    return "gamerule " + request.rule + " " + request.value;
  }
  fail("UNSUPPORTED_SERVER_COMMAND");
}
function createPlayers(options, assertStopped, log) {
  const locks = new Set();
  async function execute(request) {
    const directory = await grant(options, request.directoryId, "write");
    if (await options.authorizeServerExecution?.(request.directoryId) !== true) fail("SERVER_EXECUTION_CONSENT_REQUIRED");
    const filename = request.edition === "java" ? request.collection === "permissions" ? "ops.json" : "whitelist.json" : request.collection === "permissions" ? "permissions.json" : "allowlist.json";
    const file = path.join(directory, filename);
    if (locks.has(file)) fail("SERVER_BUSY");
    locks.add(file);
    try {
      let original = "[]", exists = false;
      let stat;
      try { stat = await fs.lstat(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (stat) { inspectCanonicalPath(file); if (!stat.isFile() || stat.size > 1048576) fail("PLAYER_FILE_LIMIT"); original = await fs.readFile(file, "utf8"); exists = true; }
      const entries = JSON.parse(original);
      if (!Array.isArray(entries) || entries.length > 10000 || entries.some(value => !value || typeof value !== "object" || Array.isArray(value))) fail("INVALID_PLAYER_FILE");
      if (request.action === "minecraft.players.read") return { entries, revision: hash(original), restartRequired: true };
      if (request.confirmStopped !== true) fail("STOPPED_SERVER_CONFIRMATION_REQUIRED");
      await assertStopped(directory);
      if (request.revision !== hash(original)) fail("PLAYER_FILE_CHANGED");
      const value = player(request.player, request.edition, request.collection);
      const key = request.edition === "java" ? "uuid" : request.collection === "permissions" ? "xuid" : "name";
      const index = entries.findIndex(entry => entry[key] === value[key]);
      if (request.operation === "remove") { if (index < 0) fail("PLAYER_NOT_FOUND"); entries.splice(index, 1); }
      else if (index < 0) { if (entries.length >= 10000) fail("PLAYER_FILE_LIMIT"); entries.push(value); }
      else entries[index] = { ...entries[index], ...value };
      const temporary = path.join(directory, ".players-" + randomUUID());
      try {
        await fs.writeFile(temporary, JSON.stringify(entries, null, 2) + "\n", { flag: "wx", mode: 0o600 });
        if (exists) { inspectCanonicalPath(file); if (hash(await fs.readFile(file, "utf8")) !== request.revision) fail("PLAYER_FILE_CHANGED"); await fs.copyFile(file, file + ".backup-" + randomUUID(), fs.constants.COPYFILE_EXCL); }
        await fs.rename(temporary, file);
      } finally { await fs.rm(temporary, { force: true }); }
      await log("players", request.collection + "-" + request.operation, "saved");
      return { saved: true, restartRequired: true, entries, revision: hash(JSON.stringify(entries, null, 2) + "\n") };
    } finally { locks.delete(file); }
  }
  execute.busy = directory => [...locks].some(file => path.dirname(file) === directory);
  return execute;
}
module.exports = { player, command, createPlayers };
