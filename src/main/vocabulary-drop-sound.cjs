"use strict";
const path = require("node:path");
const { spawn } = require("node:child_process");
function validRequest(value) {
  try {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== 1) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, "kind");
    return !!descriptor && Object.hasOwn(descriptor, "value") && ["applied", "invalid"].includes(descriptor.value);
  } catch { return false; }
}
const NATIVE_PREFIX = `$ErrorActionPreference='Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class LocalDropSound { [DllImport("winmm.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool PlaySound(string sound, IntPtr module, uint flags); }'
`;
const NATIVE_SCRIPTS = Object.freeze({
  applied: NATIVE_PREFIX + `$sound=Join-Path ([Environment]::GetFolderPath('Windows')) 'Media\\tada.wav'
if (!(Test-Path -LiteralPath $sound -PathType Leaf)) { exit 3 }
if (![LocalDropSound]::PlaySound($sound,[IntPtr]::Zero,0x00020002)) { exit 3 }
`,
  invalid: NATIVE_PREFIX + `if (![LocalDropSound]::PlaySound('SystemHand',[IntPtr]::Zero,0x00010002)) { exit 3 }
`,
});
function playNativeSound(kind, { platform = process.platform, windowsRoot = process.env.SystemRoot, launch = spawn } = {}) {
  if (platform !== "win32" || !Object.hasOwn(NATIVE_SCRIPTS, kind) || typeof windowsRoot !== "string" || !/^[A-Za-z]:\\[^\x00-\x1f]*$/.test(windowsRoot)) return Promise.resolve(false);
  return new Promise(resolve => {
    let child, timer, settled = false;
    const finish = success => { if (settled) return; settled = true; clearTimeout(timer); resolve(success); };
    try {
      child = launch(path.win32.join(windowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(NATIVE_SCRIPTS[kind], "utf16le").toString("base64")], { shell: false, windowsHide: true, stdio: "ignore" });
      timer = setTimeout(() => { try { child.kill(); } catch {} finish(false); }, 8000);
      child.once("error", () => finish(false));
      child.once("exit", code => finish(code === 0));
    } catch { finish(false); }
  });
}
function createVocabularyDropSound({ admitted, play = playNativeSound } = {}) {
  let tail = Promise.resolve(), pending = 0;
  const allowed = event => { try { return typeof admitted === "function" && admitted(event) === true; } catch { return false; } };
  async function request(event, input) {
    if (!allowed(event)) return { ok: false, status: "unauthorized", code: "UNAUTHORIZED" };
    if (!validRequest(input)) return { ok: false, status: "invalid", code: "INVALID_REQUEST" };
    if (pending >= 4) return { ok: false, status: "busy", code: "SOUND_QUEUE_FULL" };
    pending++;
    const kind = input.kind;
    const operation = tail.then(async () => {
      try {
        if (!allowed(event)) return { ok: false, status: "unauthorized", code: "UNAUTHORIZED" };
        return await play(kind) === true ? { ok: true, status: "requested" } : { ok: false, status: "unavailable", code: "SOUND_UNAVAILABLE" };
      } catch { return { ok: false, status: "unavailable", code: "SOUND_UNAVAILABLE" }; }
      finally { pending--; }
    });
    tail = operation.then(() => {});
    return operation;
  }
  return { request };
}
module.exports = { createVocabularyDropSound, playNativeSound, validRequest };
