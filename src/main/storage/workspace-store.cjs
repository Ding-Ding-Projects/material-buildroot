"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const contract = require("../security/workspace-contract.cjs");
const fresh = () => ({
  format: "material-buildroot-workspace",
  version: 1,
  revision: 0,
  plans: [],
  preferences: { theme: "system" },
  onboardingCompleted: false,
  onboarding: { step: 0, runtime: "wsl", name: "", dismissed: false },
  snapshots: [],
  activity: [],
});
const clone = (value) => JSON.parse(JSON.stringify(value));
function createWorkspaceStore({ filePath }) {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath))
    throw new TypeError("An absolute host-owned storage path is required.");
  function read() {
    try {
      const info = fs.lstatSync(filePath);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > contract.MAX_BYTES
      )
        throw new Error("Invalid storage file");
      return clone(
        contract.state(contract.parse(fs.readFileSync(filePath, "utf8"))),
      );
    } catch (error) {
      if (error.code === "ENOENT") return fresh();
      const failure = new Error(
        "Workspace storage is unavailable; existing data was preserved.",
      );
      failure.code = "STORAGE_UNAVAILABLE";
      throw failure;
    }
  }
  function journalRoot() {
    const directory = `${filePath}.activity`;
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const info = fs.lstatSync(directory);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      fs.realpathSync.native(directory) !== directory
    )
      throw new Error("Invalid activity storage");
    return directory;
  }
  function journalEvent(event, committed) {
    const directory = journalRoot();
    const destination = path.join(directory, `${event.revision}.json`);
    const serialized = JSON.stringify(event);
    if (fs.existsSync(destination)) {
      const info = fs.lstatSync(destination);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 2048)
        throw new Error("Invalid activity record");
      const previous = fs.readFileSync(destination, "utf8");
      if (previous === serialized) return;
      if (committed) throw new Error("Conflicting activity record");
    }
    const temporary = path.join(directory, `${randomUUID()}.tmp`);
    const descriptor = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, serialized);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    try {
      fs.renameSync(temporary, destination);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
  function activityPage(input = {}) {
    if (
      !input ||
      Object.getPrototypeOf(input) !== Object.prototype ||
      Reflect.ownKeys(input).some(
        (key) =>
          !["beforeRevision", "limit"].includes(key) ||
          !Object.hasOwn(Object.getOwnPropertyDescriptor(input, key), "value"),
      )
    ) {
      const error = new Error("Invalid activity page");
      error.code = "INVALID_REQUEST";
      throw error;
    }
    let { beforeRevision, limit = 50 } = input;
    const current = read();
    if (beforeRevision === undefined) beforeRevision = current.revision + 1;
    if (
      !Number.isSafeInteger(beforeRevision) ||
      beforeRevision < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      const error = new Error("Invalid activity page");
      error.code = "INVALID_REQUEST";
      throw error;
    }
    for (const event of current.activity) journalEvent(event, true);
    const directory = journalRoot();
    const selected = [];
    const iterator = fs.opendirSync(directory);
    try {
      let entry;
      while ((entry = iterator.readSync()) !== null) {
        if (!/^[1-9][0-9]*\.json$/.test(entry.name)) continue;
        const revision = Number(entry.name.slice(0, -5));
        if (
          Number.isSafeInteger(revision) &&
          revision <= current.revision &&
          revision < beforeRevision
        ) {
          selected.push(revision);
          selected.sort((a, b) => b - a);
          if (selected.length > limit) selected.pop();
        }
      }
    } finally {
      iterator.closeSync();
    }
    const events = selected.map((revision) => {
      const location = path.join(directory, `${revision}.json`);
      const info = fs.lstatSync(location);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 2048)
        throw new Error("Invalid activity record");
      const event = contract.parse(fs.readFileSync(location, "utf8"));
      contract.state({ ...fresh(), revision, activity: [event] });
      if (event.revision !== revision)
        throw new Error("Invalid activity revision");
      return event;
    });
    return {
      events,
      nextBeforeRevision:
        events.length === limit ? events[events.length - 1].revision : null,
    };
  }
  // Isolated immutable records, never a directory inside the user's project.
  function revisionRoot() {
    const directory = `${filePath}.revisions`;
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const info = fs.lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || fs.realpathSync.native(directory) !== directory)
      throw new Error("Invalid revision storage");
    return directory;
  }
  function preserveRevision(state) {
    const destination = path.join(revisionRoot(), `${state.revision}.json`);
    const serialized = JSON.stringify(contract.state(clone(state)));
    const temporary = `${destination}.${randomUUID()}.tmp`;
    let descriptor;
    try {
      descriptor = fs.openSync(temporary, "wx", 0o600);
      fs.writeFileSync(descriptor, serialized);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      try { fs.linkSync(temporary, destination); }
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        const info = fs.lstatSync(destination);
        if (!info.isFile() || info.isSymbolicLink() || info.size > contract.MAX_BYTES ||
            fs.readFileSync(destination, "utf8") !== serialized)
          throw new Error("Conflicting revision record");
      }
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      fs.rmSync(temporary, { force: true });
    }
  }
  function readRevision(revision) {
    if (!Number.isSafeInteger(revision) || revision < 0 || revision > read().revision)
      throw Object.assign(new Error("Revision not found"), { code: "NOT_FOUND" });
    const location = path.join(revisionRoot(), `${revision}.json`);
    try {
      const info = fs.lstatSync(location);
      if (!info.isFile() || info.isSymbolicLink() || info.size > contract.MAX_BYTES)
        throw new Error("Invalid revision record");
      const state = contract.state(contract.parse(fs.readFileSync(location, "utf8")));
      if (state.revision !== revision) throw new Error("Invalid revision identity");
      return state;
    } catch (error) {
      if (error.code === "ENOENT") error.code = "NOT_FOUND";
      throw error;
    }
  }
  function revisions(beforeRevision, limit = 25) {
    const current = read();
    const before = beforeRevision ?? current.revision + 1;
    const selected = [];
    const iterator = fs.opendirSync(revisionRoot());
    try {
      let entry;
      while ((entry = iterator.readSync()) !== null) {
        if (!/^(0|[1-9][0-9]*)\.json$/.test(entry.name)) continue;
        const revision = Number(entry.name.slice(0, -5));
        if (Number.isSafeInteger(revision) && revision < before && revision <= current.revision) {
          selected.push(revision);
          selected.sort((a, b) => b - a);
          if (selected.length > limit + 1) selected.pop();
        }
      }
    } finally { iterator.closeSync(); }
    const records = selected.slice(0, limit).map(revision => {
      const state = readRevision(revision);
      const event = state.activity.at(-1);
      return { revision, action: event?.action ?? "baseline", timestamp: event?.timestamp ?? null, plans: state.plans.length };
    });
    return { records, nextBeforeRevision: selected.length > limit ? records.at(-1).revision : null };
  }
  function transact(expectedRevision, change) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    let lock;
    try {
      lock = fs.openSync(`${filePath}.lock`, "wx", 0o600);
    } catch {
      const error = new Error("Workspace storage is busy.");
      error.code = "STORAGE_BUSY";
      throw error;
    }
    let temporary;
    try {
      const current = read();
      if (current.revision !== expectedRevision) {
        const error = new Error("Workspace revision changed.");
        error.code = "REVISION_CONFLICT";
        throw error;
      }
      const next = change(clone(current));
      if (JSON.stringify(next) === JSON.stringify(current)) return clone(current);
      next.revision = current.revision + 1;
      contract.state(next);
      let historyWarning = false;
      try { preserveRevision(current); } catch { historyWarning = true; }
      for (const event of current.activity) journalEvent(event, true);
      const latest = next.activity.at(-1);
      if (latest && latest.revision === next.revision)
        journalEvent(latest, false);
      temporary = `${filePath}.${randomUUID()}.tmp`;
      const descriptor = fs.openSync(temporary, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, JSON.stringify(next));
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      fs.renameSync(temporary, filePath);
      temporary = undefined;
      try { preserveRevision(next); } catch { historyWarning = true; }
      return { ...clone(next), ...(historyWarning ? { historyWarning: true } : {}) };
    } finally {
      if (temporary) fs.rmSync(temporary, { force: true });
      fs.closeSync(lock);
      fs.rmSync(`${filePath}.lock`, { force: true });
    }
  }
  return { read, transact, activityPage, readRevision, revisions };
}
module.exports = { createWorkspaceStore };
