"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { fail, grant, fetchBounded } = require("./runtime.cjs");
async function fabric(options, request, context = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const signal = context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000);
  const common = { signal, fetchImpl };
  const loaders = await fetchBounded("https://meta.fabricmc.net/v2/versions/loader/" + encodeURIComponent(request.version), common);
  const installers = await fetchBounded("https://meta.fabricmc.net/v2/versions/installer", common);
  if (!Array.isArray(loaders) || !Array.isArray(installers)) fail("INVALID_FABRIC_METADATA");
  const availableLoaders = loaders.filter(row => row.loader?.stable === true).map(row => row.loader.version);
  const availableInstallers = installers.filter(row => row.stable === true).map(row => row.version);
  if (request.action === "minecraft.fabric.options") return { loaders: availableLoaders, installers: availableInstallers, source: "https://meta.fabricmc.net/", completeRuntimeInstalled: false };
  if (!availableLoaders.includes(request.loader) || !availableInstallers.includes(request.installer)) fail("FABRIC_VERSION_COMBINATION_UNAVAILABLE");
  if (request.acceptLicense !== true || request.acceptRuntimeDownloads !== true) fail("FABRIC_CONSENT_REQUIRED");
  const directory = await grant(options, request.directoryId, "write");
  if (await options.authorizeServerExecution?.(request.directoryId) !== true) fail("SERVER_EXECUTION_CONSENT_REQUIRED");
  const source = "https://meta.fabricmc.net/v2/versions/loader/" + [request.version, request.loader, request.installer].map(encodeURIComponent).join("/") + "/server/jar";
  const temporary = path.join(directory, ".fabric-" + randomUUID());
  try {
    const response = await fetchImpl(source, { signal, redirect: "error" });
    if (!response.ok) fail("HTTP_FAILURE");
    const limit = 16 * 1024 * 1024, declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limit) fail("DOWNLOAD_LIMIT");
    const handle = await fs.open(temporary, "wx", 0o600), hash = createHash("sha256"); let bytes = 0;
    try { for await (const chunk of response.body) { bytes += chunk.length; if (bytes > limit) fail("DOWNLOAD_LIMIT"); hash.update(chunk); await handle.write(chunk); } }
    finally { await handle.close(); }
    if (!bytes || (declared > 0 && declared !== bytes)) fail("PAYLOAD_LENGTH_MISMATCH");
    const archive = await require("./zip-payload.cjs").zipInventory(temporary);
    if (!archive.some(entry => entry.name === "META-INF/MANIFEST.MF")) fail("INVALID_FABRIC_LAUNCHER");
    const sha256 = hash.digest("hex");
    await fs.link(temporary, path.join(directory, "server.jar"));
    await fs.writeFile(path.join(directory, "material-server-distribution.json"), JSON.stringify({ schema: 1, edition: "java", flavour: "fabric", version: request.version, loader: request.loader, installer: request.installer, sha256, source, integrity: "https-origin-and-local-sha256", publishedDigestVerified: false, bootstrapOnly: true }), { flag: "wx", mode: 0o600 });
    return { installed: true, bootstrapOnly: true, completeRuntimeInstalled: false, bytes, sha256, publishedDigestVerified: false, source };
  } finally { await fs.rm(temporary, { force: true }); }
}
module.exports = { fabric };
