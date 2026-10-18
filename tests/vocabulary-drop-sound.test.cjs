"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { EventEmitter } = require("node:events"), fs = require("node:fs"), vm = require("node:vm");
const { createVocabularyDropSound, playNativeSound, validRequest } = require("../src/main/vocabulary-drop-sound.cjs");
test("sound admission accepts only an exact outcome enum and never reads getters", async () => {
  let reads = 0, played = 0;
  const accessor = Object.defineProperty({}, "kind", { enumerable: true, get() { reads++; return "applied"; } });
  for (const input of [null, [], "applied", {}, { kind: "other" }, { kind: "applied", path: "any.wav" }, { kind: "invalid", payload: {} }, accessor, { kind: "applied", [Symbol()]: true }, Object.create({ kind: "applied" })]) assert.equal(validRequest(input), false);
  assert.equal(reads, 0);
  const service = createVocabularyDropSound({ admitted: event => event === "owner", play: async () => { played++; return true; } });
  assert.equal((await service.request("other", { kind: "applied" })).code, "UNAUTHORIZED");
  assert.equal((await service.request("owner", { kind: "applied", command: "anything" })).code, "INVALID_REQUEST");
  assert.equal(played, 0);
  assert.deepEqual(await service.request("owner", { kind: "invalid" }), { ok: true, status: "requested" });
});
test("ordered sounds bound the queue and recheck authority before playback", async () => {
  const starts = [], releases = []; let allowed = true;
  const service = createVocabularyDropSound({ admitted: () => allowed, play: kind => { starts.push(kind); return new Promise(resolve => releases.push(resolve)); } });
  const first = service.request({}, { kind: "applied" }); await Promise.resolve();
  const second = service.request({}, { kind: "invalid" });
  const third = service.request({}, { kind: "applied" }); const fourth = service.request({}, { kind: "invalid" });
  assert.equal((await service.request({}, { kind: "invalid" })).code, "SOUND_QUEUE_FULL");
  assert.deepEqual(starts, ["applied"]); releases.shift()(true); await first; await Promise.resolve();
  assert.deepEqual(starts, ["applied", "invalid"]); allowed = false; releases.shift()(true);
  await second; assert.equal((await third).code, "UNAUTHORIZED"); assert.equal((await fourth).code, "UNAUTHORIZED"); assert.equal(starts.length, 2);
});
test("unavailable playback stays separate and native launch uses only fixed local scripts", async () => {
  const unavailable = createVocabularyDropSound({ admitted: () => true, play: async () => { throw Error("backend unavailable"); } });
  assert.deepEqual(await unavailable.request({}, { kind: "applied" }), { ok: false, status: "unavailable", code: "SOUND_UNAVAILABLE" });
  const launches = [];
  const launch = (file, args, options) => { launches.push({ file, args, options }); const child = new EventEmitter(); child.kill = () => {}; queueMicrotask(() => child.emit("exit", 0)); return child; };
  for (const kind of ["applied", "invalid"]) assert.equal(await playNativeSound(kind, { platform: "win32", windowsRoot: "C:\\Windows", launch }), true);
  assert.equal(launches.length, 2); for (const call of launches) { assert.equal(call.options.shell, false); assert.equal(call.options.windowsHide, true); assert.equal(call.options.stdio, "ignore"); assert.equal(call.args[3], "-EncodedCommand"); }
  const applied = Buffer.from(launches[0].args[4], "base64").toString("utf16le"), invalid = Buffer.from(launches[1].args[4], "base64").toString("utf16le");
  assert.match(applied, /Media\\tada\.wav/); assert.match(invalid, /SystemHand/); assert.doesNotMatch(applied + invalid, /SetVolume|http:|https:|Invoke-Expression/);
  assert.equal(await playNativeSound("invalid", { platform: "linux", launch }), false);
  assert.equal(await playNativeSound("invalid", { platform: "win32", windowsRoot: "\\\\server\\share", launch }), false); assert.equal(launches.length, 2);
});
test("preload sends only a fresh admitted enum object", async () => {
  const calls = [], sandbox = { require: name => { assert.equal(name, "electron"); return { contextBridge: { exposeInMainWorld: (_name, api) => { sandbox.api = api; } }, ipcRenderer: { invoke: async (...args) => { calls.push(args); return { ok: true, status: "requested" }; } } }; } };
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync(require.resolve("../src/main/preload.cjs"), "utf8"), sandbox);
  await vm.runInContext("api.vocabularyDropSound({kind:'applied'})", sandbox);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], "studio:vocabulary-drop-sound"); assert.equal(calls[0][1].kind, "applied");
  assert.equal((await vm.runInContext("api.vocabularyDropSound({kind:'applied',path:'extra'})", sandbox)).code, "INVALID_REQUEST"); assert.equal(calls.length, 1);
});
