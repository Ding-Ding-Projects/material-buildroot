"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createToolFiles } = require("../src/main/security/tool-files.cjs");
const {
  createOperationsService,
} = require("../src/main/operations-service.cjs");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tool-files-"));
  const input = path.join(root, "input.json"),
    output = path.join(root, "output.json");
  fs.writeFileSync(input, '{"result":42}');
  let selected = input,
    consent = 0;
  const dialog = {
    showOpenDialog: async () => ({ canceled: false, filePaths: [selected] }),
    showSaveDialog: async () => ({ canceled: false, filePath: output }),
    showMessageBox: async () => ({ response: consent }),
  };
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    input,
    output,
    dialog,
    select: (value) => {
      selected = value;
    },
    consent: (value) => {
      consent = value;
    },
  };
}
test("native selections authorize only exact files, reject replacement and preserve existing output", async (t) => {
  const f = fixture(t),
    files = createToolFiles(f);
  const input = await files.choose({ access: "read", kind: "file" });
  assert.deepEqual(Object.keys(input).sort(), ["id", "kind", "name"]);
  assert.equal(files.resolve(input.id, "read"), f.input);
  assert.throws(() => files.resolve(input.id, "write"), {
    code: "FILE_GRANT_REQUIRED",
  });
  fs.renameSync(f.input, f.input + ".old");
  fs.writeFileSync(f.input, "replacement");
  assert.throws(() => files.resolve(input.id, "read"), {
    code: "GRANT_CHANGED",
  });
  const output = await files.choose({ access: "write", kind: "file" });
  fs.writeFileSync(f.output, "preserved");
  assert.throws(() => files.resolve(output.id, "write"), {
    code: "OUTPUT_ALREADY_EXISTS",
  });
  await assert.rejects(files.choose({ access: "write", kind: "file" }), {
    code: "OUTPUT_ALREADY_EXISTS",
  });
  assert.equal(fs.readFileSync(f.output, "utf8"), "preserved");
});
test("server directory needs native consent and loses authority when the session closes", async (t) => {
  const f = fixture(t),
    files = createToolFiles(f);
  f.select(f.root);
  await assert.rejects(files.choose({ access: "write", kind: "directory" }), {
    code: "SOURCE_CONSENT_REQUIRED",
  });
  const readonly = await files.choose({ access: "read", kind: "directory" });
  assert.equal(files.serverAuthorized(readonly.id), false);
  f.consent(1);
  const authorized = await files.choose({ access: "write", kind: "directory" });
  assert.equal(files.serverAuthorized(authorized.id), true);
  files.dispose();
  assert.equal(files.serverAuthorized(authorized.id), false);
});
test("a chosen output cannot escape through a replaced parent directory", async (t) => {
  const f = fixture(t),
    files = createToolFiles(f);
  const output = await files.choose({ access: "write", kind: "file" });
  const original = f.root + ".original";
  fs.renameSync(f.root, original);
  fs.mkdirSync(f.root);
  t.after(() => fs.rmSync(original, { recursive: true, force: true }));
  assert.throws(() => files.resolve(output.id, "write"), {
    code: "GRANT_CHANGED",
  });
});
test("desktop tool workflow writes a real queued conversion from native file selections", async (t) => {
  const f = fixture(t);
  const service = createOperationsService({
    directory: path.join(f.root, "state"),
    dialog: f.dialog,
    version: "0.1.0",
    source: null,
  });
  const request = (value) => service.request(JSON.stringify(value));
  try {
    const input = await request({
      action: "file.choose",
      access: "read",
      kind: "file",
    });
    const output = await request({
      action: "file.choose",
      access: "write",
      kind: "file",
    });
    assert.equal(input.ok, true);
    assert.equal(output.ok, true);
    const job = {
      action: "converter.convert",
      category: "structured",
      format: "json",
      sourceId: input.result.id,
      destinationId: output.result.id,
    };
    const rejected = await request({
      action: "tools",
      request: { ...job, command: "forbidden" },
    });
    assert.equal(rejected.ok, false);
    assert.equal(fs.existsSync(f.output), false);
    const queued = await request({
      action: "tools",
      request: { action: "queue.add", job },
    });
    assert.equal(queued.ok, true);
    const run = await request({
      action: "tools",
      request: { action: "queue.run" },
    });
    assert.equal(run.result.completed, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.output, "utf8")), {
      result: 42,
    });
    const page = await request({
      action: "tools",
      request: { action: "queue.page" },
    });
    assert.equal(page.result.items[0].state, "completed");
    assert.match(page.result.items[0].result.sha256, /^[0-9a-f]{64}$/);
    const companion = await request({
      action: "companion",
      request: { action: "companion.status", args: {} },
    });
    assert.equal(companion.result.enabled, false);
    assert.deepEqual(companion.result.allowedScopes, [
      "workspace:read",
      "projects:read",
      "jobs:read",
    ]);
    assert.equal(
      (
        await request({
          action: "companion",
          request: {
            action: "companion.createPairing",
            args: { origin: "https://example.com", scopes: ["builds:submit"] },
          },
        })
      ).ok,
      false,
    );
  } finally {
    await service.dispose();
  }
});
