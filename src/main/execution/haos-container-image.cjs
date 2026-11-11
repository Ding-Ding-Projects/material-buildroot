"use strict";
// Plans a local build of the Home Assistant Material container image from a
// staged copy of its repository, following the repository's own build.sh
// recipe: frontend wheel, integration translations, then the core image.
// Nothing is pushed; the result is a local image tag.
const fs = require("node:fs"), path = require("node:path");

const fail = (code, detail) => { throw Object.assign(new Error(detail ? `${code}: ${detail}` : code), { code }); };
const VERSION = /^[0-9][0-9A-Za-z._-]{0,63}$/;
const TAG = /^[a-z0-9][a-z0-9._/-]{0,127}:[A-Za-z0-9._-]{1,128}$/;
const STAGED_PATHS = ["core", "frontend", "build", "versions.json"];

/** Recognises a repository that carries this container recipe. */
function discoverContainerRecipe(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) fail("container-root-must-be-absolute");
  const required = ["versions.json", "core/Dockerfile", "build/frontend.Dockerfile", "build/translations.Dockerfile", "frontend/package.json"];
  if (!required.every(name => fs.existsSync(path.join(root, name)))) return null;
  const versions = JSON.parse(fs.readFileSync(path.join(root, "versions.json"), "utf8"));
  if (!VERSION.test(versions.core || "") || !VERSION.test(versions.core_base_image || "")) fail("container-versions-invalid");
  return { root, core: versions.core, coreBaseImage: versions.core_base_image, product: versions.product || null };
}

/**
 * Ordered steps for one build. `stage` is the staged repository copy.
 * Steps are `{ id, program: "docker", args }` or `{ id, kind }` for steps the
 * caller performs itself (extracting translations, stamping the image origin).
 */
function planContainerImageBuild({ recipe, stage, scratch, tag = "home-assistant-material:local", arch = "amd64", commit }) {
  if (!recipe) fail("container-recipe-missing");
  for (const [name, value] of [["stage", stage], ["scratch", scratch]]) if (typeof value !== "string" || !path.isAbsolute(value)) fail("container-path-invalid", name);
  if (!TAG.test(tag)) fail("container-tag-invalid");
  if (!["amd64", "aarch64"].includes(arch)) fail("container-arch-unsupported");
  if (!/^[a-f0-9]{40}$/.test(commit || "")) fail("container-commit-invalid");
  const p = (...parts) => path.join(stage, ...parts);
  return [
    { id: "frontend-wheel", program: "docker", args: ["build", "-f", p("build", "frontend.Dockerfile"), "--output", `type=local,dest=${p("core")}`, p("frontend")] },
    { id: "translations", program: "docker", args: ["build", "-f", p("build", "translations.Dockerfile"), "--build-arg", `CORE_BASE=${recipe.core}`, "--output", `type=local,dest=${scratch}`, p("build")] },
    { id: "translations-extract", kind: "extract", from: path.join(scratch, "translations.tar"), to: p("core", "homeassistant") },
    { id: "image-origin", kind: "write", file: p("core", "rootfs", "OFFICIAL_IMAGE"), text: `local;${commit};material-buildroot;local\n` },
    { id: "core-image", program: "docker", args: ["build", p("core"),
      "--build-arg", `BUILD_FROM=ghcr.io/home-assistant/${arch}-homeassistant-base:${recipe.coreBaseImage}`,
      "--label", `io.hass.arch=${arch}`, "--label", `io.hass.version=${recipe.core}`,
      "--label", `org.opencontainers.image.revision=${commit}`, "--tag", tag] },
    { id: "inspect", program: "docker", args: ["image", "inspect", "--format", "{{.Id}} {{.Size}}", tag] },
  ];
}

module.exports = { discoverContainerRecipe, planContainerImageBuild, STAGED_PATHS };
