"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { fail, grant, executable, digest, processRun } = require("./runtime.cjs");
const targets = ["local-process", "local-container", "ssh-process", "ssh-container"];
const quote = (value) => "'" + value.replace(/'/g, "'\\''") + "'";
function validate(request) {
  const allowed = ["action", "serverId", "directoryId", "edition", "target", "memoryMiB", "image", "host", "remoteDirectory", "port", "acceptExecution", "acceptEula", "properties", "version", "flavour"];
  if (Object.keys(request).some((key) => !allowed.includes(key))) fail("INVALID_REQUEST");
  if (!["minecraft.managed.start", "minecraft.managed.stop", "minecraft.managed.status", "minecraft.configuration.read", "minecraft.configuration.save"].includes(request.action)) fail("INVALID_REQUEST");
  if (request.action.startsWith("minecraft.configuration.")) {
    if (typeof request.directoryId !== "string") fail("FILE_GRANT_REQUIRED");
    if (!["java", "bedrock"].includes(request.edition)) fail("INVALID_REQUEST");
    if (request.action.endsWith("save")) {
      if (request.acceptEula !== true) fail("EULA_ACCEPTANCE_REQUIRED");
      configuration(request.properties, request.edition);
    }
    return;
  }
  if (typeof request.serverId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(request.serverId)) fail("INVALID_SERVER_ID");
  if (request.action !== "minecraft.managed.start") return;
  if (typeof request.version !== "string" || !/^[A-Za-z0-9_.+-]{1,80}$/.test(request.version) || !["vanilla", "paper", "fabric"].includes(request.flavour)) fail("INVALID_SERVER_VERSION");
  if (!targets.includes(request.target) || !["java", "bedrock"].includes(request.edition)) fail("INVALID_REQUEST");
  if (request.acceptExecution !== true || request.acceptEula !== true) fail("SERVER_EXECUTION_CONSENT_REQUIRED");
  if (!Number.isInteger(request.memoryMiB) || request.memoryMiB < 512 || request.memoryMiB > 32768) fail("INVALID_REQUEST");
  if (!Number.isInteger(request.port) || request.port < 1024 || request.port > 65535) fail("INVALID_SERVER_PORT");
  if (request.target.startsWith("ssh-")) {
    if (typeof request.host !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(request.host)) fail("INVALID_SSH_HOST_ALIAS");
    if (typeof request.remoteDirectory !== "string" || !/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(request.remoteDirectory) || request.remoteDirectory.split("/").some((part) => part === ".." || part === ".")) fail("INVALID_REMOTE_DIRECTORY");
  } else if (typeof request.directoryId !== "string") fail("FILE_GRANT_REQUIRED");
  if (request.target.endsWith("container") && (typeof request.image !== "string" || !/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(request.image))) fail("PINNED_CONTAINER_IMAGE_REQUIRED");
}
function configuration(input, edition) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_SERVER_PROPERTY");
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const rules = {
    "server-port": (v) => integer(v, 1024, 65535),
    "max-players": (v) => integer(v, 1, 1000),
    difficulty: (v) => ["peaceful", "easy", "normal", "hard"].includes(v),
    gamemode: (v) => (edition === "java" ? ["survival", "creative", "adventure", "spectator"] : ["survival", "creative", "adventure"]).includes(v),
    "online-mode": (v) => v === true,
    [edition === "java" ? "white-list" : "allow-list"]: (v) => typeof v === "boolean",
    [edition === "java" ? "motd" : "server-name"]: (v) => typeof v === "string" && v.length <= 128 && !/[\r\n\x00-\x1f\\]/.test(v),
    "level-name": (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v),
  };
  for (const [key, value] of Object.entries(input)) if (!Object.hasOwn(rules, key) || !rules[key](value)) fail("INVALID_SERVER_PROPERTY");
  return input;
}
async function regular(file, limit = 1024 * 1024) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) fail("UNSAFE_SERVER_FILE");
  return stat;
}
function createManagedMinecraft(options) {
  const records = new Map(), locks = new Set();
  let disposed = false;
  async function localDirectory(request) {
    const directory = await grant(options, request.directoryId, "write");
    if (await options.authorizeServerExecution?.(request.directoryId) !== true) fail("SERVER_EXECUTION_CONSENT_REQUIRED");
    return directory;
  }
  const sshArgs = (host, command) => ["-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2", "--", host, command];
  async function assertStopped(directory) {
    if (locks.has(directory) || [...records.values()].some(r => r.directory === directory && !["stopped", "exited", "start-failed"].includes(r.state))) fail("STOP_SERVER_BEFORE_EDITING");
    const saved = (await workflows.store.read()).ownership.find(r => r.directory === directory && !["stopped", "exited", "start-failed"].includes(r.state));
    if (saved && !records.has(saved.serverId)) fail("SERVER_OWNERSHIP_RECONCILIATION_REQUIRED");
  }
  const workflows = require("./minecraft-workflows.cjs").createWorkflows(options, { records, assertStopped, stop, sshArgs, quote });
  async function execute(request, context = {}) {
    if (require("./minecraft-workflow-contract.cjs").actions.includes(request.action)) { require("./minecraft-workflow-contract.cjs").validate(request); if (disposed) fail("SERVICE_DISPOSED"); return workflows.execute(request, context); }
    validate(request);
    await workflows.initialize();
    if (disposed) fail("SERVICE_DISPOSED");
    if (request.action.startsWith("minecraft.configuration.")) {
      const directory = await localDirectory(request), file = path.join(directory, "server.properties");
      if (locks.has(directory)) fail("SERVER_BUSY");
      locks.add(directory);
      try {
        let existing = "";
        try { await regular(file); existing = await fs.readFile(file, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
        if (request.action.endsWith("read")) {
          const values = {};
          for (const line of existing.split(/\r?\n/)) {
            const match = /^([a-z-]+)=(.*)$/.exec(line);
            if (match && ["server-port", "max-players", "difficulty", "gamemode", "online-mode", "white-list", "allow-list", "motd", "server-name", "level-name"].includes(match[1])) values[match[1]] = match[2];
          }
          return { properties: values, exists: Boolean(existing), restartRequired: true };
        }
        if ([...records.values()].some((record) => record.directory === directory && !["stopped", "exited"].includes(record.state))) fail("STOP_SERVER_BEFORE_CONFIGURATION");
        const values = configuration(request.properties, request.edition), pending = new Set(Object.keys(values));
        const lines = existing.split(/\r?\n/).filter((line) => line.length).map((line) => {
          const match = /^\s*([a-z-]+)\s*[=:]/.exec(line);
          if (!match || !Object.hasOwn(values, match[1])) return line;
          if (!pending.has(match[1])) return "";
          pending.delete(match[1]);
          return match[1] + "=" + values[match[1]];
        });
        for (const key of pending) lines.push(key + "=" + values[key]);
        if (request.edition === "java") {
          const eula = path.join(directory, "eula.txt");
          try { await regular(eula); if (!/^eula=true\s*$/m.test(await fs.readFile(eula, "utf8"))) fail("EXISTING_EULA_NOT_ACCEPTED"); }
          catch (error) { if (error.code !== "ENOENT") throw error; await fs.writeFile(eula, "eula=true\n", { flag: "wx", mode: 0o600 }); }
        }
        const temporary = path.join(directory, ".configuration-" + randomUUID());
        try {
          await fs.writeFile(temporary, lines.filter(Boolean).join("\n") + "\n", { flag: "wx", mode: 0o600 });
          if (existing) await fs.copyFile(file, file + ".backup-" + randomUUID(), fs.constants.COPYFILE_EXCL);
          await fs.rename(temporary, file);
        } finally { await fs.rm(temporary, { force: true }); }
        await workflows.store.log("configuration", "save", "saved-restart-required");
        return { saved: true, restartRequired: true, unknownPropertiesPreserved: true };
      } finally { locks.delete(directory); }
    }
    const id = request.serverId;
    if (request.action === "minecraft.managed.status") {
      const record = records.get(id);
      if (!record) { const saved = (await workflows.store.read()).ownership.find(row => row.serverId === id); if (saved) return { state: ["stopped", "exited", "start-failed"].includes(saved.state) ? "recorded-stopped" : "ownership-unverified", readinessVerified: false, adoptionVerified: false }; }
      return record ? { state: record.state, readinessState: record.readinessState || "unknown", persistenceFailed: record.persistenceFailed === true, players: record.players || null, target: record.target, edition: record.edition, exitCode: record.exitCode ?? null, processSpawned: Boolean(record.child), readinessVerified: false } : { state: "not-managed", readinessVerified: false };
    }
    if (request.action === "minecraft.managed.stop") return stop(id);
    if (locks.has(id) || (records.has(id) && !["stopped", "exited", "start-failed"].includes(records.get(id).state))) fail("SERVER_ALREADY_MANAGED");
    const savedIdentity = (await workflows.store.read()).ownership.find(row => row.serverId === id);
    if (savedIdentity && !records.has(id) && !["stopped", "exited", "start-failed"].includes(savedIdentity.state)) fail("SERVER_OWNERSHIP_RECONCILIATION_REQUIRED");
    locks.add(id);
    let resource, ownsResource = false;
    try {
      const remote = request.target.startsWith("ssh-"), container = request.target.endsWith("container");
      const directory = remote ? request.remoteDirectory : await localDirectory(request);
      if (!remote && workflows.busy(directory)) fail("WORLD_TRANSFER_ACTIVE");
      const previousDirectoryOwner = (await workflows.store.read()).ownership.find(row => row.directory === directory && (row.host || "") === (remote ? request.host : "") && !["stopped", "exited", "start-failed"].includes(row.state));
      if (previousDirectoryOwner && !records.has(previousDirectoryOwner.serverId)) fail("SERVER_OWNERSHIP_RECONCILIATION_REQUIRED");
      resource = (remote ? request.host + ":" : "") + directory;
      if (locks.has(resource) || [...records.values()].some(r => r.resource === resource && !["stopped", "exited", "start-failed"].includes(r.state))) fail("SERVER_DIRECTORY_IN_USE");
      locks.add(resource); ownsResource = true;
      const entry = request.edition === "java" ? "server.jar" : remote || container || process.platform !== "win32" ? "bedrock_server" : "bedrock_server.exe";
      if (!remote) {
        if (typeof process.getuid === "function" && process.getuid() === 0) fail("ROOT_EXECUTION_REFUSED");
        await regular(path.join(directory, entry), 1024 ** 3);
        if (request.edition === "java") { await regular(path.join(directory, "eula.txt")); if (!/^eula=true\s*$/m.test(await fs.readFile(path.join(directory, "eula.txt"), "utf8"))) fail("EULA_ACCEPTANCE_REQUIRED"); }
        if (container && directory.includes(",")) fail("INVALID_MOUNT_PATH");
      }
      const sourceDigest = !remote ? await digest(path.join(directory, entry)) : null;
      let versionVerified = false;
      if (!remote) { try { const receiptPath = path.join(directory, "material-server-distribution.json"); await regular(receiptPath); const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8")); versionVerified = receipt.schema === 1 && receipt.edition === request.edition && receipt.version === request.version && receipt.flavour === request.flavour && receipt.sha256 === sourceDigest; } catch (error) { if (error.code !== "ENOENT") throw error; } }
      const consent = { type: "warning", title: "Run selected Minecraft server", message: "Run this trusted server using " + request.target + "?", detail: (remote ? request.host + ":" : "") + directory + "\n\nServer files, plugins and the selected container image can execute code. SSH uses existing authentication and requires a previously trusted host key. Remote servers must already be installed and configured. This does not install or migrate a world.", buttons: ["Cancel", "Run server"], defaultId: 0, cancelId: 0, noLink: true };
      if (!options.dialog?.showMessageBox) fail("NATIVE_CONSENT_UNAVAILABLE");
      const accepted = options.parentWindow ? await options.dialog.showMessageBox(options.parentWindow, consent) : await options.dialog.showMessageBox(consent);
      if (accepted.response !== 1) fail("SERVER_EXECUTION_CANCELLED");
      let command, args;
      const name = "material-buildroot-minecraft-" + randomUUID();
      const launch = request.edition === "java" ? ["java", "-Xms512M", "-Xmx" + request.memoryMiB + "M", "-jar", "server.jar", "nogui"] : ["./bedrock_server"];
      const containerArgs = ["run", "--pull=never", "--rm", "--name", name, "--label", "com.dingdingprojects.materialbuildroot.minecraft=" + id, "--interactive", "--user", "1000:1000", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--memory", request.memoryMiB + "m", "--cpus", "2", "--publish", "127.0.0.1:" + request.port + ":" + request.port + (request.edition === "java" ? "/tcp" : "/udp"), "--mount", "type=bind,source=" + directory + ",target=/server", "--workdir", "/server", "--env", "LD_LIBRARY_PATH=/server", request.image, ...launch];
      if (remote) {
        command = await executable(options, "ssh");
        const invocation = (container ? ["docker", ...containerArgs] : launch).map(quote).join(" ");
        const script = "test \"$(id -u)\" -ne 0 && cd " + quote(directory) + " && test -f " + quote(entry) + (request.edition === "java" ? " && grep -qx 'eula=true' eula.txt" : "") + " && export LD_LIBRARY_PATH=. && exec " + invocation;
        args = sshArgs(request.host, script);
      } else if (container) { command = await executable(options, "docker"); args = containerArgs; }
      else if (request.edition === "java") { command = await executable(options, "java"); args = launch.slice(1); }
      else { command = path.join(directory, entry); await digest(command); args = []; }
      if (!remote && await digest(path.join(directory, entry)) !== sourceDigest) fail("SERVER_PAYLOAD_CHANGED");
      if (disposed) fail("SERVICE_DISPOSED");
      const prepared = { command, directory, resource, sourceDigest, target: request.target, edition: request.edition, version: request.version, flavour: request.flavour, versionVerified, image: request.image || null, host: request.host, containerName: container ? name : null, state: "starting" };
      await workflows.store.ownership(id, prepared);
      const child = spawn(command, args, { cwd: remote ? undefined : directory, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "ignore"], env: { ...process.env, ...(request.edition === "bedrock" && !remote && !container && process.platform !== "win32" ? { LD_LIBRARY_PATH: directory } : {}) } });
      const record = { ...prepared, child };
      const persist = () => workflows.store.ownership(id, record).catch(() => { record.persistenceFailed = true; });
      let output = "";
      child.stdout.on("data", chunk => { output = (output + chunk.toString("utf8")).slice(-4096); if (record.versionVerified && record.edition === "java" && /Done \([0-9.,]+s\)!/.test(output)) { record.readinessState = "server-reported-ready"; } const match = /There are ([0-9]+) of a max of ([0-9]+) players online: ([^\r\n]*)/.exec(output); if (record.edition === "java" && match) { const names = match[3].split(",").map(v => v.trim()).filter(Boolean); if (names.length === Number(match[1]) && names.length <= 1000 && names.every(v => /^[A-Za-z0-9_]{1,16}$/.test(v))) record.players = { names, online: Number(match[1]), maximum: Number(match[2]), observedAt: new Date().toISOString(), source: "owned-console" }; output = ""; } });
      records.set(id, record);
      child.stdin.on("error", () => {});
      child.on("exit", (code) => { record.exitCode = code; record.state = remote && code !== 0 ? "connection-lost" : code === 0 ? "stopped" : "exited"; void persist(); });
      child.on("error", () => { record.state = "start-failed"; void persist(); });
      await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", () => reject(Object.assign(new Error("PROCESS_START_FAILED"), { code: "PROCESS_START_FAILED" }))); });
      if (record.state === "starting") record.state = "process-started";
      await persist();
      return { state: record.state, readinessVerified: false, versionVerified, serverId: id };
    } finally { locks.delete(id); if (ownsResource) locks.delete(resource); }
  }
  async function stop(id) {
    const record = records.get(id);
    if (!record) fail("SERVER_NOT_MANAGED");
    if (["stopped", "exited"].includes(record.state)) return { state: record.state };
    if (record.state === "connection-lost" && !record.containerName) fail("REMOTE_PROCESS_STATE_UNKNOWN");
    if (record.containerName) {
      const args = ["stop", "--time", "30", record.containerName];
      if (record.target.startsWith("ssh-")) await processRun(await executable(options, "ssh"), sshArgs(record.host, ["docker", ...args].map(quote).join(" ")), { timeout: 45000 });
      else await processRun(await executable(options, "docker"), args, { timeout: 45000 });
      record.state = "stopped";
    } else {
      if (!record.child?.stdin?.writable) fail("SERVER_INPUT_UNAVAILABLE");
      record.child.stdin.write("stop\n");
    }
    if (!["stopped", "exited"].includes(record.state)) record.state = "stop-requested";
    await workflows.store.ownership(id, record);
    return { state: record.state };
  }
  execute.dispose = async () => {
    disposed = true; workflows.dispose();
    const active = [...records].filter(([, r]) => !["stopped", "exited", "start-failed"].includes(r.state));
    const outcomes = await Promise.allSettled(active.map(([id]) => stop(id)));
    await Promise.all(active.map(([, r]) => new Promise(resolve => { if (!r.child || r.child.exitCode !== null || r.child.signalCode !== null) return resolve(); const timer = setTimeout(resolve, 10000); r.child.once("exit", () => { clearTimeout(timer); resolve(); }); })));
    if (outcomes.some((r) => r.status === "rejected") || active.some(([, r]) => !["stopped", "exited"].includes(r.state))) fail("SERVER_SHUTDOWN_UNVERIFIED");
  };
  return execute;
}
module.exports = { createManagedMinecraft, validate, configuration };
