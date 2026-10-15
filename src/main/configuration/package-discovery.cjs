"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const {
  renderPackage,
  validateAuthoringModel,
} = require("./package-authoring.cjs");
const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const MAX_FILE = 1024 * 1024,
  MAX_TOTAL = 64 * 1024 * 1024;
const { constants } = require("node:fs");
const samePath = (a, b) =>
  process.platform === "win32"
    ? path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase()
    : a === b;
const identity = (stat) =>
  [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.nlink,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ]
    .map(String)
    .join(":");
const rootIdentity = (stat) =>
  [stat.dev, stat.ino, stat.birthtimeNs].map(String).join(":");
async function chain(root, relative = "") {
  const parts = relative ? relative.split("/") : [];
  if (
    parts.some(
      (part) => !part || part === "." || part === ".." || part.includes("\\"),
    )
  )
    fail("UNSAFE_PACKAGE_PATH");
  const snapshots = [];
  let current = root;
  for (let i = 0; i <= parts.length; i++) {
    if (i) current = path.join(current, parts[i - 1]);
    const stat = await fs.lstat(current, { bigint: true });
    if (
      stat.isSymbolicLink() ||
      (stat.isFile() && stat.nlink !== 1n) ||
      (i < parts.length && !stat.isDirectory())
    )
      fail("UNSAFE_PACKAGE_PATH");
    const canonical = await fs.realpath(current);
    if (
      !samePath(canonical, current) ||
      (!samePath(canonical, root) &&
        (!path.relative(root, canonical) ||
          path.relative(root, canonical).startsWith(".." + path.sep) ||
          path.isAbsolute(path.relative(root, canonical))))
    )
      fail("UNSAFE_PACKAGE_PATH");
    snapshots.push({ path: current, identity: identity(stat) });
  }
  return snapshots;
}
async function verifySnapshots(snapshots, deadline = Infinity) {
  const unique = new Map();
  for (const saved of snapshots) {
    if (
      unique.has(saved.path) &&
      unique.get(saved.path).identity !== saved.identity
    )
      fail("PACKAGE_SOURCE_CHANGED");
    unique.set(saved.path, saved);
  }
  for (const saved of unique.values()) {
    if (Date.now() > deadline) fail("PACKAGE_DISCOVERY_LIMIT");
    const stat = await fs.lstat(saved.path, { bigint: true });
    if (
      stat.isSymbolicLink() ||
      (stat.isFile() && stat.nlink !== 1n) ||
      identity(stat) !== saved.identity ||
      !samePath(await fs.realpath(saved.path), saved.path)
    )
      fail("PACKAGE_SOURCE_CHANGED");
  }
}
async function readSafe(root, relative, maxBytes = MAX_FILE, evidence) {
  const before = await chain(root, relative),
    file = before.at(-1).path;
  const handle = await fs.open(
    file,
    constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
  );
  try {
    const stat = await handle.stat({ bigint: true });
    if (
      !stat.isFile() ||
      stat.nlink !== 1n ||
      stat.size > BigInt(maxBytes) ||
      identity(stat) !== before.at(-1).identity
    )
      fail("PACKAGE_FILE_LIMIT");
    const buffer = Buffer.alloc(Number(stat.size) + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        length,
        buffer.length - length,
        length,
      );
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maxBytes) fail("PACKAGE_FILE_LIMIT");
    const after = await handle.stat({ bigint: true });
    if (
      after.nlink !== 1n ||
      identity(after) !== identity(stat) ||
      BigInt(length) !== stat.size
    )
      fail("PACKAGE_SOURCE_CHANGED");
    await verifySnapshots(before);
    if (evidence) evidence.push(...before);
    const bytes = buffer.subarray(0, length);
    Object.defineProperty(bytes, "receipt", {
      value: { identity: identity(after), mode: Number(after.mode & 0o777n) },
    });
    return bytes;
  } finally {
    await handle.close();
  }
}
async function readDirectory(root, relative, evidence) {
  const before = await chain(root, relative);
  const stat = await fs.lstat(before.at(-1).path);
  if (!stat.isDirectory()) fail("UNSAFE_PACKAGE_PATH");
  const entries = await fs.readdir(before.at(-1).path, { withFileTypes: true });
  await verifySnapshots(before);
  if (evidence) evidence.push(...before);
  return entries;
}
function symbolsFromConfig(text, relative, options = {}) {
  const maxCount = Math.max(0, Math.min(512, options.maxCount ?? 512)),
    maxBytes = Math.max(0, Math.min(131072, options.maxBytes ?? 131072));
  let declaredCount = 0,
    retainedBytes = 0,
    truncated = false;
  const lines = text.split(/\r?\n/),
    symbols = [];
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].match(
      /^\s*(?:menuconfig|config)\s+(BR2_[A-Z0-9_]+)\s*$/,
    );
    if (!start) continue;
    declaredCount++;
    const entry = {
      name: start[1].slice(0, 256),
      type: null,
      prompt: null,
      help: "",
      location: { path: relative, line: i + 1 },
    };
    let j = i + 1;
    for (
      ;
      j < lines.length &&
      !/^\s*(?:menuconfig|config|choice|endchoice|menu|endmenu|source|if|endif)\b/.test(
        lines[j],
      );
      j++
    ) {
      const type = lines[j].match(
        /^\s*(bool|tristate|string|int|hex)(?:\s+"((?:[^"\\]|\\.)*)")?/,
      );
      if (type) {
        entry.type = type[1];
        entry.prompt =
          type[2]?.replace(/\\(["\\])/g, "$1").slice(0, 512) ?? null;
        if (type[2]?.length > 512) {
          entry.textTruncated = true;
          truncated = true;
        }
      }
      if (/^\s*(?:help|---help---)\s*$/.test(lines[j])) {
        const help = [];
        for (j++; j < lines.length; j++) {
          if (lines[j] && !/^\s/.test(lines[j])) break;
          help.push(lines[j].replace(/^\t?  /, ""));
        }
        const helpText = help.join("\n").trim();
        entry.help = helpText.slice(0, 4096);
        if (helpText.length > 4096) {
          entry.textTruncated = true;
          truncated = true;
        }
        break;
      }
    }
    const size = Buffer.byteLength(JSON.stringify(entry));
    if (
      start[1].length > 256 ||
      symbols.length >= maxCount ||
      retainedBytes + size > maxBytes
    )
      truncated = true;
    else {
      symbols.push(entry);
      retainedBytes += size;
    }
    i = j - 1;
  }
  Object.defineProperties(symbols, {
    declaredCount: { value: declaredCount },
    truncated: { value: truncated },
    retainedBytes: { value: retainedBytes },
  });
  return symbols;
}
function interpretRecipe(name, files) {
  const reasons = [];
  let draft = null;
  const byName = new Map(files.map((file) => [file.path, file]));
  const mkFile = byName.get(`${name}.mk`),
    configFile = byName.get("Config.in"),
    hashFile = byName.get(`${name}.hash`);
  if (!mkFile || !configFile || !hashFile)
    return {
      draft: null,
      roundTripAllowed: false,
      unsupportedReasons: [
        "A Config.in, recipe and hash file are required for typed import.",
      ],
    };
  const decode = (file) => {
    if (!file || typeof file.bytesBase64 !== "string")
      throw new Error("File content exceeds the typed import response limit.");
    const bytes = Buffer.from(file.bytesBase64, "base64"),
      text = bytes.toString("utf8");
    if (!Buffer.from(text).equals(bytes))
      throw new Error("Existing content is not UTF-8.");
    return text;
  };
  try {
    const mk = decode(mkFile),
      config = decode(configFile),
      hashText = decode(hashFile),
      prefix = name.toUpperCase().replace(/-/g, "_");
    const assignments = {};
    let infrastructure = null;
    for (const line of mk.split(/\r?\n/)) {
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const macro = line.match(
        /^\$\(eval \$\((generic|autotools|cmake|meson|cargo|golang|python)-package\)\)$/,
      );
      if (macro) {
        if (infrastructure)
          throw new Error("Multiple package infrastructure declarations.");
        infrastructure = macro[1];
        continue;
      }
      const assignment = line.match(new RegExp(`^${prefix}_([A-Z_]+) = (.+)$`));
      if (!assignment || assignments[assignment[1]] !== undefined)
        throw new Error(
          "Nonliteral or custom recipe syntax requires manual editing.",
        );
      if (
        ![
          "VERSION",
          "SOURCE",
          "SITE",
          "LICENSE",
          "LICENSE_FILES",
          "DEPENDENCIES",
          "SETUP_TYPE",
        ].includes(assignment[1])
      )
        throw new Error("Additional recipe fields require manual editing.");
      assignments[assignment[1]] = assignment[2];
    }
    if (!infrastructure)
      throw new Error("Supported package infrastructure was not found.");
    const configSymbols = symbolsFromConfig(config, "Config.in");
    if (
      configSymbols.length !== 1 ||
      configSymbols[0].name !== `BR2_PACKAGE_${prefix}`
    )
      throw new Error(
        "Multiple or nonstandard package symbols require manual editing.",
      );
    const helpLines = config.split(/\r?\n/);
    const helpIndex = helpLines.findIndex((line) => /^\s*help\s*$/.test(line));
    if (helpIndex < 0) throw new Error("Package help is required.");
    const help = helpLines
      .slice(helpIndex + 1)
      .map((line) => line.replace(/^\t  /, "").replace(/^\t$/, ""));
    while (help.at(-1) === "") help.pop();
    const homepage = help.pop();
    while (help.at(-1) === "") help.pop();
    const hashes = [];
    for (const line of hashText.split(/\r?\n/)) {
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const item = line.match(/^(sha256|sha512)\s+([a-fA-F0-9]+)\s+(\S+)\s*$/);
      if (!item) throw new Error("Unsupported hash record.");
      hashes.push({ algorithm: item[1], digest: item[2], file: item[3] });
    }
    draft = {
      name,
      version: assignments.VERSION,
      source: `${assignments.SITE}/${assignments.SOURCE}`,
      sourceFilename: assignments.SOURCE,
      homepage,
      license: assignments.LICENSE,
      licenseFiles: (assignments.LICENSE_FILES || "").split(" "),
      buildSystem: infrastructure === "golang" ? "go" : infrastructure,
      dependencies: assignments.DEPENDENCIES
        ? assignments.DEPENDENCIES.split(" ")
        : [],
      configDependencies: [
        ...config.matchAll(/^\tdepends on (BR2_[A-Z0-9_]+)$/gm),
      ].map((match) => match[1]),
      help: help.join("\n"),
      hashes,
      ...(infrastructure === "python"
        ? { pythonSetupType: assignments.SETUP_TYPE }
        : {}),
    };
    validateAuthoringModel(draft);
    const generated = renderPackage(draft, "IMPORT").files;
    for (const [relative, text] of Object.entries(generated)) {
      const basename = relative.split("/").at(-1);
      if (decode(byName.get(basename)) !== text)
        reasons.push(
          `Existing ${basename} contains formatting, comments or constructs that typed generation would change.`,
        );
    }
    if (
      files.some(
        (file) =>
          !["Config.in", `${name}.mk`, `${name}.hash`].includes(file.path),
      )
    )
      reasons.push(
        "Additional package files require a preserving manual workflow.",
      );
  } catch (error) {
    draft = null;
    reasons.push(error.code || error.message);
  }
  return {
    draft,
    roundTripAllowed: reasons.length === 0,
    unsupportedReasons: reasons,
  };
}
async function snapshotPackage(root, relative) {
  const files = [],
    evidence = [];
  let total = 0,
    captured = 0;
  async function walk(dir, depth) {
    if (depth > 8) fail("PACKAGE_DISCOVERY_LIMIT");
    const entries = await readDirectory(
      root,
      dir ? `${relative}/${dir}` : relative,
      evidence,
    );
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) fail("UNSAFE_PACKAGE_PATH");
      const item = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(item, depth + 1);
      } else if (entry.isFile()) {
        if (files.length >= 256) fail("PACKAGE_DISCOVERY_LIMIT");
        const absolute = path.join(root, relative, item),
          stat = await fs.lstat(absolute);
        if (!stat.isFile() || stat.nlink !== 1) fail("UNSAFE_PACKAGE_PATH");
        total += stat.size;
        if (total > 32 * MAX_FILE) fail("PACKAGE_DISCOVERY_LIMIT");
        if (stat.size > 8 * MAX_FILE) {
          files.push({
            path: item,
            size: stat.size,
            sha256: null,
            available: false,
            reason: "File exceeds bounded hashing limit.",
          });
          continue;
        }
        const bytes = await readSafe(
          root,
          `${relative}/${item}`,
          8 * MAX_FILE,
          evidence,
        );
        const available =
          bytes.length <= 65536 && captured + bytes.length <= 262144;
        if (available) captured += bytes.length;
        files.push({
          path: item,
          size: bytes.length,
          sha256: hash(bytes),
          identity: bytes.receipt.identity,
          mode: bytes.receipt.mode,
          available,
          ...(available
            ? { bytesBase64: bytes.toString("base64") }
            : {
                reason: "File bytes exceed the bounded import response limit.",
              }),
        });
      } else fail("UNSAFE_PACKAGE_PATH");
    }
  }
  await walk("", 0);
  await verifySnapshots(evidence);
  return files;
}
function symbolDetails(symbols, maxCount, includeHelp, byteLimit) {
  const result = [];
  let bytes = 0;
  for (const symbol of symbols.slice(0, maxCount)) {
    const item = { ...symbol, prompt: symbol.prompt?.slice(0, 512) ?? null };
    if (includeHelp) item.help = item.help.slice(0, 16384);
    else delete item.help;
    const size = Buffer.byteLength(JSON.stringify(item));
    if (bytes + size > byteLimit) break;
    bytes += size;
    result.push(item);
  }
  return result;
}
function createPackageDiscoveryService({ resolveRoots, withLock }) {
  const admittedRoots = new Map();
  if (typeof resolveRoots !== "function" || typeof withLock !== "function")
    fail("INVALID_PACKAGE_ADAPTER");
  async function context(input, work) {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      typeof input.workspaceId !== "string" ||
      !input.workspaceId ||
      input.workspaceId.length > 128
    )
      fail("INVALID_DISCOVERY_REQUEST");
    const grant = await resolveRoots(input.workspaceId);
    if (grant?.granted !== true) fail("ROOT_NOT_GRANTED");
    const trees = [
      { id: "source", root: grant.sourceRoot, identity: grant.sourceIdentity },
      ...(grant.externalTrees || []),
    ];
    if (
      trees.length > 33 ||
      new Set(trees.map((tree) => tree.id)).size !== trees.length ||
      trees.some(
        (tree) =>
          typeof tree.id !== "string" || !tree.id || tree.id.length > 128,
      )
    )
      fail("INVALID_DISCOVERY_ROOTS");
    const roots = [];
    for (const tree of trees) {
      if (typeof tree.root !== "string" || !path.isAbsolute(tree.root))
        fail("ROOT_NOT_GRANTED");
      const root = await fs.realpath(tree.root);
      if (!samePath(root, tree.root)) fail("ROOT_NOT_GRANTED");
      const stat = await fs.lstat(tree.root, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink())
        fail("ROOT_NOT_GRANTED");
      const fingerprint = rootIdentity(stat);
      if (
        tree.identity &&
        (String(tree.identity.dev) !== String(stat.dev) ||
          String(tree.identity.ino) !== String(stat.ino))
      )
        fail("ROOT_NOT_GRANTED");
      const key = JSON.stringify([input.workspaceId, tree.id, root]);
      if (admittedRoots.has(key) && admittedRoots.get(key) !== fingerprint)
        fail("ROOT_NOT_GRANTED");
      admittedRoots.set(key, fingerprint);
      roots.push({ id: tree.id, root, fingerprint });
    }
    return withLock(
      roots.map((tree) => tree.root),
      async () => {
        for (const tree of roots) await verifyRoot(tree);
        const result = await work(roots);
        for (const tree of roots) await verifyRoot(tree);
        return result;
      },
    );
  }
  async function verifyRoot(tree) {
    const stat = await fs.lstat(tree.root, { bigint: true });
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      rootIdentity(stat) !== tree.fingerprint ||
      !samePath(await fs.realpath(tree.root), tree.root)
    )
      fail("ROOT_NOT_GRANTED");
  }
  async function scan(roots) {
    const packages = [],
      warnings = [],
      evidence = [];
    let count = 0,
      total = 0;
    const started = Date.now();
    const revisionHash = createHash("sha256");
    let revisionInputBytes = 0;
    const receipt = (value) => {
      const text = JSON.stringify(value) + "\n";
      revisionHash.update(text);
      revisionInputBytes += Buffer.byteLength(text);
    };
    let retainedSymbols = 0,
      retainedSymbolBytes = 0,
      declaredSymbols = 0,
      truncatedConfigs = 0;
    const symbolBudgets = {
      perConfigCount: 512,
      perConfigBytes: 131072,
      perSourceCount: 10000,
      perSourceBytes: 4194304,
      maxCount: 20000,
      maxBytes: 8388608,
    };
    for (const tree of roots) {
      let sourceSymbolCount = 0,
        sourceSymbolBytes = 0;
      async function walk(relative, depth) {
        if (depth > 8 || Date.now() - started > 15000)
          fail("PACKAGE_DISCOVERY_LIMIT");
        const directory = path.join(tree.root, relative);
        const stat = await fs.lstat(directory).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (!stat) return;
        if (stat.isSymbolicLink() || !stat.isDirectory())
          fail("UNSAFE_PACKAGE_PATH");
        const entries = await readDirectory(tree.root, relative, evidence);
        entries.sort((a, b) => a.name.localeCompare(b.name));
        count += entries.length;
        if (count > 50000) fail("PACKAGE_DISCOVERY_LIMIT");
        const config =
          entries.find(
            (entry) => entry.name === "Config.in" && entry.isFile(),
          ) ||
          entries.find(
            (entry) => entry.name === "Config.in.host" && entry.isFile(),
          );
        let symbols = [],
          configHash = null;
        if (config) {
          const bytes = await readSafe(
            tree.root,
            relative + "/" + config.name,
            MAX_FILE,
            evidence,
          );
          total += bytes.length;
          if (total > MAX_TOTAL) fail("PACKAGE_DISCOVERY_LIMIT");
          configHash = hash(bytes);
          symbols = symbolsFromConfig(
            bytes.toString("utf8"),
            relative + "/" + config.name,
            {
              maxCount: Math.min(
                symbolBudgets.perConfigCount,
                symbolBudgets.perSourceCount - sourceSymbolCount,
                symbolBudgets.maxCount - retainedSymbols,
              ),
              maxBytes: Math.min(
                symbolBudgets.perConfigBytes,
                symbolBudgets.perSourceBytes - sourceSymbolBytes,
                symbolBudgets.maxBytes - retainedSymbolBytes,
              ),
            },
          );
          sourceSymbolCount += symbols.length;
          sourceSymbolBytes += symbols.retainedBytes;
          retainedSymbols += symbols.length;
          retainedSymbolBytes += symbols.retainedBytes;
          declaredSymbols += symbols.declaredCount;
          if (symbols.truncated) truncatedConfigs++;
          receipt([
            "config",
            tree.id,
            relative + "/" + config.name,
            configHash,
          ]);
        }
        for (const entry of entries) {
          if (entry.isSymbolicLink()) {
            if (warnings.length < 100)
              warnings.push({
                treeId: tree.id,
                path: relative + "/" + entry.name,
                reason: "Symlink skipped",
              });
            continue;
          }
          if (entry.isDirectory()) {
            await walk(relative + "/" + entry.name, depth + 1);
            continue;
          }
          if (
            relative === "package" ||
            !entry.isFile() ||
            !/^([a-z0-9][a-z0-9+_.-]*)\.mk$/.test(entry.name)
          )
            continue;
          const name = entry.name.slice(0, -3),
            recipe = relative + "/" + entry.name;
          const bytes = await readSafe(tree.root, recipe, MAX_FILE, evidence);
          total += bytes.length;
          if (total > MAX_TOTAL) fail("PACKAGE_DISCOVERY_LIMIT");
          const recipeHash = hash(bytes);
          receipt(["recipe", tree.id, recipe, recipeHash, configHash]);
          packages.push({
            id: hash(JSON.stringify([tree.id, tree.root, recipe])),
            treeId: tree.id,
            name,
            path: relative,
            recipe,
            recipeHash,
            configHash,
            symbols,
          });
          if (packages.length > 10000) fail("PACKAGE_DISCOVERY_LIMIT");
        }
      }
      await walk("package", 0);
    }
    await verifySnapshots(evidence, started + 15000);
    return {
      revision: revisionHash.digest("hex"),
      symbolStats: {
        retainedCount: retainedSymbols,
        retainedBytes: retainedSymbolBytes,
        declaredCount: declaredSymbols,
        truncated: retainedSymbols < declaredSymbols || truncatedConfigs > 0,
        truncatedConfigs,
        revisionInputBytes,
        budgets: symbolBudgets,
      },
      packages,
      warnings,
      semantics:
        "Static declarations; use Kconfig inspection for evaluated dependencies and values.",
    };
  }
  return {
    discover: (input) =>
      context(input, async (roots) => {
        if (
          Object.keys(input).some(
            (key) => !["workspaceId", "query", "offset", "limit"].includes(key),
          )
        )
          fail("INVALID_DISCOVERY_REQUEST");
        const query = input.query ?? "",
          offset = input.offset ?? 0,
          limit = input.limit ?? 50;
        if (
          typeof query !== "string" ||
          query.length > 128 ||
          /[\x00-\x1f]/.test(query) ||
          !Number.isInteger(offset) ||
          offset < 0 ||
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 100
        )
          fail("INVALID_DISCOVERY_REQUEST");
        const result = await scan(roots);
        const needle = query.toLowerCase();
        const configMatches = new Map();
        const matches = result.packages.filter((item) => {
          if (
            !needle ||
            item.name.toLowerCase().includes(needle) ||
            item.path.toLowerCase().includes(needle)
          )
            return true;
          if (!configMatches.has(item.symbols))
            configMatches.set(
              item.symbols,
              item.symbols.some((symbol) =>
                [
                  symbol.name,
                  symbol.type,
                  symbol.prompt,
                  symbol.help,
                  symbol.location.path,
                ].some(
                  (value) =>
                    typeof value === "string" &&
                    value.toLowerCase().includes(needle),
                ),
              ),
            );
          return configMatches.get(item.symbols);
        });
        const page = [];
        let pageBytes = 0;
        for (const item of matches.slice(offset, offset + limit)) {
          const symbols = symbolDetails(item.symbols, 50, false, 16384);
          const summary = {
            ...item,
            symbolCount: item.symbols.declaredCount ?? item.symbols.length,
            symbolsTruncated:
              item.symbols.truncated ||
              symbols.length <
                (item.symbols.declaredCount ?? item.symbols.length),
            symbols,
          };
          const size = Buffer.byteLength(JSON.stringify(summary));
          if (pageBytes + size > 524288) break;
          pageBytes += size;
          page.push(summary);
        }
        return {
          ...result,
          packages: page,
          total: matches.length,
          offset,
          limit,
          nextOffset: offset + page.length,
          limits: {
            maxPageSize: 100,
            maxPageBytes: 524288,
            maxEntries: 50000,
            maxReadBytes: MAX_TOTAL,
            maxScanMs: 15000,
          },
        };
      }),
    importPackage: (input) =>
      context(input, async (roots) => {
        if (
          Object.keys(input).some(
            (key) => !["workspaceId", "packageId", "revision"].includes(key),
          ) ||
          typeof input.packageId !== "string" ||
          !/^([a-f0-9]{64})$/.test(input.packageId) ||
          typeof input.revision !== "string" ||
          !/^([a-f0-9]{64})$/.test(input.revision)
        )
          fail("INVALID_DISCOVERY_REQUEST");
        const catalogue = await scan(roots);
        if (input.revision !== catalogue.revision) fail("REVISION_CONFLICT");
        const item = catalogue.packages.find(
          (item) => item.id === input.packageId,
        );
        if (!item) fail("PACKAGE_NOT_FOUND");
        const tree = roots.find((tree) => tree.id === item.treeId);
        const files = await snapshotPackage(tree.root, item.path);
        return {
          packageId: item.id,
          treeId: item.treeId,
          revision: hash(JSON.stringify(files)),
          symbols: symbolDetails(item.symbols, 100, true, 65536),
          symbolCount: item.symbols.declaredCount ?? item.symbols.length,
          symbolsTruncated:
            item.symbols.truncated ||
            symbolDetails(item.symbols, 100, true, 65536).length <
              (item.symbols.declaredCount ?? item.symbols.length),
          ...interpretRecipe(item.name, files),
          files,
        };
      }),
  };
}
module.exports = {
  createPackageDiscoveryService,
  interpretRecipe,
  snapshotPackage,
  symbolsFromConfig,
  readSafe,
};
