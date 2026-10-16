"use strict";
const fs = require("node:fs");
const storage = require("./storage.cjs");
function validate(value) {
  const bounds = { maxConcurrent: [1, 64], cpuSlots: [1, 1024], memoryBytes: [1, 1024 ** 4], storageBytes: [0, 1024 ** 5] };
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 4 || Object.entries(bounds).some(([key, [min, max]]) => !Number.isSafeInteger(value[key]) || value[key] < min || value[key] > max))
    throw Object.assign(Error("Invalid scheduler budgets"), { code: "INVALID_SCHEDULER_LIMITS" });
  return Object.fromEntries(Object.keys(bounds).map(key => [key, value[key]]));
}
function createBudgetStore(file, defaults) {
  let limits = validate(defaults);
  if (fs.existsSync(file)) {
    if (fs.statSync(file).size > 2048) throw Error("Invalid scheduler budget storage");
    const saved = storage.read(file);
    if (saved.version !== 1) throw Error("Invalid scheduler budget version");
    limits = validate(saved.limits);
  }
  return {
    read: () => ({ ...limits }),
    write(value) {
      const next = validate(value);
      storage.atomic(file, { version: 1, limits: next });
      limits = next;
      return { ...limits };
    }
  };
}
module.exports = { createBudgetStore };
