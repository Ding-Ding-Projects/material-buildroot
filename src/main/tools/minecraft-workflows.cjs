"use strict";
const { randomUUID } = require("node:crypto");
const { fail, executable, processRun } = require("./runtime.cjs");
function createWorkflows(options, owner) {
  const store = require("./minecraft-records.cjs").createRecords(options);
  const worlds = require("./minecraft-worlds.cjs").createWorlds(options, owner.assertStopped, store.log);
  const remote = require("./minecraft-remote.cjs").createRemote(options, owner.assertStopped, store);
  const players = require("./minecraft-admin.cjs").createPlayers(options, owner.assertStopped, store.log);
  let initialized, disposed = false, timer, ticking = false;
  async function initialize() {
    if (!initialized) initialized = store.update(data => {
      for (const schedule of data.schedules) { if (schedule.state === "scheduled") schedule.state = Date.parse(schedule.at) <= Date.now() ? "missed" : "requires-rescheduling"; else if (schedule.state === "running") schedule.state = "interrupted-unverified"; }
    });
    await initialized;
    if (!timer && !disposed) { timer = setInterval(() => tick().catch(() => {}), 1000); timer.unref(); }
  }
  async function tick() {
    if (disposed || ticking) return;
    ticking = true;
    try {
      const data = await store.read();
      for (const schedule of data.schedules.filter(row => row.state === "scheduled" && Date.parse(row.at) <= Date.now())) {
        let claimed = false;
        await store.update(current => { const row = current.schedules.find(item => item.id === schedule.id); if (row?.state === "scheduled") { row.state = "running"; claimed = true; } });
        if (!claimed) continue;
        let state = "stop-requested";
        try { await owner.stop(schedule.serverId); } catch { state = "failed"; }
        await store.update(current => { const row = current.schedules.find(item => item.id === schedule.id); if (row) row.state = state; store.event(current, schedule.serverId, "scheduled-stop", state); });
      }
    } finally { ticking = false; }
  }
  async function reconnect(id) {
    let record = owner.records.get(id);
    if (record?.child && !["connection-lost", "stopped", "exited", "start-failed"].includes(record.state)) return { state: record.state, readinessVerified: false };
    const saved = (await store.read()).ownership.find(row => row.serverId === id);
    if (!saved) fail("SERVER_OWNERSHIP_RECORD_REQUIRED");
    if (!["local-container", "ssh-container"].includes(saved.target)) return { state: "ownership-unverified", readinessVerified: false, recovery: "Process ownership cannot be recovered from a saved PID. Confirm the old server stopped before starting a new managed session." };
    if (!/^material-buildroot-minecraft-[a-f0-9-]{36}$/.test(saved.containerName || "") || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) fail("INVALID_SERVER_OWNERSHIP");
    if (saved.target === "ssh-container" && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(saved.host || "")) fail("INVALID_SERVER_OWNERSHIP");
    if (!options.dialog?.showMessageBox) fail("NATIVE_CONSENT_UNAVAILABLE");
    const consent = { type: "question", title: "Reconnect to an owned server container", message: "Inspect and recover management of this recorded container?", detail: (saved.host || "Local daemon") + "\n" + saved.containerName + "\nThe exact ownership label and non-root container identity must match. This does not start a server.", buttons: ["Cancel", "Reconnect"], defaultId: 0, cancelId: 0, noLink: true };
    const reply = options.parentWindow ? await options.dialog.showMessageBox(options.parentWindow, consent) : await options.dialog.showMessageBox(consent);
    if (reply.response !== 1) fail("SERVER_EXECUTION_CANCELLED");
    const args = ["inspect", "--format", "{{json .}}", saved.containerName];
    let result;
    try {
      result = saved.target === "ssh-container" ? await processRun(await executable(options, "ssh"), owner.sshArgs(saved.host, ["docker", ...args].map(owner.quote).join(" ")), { timeout: 15000 }) : await processRun(await executable(options, "docker"), args, { timeout: 15000 });
    } catch { return { state: "unreachable-or-absent", readinessVerified: false, adoptionVerified: false }; }
    const info = JSON.parse(result.stdout.trim());
    if (info.Name !== "/" + saved.containerName || info.Config?.Labels?.["com.dingdingprojects.materialbuildroot.minecraft"] !== id || info.Config?.User !== "1000:1000" || !/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(info.Config?.Image || "") || (saved.image && saved.image !== info.Config.Image)) fail("CONTAINER_OWNERSHIP_MISMATCH");
    record = { ...saved, image: info.Config.Image, child: null, resource: (saved.host ? saved.host + ":" : "") + saved.directory, state: info.State?.Running === true ? "owned-container-running" : "stopped", reconnected: true };
    owner.records.set(id, record); await store.ownership(id, record);
    return { state: record.state, adoptionVerified: true, readinessVerified: false };
  }
  async function execute(request, context = {}) {
    await initialize();
    if (request.action.startsWith("minecraft.remote.")) return remote.execute(request, context);
    if (request.action.startsWith("minecraft.records.")) return store.execute(request);
    if (request.action.startsWith("minecraft.world.")) return worlds(request, context);
    if (request.action.startsWith("minecraft.players.")) return players(request);
    if (request.action.startsWith("minecraft.fabric.")) return require("./minecraft-fabric.cjs").fabric(options, request, context);
    if (request.action === "minecraft.managed.reconnect") return reconnect(request.serverId);
    if (request.action === "minecraft.command") {
      const record = owner.records.get(request.serverId);
      if (!record || !["process-started", "ready"].includes(record.state) || !record.child?.stdin?.writable) fail("SERVER_CONSOLE_UNAVAILABLE");
      const line = require("./minecraft-admin.cjs").command(request, record);
      await new Promise((resolve, reject) => record.child.stdin.write(line + "\n", error => error ? reject(Object.assign(new Error("SERVER_INPUT_UNAVAILABLE"), { code: "SERVER_INPUT_UNAVAILABLE" })) : resolve()));
      await store.log(request.serverId, "command-" + request.operation, "sent-unacknowledged");
      return { sent: true, appliedVerified: false };
    }
    if (request.action === "minecraft.schedule.list") return { schedules: (await store.read()).schedules };
    if (request.action === "minecraft.schedule.add") {
      const record = owner.records.get(request.serverId);
      if (!record || !["process-started", "ready", "owned-container-running"].includes(record.state)) fail("SERVER_NOT_RUNNING");
      const id = randomUUID();
      return store.update(data => { if (data.schedules.length >= 100) fail("SCHEDULE_LIMIT"); data.schedules.push({ id, serverId: request.serverId, operation: "stop", at: new Date(request.at).toISOString(), timeZone: request.timeZone, state: "scheduled" }); store.event(data, request.serverId, "schedule-stop", "scheduled"); return { scheduled: true, id, requiresApplicationRunning: true }; });
    }
    if (request.action === "minecraft.schedule.cancel") return store.update(data => { const row = data.schedules.find(item => item.id === request.id); if (!row || row.state !== "scheduled") fail("SCHEDULE_NOT_CANCELLABLE"); row.state = "cancelled"; store.event(data, row.serverId, "schedule-stop", "cancelled"); return { cancelled: true }; });
    fail("INVALID_REQUEST");
  }
  return { execute, store, worlds, busy: directory => worlds.busy(directory) || players.busy(directory) || remote.busy(directory), initialize, dispose() { disposed = true; clearInterval(timer); remote.dispose(); } };
}
module.exports = { createWorkflows };
