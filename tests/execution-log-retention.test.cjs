"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { boundedProcess } = require("../src/main/execution/index.cjs");
test("verbose execution streams all admitted logs while retaining bounded completion tails", async () => {
  let observed = 0;
  const result = await boundedProcess(process.execPath, ["-e", "process.stdout.write('x'.repeat(131072)+'END');process.stderr.write('y'.repeat(131072)+'ERR')"], {
    timeoutMs: 10000, maxBytes: 1024 * 1024, maxCapturedCharacters: 1024, onLog: event => { observed += event.text.length; }
  }).completion;
  assert.equal(result.state, "succeeded"); assert.equal(result.stdout.length, 1024); assert.equal(result.stderr.length, 1024);
  assert.equal(result.stdout.endsWith("END"), true); assert.equal(result.stderr.endsWith("ERR"), true); assert.equal(observed, 262150);
});
test("retained-tail mode still terminates a producer exceeding the total output ceiling", async () => {
  const result = await boundedProcess(process.execPath, ["-e", "process.stdout.write('x'.repeat(131072));setTimeout(()=>{},10000)"], { timeoutMs: 10000, maxBytes: 65536, maxCapturedCharacters: 1024 }).completion;
  assert.equal(result.state, "output-limit"); assert.ok(result.stdout.length <= 1024);
});
