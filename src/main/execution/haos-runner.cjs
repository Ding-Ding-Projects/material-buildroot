"use strict";
// Runs the Home Assistant OS image route and the container image route. Shared
// by the desktop service and the command-line scripts in scripts/haos/.
const { spawn } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { discoverHaosTree, planHaosBuild, planHaosCollect, planHaosCleanup, newWorkspaceId, LABEL } = require("./haos-external-tree.cjs");
const { discoverSourceImages, boardOf, selectImages, registriesConf, planSourceImages, planLoad, planSourceCleanup, verifyEmbedded, names: sourceImageNames } = require("./haos-source-images.cjs");
const { discoverContainerRecipe, planContainerImageBuild, STAGED_PATHS } = require("./haos-container-image.cjs");

const cancelled = () => Object.assign(new Error("Cancelled"), { code: "cancelled" });

/** Removes a folder even when Git has left read-only object files in it (Windows refuses those with EPERM). */
function removeTree(folder) {
  try { fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3 }); return; }
  catch (error) { if (error.code !== "EPERM" && error.code !== "EACCES") throw error; }
  const writable = target => {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) return;
    fs.chmodSync(target, stat.isDirectory() ? 0o777 : 0o666);
    if (stat.isDirectory()) for (const name of fs.readdirSync(target)) writable(path.join(target, name));
  };
  writable(folder);
  fs.rmSync(folder, { recursive: true, force: true, maxRetries: 3 });
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(file).on("data", d => hash.update(d)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}

/** One log file, one receipt and a child-process runner that honours cancellation. */
function createSession({ folder, receipt, onLine, signal }) {
  fs.mkdirSync(folder, { recursive: true });
  const log = fs.createWriteStream(path.join(folder, "build.log"), { flags: "a" });
  const children = new Set();
  const killAll = () => { for (const child of children) child.kill(); };
  signal?.addEventListener("abort", killAll, { once: true });
  const say = line => { const text = `[${new Date().toISOString()}] ${line}`; log.write(text + "\n"); onLine?.(text); };
  const writeReceipt = () => fs.writeFileSync(path.join(folder, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  const output = data => { log.write(data); onLine?.(String(data)); };

  function exec(program, args, { stdin, capture = false, cwd } = {}) {
    if (signal?.aborted) return Promise.reject(cancelled());
    return new Promise((resolve, reject) => {
      const child = spawn(program, args, { windowsHide: true, ...(cwd ? { cwd } : {}) });
      children.add(child);
      let out = "";
      child.stdout.on("data", d => { if (capture) out += d; else output(d); });
      child.stderr.on("data", output);
      child.on("error", reject);
      if (stdin?.pipe) stdin.pipe(child.stdin); else child.stdin.end(stdin ?? undefined);
      child.on("close", code => {
        children.delete(child);
        if (signal?.aborted) return reject(cancelled());
        code === 0 ? resolve(out.trim()) : reject(Object.assign(new Error(`${program} ${args.slice(0, 2).join(" ")} exited ${code}; see build.log`), { code: "step-failed", exitCode: code }));
      });
    });
  }

  async function step(id, action) {
    const started = Date.now();
    say(`step ${id}`);
    try {
      const result = await action();
      receipt.steps.push({ id, ok: true, seconds: Math.round((Date.now() - started) / 1000) });
      return result;
    } catch (error) {
      receipt.steps.push({ id, ok: false, seconds: Math.round((Date.now() - started) / 1000) });
      throw error;
    } finally { writeReceipt(); }
  }

  function close(state, error) {
    receipt.state = state;
    if (error) receipt.error = error.message;
    receipt.finishedAt = new Date().toISOString();
    writeReceipt();
    say(`Finished: ${state}`);
    signal?.removeEventListener("abort", killAll);
    return new Promise(resolve => log.end(resolve));
  }
  return { say, exec, step, close, writeReceipt };
}

async function resolveCommit(repository, commit = "HEAD") {
  const run = args => new Promise((resolve, reject) => {
    const child = spawn("git", args, { windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { err += d; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `git exited ${code}`)));
  });
  const gitRoot = await run(["-C", repository, "rev-parse", "--show-toplevel"]);
  const sha = await run(["-C", gitRoot, "rev-parse", "--verify", `${commit}^{commit}`]);
  return { gitRoot: path.resolve(gitRoot), commit: sha };
}

/** The tree's own update feed for the defconfig's channel, read once so the build and the images from source agree on versions. */
async function readChannelFeed(tree, defconfig) {
  const mk = fs.readFileSync(path.join(tree.osDir, "buildroot-external", "package", "hassio", "hassio.mk"), "utf8");
  const base = /^HASSIO_VERSION_URL\s*=\s*"(https:\/\/[^"\s]+\/)"/m.exec(mk)?.[1];
  if (!base) throw Object.assign(new Error("The tree names no update feed address"), { code: "haos-feed-unknown" });
  const config = fs.readFileSync(path.join(tree.osDir, "buildroot-external", "configs", `${defconfig}_defconfig`), "utf8");
  const channel = /^BR2_PACKAGE_HASSIO_CHANNEL_DEV=y/m.test(config) ? "dev" : /^BR2_PACKAGE_HASSIO_CHANNEL_BETA=y/m.test(config) ? "beta" : "stable";
  const url = `${base}${channel}.json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Object.assign(new Error(`The update feed ${url} answered ${response.status}`), { code: "haos-feed-unavailable" });
  const text = await response.text();
  JSON.parse(text);
  return { url, text, capturedAt: new Date().toISOString() };
}

/**
 * Builds one image with the external tree's own recipe and copies haos_* files to `output`.
 * When the repository carries the sources of the images the OS embeds, those images are
 * built from source first and the tree's fetch step is pointed at them (`fromSource`).
 */
async function runHaosImageBuild({ source, defconfig, output, commit = "HEAD", versionJson = null, fromSource = true, keepVolume = false, onLine, signal }) {
  const tree = discoverHaosTree(source);
  if (!tree) throw Object.assign(new Error("No Buildroot external tree with defconfigs was found"), { code: "haos-tree-missing" });
  const { gitRoot, commit: sha } = await resolveCommit(tree.osDir, commit);
  const treePath = path.relative(gitRoot, tree.osDir).split(path.sep).join("/") || ".";
  const workspaceId = newWorkspaceId();
  const discovered = fromSource ? discoverSourceImages(gitRoot) : null;
  let versionPin = versionJson ? "provided" : "live channel feed", selection = null;
  if (discovered) {
    if (versionJson === null) {
      const feed = await readChannelFeed(tree, defconfig);
      versionJson = feed.text;
      versionPin = `live channel feed ${feed.url}, captured ${feed.capturedAt}`;
    }
    const board = boardOf(tree.osDir, defconfig);
    selection = { ...selectImages({ discovered, versionJson, arch: board.arch, machine: board.machine }), board };
    if (!selection.fromSource.length) selection = null;
  }
  const names = selection ? sourceImageNames(workspaceId) : null;
  const plan = planHaosBuild({ tree, defconfig, workspaceId, versionJson,
    registries: selection ? registriesConf({ prefix: discovered.prefix, workspaceId }) : null, network: names?.network || null });
  const receipt = {
    version: 1, kind: "haos-external-tree-image", workspaceId, defconfig,
    source: { commit: sha, treePath, externalName: tree.externalName, treeVersion: tree.version },
    versionPin,
    embeddedImages: selection
      ? { fromSource: [], fetched: selection.fetched, note: "Images whose sources are in the repository were built from that commit; the others are fetched by the tree's recipe." }
      : { fromSource: [], fetched: "all", note: fromSource ? "The repository carries no sources for the images this OS embeds, so the tree's recipe fetches them." : "Building from source was turned off." },
    updateSigning: "Without the release signing key and certificate the tree's recipe signs update bundles with a one-time key.",
    startedAt: new Date().toISOString(), steps: [], artifacts: [], state: "running",
  };
  const session = createSession({ folder: output, receipt, onLine, signal });
  // Archiving `commit:path` drops the repository's root .gitattributes, so a host
  // core.autocrlf=true would rewrite every text file to CRLF. Export the committed
  // bytes unchanged instead.
  const archiveOf = folder => spawn("git", ["-c", "core.autocrlf=false", "-c", "core.eol=lf", "-C", gitRoot, "archive", "--format=tar", folder === "." ? sha : `${sha}:${folder}`], { windowsHide: true }).stdout;
  session.say(`Building ${defconfig} from ${treePath} at ${sha} (workspace ${workspaceId})`);
  const saveOf = tag => spawn("docker", ["save", tag], { windowsHide: true }).stdout;
  const runStep = item => session.step(item.id, () => session.exec("docker", item.args, { stdin: item.stdinFrom === "archive" ? archiveOf(treePath) : undefined }));
  let failure = null;
  try {
    // The builder image comes first: it also copies the images built from source into the registry.
    const [builderStep, ...osSteps] = plan.steps;
    await runStep(builderStep);
    if (selection) {
      session.say(`Building ${selection.fromSource.map(i => i.id).join(" and ")} from source; fetched by the tree's recipe: ${selection.fetched.join(", ") || "none"}`);
      const before = planSourceImages({ selection, workspaceId, platform: selection.board.platform, commit: sha, labels: ["--label", `${LABEL}=${workspaceId}`] });
      for (const item of before.steps) {
        const stdin = item.stdinFrom?.startsWith("context:") ? archiveOf(item.stdinFrom.slice("context:".length)) : undefined;
        await session.step(item.id, () => session.exec("docker", item.args, { stdin }));
      }
      for (const item of selection.fromSource) {
        const load = planLoad({ item, prefix: discovered.prefix, workspaceId, builderImage: plan.names.builderImage });
        const out = await session.step(load.step.id, () => session.exec("docker", load.step.args, { stdin: saveOf(load.step.stdinFrom.slice("save:".length)), capture: true }));
        const digest = /^(sha256:[a-f0-9]{64})$/m.exec(out)?.[1];
        if (!digest) throw Object.assign(new Error(`The registry reported no digest for ${item.id}`), { code: "haos-source-image-digest-missing" });
        session.say(`Stored ${item.image}:${item.tag} from source as ${digest}`);
        receipt.embeddedImages.fromSource.push({ id: item.id, reference: `${item.image}:${item.tag}`, digest, revision: sha });
      }
    }
    for (const item of osSteps) {
      const stdin = item.stdinFrom === "archive" ? archiveOf(treePath) : item.stdinFrom === "versionJson" ? versionJson : item.stdinFrom === "registries" ? registriesConf({ prefix: discovered.prefix, workspaceId }) : undefined;
      await session.step(item.id, () => session.exec("docker", item.args, { stdin }));
    }
    if (selection) {
      // The tree's recipe prints the digest of every image it put into the OS image; each
      // image built from source must appear there with the digest that was pushed.
      const log = fs.readFileSync(path.join(output, "build.log"), "utf8");
      const checked = verifyEmbedded({ log, built: receipt.embeddedImages.fromSource.map(i => ({ ...i, image: i.reference.slice(0, i.reference.lastIndexOf(":")), tag: i.reference.slice(i.reference.lastIndexOf(":") + 1) })) });
      receipt.embeddedImages.fromSource = checked.map(({ id, reference, digest, revision, embeddedDigest, matches }) => ({ id, reference, digest, revision, embeddedDigest, matches }));
      const missing = checked.filter(i => !i.matches);
      if (missing.length) throw Object.assign(new Error(`The OS image does not hold the images built from source: ${missing.map(i => `${i.reference} (${i.embeddedDigest || "not fetched"})`).join(", ")}`), { code: "haos-source-image-not-embedded" });
      session.say(`Embedded from source: ${checked.map(i => `${i.reference} ${i.digest}`).join(", ")}`);
    }
    const collect = planHaosCollect({ workspaceId, destination: output });
    await session.step(collect.id, () => session.exec("docker", collect.args));
    for (const name of fs.readdirSync(output).filter(n => n.startsWith("haos_")).sort()) {
      const file = path.join(output, name);
      receipt.artifacts.push({ name, bytes: fs.statSync(file).size, sha256: await sha256File(file) });
    }
  } catch (error) { failure = error; }
  // Cleanup runs even after cancellation, so it uses its own unsignalled runner.
  const cleanup = createSession({ folder: output, receipt, onLine });
  if (selection) for (const item of planSourceCleanup({ workspaceId, selection })) await cleanup.step(item.id, () => cleanup.exec("docker", item.args)).catch(error => cleanup.say(`cleanup: ${error.message}`));
  if (!keepVolume) {
    for (const item of planHaosCleanup({ workspaceId })) await cleanup.step(item.id, () => cleanup.exec("docker", item.args)).catch(error => cleanup.say(`cleanup: ${error.message}`));
  }
  await session.close(failure ? (failure.code === "cancelled" ? "cancelled" : "failed") : "succeeded", failure);
  if (failure) throw failure;
  return receipt;
}

/** Builds the container image locally from a staged clone; never pushes. */
async function runContainerImageBuild({ source, work, commit = "HEAD", tag = "home-assistant-material:local", save = null, keepStage = false, onLine, signal }) {
  const recipe = discoverContainerRecipe(source);
  if (!recipe) throw Object.assign(new Error("The repository does not carry the container image recipe"), { code: "container-recipe-missing" });
  const stage = path.join(work, "stage"), scratch = path.join(work, "scratch");
  if (fs.existsSync(stage)) throw Object.assign(new Error(`${stage} already exists`), { code: "container-stage-exists" });
  const { commit: sha } = await resolveCommit(source, commit);
  const receipt = { version: 1, kind: "container-image", tag, source: { commit: sha, core: recipe.core, coreBaseImage: recipe.coreBaseImage }, startedAt: new Date().toISOString(), steps: [], state: "running" };
  const session = createSession({ folder: work, receipt, onLine, signal });
  fs.mkdirSync(scratch, { recursive: true });
  let failure = null;
  try {
    // A shared clone reads the source objects without touching the source checkout.
    // Line endings follow .gitattributes, and symbolic links become small files.
    await session.step("stage", async () => {
      await session.exec("git", ["clone", "--quiet", "--shared", "--no-checkout", "-c", "core.autocrlf=false", "-c", "core.symlinks=false", source, stage]);
      await session.exec("git", ["-C", stage, "sparse-checkout", "set", "--no-cone", ...STAGED_PATHS.map(p => `/${p}`)]);
      await session.exec("git", ["-C", stage, "checkout", "--quiet", "--detach", sha]);
    });
    for (const item of planContainerImageBuild({ recipe, stage, scratch, tag, commit: sha })) {
      const result = await session.step(item.id, async () => {
        // GNU tar on Windows reads "C:\..." as a remote host:path and mangles it after -C,
        // so it runs in the destination with a relative archive path and no drive letter.
        if (item.kind === "extract") return session.exec("tar", ["-xf", path.relative(item.to, item.from).split(path.sep).join("/")], { cwd: item.to });
        if (item.kind === "write") return fs.writeFileSync(item.file, item.text);
        return session.exec(item.program, item.args, { capture: item.id === "inspect" });
      });
      if (item.id === "inspect") { const [id, size] = result.split(" "); receipt.image = { id, bytes: Number(size) }; }
    }
    if (save) {
      await session.step("save", () => session.exec("docker", ["save", "--output", save, tag]));
      receipt.saved = { file: path.basename(save), bytes: fs.statSync(save).size, sha256: await sha256File(save) };
    }
  } catch (error) { failure = error; }
  for (const folder of keepStage ? [scratch] : [stage, scratch]) {
    try { removeTree(folder); } catch (error) {
      // Leftover files never overturn the build result; they are reported instead.
      receipt.cleanupWarnings = [...(receipt.cleanupWarnings || []), `${path.basename(folder)}: ${error.code || error.message}`];
      session.say(`cleanup: could not remove ${folder}: ${error.code || error.message}`);
    }
  }
  await session.close(failure ? (failure.code === "cancelled" ? "cancelled" : "failed") : "succeeded", failure);
  if (failure) throw failure;
  return receipt;
}

module.exports = { runHaosImageBuild, runContainerImageBuild, removeTree };
