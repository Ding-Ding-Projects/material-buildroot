"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");
const { fail, digest, fetchBounded } = require("./runtime.cjs");
const { installOllama } = require("./installer.cjs");
function createManagedOllamaController(options = {}) {
  const directory = options.directory;
  if (!directory || !path.isAbsolute(directory))
    fail("INVALID_MANAGED_DIRECTORY");
  const manifest =
    options.manifest ||
    (process.platform === "win32" && process.arch === "x64"
      ? require("./ollama-windows-x64-manifest.json")
      : null);
  const native =
    options.processAdapter ||
    (process.platform === "win32"
      ? require("./ollama-process.cjs").createWindowsOllamaProcessAdapter()
      : null);
  const verifyListener = options.verifyListener || native?.verifyListener,
    stopOwnedTree = options.stopOwnedTree || native?.stopOwnedTree;
  const versions = path.join(directory, "versions"),
    cache = path.join(directory, "cache"),
    models = path.join(directory, "models");
  let lastInstalled = false;
  let phase = "missing",
    lastCode = null,
    operation = null,
    owned = null,
    disposed = false;
  const installedDirectory = () =>
    manifest
      ? path.join(
          versions,
          manifest.version + "-" + manifest.platform + "-" + manifest.arch,
        )
      : null;
  async function inspect() {
    if (!manifest) return false;
    try {
      for (const parent of [directory, versions]) {
        const parentStat = await fs.lstat(parent);
        if (!parentStat.isDirectory() || parentStat.isSymbolicLink())
          fail("INVALID_INSTALLATION");
      }
      const root = installedDirectory(),
        stat = await fs.lstat(root);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        fail("INVALID_INSTALLATION");
      const expected = new Set(manifest.members.map((member) => member.path));
      async function walk(current, relative = "") {
        for (const entry of await fs.readdir(current, {
          withFileTypes: true,
        })) {
          const name = relative ? relative + "/" + entry.name : entry.name;
          if (entry.isDirectory())
            await walk(path.join(current, entry.name), name);
          else if (!entry.isFile() || !expected.has(name))
            fail("INVALID_INSTALLATION");
        }
      }
      await walk(root);
      for (const member of manifest.members) {
        const file = path.join(root, member.path),
          entry = await fs.lstat(file);
        if (
          !entry.isFile() ||
          entry.isSymbolicLink() ||
          entry.nlink !== 1 ||
          (member.length !== undefined && entry.size !== member.length) ||
          (await digest(file)) !== member.sha256
        )
          fail("PAYLOAD_HASH_MISMATCH");
      }
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
  async function status() {
    let installed = false,
      code = lastCode;
    try {
      installed = operation ? lastInstalled : await inspect();
    } catch (error) {
      code = error.code || "INSTALLATION_UNAVAILABLE";
    }
    if (!operation) lastInstalled = installed;
    if (installed && phase === "missing") phase = "installed";
    let running = false;
    if (owned) {
      try {
        const listener = await verifyListener({
          pid: owned.child.pid,
          host: "127.0.0.1",
          port: 11434,
        });
        if (listener?.verified === true && listener.pid === owned.child.pid) {
          const health = await fetchBounded(
            "http://127.0.0.1:11434/api/version",
            {
              signal: AbortSignal.timeout(3000),
              fetchImpl: options.fetchImpl,
              maxBytes: 65536,
            },
          );
          running = health.version === manifest.version;
          if (!running) code = "OLLAMA_VERSION_MISMATCH";
        } else code = "OLLAMA_LISTENER_OWNERSHIP_UNVERIFIED";
      } catch (error) {
        code = error.code || "OLLAMA_HEALTH_UNVERIFIED";
      }
    }
    return {
      phase,
      installationValidation: operation ? "retained-during-operation" : "fresh",
      version: manifest?.version || null,
      platformSupported: !!manifest,
      installed,
      running,
      owned: !!owned,
      code: code || (!manifest ? "UNSUPPORTED_MANAGED_PLATFORM" : null),
      payload: {
        available: !!manifest,
        kind: manifest?.kind || null,
        downloadBytes: manifest?.length || null,
        publisherVerification:
          manifest?.provenance?.publisherSignatureVerified === true
            ? "signature-verified"
            : "official-release-digest",
        nativeRuntimeVerified: false,
      },
    };
  }
  async function confirmed(acquire) {
    const review = {
      version: manifest.version,
      downloadBytes: manifest.length,
      acquire,
      origin: manifest.url,
      preservesExisting: true,
    };
    if (options.confirmInstall)
      return (await options.confirmInstall(review)) === true;
    if (!options.dialog?.showMessageBox)
      fail("NATIVE_CONFIRMATION_UNAVAILABLE");
    const notice = {
      type: "question",
      title: "Install managed Ollama",
      message:
        "Install Ollama " +
        manifest.version +
        " in this application’s private runtime directory?",
      detail:
        (acquire
          ? "If verified bundled or cached bytes are unavailable, download " +
            manifest.length +
            " bytes from the pinned official Ollama release."
          : "Use verified bundled or cached bytes only. No network acquisition is permitted.") +
        " Existing Ollama installations and models are preserved. Installation does not start the runtime or change PATH/startup settings.",
      buttons: ["Cancel", "Install managed Ollama"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    return (
      (
        await (options.parentWindow
          ? options.dialog.showMessageBox(options.parentWindow, notice)
          : options.dialog.showMessageBox(notice))
      ).response === 1
    );
  }
  async function run(context, work) {
    if (disposed) fail("SERVICE_DISPOSED");
    if (operation) fail("OLLAMA_OPERATION_BUSY");
    const controller = new AbortController(),
      abort = () => controller.abort();
    if (context.signal?.aborted) controller.abort();
    context.signal?.addEventListener("abort", abort, { once: true });
    const completed = { controller, promise: null };
    operation = completed;
    completed.promise = (async () => {
      try {
        return await work({ ...context, signal: controller.signal });
      } catch (error) {
        lastCode =
          error.name === "AbortError"
            ? "CANCELLED"
            : error.code || "OLLAMA_OPERATION_FAILED";
        phase = lastCode === "CANCELLED" ? "cancelled" : "failed";
        throw error;
      } finally {
        context.signal?.removeEventListener("abort", abort);
        operation = null;
      }
    })();
    return completed.promise;
  }
  async function install(request = {}, context = {}) {
    return run(context, async (ctx) => {
      if (!manifest) fail("UNSUPPORTED_MANAGED_PLATFORM");
      if (
        manifest.platform !== process.platform ||
        manifest.arch !== process.arch
      )
        fail("UNSUPPORTED_MANAGED_PLATFORM");
      phase = "review";
      if (!(await confirmed(request.acquire === true))) {
        phase = "cancelled";
        return { cancelled: true, installed: false };
      }
      if (ctx.signal.aborted) fail("CANCELLED");
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const rootStat = await fs.lstat(directory);
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
        fail("INVALID_MANAGED_DIRECTORY");
      await fs.mkdir(cache, { recursive: true, mode: 0o700 });
      let cached;
      for (const candidate of [
        options.bundledPayload,
        path.join(cache, manifest.sha256 + "." + manifest.kind),
      ]) {
        if (!candidate) continue;
        try {
          const stat = await fs.lstat(candidate);
          if (
            stat.isFile() &&
            !stat.isSymbolicLink() &&
            stat.nlink === 1 &&
            stat.size === manifest.length &&
            (await digest(candidate)) === manifest.sha256
          ) {
            cached = candidate;
            break;
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      phase = "installing";
      lastCode = null;
      const result = await installOllama(
        {
          ...options,
          ollamaPayload: manifest,
          ollamaInstallDirectory: versions,
          ollamaCachedPayload: cached,
          ollamaCacheDirectory: cache,
          allowOllamaAcquisition: request.acquire === true,
          repairOllama: request.repair === true,
        },
        {
          ...ctx,
          onProgress: (event) => {
            phase = event.phase || phase;
            context.onProgress?.(event);
          },
        },
      );
      if (!result.installed) fail(result.code || "INSTALLATION_UNAVAILABLE");
      if (!(await inspect())) fail("INSTALLATION_UNAVAILABLE");
      const receipt = {
        format: "material-buildroot-managed-ollama",
        version: 1,
        ollamaVersion: manifest.version,
        archiveSha256: manifest.sha256,
        manifestSha256: createHash("sha256")
          .update(JSON.stringify(manifest))
          .digest("hex"),
        installedAt: new Date().toISOString(),
        nativeRuntimeVerified: false,
      };
      const temporary = path.join(directory, ".receipt-" + randomUUID());
      try {
        await fs.writeFile(temporary, JSON.stringify(receipt), {
          flag: "wx",
          mode: 0o600,
        });
        await fs.rename(temporary, path.join(directory, "installation.json"));
      } finally {
        await fs.rm(temporary, { force: true });
      }
      lastInstalled = true;
      phase = "installed";
      return { ...result, started: false, modelsPreserved: true };
    });
  }
  async function portFree(signal) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: "127.0.0.1", port: 11434 });
      const done = (error) => {
        socket.destroy();
        signal?.removeEventListener("abort", abort);
        error ? reject(error) : resolve();
      };
      const abort = () =>
        done(Object.assign(new Error("CANCELLED"), { code: "CANCELLED" }));
      signal?.addEventListener("abort", abort, { once: true });
      socket.setTimeout(2000, () =>
        done(
          Object.assign(new Error("PORT_CHECK_UNVERIFIED"), {
            code: "PORT_CHECK_UNVERIFIED",
          }),
        ),
      );
      socket.once("connect", () =>
        done(
          Object.assign(new Error("OLLAMA_PORT_IN_USE"), {
            code: "OLLAMA_PORT_IN_USE",
          }),
        ),
      );
      socket.once("error", (error) =>
        done(
          error.code === "ECONNREFUSED"
            ? null
            : Object.assign(new Error("PORT_CHECK_UNVERIFIED"), {
                code: "PORT_CHECK_UNVERIFIED",
              }),
        ),
      );
    });
  }
  async function stop() {
    if (!owned) return { stopped: true, alreadyStopped: true };
    const record = owned;
    if (!Number.isInteger(record.child.pid)) {
      owned = null;
      phase = "installed";
      return { stopped: true, processNeverStarted: true };
    }
    phase = "stopping";
    const settled = await stopOwnedTree({
      pid: record.child.pid,
      child: record.child,
    });
    if (settled?.settled !== true || settled.pid !== record.child.pid)
      fail("OWNED_PROCESS_STOP_UNVERIFIED");
    owned = null;
    phase = "installed";
    return { stopped: true };
  }
  async function start(context = {}) {
    return run(context, async (ctx) => {
      if (owned) fail("OLLAMA_ALREADY_OWNED");
      if (!manifest || !(await inspect())) fail("MISSING_VERIFIED_PAYLOAD");
      if (
        typeof verifyListener !== "function" ||
        typeof stopOwnedTree !== "function"
      )
        fail("OWNED_RUNTIME_VERIFICATION_UNAVAILABLE");
      if (ctx.signal.aborted) fail("CANCELLED");
      await portFree(ctx.signal);
      await fs.mkdir(models, { recursive: true, mode: 0o700 });
      if ((await fs.lstat(models)).isSymbolicLink())
        fail("INVALID_MODEL_DIRECTORY");
      const file = path.join(installedDirectory(), manifest.executablePath);
      phase = "starting";
      const child = native
        ? (
            await native.launch({
              executable: file,
              directory: installedDirectory(),
              models,
              members: manifest.members,
              signal: ctx.signal,
            })
          ).child
        : spawn(file, ["serve"], {
            shell: false,
            windowsHide: true,
            cwd: installedDirectory(),
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              PATH: path.dirname(file),
              SystemRoot: process.env.SystemRoot || "",
              OLLAMA_HOST: "127.0.0.1:11434",
              OLLAMA_MODELS: models,
            },
          });
      owned = { child };
      child.stdout.on("data", () => {});
      child.stderr.on("data", () => {});
      try {
        if (!native)
          await new Promise((resolve, reject) => {
            child.once("spawn", resolve);
            child.once("error", () =>
              reject(
                Object.assign(new Error("PROCESS_START_FAILED"), {
                  code: "PROCESS_START_FAILED",
                }),
              ),
            );
          });
        for (let attempt = 0; attempt < 20; attempt++) {
          if (ctx.signal.aborted) fail("CANCELLED");
          if (child.exitCode !== null || child.signalCode !== null)
            fail("OLLAMA_EXITED_BEFORE_HEALTH");
          const identity = await verifyListener({
            pid: child.pid,
            host: "127.0.0.1",
            port: 11434,
          });
          if (identity?.verified === true && identity.pid === child.pid) {
            const health = await fetchBounded(
              "http://127.0.0.1:11434/api/version",
              {
                signal: ctx.signal,
                fetchImpl: options.fetchImpl,
                maxBytes: 65536,
              },
            );
            if (health.version !== manifest.version)
              fail("OLLAMA_VERSION_MISMATCH");
            phase = "ready";
            return {
              started: true,
              ready: true,
              version: health.version,
              owned: true,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        fail("OLLAMA_LISTENER_OWNERSHIP_UNVERIFIED");
      } catch (error) {
        await stop();
        throw error;
      }
    });
  }
  async function dispose() {
    disposed = true;
    const pending = operation;
    pending?.controller.abort();
    if (pending) await pending.promise.catch(() => {});
    await stop();
    await native?.dispose();
  }
  async function execute(request, context = {}) {
    request = require("./request-contract.cjs").admit(request);
    if (disposed) fail("SERVICE_DISPOSED");
    switch (request.action) {
      case "ollama.managed.status":
        return status();
      case "ollama.managed.cancel":
        operation?.controller.abort();
        return { cancelling: !!operation };
      case "ollama.install":
        return install(request, context);
      case "ollama.managed.start":
        return start(context);
      case "ollama.managed.stop":
        return stop();
      default:
        fail("INVALID_REQUEST");
    }
  }
  return {
    execute,
    status,
    install,
    start,
    stop,
    dispose,
    cancel: () => operation?.controller.abort(),
  };
}
module.exports = { createManagedOllamaController };
