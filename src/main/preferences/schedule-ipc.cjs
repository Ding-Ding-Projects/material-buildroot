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
  "SCHEDULE_STORAGE_INVALID",
  "INVALID_SCHEDULE_DRAFT",
  "SCHEDULE_DRAFT_LIMIT",
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
  "INVALID_SOURCE_ENROLLMENT",
  "SCHEDULE_ENROLLMENTS_INVALID",
  "SCHEDULE_ENROLLMENTS_UNAVAILABLE",
  "SCHEDULE_ENROLLMENTS_BUSY",
  "SCHEDULE_ENROLLMENTS_CLOSED",
  "SCHEDULE_ENROLLMENTS_LIMIT",
  "SOURCE_ENROLLMENT_NOT_FOUND",
  "SOURCE_CREDENTIAL_REQUIRED",
  "SOURCE_CREDENTIAL_UNAVAILABLE",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
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
    "enrollment.list": ["action"],
    "enrollment.save": [
      "action",
      "expectedRevision",
      "label",
      "origin",
      "kind",
    ],
    "enrollment.remove": ["action", "expectedRevision", "id"],
    "draft.discard": ["action", "document"],
    "draft.list": ["action", "after", "limit"],
    "draft.read": ["action", "sequence"],
  };
  const optional =
    value?.action === "enrollment.save"
      ? [
          "id",
          "privateAddresses",
          "privateAddressConsent",
          "token",
          "retainCredential",
        ]
      : [];
  if (
    !value ||
    typeof value.action !== "string" ||
    !Object.hasOwn(keys, value.action) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).some(
      (key) => !keys[value.action].includes(key) && !optional.includes(key),
    ) ||
    keys[value.action].some((key) => !Object.hasOwn(value, key))
  )
    throw Error();
  if (
    value.action === "enrollment.save" ||
    value.action === "enrollment.remove"
  ) {
    if (
      value.expectedRevision !== null &&
      (typeof value.expectedRevision !== "string" ||
        !uuid.test(value.expectedRevision))
    )
      throw Error();
    if (
      Object.hasOwn(value, "id") &&
      (typeof value.id !== "string" || !uuid.test(value.id))
    )
      throw Error();
  }
  if (
    value.action === "replace" &&
    value.expectedRevision !== null &&
    (!Number.isSafeInteger(value.expectedRevision) ||
      value.expectedRevision < 0)
  )
    throw Error();
  if (
    ["history","draft.list"].includes(value.action) &&
    (!Number.isSafeInteger(value.after) ||
      value.after < 0 ||
      !Number.isSafeInteger(value.limit) ||
      value.limit < 1 ||
      value.limit > (value.action === "draft.list" ? 20 : 100))
  )
    throw Error();
  if(value.action === "draft.read" && (!Number.isSafeInteger(value.sequence) || value.sequence<1)) throw Error();
  return value;
}
/** Authority, storage destinations, network enrollment and credentials stay in the host. */
function createScheduleIPC({ desktop, service, sharedModeStatus }) {
  let closed = false;
  const authorized = (event) => !closed && desktop.admitted(event);
  const draftAuthorized = event => {
    if(!authorized(event)) return false;
    try { const status=sharedModeStatus?.(); return status?.available === true && status.active === false; } catch { return false; }
  };
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
        const draftAction=action.startsWith("draft.");
        const permitted=()=>draftAction ? draftAuthorized(event) : authorized(event);
        if(!permitted()) return {ok:false,code:"UNAUTHORIZED"};
        const method =
          {
            "enrollment.list": "enrollmentList",
            "enrollment.save": "enrollmentSave",
            "enrollment.remove": "enrollmentRemove",
            "draft.discard": "draftDiscard",
            "draft.list": "draftList",
            "draft.read": "draftRead",
          }[action] || action;
        const result = [
          "replace",
          "enrollment.save",
          "enrollment.remove",
          "draft.discard",
          "draft.list",
          "draft.read",
        ].includes(action)
          ? await service[method]({
              ...options,
              authorize: permitted,
            })
          : await service[method](options);
        if (!permitted()) return { ok: false, code: "UNAUTHORIZED" };
        return { ok: true, result };
      } catch (error) {
        if (!authorized(event) || (input.action.startsWith("draft.") && !draftAuthorized(event))) return { ok: false, code: "UNAUTHORIZED" };
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
