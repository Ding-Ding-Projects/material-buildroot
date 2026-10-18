"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const SPECS = Object.freeze({
  linux: { variable: "LINUX_DIR", entrypoint: "Kconfig", target: "linux-olddefconfig" },
  busybox: { variable: "BUSYBOX_DIR", entrypoint: "Config.in", target: "busybox-oldconfig" },
  uboot: { variable: "UBOOT_DIR", entrypoint: "Kconfig", target: "uboot-olddefconfig" },
});
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
function regular(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4 * 1024 * 1024)
    fail("UNSAFE_COMPONENT_FILE");
  return fs.readFileSync(file, "utf8");
}
/** Paths are derived from real Buildroot printvars, never renderer input or directory guesses. */
function resolveDomains(project, report) {
  if (typeof report !== "string" || report.length > 65536) fail("INVALID_DOMAIN_DISCOVERY");
  const roots = [...report.matchAll(/^MATERIAL_CONFIG_OUTPUT=(\/[^\r\n]+)$/gm)];
  if (roots.length !== 1) fail("INVALID_DOMAIN_DISCOVERY");
  const runtimeOutput = roots[0][1].replace(/\/$/, "");
  const buildrootConfig = regular(path.join(project.output, ".config"));
  const architecture = buildrootConfig.match(/^BR2_ARCH="([A-Za-z0-9_+-]+)"$/m)?.[1];
  const domains = {};
  for (const [domain, spec] of Object.entries(SPECS)) {
    const enabled = { linux: "BR2_LINUX_KERNEL", busybox: "BR2_PACKAGE_BUSYBOX", uboot: "BR2_TARGET_UBOOT" }[domain];
    if (!new RegExp(`^${enabled}=y$`, "m").test(buildrootConfig)) continue;
    if (domain === "uboot" && !/^BR2_TARGET_UBOOT_BUILD_SYSTEM_KCONFIG=y$/m.test(buildrootConfig)) continue;
    const matches = [...report.matchAll(new RegExp(`^${spec.variable}=(.*)$`, "gm"))];
    if (!matches.length || (matches.length === 1 && !matches[0][1].trim())) continue;
    if (matches.length !== 1) fail("INVALID_DOMAIN_DISCOVERY");
    const directory = matches[0][1].trim();
    const prefix = `${runtimeOutput}/build/`;
    if (!directory.startsWith(prefix)) fail("COMPONENT_OUTSIDE_BUILD_OUTPUT");
    const name = directory.slice(prefix.length);
    if (!/^[A-Za-z0-9_+.-]+$/.test(name) || name === "." || name === "..") fail("INVALID_COMPONENT_DIRECTORY");
    const build = path.join(project.output, "build"), root = path.join(build, name);
    if (!fs.existsSync(root)) continue;
    if (fs.realpathSync(build) !== build || fs.realpathSync(root) !== root) fail("UNSAFE_COMPONENT_ROOT");
    const stat = fs.lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("UNSAFE_COMPONENT_ROOT");
    if (!fs.existsSync(path.join(root, ".config"))) continue;
    const entry = regular(path.join(root, spec.entrypoint));
    const makefile = regular(path.join(root, "Makefile"));
    regular(path.join(root, ".config"));
    const sourceArch = architecture === "x86_64" || /^i[3-6]86$/.test(architecture || "") ? "x86" : architecture === "aarch64" ? "arm64" : architecture;
    domains[domain] = {
      granted: true, sourceRoot: root, outputRoot: root, componentInTree: true,
      reconcileTarget: spec.target, writable: true,
      binding: createHash("sha256").update(JSON.stringify({ domain, root, dev: stat.dev, ino: stat.ino, birth: stat.birthtimeMs, entry, makefile, buildrootConfig })).digest("hex"),
      kconfig: { entrypoint: spec.entrypoint, prefix: "CONFIG_", environment: architecture ? { ARCH: architecture, SRCARCH: sourceArch } : {} },
    };
  }
  return domains;
}
module.exports = { resolveDomains, SPECS };
