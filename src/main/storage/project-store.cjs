"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const MAX_BYTES = 8 * 1024 * 1024;
const STORAGE_IDENTITY = Object.freeze({
  applicationId: "com.dingdingprojects.materialbuildroot",
  surface: "desktop",
});
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function fail(code) {
  const error = new Error("Project metadata is unavailable.");
  error.code = code;
  throw error;
}
function exact(value, keys) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail("INVALID_REQUEST");
  for (const key of Reflect.ownKeys(value))
    if (
      !keys.includes(key) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")
    )
      fail("INVALID_REQUEST");
}
function text(value, max, min = 1) {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value) > max ||
    value.length < min ||
    Buffer.from(value).toString("utf8") !== value ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    fail("INVALID_REQUEST");
  return value;
}
function canonical(value) {
  text(value, 4096);
  if (!path.isAbsolute(value) || path.resolve(value) !== value)
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
function descriptor(value, stored = false) {
  exact(
    value,
    stored
      ? ["id", "name", "root", "source", "output"]
      : ["name", "root", "source", "output"],
  );
  text(value.name, 320);
  if (value.name.length > 80 || !value.name.trim()) fail("INVALID_REQUEST");
  if (stored && (typeof value.id !== "string" || !UUID.test(value.id)))
    fail("INVALID_REQUEST");
  const normalized = {
    name: value.name,
    root: canonical(value.root),
    source: canonical(value.source),
    output: canonical(value.output),
  };
  return stored ? { id: value.id, ...normalized } : normalized;
}
const key = (value) => JSON.stringify([value.root, value.source, value.output]);
function parse(serialized) {
  if (Buffer.byteLength(serialized) > MAX_BYTES) fail("STORAGE_UNAVAILABLE");
  const tokens =
    serialized.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "{" || token === "[") {
      stack.push(token === "{" ? new Set() : null);
      if (stack.length > 5) fail("STORAGE_UNAVAILABLE");
    } else if (token === "}" || token === "]") stack.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ":") {
      const name = JSON.parse(token);
      const keys = stack.at(-1);
      if (
        !keys ||
        keys.has(name) ||
        ["__proto__", "prototype", "constructor"].includes(name)
      )
        fail("STORAGE_UNAVAILABLE");
      keys.add(name);
    }
  }
  const state = JSON.parse(serialized);
  // Reads migrate only known formats in memory; successful mutations persist v2.
  if (state && state.version === 1) {
    exact(state, ["format", "version", "revision", "projects"]);
    if (state.format !== "material-buildroot-projects") fail("STORAGE_UNAVAILABLE");
    state.version = 2;
    state.storage = { ...STORAGE_IDENTITY };
  }
  exact(state, ["format", "version", "storage", "revision", "projects"]);
  exact(state.storage, ["applicationId", "surface"]);
  if (
    state.storage.applicationId !== STORAGE_IDENTITY.applicationId ||
    state.storage.surface !== STORAGE_IDENTITY.surface
  ) fail("STORAGE_UNAVAILABLE");
  if (
    state.format !== "material-buildroot-projects" ||
    state.version !== 2 ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    !Array.isArray(state.projects) ||
    state.projects.length > 1000
  )
    fail("STORAGE_UNAVAILABLE");
  state.projects = state.projects.map((record) => descriptor(record, true));
  if (
    new Set(state.projects.map((record) => record.id)).size !==
      state.projects.length ||
    new Set(state.projects.map(key)).size !== state.projects.length
  )
    fail("STORAGE_UNAVAILABLE");
  return state;
}
/** Metadata is not authority. Callers must obtain fresh picker grants before project use. */
function createProjectStore({ filePath }) {
  if (
    typeof filePath !== "string" ||
    !path.isAbsolute(filePath) ||
    path.resolve(filePath) !== filePath
  )
    throw new TypeError(
      "An absolute host-owned project metadata path is required.",
    );
  function parent(create = false) {
    const directory = path.dirname(filePath);
    if (create) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const info = fs.lstatSync(directory);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      fs.realpathSync.native(directory) !== directory
    )
      fail("STORAGE_UNAVAILABLE");
  }
  function read() {
    try {
      let info;
      try {
        info = fs.lstatSync(filePath);
      } catch (error) {
        if (error.code === "ENOENT") {
          try {
            parent();
          } catch (parentError) {
            if (parentError.code !== "ENOENT") throw parentError;
          }
          return {
            format: "material-buildroot-projects",
            version: 2,
            storage: { ...STORAGE_IDENTITY },
            revision: 0,
            projects: [],
          };
        }
        throw error;
      }
      parent();
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.nlink !== 1 ||
        info.size > MAX_BYTES
      )
        fail("STORAGE_UNAVAILABLE");
      const bytes = fs.readFileSync(filePath);
      const serialized = bytes.toString("utf8");
      if (!Buffer.from(serialized).equals(bytes)) fail("STORAGE_UNAVAILABLE");
      return parse(serialized);
    } catch {
      fail("STORAGE_UNAVAILABLE");
    }
  }
  function adopt(input) {
    const candidate = descriptor(input);
    parent(true);
    let lock;
    try {
      lock = fs.openSync(`${filePath}.lock`, "wx", 0o600);
    } catch {
      fail("STORAGE_BUSY");
    }
    let temporary;
    try {
      const state = read();
      const existing = state.projects.find(
        (record) => key(record) === key(candidate),
      );
      if (existing) return existing.id;
      if (state.projects.length >= 1000) fail("LIMIT_REACHED");
      if (state.revision === Number.MAX_SAFE_INTEGER)
        fail("STORAGE_UNAVAILABLE");
      const id = randomUUID();
      state.projects.push({ id, ...candidate });
      state.revision++;
      const serialized = JSON.stringify(state);
      if (Buffer.byteLength(serialized) > MAX_BYTES) fail("LIMIT_REACHED");
      temporary = `${filePath}.${randomUUID()}.tmp`;
      const file = fs.openSync(temporary, "wx", 0o600);
      try {
        fs.writeFileSync(file, serialized);
        fs.fsyncSync(file);
      } finally {
        fs.closeSync(file);
      }
      fs.renameSync(temporary, filePath);
      temporary = undefined;
      return id;
    } finally {
      if (temporary) fs.rmSync(temporary, { force: true });
      fs.closeSync(lock);
      fs.rmSync(`${filePath}.lock`, { force: true });
    }
  }
  const service = { list: () => read().projects, adopt };
  return Object.freeze(
    Object.fromEntries(
      Object.entries(service).map(([name, method]) => [
        name,
        (...args) => {
          try {
            return method(...args);
          } catch (error) {
            if (error.message === "Project metadata is unavailable.")
              throw error;
            fail("STORAGE_UNAVAILABLE");
          }
        },
      ]),
    ),
  );
}
module.exports = { createProjectStore };
