"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { parse } = require("../security/workspace-contract.cjs");
const MAX_BYTES = 256 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function fail(code) {
  const error = new Error("Project options could not be saved or loaded.");
  error.code = code;
  throw error;
}
function exact(value, keys) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length
  )
    fail("INVALID_REQUEST");
  for (const key of Reflect.ownKeys(value)) {
    if (
      !keys.includes(key) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")
    )
      fail("INVALID_REQUEST");
  }
  if (keys.some((key) => !Object.hasOwn(value, key))) fail("INVALID_REQUEST");
}
function identity(value) {
  if (typeof value.workspaceId !== "string" || !UUID.test(value.workspaceId))
    fail("INVALID_REQUEST");
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail("INVALID_REQUEST");
}
function runtime(value) {
  if (value === null) return null;
  if (!value || Object.getPrototypeOf(value) !== Object.prototype)
    fail("INVALID_REQUEST");
  const kind = Object.getOwnPropertyDescriptor(value, "kind");
  if (!kind || !Object.hasOwn(kind, "value")) fail("INVALID_REQUEST");
  if (kind.value === "wsl") {
    exact(value, ["kind", "distribution"]);
    if (
      typeof value.distribution !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(value.distribution)
    )
      fail("INVALID_REQUEST");
  } else if (kind.value === "docker") {
    exact(value, ["kind", "image", "uid", "gid"]);
    if (
      typeof value.image !== "string" ||
      value.image.length > 512 ||
      !/^[a-z0-9][a-z0-9./:_-]*@sha256:[0-9a-f]{64}$/.test(value.image) ||
      !Number.isSafeInteger(value.uid) ||
      value.uid < 1 ||
      value.uid > 65535 ||
      !Number.isSafeInteger(value.gid) ||
      value.gid < 1 ||
      value.gid > 65535
    )
      fail("INVALID_REQUEST");
  } else fail("INVALID_REQUEST");
  return value;
}
function canonical(value) {
  if (
    typeof value !== "string" ||
    !value.length ||
    Buffer.byteLength(value) > 4096 ||
    Buffer.from(value).toString("utf8") !== value ||
    /[\x00-\x1f\x7f]/.test(value) ||
    !path.isAbsolute(value) ||
    path.resolve(value) !== value
  )
    fail("INVALID_REQUEST");
  if (process.platform === "win32") {
    if (
      !/^[A-Za-z]:\\/.test(value) ||
      value.slice(2).includes(":") ||
      value
        .split("\\")
        .slice(1)
        .some(
          (part) =>
            /[. ]$/.test(part) ||
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part),
        )
    )
      fail("INVALID_REQUEST");
    return value[0].toUpperCase() + value.slice(1);
  }
  return value;
}
function options(value) {
  const selectedRuntime = runtime(value.runtime);
  const trees = value.externalTrees;
  if (
    !Array.isArray(trees) ||
    Object.getPrototypeOf(trees) !== Array.prototype ||
    trees.length > 32 ||
    Reflect.ownKeys(trees).length !== trees.length + 1
  )
    fail("INVALID_REQUEST");
  const names = new Set(),
    paths = new Set(),
    externalTrees = [];
  for (let index = 0; index < trees.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(trees, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value"))
      fail("INVALID_REQUEST");
    const tree = descriptor.value;
    exact(tree, ["path", "name"]);
    const selectedPath = canonical(tree.path);
    if (
      typeof tree.name !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(tree.name) ||
      names.has(tree.name) ||
      paths.has(selectedPath)
    )
      fail("INVALID_REQUEST");
    names.add(tree.name);
    paths.add(selectedPath);
    externalTrees.push({ path: selectedPath, name: tree.name });
  }
  return { runtime: selectedRuntime, externalTrees };
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const empty = () => ({ revision: 0, runtime: null, externalTrees: [] });
const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.birthtimeMs === right.birthtimeMs;
/** Project preference metadata only. The caller independently authorizes the project and operations. */
function createProjectOptionsStore({ directory }) {
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory
  )
    throw new TypeError(
      "An absolute host-owned project options directory is required.",
    );
  function inspectDirectory(selected) {
    const info = fs.lstatSync(selected);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      fs.realpathSync.native(selected) !== selected
    )
      fail("STORAGE_UNAVAILABLE");
    return info;
  }
  function ensureDirectories(selected, create = false) {
    const parsed = path.parse(selected);
    let cursor = parsed.root;
    for (const part of selected
      .slice(parsed.root.length)
      .split(path.sep)
      .filter(Boolean)) {
      cursor = path.join(cursor, part);
      if (create) {
        try {
          fs.mkdirSync(cursor, { mode: 0o700 });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
      inspectDirectory(cursor);
    }
  }
  function location(request, create = false) {
    ensureDirectories(directory, create);
    inspectDirectory(directory);
    return path.join(directory, `${request.workspaceId}.json`);
  }
  function read(request) {
    let file;
    try {
      file = location(request);
    } catch (error) {
      if (error.code === "ENOENT") return empty();
      throw error;
    }
    let info;
    try {
      info = fs.lstatSync(file);
    } catch (error) {
      if (error.code === "ENOENT") return empty();
      throw error;
    }
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.nlink !== 1 ||
      info.size > MAX_BYTES
    )
      fail("STORAGE_UNAVAILABLE");
    const descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    let bytes;
    try {
      const opened = fs.fstatSync(descriptor);
      if (!same(opened, info) || opened.nlink !== 1 || opened.size > MAX_BYTES)
        fail("STORAGE_UNAVAILABLE");
      bytes = fs.readFileSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    if (
      bytes.length > MAX_BYTES ||
      !Buffer.from(bytes.toString("utf8")).equals(bytes)
    )
      fail("STORAGE_UNAVAILABLE");
    const stored = parse(bytes.toString("utf8"));
    exact(stored, [
      "format",
      "version",
      "workspaceId",
      "revision",
      "runtime",
      "externalTrees",
    ]);
    if (
      stored.format !== "material-buildroot-project-options" ||
      stored.version !== 1 ||
      stored.workspaceId !== request.workspaceId
    )
      fail("STORAGE_UNAVAILABLE");
    revision(stored.revision);
    return { revision: stored.revision, ...options(stored) };
  }
  function get(request) {
    exact(request, ["workspaceId"]);
    identity(request);
    try {
      return clone(read(request));
    } catch {
      fail("STORAGE_UNAVAILABLE");
    }
  }
  function save(request) {
    exact(request, [
      "workspaceId",
      "expectedRevision",
      "runtime",
      "externalTrees",
    ]);
    identity(request);
    revision(request.expectedRevision);
    const selected = clone(options(request));
    const file = location(request, true);
    const rootInfo = inspectDirectory(directory);
    let lock;
    try {
      lock = fs.openSync(`${file}.lock`, "wx", 0o600);
    } catch {
      fail("STORAGE_BUSY");
    }
    let temporary;
    try {
      let current;
      try {
        current = read(request);
      } catch {
        fail("STORAGE_UNAVAILABLE");
      }
      if (current.revision !== request.expectedRevision)
        fail("REVISION_CONFLICT");
      if (current.revision === Number.MAX_SAFE_INTEGER)
        fail("STORAGE_UNAVAILABLE");
      const next = { revision: current.revision + 1, ...selected };
      const serialized = JSON.stringify({
        format: "material-buildroot-project-options",
        version: 1,
        workspaceId: request.workspaceId,
        ...next,
      });
      if (Buffer.byteLength(serialized) > MAX_BYTES) fail("INVALID_REQUEST");
      temporary = `${file}.${randomUUID()}.tmp`;
      const descriptor = fs.openSync(temporary, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, serialized);
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      if (!same(inspectDirectory(directory), rootInfo))
        fail("STORAGE_UNAVAILABLE");
      let latest;
      try {
        latest = read(request);
      } catch {
        fail("STORAGE_UNAVAILABLE");
      }
      if (JSON.stringify(latest) !== JSON.stringify(current))
        fail("REVISION_CONFLICT");
      fs.renameSync(temporary, file);
      temporary = undefined;
      return clone(next);
    } finally {
      if (temporary) fs.rmSync(temporary, { force: true });
      fs.closeSync(lock);
      fs.rmSync(`${file}.lock`, { force: true });
    }
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries({ get, save }).map(([name, method]) => [
        name,
        (...args) => {
          try {
            return method(...args);
          } catch (error) {
            if (
              error.message === "Project options could not be saved or loaded."
            )
              throw error;
            fail("STORAGE_UNAVAILABLE");
          }
        },
      ]),
    ),
  );
}
module.exports = { createProjectOptionsStore };
