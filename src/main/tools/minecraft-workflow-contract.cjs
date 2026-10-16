"use strict";
const { fail, text, token } = require("./runtime.cjs");
const actions = ["minecraft.remote.list", "minecraft.remote.preview", "minecraft.remote.execute", "minecraft.remote.cancel", "minecraft.remote.status", "minecraft.world.list", "minecraft.world.preview", "minecraft.world.execute", "minecraft.records.list", "minecraft.records.save", "minecraft.records.import", "minecraft.records.export", "minecraft.players.read", "minecraft.players.write", "minecraft.command", "minecraft.schedule.add", "minecraft.schedule.cancel", "minecraft.schedule.list", "minecraft.managed.reconnect", "minecraft.fabric.options", "minecraft.fabric.install"];
function validate(request) {
  if (request.action.startsWith("minecraft.remote.")) return require("./minecraft-remote.cjs").validate(request);
  const keys = (required, optional = []) => { if (required.some(key => !Object.hasOwn(request, key)) || Object.keys(request).some(key => !["action", ...required, ...optional].includes(key))) fail("INVALID_REQUEST"); };
  const edition = () => { if (!["java", "bedrock"].includes(request.edition)) fail("INVALID_REQUEST"); };
  switch (request.action) {
    case "minecraft.records.list": case "minecraft.schedule.list": keys([]); break;
    case "minecraft.records.save": keys(["profile"]); require("./minecraft-records.cjs").profile(request.profile); break;
    case "minecraft.records.import": keys(["sourceId"]); text(request.sourceId); break;
    case "minecraft.records.export": keys(["destinationId"]); text(request.destinationId); break;
    case "minecraft.world.list": keys(["directoryId", "edition"]); text(request.directoryId); edition(); break;
    case "minecraft.world.preview":
      keys(["directoryId", "destinationId", "edition", "version", "flavour", "operation", "world", "destinationName", "confirmStopped"], ["sourceId"]);
      text(request.directoryId); text(request.destinationId); edition(); token(request.version);
      if (!["vanilla", "paper", "fabric"].includes(request.flavour) || !["backup", "restore"].includes(request.operation) || request.confirmStopped !== true) fail("INVALID_REQUEST");
      require("./minecraft-worlds.cjs").name(request.world); require("./minecraft-worlds.cjs").name(request.destinationName);
      if (request.operation === "restore") text(request.sourceId); else if (request.sourceId !== undefined) fail("INVALID_REQUEST");
      break;
    case "minecraft.world.execute": keys(["previewId", "confirmSha256"]); text(request.previewId, 80); if (!/^[a-f0-9]{64}$/.test(request.confirmSha256 || "")) fail("INVALID_REQUEST"); break;
    case "minecraft.players.read": keys(["directoryId", "edition", "collection"]); text(request.directoryId); edition(); if (!["allowlist", "permissions"].includes(request.collection)) fail("INVALID_REQUEST"); break;
    case "minecraft.players.write":
      keys(["directoryId", "edition", "collection", "operation", "player", "revision", "confirmStopped"]); text(request.directoryId); edition();
      if (!["allowlist", "permissions"].includes(request.collection) || !["upsert", "remove"].includes(request.operation) || request.confirmStopped !== true || !/^[a-f0-9]{64}$/.test(request.revision || "")) fail("INVALID_REQUEST");
      require("./minecraft-admin.cjs").player(request.player, request.edition, request.collection); break;
    case "minecraft.command": keys(["serverId", "operation"], ["message", "rule", "value"]); text(request.serverId, 64); if (!["list", "say", "difficulty", "rule"].includes(request.operation)) fail("INVALID_REQUEST"); break;
    case "minecraft.managed.reconnect": keys(["serverId"]); text(request.serverId, 64); break;
    case "minecraft.schedule.add":
      keys(["serverId", "operation", "at", "timeZone"]); text(request.serverId, 64); text(request.timeZone, 80);
      if (request.operation !== "stop" || typeof request.at !== "string" || !Number.isFinite(Date.parse(request.at)) || Date.parse(request.at) < Date.now() + 1000 || Date.parse(request.at) > Date.now() + 30 * 86400000) fail("INVALID_SCHEDULE");
      try { new Intl.DateTimeFormat("en", { timeZone: request.timeZone }); } catch { fail("INVALID_TIME_ZONE"); } break;
    case "minecraft.schedule.cancel": keys(["id"]); text(request.id, 80); break;
    case "minecraft.fabric.options": keys(["version"]); token(request.version); break;
    case "minecraft.fabric.install": keys(["version", "loader", "installer", "directoryId", "acceptLicense", "acceptRuntimeDownloads"]); token(request.version); token(request.loader); token(request.installer); text(request.directoryId); if (request.acceptLicense !== true || request.acceptRuntimeDownloads !== true) fail("FABRIC_CONSENT_REQUIRED"); break;
    default: fail("INVALID_REQUEST");
  }
}
module.exports = { actions, validate };
