"use strict";
// Builds the container images that an operating system image embeds from the
// repository's own sources, instead of downloading published copies.
//
// A Home Assistant OS style tree fetches its Supervisor and landing page images
// with skopeo during `make`. When the repository also carries the sources of
// those images (supervisor/ and landingpage/ beside operating-system/), this
// module builds them, pushes them to a private registry container that lives
// only for the build, and gives the builder a registries.conf that redirects the
// repository's own registry prefix to it. Image names inside the finished OS
// image stay exactly as the tree's version file states; only their bytes come
// from source. Images whose sources are not in the repository (the upstream
// plug-ins) are still fetched by the tree's recipe and reported as such.
const fs = require("node:fs"), path = require("node:path");

const fail = (code, detail) => { throw Object.assign(new Error(detail ? `${code}: ${detail}` : code), { code }); };
// registry:3.0.0, linux/amd64 and linux/arm64 index digest.
const REGISTRY_IMAGE = "registry@sha256:6c5666b861f3505b116bb9aa9b25175e71210414bd010d92035ff64018f9457e";
const PREFIX = /^ghcr\.io\/[a-z0-9][a-z0-9-]{0,38}$/;
const TAG = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const ARCH = { amd64: "linux/amd64", aarch64: "linux/arm64" };

/** Recognises a repository whose Supervisor and landing page sources sit beside its OS tree. */
function discoverSourceImages(repositoryRoot) {
  if (typeof repositoryRoot !== "string" || !path.isAbsolute(repositoryRoot)) fail("source-images-root-must-be-absolute");
  const has = name => fs.existsSync(path.join(repositoryRoot, name));
  if (!has("versions.json") || !has("supervisor/Dockerfile") || !has("landingpage/Dockerfile")) return null;
  const versions = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "versions.json"), "utf8"));
  const owner = versions.registry_owner;
  if (!/^[a-z0-9][a-z0-9-]{0,38}$/.test(owner || "")) fail("source-images-registry-owner-invalid");
  return { repositoryRoot, prefix: `ghcr.io/${owner}` };
}

/** Reads the defconfig's Supervisor architecture and machine name. */
function boardOf(osDir, defconfig) {
  const text = fs.readFileSync(path.join(osDir, "buildroot-external", "configs", `${defconfig}_defconfig`), "utf8");
  const arch = /^BR2_PACKAGE_HASSIO_ARCH="([a-z0-9]+)"/m.exec(text)?.[1];
  const machine = /^BR2_PACKAGE_HASSIO_MACHINE="([a-z0-9-]+)"/m.exec(text)?.[1];
  if (!ARCH[arch] || !machine) fail("source-images-board-unknown", defconfig);
  return { arch, machine, platform: ARCH[arch] };
}

/**
 * Which images the version file asks for and which of them this repository can
 * build. Returns `{ fromSource: [{ id, context, image, tag, buildArgs }], fetched: [names] }`.
 */
function selectImages({ discovered, versionJson, arch, machine }) {
  const version = typeof versionJson === "string" ? JSON.parse(versionJson) : versionJson;
  const images = version?.images || {};
  const resolve = key => (images[key] || "").replace("{arch}", arch).replace("{machine}", machine);
  const fromSource = [];
  const supervisor = resolve("supervisor"), core = resolve("core");
  if (supervisor.startsWith(discovered.prefix + "/") && TAG.test(version.supervisor || ""))
    fromSource.push({ id: "supervisor", context: "supervisor", image: supervisor, tag: version.supervisor, buildArgs: [`BUILD_VERSION=${version.supervisor}`] });
  // The tree's recipe always embeds the landing page in place of core.
  if (core.startsWith(discovered.prefix + "/"))
    fromSource.push({ id: "landingpage", context: "landingpage", image: core, tag: "landingpage", buildArgs: [] });
  const builtKeys = new Set(fromSource.map(i => i.id === "landingpage" ? "core" : i.id));
  const fetched = Object.keys(images).filter(key => !builtKeys.has(key)).map(resolve).filter(Boolean);
  for (const item of fromSource) if (!PREFIX.test(item.image.slice(0, item.image.lastIndexOf("/")))) fail("source-images-name-invalid", item.image);
  return { fromSource, fetched };
}

function names(workspaceId) {
  if (!/^[a-f0-9]{12}$/.test(workspaceId || "")) fail("source-images-workspace-invalid");
  return { network: `material-buildroot-haos-${workspaceId}-net`, registry: `material-buildroot-haos-${workspaceId}-registry` };
}

/** registries.conf for the builder user: the repository's prefix resolves to the build's private registry. */
function registriesConf({ prefix, workspaceId }) {
  const { registry } = names(workspaceId);
  if (!PREFIX.test(prefix)) fail("source-images-prefix-invalid");
  const owner = prefix.slice("ghcr.io/".length);
  return `# Written by Material Buildroot for one build. Images under ${prefix} come from\n# the private registry that holds this build's images made from source.\n[[registry]]\nprefix = "${prefix}"\nlocation = "${registry}:5000/${owner}"\ninsecure = true\n`;
}

/**
 * Docker steps before the OS build. `{ stdinFrom: "context:<dir>" }` means the
 * committed `<dir>` of the repository is piped in as the build context.
 * Steps with `capture: true` return their output instead of logging it.
 */
function planSourceImages({ selection, workspaceId, platform, commit, labels }) {
  const n = names(workspaceId);
  if (!/^[a-f0-9]{40}$/.test(commit || "")) fail("source-images-commit-invalid");
  const steps = [
    { id: "registry-network", args: ["network", "create", ...labels, n.network] },
    // No port is published: the registry is reached only from containers on its own network.
    { id: "registry", args: ["run", "--detach", "--name", n.registry, ...labels, "--network", n.network, REGISTRY_IMAGE] },
  ];
  for (const item of selection.fromSource) {
    // A build-only name, so a published tag of the same image on this computer is never shadowed.
    // Attestations are left out so the stored reference is one plain manifest whose digest the
    // tree's recipe reports back.
    steps.push({ id: `build-${item.id}`, stdinFrom: `context:${item.context}`, args: ["build", "--platform", platform, "--provenance=false", "--sbom=false",
      ...item.buildArgs.flatMap(arg => ["--build-arg", arg]),
      "--label", `org.opencontainers.image.revision=${commit}`, "--label", "io.material-buildroot.built-from-source=true",
      ...labels, "--tag", buildTag(workspaceId, item), "-"] });
  }
  return { names: n, steps };
}

const buildTag = (workspaceId, item) => `material-buildroot-haos-${workspaceId}-${item.id}:${item.tag}`;

/**
 * Copies one built image into the private registry under the name the tree expects.
 * `docker save` of the build-only tag is piped (`stdinFrom: "save:<tag>"`) into skopeo in
 * the tree's own builder image on the registry network. Returns the stored manifest digest.
 */
function planLoad({ item, prefix, workspaceId, builderImage }) {
  const n = names(workspaceId);
  if (!item.image.startsWith(prefix + "/")) fail("source-images-name-invalid", item.image);
  if (!TAG.test(item.tag)) fail("source-images-tag-invalid", item.tag);
  const destination = `${n.registry}:5000/${prefix.slice("ghcr.io/".length)}${item.image.slice(prefix.length)}:${item.tag}`;
  return { destination, step: { id: `load-${item.id}`, stdinFrom: `save:${buildTag(workspaceId, item)}`, capture: true,
    args: ["run", "-i", "--rm", "--network", n.network, "--entrypoint", "bash", builderImage, "-c",
      `set -euo pipefail; cat > /tmp/image.tar; skopeo copy --quiet --dest-tls-verify=false --digestfile /tmp/digest docker-archive:/tmp/image.tar docker://${destination} >&2; cat /tmp/digest`] } };
}

/** Removes the registry, its network and the build's local tags. Built image layers stay cached. */
function planSourceCleanup({ workspaceId, selection }) {
  const n = names(workspaceId);
  return [
    { id: "remove-registry", args: ["rm", "--force", "--volumes", n.registry] },
    { id: "remove-registry-network", args: ["network", "rm", n.network] },
    ...(selection?.fromSource || []).map((item, i) => ({ id: `untag-${i}`, args: ["image", "rm", buildTag(workspaceId, item)] })),
  ];
}

/**
 * Reads the fetch lines the tree's recipe prints and pairs them with the digests
 * stored from source, so the receipt says which bytes the OS image holds.
 */
function verifyEmbedded({ log, built }) {
  const seen = new Map();
  for (const m of String(log).matchAll(/(?:Fetching image|Skipping download of existing image): (\S+) \(digest (sha256:[a-f0-9]{64})\)/g)) seen.set(m[1], m[2]);
  return built.map(item => {
    const reference = `${item.image}:${item.tag}`;
    const embedded = seen.get(reference) || null;
    return { ...item, reference, embeddedDigest: embedded, matches: embedded !== null && embedded === item.digest };
  });
}

module.exports = { discoverSourceImages, boardOf, selectImages, registriesConf, planSourceImages, planSourceCleanup, verifyEmbedded, planLoad, buildTag, names, REGISTRY_IMAGE };
