"use strict";
const path = require("node:path");
const admitted = new WeakSet();
const DISTRO=/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const ROOT=/^\/home\/[A-Za-z0-9_.-]+\/material-buildroot$/;
function metadataPaths(storage) {
  if(!storage || Object.getPrototypeOf(storage)!==Object.prototype || Object.keys(storage).sort().join(",")!=="distribution,kind,outputLinux,rootLinux,sourceLinux" || storage.kind!=="wsl" || !DISTRO.test(storage.distribution) || !ROOT.test(storage.rootLinux))throw Error("invalid-wsl-storage");
  for(const key of ["sourceLinux","outputLinux"]){const value=storage[key];if(typeof value!=="string" || !/^\/[A-Za-z0-9_/.+-]+$/.test(value) || value.split("/").some(x=>x==="."||x==="..") || !value.startsWith(storage.rootLinux+"/") || value.endsWith("/"))throw Error("invalid-wsl-storage");}
  if(storage.sourceLinux===storage.outputLinux || storage.sourceLinux.startsWith(storage.outputLinux+"/") || storage.outputLinux.startsWith(storage.sourceLinux+"/"))throw Error("invalid-wsl-storage");
  const native=value=>`\\\\wsl.localhost\\${storage.distribution}${value.replaceAll("/","\\")}`;
  return {root:native(storage.rootLinux),source:native(storage.sourceLinux),output:native(storage.outputLinux)};
}
const IDENTITY_FUNCTION = `wsl_identity() {
 test "$(id -u)" -ne 0 || return 77
 for entry in "$1" "$2" "$3"; do
 test -d "$entry" && test -w "$entry" || return 78
 test "$(readlink -f -- "$entry")" = "$entry" || return 78
 test "$(stat -c %u -- "$entry")" = "$(id -u)" || return 78
 case "$(stat -f -c %T -- "$entry")" in ext2/ext3|btrfs|xfs) ;; *) return 78 ;; esac
 done
 test "$(stat -c %d -- "$1")" = "$(stat -c %d -- "$2")" || return 78
 test "$(stat -c %d -- "$1")" = "$(stat -c %d -- "$3")" || return 78
 test -f "$2/Makefile" && test ! -L "$2/Makefile" || return 78
 test -f "$2/Config.in" && test -f "$2/Makefile.legacy" || return 78
 printf '%s\\n' "$(cat /proc/sys/kernel/random/boot_id)" "$(cat /etc/machine-id)" "$(id -u)" "$(stat -c %d:%i -- "$1")" "$(stat -c %d:%i -- "$2")" "$(stat -c %d:%i -- "$3")"
}`;
async function probe(storage, run) {
  metadataPaths(storage);
  const result=await run(["--distribution",storage.distribution,"--exec","/bin/sh","-c",`set -eu; ${IDENTITY_FUNCTION}; wsl_identity "$1" "$2" "$3"`,"identity",storage.rootLinux,storage.sourceLinux,storage.outputLinux]);
  const proof=result.stdout.trim();
  if(result.state!=="succeeded" || !/^[a-f0-9-]{36}\n[a-f0-9]{32}\n[1-9][0-9]*\n[0-9]+:[0-9]+\n[0-9]+:[0-9]+\n[0-9]+:[0-9]+$/.test(proof))throw Error("wsl-project-identity-unavailable");
  return proof;
}
async function admitWslProject(storage, run) {
  const paths=metadataPaths(storage);const proof=await probe(storage,run);
  const receipt=Object.freeze({storage:Object.freeze({...storage}),paths:Object.freeze(paths),proof});admitted.add(receipt);return receipt;
}
function isWslReceipt(receipt){return !!receipt && admitted.has(receipt);}
async function verifyWslProject(receipt, run, runtime) {
  if(!isWslReceipt(receipt) || (runtime && (runtime.kind!=="wsl" || runtime.distribution!==receipt.storage.distribution)))throw Error("wsl-project-authority-required");
  if(await probe(receipt.storage,run)!==receipt.proof)throw Error("wsl-project-identity-changed");
}
function wrapBuild(script){return `set -eu; ${IDENTITY_FUNCTION}; actual=$(wsl_identity "$1" "$3" "$4"); test "$actual" = "$2" || exit 78; shift 2; ${script}`;}
function linuxSelection(native,storage) {
  if(typeof native!=="string" || native.length>4096 || path.win32.normalize(native)!==native)throw Error("invalid-wsl-selection");
  const prefix=`\\\\wsl.localhost\\${storage.distribution}`;
  if(!native.startsWith(prefix+"\\"))throw Error("invalid-wsl-selection");
  const selected=native.slice(prefix.length).replaceAll("\\","/");
  if(!selected.startsWith(storage.rootLinux+"/") || !/^\/[A-Za-z0-9_/.+-]+$/.test(selected) || selected.split("/").some(x=>x==="."||x===".."))throw Error("invalid-wsl-selection");return selected;
}
module.exports={metadataPaths,admitWslProject,verifyWslProject,isWslReceipt,wrapBuild,linuxSelection};
