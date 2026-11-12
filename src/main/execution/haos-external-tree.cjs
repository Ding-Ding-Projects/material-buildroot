"use strict";
// Builds a Home Assistant OS style Buildroot external tree (an `operating-system/`
// folder with its own buildroot, buildroot-external, Makefile and builder
// Dockerfile) with that tree's own recipe. The source is exported with
// `git archive` into a Docker volume so symbolic links and case-sensitive names
// survive, the build runs on a Linux filesystem, and the source checkout is
// never written to.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");

const fail = (code, detail) => { throw Object.assign(new Error(detail ? `${code}: ${detail}` : code), { code }); };
const DEFCONFIG = /^[a-z0-9][a-z0-9_]{0,63}$/;
const WORKSPACE = /^[a-f0-9]{12}$/;
const LABEL = "io.material-buildroot.haos-workspace";
const BUILDER_UID = 1000, BUILDER_GID = 1000;

/** Finds the external tree in a repository root or in the tree folder itself. */
function discoverHaosTree(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) fail("haos-root-must-be-absolute");
  const candidates = [path.join(root, "operating-system"), root];
  for (const osDir of candidates) {
    const has = name => fs.existsSync(path.join(osDir, name));
    if (!has("Makefile") || !has("Dockerfile") || !has("buildroot/Makefile") || !has("buildroot-external/external.desc")) continue;
    const configs = path.join(osDir, "buildroot-external", "configs");
    const defconfigs = fs.existsSync(configs)
      ? fs.readdirSync(configs).filter(name => name.endsWith("_defconfig")).map(name => name.slice(0, -"_defconfig".length)).filter(name => DEFCONFIG.test(name)).sort()
      : [];
    if (!defconfigs.length) continue;
    const desc = fs.readFileSync(path.join(osDir, "buildroot-external", "external.desc"), "utf8");
    const name = /^name:\s*(\S+)/m.exec(desc)?.[1] || null;
    const meta = path.join(osDir, "buildroot-external", "meta");
    const version = fs.existsSync(meta) ? versionFromMeta(fs.readFileSync(meta, "utf8")) : null;
    return { osDir, repositoryRoot: root, externalName: name, version, defconfigs };
  }
  return null;
}

function versionFromMeta(text) {
  const major = /^VERSION_MAJOR="?(\d+)/m.exec(text)?.[1], minor = /^VERSION_MINOR="?(\d+)/m.exec(text)?.[1];
  return major && minor ? `${major}.${minor}` : null;
}

function workspaceNames(workspaceId) {
  if (!WORKSPACE.test(workspaceId || "")) fail("haos-workspace-id-invalid");
  return {
    builderImage: `material-buildroot-haos-builder:${workspaceId}`,
    buildVolume: `material-buildroot-haos-${workspaceId}-build`,
    cacheVolume: "material-buildroot-haos-cache",
  };
}

/**
 * Returns the ordered docker invocations for one image build. Each step is
 * `{ id, args, stdinFrom? }`; `stdinFrom: "archive"` means the git archive
 * of the tree (rooted at the tree folder, committed bytes with no line-ending
 * conversion) is piped into that step.
 */
function planHaosBuild({ tree, defconfig, workspaceId, versionJson = null, registries = null, network = null }) {
  if (!tree?.defconfigs?.includes(defconfig)) fail("haos-defconfig-unknown", String(defconfig));
  const names = workspaceNames(workspaceId);
  const labels = ["--label", `${LABEL}=${workspaceId}`];
  const helper = ["--rm", "--entrypoint", "bash", "-v", `${names.buildVolume}:/build`];
  const steps = [
    // The builder context is the same committed tree, so the builder matches the source.
    { id: "builder-image", stdinFrom: "archive", args: ["build", "--tag", names.builderImage, ...labels, "-"] },
    { id: "build-volume", args: ["volume", "create", ...labels, names.buildVolume] },
    { id: "cache-volume", args: ["volume", "create", "--label", `${LABEL}=shared-cache`, names.cacheVolume] },
    { id: "source-export", stdinFrom: "archive", args: ["run", "-i", ...helper, names.builderImage, "-c",
      `set -euo pipefail; tar -x -C /build; chown -R ${BUILDER_UID}:${BUILDER_GID} /build`] },
  ];
  if (versionJson !== null) {
    if (typeof versionJson !== "string" || versionJson.length > 1024 * 1024) fail("haos-version-json-invalid");
    JSON.parse(versionJson);
    // Written as root by the helper, so it is handed to the builder user that reads it during make.
    steps.push({ id: "version-pin", stdinFrom: "versionJson", args: ["run", "-i", ...helper, names.builderImage, "-c",
      `set -euo pipefail; cp /dev/stdin /build/version-pinned.json; chown ${BUILDER_UID}:${BUILDER_GID} /build/version-pinned.json`] });
  }
  // Images built from source reach the tree's skopeo through a registries.conf for the
  // builder user (the builder's entry script runs make through sudo -H, which sets HOME).
  if (registries !== null) {
    if (typeof registries !== "string" || registries.length > 16 * 1024 || !/^[a-z0-9][a-z0-9_.-]{0,127}$/.test(network || "")) fail("haos-registries-invalid");
    steps.push({ id: "registries", stdinFrom: "registries", args: ["run", "-i", ...helper, names.builderImage, "-c",
      `set -euo pipefail; mkdir -p /build/.material-buildroot; cp /dev/stdin /build/.material-buildroot/registries.conf; chown -R ${BUILDER_UID}:${BUILDER_GID} /build/.material-buildroot`] });
  }
  let make = versionJson !== null ? `make HAOS_VERSION_JSON=/build/version-pinned.json ${defconfig}` : `make ${defconfig}`;
  if (registries !== null) make = `mkdir -p ~/.config/containers && cp /build/.material-buildroot/registries.conf ~/.config/containers/registries.conf && ${make}`;
  steps.push({ id: "image-build", args: ["run", "--rm", "--privileged", ...labels, ...(network ? ["--network", network] : []),
    "-e", `BUILDER_UID=${BUILDER_UID}`, "-e", `BUILDER_GID=${BUILDER_GID}`,
    "-v", `${names.buildVolume}:/build`, "-v", `${names.cacheVolume}:/cache`,
    names.builderImage, "bash", "-c", make] });
  return { names, steps };
}

/** The step that copies finished images out of the build volume. */
function planHaosCollect({ workspaceId, destination }) {
  const names = workspaceNames(workspaceId);
  if (typeof destination !== "string" || !path.isAbsolute(destination) || /[,\0\r\n]/.test(destination)) fail("haos-destination-invalid");
  return { id: "collect", args: ["run", "--rm", "--entrypoint", "bash", "-v", `${names.buildVolume}:/build:ro`, "-v", `${destination}:/out`, names.builderImage, "-c",
    "set -euo pipefail; shopt -s nullglob; files=(/build/output/images/haos_*); (( ${#files[@]} )) || { echo 'No haos_* images were produced' >&2; exit 2; }; cp -v \"${files[@]}\" /out/"] };
}

/** Steps that remove the per-build volume and builder tag. The shared cache stays. */
function planHaosCleanup({ workspaceId }) {
  const names = workspaceNames(workspaceId);
  return [
    { id: "remove-build-volume", args: ["volume", "rm", "--force", names.buildVolume] },
    { id: "remove-builder-tag", args: ["image", "rm", names.builderImage] },
  ];
}

const newWorkspaceId = () => crypto.randomBytes(6).toString("hex");

module.exports = { discoverHaosTree, planHaosBuild, planHaosCollect, planHaosCleanup, newWorkspaceId, versionFromMeta, LABEL };
