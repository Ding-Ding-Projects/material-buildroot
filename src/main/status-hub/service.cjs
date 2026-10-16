"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Reference the maintained trusted-process client. Never bundle its private
// emission implementation or enrollment credentials into this application.
function resolveClient(documentsDirectory) {
  const root = path.join(documentsDirectory, "GitHub", "agent-global-memory", "libraries", "status-hub-client", "js");
  const entry = path.join(root, "status-hub-client.cjs");
  if (!fs.existsSync(entry)) return null;
  return require(entry);
}

function createStatusService({ documentsDirectory, repositoryDirectory }) {
  let client = null;
  let library = null;
  let pending = null;
  let closed = false;
  let code = "STARTING";
  let lastAttemptAt = null;
  const snapshot = () => {
    const status = client?.status();
    const delivered = !!status?.lastSuccessAt && !status?.lastError && !status?.degraded;
    return Object.freeze({
      state: closed ? "closed" : delivered ? "connected" : code === "STARTING" ? "starting" : "unavailable",
      code: closed ? "CLOSED" : delivered ? "CONNECTED" : code,
      lastAttemptAt,
      lastSuccessAt: status?.lastSuccessAt || null,
      authenticated: delivered,
    });
  };
  async function inventory() {
    // Installed distributions have no source checkout to report.
    if (!fs.existsSync(path.join(repositoryDirectory, ".git"))) return [];
    return library.collectWorktrees({ repoPath: repositoryDirectory });
  }
  async function initialize() {
    try {
      library = resolveClient(documentsDirectory);
      if (!library) { code = "CLIENT_UNAVAILABLE"; return snapshot(); }
      if (!process.env.AGENT_INGEST_TOKEN) { code = "MISSING_ENROLLMENT"; return snapshot(); }
      lastAttemptAt = new Date().toISOString();
      const worktrees = await inventory();
      const ownTree = worktrees.find(tree => path.resolve(tree.path) === path.resolve(repositoryDirectory));
      client = await library.createStatusHubClient({
        sessionId: `material-buildroot-${randomUUID()}`,
        title: "Material Buildroot desktop session",
        repository: "Ding-Ding-Projects/material-buildroot",
        machine: await library.machineLabel(),
        worktrees: await inventory(),
        status: "running",
        summary: "Desktop process started; runtime feature verification has not been performed.",
        exitHooks: false,
      });
      code = "DELIVERY_UNAVAILABLE";
    } catch { code = "CLIENT_UNAVAILABLE"; }
    return snapshot();
  }
  const ready = initialize();
  async function refresh() {
    await ready;
    if (closed || !client) return snapshot();
    if (pending) return pending;
    pending = (async () => {
      lastAttemptAt = new Date().toISOString();
      try {
        const result = await client.pollAtCheckpoint({
          status: "running",
          summary: "Desktop status requested; no runtime verification result is implied.",
          worktrees: await inventory(),
        });
        code = result.ok ? "CONNECTED" : "DELIVERY_UNAVAILABLE";
      } catch { code = "DELIVERY_UNAVAILABLE"; }
      return snapshot();
    })().finally(() => { pending = null; });
    return pending;
  }
  async function close() {
    closed = true;
    await ready;
    await pending;
    try { await client?.finish("waiting", { summary: "Desktop process closed; no task completion is claimed." }); }
    catch { /* Shutdown continues after a bounded client failure. */ }
  }
  return Object.freeze({ snapshot, refresh, close });
}
module.exports = { createStatusService };

