"use strict";
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const REPOSITORY = "Ding-Ding-Projects/material-buildroot";
const API = `https://api.github.com/repos/${REPOSITORY}`;
const MAX_INSTALLER = 2 * 1024 * 1024 * 1024;
function version(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw Error("Invalid release version.");
  const parts = value.split(".").map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) throw Error("Invalid release version.");
  return parts;
}
function compare(a, b) {
  a = version(a);
  b = version(b);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function assetURL(value) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "github.com" ||
    !u.pathname.startsWith(`/${REPOSITORY}/releases/download/`) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw Error("Untrusted release asset URL.");
  return u.href;
}
function createUpdateService({
  userData,
  currentVersion,
  currentSource = null,
  onInstallRequested,
  fetch: fetcher = globalThis.fetch,
}) {
  version(currentVersion);
  if (!path.isAbsolute(userData))
    throw Error("Absolute user data path required.");
  let state = { status: "idle" },
    controller = null,
    busy = false,
    candidate = null;
  const directory = path.join(userData, "updates");
  const snapshot = () => structuredClone(state);
  async function request(url, options = {}) {
    let target = new URL(url);
    for (let count = 0; count < 6; count++) {
      if (
        target.protocol !== "https:" ||
        target.username ||
        target.password ||
        ![
          "api.github.com",
          "github.com",
          "release-assets.githubusercontent.com",
          "objects.githubusercontent.com",
        ].includes(target.hostname)
      )
        throw Error("Untrusted update host.");
      const response = await fetcher(target.href, {
        ...options,
        redirect: "manual",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(120000),
        ]),
        headers: {
          "User-Agent": "Material-Buildroot-Updater",
          ...options.headers,
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw Error("Missing redirect location.");
        target = new URL(location, target);
        continue;
      }
      return response;
    }
    throw Error("Too many update redirects.");
  }
  async function bytes(url, limit) {
    const response = await request(url);
    if (!response.ok)
      throw Error(`Update request failed (${response.status}).`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limit) throw Error("Update metadata exceeds limit.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async function run(work) {
    if (busy) throw Error("An update operation is already running.");
    busy = true;
    controller = new AbortController();
    try {
      return await work();
    } catch (error) {
      state = {
        ...state,
        status: controller.signal.aborted ? "cancelled" : "error",
        error: controller.signal.aborted ? "Update cancelled." : error.message,
      };
      throw error;
    } finally {
      busy = false;
      controller = null;
    }
  }
  async function check() {
    if (state.status === "unsigned-ready") return snapshot();
    return run(async () => {
      state = { status: "checking" };
      candidate = null;
      const releases = [];
      for (let page = 1; page <= 10; page++) {
        const list = JSON.parse(
          await bytes(
            `${API}/releases?per_page=100&page=${page}`,
            4 * 1024 * 1024,
          ),
        );
        if (!Array.isArray(list)) throw Error("Invalid release listing.");
        releases.push(...list);
        if (list.length < 100) break;
      }
      const tags = new Set();
      const choices = releases
        .filter((r) => {
          if (r.draft || r.prerelease) return false;
          if (typeof r.tag_name !== "string" || tags.has(r.tag_name))
            throw Error("Duplicate release tag.");
          tags.add(r.tag_name);
          return /^v\d+\.\d+\.\d+(?:-build\.\d+\.\d+)?$/.test(r.tag_name);
        })
        .filter(
          (r) =>
            compare(r.tag_name.slice(1).split("-")[0], currentVersion) > 0,
        )
        .sort(
          (a, b) =>
            compare(
              b.tag_name.slice(1).split("-")[0],
              a.tag_name.slice(1).split("-")[0],
            ) || Date.parse(b.published_at) - Date.parse(a.published_at),
        );
      for (const release of choices) {
        const assets = new Map();
        for (const a of release.assets || []) {
          if (assets.has(a.name)) throw Error("Duplicate release asset.");
          assets.set(a.name, a);
        }
        if (
          !["Setup.exe", "provenance.json", "SHA256SUMS.txt"].every((n) =>
            assets.has(n),
          )
        )
          continue;
        const url = (n) => {
          const value = assetURL(assets.get(n).browser_download_url);
          if (
            new URL(value).pathname !==
            `/${REPOSITORY}/releases/download/${encodeURIComponent(release.tag_name)}/${n}`
          )
            throw Error("Asset release tag mismatch.");
          return value;
        };
        const sums = String(await bytes(url("SHA256SUMS.txt"), 1024 * 1024));
        const checks = new Map();
        for (const line of sums.trim().split("\n")) {
          const m = /^([a-f0-9]{64})  ([A-Za-z0-9_.-]+)$/.exec(line);
          if (!m || checks.has(m[2])) throw Error("Invalid checksum manifest.");
          checks.set(m[2], m[1]);
        }
        const raw = await bytes(url("provenance.json"), 1024 * 1024);
        if (
          crypto.createHash("sha256").update(raw).digest("hex") !==
          checks.get("provenance.json")
        )
          throw Error("Provenance checksum mismatch.");
        const provenance = JSON.parse(raw);
        if (
          provenance.schemaVersion !== 1 ||
          provenance.version !== release.tag_name.slice(1).split("-")[0] ||
          !/^[a-f0-9]{40}$/.test(provenance.source) ||
          provenance.platform !== "windows-x64" ||
          provenance.installer !== "Squirrel.Windows" ||
          provenance.signed !== false
        )
          throw Error("Unsupported release provenance.");
        const commit = JSON.parse(
          await bytes(
            `${API}/commits/${encodeURIComponent(release.tag_name)}`,
            1024 * 1024,
          ),
        );
        if (commit.sha !== provenance.source)
          throw Error("Release source mismatch.");
        if (
          compare(provenance.version, currentVersion) === 0 &&
          (!currentSource || provenance.source === currentSource)
        ) {
          state = { status: "current" };
          return snapshot();
        }
        const installer = provenance.assets?.filter(
          (a) => a.name === "Setup.exe",
        );
        if (
          installer?.length !== 1 ||
          !Number.isSafeInteger(installer[0].bytes) ||
          installer[0].bytes <= 0 ||
          installer[0].bytes > MAX_INSTALLER ||
          installer[0].bytes !== assets.get("Setup.exe").size ||
          installer[0].sha256 !== checks.get("Setup.exe")
        )
          throw Error("Invalid installer metadata.");
        candidate = {
          tag: release.tag_name,
          version: provenance.version,
          source: provenance.source,
          bytes: installer[0].bytes,
          sha256: installer[0].sha256,
          url: url("Setup.exe"),
        };
        state = {
          status: "available",
          release: { ...candidate, url: undefined },
          unsigned: true,
        };
        return snapshot();
      }
      state = { status: "current" };
      return snapshot();
    });
  }
  async function verify(file) {
    const handle = await fs.open(file, "r");
    try {
      const hash = crypto.createHash("sha256");
      let size = 0;
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        hash.update(chunk);
        size += chunk.length;
      }
      if (size !== candidate.bytes || hash.digest("hex") !== candidate.sha256)
        throw Error("Installer size or checksum mismatch.");
    } finally {
      await handle.close();
    }
  }
  async function download() {
    if (!candidate) throw Error("Check for an update first.");
    if (state.status === "unsigned-ready") return snapshot();
    return run(async () => {
      await fs.mkdir(directory, { recursive: true });
      const ownedDirectory = await fs.lstat(directory);
      if (!ownedDirectory.isDirectory() || ownedDirectory.isSymbolicLink())
        throw Error("Unsafe update directory.");
      const base = path.join(directory, `${candidate.sha256}-Setup.exe`),
        partial = base + ".partial";
      let offset = 0;
      try {
        const entry = await fs.lstat(partial);
        if (!entry.isFile() || entry.isSymbolicLink())
          throw Error("Unsafe partial installer path.");
        offset = entry.size;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (offset > candidate.bytes) {
        await fs.unlink(partial);
        offset = 0;
      }
      try {
        const existing = await fs.lstat(base);
        if (!existing.isFile() || existing.isSymbolicLink())
          throw Error("Unsafe installer path.");
        await verify(base);
        state = {
          status: "unsigned-ready",
          received: candidate.bytes,
          total: candidate.bytes,
          installer: base,
          unsigned: true,
          release: {
            version: candidate.version,
            source: candidate.source,
            tag: candidate.tag,
          },
        };
        return snapshot();
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      state = {
        status: "downloading",
        received: offset,
        total: candidate.bytes,
        unsigned: true,
        release: {
          version: candidate.version,
          source: candidate.source,
          tag: candidate.tag,
        },
      };
      if (offset < candidate.bytes) {
        const response = await request(candidate.url, {
          headers: offset ? { Range: `bytes=${offset}-` } : {},
        });
        if (offset && response.status === 206) {
          if (
            response.headers.get("content-range") !==
            `bytes ${offset}-${candidate.bytes - 1}/${candidate.bytes}`
          )
            throw Error("Invalid resumed download range.");
        } else if (response.status === 200) {
          offset = 0;
        } else throw Error(`Installer request failed (${response.status}).`);
        const handle = await fs.open(partial, offset ? "a" : "w");
        try {
          let received = offset;
          for await (const chunk of response.body) {
            received += chunk.length;
            if (received > candidate.bytes)
              throw Error("Installer exceeds expected size.");
            await handle.writeFile(chunk);
            state.received = received;
          }
          await handle.sync();
        } finally {
          await handle.close();
        }
      }
      try {
        await verify(partial);
      } catch (error) {
        await fs.unlink(partial).catch(() => {});
        throw error;
      }
      await fs.link(partial, base);
      await fs.unlink(partial);
      state = {
        ...state,
        status: "unsigned-ready",
        received: candidate.bytes,
        installer: base,
      };
      return snapshot();
    });
  }
  async function requestInstall(consent) {
    if (
      busy ||
      state.status !== "unsigned-ready" ||
      consent?.confirmUnsigned !== true ||
      consent?.workSaved !== true ||
      typeof onInstallRequested !== "function"
    )
      throw Error(
        "Explicit unsigned installer consent and host handler required.",
      );
    return run(async () => {
      await verify(state.installer);
      state.status = "install-requested";
      await onInstallRequested({
        installer: state.installer,
        version: candidate.version,
        source: candidate.source,
        tag: candidate.tag,
        unsigned: true,
      });
      state.status = "install-requested";
      return snapshot();
    });
  }
  return {
    check,
    download,
    requestInstall,
    cancel() {
      controller?.abort();
    },
    getState: snapshot,
  };
}
module.exports = { createUpdateService, REPOSITORY, assetURL, compare };
