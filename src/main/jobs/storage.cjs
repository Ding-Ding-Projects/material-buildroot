"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
function assertSafe(target) {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const part of absolute
    .slice(current.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink())
        throw Error("Symbolic link storage is not allowed");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return absolute;
}
function directory(target) {
  const absolute = assertSafe(target);
  fs.mkdirSync(absolute, { recursive: true, mode: 0o700 });
  assertSafe(absolute);
  return absolute;
}
function read(file) {
  assertSafe(file);
  const fd = fs.openSync(
    file,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
  );
  try {
    if (!fs.fstatSync(fd).isFile()) throw Error("Invalid storage file");
    return JSON.parse(fs.readFileSync(fd, "utf8"));
  } finally {
    fs.closeSync(fd);
  }
}
function atomic(file, value) {
  assertSafe(file);
  const tmp = file + "." + crypto.randomUUID() + ".tmp";
  let fd;
  try {
    fd = fs.openSync(tmp, "wx", 0o600);
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    assertSafe(file);
    fs.renameSync(tmp, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try {
      fs.unlinkSync(tmp);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
}
module.exports = { assertSafe, directory, read, atomic };
