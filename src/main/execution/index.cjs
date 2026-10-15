"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const TARGETS = Object.freeze([
  "all",
  "olddefconfig",
  "savedefconfig",
  "legal-info",
  "source",
  "show-info",
  "graph-depends",
]);
function boundedProcess(
  file,
  args,
  {
    cwd,
    timeoutMs = 10000,
    maxBytes = 65536,
    onLog,
    onTerminate,
    env,
    detached = process.platform !== "win32",
  } = {},
) {
  let child,
    timer,
    killTimer,
    settled = false,
    bytes = 0,
    stdout = "",
    stderr = "",
    reason,
    cleanupPromise;
  const terminate = () => {
    if (!child || settled) return;
    if (cleanupPromise) return;
    try {
      if (detached) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {}
    const escalation = new Promise((resolve) => {
      killTimer = setTimeout(() => {
        try {
          if (detached) process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {}
        resolve();
      }, 500);
    });
    cleanupPromise = Promise.allSettled([
      escalation,
      Promise.resolve().then(() => onTerminate?.()),
    ]).then((results) =>
      results.some((result) => result.status === "rejected")
        ? "runtime-cleanup-failed"
        : null,
    );
  };
  const completion = new Promise((resolve) => {
    try {
      child = spawn(file, args, {
        cwd,
        env: env || {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          WINDIR: process.env.WINDIR,
        },
        shell: false,
        windowsHide: true,
        detached,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({
        state: "unavailable",
        code: null,
        stdout,
        stderr: error.code || "spawn-failed",
      });
      return;
    }
    timer = setTimeout(() => {
      reason = "timed-out";
      terminate();
    }, timeoutMs);
    timer.unref();
    const receive = (stream, chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reason = "output-limit";
        terminate();
        return;
      }
      const text = chunk.toString("utf8");
      if (stream === "stdout") stdout += text;
      else stderr += text;
      try {
        onLog?.({ stream, text });
      } catch {
        /* Observers cannot control owned process settlement. */
      }
    };
    child.stdout.on("data", (chunk) => receive("stdout", chunk));
    child.stderr.on("data", (chunk) => receive("stderr", chunk));
    child.on("error", (error) => {
      settled = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve({
        state: "unavailable",
        code: null,
        stdout,
        stderr: error.code || "spawn-failed",
      });
    });
    child.on("close", async (code, signal) => {
      settled = true;
      clearTimeout(timer);
      const cleanupError = cleanupPromise && (await cleanupPromise);
      resolve({
        state: cleanupError || reason || (code === 0 ? "succeeded" : "failed"),
        code,
        signal,
        stdout,
        stderr,
      });
    });
  });
  return {
    completion,
    cancel() {
      if (!settled) {
        reason = "cancelled";
        terminate();
      }
    },
  };
}
function inside(root, value) {
  const relative = path.relative(root, value);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
function canonicalDirectory(value) {
  if (
    typeof value !== "string" ||
    !path.isAbsolute(value) ||
    /[\0\r\n]/.test(value)
  )
    throw new Error("invalid-directory");
  const real = fs.realpathSync(value);
  if (!fs.statSync(real).isDirectory()) throw new Error("not-directory");
  return real;
}
const LINUX_SCRIPT =
  'set -eu; test "$(id -u)" -ne 0 || { echo non-root-required >&2; exit 77; }; exec make -C "$1" "O=$2" "-j$3" "BR2_EXTERNAL=$5" "$4"';
const ENVIRONMENT_SCRIPT =
  'set -eu; test "$(id -u)" -ne 0 || { echo non-root-required >&2; exit 77; }; gcc -dumpmachine; gcc -dumpfullversion -dumpversion';
class ExecutionService {
  constructor({
    platform = process.platform,
    executables = {},
    linuxFixture = false,
  } = {}) {
    this.platform = platform;
    this.executables = {
      wsl: "wsl.exe",
      docker: "docker",
      make: "make",
      ...executables,
    };
    this.linuxFixture = linuxFixture;
    this.grants = new Map();
    this.locks = new Set();
  }
  grantProject({
    root,
    source,
    output,
    trustedSource = false,
    externalTrees = [],
    trustedExternalTrees = false,
  }) {
    if (trustedSource !== true)
      throw new Error("source-execution-consent-required");
    root = canonicalDirectory(root);
    source = canonicalDirectory(source);
    output = canonicalDirectory(output);
    if (
      !/^[A-Za-z0-9_:/\\.+-]+$/.test(source) ||
      !/^[A-Za-z0-9_:/\\.+-]+$/.test(output)
    )
      throw new Error("unsupported-build-path");
    if (
      !inside(root, source) ||
      !inside(root, output) ||
      source === output ||
      inside(source, output) ||
      inside(output, source)
    )
      throw new Error("project-path-boundary");
    if (!fs.statSync(path.join(source, "Makefile")).isFile())
      throw new Error("makefile-required");
    if (!Array.isArray(externalTrees) || externalTrees.length > 32)
      throw new Error("invalid-external-trees");
    if (externalTrees.length && trustedExternalTrees !== true)
      throw new Error("external-execution-consent-required");
    const external = externalTrees.map((entry) => {
      const canonical = canonicalDirectory(entry);
      if (
        path.resolve(entry) !== canonical ||
        canonical.replace(/^[A-Za-z]:[\\/]/, "").includes(":") ||
        !/^[A-Za-z0-9_:/\\.+-]+$/.test(canonical)
      )
        throw new Error("unsupported-external-path");
      if (
        canonical === source ||
        inside(output, canonical) ||
        inside(canonical, output)
      )
        throw new Error("external-path-boundary");
      const paths = [
        canonical,
        ...["external.desc", "Config.in", "external.mk"].map((name) =>
          path.join(canonical, name),
        ),
      ];
      const identities = paths.map((entry, index) => {
        const stat = fs.lstatSync(entry);
        if (
          stat.isSymbolicLink() ||
          (index === 0 ? !stat.isDirectory() : !stat.isFile())
        )
          throw new Error("external-descriptor-required");
        return `${stat.dev}:${stat.ino}`;
      });
      return { path: canonical, paths, identities };
    });
    if (new Set(external.map((entry) => entry.path)).size !== external.length)
      throw new Error("duplicate-external-tree");
    const grantId = crypto.randomUUID();
    this.grants.set(grantId, {
      root,
      source,
      output,
      external,
      identities: Object.fromEntries(
        Object.entries({ root, source, output }).map(([key, value]) => {
          const stat = fs.statSync(value);
          return [key, `${stat.dev}:${stat.ino}`];
        }),
      ),
    });
    return {
      grantId,
      root,
      source,
      output,
      externalTrees: external.map((entry) => entry.path),
    };
  }
  validateExternal(grant) {
    try {
      for (const external of grant.external) {
        if (canonicalDirectory(external.path) !== external.path)
          throw new Error("external-path-changed");
        external.paths.forEach((entry, index) => {
          const stat = fs.lstatSync(entry);
          if (
            stat.isSymbolicLink() ||
            (index === 0 ? !stat.isDirectory() : !stat.isFile()) ||
            `${stat.dev}:${stat.ino}` !== external.identities[index]
          )
            throw new Error("external-path-changed");
        });
      }
    } catch {
      throw new Error("external-path-changed");
    }
  }
  revoke(grantId) {
    this.grants.delete(grantId);
  }
  async discover() {
    const probe = async (file, args) => boundedProcess(file, args).completion;
    const [docker, wsl] = await Promise.all([
      probe(this.executables.docker, ["version", "--format", "{{.Server.Os}}"]),
      this.platform === "win32"
        ? probe(this.executables.wsl, ["--list", "--quiet"])
        : Promise.resolve({ state: "unsupported-platform", stdout: "" }),
    ]);
    return {
      docker: {
        ...docker,
        available:
          docker.state === "succeeded" && docker.stdout.trim() === "linux",
      },
      wsl: {
        ...wsl,
        distributions:
          wsl.state === "succeeded"
            ? wsl.stdout
                .replace(/\0/g, "")
                .split(/\r?\n/)
                .map((x) => x.trim())
                .filter(Boolean)
            : [],
      },
    };
  }
  async probeEnvironment(request) {
    if (
      !request ||
      typeof request !== "object" ||
      Array.isArray(request) ||
      Object.keys(request).length !== 2 ||
      !Object.hasOwn(request, "grantId") ||
      !Object.hasOwn(request, "runtime")
    )
      throw new Error("invalid-environment-probe");
    const grant = this.grants.get(request.grantId);
    if (!grant) throw new Error("grant-unavailable");
    const validate = () => {
      if (this.grants.get(request.grantId) !== grant)
        throw new Error("grant-unavailable");
      for (const key of ["root", "source", "output"]) {
        const stat = fs.statSync(grant[key]);
        if (
          canonicalDirectory(grant[key]) !== grant[key] ||
          `${stat.dev}:${stat.ino}` !== grant.identities[key]
        )
          throw new Error("grant-path-changed");
      }
      this.validateExternal(grant);
    };
    validate();
    const runtime = request.runtime;
    let file, args, onTerminate;
    if (runtime?.kind === "docker") {
      if (
        !/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(
          runtime.image || "",
        ) ||
        !Number.isSafeInteger(runtime.uid) ||
        runtime.uid < 1 ||
        runtime.uid > 4294967294 ||
        !Number.isSafeInteger(runtime.gid) ||
        runtime.gid < 1 ||
        runtime.gid > 4294967294
      )
        throw new Error("invalid-container-runtime");
      const name = `material-buildroot-probe-${crypto.randomUUID()}`;
      file = this.executables.docker;
      args = [
        "run",
        "--rm",
        "--pull=never",
        "--name",
        name,
        "--user",
        `${runtime.uid}:${runtime.gid}`,
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=64",
        "--memory=256m",
        "--cpus=1",
        "--network=none",
        "--entrypoint",
        "/bin/sh",
        runtime.image,
        "-c",
        ENVIRONMENT_SCRIPT,
      ];
      onTerminate = async () => {
        const stopped = await boundedProcess(
          file,
          ["stop", "--time", "2", name],
          { timeoutMs: 5000 },
        ).completion;
        if (stopped.state !== "succeeded")
          throw new Error("container-stop-failed");
      };
    } else if (runtime?.kind === "wsl") {
      if (
        this.platform !== "win32" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(runtime.distribution || "")
      )
        throw new Error("invalid-wsl-runtime");
      file = this.executables.wsl;
      args = [
        "--distribution",
        runtime.distribution,
        "--exec",
        "timeout",
        "--signal=TERM",
        "--kill-after=1s",
        "8s",
        "/bin/sh",
        "-c",
        ENVIRONMENT_SCRIPT,
      ];
    } else if (
      runtime?.kind === "linux-fixture" &&
      this.linuxFixture &&
      this.platform !== "win32"
    ) {
      if (process.getuid() === 0) throw new Error("non-root-required");
      file = "/bin/sh";
      args = ["-c", ENVIRONMENT_SCRIPT];
    } else throw new Error("runtime-unavailable");
    const result = await boundedProcess(file, args, {
      timeoutMs: 10000,
      maxBytes: 4096,
      onTerminate,
    }).completion;
    validate();
    if (result.state !== "succeeded") {
      if (result.code === 77) throw new Error("non-root-required");
      throw new Error(`environment-probe-${result.state}`);
    }
    const lines = result.stdout.trim().split(/\r?\n/);
    if (
      lines.length !== 2 ||
      !/^[A-Za-z0-9_][A-Za-z0-9_.+-]{0,199}$/.test(lines[0]) ||
      !/^[0-9]+(?:\.[0-9]+){0,3}(?:[-+~][A-Za-z0-9.~-]+)?$/.test(lines[1])
    )
      throw new Error("invalid-environment-output");
    const targetArchitecture = lines[0].split("-")[0].toLowerCase();
    let hostArchitecture = targetArchitecture;
    if (/^i.86$/.test(targetArchitecture)) hostArchitecture = "x86";
    else if (targetArchitecture === "sun4u") hostArchitecture = "sparc64";
    else if (/^arm/.test(targetArchitecture) || targetArchitecture === "sa110")
      hostArchitecture = "arm";
    else if (targetArchitecture === "ppc64") hostArchitecture = "powerpc64";
    else if (targetArchitecture === "ppc" || targetArchitecture === "macppc")
      hostArchitecture = "powerpc";
    else if (/^sh/.test(targetArchitecture)) hostArchitecture = "sh";
    return { hostArchitecture, hostGccVersion: lines[1] };
  }
  async start(request, onLog) {
    const { grantId, target, runtime, jobs = 1 } = request || {};
    if (
      Object.keys(request || {}).some(
        (key) => !["grantId", "target", "runtime", "jobs"].includes(key),
      )
    )
      throw new Error("unknown-execution-field");
    if (
      !TARGETS.includes(target) ||
      !Number.isInteger(jobs) ||
      jobs < 1 ||
      jobs > 64
    )
      throw new Error("invalid-build-request");
    const grant = this.grants.get(grantId);
    if (!grant) throw new Error("grant-unavailable");
    for (const key of ["root", "source", "output"]) {
      const stat = fs.statSync(grant[key]);
      if (
        canonicalDirectory(grant[key]) !== grant[key] ||
        `${stat.dev}:${stat.ino}` !== grant.identities[key]
      )
        throw new Error("grant-path-changed");
    }
    this.validateExternal(grant);
    if (this.locks.has(grant.output) || this.locks.has(grant.source))
      throw new Error("project-busy");
    let file,
      args,
      cancelExtra,
      linuxPid,
      firstLine = "";
    let handshakeComplete = false;
    const receiveLog = (event) => {
      if (event.stream === "stdout" && !handshakeComplete) {
        firstLine += event.text;
        const newline = firstLine.indexOf("\n");
        if (newline >= 0) {
          handshakeComplete = true;
          const match = firstLine
            .slice(0, newline)
            .match(/^MATERIAL_BUILDROOT_PID=(\d+)\r?$/);
          if (match) linuxPid = Number(match[1]);
          firstLine = "";
        }
      }
      onLog?.(event);
    };
    if (runtime?.kind === "docker") {
      if (
        !/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(
          runtime.image || "",
        ) ||
        !Number.isSafeInteger(runtime.uid) ||
        runtime.uid < 1 ||
        runtime.uid > 4294967294 ||
        !Number.isSafeInteger(runtime.gid) ||
        runtime.gid < 1 ||
        runtime.gid > 4294967294
      )
        throw new Error("invalid-container-runtime");
      if ([grant.source, grant.output].some((x) => x.includes(",")))
        throw new Error("unsupported-mount-path");
      const name = `material-buildroot-${crypto.randomUUID()}`;
      file = this.executables.docker;
      args = [
        "run",
        "--rm",
        "--pull=never",
        "--name",
        name,
        "--user",
        `${runtime.uid}:${runtime.gid}`,
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=512",
        "--memory=4g",
        "--cpus=2",
        "--network=none",
        "--mount",
        `type=bind,src=${grant.source},dst=/source,readonly`,
        "--mount",
        `type=bind,src=${grant.output},dst=/output`,
        ...grant.external.flatMap((entry, index) => [
          "--mount",
          `type=bind,src=${entry.path},dst=/external/${index},readonly`,
        ]),
        "--workdir",
        "/source",
        "--entrypoint",
        "/bin/sh",
        runtime.image,
        "-c",
        LINUX_SCRIPT,
        "build",
        "/source",
        "/output",
        String(jobs),
        target,
        grant.external.map((_, index) => `/external/${index}`).join(":"),
      ];
      cancelExtra = async () => {
        const result = await boundedProcess(
          file,
          ["stop", "--time", "2", name],
          { timeoutMs: 5000 },
        ).completion;
        if (result.state !== "succeeded")
          throw new Error("container-stop-failed");
      };
    } else if (runtime?.kind === "wsl") {
      if (
        this.platform !== "win32" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(runtime.distribution || "")
      )
        throw new Error("invalid-wsl-runtime");
      const translate = async (value) => {
        const result = await boundedProcess(this.executables.wsl, [
          "--distribution",
          runtime.distribution,
          "--exec",
          "wslpath",
          "-a",
          "-u",
          value,
        ]).completion;
        const translated = result.stdout.trim();
        if (
          result.state !== "succeeded" ||
          !translated.startsWith("/") ||
          /[\0\r\n]/.test(translated)
        )
          throw new Error("wsl-path-translation-failed");
        return translated;
      };
      const source = await translate(grant.source),
        output = await translate(grant.output);
      const externalPaths = [];
      for (const external of grant.external)
        externalPaths.push(await translate(external.path));
      if (
        [source, output, ...externalPaths].some(
          (entry) => !/^[A-Za-z0-9_/.+-]+$/.test(entry),
        )
      )
        throw new Error("unsupported-build-path");
      file = this.executables.wsl;
      args = [
        "--distribution",
        runtime.distribution,
        "--exec",
        "setsid",
        "/bin/sh",
        "-c",
        "echo MATERIAL_BUILDROOT_PID=$$; " + LINUX_SCRIPT,
        "build",
        source,
        output,
        String(jobs),
        target,
        externalPaths.join(":"),
      ];
      cancelExtra = async () => {
        for (let attempt = 0; !linuxPid && attempt < 20; attempt++)
          await new Promise((resolve) => setTimeout(resolve, 50));
        if (!Number.isSafeInteger(linuxPid) || linuxPid < 2)
          throw new Error("wsl-process-ownership-pending");
        const result = await boundedProcess(
          file,
          [
            "--distribution",
            runtime.distribution,
            "--exec",
            "/bin/kill",
            "-TERM",
            "--",
            `-${linuxPid}`,
          ],
          { timeoutMs: 5000 },
        ).completion;
        if (result.state !== "succeeded")
          throw new Error("wsl-cancellation-failed");
        await new Promise((resolve) => setTimeout(resolve, 500));
        await boundedProcess(
          file,
          [
            "--distribution",
            runtime.distribution,
            "--exec",
            "/bin/kill",
            "-KILL",
            "--",
            `-${linuxPid}`,
          ],
          { timeoutMs: 5000 },
        ).completion;
      };
    } else if (
      runtime?.kind === "linux-fixture" &&
      this.linuxFixture &&
      this.platform !== "win32"
    ) {
      if (process.getuid() === 0) throw new Error("non-root-required");
      file = this.executables.make;
      args = [
        "-C",
        grant.source,
        `O=${grant.output}`,
        `-j${jobs}`,
        `BR2_EXTERNAL=${grant.external.map((entry) => entry.path).join(":")}`,
        target,
      ];
    } else throw new Error("runtime-unavailable");
    if (this.grants.get(grantId) !== grant)
      throw new Error("grant-unavailable");
    for (const key of ["root", "source", "output"]) {
      const stat = fs.statSync(grant[key]);
      if (
        canonicalDirectory(grant[key]) !== grant[key] ||
        `${stat.dev}:${stat.ino}` !== grant.identities[key]
      )
        throw new Error("grant-path-changed");
    }
    this.validateExternal(grant);
    if (this.locks.has(grant.output) || this.locks.has(grant.source))
      throw new Error("project-busy");
    this.locks.add(grant.output);
    this.locks.add(grant.source);
    const processJob = boundedProcess(file, args, {
      cwd: grant.root,
      timeoutMs: 24 * 60 * 60 * 1000,
      maxBytes: 16 * 1024 * 1024,
      onLog: receiveLog,
      onTerminate: cancelExtra,
    });
    return {
      completion: processJob.completion.finally(() => {
        this.locks.delete(grant.output);
        this.locks.delete(grant.source);
      }),
      cancel: async () => {
        processJob.cancel();
        return processJob.completion;
      },
    };
  }
}
module.exports = { ExecutionService, TARGETS, boundedProcess };
