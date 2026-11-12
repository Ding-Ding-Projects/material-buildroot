"use strict";
// Desktop service for the Home Assistant OS route. The renderer can only pick
// folders through the native dialog, choose a defconfig the tree itself lists,
// start one job, cancel it and read its status. It never supplies a command.
const fs = require("node:fs"), path = require("node:path");
const { discoverHaosTree } = require("./haos-external-tree.cjs");
const { discoverContainerRecipe } = require("./haos-container-image.cjs");
const { discoverSourceImages } = require("./haos-source-images.cjs");
const { runHaosImageBuild, runContainerImageBuild } = require("./haos-runner.cjs");

const MAX_LINES = 400;
const ACTIONS = new Set(["status", "choose-source", "choose-output", "start", "cancel"]);

function createHaosService({ dialog, parentWindow, defaultOutput, notify }) {
  let source = null, output = defaultOutput, job = null;

  function summary() {
    return {
      source: source && { path: source.root, defconfigs: source.tree?.defconfigs || [], treeVersion: source.tree?.version || null, externalName: source.tree?.externalName || null, containerRecipe: !!source.recipe, core: source.recipe?.core || null, sourceImages: !!source.sourceImages },
      output,
      job: job && { kind: job.kind, label: job.label, state: job.state, startedAt: job.startedAt, folder: job.folder, lines: job.lines.slice(-MAX_LINES), error: job.error || null,
        artifacts: job.receipt?.artifacts || [], image: job.receipt?.image || null, commit: job.receipt?.source?.commit || null,
        fromSource: (job.receipt?.embeddedImages?.fromSource || []).map(({ id, reference, digest, matches }) => ({ id, reference, digest, matches })) },
    };
  }

  async function chooseFolder(title) {
    const result = await dialog.showOpenDialog(parentWindow(), { title, properties: ["openDirectory", "dontAddToRecent"] });
    return result.canceled || result.filePaths.length !== 1 ? null : path.resolve(result.filePaths[0]);
  }

  function start(value) {
    if (job?.state === "running") return { ok: false, code: "HAOS_JOB_RUNNING" };
    if (!source) return { ok: false, code: "HAOS_SOURCE_REQUIRED" };
    if (!output || !fs.existsSync(output)) return { ok: false, code: "HAOS_OUTPUT_REQUIRED" };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const controller = new AbortController();
    const onLine = text => { for (const line of String(text).split(/\r?\n/)) if (line) job.lines.push(line); if (job.lines.length > MAX_LINES * 2) job.lines.splice(0, job.lines.length - MAX_LINES); };
    let run;
    if (value.kind === "image") {
      if (!source.tree?.defconfigs.includes(value.defconfig)) return { ok: false, code: "HAOS_DEFCONFIG_UNKNOWN" };
      const folder = path.join(output, `haos-${value.defconfig}-${stamp}`);
      job = { kind: "image", label: value.defconfig, folder };
      run = () => runHaosImageBuild({ source: source.root, defconfig: value.defconfig, output: folder, onLine, signal: controller.signal });
    } else if (value.kind === "container") {
      if (!source.recipe) return { ok: false, code: "HAOS_CONTAINER_RECIPE_MISSING" };
      const folder = path.join(output, `container-${stamp}`);
      job = { kind: "container", label: "home-assistant-material:local", folder };
      run = () => runContainerImageBuild({ source: source.root, work: folder, onLine, signal: controller.signal });
    } else return { ok: false, code: "INVALID_REQUEST" };
    Object.assign(job, { state: "running", startedAt: Date.now(), lines: [], controller });
    const current = job;
    run().then(receipt => { current.receipt = receipt; current.state = "succeeded"; notify?.("Image build finished", `${current.label} finished. Open Builds to see the files.`, "success"); },
      error => { current.state = error.code === "cancelled" ? "cancelled" : "failed"; current.error = error.message; notify?.("Image build stopped", `${current.label} ${current.state}. Open Builds to read the log.`, current.state === "cancelled" ? "warning" : "error"); });
    return { ok: true, result: summary() };
  }

  return {
    async request(value) {
      if (!value || typeof value !== "object" || !ACTIONS.has(value.action)) return { ok: false, code: "INVALID_REQUEST" };
      try {
        if (value.action === "choose-source") {
          if (job?.state === "running") return { ok: false, code: "HAOS_JOB_RUNNING" };
          const folder = await chooseFolder("Choose a repository with an operating-system Buildroot tree");
          if (folder) {
            const tree = discoverHaosTree(folder), recipe = discoverContainerRecipe(folder);
            if (!tree && !recipe) return { ok: false, code: "HAOS_SOURCE_UNRECOGNISED" };
            let sourceImages = false;
            try { sourceImages = !!(tree && (discoverSourceImages(folder) || discoverSourceImages(path.dirname(tree.osDir)))); } catch { sourceImages = false; }
            source = { root: folder, tree, recipe, sourceImages };
          }
        } else if (value.action === "choose-output") {
          if (job?.state === "running") return { ok: false, code: "HAOS_JOB_RUNNING" };
          const folder = await chooseFolder("Choose where finished images are saved");
          if (folder) output = folder;
        } else if (value.action === "start") {
          return start(value);
        } else if (value.action === "cancel") {
          if (job?.state !== "running") return { ok: false, code: "HAOS_NO_RUNNING_JOB" };
          job.controller.abort();
        }
        return { ok: true, result: summary() };
      } catch (error) {
        return { ok: false, code: /^[a-z-]+$/.test(error.code || "") ? error.code.toUpperCase().replace(/-/g, "_") : "HAOS_UNAVAILABLE" };
      }
    },
  };
}

module.exports = { createHaosService };
