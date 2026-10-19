"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("transferProgress", Object.freeze({
  read: () => ipcRenderer.invoke("studio:transfer-progress", "read"),
  cancel: () => ipcRenderer.invoke("studio:transfer-progress", "cancel"),
  close: () => ipcRenderer.invoke("studio:transfer-progress", "close"),
}));
