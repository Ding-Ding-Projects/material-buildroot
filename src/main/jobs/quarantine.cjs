"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");
const { parse } = require("../security/workspace-contract.cjs");
const { randomUUID } = require("node:crypto");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BYTES = 1024 * 1024;
function fail() {
  throw Object.assign(new Error("Runtime recovery records are unavailable."), {
    code: "QUARANTINE_UNAVAILABLE",
  });
}
function exact(value, keys) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length
  )
    fail();
  for (const key of Reflect.ownKeys(value))
    if (
      !keys.includes(key) ||
      !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")
    )
      fail();
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const same = (a, b) =>
  a.nlink === b.nlink &&
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.size === b.size &&
  a.mtimeMs === b.mtimeMs &&
  a.ctimeMs === b.ctimeMs;
/** Recovery records grant no execution or filesystem authority. A pending record survives a crash. */
function createBuildQuarantine({ directory, validateReceipt = () => fail() }) {
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory
  )
    fail();
  function directories() {
    let cursor = path.parse(directory).root;
    for (const part of directory
      .slice(cursor.length)
      .split(path.sep)
      .filter(Boolean)) {
      cursor = path.join(cursor, part);
      try {
        fs.mkdirSync(cursor, { mode: 0o700 });
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
      const stat = fs.lstatSync(cursor);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        fs.realpathSync.native(cursor) !== cursor
      )
        fail();
    }
  }
  directories();
  const root = fs.statSync(directory),
    file = path.join(directory, "runtime-recovery.json");
  function guard() {
    directories();
    const current = fs.statSync(directory);
    if (root.dev !== current.dev || root.ino !== current.ino) fail();
  }
  function validate(value) {
    exact(value, ["version", "records"]);
    if (
      value.version !== 1 ||
      !Array.isArray(value.records) ||
      value.records.length > 1024 ||
      Object.getPrototypeOf(value.records) !== Array.prototype ||
      Reflect.ownKeys(value.records).length !== value.records.length + 1
    )
      fail();
    const ids = new Set();
    for (const record of value.records) {
      exact(record, ["jobId", "workspaceId", "receipt", "createdAt"]);
      if (
        !UUID.test(record.jobId) ||
        !UUID.test(record.workspaceId) ||
        ids.has(record.jobId) ||
        typeof record.createdAt !== "string" ||
        new Date(record.createdAt).toISOString() !== record.createdAt
      )
        fail();
      ids.add(record.jobId);
      if (record.receipt !== null) validateReceipt(record.receipt);
    }
    if (Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) fail();
    return value;
  }
  function read() {
    guard();
    let stat;
    try {
      stat = fs.lstatSync(file);
    } catch (e) {
      if (e.code === "ENOENT")
        return { value: { version: 1, records: [] }, stat: null };
      throw e;
    }
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.nlink !== 1 ||
      stat.size > MAX_BYTES
    )
      fail();
    const fd = fs.openSync(
      file,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
    );
    try {
      const opened = fs.fstatSync(fd);
      if (!same(stat, opened) || opened.nlink !== 1) fail();
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let length = 0,
        count;
      while (
        length < buffer.length &&
        (count = fs.readSync(
          fd,
          buffer,
          length,
          buffer.length - length,
          null,
        )) > 0
      )
        length += count;
      if (length > MAX_BYTES) fail();
      const bytes = buffer.subarray(0, length);
      if (
        !same(opened, fs.fstatSync(fd)) ||
        !same(opened, fs.lstatSync(file)) ||
        new TextDecoder("utf-8", { fatal: true }).decode(bytes) !==
          bytes.toString("utf8")
      )
        fail();
      let parsed;
      try {
        parsed = parse(bytes.toString("utf8"));
      } catch {
        fail();
      }
      return {
        value: validate(parsed),
        stat: opened,
      };
    } finally {
      fs.closeSync(fd);
    }
  }
  // All updates are synchronous within the owning host process; never merge unknown disk edits.
  let state = read();
  function update(change) {
    const current = read();
    if (JSON.stringify(current.value) !== JSON.stringify(state.value)) fail();
    const next = clone(state.value);
    change(next.records);
    validate(next);
    const temp = file + "." + randomUUID() + ".tmp";
    let fd;
    try {
      fd = fs.openSync(temp, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(next));
      fs.fsyncSync(fd);
      const prepared = fs.fstatSync(fd);
      if (!prepared.isFile() || prepared.nlink !== 1) fail();
      fs.closeSync(fd);
      fd = undefined;
      guard();
      const before = read();
      if (
        JSON.stringify(before.value) !== JSON.stringify(current.value) ||
        Boolean(before.stat) !== Boolean(current.stat) ||
        (before.stat && !same(before.stat, current.stat))
      )
        fail();
      const temporary = fs.lstatSync(temp);
      if (
        !temporary.isFile() ||
        temporary.isSymbolicLink() ||
        temporary.nlink !== 1 ||
        !same(temporary, prepared)
      )
        fail();
      fs.renameSync(temp, file);
      if (process.platform !== "win32") {
        const parent = fs.openSync(directory, "r");
        try {
          fs.fsyncSync(parent);
        } finally {
          fs.closeSync(parent);
        }
      }
      state = read();
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      try {
        fs.unlinkSync(temp);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  return {
    initialized: state.stat !== null,
    initialize() {
      update(() => {});
    },
    list() {
      const current = read();
      if (
        JSON.stringify(current.value) !== JSON.stringify(state.value) ||
        Boolean(current.stat) !== Boolean(state.stat) ||
        (current.stat && !same(current.stat, state.stat))
      )
        fail();
      return clone(state.value.records);
    },
    begin({ jobId, workspaceId }) {
      update((records) => {
        if (records.some((x) => x.jobId === jobId)) fail();
        records.push({
          jobId,
          workspaceId,
          receipt: null,
          createdAt: new Date().toISOString(),
        });
      });
    },
    checkpoint(jobId, receipt) {
      validateReceipt(receipt);
      update((records) => {
        const record = records.find((x) => x.jobId === jobId);
        if (!record) fail();
        record.receipt = clone(receipt);
      });
    },
    clear(jobId) {
      update((records) => {
        const index = records.findIndex((x) => x.jobId === jobId);
        if (index < 0) fail();
        records.splice(index, 1);
      });
    },
  };
}
module.exports = { createBuildQuarantine };
