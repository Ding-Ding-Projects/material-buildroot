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
  const physicalRoot = root.replace(
    /(^|[\\/])app\.asar(?=[\\/]|$)/,
    "$1app.asar.unpacked",
  );
  const scripts = path.join(physicalRoot, "scripts", "configuration");
  const helper = path.join(scripts, "inspect.py");
  const stat = await fs.lstat(helper).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink())
    fail("KCONFIG_HELPER_UNAVAILABLE");
  return { scripts, helper };
}
function kconfigPath(nativePath, windows = process.platform === "win32") {
  if (typeof nativePath !== "string" || /[\x00-\x1f"$]/.test(nativePath))
    fail("INVALID_KCONFIG_PATH");
  if (!windows && nativePath.includes("\\")) fail("INVALID_KCONFIG_PATH");
  return windows ? nativePath.replace(/\\/g, "/") : nativePath;
}
function createKconfigAdapter({
  pythonExecutable,
  admitted = false,
  timeoutMs = 30000,
  executeInspection,
  resolveAdmission,
} = {}) {
  const runtimeMode = typeof executeInspection === "function";
  if (runtimeMode && typeof resolveAdmission !== "function")
    fail("KCONFIG_SOURCE_TRUST_REQUIRED");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000)
    fail("INVALID_KCONFIG_TIMEOUT");
  if (!runtimeMode && (admitted !== true || !path.isAbsolute(pythonExecutable || "")))
    fail("PYTHON_NOT_ADMITTED");
  return async function inspect(roots) {
    const python = runtimeMode ? null : await fs.realpath(pythonExecutable);
    if (!runtimeMode && !(await fs.stat(python)).isFile()) fail("PYTHON_NOT_ADMITTED");
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
    if (new Set(externalRoots).size !== externalRoots.length)
      fail("DUPLICATE_EXTERNAL_ROOT");
    const externalTrees = [];
    const names = new Set();
    for (const root of externalRoots) {
      if (!(await fs.stat(root)).isDirectory()) fail("INVALID_EXTERNAL_ROOT");
      const kconfigRoot = kconfigPath(root);
      const file = path.join(root, "external.desc");
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536)
        fail("INVALID_EXTERNAL_DESCRIPTOR");
      const descriptor = await fs.readFile(file, "utf8");
      const matches = [
        ...descriptor.matchAll(/^name:[ \t]*([A-Za-z0-9_]+)[ \t]*$/gm),
      ];
      if (matches.length !== 1 || names.has(matches[0][1]))
        fail("INVALID_EXTERNAL_DESCRIPTOR");
      const name = matches[0][1];
      names.add(name);
      const description =
        descriptor.match(/^desc:[ \t]*([^\r\n]*)$/m)?.[1] || name;
      if (description.length > 256 || /[\x00-\x1f"\\$]/.test(description))
        fail("INVALID_EXTERNAL_DESCRIPTOR");
      const config = await fs.lstat(path.join(root, "Config.in"));
      if (!config.isFile() || config.isSymbolicLink())
        fail("INVALID_EXTERNAL_CONFIG");
      externalTrees.push({ root, kconfigRoot, name, description });
    }
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
    const buildroot = metadata.buildroot === true;
    if (
      metadata.buildroot !== undefined &&
      typeof metadata.buildroot !== "boolean"
    )
      fail("INVALID_KCONFIG_METADATA");
    if (buildroot)
      Object.assign(environment, {
        BASE_DIR: kconfigPath(outputRoot),
        BR2_BASE_DIR: kconfigPath(outputRoot),
        TOPDIR: kconfigPath(sourceRoot),
        CONFIG_DIR: kconfigPath(outputRoot),
        BR2_CONFIG: kconfigPath(path.join(outputRoot, ".config")),
        BR2_DEFCONFIG: kconfigPath(path.join(outputRoot, "defconfig")),
        SKIP_LEGACY: "",
      });
    for (const tree of externalTrees) {
      environment[`BR2_EXTERNAL_${tree.name}_PATH`] = tree.kconfigRoot;
      environment[`BR2_EXTERNAL_${tree.name}_DESC`] = tree.description;
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
    const request = {
      sourceRoot,
      sourceReference: kconfigPath(sourceRoot),
      outputRoot,
      outputReference: kconfigPath(outputRoot),
      externalRoots,
      externalTrees,
      buildroot,
      entrypoint,
      environment,
      prefix,
    };
    if (runtimeMode) {
      const admission = await resolveAdmission(roots);
      const binding = runtimeBinding(admission);
      const helperBytes = await fs.readFile(helper);
      const moduleBytes = await fs.readFile(path.join(vendor, "kconfiglib.py"));
      const controller = new AbortController();
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error("KCONFIG_TIMEOUT"), { code: "KCONFIG_TIMEOUT" }));
        }, timeoutMs);
      });
      try {
        // A fixed host operation, never a command or executable from the renderer.
        // The transport maps admitted paths to Linux paths and owns the child.
        const result = await Promise.race([timeout, executeInspection(Object.freeze({
          operation: "inspect-kconfig-v1",
          admissionId: binding.admissionId,
          runtime: admission.runtime,
          request: { ...request, evaluationMode: "trusted-linux-runtime-v1", binding },
          bundle: {
            helper: helperBytes.toString("base64"),
            helperSha256: createHash("sha256").update(helperBytes).digest("hex"),
            module: moduleBytes.toString("base64"),
            moduleSha256: receipt.files["kconfiglib.py"],
            version: "14.1.0",
          },
          signal: controller.signal,
        }))]);
        if (controller.signal.aborted) fail("KCONFIG_TIMEOUT");
        const current = runtimeBinding(await resolveAdmission(roots));
        if (JSON.stringify(current) !== JSON.stringify(binding))
          fail("KCONFIG_ADMISSION_CHANGED");
        if (!result || result.available !== true || result.adapter !== "kconfiglib" ||
            result.version !== "14.1.0" || result.evaluationMode !== "trusted-linux-runtime-v1" ||
            !result.binding || ["admissionId", "sourceRevision", "configRevision"].some(key => result.binding[key] !== binding[key]) ||
            !result.tree || typeof result.tree !== "object" ||
            Buffer.byteLength(JSON.stringify(result)) > 16 * 1024 * 1024)
          fail("KCONFIG_INVALID_RESPONSE");
        return result;
      } finally {
        clearTimeout(timer);
      }
    }
    return new Promise((resolve, reject) => {
      const child = spawn(python, ["-I", "-B", helper], {
        cwd: sourceRoot,
        env: {},
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
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
        JSON.stringify(request),
      );
    });
  };
}
function runtimeBinding(admission) {
  if (!admission || admission.sourceTrusted !== true ||
      !["wsl2", "docker"].includes(admission.runtime) ||
      !["admissionId", "sourceRevision", "configRevision"].every(key =>
        typeof admission[key] === "string" && /^[A-Za-z0-9._:-]{1,256}$/.test(admission[key])))
    fail("KCONFIG_SOURCE_TRUST_REQUIRED");
  return {
    admissionId: admission.admissionId,
    sourceRevision: admission.sourceRevision,
    configRevision: admission.configRevision,
  };
}
module.exports = {
  createKconfigAdapter,
  resolveConfigurationScripts,
  kconfigPath,
};
