"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createUpdateService, REPOSITORY, compare } = require("./service.cjs");

/** Host-owned background discovery. No renderer-supplied paths or commands. */
function createUpdateHost({ app, window, dialog, shell, currentSource, canInstall = () => false }) {
  const currentVersion = app.getVersion();
  const directory = path.join(app.getPath("userData"), "updates");
  const receipt = path.join(directory, "transition.json");
  const enabled = app.isPackaged && process.platform === "win32";
  let closed = false, paused = false, checking = false, later = false;
  let transition = "none", initialization = null;
  const service = createUpdateService({
    userData: app.getPath("userData"), currentVersion, currentSource,
    onInstallRequested: async (candidate) => {
      if (!enabled || closed || !canInstall()) throw Error("Active work prevents installation.");
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(receipt, JSON.stringify({ schemaVersion: 1, from: currentVersion, expected: candidate.version }), { mode: 0o600 });
      // Setup is the verified, host-selected genuine Squirrel installer. No shell expansion.
      const child = spawn(candidate.installer, [], { shell: false, detached: true, stdio: "ignore", windowsHide: false });
      await new Promise((resolve, reject) => { child.once("error", reject); child.once("spawn", resolve); });
      child.unref();
      transition = "installation-requested";
      // Normal application quit preserves beforeunload and before-quit protection.
      // There is deliberately no app.exit(), OS restart, or forced process termination.
      app.quit();
    },
  });
  async function initialize() {
    try {
      const stat = await fs.lstat(receipt);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2048) throw Error();
      const record = JSON.parse(await fs.readFile(receipt, "utf8"));
      if (record.schemaVersion !== 1 || typeof record.from !== "string" || typeof record.expected !== "string") throw Error();
      transition = compare(currentVersion, record.expected) >= 0 ? "updated" : compare(currentVersion, record.from) < 0 ? "rollback-detected" : "installation-incomplete";
    } catch (error) { if (error.code !== "ENOENT") transition = "recovery-unavailable"; }
  }
  function getState() {
    const { installer, installerPath, error, ...state } = service.getState();
    return { ...state, currentVersion, enabled, paused, later, transition,
      error: error ? "UPDATE_FAILED" : undefined,
      releaseNotes: state.release ? `https://github.com/${REPOSITORY}/releases/tag/${encodeURIComponent(state.release.tag)}` : null };
  }
  async function background() {
    if (!enabled || closed || paused || checking || ["unsigned-ready", "install-requested"].includes(service.getState().status)) return;
    checking = true;
    try { await service.check(); if (!closed && !paused && service.getState().status === "available") await service.download(); }
    catch {} finally { checking = false; }
  }
  const timer = setInterval(() => { void background(); }, 6 * 60 * 60 * 1000);
  timer.unref?.();
  initialization = initialize();
  const startup = setTimeout(() => { void initialization.then(background); }, 15000);
  startup.unref?.();
  return {
    getState,
    async check() { paused = false; later = false; await initialization; void background(); return getState(); },
    async download() { if (!enabled || closed) throw Error("Updates unavailable."); paused = false; later = false; await service.download(); return getState(); },
    cancel() { paused = true; service.cancel(); },
    later() { later = true; return getState(); },
    async notes() { const url = getState().releaseNotes; if (url) await shell.openExternal(url); return getState(); },
    async requestInstall(consent) {
      if (!enabled || closed || consent?.confirmUnsigned !== true || consent?.workSaved !== true || !canInstall()) throw Error("Save work and stop active operations before updating.");
      const response = await dialog.showMessageBox(window, {
        type: "warning", title: "Unsigned application update / 未簽署應用程式更新",
        message: `Install Material Buildroot ${service.getState().release?.version || ""}? / 安裝更新？`,
        detail: "This unsigned Squirrel installer may show an unknown-publisher warning. Save all work first. Only this application closes; the computer does not restart. If setup is cancelled or fails, reopen the previous installation.\n安裝程式未簽署，可能顯示未知發行者警告。請先儲存所有工作。只會關閉本程式，電腦唔會重新啟動。如取消或安裝失敗，請重開原有版本。",
        buttons: ["Later / 稍後", "Restart to install update / 重新啟動程式以安裝更新"], defaultId: 0, cancelId: 0, noLink: true,
      });
      if (response.response !== 1) { window.focus(); return getState(); }
      if (!canInstall()) throw Error("Active work prevents installation.");
      await service.requestInstall(consent);
      return getState();
    },
    close() { closed = true; clearTimeout(startup); clearInterval(timer); service.cancel(); },
  };
}
module.exports = { createUpdateHost };
