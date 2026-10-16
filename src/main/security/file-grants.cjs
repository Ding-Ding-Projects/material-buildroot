"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ownerValid = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function failure(code) {
  const error = new Error("File capability is unavailable.");
  error.code = code;
  throw error;
}
function exact(value, keys, required = keys) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).some((k) => !keys.includes(k)) ||
    required.some((k) => !Object.hasOwn(value, k))
  )
    failure("INVALID_REQUEST");
  for (const k of Reflect.ownKeys(value))
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(value, k), "value"))
      failure("INVALID_REQUEST");
}
function identity(info) {
  return `${info.dev}:${info.ino}:${info.birthtimeMs}`;
}
function inspect(absolute) {
  if (typeof absolute !== "string" || absolute.length > 4096 ||
      !path.isAbsolute(absolute) || path.resolve(absolute) !== absolute ||
      /[\x00-\x1f]/.test(absolute) || absolute.startsWith("\\\\"))
    failure("UNSAFE_PATH");
  const parsed = path.parse(absolute);
  relativeParts(absolute.slice(parsed.root.length).split(path.sep).join("/"));
  let cursor = parsed.root;
  const rootInfo = fs.lstatSync(cursor, { bigint: true });
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() ||
      fs.realpathSync.native(cursor) !== cursor) failure("UNSAFE_PATH");
  const chain = [{ path: cursor, identity: identity(rootInfo) }];
  for (const part of absolute
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean)) {
    cursor = path.join(cursor, part);
    const info = fs.lstatSync(cursor, { bigint: true });
    if (
      info.isSymbolicLink() ||
      (info.isFile() && info.nlink !== 1n) ||
      (!info.isDirectory() && !info.isFile())
    )
      failure("UNSAFE_PATH");
    const canonical = fs.realpathSync.native(cursor);
    if (canonical !== cursor) failure("UNSAFE_PATH");
    chain.push({ path: cursor, identity: identity(info) });
  }
  return chain;
}
function relativeParts(relative) {
  if (
    typeof relative !== "string" ||
    relative.length > 4096 ||
    relative.includes("\\") ||
    relative.includes("\0") ||
    path.isAbsolute(relative)
  )
    failure("INVALID_REQUEST");
  if (relative === "") return [];
  const parts = relative.split("/");
  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        /[<>:"|?*\x00-\x1f]/.test(part) ||
        /[. ]$/.test(part) ||
        /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part),
    )
  )
    failure("INVALID_REQUEST");
  return parts;
}
/** Main-process only. grant() accepts paths exclusively from trusted native picker results. */
function createFileGrants({ now = Date.now } = {}) {
  if (typeof now !== "function") throw new TypeError("A clock is required.");
  const grants = new Map();
  let lastTime = 0;
  function clock() {
    const value = now();
    if (!Number.isSafeInteger(value) || value < lastTime || value < 0)
      failure("CLOCK_UNAVAILABLE");
    lastTime = value;
    return value;
  }
  function sweep(time) {
    for (const [id, grant] of grants)
      if (grant.expires <= time) grants.delete(id);
  }
  const service = {
    // Trusted host import adapters call this only after obtaining explicit consent.
    importFile(input) {
      exact(input, ["path", "owner"]);
      return service.grant({ ...input, kind: "file", access: "read" });
    },
    async translate(input, translator) {
      if (typeof translator !== "function") failure("INVALID_REQUEST");
      const before = service.resolve(input);
      const snapshot = inspect(before.path);
      const translated = await translator(before.path);
      const after = service.resolve(input);
      if (after.path !== before.path ||
          JSON.stringify(inspect(after.path)) !== JSON.stringify(snapshot))
        failure("GRANT_CHANGED");
      if (typeof translated !== "string" || translated.length > 4096 ||
          !translated.startsWith("/") || /[\x00-\x1f\\]/.test(translated) ||
          path.posix.normalize(translated) !== translated || translated.startsWith("//"))
        failure("INVALID_TRANSLATION");
      return { path: translated, kind: after.kind, access: after.access };
    },
    grant(input) {
      exact(input, ["path", "kind", "access", "owner"]);
      if (
        typeof input.path !== "string" ||
        input.path.length > 4096 ||
        !path.isAbsolute(input.path) ||
        path.resolve(input.path) !== input.path ||
        !["directory", "file"].includes(input.kind) ||
        !["read", "read-write"].includes(input.access) ||
        !ownerValid(input.owner)
      )
        failure("INVALID_REQUEST");
      const time = clock();
      sweep(time);
      if (grants.size >= 1024) failure("LIMIT_REACHED");
      const chain = inspect(input.path);
      const info = fs.lstatSync(input.path);
      if (input.kind === "directory" ? !info.isDirectory() : !info.isFile())
        failure("INVALID_REQUEST");
      const id = randomUUID();
      grants.set(id, { ...input, chain, expires: time + 300000 });
      return id;
    },
    resolve(input) {
      exact(input, ["id", "owner", "relative", "write"], ["id", "owner"]);
      if (
        typeof input.id !== "string" ||
        !UUID.test(input.id) ||
        !ownerValid(input.owner) ||
        (Object.hasOwn(input, "write") && typeof input.write !== "boolean")
      )
        failure("INVALID_REQUEST");
      const grant = grants.get(input.id);
      if (!grant || grant.owner !== input.owner || grant.expires <= clock())
        failure("NOT_AUTHORIZED");
      if (input.write && grant.access !== "read-write")
        failure("NOT_AUTHORIZED");
      const parts = relativeParts(input.relative ?? "");
      if (grant.kind === "file" && parts.length) failure("NOT_AUTHORIZED");
      try {
        if (JSON.stringify(inspect(grant.path)) !== JSON.stringify(grant.chain))
          failure("GRANT_CHANGED");
        const resolved = path.join(grant.path, ...parts);
        const suffix = path.relative(grant.path, resolved);
        if (
          suffix === ".." ||
          suffix.startsWith(`..${path.sep}`) ||
          path.isAbsolute(suffix)
        )
          failure("UNSAFE_PATH");
        let kind = grant.kind;
        try {
          inspect(resolved);
          const info = fs.lstatSync(resolved);
          kind = info.isDirectory() ? "directory" : "file";
        } catch (error) {
          if (error.code !== "ENOENT" || !input.write || !parts.length)
            throw error;
          inspect(path.dirname(resolved));
          kind = "file";
        }
        return { path: resolved, kind, access: grant.access };
      } catch (error) {
        grants.delete(input.id);
        if (["GRANT_CHANGED", "UNSAFE_PATH"].includes(error.code)) throw error;
        failure("GRANT_CHANGED");
      }
    },
    revoke(input) {
      exact(input, ["id", "owner"]);
      const grant = grants.get(input.id);
      if (!grant || grant.owner !== input.owner) return false;
      return grants.delete(input.id);
    },
    clear() {
      grants.clear();
    },
  };
  return Object.freeze(
    Object.fromEntries(
      Object.entries(service).map(([name, method]) => [
        name,
        (...args) => {
          try {
            const result = method(...args);
            if (result && typeof result.then === "function")
              return result.catch((error) => {
                if (error.message === "File capability is unavailable.") throw error;
                failure("GRANT_UNAVAILABLE");
              });
            return result;
          } catch (error) {
            if (error.message === "File capability is unavailable.")
              throw error;
            failure("GRANT_UNAVAILABLE");
          }
        },
      ]),
    ),
  );
}
module.exports = { createFileGrants, inspectCanonicalPath: inspect };
