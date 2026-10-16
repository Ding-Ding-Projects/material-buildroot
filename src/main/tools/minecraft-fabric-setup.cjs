"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { fail, grant, executable, fetchBounded, processRun, digest } = require("./runtime.cjs");
const { inspectCanonicalPath } = require("../security/file-grants.cjs");
function trusted(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) fail("UNTRUSTED_FABRIC_SOURCE");
  return url.href;
}
async function bytes(fetchImpl, url, signal, limit) {
  const response = await fetchImpl(url, { signal, redirect: "error" });
  if (!response.ok) fail("FABRIC_SOURCE_UNAVAILABLE");
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > limit) fail("FABRIC_DOWNLOAD_LIMIT"); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
async function fileInventory(root) {
  const files = []; let total = 0;
  async function walk(directory, relative = "") {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      if (!require("./zip-payload.cjs").safeName(item.name)) fail("UNSAFE_FABRIC_OUTPUT");
      const absolute = path.join(directory, item.name), name = relative ? relative + "/" + item.name : item.name;
      inspectCanonicalPath(absolute); const stat = await fs.lstat(absolute);
      if (stat.isDirectory()) { if (name.split("/").length > 32) fail("FABRIC_OUTPUT_LIMIT"); await walk(absolute, name); }
      else if (stat.isFile()) { total += stat.size; if (files.length >= 10000 || total > 2 * 1024 ** 3) fail("FABRIC_OUTPUT_LIMIT"); files.push({ path: name, bytes: stat.size, sha256: await digest(absolute) }); }
      else fail("UNSAFE_FABRIC_OUTPUT");
    }
  }
  await walk(root); return files;
}
function createFabricSetup(options, assertStopped, log) {
  let current;
  async function execute(request, context = {}) {
    if (request.action === "minecraft.fabric.setup.status") return current ? { state: current.state, folderName: current.folderName, code: current.code || null, outputMayExist: current.outputMayExist === true, runtimeVerified: false } : { state: "idle" };
    if (request.action === "minecraft.fabric.setup.cancel") { if (!current || !["preparing", "confirming", "installing", "verifying"].includes(current.state)) fail("FABRIC_SETUP_NOT_ACTIVE"); current.controller.abort(); current.state = "cancelling"; return { cancelling: true }; }
    if (current && ["preparing", "confirming", "installing", "verifying", "cancelling"].includes(current.state)) fail("FABRIC_SETUP_BUSY");
    const root = await grant(options, request.directoryId, "write");
    if (await options.authorizeServerExecution?.(request.directoryId) !== true) fail("SERVER_EXECUTION_CONSENT_REQUIRED");
    await assertStopped(root);
    const controller = new AbortController();
    const signal = context.signal ? AbortSignal.any([controller.signal, context.signal, AbortSignal.timeout(900000)]) : AbortSignal.any([controller.signal, AbortSignal.timeout(900000)]);
    current = { controller, root, folderName: request.folderName, state: "preparing" };
    const fetchImpl = options.fetchImpl || fetch, common = { fetchImpl, signal };
    let destination;
    try {
      if (typeof process.getuid === "function" && process.getuid() === 0) fail("ROOT_EXECUTION_REFUSED");
      const available = await require("./minecraft-fabric.cjs").fabric(options, { action: "minecraft.fabric.options", version: request.version }, { signal });
      if (!available.loaders.includes(request.loader) || !available.installers.includes(request.installer)) fail("FABRIC_VERSION_COMBINATION_UNAVAILABLE");
      const installers = await fetchBounded("https://meta.fabricmc.net/v2/versions/installer", common);
      const selected = installers.find(item => item.version === request.installer && item.stable === true);
      if (!selected) fail("FABRIC_INSTALLER_UNAVAILABLE");
      const source = trusted(selected.url, ["maven.fabricmc.net"]);
      const expected = (await bytes(fetchImpl, source + ".sha256", signal, 128)).toString("utf8").trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(expected)) fail("FABRIC_INSTALLER_DIGEST_UNAVAILABLE");
      const installer = await bytes(fetchImpl, source, signal, 16 * 1024 ** 2);
      if (createHash("sha256").update(installer).digest("hex") !== expected) fail("FABRIC_INSTALLER_HASH_MISMATCH");
      const manifest = await fetchBounded("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", common), version = manifest.versions?.find(item => item.id === request.version);
      if (!version || !/^[a-f0-9]{40}$/.test(version.sha1 || "")) fail("VERSION_METADATA_DIGEST_REQUIRED");
      const raw = await bytes(fetchImpl, trusted(version.url, ["piston-meta.mojang.com", "launchermeta.mojang.com"]), signal, 4194304);
      if (createHash("sha1").update(raw).digest("hex") !== version.sha1) fail("VERSION_METADATA_HASH_MISMATCH");
      const metadata = JSON.parse(raw.toString("utf8")), server = metadata.downloads?.server;
      if (!server || !/^[a-f0-9]{40}$/.test(server.sha1 || "") || !Number.isSafeInteger(server.size)) fail("SERVER_PAYLOAD_UNAVAILABLE");
      const profile = await fetchBounded("https://meta.fabricmc.net/v2/versions/loader/" + [request.version, request.loader].map(encodeURIComponent).join("/") + "/server/json", common);
      if (!Array.isArray(profile.libraries) || profile.libraries.length > 200) fail("FABRIC_LIBRARY_INVENTORY_UNAVAILABLE");
      const java = await executable(options, "java");
      destination = path.join(root, request.folderName);
      try { await fs.lstat(destination); fail("OUTPUT_ALREADY_EXISTS"); } catch (error) { if (error.code !== "ENOENT") throw error; }
      current.state = "confirming";
      if (!options.dialog?.showMessageBox) fail("NATIVE_CONSENT_UNAVAILABLE");
      const notice = { type: "warning", title: "Install a complete Fabric server in a new folder", message: "Run the verified official Fabric installer with the selected Java executable?", detail: destination + "\nMinecraft " + request.version + "; loader " + request.loader + "; installer " + request.installer + "\nInstaller SHA-256: " + expected + "\nThis fixed server-install command downloads official runtime dependencies into the new folder. It does not start a game server. Existing directories are refused; interrupted output is retained.", buttons: ["Cancel", "Install selected server files"], defaultId: 0, cancelId: 0, noLink: true };
      const reply = options.parentWindow ? await options.dialog.showMessageBox(options.parentWindow, notice) : await options.dialog.showMessageBox(notice);
      if (reply.response !== 1 || signal.aborted) fail("CANCELLED");
      await grant(options, request.directoryId, "write"); await assertStopped(root);
      await fs.mkdir(destination, { mode: 0o700 });
      current.outputMayExist = true; current.destination = destination;
      await fs.writeFile(path.join(destination, ".material-fabric-incomplete"), "Installation incomplete. Do not start this server.\n", { flag: "wx", mode: 0o600 });
      const installerPath = path.join(destination, ".fabric-installer.jar");
      await fs.writeFile(installerPath, installer, { flag: "wx", mode: 0o600 });
      current.state = "installing";
      await processRun(java, ["-jar", installerPath, "server", "-dir", destination, "-mcversion", request.version, "-loader", request.loader, "-downloadMinecraft"], { cwd: destination, signal, timeout: 600000, maxBytes: 4 * 1024 ** 2 });
      current.state = "verifying";
      const vanilla = path.join(destination, "server.jar"), launcher = path.join(destination, "fabric-server-launch.jar");
      inspectCanonicalPath(vanilla); inspectCanonicalPath(launcher);
      if ((await fs.stat(vanilla)).size !== server.size || await digest(vanilla, "sha1") !== server.sha1) fail("FABRIC_VANILLA_PAYLOAD_MISMATCH");
      const libraries = [];
      for (const library of profile.libraries) {
        if (typeof library.name !== "string" || !/^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.+-]+$/.test(library.name)) fail("FABRIC_LIBRARY_IDENTITY_UNAVAILABLE");
        const [group, artifact, release] = library.name.split(":");
        const relative = group.replace(/\./g, "/") + "/" + artifact + "/" + release + "/" + artifact + "-" + release + ".jar";
        const url = trusted(new URL(relative, library.url || "https://libraries.minecraft.net/").href, ["maven.fabricmc.net", "libraries.minecraft.net"]);
        const sha1 = (await bytes(fetchImpl, url + ".sha1", signal, 128)).toString("utf8").trim().toLowerCase();
        if (!/^[a-f0-9]{40}$/.test(sha1)) fail("FABRIC_LIBRARY_DIGEST_UNAVAILABLE");
        const file = path.join(destination, "libraries", relative); inspectCanonicalPath(file);
        if (await digest(file, "sha1") !== sha1) fail("FABRIC_LIBRARY_HASH_MISMATCH");
        libraries.push({ path: "libraries/" + relative, sha1 });
      }
      await fileInventory(destination);
      if (signal.aborted) fail("CANCELLED");
      const receipt = { schema: 1, edition: "java", version: request.version, flavour: "fabric", loader: request.loader, installer: request.installer, entryPoint: "fabric-server-launch.jar", sha256: await digest(launcher), vanillaSha1: server.sha1, installerSha256: expected, bootstrapOnly: false, installationFilesVerified: true, runtimeVerified: false, libraries };
      await fs.writeFile(path.join(destination, "material-server-distribution.json"), JSON.stringify(receipt), { flag: "wx", mode: 0o600 });
      await fs.unlink(path.join(destination, ".material-fabric-incomplete"));
      current.state = "completed"; await log("fabric", "complete-install", "files-verified-runtime-unverified");
      return { installed: true, folderName: request.folderName, bootstrapOnly: false, installationFilesVerified: true, runtimeVerified: false, requiredJavaMajorVersion: metadata.javaVersion?.majorVersion ?? null };
    } catch (error) {
      current.state = (signal.aborted || error.code === "CANCELLED" ? "cancelled" : "failed") + (current.outputMayExist ? "-output-retained" : "");
      current.code = /^[A-Z_]+$/.test(error.code || "") ? error.code : "FABRIC_SETUP_FAILED";
      await log("fabric", "complete-install", current.state).catch(() => {});
      throw Object.assign(new Error(current.code), { code: current.code });
    }
  }
  return { execute, busy: root => (current?.root === root || current?.destination === root) && ["preparing", "confirming", "installing", "verifying", "cancelling"].includes(current.state), dispose() { current?.controller.abort(); } };
}
module.exports = { createFabricSetup };
