"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { isWslReceipt, verifyWslProject } = require("./wsl-project.cjs");
const HELPER = path.resolve(__dirname, "../../../scripts/configuration/iso_output_lifecycle.py");
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA = /^[a-f0-9]{64}$/;
const fail = code => { throw Object.assign(Error(code), { code }); };
function exact(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length ||
      Reflect.ownKeys(value).some(key => !keys.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"))) fail("ISO_LIFECYCLE_INVALID_REQUEST");
}
const LAUNCHER = String.raw`import os,sys,json,base64
if os.getuid()==0: sys.exit(77)
fields=open('/proc/self/stat').read().split(') ',1)[1].split()
owner=dict(bootId=open('/proc/sys/kernel/random/boot_id').read().strip(),pidNamespace=os.readlink('/proc/self/ns/pid'),pid=os.getpid(),startTime=fields[19])
print('MATERIAL_ISO_OWNER='+json.dumps(owner),file=sys.stderr,flush=True)
raw=sys.stdin.buffer.readline(65537)
if len(raw)>65536: sys.exit(78)
data=json.loads(raw);s=data['storage']
proof=[owner['bootId'],open('/etc/machine-id').read().strip(),str(os.getuid())]
for root in [s['rootLinux'],s['sourceLinux'],s['outputLinux']]:
 if os.path.realpath(root)!=root or os.stat(root).st_uid!=os.getuid(): sys.exit(78)
 info=os.stat(root);proof.append(str(info.st_dev)+':'+str(info.st_ino))
if '\n'.join(proof)!=data['proof'] or owner['pidNamespace']!=data['pidNamespace']: sys.exit(78)
namespace={'__name__':'material_iso_lifecycle'}
exec(compile(base64.b64decode(data['helper']),'trusted-iso-lifecycle','exec'),namespace)
try: print(json.dumps(dict(ok=True,result=namespace['run'](data['request']))),flush=True)
except Exception: print(json.dumps(dict(ok=False,code='ISO_LIFECYCLE_UNVERIFIED')),flush=True);sys.exit(78)
`;
function observation(value, request) {
  const decimal = item => typeof item === "string" && /^(?:0|[1-9][0-9]{0,19})$/.test(item);
  const file = (item, structured) => {
    exact(item, ["sha256", "bytes", "identity", ...(structured ? ["structure"] : [])]);
    if (typeof item.sha256 !== "string" || !SHA.test(item.sha256) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > 4 * 1024 ** 3 || !Array.isArray(item.identity) || item.identity.length !== 9 || !item.identity.every(decimal)) fail("ISO_LIFECYCLE_INVALID_RESPONSE");
    if (structured) { exact(item.structure, ["descriptorValid", "withinImage", "biosCatalogValid", "bootVerified"]); if (item.structure.descriptorValid !== true || item.structure.withinImage !== true || item.structure.biosCatalogValid !== true || item.structure.bootVerified !== false) fail("ISO_LIFECYCLE_INVALID_RESPONSE"); }
  };
  exact(value, request.operation === "prepare" ? ["state", "preparationSha256", "jobId", "prior", "jobBound", "bootVerified"] : ["state", "preparationSha256", "jobId", "output", "jobBound", "producerVerified", "cleanupVerified", "bootVerified"]);
  if (value.jobId !== request.jobId || typeof value.preparationSha256 !== "string" || !SHA.test(value.preparationSha256) || value.jobBound !== false || value.bootVerified !== false) fail("ISO_LIFECYCLE_INVALID_RESPONSE");
  if (request.operation === "prepare") { if (value.state !== "prepared-unbound") fail("ISO_LIFECYCLE_INVALID_RESPONSE"); if (value.prior !== null) file(value.prior, false); }
  else { if (value.state !== "fresh-file-observed-unbound" || value.preparationSha256 !== request.preparationSha256 || value.producerVerified !== false || value.cleanupVerified !== false) fail("ISO_LIFECYCLE_INVALID_RESPONSE"); file(value.output, true); }
  return value;
}
function createWslIsoOutputLifecycle({ execution, run, checkpoint, signalScript }) {
  return async function lifecycle(request, { signal, onOwnership } = {}) {
    exact(request, ["grantId", "runtime", "operation", "jobId", ...(request?.operation === "capture" ? ["preparationSha256"] : [])]);
    exact(request.runtime, ["kind", "distribution"]);
    if (typeof request.grantId !== "string" || request.runtime.kind !== "wsl" || !["prepare", "capture"].includes(request.operation) || typeof request.jobId !== "string" || !UUID.test(request.jobId) ||
        (request.operation === "capture" && (typeof request.preparationSha256 !== "string" || !SHA.test(request.preparationSha256))) || typeof onOwnership !== "function") fail("ISO_LIFECYCLE_AUTHORITY_REQUIRED");
    const grant = execution.grants.get(request.grantId), receipt = grant?.wslReceipt;
    if (!isWslReceipt(receipt) || request.runtime.distribution !== receipt.storage.distribution) fail("ISO_LIFECYCLE_AUTHORITY_REQUIRED");
    const proof = receipt.proof.split("\n"), outputPair = proof[5]?.match(/^(0|[1-9][0-9]{0,19}):(0|[1-9][0-9]{0,19})$/);
    if (proof.length !== 6 || !UUID.test(proof[0]) || !/^[1-9][0-9]{0,9}$/.test(proof[2]) || !outputPair) fail("ISO_LIFECYCLE_AUTHORITY_REQUIRED");
    const roots = [grant.root, grant.source, grant.output], stage = Object.freeze({ operation: request.operation, jobId: request.jobId });
    const current = () => {
      if (signal?.aborted) fail("ISO_LIFECYCLE_CANCELLED");
      if (execution.grants.get(request.grantId) !== grant || grant.wslReceipt !== receipt || roots.some((root, index) => root !== [grant.root, grant.source, grant.output][index])) fail("ISO_LIFECYCLE_AUTHORITY_REQUIRED");
    };
    const verify = async () => { current(); await verifyWslProject(receipt, args => run(execution.executables.wsl, args, { timeoutMs: 10000, maxBytes: 4096 }).completion, request.runtime); current(); };
    current();
    if (roots.some(root => execution.locks.has(root))) fail("ISO_LIFECYCLE_PROJECT_BUSY");
    roots.forEach(root => execution.locks.add(root));
    let job, owner = null, handshake, handshakeError, line = "", authority;
    const cancel = () => job?.cancel();
    try {
      await verify();
      const helperRequest = { operation: request.operation, jobId: request.jobId, outputRoot: receipt.storage.outputLinux,
        admittedOutputIdentity: { device: outputPair[1], inode: outputPair[2], uid: proof[2] }, ...(request.operation === "capture" ? { preparationSha256: request.preparationSha256 } : {}) };
      const input = { request: helperRequest, helper: fs.readFileSync(HELPER).toString("base64"), storage: receipt.storage, proof: receipt.proof };
      const inspectOwner = async () => { try { return await execution.reconcileCleanup(owner); } catch { return { state: "unknown", reason: "runtime-unavailable" }; } };
      const stop = async () => {
        if (!owner) fail("ISO_LIFECYCLE_CLEANUP_UNVERIFIED");
        const before = await inspectOwner();
        if (before.state === "verified-stopped") return;
        if (before.reason !== "owned-runtime-active") fail("ISO_LIFECYCLE_CLEANUP_UNVERIFIED");
        const killed = await run(execution.executables.wsl, ["--distribution", receipt.storage.distribution, "--exec", "/bin/sh", "-c", signalScript, "signal", String(owner.pid), owner.startTime, owner.bootId, "KILL", owner.pidNamespace], { timeoutMs: 5000, maxBytes: 4096 }).completion;
        if (killed.state !== "succeeded") fail("ISO_LIFECYCLE_CLEANUP_UNVERIFIED");
      };
      job = run(execution.executables.wsl, ["--distribution", receipt.storage.distribution, "--exec", "setsid", "--wait", "python3", "-I", "-B", "-c", LAUNCHER], {
        inputPipe: true, timeoutMs: 70000, maxBytes: 32768, onTerminate: stop,
        onLog(event) {
          if (event.stream !== "stderr" || handshake) return;
          line += event.text;
          if (!line.includes("\n")) return;
          handshake = (async () => {
            try {
              const match = line.split("\n")[0].match(/^MATERIAL_ISO_OWNER=(.+)$/);
              if (!match) fail("ISO_LIFECYCLE_AUTHORITY_REQUIRED");
              const parsed = JSON.parse(match[1]); exact(parsed, ["bootId", "pidNamespace", "pid", "startTime"]);
              owner = execution.validateOwnershipReceipt({ version: 1, kind: "wsl", ownerToken: crypto.randomUUID(), distribution: receipt.storage.distribution, ...parsed });
              if (owner.bootId !== proof[0]) fail("ISO_LIFECYCLE_AUTHORITY_REQUIRED");
              await verify();
              const active = await inspectOwner();
              if (active.reason !== "owned-runtime-active") fail("ISO_LIFECYCLE_AUTHORITY_REQUIRED");
              await checkpoint(value => onOwnership(value, stage), owner);
              await verify();
              const serialized = JSON.stringify({ ...input, pidNamespace: owner.pidNamespace }) + "\n";
              if (Buffer.byteLength(serialized) > 65536 || !job.writeInput(serialized)) fail("ISO_LIFECYCLE_CANCELLED");
            } catch (error) { handshakeError = error; cancel(); }
          })();
        },
      });
      signal?.addEventListener("abort", cancel, { once: true });
      authority = setInterval(() => { try { current(); } catch { cancel(); } }, 250); authority.unref?.();
      if (signal?.aborted) cancel();
      let result;
      try { result = await job.completion; } catch { result = { state: "failed", code: null }; }
      await handshake;
      const cleanup = owner ? await inspectOwner() : { state: "unknown", reason: "precise-ownership-unavailable" };
      const base = { ownership: owner, cleanup, stage, observation: null };
      if (cleanup.state !== "verified-stopped") return { ...base, state: "runtime-cleanup-failed", code: null, errorCode: "ISO_LIFECYCLE_CLEANUP_UNVERIFIED" };
      if (handshakeError || result.state !== "succeeded" || result.code !== 0) return { ...base, state: signal?.aborted ? "cancelled" : "failed", code: result.code ?? null, errorCode: result.state === "timed-out" ? "ISO_LIFECYCLE_TIMED_OUT" : "ISO_LIFECYCLE_UNVERIFIED" };
      try {
        await verify();
        const response = JSON.parse(result.stdout); exact(response, ["ok", "result"]);
        if (response.ok !== true) fail("ISO_LIFECYCLE_INVALID_RESPONSE");
        return { ...base, state: "succeeded", code: 0, observation: observation(response.result, request) };
      } catch { return { ...base, state: "failed", code: null, errorCode: "ISO_LIFECYCLE_UNVERIFIED" }; }
    } finally { clearInterval(authority); signal?.removeEventListener("abort", cancel); roots.forEach(root => execution.locks.delete(root)); }
  };
}
module.exports = { createWslIsoOutputLifecycle };
