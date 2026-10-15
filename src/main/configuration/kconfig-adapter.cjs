"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
const ROOT = path.resolve(__dirname, "../../..");
async function resolveConfigurationScripts(root = ROOT) {
  // Replace an exact archive path component, never a similarly named directory.
  const physicalRoot = root.replace(/(^|[\\/])app\.asar(?=[\\/]|$)/, "$1app.asar.unpacked");
  const scripts = path.join(physicalRoot, "scripts", "configuration");
  const helper = path.join(scripts, "inspect.py");
  const stat = await fs.lstat(helper).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) fail("KCONFIG_HELPER_UNAVAILABLE");
  return { scripts, helper };
}
function createKconfigAdapter({
  pythonExecutable,
  admitted = false,
  timeoutMs = 30000,
} = {}) {
  if (admitted !== true || !path.isAbsolute(pythonExecutable || ""))
    fail("PYTHON_NOT_ADMITTED");
  return async function inspect(roots) {
    const python = await fs.realpath(pythonExecutable);
    if (!(await fs.stat(python)).isFile()) fail("PYTHON_NOT_ADMITTED");
    const sourceRoot = await fs.realpath(roots.sourceRoot),
      outputRoot = await fs.realpath(roots.outputRoot);
    const metadata = roots.kconfig || {};
    const entrypoint = metadata.entrypoint || "Config.in";
    if (
      path.isAbsolute(entrypoint) ||
      entrypoint.split(/[\\/]/).some((p) => p === "..") ||
      /[\x00-\x1f]/.test(entrypoint)
    )
      fail("INVALID_KCONFIG_ENTRYPOINT");
    const externalRoots = await Promise.all(
      (metadata.externalRoots || []).map((p) => fs.realpath(p)),
    );
    if (externalRoots.length > 32) fail("KCONFIG_ROOT_LIMIT");
    const environment = {};
    for (const [key, value] of Object.entries(metadata.environment || {})) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
        typeof value !== "string" ||
        value.length > 65536 ||
        value.includes("\0")
      )
        fail("INVALID_KCONFIG_ENVIRONMENT");
      environment[key] = value;
    }
    const prefix = metadata.prefix ?? "";
    if (!["", "CONFIG_"].includes(prefix)) fail("INVALID_KCONFIG_PREFIX");
    const { scripts, helper } = await resolveConfigurationScripts();
    const vendor = path.join(scripts, "vendor");
    const receipt = JSON.parse(
      await fs.readFile(path.join(vendor, "provenance.json"), "utf8"),
    );
    for (const [file, digest] of Object.entries(receipt.files)) {
      if (!["kconfiglib.py", "LICENSE.txt"].includes(file))
        fail("KCONFIG_INTEGRITY_FAILED");
      const bytes = await fs.readFile(path.join(vendor, file));
      if (createHash("sha256").update(bytes).digest("hex") !== digest)
        fail("KCONFIG_INTEGRITY_FAILED");
    }
    return new Promise((resolve, reject) => {
      const child = spawn(
        python,
        ["-I", "-B", helper],
        {
          cwd: sourceRoot,
          env: {},
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let stdout = "",
        stderr = "",
        size = 0,
        done = false;
      const timer = setTimeout(() => {
        child.kill();
        finish(
          Object.assign(new Error("KCONFIG_TIMEOUT"), {
            code: "KCONFIG_TIMEOUT",
          }),
        );
      }, timeoutMs);
      function finish(error, result) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(result);
      }
      child.stdout.on("data", (chunk) => {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) {
          child.kill();
          finish(
            Object.assign(new Error("KCONFIG_OUTPUT_LIMIT"), {
              code: "KCONFIG_OUTPUT_LIMIT",
            }),
          );
        } else stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        if (stderr.length < 8192) stderr += chunk;
      });
      child.on("error", (error) => finish(error));
      child.on("close", (code) => {
        if (code !== 0)
          return finish(
            Object.assign(new Error("KCONFIG_HELPER_FAILED"), {
              code: "KCONFIG_HELPER_FAILED",
            }),
          );
        try {
          finish(null, JSON.parse(stdout));
        } catch {
          finish(
            Object.assign(new Error("KCONFIG_INVALID_RESPONSE"), {
              code: "KCONFIG_INVALID_RESPONSE",
            }),
          );
        }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(
        JSON.stringify({
          sourceRoot,
          outputRoot,
          externalRoots,
          entrypoint,
          environment,
          prefix,
        }),
      );
    });
  };
}
module.exports = { createKconfigAdapter, resolveConfigurationScripts };
