"use strict";
// Runs the Home Assistant OS image route and the container image route. Shared
// by the desktop service and the command-line scripts in scripts/haos/.
const { spawn } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { discoverHaosTree, planHaosBuild, planHaosCollect, planHaosCleanup, newWorkspaceId } = require("./haos-external-tree.cjs");
const { discoverContainerRecipe, planContainerImageBuild, STAGED_PATHS } = require("./haos-container-image.cjs");

const cancelled = () => Object.assign(new Error("Cancelled"), { code: "cancelled" });

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

/** Builds one image with the external tree's own recipe and copies haos_* files to `output`. */
async function runHaosImageBuild({ source, defconfig, output, commit = "HEAD", versionJson = null, keepVolume = false, onLine, signal }) {
  const tree = discoverHaosTree(source);
  if (!tree) throw Object.assign(new Error("No Buildroot external tree with defconfigs was found"), { code: "haos-tree-missing" });
  const { gitRoot, commit: sha } = await resolveCommit(tree.osDir, commit);
  const treePath = path.relative(gitRoot, tree.osDir).split(path.sep).join("/") || ".";
  const workspaceId = newWorkspaceId();
  const plan = planHaosBuild({ tree, defconfig, workspaceId, versionJson });
  const receipt = {
    version: 1, kind: "haos-external-tree-image", workspaceId, defconfig,
    source: { commit: sha, treePath, externalName: tree.externalName, treeVersion: tree.version },
    versionPin: versionJson ? "provided" : "live channel feed",
    updateSigning: "Without the release signing key and certificate the tree's recipe signs update bundles with a one-time key.",
    startedAt: new Date().toISOString(), steps: [], artifacts: [], state: "running",
  };
  const session = createSession({ folder: output, receipt, onLine, signal });
  // Archiving `commit:path` drops the repository's root .gitattributes, so a host
  // core.autocrlf=true would rewrite every text file to CRLF. Export the committed
  // bytes unchanged instead.
  const archive = () => spawn("git", ["-c", "core.autocrlf=false", "-c", "core.eol=lf", "-C", gitRoot, "archive", "--format=tar", treePath === "." ? sha : `${sha}:${treePath}`], { windowsHide: true }).stdout;
  session.say(`Building ${defconfig} from ${treePath} at ${sha} (workspace ${workspaceId})`);
  let failure = null;
  try {
    for (const item of plan.steps) {
      const stdin = item.stdinFrom === "archive" ? archive() : item.stdinFrom === "versionJson" ? versionJson : undefined;
      await session.step(item.id, () => session.exec("docker", item.args, { stdin }));
    }
    const collect = planHaosCollect({ workspaceId, destination: output });
    await session.step(collect.id, () => session.exec("docker", collect.args));
    for (const name of fs.readdirSync(output).filter(n => n.startsWith("haos_")).sort()) {
      const file = path.join(output, name);
      receipt.artifacts.push({ name, bytes: fs.statSync(file).size, sha256: await sha256File(file) });
    }
  } catch (error) { failure = error; }
  if (!keepVolume) {
    // Cleanup runs even after cancellation, so it uses its own unsignalled runner.
    const cleanup = createSession({ folder: output, receipt, onLine });
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
  if (!keepStage) fs.rmSync(stage, { recursive: true, force: true });
  fs.rmSync(scratch, { recursive: true, force: true });
  await session.close(failure ? (failure.code === "cancelled" ? "cancelled" : "failed") : "succeeded", failure);
  if (failure) throw failure;
  return receipt;
}

module.exports = { runHaosImageBuild, runContainerImageBuild };
