"use strict";
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { StringDecoder } = require("node:string_decoder");
const { fail } = require("./runtime.cjs");
function createWindowsOllamaProcessAdapter(options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== "win32") fail("WINDOWS_PROCESS_ADAPTER_UNAVAILABLE");
  const spawnImpl = options.spawnImpl || spawn;
  const script = fs.readFileSync(
    path.join(__dirname, "ollama-process.ps1"),
    "utf8",
  );
  const systemRoot = options.systemRoot || process.env.SystemRoot;
  if (!systemRoot || !path.win32.isAbsolute(systemRoot))
    fail("WINDOWS_SYSTEM_DIRECTORY_UNAVAILABLE");
  const powerShell = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const owners = new Map(),
    launches = new Set();
  let disposed = false;
  async function launch({ executable, directory, models, members, signal }) {
    if (disposed) fail("SERVICE_DISPOSED");
    if (
      ![executable, directory, models].every(
        (value) =>
          typeof value === "string" &&
          path.win32.isAbsolute(value) &&
          !/[\x00-\x1f]/.test(value),
      ) ||
      !Array.isArray(members) ||
      !members.length ||
      members.length > 10000
    )
      fail("INVALID_NATIVE_LAUNCH");
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    if (encoded.length + powerShell.length + 128 > 32760)
      fail("NATIVE_COMMAND_LENGTH_LIMIT");
    const nonce = randomBytes(16).toString("hex");
    const helper = spawnImpl(
      powerShell,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: { SystemRoot: systemRoot, PATH: path.win32.dirname(powerShell) },
      },
    );
    const child = new EventEmitter();
    child.pid = undefined;
    child.exitCode = null;
    child.signalCode = null;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    let pending = "",
      bytes = 0,
      closed = false,
      closing = false,
      cleanupVerified = false,
      identity = null,
      startedResolve,
      startedReject;
    const started = new Promise((resolve, reject) => {
      startedResolve = resolve;
      startedReject = reject;
    });
    const requests = new Map();
    const stdoutDecoder = new StringDecoder("utf8");
    function error(code) {
      return Object.assign(new Error(code), { code });
    }
    function invalidate(code) {
      const failure = error(code);
      startedReject(failure);
      for (const entry of requests.values()) {
        clearTimeout(entry.timer);
        entry.reject(failure);
      }
      requests.clear();
    }
    const closeInput = () => {
      closing = true;
      try {
        helper.stdin.end();
      } catch {}
    };
    const abort = () => {
      invalidate("CANCELLED");
      closeInput();
    };
    signal?.addEventListener("abort", abort, { once: true });
    helper.once("error", () => invalidate("NATIVE_HELPER_START_FAILED"));
    helper.stdin.on("error", () => invalidate("NATIVE_HELPER_INPUT_FAILED"));
    helper.once("close", (code, signalCode) => {
      closed = true;
      signal?.removeEventListener("abort", abort);
      invalidate("NATIVE_HELPER_EXITED");
      child.exitCode = code;
      child.signalCode = signalCode || null;
      child.emit("exit", code, signalCode);
      child.emit("close", code, signalCode);
      child.stdout.end();
      child.stderr.end();
    });
    helper.stderr.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 262144) {
        invalidate("NATIVE_PROTOCOL_LIMIT");
        closeInput();
      }
    });
    helper.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 262144) {
        invalidate("NATIVE_PROTOCOL_LIMIT");
        closeInput();
        return;
      }
      pending += stdoutDecoder.write(chunk);
      if (pending.length > 65536) {
        invalidate("NATIVE_PROTOCOL_LIMIT");
        closeInput();
        return;
      }
      let at;
      while ((at = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, at).trim();
        pending = pending.slice(at + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          invalidate("INVALID_NATIVE_PROTOCOL");
          closeInput();
          return;
        }
        if (message.type === "error") {
          invalidate("NATIVE_OWNERSHIP_FAILED");
          closeInput();
          return;
        }
        if (message.nonce !== nonce) {
          invalidate("NATIVE_NONCE_MISMATCH");
          closeInput();
          return;
        }
        if (message.type === "cleanup") {
          if (
            message.settled !== true ||
            message.active !== 0 ||
            (identity &&
              (message.pid !== identity.pid ||
                message.creation !== identity.creation))
          ) {
            invalidate("OWNED_PROCESS_STOP_UNVERIFIED");
            closeInput();
            return;
          }
          cleanupVerified = true;
          continue;
        }
        if (message.type === "started") {
          if (
            identity ||
            !Number.isInteger(message.pid) ||
            message.pid < 1 ||
            typeof message.creation !== "string" ||
            !/^\d+$/.test(message.creation) ||
            typeof message.executable !== "string" ||
            path.win32.normalize(message.executable).toLowerCase() !==
              path.win32.normalize(executable).toLowerCase()
          ) {
            invalidate("NATIVE_PROCESS_IDENTITY_MISMATCH");
            closeInput();
            return;
          }
          identity = { pid: message.pid, creation: message.creation };
          child.pid = message.pid;
          startedResolve();
          continue;
        }
        const entry = requests.get(message.id);
        if (
          !entry ||
          !identity ||
          message.pid !== identity.pid ||
          message.creation !== identity.creation
        ) {
          invalidate("NATIVE_PROCESS_IDENTITY_MISMATCH");
          closeInput();
          return;
        }
        requests.delete(message.id);
        clearTimeout(entry.timer);
        if (message.type !== entry.expected) {
          entry.reject(error("INVALID_NATIVE_PROTOCOL"));
          closeInput();
          return;
        }
        entry.resolve(message);
      }
    });
    const pendingLaunch = {
      closeInput,
      helper,
      closed: () => closed,
      cleanup: () => cleanupVerified,
    };
    launches.add(pendingLaunch);
    const startupTimeout = setTimeout(() => {
      invalidate("NATIVE_START_TIMEOUT");
      closeInput();
    }, 60000);
    try {
      if (signal?.aborted) fail("CANCELLED");
      helper.stdin.write(
        JSON.stringify({
          action: "launch",
          nonce,
          executable,
          directory,
          models,
          members,
        }) + "\n",
      );
      await started;
      if (disposed) fail("SERVICE_DISPOSED");
    } catch (error) {
      closeInput();
      if (!closed)
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 10000);
          helper.once("close", () => {
            clearTimeout(timer);
            resolve();
          });
        });
      if (!closed || !cleanupVerified)
        throw Object.assign(new Error("NATIVE_START_CLEANUP_UNVERIFIED"), {
          code: "NATIVE_START_CLEANUP_UNVERIFIED",
        });
      throw error;
    } finally {
      clearTimeout(startupTimeout);
      launches.delete(pendingLaunch);
    }
    function request(action, expected) {
      if (closed) fail("OWNED_PROCESS_HANDLE_CLOSED");
      const id = randomBytes(8).toString("hex");
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          requests.delete(id);
          reject(error("NATIVE_COMMAND_TIMEOUT"));
          closeInput();
        }, 10000);
        requests.set(id, { resolve, reject, timer, expected });
        helper.stdin.write(JSON.stringify({ id, nonce, action }) + "\n");
      });
    }
    const record = {
      child,
      helper,
      identity,
      request,
      closed: () => closed,
      closing: () => closing,
      cleanup: () => cleanupVerified,
      closeInput,
    };
    owners.set(child.pid, record);
    return { child };
  }
  async function verifyListener({ pid, host, port }) {
    if (host !== "127.0.0.1" || port !== 11434) fail("INVALID_LISTENER");
    const record = owners.get(pid);
    if (!record || record.closed()) fail("OWNED_PROCESS_HANDLE_CLOSED");
    const message = await record.request("verify", "verified");
    return {
      pid,
      verified: message.verified === true,
      creation: message.creation,
    };
  }
  async function stopRecord(record, pid) {
    if (record.closing() && !record.closed())
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error("NATIVE_HELPER_STOP_UNVERIFIED"), {
                code: "NATIVE_HELPER_STOP_UNVERIFIED",
              }),
            ),
          5000,
        );
        record.helper.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    if (record.closed()) {
      if (!record.cleanup()) fail("OWNED_PROCESS_STOP_UNVERIFIED");
      owners.delete(pid);
      return { pid, settled: true };
    }
    const result = await record.request("stop", "stopped");
    if (result.settled !== true || result.active !== 0)
      fail("OWNED_PROCESS_STOP_UNVERIFIED");
    record.closeInput();
    if (!record.closed())
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error("NATIVE_HELPER_STOP_UNVERIFIED"), {
                code: "NATIVE_HELPER_STOP_UNVERIFIED",
              }),
            ),
          5000,
        );
        record.helper.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    if (!record.cleanup()) fail("OWNED_PROCESS_STOP_UNVERIFIED");
    owners.delete(pid);
    return { pid, settled: true };
  }
  async function stopOwnedTree({ pid, child }) {
    const record = owners.get(pid);
    if (!record || record.child !== child)
      fail("OWNED_PROCESS_HANDLE_MISMATCH");
    if (record.stopping) return record.stopping;
    record.stopping = stopRecord(record, pid).catch((error) => {
      record.stopping = null;
      throw error;
    });
    return record.stopping;
  }
  async function dispose() {
    disposed = true;
    for (const record of launches) record.closeInput();
    const pending = await Promise.allSettled(
      [...launches].map(async (record) => {
        if (!record.closed())
          await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () =>
                reject(
                  Object.assign(new Error("NATIVE_START_CLEANUP_UNVERIFIED"), {
                    code: "NATIVE_START_CLEANUP_UNVERIFIED",
                  }),
                ),
              10000,
            );
            record.helper.once("close", () => {
              clearTimeout(timer);
              resolve();
            });
          });
        if (!record.cleanup()) fail("NATIVE_START_CLEANUP_UNVERIFIED");
      }),
    );
    const results = await Promise.allSettled(
      [...owners.values()].map((record) =>
        stopOwnedTree({ pid: record.identity.pid, child: record.child }),
      ),
    );
    if ([...pending, ...results].some((result) => result.status === "rejected"))
      fail("OWNED_PROCESS_STOP_UNVERIFIED");
  }
  return { launch, verifyListener, stopOwnedTree, dispose };
}
module.exports = { createWindowsOllamaProcessAdapter };
