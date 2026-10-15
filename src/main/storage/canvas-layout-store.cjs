"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { parse } = require("../security/workspace-contract.cjs");
const MAX_BYTES = 128 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CANVASES = ["package-dependencies", "guest-topology"];
function fail(code) {
  const error = new Error("Canvas layout could not be saved or loaded.");
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
  if (
    typeof value.workspaceId !== "string" ||
    !UUID.test(value.workspaceId) ||
    !CANVASES.includes(value.canvasId)
  )
    fail("INVALID_REQUEST");
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail("INVALID_REQUEST");
}
function coordinate(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > 10000
  )
    fail("INVALID_REQUEST");
}
function validateLayout(layout) {
  exact(layout, ["nodes", "viewport"]);
  if (
    !Array.isArray(layout.nodes) ||
    Object.getPrototypeOf(layout.nodes) !== Array.prototype ||
    layout.nodes.length > 128 ||
    Reflect.ownKeys(layout.nodes).length !== layout.nodes.length + 1
  )
    fail("INVALID_REQUEST");
  const identifiers = new Set();
  for (let index = 0; index < layout.nodes.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(
      layout.nodes,
      String(index),
    );
    if (!descriptor || !Object.hasOwn(descriptor, "value"))
      fail("INVALID_REQUEST");
    const node = descriptor.value;
    exact(node, ["id", "x", "y"]);
    if (
      typeof node.id !== "string" ||
      !node.id.trim() ||
      node.id.length > 128 ||
      Buffer.byteLength(node.id) > 256 ||
      Buffer.from(node.id).toString("utf8") !== node.id ||
      /[\x00-\x1f\x7f]/.test(node.id) ||
      ["__proto__", "constructor", "prototype"].includes(node.id) ||
      identifiers.has(node.id)
    )
      fail("INVALID_REQUEST");
    identifiers.add(node.id);
    coordinate(node.x);
    coordinate(node.y);
  }
  exact(layout.viewport, ["x", "y", "scale"]);
  coordinate(layout.viewport.x);
  coordinate(layout.viewport.y);
  if (
    typeof layout.viewport.scale !== "number" ||
    !Number.isFinite(layout.viewport.scale) ||
    layout.viewport.scale < 0.25 ||
    layout.viewport.scale > 2
  )
    fail("INVALID_REQUEST");
  return layout;
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const empty = () => ({
  revision: 0,
  layout: { nodes: [], viewport: { x: 0, y: 0, scale: 1 } },
});
const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.birthtimeMs === right.birthtimeMs;
/** Placement metadata only. The caller independently authorizes the project and operations. */
function createCanvasLayoutStore({ directory }) {
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory
  )
    throw new TypeError("An absolute host-owned canvas directory is required.");
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
    const workspace = path.join(directory, request.workspaceId);
    ensureDirectories(directory, create);
    inspectDirectory(directory);
    if (create) {
      try {
        fs.mkdirSync(workspace, { mode: 0o700 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    inspectDirectory(workspace);
    return path.join(workspace, `${request.canvasId}.json`);
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
      "canvasId",
      "revision",
      "layout",
    ]);
    if (
      stored.format !== "material-buildroot-canvas-layout" ||
      stored.version !== 1 ||
      stored.workspaceId !== request.workspaceId ||
      stored.canvasId !== request.canvasId
    )
      fail("STORAGE_UNAVAILABLE");
    revision(stored.revision);
    validateLayout(stored.layout);
    return { revision: stored.revision, layout: stored.layout };
  }
  function get(request) {
    exact(request, ["workspaceId", "canvasId"]);
    identity(request);
    try {
      return clone(read(request));
    } catch {
      fail("STORAGE_UNAVAILABLE");
    }
  }
  function save(request) {
    exact(request, ["workspaceId", "canvasId", "expectedRevision", "layout"]);
    identity(request);
    revision(request.expectedRevision);
    validateLayout(request.layout);
    const layout = clone(request.layout);
    const file = location(request, true);
    const workspace = path.dirname(file);
    const rootInfo = inspectDirectory(directory),
      workspaceInfo = inspectDirectory(workspace);
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
      const next = { revision: current.revision + 1, layout };
      const serialized = JSON.stringify({
        format: "material-buildroot-canvas-layout",
        version: 1,
        workspaceId: request.workspaceId,
        canvasId: request.canvasId,
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
      if (
        !same(inspectDirectory(directory), rootInfo) ||
        !same(inspectDirectory(workspace), workspaceInfo)
      )
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
            if (error.message === "Canvas layout could not be saved or loaded.")
              throw error;
            fail("STORAGE_UNAVAILABLE");
          }
        },
      ]),
    ),
  );
}
module.exports = { createCanvasLayoutStore };
