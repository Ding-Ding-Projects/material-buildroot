"use strict";
// Production assembly only. This module never executes a downloaded executable.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { Transform, Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createInflateRaw } = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { zipInventory, safeName } = require("../../src/main/tools/zip-payload.cjs");
const registry = require("./offline-payloads.json");
async function hash(file) {
  const result = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) result.update(chunk);
  return result.digest("hex");
}
function contained(root, relative) {
  if (!safeName(relative)) throw new Error("Invalid payload member path.");
  const result = path.resolve(root, relative);
  if (!result.startsWith(path.resolve(root) + path.sep)) throw new Error("Payload member escapes its destination.");
  return result;
}
async function directory(root) {
  const resolved = path.resolve(root);
  await fsp.mkdir(resolved, { recursive: true });
  let current = resolved;
  while (current !== path.dirname(current)) {
    if ((await fsp.lstat(current)).isSymbolicLink()) throw new Error("Payload directory contains a link.");
    current = path.dirname(current);
  }
  return resolved;
}
function diagnosticHost(url) {
  const host = url?.hostname?.toLowerCase() || "";
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example)$/.test(host)) return "withheld-nonpublic-host";
  return host;
}
function acquisitionFailure(tool, url, code, redirect = 0) {
  const id = /^[a-z0-9-]{1,40}$/.test(tool.id || "") ? tool.id : "invalid-id";
  const archive = /^[a-f0-9]{64}$/.test(tool.sha256 || "") ? tool.sha256 : "invalid-pin";
  // Never include URL paths, userinfo, query strings, response bodies or raw
  // transport errors. Host-only evidence identifies a public trust mismatch.
  return new Error(`Payload acquisition stopped: code=${code}; tool=${id}; archiveSha256=${archive}; observedHost=${diagnosticHost(url)}; redirect=${redirect}.`);
}
async function acquire(tool, cache) {
  if (!/^[a-f0-9]{64}$/.test(tool.sha256) || !Number.isSafeInteger(tool.bytes) || tool.bytes < 1 || tool.bytes > 1500000000) throw new Error("Invalid pinned payload.");
  const file = path.join(cache, tool.sha256 + ".zip");
  try {
    const stat = await fsp.lstat(file);
    if (stat.isFile() && !stat.isSymbolicLink() && stat.size === tool.bytes && await hash(file) === tool.sha256) return file;
    throw new Error("Existing payload cache does not match its pin; retained without overwrite.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const temporary = path.join(cache, ".download-" + randomUUID());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  try {
    let url = new URL(tool.url), response;
    console.log(`Acquiring pinned payload: tool=${tool.id}; archiveSha256=${tool.sha256}; sourceHost=${diagnosticHost(url)}.`);
    const trustedHosts = new Set(url.hostname === "github.com"
      ? ["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"]
      : ["download.docker.com", ...(tool.redirectHosts || [])]);
    for (let redirect = 0; redirect <= 4; redirect++) {
      if (url.protocol !== "https:" || url.username || url.password || url.port || !trustedHosts.has(url.hostname)) throw acquisitionFailure(tool, url, "UNTRUSTED_SOURCE_OR_REDIRECT", redirect);
      try { response = await fetch(url, { redirect: "manual", signal: controller.signal }); }
      catch { throw acquisitionFailure(tool, url, controller.signal.aborted ? "DOWNLOAD_TIMEOUT" : "TRANSPORT_UNAVAILABLE", redirect); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirect === 4) throw acquisitionFailure(tool, url, "REDIRECT_LIMIT", redirect);
        try { url = new URL(location, url); }
        catch { throw acquisitionFailure(tool, url, "INVALID_REDIRECT", redirect); }
        continue;
      }
      break;
    }
    if (!response?.ok || !response.body) throw acquisitionFailure(tool, url, "HTTP_" + (response?.status || "UNAVAILABLE"));
    let bytes = 0;
    const limit = new Transform({ transform(chunk, _encoding, done) {
      bytes += chunk.length;
      done(bytes > tool.bytes ? new Error("Payload exceeds its pinned length.") : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body), limit, fs.createWriteStream(temporary, { flags: "wx" }), { signal: controller.signal });
    if (bytes !== tool.bytes || await hash(temporary) !== tool.sha256) throw new Error("Official payload length or SHA-256 mismatch.");
    // link() never replaces a cache populated by another producer.
    await fsp.link(temporary, file);
    return file;
  } finally {
    clearTimeout(timeout);
    await fsp.rm(temporary, { force: true });
  }
}
async function unpack(archive, output, tool) {
  const entries = await zipInventory(archive);
  const id = tool.id;
  const admitted = tool.members && new Map(tool.members.map(member => [member.path, member]));
  if (admitted && (admitted.size !== tool.members.length || tool.members.some(member => !entries.some(entry => entry.name === member.path && entry.bytes === member.length)))) throw new Error("Pinned composition member is absent.");
  const files = [];
  for (const entry of entries) {
    if (admitted && !admitted.has(entry.name)) continue;
    const destination = contained(output, id + "/" + entry.name);
    if (entry.directory) { await fsp.mkdir(destination, { recursive: true }); continue; }
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    let bytes = 0;
    const digest = createHash("sha256");
    const meter = new Transform({ transform(chunk, _encoding, done) {
      bytes += chunk.length;
      digest.update(chunk);
      done(bytes > entry.bytes ? new Error("Payload expansion exceeds declared length.") : null, chunk);
    } });
    const input = entry.compressed ? fs.createReadStream(archive, { start: entry.dataOffset, end: entry.dataOffset + entry.compressed - 1 }) : Readable.from([]);
    const streams = entry.method === 8 ? [input, createInflateRaw(), meter] : [input, meter];
    await pipeline(...streams, fs.createWriteStream(destination, { flags: "wx" }));
    if (bytes !== entry.bytes) throw new Error("Payload expansion length mismatch.");
    const sha256 = digest.digest("hex");
    if (admitted && sha256 !== admitted.get(entry.name).sha256) throw new Error("Pinned composition member hash mismatch.");
    files.push({ path: id + "/" + entry.name, bytes, sha256 });
  }
  return files;
}
async function unpack7z(archive, output, tool, cache) {
  if (!Array.isArray(tool.members) || !tool.members.length || tool.members.some(member => !safeName(member.path))) throw new Error("7z composition must pin every member before extraction.");
  const extractorArchive = await acquire(registry.extractor, cache);
  const extractor = path.join(cache, registry.extractor.sha256 + ".exe");
  try { await fsp.copyFile(extractorArchive, extractor, fs.constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  if (await hash(extractor) !== registry.extractor.sha256) throw new Error("Pinned archive extractor changed.");
  const destination = contained(output, tool.id);
  await fsp.mkdir(destination);
  const listing = spawnSync(extractor, ["l", "-slt", archive], { windowsHide: true, encoding: "utf8", maxBuffer: 4 * 1024 ** 2, timeout: 60000 });
  if (listing.error || listing.status !== 0) throw new Error("7z payload listing failed.");
  const body = listing.stdout.split("----------")[1];
  if (!body) throw new Error("Unsupported archive listing.");
  const listed = body.split(/\r?\n\r?\n/).filter(block => /^Path = /m.test(block)).map(block => {
    const name = block.match(/^Path = (.+)\r?$/m)?.[1].replace(/\r$/, "");
    if (!safeName(name) || /^Symbolic Link = |^Hard Link = /m.test(block)) throw new Error("Unsafe 7z member.");
    return name;
  });
  if (listed.length !== tool.members.length || new Set(listed).size !== listed.length || listed.some(name => !tool.members.some(member => member.path === name))) throw new Error("7z member inventory differs from its pin.");
  const extracted = spawnSync(extractor, ["x", "-y", "-o" + destination, archive], { windowsHide: true, stdio: "ignore", timeout: 10 * 60 * 1000 });
  if (extracted.error || extracted.status !== 0) throw new Error("7z payload extraction failed.");
  const files = [];
  for (const member of tool.members) {
    const file = contained(destination, member.path), stat = await fsp.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== member.length || await hash(file) !== member.sha256) throw new Error("7z payload member differs from its pin.");
    files.push({ path: tool.id + "/" + member.path, bytes: member.length, sha256: member.sha256 });
  }
  return files;
}
async function fullExtractor(cache) {
  const archive = await acquire(registry.fullExtractor, cache);
  const bootstrap = await acquire(registry.extractor, cache);
  const executable = path.join(cache, registry.extractor.sha256 + ".exe");
  try { await fsp.copyFile(bootstrap, executable, fs.constants.COPYFILE_EXCL); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  if (await hash(executable) !== registry.extractor.sha256) throw new Error("Archive extractor changed.");
  const destination = await fsp.mkdtemp(path.join(cache, ".7zip-"));
  const result = spawnSync(executable, ["x", "-y", "-o" + destination, archive, ...registry.fullExtractor.members.map(member => member.path)], { windowsHide: true, stdio: "ignore", timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error("Official archive tool extraction failed.");
  for (const member of registry.fullExtractor.members) {
    const file = contained(destination, member.path), stat = await fsp.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== member.bytes || await hash(file) !== member.sha256) throw new Error("Official archive tool member changed.");
  }
  return path.join(destination, "7z.exe");
}
async function unpackCalibre(archive, output, tool, cache) {
  const extractor = await fullExtractor(cache);
  const temporary = await fsp.mkdtemp(path.join(cache, ".calibre-source-"));
  const result = spawnSync(extractor, ["x", "-y", "-o" + temporary, archive, ".rsrc/EXTRA/EXTRA"], { windowsHide: true, stdio: "ignore", timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error("Calibre source resource extraction failed.");
  const resource = path.join(temporary, ".rsrc", "EXTRA", "EXTRA");
  if (await hash(resource) !== tool.resourceSha256) throw new Error("Calibre source resource changed.");
  const bytes = await fsp.readFile(resource);
  if (bytes.subarray(0, 4).toString("ascii") !== "LZIP" || bytes[4] !== 0) throw new Error("Unsupported Calibre LZIP container.");
  const exponent = bytes[5] & 31;
  if (exponent < 12 || exponent > 29) throw new Error("Calibre dictionary limit.");
  const dictionary = 2 ** exponent - 2 ** exponent / 16 * (bytes[5] >>> 5);
  const header = Buffer.alloc(13);
  header[0] = 0x5d;
  header.writeUInt32LE(dictionary, 1);
  bytes.copy(header, 5, bytes.length - 8);
  const lzma = path.join(temporary, "payload.lzma");
  await fsp.writeFile(lzma, Buffer.concat([header, bytes.subarray(6, bytes.length - 12)]), { flag: "wx" });
  const expanded = path.join(temporary, "expanded");
  const decompressed = spawnSync(extractor, ["x", "-y", "-o" + expanded, lzma], { windowsHide: true, stdio: "ignore", timeout: 10 * 60 * 1000 });
  if (decompressed.error || decompressed.status !== 0) throw new Error("Calibre container expansion failed.");
  const zip = path.join(expanded, "payload");
  if (await hash(zip) !== tool.zipSha256) throw new Error("Calibre inner ZIP changed.");
  return unpack(zip, output, tool);
}
async function walkFiles(root, prefix) {
  const files = [];
  async function walk(relative) {
    for (const entry of await fsp.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? relative + "/" + entry.name : entry.name;
      if (!safeName(name)) throw new Error("Unsafe extracted payload path.");
      const file = contained(root, name), stat = await fsp.lstat(file);
      if (stat.isSymbolicLink()) throw new Error("Extracted payload contains a link.");
      if (stat.isDirectory()) await walk(name);
      else if (stat.isFile()) files.push({ path: prefix + "/" + name, bytes: stat.size, sha256: await hash(file) });
      else throw new Error("Extracted payload contains a nonregular member.");
    }
  }
  await walk("");
  return files;
}
async function unpackFull7z(archive, output, tool, cache) {
  const extractor = await fullExtractor(cache);
  const listing = spawnSync(extractor, ["l", "-slt", archive], { windowsHide: true, encoding: "utf8", maxBuffer: 16 * 1024 ** 2, timeout: 60000 });
  if (listing.error || listing.status !== 0) throw new Error("Portable payload listing failed.");
  const body = listing.stdout.split("----------")[1];
  if (!body) throw new Error("Unsupported portable payload listing.");
  const seen = new Set();
  for (const block of body.split(/\r?\n\r?\n/).filter(item => /^Path = /m.test(item))) {
    const name = block.match(/^Path = (.+)\r?$/m)?.[1].replace(/\r$/, "").replaceAll("\\", "/");
    if (!safeName(name) || seen.has(name.toLowerCase()) || /^Symbolic Link = |^Hard Link = /m.test(block)) throw new Error("Unsafe portable payload member.");
    seen.add(name.toLowerCase());
  }
  const destination = contained(output, tool.id);
  const result = spawnSync(extractor, ["x", "-y", "-o" + destination, archive], { windowsHide: true, stdio: "ignore", timeout: 10 * 60 * 1000 });
  if (result.error || result.status !== 0) throw new Error("Portable payload extraction failed.");
  return walkFiles(destination, tool.id);
}
async function unpackOffice(archive, output, tool, cache) {
  if (process.platform !== "win32") throw new Error("Read-only Office MSI reconstruction requires Windows Installer database access.");
  const extractor = await fullExtractor(cache);
  const cab = await fsp.mkdtemp(path.join(cache, ".office-cab-"));
  const result = spawnSync(extractor, ["x", "-y", "-o" + cab, archive], { windowsHide: true, stdio: "ignore", timeout: 10 * 60 * 1000 });
  if (result.error || result.status !== 0) throw new Error("Office cabinet extraction failed.");
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !path.isAbsolute(systemRoot)) throw new Error("System PowerShell location unavailable.");
  const powershell = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const destination = contained(output, tool.id);
  const reconstructed = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-File", path.join(__dirname, "extract-office-msi.ps1"), "-Database", archive, "-ExtractedCab", cab, "-Output", destination], { windowsHide: true, stdio: "inherit", timeout: 20 * 60 * 1000 });
  if (reconstructed.error || reconstructed.status !== 0) throw new Error("Office MSI read-only reconstruction failed.");
  return walkFiles(destination, tool.id);
}
async function assemblePayloads({ output, cache, complete = true } = {}) {
  if (!output || !cache || !path.isAbsolute(output) || !path.isAbsolute(cache)) throw new Error("Absolute payload output and cache directories are required.");
  const declared = Object.keys(require("../../src/main/tools/payload-manager.cjs").TOOLS);
  const bundled = registry.requiredBundledToolIds;
  const external = registry.externalTools;
  if (!Array.isArray(bundled) || !bundled.length || !Array.isArray(external) || new Set(bundled).size !== bundled.length || new Set(external.map(tool => tool.id)).size !== external.length)
    throw new Error("Explicit unique bundled and external tool classifications are required.");
  const invalidExternal = external.some(tool => !declared.includes(tool.id) || bundled.includes(tool.id) || tool.classification !== "external-user-admitted" || tool.acquisition !== "user-selected-existing-installation" || tool.licenseBoundary !== "user-managed-installation-not-redistributed" || typeof tool.purpose !== "string" || !tool.purpose);
  const unclassified = declared.filter(id => !bundled.includes(id) && !external.some(tool => tool.id === id));
  if (invalidExternal || bundled.some(id => !declared.includes(id)) || unclassified.length)
    throw new Error("Declared tool distribution classification is missing or inconsistent: " + unclassified.join(", ") + ". No tool is automatically treated as external.");
  if (new Set(registry.tools.map(tool => tool.id)).size !== registry.tools.length || registry.tools.some(tool => !bundled.includes(tool.id)))
    throw new Error("Archive pins must belong uniquely to explicitly required bundled tools.");
  const missing = bundled.filter(id => !registry.tools.some(tool => tool.id === id));
  if (complete && missing.length) throw new Error("Complete offline payload assembly is unavailable: " + missing.join(", ") + ". See scripts/build/offline-payloads.json. No complete package was produced.");
  const parent = await directory(path.dirname(output));
  const cacheRoot = await directory(cache);
  try { await fsp.lstat(output); throw new Error("Payload output already exists and is retained."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const staging = await fsp.mkdtemp(path.join(parent, ".payload-assembly-"));
  // On failure staging is intentionally retained for diagnosis; never remove a caller directory.
  const bundledComplete = missing.length === 0;
  const externalTools = external.map(tool => ({
    ...tool,
    bundled: false,
    availability: "not-evaluated-during-build",
    admission: "required-at-runtime",
    admissionReceipt: "not-present-in-package",
    installation: "not-performed-by-assembly",
    runtimeVerified: false,
    provenance: { admissionRoute: "host-native-picker", receiptScope: "local-user-data", includedInPackage: false, executablePathIncluded: false },
  }));
  const manifest = { schemaVersion: 1, platform: registry.platform, scope: "bundled-payload-inventory", bundledComplete, wholeToolsetOffline: bundledComplete && externalTools.length === 0, requiredBundledToolIds: [...bundled], externalTools, complete: bundledComplete, missing, tools: [] };
  for (const tool of registry.tools) {
    const archive = await acquire(tool, cacheRoot);
    const files = tool.format === "7z" ? await unpack7z(archive, staging, tool, cacheRoot) : tool.format === "7z-full" ? await unpackFull7z(archive, staging, tool, cacheRoot) : tool.format === "office-msi" ? await unpackOffice(archive, staging, tool, cacheRoot) : tool.format === "calibre-portable" ? await unpackCalibre(archive, staging, tool, cacheRoot) : await unpack(archive, staging, tool);
    for (const supplement of tool.supplements || []) {
      const source = contained(path.resolve(__dirname, "../.."), supplement.source);
      const sourceStat = await fsp.lstat(source);
      if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > 1024 ** 2) throw new Error("Pinned original notice changed.");
      // Source checkout newline conversion must not change the original text pin.
      const notice = Buffer.from((await fsp.readFile(source, "utf8")).replaceAll("\r\n", "\n"), "utf8");
      if (createHash("sha256").update(notice).digest("hex") !== supplement.sha256) throw new Error("Pinned original notice changed.");
      const destination = contained(staging, tool.id + "/" + supplement.path);
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      await fsp.writeFile(destination, notice, { flag: "wx" });
      files.push({ path: tool.id + "/" + supplement.path, bytes: notice.length, sha256: supplement.sha256 });
    }
    const executable = tool.id + "/" + tool.executable;
    if (!files.some(member => member.path === executable)) throw new Error("Payload executable absent: " + tool.id);
    for (const license of tool.licenseFiles) {
      if (!files.some(member => member.path === tool.id + "/" + license && member.bytes > 0)) throw new Error("Payload license absent: " + tool.id);
    }
    manifest.tools.push({ id: tool.id, classification: "bundled", runtimeVerified: false, version: tool.version, executable, files, license: tool.license, licenseFiles: tool.licenseFiles.map(name => tool.id + "/" + name), sourceUrl: tool.sourceUrl, profile: tool.profile || "declared-upstream-composition", composition: tool.composition || "Complete original archive", compositionSources: tool.compositionSources || [], excludedMembers: tool.excludedMembers || [], sourceInventory: tool.sourceInventory || null, archive: { url: tool.url, originUrl: tool.originUrl || tool.url, sha256: tool.sha256, bytes: tool.bytes } });
  }
  await fsp.writeFile(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  const notices = manifest.tools.map(tool => [tool.id + " " + tool.version, tool.license, tool.sourceUrl, "Original notices: " + tool.licenseFiles.join(", "), "Original downloaded archive retained in the source cache; see manifest.json for package composition, exclusions and every retained member hash."].join("\n")).join("\n\n");
  const externalNotices = externalTools.map(tool => [tool.id + " (external, not redistributed)", tool.purpose, "Existing user-managed installation and applicable licenses remain the user's responsibility.", "No installation, local receipt, availability check or runtime verification is included in this package."].join("\n")).join("\n\n");
  await fsp.writeFile(path.join(staging, "THIRD-PARTY-NOTICES.txt"), notices + "\n\nExternal capabilities\n\n" + externalNotices + "\n", { flag: "wx" });
  await fsp.rename(staging, output);
  return { directory: output, manifest, extraResources: { from: output, to: "offline-payloads", filter: ["**/*"] } };
}
module.exports = { assemblePayloads };
