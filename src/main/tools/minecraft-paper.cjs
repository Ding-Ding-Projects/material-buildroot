"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { fail, token, grant, fetchBounded } = require("./runtime.cjs");
const userAgent = "MaterialBuildroot/0.1 (https://github.com/Ding-Ding-Projects/material-buildroot)";
async function paper(options, request, context = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const signal = context.signal ? AbortSignal.any([context.signal, AbortSignal.timeout(300000)]) : AbortSignal.timeout(300000);
  const source = "https://fill.papermc.io/v3/projects/paper/versions/" + encodeURIComponent(token(request.version)) + "/builds";
  const builds = await fetchBounded(source, { signal, fetchImpl: (url, init) => fetchImpl(url, { ...init, headers: { "User-Agent": userAgent } }) });
  if (!Array.isArray(builds)) fail("INVALID_FLAVOUR_METADATA");
  const stable = builds.filter(build => build.channel === "STABLE" && Number.isInteger(build.id));
  if (request.action === "minecraft.paper.builds") return { builds: stable.map(build => ({ id: build.id, time: build.time, java: build.java ?? null })), source };
  if (request.acceptLicense !== true) fail("FLAVOUR_LICENSE_CONSENT_REQUIRED");
  const selected = stable.find(build => build.id === request.build);
  const entry = selected?.downloads?.["server:default"];
  if (!entry || !Number.isSafeInteger(entry.size) || entry.size < 1 || entry.size > 256 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(entry.checksums?.sha256 || "")) fail("SERVER_PAYLOAD_UNAVAILABLE");
  const url = new URL(entry.url);
  if (url.protocol !== "https:" || !["fill.papermc.io", "fill-data.papermc.io"].includes(url.hostname) || url.username || url.password || url.port) fail("UNTRUSTED_DOWNLOAD");
  const directory = await grant(options, request.directoryId, "write");
  if (await options.authorizeServerExecution?.(request.directoryId) !== true) fail("SERVER_EXECUTION_CONSENT_REQUIRED");
  const temporary = path.join(directory, ".paper-" + randomUUID());
  try {
    const response = await fetchImpl(url.href, { signal, redirect: "error", headers: { "User-Agent": userAgent } });
    if (!response.ok) fail("HTTP_FAILURE");
    const handle = await fs.open(temporary, "wx", 0o600), hash = createHash("sha256");
    let bytes = 0;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > entry.size) fail("DOWNLOAD_LIMIT");
        hash.update(chunk); await handle.write(chunk);
        context.onProgress?.({ type: "server-download", completed: bytes, total: entry.size });
      }
    } finally { await handle.close(); }
    if (bytes !== entry.size || hash.digest("hex") !== entry.checksums.sha256) fail("PAYLOAD_HASH_MISMATCH");
    await fs.link(temporary, path.join(directory, "server.jar"));
    await fs.writeFile(path.join(directory, "material-server-distribution.json"), JSON.stringify({ schema: 1, edition: "java", flavour: "paper", version: request.version, build: request.build, sha256: entry.checksums.sha256 }), { flag: "wx", mode: 0o600 });
    return { installed: true, flavour: "paper", version: request.version, build: request.build, bytes, sha256: entry.checksums.sha256, source, runtimeVerified: false };
  } finally { await fs.rm(temporary, { force: true }); }
}
module.exports = { paper };
