"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { boundedProcess } = require("./index.cjs");
const { resolveConfigurationScripts } = require("../configuration/kconfig-adapter.cjs");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const sameBinding = (left, right) => left && right &&
  ["admissionId", "sourceRevision", "configRevision"].every(key => left[key] === right[key]);
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
};
// Fixed launcher code is never supplied by a renderer or by the selected source.
const LAUNCHER = String.raw`import os,sys,json,base64,hashlib,tempfile,subprocess,signal,selectors,time
if sys.platform != 'linux' or os.geteuid() == 0: sys.exit(77)
pid=os.getpid()
stat=open('/proc/self/stat').read().rsplit(')',1)[1].split()
receipt={'pid':pid,'startTime':stat[19],'bootId':open('/proc/sys/kernel/random/boot_id').read().strip(),'pidNamespace':os.readlink('/proc/self/ns/pid')}
sys.stderr.write('MATERIAL_KCONFIG_OWNER='+json.dumps(receipt)+'\n');sys.stderr.flush()
payload=json.loads(sys.stdin.buffer.read(4*1024*1024))
bundle=payload['bundle'];request=payload['request']
with tempfile.TemporaryDirectory(prefix='material-kconfig-') as directory:
 os.mkdir(os.path.join(directory,'vendor'))
 for key,relative in [('helper','inspect.py'),('module','vendor/kconfiglib.py')]:
  data=base64.b64decode(bundle[key],validate=True)
  if hashlib.sha256(data).hexdigest()!=bundle[key+'Sha256']: sys.exit(78)
  with open(os.path.join(directory,relative),'xb') as output: output.write(data)
 child=subprocess.Popen([sys.executable,'-I','-B',os.path.join(directory,'inspect.py')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'},cwd=request['sourceRoot'])
 child.stdin.write(json.dumps(request).encode());child.stdin.close()
 selector=selectors.DefaultSelector()
 selector.register(child.stdout,selectors.EVENT_READ,'stdout')
 selector.register(child.stderr,selectors.EVENT_READ,'stderr')
 deadline=time.monotonic()+30;counts={'stdout':0,'stderr':0}
 while selector.get_map():
  if time.monotonic()>deadline: os.killpg(os.getpgrp(),signal.SIGKILL)
  for key,events in selector.select(0.1):
   data=os.read(key.fd,65536)
   if not data: selector.unregister(key.fileobj);continue
   counts[key.data]+=len(data)
   if counts[key.data]>(16*1024*1024 if key.data=='stdout' else 65536): os.killpg(os.getpgrp(),signal.SIGKILL)
   if key.data=='stdout': sys.stdout.buffer.write(data);sys.stdout.buffer.flush()
 if child.wait(timeout=1): sys.exit(79)
`;
const SIGNAL = String.raw`set -eu
test "$(id -u)" -ne 0 || exit 77
test "$(cat /proc/sys/kernel/random/boot_id)" = "$3" || exit 78
test "$(readlink /proc/self/ns/pid)" = "$5" || exit 78
test -r "/proc/$1/stat" || exit 78
identity=$(awk 'sub(/^.*[)] /, "") {print $20 " " $3 " " $4}' "/proc/$1/stat")
test "$identity" = "$2 $1 $1" || exit 78
case "$4" in TERM|KILL) ;; *) exit 78 ;; esac
exec /bin/kill "-$4" -- "-$1"`;

function createKconfigInspection({ execution, resolveContext, onOwnership } = {}) {
  if (!execution || typeof resolveContext !== "function") fail("INVALID_KCONFIG_TRANSPORT");
  return async operation => {
    if (!operation || operation.operation !== "inspect-kconfig-v1" || operation.signal?.aborted)
      fail("INVALID_KCONFIG_OPERATION");
    const context = await resolveContext(operation.admissionId);
    const grant = execution.grants.get(context?.grantId);
    if (!grant || !context.runtime || !sameBinding(context.binding, operation.request?.binding))
      fail("KCONFIG_ADMISSION_CHANGED");
    const lockRoots = [...new Set([grant.source, grant.output])];
    if (lockRoots.some(root => execution.locks.has(root))) fail("KCONFIG_PROJECT_BUSY");
    for (const root of lockRoots) execution.locks.add(root);
    try {
    const validate = async () => {
      if (operation.signal?.aborted) fail("KCONFIG_CANCELLED");
      const current = await resolveContext(operation.admissionId);
      if (execution.grants.get(context.grantId) !== grant ||
          !sameBinding(current?.binding, context.binding) ||
          JSON.stringify(current?.runtime) !== JSON.stringify(context.runtime) ||
          current?.sourceRoot !== context.sourceRoot || current?.outputRoot !== context.outputRoot)
        fail("KCONFIG_ADMISSION_CHANGED");
      for (const key of ["root", "source", "output"]) {
        const stat = fs.statSync(grant[key]);
        if (fs.realpathSync(grant[key]) !== grant[key] || `${stat.dev}:${stat.ino}` !== grant.identities[key])
          fail("KCONFIG_ROOT_CHANGED");
      }
      execution.validateExternal(grant);
    };
    await validate();
    const request = operation.request;
    if (request.sourceRoot !== context.sourceRoot || request.outputRoot !== context.outputRoot ||
        ![grant.source, grant.output].some(root => inside(root, request.sourceRoot)) ||
        !inside(grant.output, request.outputRoot) ||
        request.externalRoots.length !== grant.external.length ||
        request.externalRoots.some((root, index) => root !== grant.external[index].path))
      fail("KCONFIG_ROOT_NOT_GRANTED");
    const bundle = operation.bundle;
    if (bundle?.version !== "14.1.0" || ["helper", "module"].some(key =>
      typeof bundle[key] !== "string" || bundle[key].length > 2 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(bundle[key + "Sha256"] || "") ||
      hash(Buffer.from(bundle[key], "base64")) !== bundle[key + "Sha256"]))
      fail("KCONFIG_INTEGRITY_FAILED");
    const { helper, scripts } = await resolveConfigurationScripts();
    if (hash(fs.readFileSync(helper)) !== bundle.helperSha256 ||
        hash(fs.readFileSync(path.join(scripts,"vendor","kconfiglib.py"))) !== bundle.moduleSha256)
      fail("KCONFIG_INTEGRITY_FAILED");
    const runtime = context.runtime;
    const ownerToken = crypto.randomUUID();
    let file, args, ownership, pendingInput, job;
    const mappedRoots = new Map();
    const translate = async native => {
      if (mappedRoots.has(native)) return mappedRoots.get(native);
      const translated = await boundedProcess(execution.executables.wsl,
        ["--distribution", runtime.distribution, "--exec", "wslpath", "-a", "-u", native],
        { maxBytes: 4096 }).completion;
      const value = translated.stdout.trim();
      if (translated.state !== "succeeded" || !value.startsWith("/") || /[\x00-\x1f]/.test(value))
        fail("KCONFIG_PATH_TRANSLATION_FAILED");
      mappedRoots.set(native, value); return value;
    };
    if (runtime.kind === "docker") {
      if (operation.runtime !== "docker" || !/^[a-z0-9][a-z0-9./_-]*@sha256:[a-f0-9]{64}$/.test(runtime.image || "") ||
          ![runtime.uid, runtime.gid].every(value => Number.isSafeInteger(value) && value > 0 && value <= 4294967294))
        fail("INVALID_KCONFIG_RUNTIME");
      ownership = { version: 1, kind: "docker", ownerToken, containerName: `material-buildroot-${ownerToken}`, daemonId: await execution.dockerIdentity() };
      const mounts = [[grant.source, "/source"], [grant.output, "/output"], ...grant.external.map((item,index) => [item.path, `/external/${index}`])];
      if (mounts.some(([root]) => /[,\r\n\0]/.test(root))) fail("INVALID_KCONFIG_MOUNT");
      for (const [root,mapped] of mounts) mappedRoots.set(root,mapped);
      file = execution.executables.docker;
      args = ["run", "--rm", "-i", "--pull=never", "--name", ownership.containerName,
        "--label", `io.material-buildroot.operation=${ownerToken}`, "--user", `${runtime.uid}:${runtime.gid}`,
        "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit=256", "--memory=1g", "--cpus=2", "--network=none",
        "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m,mode=1777",
        ...mounts.flatMap(([root,mapped]) => ["--mount", `type=bind,src=${root},dst=${mapped},readonly`]),
        "--entrypoint", "/usr/bin/setsid", runtime.image, "python3", "-I", "-B", "-c", LAUNCHER];
    } else if (runtime.kind === "wsl") {
      if (operation.runtime !== "wsl2" || execution.platform !== "win32" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(runtime.distribution || ""))
        fail("INVALID_KCONFIG_RUNTIME");
      for (const root of [grant.source, grant.output, ...grant.external.map(item => item.path)]) await translate(root);
      file = execution.executables.wsl;
      args = ["--distribution", runtime.distribution, "--exec", "setsid", "python3", "-I", "-B", "-c", LAUNCHER];
    } else fail("KCONFIG_RUNTIME_UNAVAILABLE");
    const mapPath = native => {
      const root = [...mappedRoots.keys()].sort((a,b) => b.length-a.length).find(root => inside(root,native));
      if (!root) fail("KCONFIG_ROOT_NOT_GRANTED");
      const relative = path.relative(root,native).replace(/\\/g,"/");
      return mappedRoots.get(root) + (relative ? "/" + relative : "");
    };
    const mapValue = value => {
      // Path values come exclusively from the admitted host metadata. Translate
      // complete prefixes, not arbitrary substrings or source-provided commands.
      for (const root of [...mappedRoots.keys()].sort((a,b) => b.length-a.length)) {
        const variants = [root, root.replace(/\\/g,"/")];
        for (const variant of variants) if (value === variant || value.startsWith(variant + "/") || value.startsWith(variant + "\\"))
          return mappedRoots.get(root) + value.slice(variant.length).replace(/\\/g,"/");
      }
      return value;
    };
    const mapped = { ...request, sourceRoot: mapPath(request.sourceRoot), outputRoot: mapPath(request.outputRoot),
      sourceReference: mapPath(request.sourceRoot), outputReference: mapPath(request.outputRoot),
      externalRoots: request.externalRoots.map(mapPath),
      externalTrees: request.externalTrees.map(tree => ({ ...tree, root: mapPath(tree.root), kconfigRoot: mapPath(tree.root) })),
      environment: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", ...Object.fromEntries(Object.entries(request.environment).map(([key,value]) => [key,mapValue(value)])) } };
    pendingInput = JSON.stringify({ request: mapped, bundle });
    if (Buffer.byteLength(pendingInput) > 4 * 1024 * 1024) fail("KCONFIG_INPUT_LIMIT");
    const terminate = async () => {
      if (!ownership) fail("KCONFIG_OWNERSHIP_UNAVAILABLE");
      if (ownership.kind === "docker") {
        const state = await execution.ownedDocker(ownership);
        if (state.state === "verified-stopped") return;
        if (state.state !== "owned") fail("KCONFIG_OWNERSHIP_UNVERIFIED");
        const stopped = await boundedProcess(file,["stop","--time","1",state.containerId],{ timeoutMs: 5000 }).completion;
        if (stopped.state !== "succeeded") fail("KCONFIG_CANCELLATION_FAILED");
      } else {
        const state = await execution.reconcileCleanup(ownership);
        if (state.state === "verified-stopped") return;
        if (state.reason !== "owned-runtime-active") fail("KCONFIG_OWNERSHIP_UNVERIFIED");
        const stopped = await boundedProcess(file,["--distribution",runtime.distribution,"--exec","/bin/sh","-c",SIGNAL,"signal",String(ownership.pid),ownership.startTime,ownership.bootId,"KILL",ownership.pidNamespace],{timeoutMs:5000}).completion;
        if (stopped.state !== "succeeded") fail("KCONFIG_CANCELLATION_FAILED");
      }
    };
    let ownerLine = "", handshake = false, handshakeWork;
    await validate();
    if (ownership) await onOwnership?.(ownership);
    job = boundedProcess(file,args,{ inputPipe:true, timeoutMs:35000, maxBytes:16*1024*1024+65536, onTerminate:terminate,
      onLog(event) {
        if (event.stream !== "stderr" || handshake) return;
        ownerLine += event.text;
        const newline = ownerLine.indexOf("\n");
        if (newline < 0) return;
        handshake = true;
        handshakeWork = Promise.resolve().then(async () => {
          const match = ownerLine.slice(0,newline).match(/^MATERIAL_KCONFIG_OWNER=(.+)$/);
          if (!match) fail("KCONFIG_OWNERSHIP_UNAVAILABLE");
          if (runtime.kind === "wsl") {
            ownership = execution.validateOwnershipReceipt({version:1,kind:"wsl",ownerToken,distribution:runtime.distribution,...JSON.parse(match[1])});
            await onOwnership?.(ownership);
          }
          await validate();
          if (!job.writeInput(pendingInput)) fail("KCONFIG_CANCELLED");
        }).catch(() => job.cancel());
      } });
    const cancel = () => job.cancel();
    operation.signal?.addEventListener("abort",cancel,{once:true});
    if (operation.signal?.aborted) cancel();
    try {
      const result = await job.completion;
      await handshakeWork;
      await validate();
      if (result.state !== "succeeded" || !handshake) fail("KCONFIG_RUNTIME_INSPECTION_FAILED");
      let response; try { response=JSON.parse(result.stdout); } catch { fail("KCONFIG_INVALID_RESPONSE"); }
      return response;
    } finally {
      operation.signal?.removeEventListener("abort",cancel);
    }
    } finally {
      for (const root of lockRoots) execution.locks.delete(root);
    }
  };
}
module.exports = { createKconfigInspection };
