"use strict";
const path = require("node:path");
const { pathToFileURL } = require("node:url");
/** Each secondary window owns exactly one transfer and no general workspace API. */
function createTransferProgressWindows({ BrowserWindow, ipcMain, parentWindow, appPath }) {
  const owners = new Map(), url = pathToFileURL(path.join(appPath, "dist/transfer-progress.html")).href;
  const channel = "studio:transfer-progress";
  let disposed = false;
  const admitted = (owner, event) => owner && !owner.revoked && !owner.window.isDestroyed() && event.sender === owner.window.webContents && event.senderFrame === owner.window.webContents.mainFrame && event.senderFrame.url === url;
  ipcMain.handle(channel, async (event, action) => {
    const owner = owners.get(event.sender.id);
    if (!admitted(owner, event)) return { ok: false, code: "UNAUTHORIZED" };
    if (!["read", "cancel", "close"].includes(action)) return { ok: false, code: "INVALID_REQUEST" };
    try {
      if (action === "close") { owner.window.close(); return { ok: true }; }
      if (owner.pending || Date.now() - owner.lastRead < 200 && action === "read") return { ok: false, code: "BUSY" };
      owner.pending = true;
      if (action === "cancel") await owner.cancel();
      const transfer = await owner.read(); owner.lastRead = Date.now();
      if (!admitted(owner, event)) return { ok: false, code: "UNAUTHORIZED" };
      return { ok: true, language: owner.language, transfer };
    } catch { return { ok: false, code: "TRANSFER_STATUS_UNAVAILABLE" }; }
    finally { if (owner) owner.pending = false; }
  });
  function dispose() {
    if (disposed) return; disposed = true;
    for (const owner of owners.values()) { owner.revoked = true; if (!owner.window.isDestroyed()) owner.window.close(); }
    owners.clear(); ipcMain.removeHandler(channel);
  }
  parentWindow.once("closed", dispose);
  return {
    async open({ jobId, language, read, cancel }) {
      if (disposed || parentWindow.isDestroyed()) throw Error("TRANSFER_WINDOW_UNAVAILABLE");
      const existing = [...owners.values()].find(x => x.jobId === jobId && !x.window.isDestroyed());
      if (existing) { existing.window.showInactive(); return { opened: true, reused: true }; }
      if (owners.size >= 4) throw Error("TRANSFER_WINDOW_LIMIT");
      const window = new BrowserWindow({ width: 560, height: 520, minWidth: 360, minHeight: 320, parent: parentWindow, show: false, title: "Transfer progress", webPreferences: { preload: path.join(__dirname, "transfer-progress-preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, devTools: false } });
      const owner = { window, jobId, language, read, cancel, revoked: true, pending: false, lastRead: 0 };
      const contentsId = window.webContents.id;
      owners.set(contentsId, owner);
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, target) => { if (target !== url) event.preventDefault(); });
      window.webContents.on("will-frame-navigate", event => { if (!event.isMainFrame || event.url !== url) event.preventDefault(); });
      window.webContents.on("will-attach-webview", event => event.preventDefault());
      window.webContents.on("did-start-navigation", () => { owner.revoked = true; });
      window.webContents.on("render-process-gone", () => { owner.revoked = true; });
      window.webContents.on("did-finish-load", () => { owner.revoked = window.webContents.mainFrame.url !== url; });
      window.once("closed", () => { owner.revoked = true; owners.delete(contentsId); });
      try { await window.loadURL(url); window.showInactive(); return { opened: true, reused: false }; }
      catch { owner.revoked = true; if (!window.isDestroyed()) window.close(); throw Error("TRANSFER_WINDOW_UNAVAILABLE"); }
    }, dispose,
  };
}
module.exports = { createTransferProgressWindows };
