"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { constants } = require("node:fs");
const { createHash } = require("node:crypto");
const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 50000,
  maxBytes: 512 * 1024 * 1024,
  maxFileBytes: 64 * 1024 * 1024,
  maxMs: 10000,
  maxDepth: 64,
});
function fail(code) {
  throw Object.assign(new Error(code), { code });
}
const fingerprint = (stat) =>
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
/** Only aggregate hashes/counts leave this function. Source bytes and Git history are never persisted. */
async function captureBuildIntent({
  source,
  output,
  externalTrees = [],
  limits = DEFAULT_LIMITS,
  signal,
} = {}) {
  if (
    typeof source !== "string" ||
    typeof output !== "string" ||
    !Array.isArray(externalTrees) ||
    externalTrees.length > 32
  )
    fail("BLOCKED_CONTENT_UNAVAILABLE");
  limits = { ...DEFAULT_LIMITS, ...limits };
  if (
    Object.keys(limits).some(
      (key) =>
        !Object.hasOwn(DEFAULT_LIMITS, key) ||
        !Number.isSafeInteger(limits[key]) ||
        limits[key] < 1 ||
        limits[key] > DEFAULT_LIMITS[key],
    )
  )
    fail("BLOCKED_CONTENT_LIMIT");
  const started = performance.now(),
    evidence = [],
    roots = [source, ...externalTrees];
  const content = createHash("sha256"),
    config = createHash("sha256");
  let entries = 0,
    bytes = 0,
    enumerated = 0,
    symlinks = 0;
  function check() {
    if (signal?.aborted) fail("BLOCKED_CONTENT_CANCELLED");
    if (
      performance.now() - started > limits.maxMs ||
      entries > limits.maxEntries ||
      bytes > limits.maxBytes
    )
      fail("BLOCKED_CONTENT_LIMIT");
  }
  async function receipt(selected) {
    check();
    const stat = await fs.lstat(selected, { bigint: true });
    if (stat.isFile() && stat.nlink !== 1n) fail("BLOCKED_CONTENT_UNSAFE");
    evidence.push({ path: selected, identity: fingerprint(stat) });
    return stat;
  }
  async function directory(root) {
    if (
      !path.isAbsolute(root) ||
      path.resolve(root) !== root ||
      (await fs.realpath(root)) !== root
    )
      fail("BLOCKED_PATH_CHANGED");
    const stat = await receipt(root);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      fail("BLOCKED_PATH_CHANGED");
  }
  async function file(selected, stat, sink) {
    if (stat.size > BigInt(limits.maxFileBytes)) fail("BLOCKED_CONTENT_LIMIT");
    bytes += Number(stat.size);
    check();
    const handle = await fs.open(
      selected,
      constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
    );
    try {
      const opened = await handle.stat({ bigint: true });
      if (
        !opened.isFile() ||
        opened.nlink !== 1n ||
        fingerprint(opened) !== fingerprint(stat)
      )
        fail("BLOCKED_CONTENT_CHANGED");
      const digest = createHash("sha256"),
        buffer = Buffer.alloc(65536);
      let total = 0;
      while (true) {
        check();
        const { bytesRead } = await handle.read(
          buffer,
          0,
          buffer.length,
          total,
        );
        if (!bytesRead) break;
        total += bytesRead;
        if (total > Number(stat.size)) fail("BLOCKED_CONTENT_CHANGED");
        digest.update(buffer.subarray(0, bytesRead));
      }
      if (
        BigInt(total) !== stat.size ||
        fingerprint(await handle.stat({ bigint: true })) !== fingerprint(stat)
      )
        fail("BLOCKED_CONTENT_CHANGED");
      sink.update(
        JSON.stringify([
          "file",
          String(stat.mode & 0o7777n),
          total,
          digest.digest("hex"),
        ]) + "\n",
      );
    } finally {
      await handle.close();
    }
  }
  async function walk(root, relative, depth) {
    check();
    if (depth > limits.maxDepth) fail("BLOCKED_CONTENT_LIMIT");
    const selected = relative ? path.join(root, relative) : root;
    const stat = await receipt(selected);
    entries++;
    check();
    content.update(
      JSON.stringify(["entry", relative.split(path.sep).join("/")]) + "\n",
    );
    if (stat.isSymbolicLink()) {
      if (relative.split(path.sep).includes(".git"))
        fail("BLOCKED_CONTENT_UNSAFE");
      const target = await fs.readlink(selected, { encoding: "buffer" });
      bytes += target.length;
      check();
      symlinks++;
      // Links are source entries, not authority to inspect their referents.
      // Target filesystem templates legitimately contain absolute runtime paths.
      content.update(
        JSON.stringify([
          "symlink-bytes",
          target.length,
          createHash("sha256").update(target).digest("hex"),
        ]) + "\n",
      );
    } else if (stat.isDirectory()) {
      content.update(
        JSON.stringify(["directory", String(stat.mode & 0o7777n)]) + "\n",
      );
      const children = [];
      const directory = await fs.opendir(selected, { encoding: "buffer" });
      try {
        for await (const item of directory) {
          check();
          const name = item.name.toString("utf8");
          if (!Buffer.from(name, "utf8").equals(item.name))
            fail("BLOCKED_CONTENT_UNSAFE");
          if (name === ".git") continue;
          enumerated++;
          if (enumerated + roots.length > limits.maxEntries)
            fail("BLOCKED_CONTENT_LIMIT");
          children.push(name);
        }
      } catch (error) {
        throw error;
      }
      children.sort();
      for (const child of children)
        await walk(
          root,
          relative ? path.join(relative, child) : child,
          depth + 1,
        );
    } else if (stat.isFile()) await file(selected, stat, content);
    else fail("BLOCKED_CONTENT_UNSAFE");
  }
  async function gitStamp(root) {
    const selected = path.join(root, ".git");
    let stat;
    try {
      stat = await receipt(selected);
    } catch (error) {
      if (error.code === "ENOENT") {
        evidence.push({ path: selected, missing: true });
        content.update("git-metadata-absent\n");
        return;
      }
      throw error;
    }
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await fs.realpath(selected)) !== selected
    )
      fail("BLOCKED_CONTENT_UNSAFE");
    content.update("git-reference-receipts\n");
    for (const name of ["HEAD", "packed-refs", "shallow", "refs"]) {
      const relative = path.join(".git", name),
        filePath = path.join(root, relative);
      try {
        const current = await receipt(filePath);
        if (current.isSymbolicLink()) fail("BLOCKED_CONTENT_UNSAFE");
        if (name === "refs") {
          if (!current.isDirectory()) fail("BLOCKED_CONTENT_UNSAFE");
          await walk(root, relative, 0);
        } else {
          if (!current.isFile()) fail("BLOCKED_CONTENT_UNSAFE");
          entries++;
          check();
          content.update(JSON.stringify(["git-reference", name]) + "\n");
          await file(filePath, current, content);
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        evidence.push({ path: filePath, missing: true });
        content.update(JSON.stringify(["git-reference-missing", name]) + "\n");
      }
    }
  }
  try {
    for (const root of roots) await directory(root);
    if (
      !path.isAbsolute(output) ||
      path.resolve(output) !== output ||
      (await fs.realpath(output)) !== output
    )
      fail("BLOCKED_PATH_CHANGED");
    const outputInfo = await fs.lstat(output, { bigint: true });
    if (!outputInfo.isDirectory() || outputInfo.isSymbolicLink())
      fail("BLOCKED_PATH_CHANGED");
    evidence.push({
      path: output,
      rootIdentity: [outputInfo.dev, outputInfo.ino, outputInfo.birthtimeNs]
        .map(String)
        .join(":"),
    });
    for (let index = 0; index < roots.length; index++) {
      content.update(JSON.stringify(["tree", index, roots[index]]) + "\n");
      await gitStamp(roots[index]);
      await walk(roots[index], "", 0);
    }
    const selected = path.join(output, ".config");
    try {
      const stat = await receipt(selected);
      entries++;
      check();
      if (!stat.isFile() || stat.isSymbolicLink())
        fail("BLOCKED_CONTENT_UNSAFE");
      await file(selected, stat, config);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      config.update("missing-config\n");
      evidence.push({ path: selected, missing: true });
    }
    for (const saved of evidence) {
      check();
      if (saved.missing) {
        try {
          await fs.lstat(saved.path);
          fail("BLOCKED_CONTENT_CHANGED");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      } else {
        const current = await fs.lstat(saved.path, { bigint: true });
        if (
          saved.rootIdentity
            ? [current.dev, current.ino, current.birthtimeNs]
                .map(String)
                .join(":") !== saved.rootIdentity
            : fingerprint(current) !== saved.identity
        )
          fail("BLOCKED_CONTENT_CHANGED");
      }
    }
    return {
      sourceRevision: content.digest("hex"),
      configRevision: config.digest("hex"),
      snapshot: {
        version: 2,
        entries,
        bytes,
        excludesGitObjectHistory: true,
        symlinkPolicy: "link-text-only",
        symlinks,
        limitations: [
          "SYMLINK_TARGETS_OUTSIDE_CAPTURED_FILE_NAMESPACE_ARE_NOT_BOUND",
        ],
        limits: { ...limits },
      },
    };
  } catch (error) {
    if (typeof error.code === "string" && /^BLOCKED_[A-Z_]+$/.test(error.code))
      throw error;
    fail("BLOCKED_CONTENT_UNAVAILABLE");
  }
}
module.exports = { captureBuildIntent, DEFAULT_LIMITS };
