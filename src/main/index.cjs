"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  dialog,
  shell,
  safeStorage,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { recordRendererExit } = require("./renderer-exit-diagnostics.cjs");
const { createVocabularyDropSound } = require("./vocabulary-drop-sound.cjs");
const { pathToFileURL } = require("node:url");
const { createCapabilityRegistry } = require("./security/capabilities.cjs");
const { createBroker } = require("./broker.cjs");
const { createDesktopSession } = require("./security/desktop-session.cjs");
const { createWorkspaceService } = require("./workspace-service.cjs");
const { createWorkspaceIPC } = require("./security/workspace-ipc.cjs");
const { createOperationsService } = require("./operations-service.cjs");
const { documentationDirectory } = require("./documentation/directory.cjs");
const { createExperienceIPC } = require("./experience-policies.cjs");
const {createWorkspaceTabRegistry}=require('./workspace-tabs.cjs');
const workspaceTabs=createWorkspaceTabRegistry();
const { createUpdateHost } = require("./updates/host.cjs");
const { createVault } = require("./security/vault.cjs");
const { createAuthenticatorIPC } = require("./security/authenticator-controller.cjs");
const {
  createSharedModeService,
} = require("./privacy/shared-mode-service.cjs");
const { createSharedModeIPC } = require("./privacy/shared-mode-ipc.cjs");
const { createAppearanceFonts } = require('./appearance-fonts.cjs');
const appearanceFonts = createAppearanceFonts();
const {createAppearanceHistory}=require('./appearance-history.cjs');
const { createScheduleIPC } = require("./preferences/schedule-ipc.cjs");
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
let store, window, desktop, operations, sharedModeIPC, unsubscribeSharedMode;
let scheduleIPC, unsubscribeSchedule;
let statusService;
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
    .then(async () => {
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
      workspaceTabs.register(window,desktop,url);
      const vocabularyDropSound = createVocabularyDropSound({ admitted: event => desktop.admitted(event) });
      ipcMain.handle("studio:vocabulary-drop-sound", (event, value) => vocabularyDropSound.request(event, value));
      ipcMain.handle('studio:workspace-tabs',(event,value)=>workspaceTabs.request(event,value));
      statusService = require("./status-hub/service.cjs").createStatusService({
        documentsDirectory: app.getPath("documents"),
        repositoryDirectory: app.getAppPath(),
      });
      ipcMain.handle("studio:status-hub", (event, action) => {
        if (!desktop.admitted(event)) return { ok: false, code: "UNAUTHORIZED" };
        if (action === "read") return { ok: true, result: statusService.snapshot() };
        if (action === "refresh") return statusService.refresh().then(result => ({ ok: true, result }));
        return { ok: false, code: "INVALID_REQUEST" };
      });
      let notifications;
      try { notifications=require('./notification-host.cjs').createNotificationHost({
        directory:path.join(app.getPath('userData'),'notifications'),admitted:event=>desktop.admitted(event),openExternal:url=>shell.openExternal(url),
        changed:()=>{if(!window.webContents.isDestroyed()&&window.webContents.mainFrame.url===url)window.webContents.send('studio:notifications:changed');},
      }); } catch { notifications=null; }
      ipcMain.handle('studio:notifications',(event,value)=>notifications?notifications.request(event,value):{ok:false,code:'NOTIFICATION_UNAVAILABLE'});
      let sharedModeService;
      try {
        // Common protocol location, separate from this application's workspace/profile.
        // Other applications must explicitly adopt the same protocol and vault provider.
        const localData =
          process.platform === "win32"
            ? process.env.LOCALAPPDATA
            : process.env.XDG_DATA_HOME ||
              path.join(app.getPath("home"), ".local", "share");
        if (
          typeof localData !== "string" ||
          !path.isAbsolute(localData) ||
          /[\x00-\x1f]/.test(localData)
        )
          throw Error("Local storage unavailable");
        const sharedDirectory = verification.length
          ? path.join(
              app.getPath("userData"),
              "verification-shared-experience-v1",
            )
          : path.join(localData, "Ding-Ding Projects", "shared-experience-v1");
        sharedModeService = createSharedModeService({
          sharedDirectory,
          vault: createVault({
            safeStorage,
            directory: path.join(sharedDirectory, "credentials"),
          }),
        });
        await sharedModeService.start();
      } catch {
        sharedModeService?.close();
        sharedModeService = undefined;
      }
      const attentionHistory=require('./preferences/attention-history.cjs').createAttentionHistory({filePath:path.join(app.getPath('userData'),'attention-history')});
      ipcMain.handle('studio:attention-history',(event,value)=>desktop.admitted(event)?attentionHistory.request(value):{ok:false,code:'UNAUTHORIZED'});
      const dimSum=require('./preferences/dim-sum.cjs').createDimSum({directory:path.join(app.getPath('userData'),'public-dim-sum-cache'),allowed:()=>{const s=sharedModeService?.status();return s?.available===true&&s.active===false;}});
      ipcMain.handle('studio:dim-sum',(event,value)=>desktop.admitted(event)?dimSum.request(value):{ok:false,code:'UNAUTHORIZED'});
      const appearanceHistory=createAppearanceHistory({filePath:path.join(app.getPath('userData'),'appearance-history'),fonts:appearanceFonts});
      ipcMain.handle('studio:appearance-history',(event,value)=>desktop.admitted(event)?appearanceHistory.request(value):{ok:false,code:'UNAUTHORIZED'});
      ipcMain.handle('studio:appearance-fonts', (event) => desktop.admitted(event) ? appearanceFonts.read() : {ok:false,code:'UNAUTHORIZED'});
      sharedModeIPC = createSharedModeIPC({
        desktop,
        service: sharedModeService,
      });
      ipcMain.handle("studio:shared-mode", (event, value) =>
        sharedModeIPC.request(event, value),
      );
      unsubscribeSharedMode = sharedModeService?.subscribe((snapshot) => {
        if (
          !window.isDestroyed() &&
          !window.webContents.isDestroyed() &&
          window.webContents.mainFrame.url === url
        ) {
          try {
            window.webContents.send("studio:shared-mode:event", snapshot);
          } catch {}
        }
      });
      const authenticatorIPC = createAuthenticatorIPC({desktop, directory:app.getPath("userData"), safeStorage});
      window.webContents.on("did-start-navigation", () => authenticatorIPC.revoke());
      window.webContents.on("destroyed", () => authenticatorIPC.revoke());
      ipcMain.handle("studio:authenticator", (event,value) => authenticatorIPC.request(event,value));
      const experienceIPC = createExperienceIPC({ desktop, directory: app.getPath("userData"), safeStorage, openFolder: folder => shell.openPath(folder), schoolMode: () => sharedModeService?.status()?.active !== false });
      ipcMain.handle("studio:experience-policies", (event, value) => experienceIPC.request(event, value));
      const workspaceService = createWorkspaceService({
        filePath: path.join(app.getPath("userData"), "workspace.json"),
      });
      const workspace = createWorkspaceIPC({
        desktop,
        service: workspaceService,
      });
      let scheduleService;
      try {
        const { createSchedulePreferencesService } = await import(
          "./preferences/service.mjs"
        );
        scheduleService = await createSchedulePreferencesService({
          directory: path.join(
            app.getPath("userData"),
            "scheduled-preferences",
          ),
          profileId: "desktop",
          sourceEnrollments: [],
          baseReader: () => {
            const language = store?.read(
              "desktop-owner",
              "desktop-settings",
            )?.language;
            const workspace = workspaceService.get();
            if (!language || !workspace.ok)
              throw Error("Base preferences unavailable");
            return {
              language,
              "appearance.theme": workspace.state.preferences.theme,
              "appearance.profile": null,
            };
          },
          vault: createVault({
            safeStorage,
            directory: path.join(
              app.getPath("userData"),
              "scheduled-preferences",
              "credentials",
            ),
          }),
        });
        await scheduleService.start();
      } catch {
        await scheduleService?.close();
        scheduleService = undefined;
      }
      scheduleIPC = createScheduleIPC({ desktop, service: scheduleService, sharedModeStatus: () => sharedModeService?.status() });
      ipcMain.handle("studio:scheduled-preferences", (event, value) =>
        scheduleIPC.request(event, value),
      );
      unsubscribeSchedule = scheduleService?.subscribe((snapshot) => {
        if (
          !window.isDestroyed() &&
          !window.webContents.isDestroyed() &&
          window.webContents.mainFrame.url === url
        ) {
          try {
            window.webContents.send(
              "studio:scheduled-preferences:event",
              snapshot,
            );
          } catch {}
        }
      });
      ipcMain.handle("studio:workspace:get", (event) => workspace.get(event));
      ipcMain.handle("studio:workspace:export", (event) =>
        workspace.export(event),
      );
      ipcMain.handle("studio:workspace:mutate", (event, value) =>
        Promise.resolve(workspace.mutate(event,value)).then(result=>{if(result.ok)notifications?.notify('Workspace saved','A workspace change was saved locally.','success');return result;}),
      );
      try {
        operations = createOperationsService({
          directory: path.join(app.getPath("userData"), "operations"),
          cloudVault: createVault({ safeStorage, directory: path.join(app.getPath("userData"), "cloud-credentials") }),
          dialog,
          parentWindow: window,
          version: metadata.version,
          source: metadata.source,
          updateHostFactory: ({ canInstall }) => createUpdateHost({ app, window, dialog, shell, currentSource: metadata.source, canInstall }),
          notificationTransition: ({state}) => {
            if (['succeeded','failed','cancelled','interrupted'].includes(state)) notifications?.notify('Build job status', `A recorded build job is ${state}. Open the build queue to inspect its output.`, state==='succeeded'?'success':state==='failed'?'error':'warning');
          },
          documentationDirectory: documentationDirectory({
            isPackaged: app.isPackaged,
            appPath: app.getAppPath(),
            resourcesPath: process.resourcesPath,
          }),
          openDocumentationExternal: (url) => shell.openExternal(url),
          openWslPath: (folder) => shell.openPath(folder),
          workspaceRead: () => workspaceService.get(),
        });
      } catch {
        operations = null;
      }
      ipcMain.handle("studio:operations", async (event, value) =>
        desktop.admitted(event)
          ? await (async()=>{const result=await (operations?.request(value)??{ok:false,code:'UNAVAILABLE'});if(!result.ok)notifications?.notify('Operation did not complete','Return to the originating workspace to inspect the result. No success is inferred.','error');return result;})()
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
      window.webContents.on("render-process-gone", (_event, details) => {
        desktop.revoke();
        recordRendererExit({ directory: path.join(app.getPath("userData"), "diagnostics"), metadata, details });
      });
      window.webContents.on("destroyed", () => desktop.revoke());
      window.once("ready-to-show", () => window.show());
      await window.loadURL(url);
    })
    .catch(() => app.quit());
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    unsubscribeSharedMode?.();
    sharedModeIPC?.close();
    unsubscribeSchedule?.();
    if ((operations || scheduleIPC || statusService) && !quitting) {
      event.preventDefault();
      quitting = true;
      void Promise.allSettled([
        statusService?.close(),
        operations?.dispose(),
        scheduleIPC?.close(),
      ]).then(() => app.quit());
      return;
    }
    desktop?.revoke();
    capabilities.clear();
    store?.close();
  });
}



