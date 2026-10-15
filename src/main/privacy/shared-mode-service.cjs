"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const derive = promisify(crypto.scrypt);
const FILE = "shared-mode-v1.json";
const OWNER = "shared_experience_mode_v1";
const MARKER = "shared-experience-mode";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REFERENCE =
  /^vault:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exact = (value, fields) =>
  value &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).length === fields.length &&
  fields.every((key) => Object.hasOwn(value, key));
class SharedModeError extends Error {
  constructor(code) {
    super("The shared experience setting could not be used.");
    this.name = "SharedModeError";
    this.code = code;
  }
}
const fail = (code) => {
  throw new SharedModeError(code);
};
const same = (a, b) => a.dev === b.dev && a.ino === b.ino;
const labelValid = (value) =>
  typeof value === "string" &&
  [...value].length >= 1 &&
  [...value].length <= 96 &&
  value.trim().length > 0 &&
  !/[\u0000-\u001f\u007f]/u.test(value);
const secretValid = (kind, value) =>
  typeof value === "string" &&
  Buffer.byteLength(value) <= 4096 &&
  (kind === "pin"
    ? /^\d{4,12}$/.test(value)
    : kind === "password" &&
      [...value].length >= 8 &&
      [...value].length <= 1024);
function validate(record) {
  if (
    !exact(record, [
      "protocol",
      "schemaVersion",
      "revision",
      "active",
      "displayName",
      "credential",
    ]) ||
    record.protocol !== MARKER ||
    record.schemaVersion !== 1 ||
    !UUID.test(record.revision) ||
    typeof record.active !== "boolean" ||
    !labelValid(record.displayName)
  )
    fail("INVALID_STATE");
  const c = record.credential;
  if (
    c !== null &&
    (!exact(c, ["kind", "reference"]) ||
      !["pin", "password", "passkey"].includes(c.kind) ||
      typeof c.reference !== "string" ||
      !REFERENCE.test(c.reference))
  )
    fail("INVALID_STATE");
  if (record.active && c === null) fail("INVALID_STATE");
  return record;
}
function createSharedModeService({
  sharedDirectory,
  vault,
  passkey,
  watchFactory = fs.watch,
  watchRetries = 3,
  retryDelayMs = 25,
} = {}) {
  if (
    typeof sharedDirectory !== "string" ||
    !path.isAbsolute(sharedDirectory) ||
    !vault ||
    typeof vault.read !== "function" ||
    typeof vault.write !== "function" ||
    typeof watchFactory !== "function" ||
    !Number.isInteger(watchRetries) ||
    watchRetries < 0 ||
    watchRetries > 10 ||
    !Number.isInteger(retryDelayMs) ||
    retryDelayMs < 1 ||
    retryDelayMs > 1000
  )
    fail("INVALID_REQUEST");
  const directory = path.resolve(sharedDirectory),
    file = path.join(directory, FILE),
    lockFile = path.join(directory, FILE + ".lock");
  let anchors,
    selected = null,
    available = false,
    watching = false,
    started = false,
    closed = false,
    watcher,
    retryTimer,
    retries = 0,
    refreshQueue = null,
    localBusy = false;
  const listeners = new Set(),
    observations = new WeakMap();
  function checkPath(capture = false) {
    let current = path.parse(directory).root;
    const found = [];
    for (const part of directory
      .slice(current.length)
      .split(path.sep)
      .filter(Boolean)) {
      current = path.join(current, part);
      const info = fs.lstatSync(current);
      if (!info.isDirectory() || info.isSymbolicLink()) fail("UNSAFE_STORAGE");
      found.push([current, info]);
    }
    if (capture) anchors = found;
    else if (
      !anchors ||
      anchors.length !== found.length ||
      found.some(
        ([name, info], n) =>
          name !== anchors[n][0] || !same(info, anchors[n][1]),
      )
    )
      fail("UNSAFE_STORAGE");
  }
  function prepare() {
    // Reject every existing link before recursive creation can follow one.
    let current = path.parse(directory).root;
    for (const part of directory
      .slice(current.length)
      .split(path.sep)
      .filter(Boolean)) {
      current = path.join(current, part);
      try {
        const info = fs.lstatSync(current);
        if (!info.isDirectory() || info.isSymbolicLink())
          fail("UNSAFE_STORAGE");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    checkPath(true);
  }
  function readFile() {
    checkPath();
    let descriptor;
    try {
      let before;
      try {
        before = fs.lstatSync(file);
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        before.nlink !== 1 ||
        before.size < 1 ||
        before.size > 8192
      )
        fail("UNSAFE_STORAGE");
      descriptor = fs.openSync(
        file,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
      );
      const opened = fs.fstatSync(descriptor);
      if (
        !same(before, opened) ||
        opened.nlink !== 1 ||
        !opened.isFile() ||
        opened.size > 8192
      )
        fail("UNSAFE_STORAGE");
      const buffer = Buffer.alloc(8193);
      let size = 0;
      while (size < buffer.length) {
        const count = fs.readSync(
          descriptor,
          buffer,
          size,
          buffer.length - size,
          null,
        );
        if (!count) break;
        size += count;
      }
      if (size > 8192 || !same(opened, fs.lstatSync(file)))
        fail("UNSAFE_STORAGE");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, size),
      );
      // Exact schema plus duplicate-key admission. This record has no user-defined keys.
      const parsed = JSON.parse(text),
        levels = [];
      for (let at = 0; at < text.length; at++) {
        if (text[at] === "{") {
          levels.push(new Set());
          continue;
        }
        if (text[at] === "}") {
          levels.pop();
          continue;
        }
        if (text[at] !== '"') continue;
        const start = at++;
        while (at < text.length) {
          if (text[at] === "\\") {
            at += 2;
            continue;
          }
          if (text[at] === '"') break;
          at++;
        }
        let after = at + 1;
        while (/[\x20\t\r\n]/u.test(text[after] || "")) after++;
        if (text[after] === ":") {
          const key = JSON.parse(text.slice(start, at + 1)),
            keys = levels[levels.length - 1];
          if (!keys || keys.has(key)) fail("INVALID_STATE");
          keys.add(key);
        }
      }
      const admitted = validate(parsed);
      observations.set(admitted, {
        bytes: Buffer.from(buffer.subarray(0, size)),
        identity: opened,
      });
      return admitted;
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }
  }
  function status() {
    const healthy = available && watching && !closed;
    return Object.freeze({
      available: healthy,
      watching: watching && !closed,
      configured: healthy ? selected !== null : null,
      active: healthy ? (selected?.active ?? false) : null,
      displayName: selected?.displayName ?? null,
      revision: healthy ? (selected?.revision ?? null) : null,
      credentialKind: healthy ? (selected?.credential?.kind ?? null) : null,
    });
  }
  function emit() {
    const snapshot = status();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {}
    }
  }
  function refresh() {
    if (closed) return status();
    try {
      const next = readFile();
      selected = next;
      available = true;
    } catch {
      available = false;
    }
    emit();
    return status();
  }
  function requestRefresh() {
    if (!refreshQueue)
      refreshQueue = Promise.resolve()
        .then(() => refresh())
        .finally(() => {
          refreshQueue = null;
        });
    return refreshQueue;
  }
  function watchFailure() {
    if (closed) return;
    watching = false;
    available = false;
    const failedWatcher = watcher;
    watcher = undefined;
    try {
      failedWatcher?.close();
    } catch {}
    emit();
    if (retries < watchRetries && !retryTimer) {
      retries++;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        attachWatcher();
      }, retryDelayMs);
      retryTimer.unref?.();
    }
  }
  function attachWatcher() {
    if (closed) return;
    try {
      checkPath();
      watcher = watchFactory(directory, { persistent: false }, () => {
        void requestRefresh();
      });
      if (
        !watcher ||
        typeof watcher.on !== "function" ||
        typeof watcher.close !== "function"
      )
        fail("WATCH_UNAVAILABLE");
      const currentWatcher = watcher;
      watcher.on("error", () => {
        if (watcher === currentWatcher) watchFailure();
      });
      watcher.on("close", () => {
        if (watcher === currentWatcher) watchFailure();
      });
      watching = true;
      void requestRefresh();
    } catch {
      watchFailure();
    }
  }
  function requireReady() {
    if (!started || closed || !watching) fail("WATCH_UNAVAILABLE");
    checkPath();
  }
  function cleanupCreatedLock(owned) {
    // A failed create/write can leave only a prefix of our token. Remove only
    // our original inode with exactly that prefix; replacements remain untouched.
    try {
      checkPath();
      const current = fs.lstatSync(lockFile),
        opened = fs.fstatSync(owned.descriptor);
      if (
        !current.isFile() ||
        current.isSymbolicLink() ||
        current.nlink !== 1 ||
        !same(current, owned.info) ||
        !same(current, opened) ||
        current.size > 36
      )
        return;
      const bytes = Buffer.alloc(37),
        size = fs.readSync(owned.descriptor, bytes, 0, bytes.length, 0),
        expected = Buffer.from(owned.token);
      if (
        size !== current.size ||
        !bytes.subarray(0, size).equals(expected.subarray(0, size)) ||
        !same(current, fs.lstatSync(lockFile))
      )
        return;
      fs.unlinkSync(lockFile);
    } catch {}
  }
  function lock() {
    requireReady();
    const token = crypto.randomUUID();
    let descriptor, info;
    try {
      descriptor = fs.openSync(lockFile, "wx+", 0o600);
      info = fs.fstatSync(descriptor);
      fs.writeFileSync(descriptor, token);
      fs.fsyncSync(descriptor);
      return { token, descriptor, info };
    } catch (error) {
      if (descriptor !== undefined) {
        if (info) cleanupCreatedLock({ token, descriptor, info });
        fs.closeSync(descriptor);
      }
      fail(error.code === "EEXIST" ? "MUTATION_BUSY" : "STORAGE_UNAVAILABLE");
    }
  }
  function assertLock(owned) {
    checkPath();
    const current = fs.lstatSync(lockFile);
    if (
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.nlink !== 1 ||
      current.size !== 36 ||
      !same(owned.info, current)
    )
      fail("LOCK_OWNERSHIP_LOST");
    const token = Buffer.alloc(37),
      count = fs.readSync(owned.descriptor, token, 0, token.length, 0);
    if (
      count !== 36 ||
      token.subarray(0, count).toString("utf8") !== owned.token ||
      !same(current, fs.lstatSync(lockFile))
    )
      fail("LOCK_OWNERSHIP_LOST");
  }
  function unlock(owned) {
    try {
      assertLock(owned);
      fs.unlinkSync(lockFile);
    } finally {
      fs.closeSync(owned.descriptor);
    }
  }
  function sameObservation(current, prior) {
    if (current === null || prior === null) return current === prior;
    const a = observations.get(current),
      b = observations.get(prior);
    return Boolean(
      a && b && same(a.identity, b.identity) && a.bytes.equals(b.bytes),
    );
  }
  function commit(record, prior, owned) {
    validate(record);
    requireReady();
    checkPath();
    const current = readFile();
    if (!sameObservation(current, prior)) fail("STALE_REVISION");
    const temporary = file + "." + crypto.randomUUID() + ".tmp";
    let fd;
    try {
      fd = fs.openSync(temporary, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(record));
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      requireReady();
      checkPath();
      const check = readFile();
      if (!sameObservation(check, prior)) fail("STALE_REVISION");
      assertLock(owned);
      fs.renameSync(temporary, file);
      selected = record;
      available = true;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      try {
        fs.unlinkSync(temporary);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  async function mutate(expectedRevision, action, initializing = false) {
    if (localBusy) fail("MUTATION_BUSY");
    localBusy = true;
    let owned;
    try {
      owned = lock();
      const prior = readFile();
      if (
        initializing
          ? prior !== null
          : prior === null || prior.revision !== expectedRevision
      )
        fail(initializing ? "ALREADY_CONFIGURED" : "STALE_REVISION");
      const next = await action(prior);
      assertLock(owned);
      next.revision = crypto.randomUUID();
      commit(next, prior, owned);
      emit();
      return status();
    } catch (error) {
      if (
        !(error instanceof SharedModeError) ||
        [
          "UNSAFE_STORAGE",
          "INVALID_STATE",
          "STORAGE_UNAVAILABLE",
          "LOCK_OWNERSHIP_LOST",
        ].includes(error.code)
      ) {
        available = false;
        emit();
      }
      throw error instanceof SharedModeError
        ? error
        : new SharedModeError("STORAGE_UNAVAILABLE");
    } finally {
      localBusy = false;
      if (owned) {
        try {
          unlock(owned);
        } catch {
          available = false;
          emit();
          fail("LOCK_OWNERSHIP_LOST");
        }
      }
    }
  }
  async function hashSecret(kind, secret) {
    if (!secretValid(kind, secret)) fail("INVALID_REQUEST");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await derive(secret, salt, 32, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024,
    });
    return JSON.stringify({
      schemaVersion: 1,
      kind,
      salt,
      hash: hash.toString("hex"),
    });
  }
  async function verify(record, { secret, assertion } = {}) {
    if (!record.credential) fail("CREDENTIAL_REQUIRED");
    let stored;
    try {
      const text = await vault.read(record.credential.reference, OWNER);
      if (typeof text !== "string" || Buffer.byteLength(text) > 8192)
        fail("VAULT_UNAVAILABLE");
      stored = JSON.parse(text);
    } catch {
      fail("VAULT_UNAVAILABLE");
    }
    const kind = record.credential.kind;
    if (kind === "passkey") {
      if (!passkey || typeof passkey.verify !== "function")
        fail("PASSKEY_UNAVAILABLE");
      if (
        !exact(stored, ["schemaVersion", "kind", "registration"]) ||
        stored.schemaVersion !== 1 ||
        stored.kind !== kind
      )
        fail("VAULT_UNAVAILABLE");
      let valid = false;
      try {
        valid = await passkey.verify(stored.registration, assertion);
      } catch {
        fail("PASSKEY_UNAVAILABLE");
      }
      if (valid !== true) fail("VERIFICATION_FAILED");
      return;
    }
    if (
      !exact(stored, ["schemaVersion", "kind", "salt", "hash"]) ||
      stored.schemaVersion !== 1 ||
      stored.kind !== kind ||
      typeof stored.salt !== "string" ||
      typeof stored.hash !== "string" ||
      !/^[0-9a-f]{32}$/.test(stored.salt) ||
      !/^[0-9a-f]{64}$/.test(stored.hash)
    )
      fail("VAULT_UNAVAILABLE");
    if (!secretValid(kind, secret)) fail("VERIFICATION_FAILED");
    const candidate = await derive(secret, stored.salt, 32, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024,
    });
    if (!crypto.timingSafeEqual(candidate, Buffer.from(stored.hash, "hex")))
      fail("VERIFICATION_FAILED");
  }
  const api = {
    async start() {
      if (closed) fail("SERVICE_CLOSED");
      if (started) return status();
      try {
        prepare();
        started = true;
        attachWatcher();
        await requestRefresh();
        return status();
      } catch {
        available = false;
        emit();
        fail("STORAGE_UNAVAILABLE");
      }
    },
    status,
    subscribe(listener) {
      if (typeof listener !== "function") fail("INVALID_REQUEST");
      listeners.add(listener);
      try {
        listener(status());
      } catch {}
      return () => listeners.delete(listener);
    },
    async reload() {
      if (!started || closed || !watching) fail("WATCH_UNAVAILABLE");
      return requestRefresh();
    },
    initialize({ displayName = "School mode" } = {}) {
      if (!labelValid(displayName))
        return Promise.reject(new SharedModeError("INVALID_REQUEST"));
      return mutate(
        null,
        async () => ({
          protocol: MARKER,
          schemaVersion: 1,
          revision: crypto.randomUUID(),
          active: false,
          displayName,
          credential: null,
        }),
        true,
      );
    },
    enrollCredential({
      expectedRevision,
      kind,
      secret,
      confirmation,
      current = {},
      registration,
    } = {}) {
      return mutate(expectedRevision, async (prior) => {
        if (!["pin", "password", "passkey"].includes(kind))
          fail("INVALID_REQUEST");
        if (prior.credential) await verify(prior, current);
        let protectedValue;
        if (kind === "passkey") {
          if (
            !passkey ||
            typeof passkey.enroll !== "function" ||
            typeof passkey.verify !== "function"
          )
            fail("PASSKEY_UNAVAILABLE");
          let enrolled;
          try {
            enrolled = await passkey.enroll(registration);
          } catch {
            fail("PASSKEY_UNAVAILABLE");
          }
          if (enrolled === undefined || JSON.stringify(enrolled).length > 4096)
            fail("PASSKEY_UNAVAILABLE");
          protectedValue = JSON.stringify({
            schemaVersion: 1,
            kind,
            registration: enrolled,
          });
        } else {
          if (secret !== confirmation) fail("INVALID_REQUEST");
          protectedValue = await hashSecret(kind, secret);
        }
        let reference;
        try {
          reference = await vault.write(OWNER, protectedValue);
        } catch {
          fail("VAULT_UNAVAILABLE");
        }
        if (typeof reference !== "string" || !REFERENCE.test(reference))
          fail("VAULT_UNAVAILABLE");
        return { ...prior, credential: { kind, reference } };
      });
    },
    enter({ expectedRevision } = {}) {
      return mutate(expectedRevision, async (prior) => {
        if (!prior.credential) fail("CREDENTIAL_REQUIRED");
        return { ...prior, active: true };
      });
    },
    leave({ expectedRevision, secret, assertion } = {}) {
      return mutate(expectedRevision, async (prior) => {
        await verify(prior, { secret, assertion });
        return { ...prior, active: false };
      });
    },
    rename({ expectedRevision, displayName } = {}) {
      if (!labelValid(displayName))
        return Promise.reject(new SharedModeError("INVALID_REQUEST"));
      return mutate(expectedRevision, async (prior) => ({
        ...prior,
        displayName,
      }));
    },
    recovery() {
      return Object.freeze({
        directory,
        record: file,
        disclosure:
          "This is a reversible experience preference, not a security boundary. Resetting the shared local record resets the mode for participating applications.",
      });
    },
    close() {
      closed = true;
      watching = false;
      available = false;
      if (retryTimer) clearTimeout(retryTimer);
      const failedWatcher = watcher;
      watcher = undefined;
      try {
        failedWatcher?.close();
      } catch {}
      emit();
      listeners.clear();
    },
  };
  return Object.freeze(api);
}
module.exports = { createSharedModeService, SharedModeError };
