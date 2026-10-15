"use strict";
const { parse } = require("../security/workspace-contract.cjs");
const MAX_BYTES = 264192;
const CODES = new Set([
  "UNAUTHORIZED",
  "INVALID_REQUEST",
  "INVALID_SCHEMA",
  "INVALID_RULE",
  "INVALID_VALUES",
  "UNKNOWN_SETTING",
  "INVALID_SOURCE",
  "BYTE_LIMIT",
  "STALE_REVISION",
  "REVISION_EXHAUSTED",
  "STORAGE_UNAVAILABLE",
  "STORAGE_INVALID",
  "SCHEDULE_STORAGE_UNAVAILABLE",
  "SCHEDULE_STORAGE_BUSY",
  "SCHEDULE_RECOVERY_UNAVAILABLE",
  "INVALID_HISTORY_PAGE",
  "SERVICE_CLOSED",
  "BASE_UNAVAILABLE",
  "WATCH_UNAVAILABLE",
  "SCHEDULE_SERVICE_CLOSED",
  "SCHEDULE_BASE_UNAVAILABLE",
  "SCHEDULE_WATCH_UNAVAILABLE",
  "SCHEDULE_CLOCK_UNAVAILABLE",
  "SCHEDULE_EVALUATION_SUPERSEDED",
]);
function admit(serialized) {
  if (
    typeof serialized !== "string" ||
    Buffer.byteLength(serialized, "utf8") > MAX_BYTES
  )
    throw Error();
  const value = parse(serialized);
  const keys = {
    status: ["action"],
    read: ["action"],
    refresh: ["action"],
    cancel: ["action"],
    replace: ["action", "document", "expectedRevision"],
    history: ["action", "after", "limit"],
  };
  if (
    !value ||
    typeof value.action !== "string" ||
    !Object.hasOwn(keys, value.action) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== keys[value.action].length ||
    keys[value.action].some((key) => !Object.hasOwn(value, key))
  )
    throw Error();
  if (
    value.action === "replace" &&
    value.expectedRevision !== null &&
    (!Number.isSafeInteger(value.expectedRevision) ||
      value.expectedRevision < 0)
  )
    throw Error();
  if (
    value.action === "history" &&
    (!Number.isSafeInteger(value.after) ||
      value.after < 0 ||
      !Number.isSafeInteger(value.limit) ||
      value.limit < 1 ||
      value.limit > 100)
  )
    throw Error();
  return value;
}
/** Authority, storage destinations, network enrollment and credentials stay in the host. */
function createScheduleIPC({ desktop, service }) {
  let closed = false;
  const authorized = (event) => !closed && desktop.admitted(event);
  return Object.freeze({
    async request(event, serialized) {
      if (!authorized(event)) return { ok: false, code: "UNAUTHORIZED" };
      if (!service) return { ok: false, code: "UNAVAILABLE" };
      let input;
      try {
        input = admit(serialized);
      } catch {
        return { ok: false, code: "INVALID_REQUEST" };
      }
      try {
        const { action, ...options } = input;
        const result =
          action === "replace"
            ? await service.replace({
                ...options,
                authorize: () => authorized(event),
              })
            : await service[action](options);
        if (!authorized(event)) return { ok: false, code: "UNAUTHORIZED" };
        return { ok: true, result };
      } catch (error) {
        if (!authorized(event)) return { ok: false, code: "UNAUTHORIZED" };
        return {
          ok: false,
          code: CODES.has(error?.code) ? error.code : "UNAVAILABLE",
        };
      }
    },
    close() {
      closed = true;
      return service?.close();
    },
  });
}
module.exports = { createScheduleIPC };
