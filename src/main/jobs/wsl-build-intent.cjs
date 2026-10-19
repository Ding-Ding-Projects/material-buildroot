"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { boundedProcess } = require("../execution/index.cjs");
const { verifyWslProject } = require("../execution/wsl-project.cjs");
const { DEFAULT_LIMITS } = require("./build-intent.cjs");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const HELPER = path.resolve(__dirname, "../../../scripts/configuration/capture-intent.py");
const LAUNCHER = String.raw`import os,sys,json,base64
if os.getuid()==0: sys.exit(77)
fields=open('/proc/self/stat').read().split(') ',1)[1].split()
owner=dict(bootId=open('/proc/sys/kernel/random/boot_id').read().strip(),pidNamespace=os.readlink('/proc/self/ns/pid'),pid=os.getpid(),startTime=fields[19])
print('MATERIAL_INTENT_OWNER='+json.dumps(owner),file=sys.stderr,flush=True)
raw=sys.stdin.buffer.readline(65537)
if len(raw)>65536: sys.exit(78)
data=json.loads(raw)
s=data['storage']
roots=[s['rootLinux'],s['sourceLinux'],s['outputLinux']]
proof=[owner['bootId'],open('/etc/machine-id').read().strip(),str(os.getuid())]
for root in roots:
 if os.path.realpath(root)!=root or os.stat(root).st_uid!=os.getuid(): sys.exit(78)
 info=os.stat(root);proof.append(str(info.st_dev)+':'+str(info.st_ino))
if '\n'.join(proof)!=data['proof']: sys.exit(78)
namespace={'__name__':'material_content_intent'}
exec(compile(base64.b64decode(data['helper']),'trusted-native-intent','exec'),namespace)
try: print(json.dumps(dict(ok=True,result=namespace['capture'](data['request']))),flush=True)
except namespace['Blocked'] as error: print(json.dumps(dict(ok=False,code=str(error))),flush=True)
except Exception: print(json.dumps(dict(ok=False,code='BLOCKED_CONTENT_UNAVAILABLE')),flush=True)
`;
const SIGNAL = `set -eu; test "$(id -u)" -ne 0; test "$(cat /proc/sys/kernel/random/boot_id)" = "$3"; test "$(readlink /proc/self/ns/pid)" = "$4"; test -r "/proc/$1/stat"; identity=$(awk 'sub(/^.*[)] /, "") {print $20 " " $3 " " $4}' "/proc/$1/stat"); test "$identity" = "$2 $1 $1"; exec /bin/kill -KILL -- "-$1"`;
function validateNativeIntent(result) {
  const snapshot = result?.snapshot;
  if (!result || Object.keys(result).sort().join() !== "configRevision,snapshot,sourceRevision" || ![result.sourceRevision, result.configRevision].every(value => /^[a-f0-9]{64}$/.test(value || "")) ||
      !snapshot || snapshot.version !== 3 || snapshot.excludesGitObjectHistory !== true || snapshot.symlinkPolicy !== "internal-content-and-missing-targets" || JSON.stringify(snapshot.limitations) !== "[]" ||
      !Number.isSafeInteger(snapshot.entries) || snapshot.entries < 0 || snapshot.entries > DEFAULT_LIMITS.maxEntries || !Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < 0 || snapshot.bytes > DEFAULT_LIMITS.maxBytes ||
      !Number.isSafeInteger(snapshot.symlinks) || snapshot.symlinks < 0 || snapshot.symlinks > snapshot.entries ||
      Object.keys(snapshot).sort().join() !== "bytes,downloadCache,entries,excludesGitObjectHistory,limitations,limits,symlinkPolicy,symlinks,version" ||
      !snapshot.limits || Object.keys(snapshot.limits).sort().join() !== Object.keys(DEFAULT_LIMITS).sort().join() || Object.entries(snapshot.limits).some(([key, value]) => !Number.isSafeInteger(value) || value < 1 || value > DEFAULT_LIMITS[key])) fail("BLOCKED_CONTENT_INVALID_RESPONSE");
  if (snapshot.downloadCache !== null) {
    const cache = snapshot.downloadCache;
    if (!cache || Object.keys(cache).sort().join() !== "bytes,configurationSha256,contentRevision,disposition,entries,identitySha256,maxFileBytes" || cache.disposition !== "buildroot-default-download-cache-v1" || cache.maxFileBytes !== 256 * 1024 * 1024 ||
        ![cache.configurationSha256, cache.identitySha256, cache.contentRevision].every(value => /^[a-f0-9]{64}$/.test(value || "")) || !Number.isSafeInteger(cache.entries) || cache.entries < 1 || cache.entries > snapshot.entries || !Number.isSafeInteger(cache.bytes) || cache.bytes < 0 || cache.bytes > snapshot.bytes) fail("BLOCKED_CONTENT_INVALID_RESPONSE");
  }
  return result;
}
async function captureWslBuildIntent({ execution, grantId, runtime, source, output, externalTrees = [], limits, signal, onOwnership, onCleanup }) {
  if (onOwnership !== undefined && typeof onOwnership !== "function") fail("BLOCKED_CONTENT_AUTHORITY");
  if (onCleanup !== undefined && typeof onCleanup !== "function") fail("BLOCKED_CONTENT_AUTHORITY");
  const grant = execution.grants.get(grantId), receipt = grant?.wslReceipt;
  if (!receipt || runtime?.kind !== "wsl" || runtime.distribution !== receipt.storage.distribution || externalTrees.length) fail("BLOCKED_CONTENT_AUTHORITY");
  const selectedRuntime = Object.freeze({ kind: runtime.kind, distribution: runtime.distribution });
  const storage = receipt.storage, paths = receipt.paths, proof = receipt.proof;
  const storageValues = JSON.stringify(storage), pathValues = JSON.stringify(paths);
  const grantPaths = [grant.root, grant.source, grant.output];
  const current = () => {
    if (signal?.aborted) fail("BLOCKED_CONTENT_CANCELLED");
    if (execution.grants.get(grantId) !== grant || grant.wslReceipt !== receipt || receipt.storage !== storage || receipt.paths !== paths || receipt.proof !== proof ||
        JSON.stringify(storage) !== storageValues || JSON.stringify(paths) !== pathValues || runtime.kind !== selectedRuntime.kind || runtime.distribution !== selectedRuntime.distribution ||
        grantPaths.some((value,index) => value !== [grant.root, grant.source, grant.output][index])) fail("BLOCKED_CONTENT_AUTHORITY");
  };
  function translate(selected) {
    for (const [native, linux] of [[receipt.paths.source, receipt.storage.sourceLinux], [receipt.paths.output, receipt.storage.outputLinux]]) {
      const relative = path.relative(native, selected);
      if (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep)) return linux + (relative ? "/" + relative.replaceAll("\\", "/") : "");
    }
    fail("BLOCKED_CONTENT_AUTHORITY");
  }
  const request = { source: translate(source), output: translate(output), externalTrees: [], ...(limits ? { limits } : {}) };
  const verify = async () => {
    current();
    await verifyWslProject(receipt, args => boundedProcess(execution.executables.wsl, args).completion, selectedRuntime);
    current();
  };
  await verify();
  const helper = fs.readFileSync(HELPER).toString("base64");
  const ownerToken = crypto.randomUUID();
  const input = JSON.stringify({ request, helper, storage, proof }) + "\n";
  if (Buffer.byteLength(input) > 65536) fail("BLOCKED_CONTENT_LIMIT");
  let job, owner, handshake, line = "", handshakeError;
  const terminate = async () => {
    if (!owner) fail("BLOCKED_CONTENT_CLEANUP_UNVERIFIED");
    const current = await execution.reconcileCleanup(owner);
    if (current.state === "verified-stopped") return;
    if (current.reason !== "owned-runtime-active") fail("BLOCKED_CONTENT_CLEANUP_UNVERIFIED");
    const stopped = await boundedProcess(execution.executables.wsl, ["--distribution", storage.distribution, "--exec", "/bin/sh", "-c", SIGNAL, "signal", String(owner.pid), owner.startTime, owner.bootId, owner.pidNamespace], { timeoutMs: 5000 }).completion;
    if (stopped.state !== "succeeded") fail("BLOCKED_CONTENT_CLEANUP_UNVERIFIED");
  };
  job = boundedProcess(execution.executables.wsl, ["--distribution", storage.distribution, "--exec", "setsid", "--wait", "python3", "-I", "-B", "-c", LAUNCHER], {
    inputPipe: true, timeoutMs: 14000, maxBytes: 32768, onTerminate: terminate,
    onLog(event) {
      if (event.stream !== "stderr" || handshake) return;
      line += event.text;
      if (!line.includes("\n")) return;
      handshake = (async () => {
        try {
          const match = line.split("\n")[0].match(/^MATERIAL_INTENT_OWNER=(.+)$/);
          if (!match) fail("BLOCKED_CONTENT_AUTHORITY");
          owner = execution.validateOwnershipReceipt({ version: 1, kind: "wsl", ownerToken, distribution: storage.distribution, ...JSON.parse(match[1]) });
          await verify();
          if (onOwnership) { await onOwnership(owner); await verify(); }
          current();
          if (!job.writeInput(input)) fail("BLOCKED_CONTENT_CANCELLED");
        } catch (error) { handshakeError = error; job.cancel(); }
      })();
    },
  });
  const cancel = () => job.cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    const result = await job.completion;
    await handshake;
    const cleanup = owner ? await execution.reconcileCleanup(owner) : null;
    if (owner && onCleanup) await onCleanup(owner, cleanup || { state: "unknown", reason: "runtime-unavailable" });
    if (cleanup?.state !== "verified-stopped") fail("BLOCKED_CONTENT_CLEANUP_UNVERIFIED");
    if (handshakeError) throw handshakeError;
    await verify();
    if (result.state !== "succeeded") fail(result.state === "cancelled" ? "BLOCKED_CONTENT_CANCELLED" : result.state === "timed-out" ? "BLOCKED_CONTENT_LIMIT" : "BLOCKED_CONTENT_UNAVAILABLE");
    let response; try { response = JSON.parse(result.stdout); } catch { fail("BLOCKED_CONTENT_INVALID_RESPONSE"); }
    if (response.ok !== true) fail(/^BLOCKED_[A-Z_]+$/.test(response.code || "") ? response.code : "BLOCKED_CONTENT_INVALID_RESPONSE");
    current();
    return validateNativeIntent(response.result);
  } finally { signal?.removeEventListener("abort", cancel); }
}
module.exports = { captureWslBuildIntent, validateNativeIntent };
