"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  dialog,
  shell,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { createCapabilityRegistry } = require("./security/capabilities.cjs");
const { createBroker } = require("./broker.cjs");
const { createDesktopSession } = require("./security/desktop-session.cjs");
const { createWorkspaceService } = require("./workspace-service.cjs");
const { createWorkspaceIPC } = require("./security/workspace-ipc.cjs");
const { createOperationsService } = require("./operations-service.cjs");
const verification = process.argv.filter((arg) =>
  arg.startsWith("--verification-user-data="),
);
if (verification.length) {
  const value = verification[0].slice("--verification-user-data=".length);
  if (
    verification.length !== 1 ||
    !path.isAbsolute(value) ||
    /[\x00-\x1f]/.test(value)
  )
    throw new Error("Verification profile must be one absolute directory.");
  app.setPath("userData", path.resolve(value));
}
let store, window, desktop, operations;
let quitting = false;
const capabilities = createCapabilityRegistry();
if (require("electron-squirrel-startup")) app.quit();
else if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(() => {
      session.defaultSession.setPermissionRequestHandler(
        (_wc, _permission, callback) => callback(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      try {
        fs.mkdirSync(app.getPath("userData"), { recursive: true });
        const { SettingsStore } = require("./storage/settings-store.cjs");
        store = new SettingsStore(
          path.join(app.getPath("userData"), "settings.sqlite"),
        );
      } catch {
        store = null;
      }
      const broker = store ? createBroker({ capabilities, store }) : null;
      const url = pathToFileURL(
        path.join(app.getAppPath(), "dist/index.html"),
      ).href;
      let metadata = {
        version: app.getVersion(),
        source: null,
        updatedAt: null,
      };
      try {
        const value = JSON.parse(
          fs.readFileSync(
            path.join(app.getAppPath(), "dist/build-info.json"),
            "utf8",
          ),
        );
        if (
          /^[0-9a-f]{40}$/.test(value.source) &&
          typeof value.updatedAt === "string" &&
          new Date(value.updatedAt).toISOString() === value.updatedAt
        )
          metadata = {
            ...metadata,
            source: value.source,
            updatedAt: value.updatedAt,
          };
      } catch {}
      window = new BrowserWindow({
        icon: path.join(app.getAppPath(), "assets/branding/icon.ico"),
        width: 1440,
        height: 960,
        minWidth: 960,
        minHeight: 640,
        frame: false,
        show: false,
        backgroundColor: "#17151b",
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
          devTools: false,
        },
      });
      desktop = createDesktopSession({
        webContents: window.webContents,
        url,
        capabilities,
        broker,
        metadata,
        storageReady: !!store,
      });
      const workspaceService = createWorkspaceService({
        filePath: path.join(app.getPath("userData"), "workspace.json"),
      });
      const workspace = createWorkspaceIPC({
        desktop,
        service: workspaceService,
      });
      ipcMain.handle("studio:workspace:get", (event) => workspace.get(event));
      ipcMain.handle("studio:workspace:export", (event) =>
        workspace.export(event),
      );
      ipcMain.handle("studio:workspace:mutate", (event, value) =>
        workspace.mutate(event, value),
      );
      try {
        operations = createOperationsService({
          directory: path.join(app.getPath("userData"), "operations"),
          dialog,
          parentWindow: window,
          version: metadata.version,
          source: metadata.source,
          documentationDirectory: path.join(
            app.getAppPath(),
            "dist/documentation",
          ),
          openDocumentationExternal: (url) => shell.openExternal(url),
          workspaceRead: () => workspaceService.get(),
        });
      } catch {
        operations = null;
      }
      ipcMain.handle("studio:operations", (event, value) =>
        desktop.admitted(event)
          ? (operations?.request(value) ?? { ok: false, code: "UNAVAILABLE" })
          : { ok: false, code: "UNAUTHORIZED" },
      );
      ipcMain.handle("studio:bootstrap", (event) => desktop.bootstrap(event));
      ipcMain.handle("studio:request", (event, value) =>
        desktop.request(event, value),
      );
      ipcMain.handle("studio:window", (event, value) =>
        desktop.windowControl(event, value, window),
      );
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, target) => {
        if (target !== url) event.preventDefault();
      });
      window.webContents.on("will-frame-navigate", (event) => {
        if (event.url !== url || !event.isMainFrame) event.preventDefault();
      });
      window.webContents.on("will-attach-webview", (event) =>
        event.preventDefault(),
      );
      window.webContents.on(
        "did-start-navigation",
        (_event, _url, _inPlace, isMainFrame) => {
          if (isMainFrame) desktop.revoke();
        },
      );
      window.webContents.on("render-process-gone", () => desktop.revoke());
      window.webContents.on("destroyed", () => desktop.revoke());
      window.once("ready-to-show", () => window.show());
      window.loadURL(url);
    })
    .catch(() => app.quit());
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (operations && !quitting) {
      event.preventDefault();
      quitting = true;
      void operations.dispose().finally(() => app.quit());
      return;
    }
    desktop?.revoke();
    capabilities.clear();
    store?.close();
  });
}
