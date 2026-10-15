import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { homeAssistantVaultOwner } from "./schedule-provider.mjs";
const require = createRequire(import.meta.url),
  { parse } = require("../security/workspace-contract.cjs"),
  storage = require("../jobs/storage.cjs");
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REF =
  /^vault:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exact = (value, keys) =>
  value &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const copy = (value) => JSON.parse(JSON.stringify(value));
export class SourceEnrollmentError extends Error {
  constructor(code) {
    super("Scheduled source enrollment is unavailable.");
    this.name = "SourceEnrollmentError";
    this.code = code;
  }
}
const fail = (code) => {
  throw new SourceEnrollmentError(code);
};
function privateAddress(value) {
  if (typeof value !== "string" || value.includes("%"))
    fail("INVALID_SOURCE_ENROLLMENT");
  if (net.isIP(value) === 4) {
    const [a, b] = value.split(".").map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
      return value;
  }
  if (net.isIP(value) === 6) {
    const canonical = new URL("http://[" + value + "]/").hostname.slice(1, -1);
    if (/^(?:fc|fd)/i.test(canonical)) return canonical;
  }
  fail("INVALID_SOURCE_ENROLLMENT");
}
function validateEntry(entry) {
  if (
    !exact(entry, [
      "id",
      "label",
      "origin",
      "kind",
      "privateAddresses",
      "credentialReference",
    ]) ||
    typeof entry.id !== "string" ||
    !UUID.test(entry.id) ||
    typeof entry.label !== "string" ||
    ![...entry.label].length ||
    [...entry.label].length > 96 ||
    !entry.label.trim() ||
    /[\u0000-\u001f\u007f]/u.test(entry.label) ||
    typeof entry.origin !== "string" ||
    entry.origin.length > 2048 ||
    !["https", "home-assistant"].includes(entry.kind) ||
    !Array.isArray(entry.privateAddresses) ||
    Object.keys(entry.privateAddresses).length !==
      entry.privateAddresses.length ||
    entry.privateAddresses.length > 16
  )
    fail("INVALID_SOURCE_ENROLLMENT");
  let url;
  try {
    url = new URL(entry.origin);
  } catch {
    fail("INVALID_SOURCE_ENROLLMENT");
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== entry.origin ||
    url.username ||
    url.password ||
    /[\u0000-\u0020\u007f]/u.test(entry.origin)
  )
    fail("INVALID_SOURCE_ENROLLMENT");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    (net.isIP(host) === 4 &&
      (host.startsWith("127.") ||
        host.startsWith("169.254.") ||
        host.startsWith("0."))) ||
    host === "::1" ||
    /^fe[89ab][0-9a-f]:/i.test(host) ||
    host.includes("::ffff:")
  )
    fail("INVALID_SOURCE_ENROLLMENT");
  if (
    (entry.kind === "https" &&
      (entry.privateAddresses.length || entry.credentialReference !== null)) ||
    (entry.kind === "home-assistant" &&
      (typeof entry.credentialReference !== "string" ||
        !REF.test(entry.credentialReference)))
  )
    fail("INVALID_SOURCE_ENROLLMENT");
  const addresses = entry.privateAddresses.map(privateAddress);
  if (
    new Set(addresses).size !== addresses.length ||
    addresses.some((address, i) => address !== entry.privateAddresses[i])
  )
    fail("INVALID_SOURCE_ENROLLMENT");
  return entry;
}
function validate(value) {
  if (
    !exact(value, ["format", "version", "revision", "entries"]) ||
    value.format !== "scheduled-source-enrollments" ||
    value.version !== 1 ||
    typeof value.revision !== "string" ||
    !UUID.test(value.revision) ||
    !Array.isArray(value.entries) ||
    value.entries.length > 32 ||
    Buffer.byteLength(JSON.stringify(value)) > 131072
  )
    fail("SCHEDULE_ENROLLMENTS_INVALID");
  const ids = new Set(),
    origins = new Set();
  for (const entry of value.entries) {
    validateEntry(entry);
    if (ids.has(entry.id) || origins.has(entry.origin))
      fail("SCHEDULE_ENROLLMENTS_INVALID");
    ids.add(entry.id);
    origins.add(entry.origin);
  }
  return value;
}
export function createSourceEnrollmentStore({
  directory,
  profileId,
  vault,
} = {}) {
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    typeof profileId !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(profileId)
  )
    fail("INVALID_SOURCE_ENROLLMENT");
  try {
    directory = storage.directory(directory);
  } catch {
    fail("SCHEDULE_ENROLLMENTS_UNAVAILABLE");
  }
  const file = path.join(directory, "schedule-sources-" + profileId + ".json"),
    lockFile = file + ".lock",
    root = fs.statSync(directory, { bigint: true });
  let closed = false;
  const sig = (s) =>
    [s.dev, s.ino, s.birthtimeNs, s.size, s.mtimeNs, s.ctimeNs, s.nlink]
      .map(String)
      .join(":");
  function guard(allowClosed = false) {
    if (closed && !allowClosed) fail("SCHEDULE_ENROLLMENTS_CLOSED");
    storage.assertSafe(directory);
    const current = fs.statSync(directory, { bigint: true });
    if (current.dev !== root.dev || current.ino !== root.ino)
      fail("SCHEDULE_ENROLLMENTS_UNAVAILABLE");
  }
  function read() {
    guard();
    let before;
    try {
      before = fs.lstatSync(file, { bigint: true });
    } catch (error) {
      if (error.code === "ENOENT")
        return { value: null, bytes: null, identity: null };
      throw error;
    }
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size > 131072n
    )
      fail("SCHEDULE_ENROLLMENTS_INVALID");
    const fd = fs.openSync(
      file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    try {
      const opened = fs.fstatSync(fd, { bigint: true });
      if (sig(opened) !== sig(before)) fail("SCHEDULE_ENROLLMENTS_INVALID");
      const buffer = Buffer.alloc(131073);
      let size = 0;
      while (size < buffer.length) {
        const count = fs.readSync(fd, buffer, size, buffer.length - size, null);
        if (!count) break;
        size += count;
      }
      if (
        size > 131072 ||
        sig(opened) !== sig(fs.fstatSync(fd, { bigint: true })) ||
        sig(opened) !== sig(fs.lstatSync(file, { bigint: true }))
      )
        fail("SCHEDULE_ENROLLMENTS_INVALID");
      const bytes = Buffer.from(buffer.subarray(0, size));
      let value;
      try {
        value = validate(
          parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
        );
      } catch {
        fail("SCHEDULE_ENROLLMENTS_INVALID");
      }
      return { value, bytes, identity: sig(opened) };
    } finally {
      fs.closeSync(fd);
    }
  }
  const permitted = (authorize) => {
    let yes = false;
    try {
      yes = !closed && typeof authorize === "function" && authorize() === true;
    } catch {}
    if (!yes) fail("UNAUTHORIZED");
  };
  async function mutate(expectedRevision, authorize, action) {
    let fd,
      lockInfo,
      token = randomUUID();
    permitted(authorize);
    guard();
    try {
      fd = fs.openSync(lockFile, "wx+", 0o600);
      lockInfo = fs.fstatSync(fd, { bigint: true });
      fs.writeFileSync(fd, token);
      fs.fsyncSync(fd);
    } catch (error) {
      if (fd !== undefined) {
        try {
          const info = fs.lstatSync(lockFile, { bigint: true });
          const partial = Buffer.alloc(37),
            length = fs.readSync(fd, partial, 0, partial.length, 0);
          if (
            lockInfo &&
            info.dev === lockInfo.dev &&
            info.ino === lockInfo.ino &&
            info.nlink === 1n &&
            length <= 36 &&
            partial
              .subarray(0, length)
              .equals(Buffer.from(token).subarray(0, length))
          )
            fs.unlinkSync(lockFile);
        } catch {}
        fs.closeSync(fd);
      }
      fail(
        error.code === "EEXIST"
          ? "SCHEDULE_ENROLLMENTS_BUSY"
          : "SCHEDULE_ENROLLMENTS_UNAVAILABLE",
      );
    }
    try {
      const observed = read();
      if ((observed.value?.revision ?? null) !== expectedRevision)
        fail("STALE_REVISION");
      const entries = copy(observed.value?.entries ?? []);
      await action(entries);
      permitted(authorize);
      const next = validate({
        format: "scheduled-source-enrollments",
        version: 1,
        revision: randomUUID(),
        entries,
      });
      const actual = read();
      if (
        actual.identity !== observed.identity ||
        !(
          (actual.bytes === null && observed.bytes === null) ||
          (actual.bytes &&
            observed.bytes &&
            actual.bytes.equals(observed.bytes))
        )
      )
        fail("STALE_REVISION");
      const currentLock = fs.lstatSync(lockFile, { bigint: true }),
        buffer = Buffer.alloc(37),
        length = fs.readSync(fd, buffer, 0, buffer.length, 0);
      if (
        currentLock.dev !== lockInfo.dev ||
        currentLock.ino !== lockInfo.ino ||
        currentLock.nlink !== 1n ||
        length !== 36 ||
        buffer.subarray(0, length).toString() !== token
      )
        fail("SCHEDULE_ENROLLMENTS_UNAVAILABLE");
      permitted(authorize);
      const temporary = file + "." + randomUUID() + ".tmp";
      let temporaryFd;
      try {
        temporaryFd = fs.openSync(temporary, "wx", 0o600);
        fs.writeFileSync(temporaryFd, JSON.stringify(next));
        fs.fsyncSync(temporaryFd);
        fs.closeSync(temporaryFd);
        temporaryFd = undefined;
        guard();
        const final = read();
        if (
          final.identity !== observed.identity ||
          !(
            (final.bytes === null && observed.bytes === null) ||
            (final.bytes &&
              observed.bytes &&
              final.bytes.equals(observed.bytes))
          )
        )
          fail("STALE_REVISION");
        const finalLock = fs.lstatSync(lockFile, { bigint: true });
        if (
          finalLock.dev !== lockInfo.dev ||
          finalLock.ino !== lockInfo.ino ||
          finalLock.nlink !== 1n
        )
          fail("SCHEDULE_ENROLLMENTS_UNAVAILABLE");
        permitted(authorize);
        fs.renameSync(temporary, file);
        if (process.platform !== "win32") {
          const parent = fs.openSync(directory, "r");
          try {
            fs.fsyncSync(parent);
          } finally {
            fs.closeSync(parent);
          }
        }
      } finally {
        if (temporaryFd !== undefined) fs.closeSync(temporaryFd);
        try {
          fs.unlinkSync(temporary);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      return safeList(next);
    } finally {
      try {
        guard(true);
        const current = fs.lstatSync(lockFile, { bigint: true });
        const retained = Buffer.alloc(37),
          length = fs.readSync(fd, retained, 0, retained.length, 0);
        if (
          current.dev === lockInfo.dev &&
          current.ino === lockInfo.ino &&
          current.nlink === 1n &&
          length === 36 &&
          retained.subarray(0, length).toString() === token
        )
          fs.unlinkSync(lockFile);
      } catch {}
      fs.closeSync(fd);
    }
  }
  const safeList = (value) => ({
    available: true,
    revision: value?.revision ?? null,
    entries: (value?.entries ?? []).map(
      ({ credentialReference, ...entry }) => ({
        ...entry,
        credentialConfigured: credentialReference !== null,
      }),
    ),
  });
  const safe = async (task) => {
    try {
      return await task();
    } catch (error) {
      if (error instanceof SourceEnrollmentError) throw error;
      fail("SCHEDULE_ENROLLMENTS_UNAVAILABLE");
    }
  };
  return Object.freeze({
    list() {
      return safe(async () => safeList(read().value));
    },
    // Host-only binding: never pass protected references through IPC or ordinary history.
    bindings() {
      return safe(async () => {
        const observed = read();
        return {
          revision: observed.value?.revision ?? null,
          entries: copy(observed.value?.entries ?? []).map(
            ({ id, label, ...entry }) => ({
              ...entry,
              developmentLoopback: false,
            }),
          ),
        };
      });
    },
    save(input = {}) {
      const {
        expectedRevision,
        id,
        label,
        origin,
        kind,
        privateAddresses = [],
        privateAddressConsent = false,
        token,
        retainCredential = false,
        authorize = () => true,
      } = input;
      return safe(() => {
        if (
          !input ||
          Object.getPrototypeOf(input) !== Object.prototype ||
          Reflect.ownKeys(input).some(
            (key) =>
              ![
                "expectedRevision",
                "id",
                "label",
                "origin",
                "kind",
                "privateAddresses",
                "privateAddressConsent",
                "token",
                "retainCredential",
                "authorize",
              ].includes(key),
          ) ||
          typeof privateAddressConsent !== "boolean" ||
          typeof retainCredential !== "boolean"
        )
          fail("INVALID_SOURCE_ENROLLMENT");
        return mutate(expectedRevision, authorize, async (entries) => {
          if (id !== undefined && (typeof id !== "string" || !UUID.test(id)))
            fail("INVALID_SOURCE_ENROLLMENT");
          const previous = id ? entries.find((entry) => entry.id === id) : null;
          if (id && !previous) fail("SOURCE_ENROLLMENT_NOT_FOUND");
          if (entries.length >= 32 && !previous)
            fail("SCHEDULE_ENROLLMENTS_LIMIT");
          if (
            !Array.isArray(privateAddresses) ||
            Object.keys(privateAddresses).length !== privateAddresses.length ||
            privateAddresses.length > 16 ||
            (privateAddresses.length && privateAddressConsent !== true)
          )
            fail("INVALID_SOURCE_ENROLLMENT");
          const addresses = privateAddresses.map(privateAddress),
            entry = {
              id: id ?? randomUUID(),
              label,
              origin,
              kind,
              privateAddresses: addresses,
              credentialReference:
                kind === "https"
                  ? null
                  : (previous?.credentialReference ?? "vault:" + randomUUID()),
            };
          validateEntry(entry);
          if (
            entries.some(
              (existing) =>
                existing.id !== entry.id && existing.origin === origin,
            )
          )
            fail("INVALID_SOURCE_ENROLLMENT");
          if (kind === "https") {
            if (token !== undefined || retainCredential)
              fail("INVALID_SOURCE_ENROLLMENT");
          } else if (token !== undefined) {
            if (
              retainCredential ||
              typeof token !== "string" ||
              !token ||
              token.length > 8192 ||
              /[\u0000-\u0020\u007f]/u.test(token) ||
              !vault ||
              typeof vault.write !== "function"
            )
              fail("SOURCE_CREDENTIAL_UNAVAILABLE");
            permitted(authorize);
            let reference;
            try {
              reference = await vault.write(
                homeAssistantVaultOwner(origin),
                token,
              );
            } catch {
              fail("SOURCE_CREDENTIAL_UNAVAILABLE");
            }
            permitted(authorize);
            if (typeof reference !== "string" || !REF.test(reference))
              fail("SOURCE_CREDENTIAL_UNAVAILABLE");
            entry.credentialReference = reference;
          } else if (
            !(
              retainCredential &&
              previous?.kind === "home-assistant" &&
              previous.origin === origin &&
              previous.credentialReference
            )
          )
            fail("SOURCE_CREDENTIAL_REQUIRED");
          if (previous)
            entries[entries.findIndex((existing) => existing.id === id)] =
              entry;
          else entries.push(entry);
        });
      });
    },
    remove(input = {}) {
      const { expectedRevision, id, authorize = () => true } = input;
      return safe(() => {
        if (
          !input ||
          Object.getPrototypeOf(input) !== Object.prototype ||
          Reflect.ownKeys(input).some(
            (key) => !["expectedRevision", "id", "authorize"].includes(key),
          ) ||
          typeof id !== "string" ||
          !UUID.test(id)
        )
          fail("INVALID_SOURCE_ENROLLMENT");
        return mutate(expectedRevision, authorize, async (entries) => {
          const index = entries.findIndex((entry) => entry.id === id);
          if (index < 0) fail("SOURCE_ENROLLMENT_NOT_FOUND");
          entries.splice(index, 1);
        });
      });
    },
    close() {
      closed = true;
    },
  });
}
