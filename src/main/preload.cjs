"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === keys
  );
}
function validScheduleSnapshot(value) {
  if (
    !exactKeys(
      value,
      "available,effective,evaluatedAt,externalAvailable,revision,running,watching",
    ) ||
    ["available", "watching", "running", "externalAvailable"].some(
      (key) => typeof value[key] !== "boolean",
    ) ||
    (value.revision !== null &&
      (!Number.isSafeInteger(value.revision) || value.revision < 0)) ||
    (value.evaluatedAt !== null &&
      (!Number.isSafeInteger(value.evaluatedAt) || value.evaluatedAt < 0))
  )
    return false;
  if (value.effective === null) return true;
  const effective = value.effective;
  const id = (value) =>
    typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
  return (
    exactKeys(effective, "appliedRuleIds,issues,provenance,values") &&
    exactKeys(effective.values, "appearance.profile,appearance.theme,language") &&
    ["en", "zh-HK", "bilingual"].includes(effective.values.language) &&
    ["system", "light", "dark"].includes(
      effective.values["appearance.theme"],
    ) &&
    (effective.values["appearance.profile"] === null || typeof effective.values["appearance.profile"] === "string" && /^p[a-f0-9-]{36}$/.test(effective.values["appearance.profile"])) &&
    exactKeys(effective.provenance, "appearance.profile,appearance.theme,language") &&
    Object.values(effective.provenance).every(
      (value) => value === null || id(value),
    ) &&
    Array.isArray(effective.appliedRuleIds) &&
    effective.appliedRuleIds.length <= 256 &&
    effective.appliedRuleIds.every(id) &&
    Array.isArray(effective.issues) &&
    effective.issues.length <= 256 &&
    effective.issues.every(
      (issue) =>
        exactKeys(issue, "code,ruleId") &&
        id(issue.ruleId) &&
        typeof issue.code === "string" &&
        /^[A-Z][A-Z_]{0,95}$/.test(issue.code),
    )
  );
}
function scheduleRequest(request) {
  let serialized;
  try {
    serialized = JSON.stringify(request);
  } catch {
    return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
  }
  if (typeof serialized !== "string" || serialized.length > 264192)
    return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
  return ipcRenderer.invoke("studio:scheduled-preferences", serialized);
}
function validModeSnapshot(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).sort().join(",") !==
      "active,available,configured,credentialKind,displayName,revision,watching"
  )
    return false;
  if (
    typeof value.available !== "boolean" ||
    typeof value.watching !== "boolean" ||
    ![true, false, null].includes(value.active) ||
    ![true, false, null].includes(value.configured)
  )
    return false;
  if (
    value.displayName !== null &&
    (typeof value.displayName !== "string" ||
      [...value.displayName].length > 96 ||
      !value.displayName.trim() ||
      /[\u0000-\u001f\u007f]/u.test(value.displayName))
  )
    return false;
  if (
    value.revision !== null &&
    (typeof value.revision !== "string" || !uuid.test(value.revision))
  )
    return false;
  if (![null, "pin", "password", "passkey"].includes(value.credentialKind))
    return false;
  if (!value.available)
    return (
      value.active === null &&
      value.configured === null &&
      value.revision === null &&
      value.credentialKind === null
    );
  if (
    !value.watching ||
    typeof value.active !== "boolean" ||
    typeof value.configured !== "boolean"
  )
    return false;
  if (!value.configured)
    return (
      value.active === false &&
      value.displayName === null &&
      value.revision === null &&
      value.credentialKind === null
    );
  return (
    value.displayName !== null &&
    typeof value.revision === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value.revision,
    ) &&
    (!value.active || value.credentialKind !== null)
  );
}
function modeRequest(request) {
  let serialized;
  try {
    serialized = JSON.stringify(request);
  } catch {
    return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
  }
  if (typeof serialized !== "string" || serialized.length > 16384)
    return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
  return ipcRenderer.invoke("studio:shared-mode", serialized);
}
function validEvent(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).sort().join(",") ===
      "operationId,sequence,state,timestamp,version" &&
    value.version === 1 &&
    Number.isSafeInteger(value.sequence) &&
    value.sequence > 0 &&
    typeof value.operationId === "string" &&
    uuid.test(value.operationId) &&
    typeof value.timestamp === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.timestamp) &&
    Number.isFinite(Date.parse(value.timestamp)) &&
    new Date(value.timestamp).toISOString() === value.timestamp &&
    value.state === "succeeded"
  );
}
contextBridge.exposeInMainWorld(
  "studio",
  Object.freeze({
    notifications: request => {let value;try{value=JSON.stringify(request);}catch{return Promise.resolve({ok:false,code:'INVALID_REQUEST'});}return typeof value==='string'&&value.length<=16384?ipcRenderer.invoke('studio:notifications',value):Promise.resolve({ok:false,code:'INVALID_REQUEST'});},
    onNotificationsChanged: listener => {if(typeof listener!=='function')return ()=>{};const handler=()=>listener();ipcRenderer.on('studio:notifications:changed',handler);return ()=>ipcRenderer.removeListener('studio:notifications:changed',handler);},
    workspaceTabs: (request) => {let value;try{value=JSON.stringify(request);}catch{return Promise.resolve({ok:false,code:'INVALID_REQUEST'});}if(typeof value!=='string'||value.length>262144)return Promise.resolve({ok:false,code:'INVALID_REQUEST'});return ipcRenderer.invoke('studio:workspace-tabs',value);},
    onWorkspaceTabActivate: (listener) => {if(typeof listener!=='function')return ()=>{};const handler=(_event,value)=>{if(value&&typeof value.tabId==='string'&&value.tabId.length<=256)listener(value.tabId);};ipcRenderer.on('studio:workspace-tabs:activate',handler);return ()=>ipcRenderer.removeListener('studio:workspace-tabs:activate',handler);},
    onWorkspaceTabsChanged: (listener) => {if(typeof listener!=='function')return ()=>{};const handler=()=>listener();ipcRenderer.on('studio:workspace-tabs:changed',handler);return ()=>ipcRenderer.removeListener('studio:workspace-tabs:changed',handler);},
    statusHub: (action) => ["read", "refresh"].includes(action) ? ipcRenderer.invoke("studio:status-hub", action) : Promise.resolve({ ok: false, code: "INVALID_REQUEST" }),
    appearanceHistory: (request) => { let data; try { data=JSON.stringify(request); } catch { return Promise.resolve({ok:false,code:'INVALID_REQUEST'}); } if(data.length>650000)return Promise.resolve({ok:false,code:'INVALID_REQUEST'}); return ipcRenderer.invoke('studio:appearance-history',JSON.parse(data)); },
    attentionHistory: (request) => { let serialized;try {serialized=JSON.stringify(request);}catch{return Promise.resolve({ok:false,code:'INVALID_REQUEST'});}if(typeof serialized!=='string'||serialized.length>2048)return Promise.resolve({ok:false,code:'INVALID_REQUEST'});return ipcRenderer.invoke('studio:attention-history',JSON.parse(serialized)); },
    dimSum: (value) => { if(!value||!['catalog','photo','surprise'].includes(value.action)||Object.keys(value).some(k=>!['action','id'].includes(k))||value.id!==undefined&&(typeof value.id!=='string'||!/^hk-dish-\d{4}$/.test(value.id)))return Promise.resolve({ok:false,code:'INVALID_REQUEST'});return ipcRenderer.invoke('studio:dim-sum',{action:value.action,...(value.id?{id:value.id}:{})}); },
    appearanceFonts: () => ipcRenderer.invoke('studio:appearance-fonts'),
    authenticator: (request) => {
      let serialized; try { serialized=JSON.stringify(request); } catch { return Promise.resolve({ok:false,code:"INVALID_REQUEST"}); }
      if(typeof serialized!=="string" || serialized.length>8192) return Promise.resolve({ok:false,code:"INVALID_REQUEST"});
      return ipcRenderer.invoke("studio:authenticator",serialized);
    },
    experiencePolicies: (request) => {
      let serialized;
      try { serialized = JSON.stringify(request); } catch { return Promise.resolve({ok:false,code:"INVALID_REQUEST"}); }
      if (typeof serialized !== "string" || serialized.length > 16384) return Promise.resolve({ok:false,code:"INVALID_REQUEST"});
      return ipcRenderer.invoke("studio:experience-policies", serialized);
    },
    scheduledPreferences: scheduleRequest,
    onScheduledPreferences: (listener) => {
      if (typeof listener !== "function")
        throw new TypeError("Listener must be a function.");
      let active = true;
      const wrapped = (_event, value) => {
        if (!active || !validScheduleSnapshot(value)) return;
        const effective =
          value.effective &&
          Object.freeze({
            values: Object.freeze({ ...value.effective.values }),
            provenance: Object.freeze({ ...value.effective.provenance }),
            appliedRuleIds: Object.freeze([...value.effective.appliedRuleIds]),
            issues: Object.freeze(
              value.effective.issues.map((issue) =>
                Object.freeze({ ...issue }),
              ),
            ),
          });
        listener(Object.freeze({ ...value, effective }));
      };
      ipcRenderer.on("studio:scheduled-preferences:event", wrapped);
      return () => {
        active = false;
        ipcRenderer.removeListener(
          "studio:scheduled-preferences:event",
          wrapped,
        );
      };
    },
    sharedMode: modeRequest,
    sharedModeRecovery: () => modeRequest({ action: "recovery" }),
    onSharedMode: (listener) => {
      if (typeof listener !== "function")
        throw new TypeError("Listener must be a function.");
      let active = true;
      const wrapped = (_event, value) => {
        if (active && validModeSnapshot(value))
          listener(Object.freeze({ ...value }));
      };
      ipcRenderer.on("studio:shared-mode:event", wrapped);
      return () => {
        active = false;
        ipcRenderer.removeListener("studio:shared-mode:event", wrapped);
      };
    },
    operations: (request) => {
      let serialized;
      try {
        serialized = JSON.stringify(request);
      } catch {
        return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
      }
      if (typeof serialized !== "string" || serialized.length > 1024 * 1024)
        return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
      return ipcRenderer.invoke("studio:operations", serialized);
    },
    workspaceGet: () => ipcRenderer.invoke("studio:workspace:get"),
    workspaceExport: () => ipcRenderer.invoke("studio:workspace:export"),
    workspaceMutate: (request) => {
      let serialized;
      try {
        serialized = JSON.stringify(request);
      } catch {
        return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
      }
      if (typeof serialized !== "string" || serialized.length > 1024 * 1024)
        return Promise.resolve({ ok: false, code: "INVALID_REQUEST" });
      return ipcRenderer.invoke("studio:workspace:mutate", serialized);
    },
    bootstrap: () => ipcRenderer.invoke("studio:bootstrap"),
    request: (request) => {
      let serialized;
      try {
        serialized = JSON.stringify(request);
      } catch {
        return Promise.resolve({
          ok: false,
          code: "REQUEST_SCHEMA",
          message: "The operation request is not valid.",
        });
      }
      if (typeof serialized !== "string" || serialized.length > 65536)
        return Promise.resolve({
          ok: false,
          code: "REQUEST_TOO_LARGE",
          message: "The operation request is not valid.",
        });
      return ipcRenderer.invoke("studio:request", serialized);
    },
    windowControl: (command) =>
      ["minimize", "maximize-restore", "close"].includes(command)
        ? ipcRenderer.invoke("studio:window", command)
        : Promise.resolve(false),
    onEvent: (listener) => {
      if (typeof listener !== "function")
        throw new TypeError("Listener must be a function.");
      let active = true;
      const wrapped = (_event, value) => {
        if (active && validEvent(value)) listener(Object.freeze({ ...value }));
      };
      ipcRenderer.on("studio:event", wrapped);
      return () => {
        active = false;
        ipcRenderer.removeListener("studio:event", wrapped);
      };
    },
  }),
);



