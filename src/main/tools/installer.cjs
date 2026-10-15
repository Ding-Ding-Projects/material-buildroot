"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { fail, digest, executable, processRun } = require("./runtime.cjs");
function memberName(value) {
  return (
    typeof value === "string" &&
    value.length < 256 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes(":") &&
    !value.split("/").some((part) => part === ".." || part === ".") &&
    !/[\x00-\x1f]/.test(value)
  );
}
function officialPayload(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    ![
      "github.com",
      "release-assets.githubusercontent.com",
      "objects.githubusercontent.com",
      "ollama.com",
    ].includes(url.hostname)
  )
    fail("UNTRUSTED_PAYLOAD_SOURCE");
  if (
    url.hostname === "github.com" &&
    !url.pathname.startsWith("/ollama/ollama/releases/download/")
  )
    fail("UNTRUSTED_PAYLOAD_SOURCE");
  return url.href;
}
async function installOllama(options, context = {}) {
  const payload = options.ollamaPayload,
    root = options.ollamaInstallDirectory;
  context = {
    ...context,
    signal: context.signal
      ? AbortSignal.any([context.signal, AbortSignal.timeout(900000)])
      : AbortSignal.timeout(900000),
  };
  if (!payload)
    return {
      available: false,
      code: "MISSING_VERIFIED_PAYLOAD",
      recovery: "Supply a reviewed platform-specific Ollama payload manifest.",
    };
  if (
    !root ||
    !path.isAbsolute(root) ||
    !/^\d+\.\d+\.\d+(?:[-.][A-Za-z0-9]+)*$/.test(payload.version) ||
    payload.platform !== process.platform ||
    payload.arch !== process.arch ||
    !Number.isSafeInteger(payload.length) ||
    payload.length < 1 ||
    payload.length > 2 * 1024 ** 3 ||
    !/^[a-f0-9]{64}$/.test(payload.sha256) ||
    !["executable", "tar", "zip"].includes(payload.kind) ||
    !Array.isArray(payload.members) ||
    !payload.members.length ||
    payload.members.length > 10000
  )
    fail("INVALID_PAYLOAD_MANIFEST");
  const seen = new Set();
  for (const member of payload.members) {
    if (
      !memberName(member.path) ||
      !/^[a-f0-9]{64}$/.test(member.sha256) ||
      seen.has(member.path)
    )
      fail("INVALID_PAYLOAD_MANIFEST");
    seen.add(member.path);
  }
  if (!seen.has(payload.executablePath)) fail("INVALID_PAYLOAD_MANIFEST");
  const destination = path.join(
    root,
    payload.version + "-" + payload.platform + "-" + payload.arch,
  );
  async function verify(directory) {
    const directoryStat = await fs.lstat(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
      fail("INVALID_INSTALLATION");
    async function walk(current, relative = "") {
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const key = relative ? relative + "/" + entry.name : entry.name;
        if (entry.isDirectory())
          await walk(path.join(current, entry.name), key);
        else if (!entry.isFile() || !seen.has(key))
          fail("ARCHIVE_MEMBER_NOT_ADMITTED");
      }
    }
    await walk(directory);
    for (const member of payload.members) {
      const file = path.join(directory, member.path),
        stat = await fs.lstat(file);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.nlink !== 1 ||
        (await digest(file)) !== member.sha256
      )
        fail("PAYLOAD_HASH_MISMATCH");
    }
  }
  try {
    const existingRoot = await fs.lstat(root);
    if (!existingRoot.isDirectory() || existingRoot.isSymbolicLink())
      fail("INVALID_INSTALLATION_ROOT");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let needsRepair = false;
  try {
    await verify(destination);
    return { installed: true, existing: true, version: payload.version };
  } catch (error) {
    let exists = false;
    try {
      await fs.lstat(destination);
      exists = true;
    } catch (inspectError) {
      if (inspectError.code !== "ENOENT") throw inspectError;
    }
    if (exists) {
      if (options.repairOllama !== true) throw error;
      needsRepair = true;
    } else if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    fail("INVALID_INSTALLATION_ROOT");
  const storage = await fs.statfs(root);
  const required =
    payload.length +
    payload.members.reduce(
      (sum, member) => sum + (member.length || payload.length),
      0,
    ) +
    32 * 1024 * 1024;
  if (storage.bavail * storage.bsize < required) fail("INSUFFICIENT_STORAGE");
  const stage = path.join(root, ".install-" + randomUUID()),
    archive = path.join(root, ".download-" + randomUUID());
  await fs.mkdir(stage, { mode: 0o700 });
  try {
    let cached = false;
    if (options.ollamaCachedPayload) {
      if (
        (await digest(options.ollamaCachedPayload)) === payload.sha256 &&
        (await fs.stat(options.ollamaCachedPayload)).size === payload.length
      ) {
        await fs.copyFile(
          options.ollamaCachedPayload,
          archive,
          fs.constants.COPYFILE_EXCL,
        );
        cached = true;
      }
    }
    if (!cached) {
      if (options.allowOllamaAcquisition !== true)
        fail("OFFLINE_PAYLOAD_MISSING");
      let url = officialPayload(payload.url),
        response;
      const fetchImpl = options.fetchImpl || fetch;
      for (let redirects = 0; redirects < 4; redirects++) {
        response = await fetchImpl(url, {
          signal: context.signal,
          redirect: "manual",
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          url = officialPayload(
            new URL(response.headers.get("location"), url).href,
          );
          continue;
        }
        break;
      }
      if (!response?.ok) fail("PAYLOAD_DOWNLOAD_FAILED");
      const handle = await fs.open(archive, "wx", 0o600);
      let completed = 0;
      const hash = createHash("sha256");
      try {
        for await (const chunk of response.body) {
          completed += chunk.length;
          if (completed > payload.length) fail("DOWNLOAD_LIMIT");
          hash.update(chunk);
          await handle.write(chunk);
          context.onProgress?.({
            type: "ollama-install",
            phase: "download",
            completed,
            total: payload.length,
          });
        }
      } finally {
        await handle.close();
      }
      if (completed !== payload.length || hash.digest("hex") !== payload.sha256)
        fail("PAYLOAD_HASH_MISMATCH");
    }
    if (options.ollamaCacheDirectory) {
      await fs.mkdir(options.ollamaCacheDirectory, {
        recursive: true,
        mode: 0o700,
      });
      const cacheStat = await fs.lstat(options.ollamaCacheDirectory);
      if (!cacheStat.isDirectory() || cacheStat.isSymbolicLink())
        fail("INVALID_CACHE_DIRECTORY");
      const saved = path.join(
        options.ollamaCacheDirectory,
        payload.sha256 + "." + payload.kind,
      );
      try {
        await fs.link(archive, saved);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    if (context.signal?.aborted) fail("CANCELLED");
    context.onProgress?.({ type: "ollama-install", phase: "extract" });
    if (payload.kind === "executable") {
      if (
        payload.members.length !== 1 ||
        payload.members[0].sha256 !== payload.sha256
      )
        fail("INVALID_PAYLOAD_MANIFEST");
      const file = path.join(stage, payload.executablePath);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.copyFile(archive, file);
    } else if (payload.kind === "zip") {
      await require("./zip-payload.cjs").extractZip(
        archive,
        stage,
        payload.members,
        context,
      );
    } else {
      const tar = await executable(options, "tar");
      const names = await processRun(
        tar,
        ["--list", "--file", archive],
        context,
      );
      const inventory = names.stdout.trim().split("\n");
      if (
        inventory.some(
          (name) =>
            !memberName(name.replace(/\/$/, "")) ||
            (!name.endsWith("/") && !seen.has(name)),
        )
      )
        fail("ARCHIVE_MEMBER_NOT_ADMITTED");
      const types = await processRun(
        tar,
        ["--list", "--verbose", "--file", archive],
        context,
      );
      if (
        types.stdout
          .trim()
          .split("\n")
          .some((line) => !/^[-d]/.test(line))
      )
        fail("ARCHIVE_LINK_FORBIDDEN");
      await processRun(
        tar,
        [
          "--extract",
          "--file",
          archive,
          "--directory",
          stage,
          "--no-same-owner",
          "--no-same-permissions",
        ],
        context,
      );
    }
    context.onProgress?.({ type: "ollama-install", phase: "verify" });
    await verify(stage);
    await fs.chmod(path.join(stage, payload.executablePath), 0o700);
    if (context.signal?.aborted) fail("CANCELLED");
    context.onProgress?.({ type: "ollama-install", phase: "promote" });
    let retained;
    if (needsRepair) {
      retained = path.join(root, ".retained-" + randomUUID());
      await fs.rename(destination, retained);
    }
    try {
      await fs.rename(stage, destination);
    } catch (error) {
      if (retained) await fs.rename(retained, destination);
      throw error;
    }
    context.onProgress?.({ type: "ollama-install", phase: "installed" });
    return { installed: true, version: payload.version, existing: false };
  } finally {
    await fs.rm(archive, { force: true });
    await fs.rm(stage, { recursive: true, force: true });
  }
}
module.exports = { installOllama, officialPayload, memberName };
