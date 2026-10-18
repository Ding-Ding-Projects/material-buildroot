"use strict";
const PROFILE = "x86_64-bios-grub2-initrd";
const KEYS = ["version", "profile", "appliedConfigurationRevision", "path", "freshness", "state"];
function invalid() { throw Object.assign(new Error("Invalid ISO output intent"), { code: "BLOCKED_INVALID_INTENT" }); }
/** Intent metadata only. This object never establishes output provenance. */
function assertIsoOutputPolicy(policy, target) {
  if (!policy || Object.getPrototypeOf(policy) !== Object.prototype || Reflect.ownKeys(policy).length !== KEYS.length ||
      Reflect.ownKeys(policy).some(key => !KEYS.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(policy, key), "value")) ||
      target !== "all" || policy.version !== 1 || policy.profile !== PROFILE ||
      typeof policy.appliedConfigurationRevision !== "string" || !/^[a-f0-9]{64}$/.test(policy.appliedConfigurationRevision) ||
      policy.path !== "images/rootfs.iso9660" || policy.freshness !== "required" || policy.state !== "intent-only") invalid();
  return policy;
}
function createIsoOutputPolicy({ revision, profile }) {
  return Object.freeze(assertIsoOutputPolicy({ version: 1, profile, appliedConfigurationRevision: revision,
    path: "images/rootfs.iso9660", freshness: "required", state: "intent-only" }, "all"));
}
module.exports = { createIsoOutputPolicy, assertIsoOutputPolicy };
