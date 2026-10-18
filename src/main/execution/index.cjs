"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { createDockerRuntime } = require("./docker-runtime.cjs");
const { isWslReceipt, verifyWslProject, wrapBuild } = require("./wsl-project.cjs");
const { isBuildTarget, assertPackage } = require("../build/target-actions.cjs");
const { LINUX_BUILD_PATH_SCRIPT } = require("./linux-build-path.cjs");
const TARGETS = Object.freeze([
  "all",
  "sdk",
  "clean",
  "olddefconfig",
  "linux-olddefconfig",
  "busybox-oldconfig",
  "uboot-olddefconfig",
  "material-config-domains",
  "savedefconfig",
  "material-save-defconfig",
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
    inputPipe = false,
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
        stdio: [inputPipe ? "pipe" : "ignore", "pipe", "pipe"],
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
    child.stdin?.on("error", () => {});
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
    writeInput(value) {
      if (!inputPipe || !child?.stdin?.writable || child.stdin.destroyed || settled || reason || cleanupPromise) return false;
      child.stdin.end(value); return true;
    },
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
  LINUX_BUILD_PATH_SCRIPT +
  'set -eu; test "$(id -u)" -ne 0 || { echo non-root-required >&2; exit 77; }; if [ "$4" = material-config-domains ]; then printf "MATERIAL_CONFIG_OUTPUT=%s\n" "$2"; exec make -s --no-print-directory -C "$1" "O=$2" "BR2_EXTERNAL=$5" printvars "VARS=LINUX_DIR BUSYBOX_DIR UBOOT_DIR"; fi; if [ "$4" = material-save-defconfig ]; then test ! -e "$2/material-minimal-defconfig" && test ! -L "$2/material-minimal-defconfig" || exit 78; exec make -C "$1" "O=$2" "-j$3" "BR2_EXTERNAL=$5" "BR2_DEFCONFIG=$2/material-minimal-defconfig" savedefconfig; fi; case "$4" in linux-olddefconfig) set -- "$@" "LINUX_KCONFIG_EDITORS=olddefconfig" ;; uboot-olddefconfig) set -- "$@" "UBOOT_KCONFIG_EDITORS=olddefconfig" ;; busybox-oldconfig) yes "" | make -C "$1" "O=$2" "-j$3" "BR2_EXTERNAL=$5" "BUSYBOX_KCONFIG_EDITORS=oldconfig" "$4"; exit $? ;; *) set -- "$@" "MATERIAL_CONFIG_UNUSED=1" ;; esac; exec make -C "$1" "O=$2" "-j$3" "BR2_EXTERNAL=$5" "${7:-$6}" "$4"';
const ENVIRONMENT_SCRIPT =
  'set -eu; test "$(id -u)" -ne 0 || { echo non-root-required >&2; exit 77; }; gcc -dumpmachine; gcc -dumpfullversion -dumpversion';
const RESOURCE_SCRIPT = `set -eu
 test "$(id -u)" -ne 0 || exit 77
 cpu=unknown; memory=unknown
 group=$(awk -F: '$1 == "0" {print $3}' /proc/self/cgroup)
 case "$group" in /*) ;; *) group=unknown ;; esac
 case "$group" in *..*) group=unknown ;; esac
 if test "$group" != unknown && test -d "/sys/fs/cgroup$group"; then
   cpu=$(awk '/^Cpus_allowed_list:/ {n=split($2,a,","); c=0; for(i=1;i<=n;i++){m=split(a[i],b,"-");c+=m==2?b[2]-b[1]+1:1} print c}' /proc/self/status)
   memory=$(awk '/^MemAvailable:/ {printf "%.0f", $2*1024}' /proc/meminfo)
   node="/sys/fs/cgroup$group"
   test "$group" = / && node=/sys/fs/cgroup
   if test "$2" = docker-owned-probe; then
     # Exclude only the probe container's verified artificial leaf limits.
     # Every real parent remains included below; an unresolved leaf fails closed.
     if test "$node" = /sys/fs/cgroup || ! test -r "$node/cpu.max" || ! test -r "$node/memory.max"; then
       cpu=unknown; memory=unknown
     else
       read own_quota own_period < "$node/cpu.max"
       own_memory=$(cat "$node/memory.max")
       if test "$own_quota" = max || test "$own_quota" -ne "$((own_period * 2))" || test "$own_memory" != 4294967296; then
         cpu=unknown; memory=unknown
       else
         node=$(dirname "$node")
       fi
     fi
   fi
   while test "$cpu" != unknown && test "$memory" != unknown; do
     # The actual cgroup-v2 hierarchy root is exempt from controller limits.
     if test "$node" = /sys/fs/cgroup && test -r "$node/cgroup.controllers" && ! test -e "$node/cpu.max" && ! test -e "$node/memory.max"; then break; fi
     if ! test -r "$node/cpu.max" || ! test -r "$node/memory.max" || ! test -r "$node/memory.current"; then cpu=unknown; memory=unknown; break; fi
     read quota period < "$node/cpu.max"
     if test "$quota" != max; then capacity=$((quota / period)); if test "$capacity" -lt "$cpu"; then cpu=$capacity; fi; fi
     maximum=$(cat "$node/memory.max")
     if test "$maximum" != max; then current=$(cat "$node/memory.current"); remaining=$((maximum - current)); if test "$remaining" -lt 0; then remaining=0; fi; if test "$remaining" -lt "$memory"; then memory=$remaining; fi; fi
     test "$node" = /sys/fs/cgroup && break
     node=$(dirname "$node")
   done
 fi
 storage=$(df -Pk "$1" | awk 'NR==2 {printf "%.0f", $4*1024}')
 printf '%s\n%s\n%s\n' "$cpu" "$memory" "$storage"
`;
const OWN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validateOwnershipReceipt(receipt) {
  const fields = receipt?.kind === "docker" ? ["version", "kind", "ownerToken", "containerName", "daemonId"] : ["version", "kind", "ownerToken", "distribution", "bootId", "pidNamespace", "pid", "startTime"];
  if (!receipt || Object.getPrototypeOf(receipt) !== Object.prototype || Object.keys(receipt).length !== fields.length || fields.some(key => !Object.hasOwn(receipt, key)) || receipt.version !== 1 || typeof receipt.ownerToken !== "string" || !OWN_UUID.test(receipt.ownerToken)) throw new Error("invalid-ownership-receipt");
  if (receipt.kind === "docker") {
    if (receipt.containerName !== `material-buildroot-${receipt.ownerToken}` || typeof receipt.daemonId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(receipt.daemonId)) throw new Error("invalid-ownership-receipt");
  } else if (receipt.kind === "wsl") {
    if (typeof receipt.distribution !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(receipt.distribution) || typeof receipt.bootId !== "string" || !OWN_UUID.test(receipt.bootId) || typeof receipt.pidNamespace !== "string" || !/^pid:\[[0-9]{1,24}\]$/.test(receipt.pidNamespace) || !((receipt.pid === null && receipt.startTime === null) || (Number.isSafeInteger(receipt.pid) && receipt.pid >= 2 && typeof receipt.startTime === "string" && /^[0-9]{1,24}$/.test(receipt.startTime)))) throw new Error("invalid-ownership-receipt");
  } else throw new Error("invalid-ownership-receipt");
  return Object.freeze({ ...receipt });
}
async function checkpointOwnership(callback, receipt) {
  if (!callback) return;
  let timer;
  try { await Promise.race([Promise.resolve().then(() => callback(receipt)), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("ownership-checkpoint-failed")), 10000); })]); }
  catch { throw new Error("ownership-checkpoint-failed"); }
  finally { clearTimeout(timer); }
}
const WSL_IDENTITY_SCRIPT = 'set -eu; test "$(id -u)" -ne 0 || exit 77; cat /proc/sys/kernel/random/boot_id; readlink /proc/self/ns/pid';
const WSL_SIGNAL_SCRIPT = `set -eu
 test "$(id -u)" -ne 0 || exit 77
 test "$(cat /proc/sys/kernel/random/boot_id)" = "$3" || exit 78
 test "$(readlink /proc/self/ns/pid)" = "$5" || exit 78
 test -r "/proc/$1/stat" || exit 78
 identity=$(awk 'sub(/^.*[)] /, "") {print $20 " " $3 " " $4}' "/proc/$1/stat")
 test "$identity" = "$2 $1 $1" || exit 78
 case "$4" in TERM|KILL) ;; *) exit 78 ;; esac
 exec /bin/kill "-$4" -- "-$1"
`;
const WSL_RECONCILE_SCRIPT = `set -eu
 test "$(id -u)" -ne 0 || exit 77
 cat /proc/sys/kernel/random/boot_id
 readlink /proc/self/ns/pid
 awk '$2 == "/proc" && $3 == "proc" {seen=1; if ($4 ~ /(^|,)hidepid=/ && $4 !~ /(^|,)hidepid=0(,|$)/) bad=1} END {exit !seen || bad}' /proc/mounts || exit 78
 if test -e "/proc/$1"; then
   test -r "/proc/$1/stat" || exit 78
   awk 'sub(/^.*[)] /, "") {print $20 " " $3 " " $4}' "/proc/$1/stat"
 else printf 'absent\n'; fi
 for entry in /proc/[0-9]*/stat; do
   if test -r "$entry"; then awk -v owned="$1" 'sub(/^.*[)] /, "") && ($3 == owned || $4 == owned) {print "member"}' "$entry"
   elif test -e "$entry"; then exit 78; fi
 done
`;
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
    this.dockerRuntime = createDockerRuntime({ run: (args) => boundedProcess(this.executables.docker, args, { timeoutMs: 10000, maxBytes: 262144 }).completion, identity: () => this.dockerIdentity() });
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
    wslReceipt,
  }) {
    if (trustedSource !== true)
      throw new Error("source-execution-consent-required");
    if (wslReceipt && (!isWslReceipt(wslReceipt) || wslReceipt.paths.root !== root || wslReceipt.paths.source !== source || wslReceipt.paths.output !== output || externalTrees.length)) throw new Error("wsl-project-authority-required");
    if (!wslReceipt && [root, source, output].some(value => typeof value === "string" && value.startsWith("\\\\"))) throw new Error("unsupported-build-path");
    root = canonicalDirectory(root);
    source = canonicalDirectory(source);
    output = canonicalDirectory(output);
    if (
      !wslReceipt && (!/^[A-Za-z0-9_:/\\.+-]+$/.test(source) ||
      !/^[A-Za-z0-9_:/\\.+-]+$/.test(output))
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
      wslReceipt,
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
  async grantWslProject(receipt) {
    await verifyWslProject(receipt, args => boundedProcess(this.executables.wsl, args).completion);
    return this.grantProject({ ...receipt.paths, trustedSource: true, wslReceipt: receipt });
  }
  async verifyWslGrant(grant, runtime) {
    if (grant.wslReceipt) await verifyWslProject(grant.wslReceipt, args => boundedProcess(this.executables.wsl, args).completion, runtime);
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
      this.dockerRuntime.discover(),
      this.platform === "win32"
        ? probe(this.executables.wsl, ["--list", "--quiet"])
        : Promise.resolve({ state: "unsupported-platform", stdout: "" }),
    ]);
    return {
      docker,
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
  async prepareDocker({ grantId, runtime }) {
    const grant = this.grants.get(grantId);
    if (!grant) throw new Error("grant-unavailable");
    await this.verifyWslGrant(grant, runtime);
    return this.dockerRuntime.prepare(grant, runtime);
  }
  validateOwnershipReceipt(receipt) { return validateOwnershipReceipt(receipt); }
  async stopOwnedDocker(receipt) {
    const owned = await this.ownedDocker(receipt);
    if (owned.state === "verified-stopped" || (owned.state === "owned" && owned.stopped)) return;
    if (owned.state !== "owned" || await this.dockerIdentity() !== receipt.daemonId) throw new Error("container-ownership-unverified");
    const result = await boundedProcess(this.executables.docker, ["stop", "--time", "2", owned.containerId], { timeoutMs: 5000 }).completion;
    if (result.state !== "succeeded") throw new Error("container-stop-failed");
  }
  async dockerIdentity() {
    const result = await boundedProcess(this.executables.docker, ["info", "--format", "{{json .ID}}"], { timeoutMs: 10000, maxBytes: 1024 }).completion;
    if (result.state !== "succeeded") throw new Error("runtime-identity-unavailable");
    let identity; try { identity = JSON.parse(result.stdout); } catch { throw new Error("runtime-identity-unavailable"); }
    if (typeof identity !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(identity)) throw new Error("runtime-identity-unavailable");
    return identity;
  }
  async ownedDocker(receipt) {
    if (await this.dockerIdentity() !== receipt.daemonId) return { state: "unknown", reason: "runtime-namespace-changed" };
    const listed = await boundedProcess(this.executables.docker, ["ps", "--all", "--no-trunc", "--filter", `label=io.material-buildroot.operation=${receipt.ownerToken}`, "--format", "{{.ID}}"], { maxBytes: 4096 }).completion;
    if (listed.state !== "succeeded") return { state: "unknown", reason: "runtime-unavailable" };
    const ids = listed.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (!ids.length) {
      const named = await boundedProcess(this.executables.docker, ["ps", "--all", "--no-trunc", "--filter", `name=^/${receipt.containerName}$`, "--format", "{{.ID}}"], { maxBytes: 4096 }).completion;
      if (named.state !== "succeeded") return { state: "unknown", reason: "runtime-unavailable" };
      return named.stdout.trim() ? { state: "unknown", reason: "runtime-identity-reused" } : { state: "verified-stopped", reason: "owned-container-absent" };
    }
    if (ids.length !== 1 || !/^[a-f0-9]{64}$/.test(ids[0])) return { state: "unknown", reason: "runtime-identity-ambiguous" };
    const inspected = await boundedProcess(this.executables.docker, ["inspect", "--type", "container", ids[0]], { maxBytes: 65536 }).completion;
    if (inspected.state !== "succeeded") return { state: "unknown", reason: "runtime-unavailable" };
    let container; try { const parsed = JSON.parse(inspected.stdout); if (!Array.isArray(parsed) || parsed.length !== 1) throw Error(); container = parsed[0]; } catch { return { state: "unknown", reason: "runtime-identity-ambiguous" }; }
    if (container.Id !== ids[0] || container.Name !== `/${receipt.containerName}` || container.Config?.Labels?.["io.material-buildroot.operation"] !== receipt.ownerToken) return { state: "unknown", reason: "runtime-identity-reused" };
    return { state: "owned", containerId: ids[0], stopped: container.State?.Running === false && container.State?.Restarting === false && container.State?.Pid === 0 && ["created", "exited", "dead"].includes(container.State?.Status) };
  }
  async reconcileCleanup(value) {
    let receipt; try { receipt = validateOwnershipReceipt(value); } catch { return { state: "unknown", reason: "invalid-ownership-receipt" }; }
    try {
      if (receipt.kind === "docker") {
        const state = await this.ownedDocker(receipt);
        if (await this.dockerIdentity() !== receipt.daemonId) return { state: "unknown", reason: "runtime-namespace-changed" };
        if (state.state !== "owned") return state;
        return state.stopped ? { state: "verified-stopped", reason: "owned-container-stopped" } : { state: "unknown", reason: "owned-runtime-active" };
      }
      if (this.platform !== "win32" || receipt.pid === null) return { state: "unknown", reason: "precise-ownership-unavailable" };
      const result = await boundedProcess(this.executables.wsl, ["--distribution", receipt.distribution, "--exec", "timeout", "--signal=TERM", "--kill-after=1s", "8s", "/bin/sh", "-c", WSL_RECONCILE_SCRIPT, "reconcile", String(receipt.pid)], { timeoutMs: 10000, maxBytes: 4096 }).completion;
      if (result.state !== "succeeded") return { state: "unknown", reason: "runtime-unavailable" };
      const lines = result.stdout.trim().split(/\r?\n/);
      if (lines[0] !== receipt.bootId || lines[1] !== receipt.pidNamespace) return { state: "unknown", reason: "runtime-namespace-changed" };
      if (lines[2] === "absent" && lines.length === 3) return { state: "verified-stopped", reason: "owned-session-absent" };
      if (!/^[0-9]+ [0-9]+ [0-9]+$/.test(lines[2] || "")) return { state: "unknown", reason: "runtime-identity-ambiguous" };
      const [start, group, session] = lines[2].split(" ");
      if (start !== receipt.startTime || group !== String(receipt.pid) || session !== String(receipt.pid)) return { state: "unknown", reason: "runtime-identity-reused" };
      return { state: "unknown", reason: "owned-runtime-active" };
    } catch { return { state: "unknown", reason: "runtime-unavailable" }; }
  }
  async probeResources(request) {
    if (!request || typeof request !== "object" || Array.isArray(request) || Object.keys(request).length !== 2 || !Object.hasOwn(request, "grantId") || !Object.hasOwn(request, "runtime")) throw new Error("invalid-resource-probe");
    const grant = this.grants.get(request.grantId); if (!grant) throw new Error("grant-unavailable");
    await this.verifyWslGrant(grant, request.runtime);
    const validate = () => {
      if (this.grants.get(request.grantId) !== grant) throw new Error("grant-unavailable");
      for (const key of ["root", "source", "output"]) {
        const stat = fs.statSync(grant[key]);
        if (canonicalDirectory(grant[key]) !== grant[key] || `${stat.dev}:${stat.ino}` !== grant.identities[key]) throw new Error("grant-path-changed");
      }
      this.validateExternal(grant);
    };
    validate(); const runtime = request.runtime; let file, args, onTerminate;
    if (runtime?.kind === "docker") {
      if (!/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(runtime.image || "") || !Number.isSafeInteger(runtime.uid) || runtime.uid < 1 || runtime.uid > 4294967294 || !Number.isSafeInteger(runtime.gid) || runtime.gid < 1 || runtime.gid > 4294967294) throw new Error("invalid-container-runtime");
      const ownerToken = crypto.randomUUID();
      const name = `material-buildroot-${ownerToken}`; file = this.executables.docker;
      const receipt = validateOwnershipReceipt({ version: 1, kind: "docker", ownerToken, containerName: name, daemonId: await this.dockerIdentity() });
      args = ["run", "--rm", "--pull=never", "--name", name, "--label", `io.material-buildroot.operation=${ownerToken}`, "--user", `${runtime.uid}:${runtime.gid}`, "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=64", "--memory=4g", "--cpus=2", "--cgroupns=host", "--network=none", "--mount", `type=bind,src=${grant.output},dst=/output,readonly`, "--entrypoint", "/bin/sh", runtime.image, "-c", RESOURCE_SCRIPT, "resources", "/output", "docker-owned-probe"];
      onTerminate = () => this.stopOwnedDocker(receipt);
    } else if (runtime?.kind === "wsl") {
      if (this.platform !== "win32" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(runtime.distribution || "")) throw new Error("invalid-wsl-runtime");
      file = this.executables.wsl;
      const translated = grant.wslReceipt ? {state:"succeeded",stdout:grant.wslReceipt.storage.outputLinux} : await boundedProcess(file, ["--distribution", runtime.distribution, "--exec", "wslpath", "-a", "-u", grant.output]).completion;
      const output = translated.stdout.trim(); if (translated.state !== "succeeded" || !/^\/[A-Za-z0-9_/.+-]+$/.test(output)) throw new Error("wsl-path-translation-failed");
      validate(); args = ["--distribution", runtime.distribution, "--exec", "timeout", "--signal=TERM", "--kill-after=1s", "8s", "/bin/sh", "-c", RESOURCE_SCRIPT, "resources", output, "runtime"];
    } else if (runtime?.kind === "linux-fixture" && this.linuxFixture && this.platform !== "win32") {
      if (process.getuid() === 0) throw new Error("non-root-required"); file = "/bin/sh"; args = ["-c", RESOURCE_SCRIPT, "resources", grant.output, "runtime"];
    } else throw new Error("runtime-unavailable");
    const result = await boundedProcess(file, args, { timeoutMs: 10000, maxBytes: 4096, onTerminate }).completion; validate();
    if (result.state !== "succeeded") { if (result.code === 77) throw new Error("non-root-required"); throw new Error(`resource-probe-${result.state}`); }
    const lines = result.stdout.trim().split(/\r?\n/); if (lines.length !== 3) throw new Error("invalid-resource-output");
    const values = lines.map(value => { if (value === "unknown") return null; if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("invalid-resource-output"); return Number(value); });
    return { cpuSlots: values[0], memoryAvailableBytes: values[1], storageAvailableBytes: values[2], observedAt: new Date().toISOString(), constraintModel: values[0] === null || values[1] === null ? "unknown" : "cgroup-v2-and-affinity" };
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
    await this.verifyWslGrant(grant, request?.runtime);
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
      const ownerToken = crypto.randomUUID();
      const name = `material-buildroot-${ownerToken}`;
      const receipt = validateOwnershipReceipt({ version: 1, kind: "docker", ownerToken, containerName: name, daemonId: await this.dockerIdentity() });
      file = this.executables.docker;
      args = [
        "run",
        "--rm",
        "--pull=never",
        "--name",
        name,
        "--label",
        `io.material-buildroot.operation=${ownerToken}`,
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
      onTerminate = () => this.stopOwnedDocker(receipt);
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
  async start(request, onLog, options = {}) {
    const effect = { started: false };
    try { return await this.#startOwned(request, onLog, options, effect); }
    catch (error) {
      if (!effect.started && error.message !== "ownership-checkpoint-failed") error.code = "RUNTIME_NOT_STARTED";
      throw error;
    }
  }
  async #startOwned(request, onLog, { onOwnership, signal } = {}, effect) {
    if (onOwnership !== undefined && typeof onOwnership !== "function") throw new Error("invalid-ownership-checkpoint");
    if (signal !== undefined && (!signal || typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) throw new Error("invalid-cancellation-signal");
    const { grantId, target, runtime, jobs = 1 } = request || {};
    if (
      Object.keys(request || {}).some(
        (key) => !["grantId", "target", "runtime", "jobs"].includes(key),
      )
    )
      throw new Error("unknown-execution-field");
    if (
      !isBuildTarget(target, TARGETS) ||
      !Number.isInteger(jobs) ||
      jobs < 1 ||
      jobs > 64
    )
      throw new Error("invalid-build-request");
    const grant = this.grants.get(grantId);
    if (!grant) throw new Error("grant-unavailable");
    assertPackage({source:grant.source,externalTrees:grant.external.map(entry => entry.path)}, target);
    await this.verifyWslGrant(grant, request?.runtime);
    const revalidateAuthority = () => {
      if (signal?.aborted) throw new Error("execution-cancelled");
      if (this.grants.get(grantId) !== grant) throw new Error("grant-unavailable");
      for (const key of ["root", "source", "output"]) {
        const stat = fs.statSync(grant[key]);
        if (canonicalDirectory(grant[key]) !== grant[key] || `${stat.dev}:${stat.ino}` !== grant.identities[key]) throw new Error("grant-path-changed");
      }
      this.validateExternal(grant);
    };
    revalidateAuthority();
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
      ownership = null,
      checkpoint = Promise.resolve(),
      checkpointFailed = false,
      processJob,
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
            .match(/^MATERIAL_BUILDROOT_PID=(\d+) START=([0-9]+)\r?$/);
          if (match && ownership?.kind === "wsl") {
            linuxPid = Number(match[1]);
            ownership = validateOwnershipReceipt({ ...ownership, pid: linuxPid, startTime: match[2] });
            checkpoint = Promise.resolve().then(() => checkpointOwnership(onOwnership, ownership)).then(() => {
              revalidateAuthority();
              if (!processJob.writeInput(ownership.ownerToken + "\n")) throw new Error("execution-cancelled");
            }).catch(error => { checkpointFailed = error.message === "ownership-checkpoint-failed"; processJob.cancel(); });
          }
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
      const cache = await this.dockerRuntime.requireCache(grant, runtime);
      revalidateAuthority();
      const ownerToken = crypto.randomUUID();
      const name = `material-buildroot-${ownerToken}`;
      ownership = validateOwnershipReceipt({ version: 1, kind: "docker", ownerToken, containerName: name, daemonId: await this.dockerIdentity() });
      await checkpointOwnership(onOwnership, ownership);
      file = this.executables.docker;
      args = [
        "run",
        "--rm",
        "--pull=never",
        "--name",
        name,
        "--label",
        `io.material-buildroot.operation=${ownership.ownerToken}`,
        "--read-only",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,size=256m",
        "--mount",
        `type=volume,src=${cache.name},dst=/material-buildroot-cache`,
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
        'set -eu; test "$(id -u)" -ne 0 || { echo non-root-required >&2; exit 77; }; test -w /material-buildroot-cache && test -w /output || { echo container-storage-permission-denied >&2; exit 77; }; if [ "$4" = material-save-defconfig ]; then test ! -e "$2/material-minimal-defconfig" && test ! -L "$2/material-minimal-defconfig" || exit 78; exec make -C "$1" "O=$2" "-j$3" "BR2_EXTERNAL=$5" "DL_DIR=/material-buildroot-cache" "BR2_DEFCONFIG=$2/material-minimal-defconfig" savedefconfig; fi; exec make -C "$1" "O=$2" "-j$3" "BR2_EXTERNAL=$5" "DL_DIR=/material-buildroot-cache" "$4"',
        "build",
        "/source",
        "/output",
        String(jobs),
        target,
        grant.external.map((_, index) => `/external/${index}`).join(":"),
      ];
      cancelExtra = async () => {
        const owned = await this.ownedDocker(ownership);
        if (owned.state === "verified-stopped") return;
        if (owned.state !== "owned") throw new Error("container-ownership-unverified");
        if (await this.dockerIdentity() !== ownership.daemonId) throw new Error("runtime-namespace-changed");
        const result = await boundedProcess(
          file,
          ["stop", "--time", "2", owned.containerId],
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
        if (grant.wslReceipt) {
          const key = Object.keys(grant.wslReceipt.paths).find(key => grant.wslReceipt.paths[key] === value);
          if (!key) throw new Error("wsl-project-authority-required");
          return grant.wslReceipt.storage[`${key}Linux`];
        }
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
      const identity = await boundedProcess(this.executables.wsl, ["--distribution", runtime.distribution, "--exec", "/bin/sh", "-c", WSL_IDENTITY_SCRIPT], { maxBytes: 1024 }).completion;
      const identityParts = identity.stdout.trim().split(/\r?\n/);
      if (identity.state !== "succeeded" || identityParts.length !== 2 || !OWN_UUID.test(identityParts[0]) || !/^pid:\[[0-9]{1,24}\]$/.test(identityParts[1])) throw new Error("runtime-identity-unavailable");
      ownership = validateOwnershipReceipt({ version: 1, kind: "wsl", ownerToken: crypto.randomUUID(), distribution: runtime.distribution, bootId: identityParts[0], pidNamespace: identityParts[1], pid: null, startTime: null });
      await checkpointOwnership(onOwnership, ownership);
      file = this.executables.wsl;
      args = [
        "--distribution",
        runtime.distribution,
        "--exec",
        "setsid",
        "--wait",
        "/bin/sh",
        "-c",
        (grant.wslReceipt ? wrapBuild : script => script)('echo MATERIAL_BUILDROOT_PID=$$ START=$(awk \'sub(/^.*[)] /, "") {print $20}\' /proc/$$/stat); read -r authorization; test "$authorization" = "$6" || exit 79; ' + LINUX_SCRIPT),
        "build",
        ...(grant.wslReceipt ? [grant.wslReceipt.storage.rootLinux, grant.wslReceipt.proof] : []),
        source,
        output,
        String(jobs),
        target,
        externalPaths.join(":"),
        ownership.ownerToken,
      ];
      cancelExtra = async () => {
        for (let attempt = 0; !linuxPid && attempt < 20; attempt++)
          await new Promise((resolve) => setTimeout(resolve, 50));
        if (!Number.isSafeInteger(linuxPid) || linuxPid < 2)
          throw new Error("wsl-process-ownership-pending");
        const verified = await this.reconcileCleanup(ownership);
        if (verified.state === "verified-stopped") return;
        if (verified.reason !== "owned-runtime-active") throw new Error("wsl-process-ownership-unverified");
        const result = await boundedProcess(
          file,
          [
            "--distribution",
            runtime.distribution,
            "--exec",
            "/bin/sh", "-c", WSL_SIGNAL_SCRIPT, "signal", String(linuxPid), ownership.startTime, ownership.bootId, "TERM", ownership.pidNamespace,
          ],
          { timeoutMs: 5000 },
        ).completion;
        if (result.state !== "succeeded")
          throw new Error("wsl-cancellation-failed");
        await new Promise((resolve) => setTimeout(resolve, 500));
        const stillOwned = await this.reconcileCleanup(ownership);
        if (stillOwned.state === "verified-stopped") return;
        if (stillOwned.reason !== "owned-runtime-active") throw new Error("wsl-process-ownership-unverified");
        await boundedProcess(
          file,
          [
            "--distribution",
            runtime.distribution,
            "--exec",
            "/bin/sh", "-c", WSL_SIGNAL_SCRIPT, "signal", String(linuxPid), ownership.startTime, ownership.bootId, "KILL", ownership.pidNamespace,
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
    revalidateAuthority();
    this.locks.add(grant.output);
    this.locks.add(grant.source);
    effect.started = true;
    processJob = boundedProcess(file, args, {
      cwd: grant.root,
      timeoutMs: 24 * 60 * 60 * 1000,
      maxBytes: 16 * 1024 * 1024,
      onLog: receiveLog,
      onTerminate: cancelExtra,
      inputPipe: ownership?.kind === "wsl",
    });
    const abortProcess = () => processJob.cancel();
    signal?.addEventListener("abort", abortProcess, { once: true });
    if (signal?.aborted) abortProcess();
    const handshakeTimer = ownership?.kind === "wsl" ? setTimeout(() => { if (!linuxPid) processJob.cancel(); }, 10000) : null;
    const completion = processJob.completion.then(async result => {
      clearTimeout(handshakeTimer);
      signal?.removeEventListener("abort", abortProcess);
      await checkpoint;
      if (!ownership) return result;
      const cleanup = checkpointFailed ? { state: "unknown", reason: "ownership-checkpoint-failed" } : await this.reconcileCleanup(ownership);
      return { ...result, ...(cleanup.state === "unknown" ? { processState: result.state, state: "runtime-cleanup-failed" } : {}), ownership, cleanup };
    });
    return {
      ownership,
      completion: completion.finally(() => {
        this.locks.delete(grant.output);
        this.locks.delete(grant.source);
      }),
      cancel: async () => {
        processJob.cancel();
        return completion;
      },
    };
  }
}
module.exports = { ExecutionService, TARGETS, boundedProcess, validateOwnershipReceipt };






