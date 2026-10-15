"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const SYMBOL = /^(?:BR2_|CONFIG_)[A-Z0-9_]+$/;
const hash = (text) => createHash("sha256").update(text).digest("hex");
function fail(code) {
  throw Object.assign(new Error(code), { code });
}
function parseConfig(text) {
  const entries = [];
  const values = {};
  for (const raw of text.split("\n")) {
    let match = raw.match(/^# ((?:BR2_|CONFIG_)[A-Z0-9_]+) is not set$/);
    if (match) {
      entries.push({ raw, symbol: match[1], value: false, type: "bool" });
      values[match[1]] = false;
      continue;
    }
    match = raw.match(/^((?:BR2_|CONFIG_)[A-Z0-9_]+)=(.*)$/);
    if (!match) {
      entries.push({ raw });
      continue;
    }
    const [, symbol, encoded] = match;
    let value = encoded,
      type = "raw";
    if (encoded === "y" || encoded === "n") {
      value = encoded === "y";
      type = "bool";
    } else if (encoded === "m") {
      value = "m";
      type = "tristate";
    } else if (/^"(?:[^"\\]|\\["\\])*"$/.test(encoded)) {
      value = encoded.slice(1, -1).replace(/\\(["\\])/g, "$1");
      type = "string";
    } else if (/^-?\d+$/.test(encoded)) {
      value = encoded;
      type = "int";
    } else if (/^0x[0-9a-f]+$/i.test(encoded)) {
      type = "hex";
    }
    entries.push({ raw, symbol, value, type });
    values[symbol] = value;
  }
  return { entries, values };
}
function encode(symbol, change) {
  if (!SYMBOL.test(symbol) || !change || typeof change !== "object")
    fail("INVALID_SYMBOL");
  const { type, value } = change;
  switch (type) {
    case "bool":
      if (typeof value !== "boolean") fail("INVALID_VALUE");
      return value ? `${symbol}=y` : `# ${symbol} is not set`;
    case "tristate":
      if (!["y", "m", "n"].includes(value)) fail("INVALID_VALUE");
      return value === "n" ? `# ${symbol} is not set` : `${symbol}=${value}`;
    case "string":
      if (
        typeof value !== "string" ||
        /[\x00-\x1f\x7f]/.test(value) ||
        value.length > 65536
      )
        fail("INVALID_VALUE");
      return `${symbol}="${value.replace(/["\\]/g, "\\$&")}"`;
    case "int":
      if (!/^-?\d+$/.test(String(value))) fail("INVALID_VALUE");
      return `${symbol}=${value}`;
    case "hex":
      if (!/^0x[\da-f]+$/i.test(String(value))) fail("INVALID_VALUE");
      return `${symbol}=${value}`;
    default:
      fail("INVALID_TYPE");
  }
}
function patchConfig(text, changes) {
  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes) ||
    Object.keys(changes).length > 10000
  )
    fail("INVALID_CHANGES");
  const encoded = new Map(
    Object.entries(changes).map(([k, v]) => [k, encode(k, v)]),
  );
  const lines = parseConfig(text)
    .entries.filter((e) => !e.symbol || !encoded.has(e.symbol))
    .map((e) => e.raw);
  while (lines.at(-1) === "") lines.pop();
  return [...lines, ...encoded.values(), ""].join("\n");
}
const DOMAINS = Object.freeze({
  buildroot: "olddefconfig",
  linux: "linux-olddefconfig",
  busybox: "busybox-oldconfig",
  uboot: "uboot-olddefconfig",
});
function createConfigurationService({
  resolveWorkspace,
  executor,
  semanticAdapter,
}) {
  if (typeof resolveWorkspace !== "function" || typeof executor !== "function")
    fail("INVALID_ADAPTER");
  const queues = new Map(),
    history = new Map();
  async function roots(workspaceId, domain = "buildroot") {
    const workspace = await resolveWorkspace(workspaceId);
    const grant =
      domain === "buildroot" ? workspace : workspace?.domains?.[domain];
    if (!grant || grant.granted !== true) fail("ROOT_NOT_GRANTED");
    const sourceRoot = await fs.realpath(grant.sourceRoot),
      outputRoot = await fs.realpath(grant.outputRoot);
    if (sourceRoot === outputRoot) fail("SEPARATE_OUTPUT_REQUIRED");
    if (
      grant.reconcileTarget &&
      ![
        "olddefconfig",
        "oldconfig",
        "linux-olddefconfig",
        "busybox-oldconfig",
        "uboot-olddefconfig",
      ].includes(grant.reconcileTarget)
    )
      fail("INVALID_RECONCILE_TARGET");
    return { ...grant, sourceRoot, outputRoot };
  }
  async function configFile(root) {
    const file = path.join(root, ".config");
    const stat = await fs.lstat(file).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (stat && (!stat.isFile() || stat.isSymbolicLink()))
      fail("UNSAFE_CONFIG_PATH");
    return file;
  }
  async function atomic(file, text) {
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, text, { flag: "wx", mode: 0o600 });
      await fs.rename(temp, file);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
  async function read(root) {
    const file = await configFile(root);
    return {
      file,
      text: await fs.readFile(file, "utf8").catch((e) => {
        if (e.code === "ENOENT") return "";
        throw e;
      }),
    };
  }
  async function serial(input, work) {
    const r = await roots(input.workspaceId, input.domain);
    const key = r.outputRoot;
    const previous = queues.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => work(r, key));
    queues.set(key, next);
    try {
      return await next;
    } finally {
      if (queues.get(key) === next) queues.delete(key);
    }
  }
  function domain(input) {
    if (input.domain && !Object.hasOwn(DOMAINS, input.domain))
      fail("DOMAIN_ADAPTER_UNAVAILABLE");
  }
  async function semantics(r) {
    if (!semanticAdapter)
      return { available: false, reason: "No admitted Python Kconfig adapter" };
    try {
      return await semanticAdapter(r);
    } catch (error) {
      return {
        available: false,
        reason: error.code || "KCONFIG_HELPER_FAILED",
      };
    }
  }
  async function inspect(input) {
    domain(input);
    return serial(input, async (r) => {
      const { text } = await read(r.outputRoot);
      return {
        revision: hash(text),
        ...parseConfig(text),
        semantics: await semantics(r),
        domains: DOMAINS,
      };
    });
  }
  async function reconcile(input, makeRequested) {
    domain(input);
    return serial(input, async (r, key) => {
      const before = await read(r.outputRoot);
      if (input.revision !== hash(before.text)) fail("REVISION_CONFLICT");
      if (input.changes && semanticAdapter) {
        const semantic = await semanticAdapter(r);
        const symbols = new Map();
        const walk = (node) => {
          if (node.symbol) symbols.set(node.symbol, node);
          for (const child of node.children || []) walk(child);
        };
        walk(semantic.tree);
        for (const [symbol, change] of Object.entries(input.changes)) {
          const spec = symbols.get(symbol);
          if (!spec) fail("UNKNOWN_SYMBOL");
          if (spec.type !== change.type) fail("SYMBOL_TYPE_MISMATCH");
        }
      }
      const requested = await makeRequested(before.text, r, key);
      await atomic(before.file, requested);
      try {
        const result = await executor({
          workspaceId: input.workspaceId,
          sourceRoot: r.sourceRoot,
          outputRoot: r.outputRoot,
          target: r.reconcileTarget || "olddefconfig",
          domain: input.domain || "buildroot",
          args: [],
        });
        if (
          !result ||
          (result.ok !== true && result.exitCode !== 0) ||
          result.ok === false ||
          (result.exitCode !== undefined && result.exitCode !== 0)
        )
          fail("RECONCILIATION_FAILED");
        const after = await read(r.outputRoot);
        const effective = parseConfig(after.text).values;
        const wanted = parseConfig(requested).values;
        const diff = Object.keys(wanted)
          .filter((k) => wanted[k] !== effective[k])
          .map((symbol) => ({
            symbol,
            requested: wanted[symbol],
            effective: effective[symbol] ?? null,
          }));
        const stack = history.get(key) || [];
        if (input._undo) stack.pop();
        else stack.push(before.text);
        history.set(key, stack.slice(-20));
        return { revision: hash(after.text), values: effective, diff };
      } catch (error) {
        await configFile(r.outputRoot);
        await atomic(before.file, before.text);
        throw error;
      }
    });
  }
  async function listDefconfigs(input) {
    return serial(input, async (r) => {
      const base = path.join(r.sourceRoot, "configs");
      if ((await fs.realpath(base)) !== base) fail("UNSAFE_DEFCONFIG_PATH");
      const names = await fs.readdir(base, { withFileTypes: true });
      if (names.length > 10000) fail("DEFCONFIG_LIMIT");
      return names
        .filter(
          (e) => e.isFile() && /^[A-Za-z0-9_.+-]+_defconfig$/.test(e.name),
        )
        .map((e) => ({ name: e.name, path: `configs/${e.name}` }));
    });
  }
  async function applyDefconfig(input) {
    if (!/^configs\/[A-Za-z0-9_.+-]+_defconfig$/.test(input.path || ""))
      fail("INVALID_DEFCONFIG");
    return reconcile(input, async (_, r) => {
      const file = path.join(r.sourceRoot, input.path);
      if (
        (await fs.realpath(path.dirname(file))) !==
        path.join(r.sourceRoot, "configs")
      )
        fail("UNSAFE_DEFCONFIG_PATH");
      const st = await fs.lstat(file);
      if (!st.isFile() || st.isSymbolicLink() || st.size > 4 * 1024 * 1024)
        fail("UNSAFE_DEFCONFIG_PATH");
      return fs.readFile(file, "utf8");
    });
  }
  async function undo(input) {
    return reconcile({ ...input, _undo: true }, async (_, r, key) => {
      const stack = history.get(key);
      if (!stack?.length) fail("NO_UNDO");
      return stack.at(-1);
    }).then((result) => result);
  }
  return {
    inspect,
    apply: (input) =>
      reconcile({ ...input, _undo: false }, (text) =>
        patchConfig(text, input.changes),
      ),
    listDefconfigs,
    applyDefconfig,
    undo,
  };
}
module.exports = {
  createConfigurationService,
  parseConfig,
  patchConfig,
  encode,
  DOMAINS,
};
