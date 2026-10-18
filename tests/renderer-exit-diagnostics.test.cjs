"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { recordRendererExit } = require("../src/main/renderer-exit-diagnostics.cjs");
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "renderer-exit-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, metadata: { source: "a".repeat(40), version: "0.1.1", private: "excluded" }, now: () => new Date("2026-10-18T09:19:36.000Z") };
}
test("renderer exit receipt records exact cause and excludes all other input", t => {
  const input = fixture(t);
  assert.equal(recordRendererExit({ ...input, details: { reason: "crashed", exitCode: 139, url: "private", pageContent: "private", profilePath: "private", env: "private" } }), true);
  const receipt = JSON.parse(fs.readFileSync(path.join(input.directory, "renderer-exit.json"), "utf8"));
  assert.deepEqual(receipt, { schemaVersion: 1, event: "renderer-exit", reason: "crashed", exitCode: 139, source: "a".repeat(40), version: "0.1.1", timestamp: "2026-10-18T09:19:36.000Z" });
  assert.equal(recordRendererExit({ ...input, details: { reason: "unknown private reason", exitCode: -1 } }), true);
  assert.deepEqual(fs.readdirSync(input.directory), ["renderer-exit.json"]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(input.directory, "renderer-exit.json"))).reason, "unknown");
});
test("invalid numeric outcomes preserve the previous receipt and metadata is bounded", t => {
  const input = fixture(t), file = path.join(input.directory, "renderer-exit.json");
  assert.equal(recordRendererExit({ ...input, metadata: { source: "private", version: "private" }, details: { reason: "oom", exitCode: 0 } }), true);
  const before = fs.readFileSync(file, "utf8"), receipt = JSON.parse(before);
  assert.equal(receipt.source, null); assert.equal(receipt.version, null);
  for (const exitCode of [undefined, "139", NaN, Infinity, 2147483648, -2147483649]) assert.equal(recordRendererExit({ ...input, details: { reason: "crashed", exitCode } }), false);
  assert.equal(fs.readFileSync(file, "utf8"), before);
});
test("diagnostic write failure remains nonthrowing and listener still revokes first", t => {
  const input = fixture(t), blocked = path.join(input.directory, "blocked"); fs.writeFileSync(blocked, "file");
  assert.equal(recordRendererExit({ ...input, directory: blocked, details: { reason: "killed", exitCode: 1 } }), false);
  const source = fs.readFileSync(path.resolve(__dirname, "../src/main/index.cjs"), "utf8");
  assert.match(source, /on\("render-process-gone", \(_event, details\) => \{\s*desktop\.revoke\(\);\s*recordRendererExit\(/);
});
