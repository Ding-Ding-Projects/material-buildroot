"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
function relative(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 4096 ||
    value.includes("\\") ||
    value.split("/").some((p) => !p || p === "." || p === "..") ||
    path.isAbsolute(value) ||
    /[\x00-\x1f]/.test(value)
  )
    fail("INVALID_PATH");
  return value;
}
function validatePackage(model) {
  if (
    !model ||
    typeof model !== "object" ||
    !/^[a-z0-9][a-z0-9+-]*$/.test(model.name || "")
  )
    fail("INVALID_PACKAGE");
  if (
    ![
      "generic",
      "autotools",
      "cmake",
      "meson",
      "cargo",
      "go",
      "python",
    ].includes(model.buildSystem)
  )
    fail("INVALID_BUILD_SYSTEM");
  if (
    typeof model.source !== "string" ||
    model.source.length > 4096 ||
    /[\x00-\x1f]/.test(model.source)
  )
    fail("INVALID_SOURCE");
  if (
    typeof model.license !== "string" ||
    !model.license ||
    /[\x00-\x1f]/.test(model.license)
  )
    fail("INVALID_LICENSE");
  for (const item of model.hashes || []) {
    if (
      !["sha256", "sha512"].includes(item.algorithm) ||
      !new RegExp(
        `^[a-fA-F0-9]{${item.algorithm === "sha256" ? 64 : 128}}$`,
      ).test(item.digest)
    )
      fail("INVALID_HASH");
    relative(item.file);
  }
  for (const patch of model.patches || []) relative(patch);
  for (const item of model.overlays || []) {
    relative(item.source);
    relative(item.destination);
    if (!Number.isInteger(item.mode) || item.mode < 0 || item.mode > 0o777)
      fail("INVALID_MODE");
  }
  return model;
}
async function savePackageModel({
  root,
  granted,
  relativePath,
  model,
  revision,
}) {
  if (granted !== true) fail("ROOT_NOT_GRANTED");
  validatePackage(model);
  relative(relativePath);
  if (!relativePath.endsWith(".json")) fail("INVALID_MODEL_PATH");
  const canonical = await fs.realpath(root);
  const destination = path.join(canonical, relativePath);
  const parent = await fs.realpath(path.dirname(destination));
  if (parent !== canonical && !parent.startsWith(canonical + path.sep))
    fail("PATH_ESCAPE");
  const stat = await fs.lstat(destination).catch((e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (stat && (!stat.isFile() || stat.isSymbolicLink()))
    fail("UNSAFE_MODEL_PATH");
  const previous = await fs.readFile(destination).catch((e) => {
    if (e.code === "ENOENT") return Buffer.alloc(0);
    throw e;
  });
  const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
  if (revision !== digest(previous)) fail("REVISION_CONFLICT");
  const text = JSON.stringify(model, null, 2) + "\n";
  const temporary = destination + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(temporary, text, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return { revision: digest(text) };
}
module.exports = { validatePackage, savePackageModel };
