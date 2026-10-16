"use strict";
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { fail, token, text, grant, fetchBounded } = require("./runtime.cjs");
async function catalog(options, request, context) {
  context = {
    ...context,
    signal: context.signal
      ? AbortSignal.any([context.signal, AbortSignal.timeout(300000)])
      : AbortSignal.timeout(300000),
  };
  const fetchImpl = options.fetchImpl || fetch,
    common = { fetchImpl, signal: context.signal };
  const paperFetch = (url, init) => fetchImpl(url, { ...init, headers: { ...init?.headers, "User-Agent": "MaterialBuildroot/0.1 (https://github.com/Ding-Ding-Projects/material-buildroot)" } });
  if (request.action === "minecraft.flavours") {
    if (request.flavour === "fabric") {
      const game = await fetchBounded(
        "https://meta.fabricmc.net/v2/versions/game",
        common,
      );
      const loader = await fetchBounded(
        "https://meta.fabricmc.net/v2/versions/loader",
        common,
      );
      if (!Array.isArray(game) || !Array.isArray(loader))
        fail("INVALID_FLAVOUR_METADATA");
      return {
        flavour: "fabric",
        gameVersions: game,
        loaderVersions: loader,
        source: "https://meta.fabricmc.net/v2/versions",
        installationAvailable: false,
        reason:
          "Fabric server launcher installation requires admitted installer and compatible runtime.",
      };
    }
    if (request.flavour === "paper") {
      const suffix = request.version
        ? "/versions/" + encodeURIComponent(token(request.version)) + "/builds"
        : "";
      const data = await fetchBounded(
        "https://api.papermc.io/v2/projects/paper" + suffix,
        common,
      );
      return {
        flavour: "paper",
        metadata: request.version ? data : { ...data, versions: Array.isArray(data.versions) ? data.versions : Object.values(data.versions || {}).flat() },
        installationAvailable: false,
        reason:
          "Build acquisition requires reviewed artifact digest and licence admission.",
      };
    }
    fail("UNSUPPORTED_FLAVOUR");
  }
  if (request.action === "minecraft.bedrock.discovery") {
    const response = await fetchImpl(
      "https://www.minecraft.net/en-us/download/server/bedrock",
      { signal: context.signal, redirect: "error" },
    );
    if (!response.ok) fail("BEDROCK_DISCOVERY_UNAVAILABLE");
    let html = "";
    for await (const chunk of response.body) {
      html += Buffer.from(chunk).toString("utf8");
      if (html.length > 4 * 1024 * 1024) fail("RESPONSE_LIMIT");
    }
    const matches = [
      ...html.matchAll(
        /https:\/\/www\.minecraft\.net\/bedrockdedicatedserver\/bin-(win|linux)\/bedrock-server-([0-9.]+)\.zip/g,
      ),
    ];
    const releases = Array.from(
      new Map(
        matches.map((match) => [
          match[0],
          {
            platform: match[1] === "win" ? "win32" : "linux",
            version: match[2],
            officialUrl: match[0],
          },
        ]),
      ).values(),
    );
    return {
      releases,
      source: "https://www.minecraft.net/en-us/download/server/bedrock",
      installationAvailable: false,
      reason: releases.length
        ? "Official page provides no admitted archive checksum; reviewed payload manifest required."
        : "Official page did not expose recognized release links. No versions were guessed.",
    };
  }
  if (request.action === "minecraft.plugins") {
    const project = token(request.projectId);
    const metadata = await fetchBounded(
      "https://api.modrinth.com/v2/project/" + encodeURIComponent(project),
      common,
    );
    const versions = await fetchBounded(
      "https://api.modrinth.com/v2/project/" +
        encodeURIComponent(project) +
        "/version",
      common,
    );
    if (metadata.project_type !== "mod" || !Array.isArray(versions))
      fail("INVALID_PLUGIN_METADATA");
    return {
      project: metadata,
      versions,
      source: "https://api.modrinth.com/v2",
      installationRequiresConsent: true,
    };
  }
  if (request.action === "minecraft.plugin.install") {
    if (request.acceptPluginCode !== true || request.acceptLicense !== true)
      fail("PLUGIN_CONSENT_REQUIRED");
    const id = token(request.versionId),
      version = await fetchBounded(
        "https://api.modrinth.com/v2/version/" + encodeURIComponent(id),
        common,
      );
    if (
      !Array.isArray(version.loaders) ||
      !version.loaders.some((loader) =>
        ["paper", "spigot", "bukkit", "purpur", "folia", "fabric"].includes(loader),
      )
    )
      fail("UNSUPPORTED_PLUGIN_LOADER");
    if (!version.game_versions?.includes(request.gameVersion) || !version.loaders.includes(request.loader)) fail("PLUGIN_VERSION_INCOMPATIBLE");
    if (Array.isArray(version.dependencies) && version.dependencies.some(item => item.dependency_type === "required")) fail("PLUGIN_DEPENDENCIES_REQUIRE_MANUAL_INSTALL");
    const entry = version.files?.find((file) => file.primary === true);
    if (
      !entry ||
      !/^[a-f0-9]{128}$/.test(entry.hashes?.sha512 || "") ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 1 ||
      entry.size > 128 * 1024 * 1024 ||
      !/^[A-Za-z0-9_. -]+\.jar$/.test(entry.filename) ||
      entry.filename.startsWith(".")
    )
      fail("INVALID_PLUGIN_ARTIFACT");
    const url = new URL(entry.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "cdn.modrinth.com" ||
      url.port ||
      url.username ||
      url.password
    )
      fail("UNTRUSTED_PLUGIN_SOURCE");
    const directory = await grant(options, request.directoryId, "write"),
      temporary = path.join(directory, ".plugin-" + randomUUID()),
      destination = path.join(directory, entry.filename);
    try {
      const response = await fetchImpl(url.href, {
        signal: context.signal,
        redirect: "error",
      });
      if (!response.ok) fail("HTTP_FAILURE");
      const handle = await fs.open(temporary, "wx", 0o600),
        hash = createHash("sha512");
      let bytes = 0;
      try {
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > entry.size) fail("DOWNLOAD_LIMIT");
          hash.update(chunk);
          await handle.write(chunk);
          context.onProgress?.({
            type: "plugin-download",
            completed: bytes,
            total: entry.size,
          });
        }
      } finally {
        await handle.close();
      }
      if (bytes !== entry.size || hash.digest("hex") !== entry.hashes.sha512)
        fail("PAYLOAD_HASH_MISMATCH");
      const header = await fs.open(temporary, "r");
      const magic = Buffer.alloc(2);
      try {
        await header.read(magic, 0, 2, 0);
      } finally {
        await header.close();
      }
      if (magic.toString() !== "PK") fail("INVALID_PLUGIN_ARCHIVE");
      await fs.link(temporary, destination);
      return {
        installed: true,
        versionId: id,
        bytes,
        sha512: entry.hashes.sha512,
      };
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  fail("INVALID_REQUEST");
}
module.exports = { catalog };
