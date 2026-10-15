"use strict";
const { parse } = require("../security/workspace-contract.cjs");
const MAX_BYTES = 16384;
const REVISION =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CODES = new Set([
  "INVALID_REQUEST",
  "WATCH_UNAVAILABLE",
  "STORAGE_UNAVAILABLE",
  "UNSAFE_STORAGE",
  "INVALID_STATE",
  "STALE_REVISION",
  "ALREADY_CONFIGURED",
  "CREDENTIAL_REQUIRED",
  "VAULT_UNAVAILABLE",
  "PASSKEY_UNAVAILABLE",
  "VERIFICATION_FAILED",
  "MUTATION_BUSY",
  "LOCK_OWNERSHIP_LOST",
  "SERVICE_CLOSED",
]);
function exact(value, required, optional = []) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some(
      (key) => !required.includes(key) && !optional.includes(key),
    )
  )
    throw Error("Invalid request");
}
function request(serialized) {
  if (
    typeof serialized !== "string" ||
    Buffer.byteLength(serialized, "utf8") > MAX_BYTES
  )
    throw Error("Invalid request");
  const value = parse(serialized);
  const fields = {
    status: ["action"],
    reload: ["action"],
    recovery: ["action"],
    initialize: ["action", "displayName"],
    enter: ["action", "expectedRevision"],
    leave: ["action", "expectedRevision", "secret"],
    rename: ["action", "expectedRevision", "displayName"],
    enroll: ["action", "expectedRevision", "kind", "secret", "confirmation"],
  };
  if (typeof value?.action !== "string" || !Object.hasOwn(fields, value.action))
    throw Error("Invalid request");
  exact(
    value,
    fields[value.action],
    value.action === "enroll" ? ["currentSecret"] : [],
  );
  if (
    Object.hasOwn(value, "expectedRevision") &&
    (typeof value.expectedRevision !== "string" ||
      !REVISION.test(value.expectedRevision))
  )
    throw Error("Invalid revision");
  if (
    Object.hasOwn(value, "displayName") &&
    (typeof value.displayName !== "string" ||
      [...value.displayName].length < 1 ||
      [...value.displayName].length > 96 ||
      !value.displayName.trim() ||
      /[\u0000-\u001f\u007f]/u.test(value.displayName))
  )
    throw Error("Invalid name");
  for (const key of ["secret", "confirmation", "currentSecret"])
    if (
      Object.hasOwn(value, key) &&
      (typeof value[key] !== "string" ||
        Buffer.byteLength(value[key], "utf8") > 4096)
    )
      throw Error("Invalid credential");
  if (value.action === "enroll" && !["pin", "password"].includes(value.kind))
    throw Error("Unavailable credential");
  return value;
}
/** No request, credential, error detail, or private state is logged or persisted by this boundary. */
function createSharedModeIPC({ desktop, service }) {
  let closed = false;
  return Object.freeze({
    async request(event, serialized) {
      if (!desktop.admitted(event)) return { ok: false, code: "UNAUTHORIZED" };
      if (closed || !service) return { ok: false, code: "UNAVAILABLE" };
      let input;
      try {
        input = request(serialized);
      } catch {
        return { ok: false, code: "INVALID_REQUEST" };
      }
      try {
        let result;
        const { action, ...options } = input;
        if (action === "enroll") {
          const { currentSecret, ...enrollment } = options;
          result = await service.enrollCredential({
            ...enrollment,
            ...(currentSecret === undefined
              ? {}
              : { current: { secret: currentSecret } }),
          });
        } else result = await service[action](options);
        if (closed || !desktop.admitted(event))
          return { ok: false, code: "UNAUTHORIZED" };
        return { ok: true, result };
      } catch (error) {
        if (closed || !desktop.admitted(event))
          return { ok: false, code: "UNAUTHORIZED" };
        return {
          ok: false,
          code: CODES.has(error?.code) ? error.code : "UNAVAILABLE",
        };
      }
    },
    close() {
      closed = true;
      service?.close();
    },
  });
}
module.exports = { createSharedModeIPC };
