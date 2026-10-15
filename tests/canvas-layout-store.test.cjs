"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  createCanvasLayoutStore,
} = require("../src/main/storage/canvas-layout-store.cjs");
function setup(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-layout-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const directory = path.join(parent, "layouts");
  const workspaceId = randomUUID(),
    canvasId = "package-dependencies";
  return {
    parent,
    directory,
    workspaceId,
    canvasId,
    request: { workspaceId, canvasId },
    store: createCanvasLayoutStore({ directory }),
  };
}
const layout = () => ({
  nodes: [{ id: "package/busybox", x: -10000, y: 10000 }],
  viewport: { x: 25, y: -35, scale: 0.75 },
});
test("canvas locations persist independently across workspaces, canvases and restarts", (t) => {
  const { store, directory, request } = setup(t);
  assert.deepEqual(store.get(request), {
    revision: 0,
    layout: { nodes: [], viewport: { x: 0, y: 0, scale: 1 } },
  });
  assert.equal(fs.existsSync(directory), false);
  const saved = store.save({
    ...request,
    expectedRevision: 0,
    layout: layout(),
  });
  assert.equal(saved.revision, 1);
  const restarted = createCanvasLayoutStore({ directory });
  assert.deepEqual(restarted.get(request), saved);
  saved.layout.nodes[0].x = 123;
  assert.equal(store.get(request).layout.nodes[0].x, -10000);
  for (const other of [
    { ...request, canvasId: "guest-topology" },
    { ...request, workspaceId: randomUUID() },
  ]) {
    assert.equal(store.get(other).revision, 0);
    assert.equal(
      store.save({ ...other, expectedRevision: 0, layout: layout() }).revision,
      1,
    );
  }
  assert.equal(store.get(request).revision, 1);
});
test("stale revisions and failed atomic replacement retain the prior complete layout", (t) => {
  const { store, directory, request } = setup(t);
  store.save({ ...request, expectedRevision: 0, layout: layout() });
  const current = store.get(request);
  assert.throws(
    () =>
      createCanvasLayoutStore({ directory }).save({
        ...request,
        expectedRevision: 0,
        layout: layout(),
      }),
    { code: "REVISION_CONFLICT" },
  );
  const rename = fs.renameSync;
  fs.renameSync = () => {
    throw new Error("Simulated failure");
  };
  try {
    assert.throws(
      () =>
        store.save({
          ...request,
          expectedRevision: 1,
          layout: { nodes: [], viewport: { x: 0, y: 0, scale: 1 } },
        }),
      { code: "STORAGE_UNAVAILABLE" },
    );
  } finally {
    fs.renameSync = rename;
  }
  assert.deepEqual(store.get(request), current);
  assert.deepEqual(fs.readdirSync(path.join(directory, request.workspaceId)), [
    `${request.canvasId}.json`,
  ]);
});
test("malformed, foreign, duplicate-key and invalid UTF-8 documents remain unchanged", (t) => {
  const { store, directory, request } = setup(t);
  store.save({ ...request, expectedRevision: 0, layout: layout() });
  const file = path.join(
    directory,
    request.workspaceId,
    `${request.canvasId}.json`,
  );
  const valid = JSON.parse(fs.readFileSync(file, "utf8"));
  const fixtures = [
    Buffer.from("broken"),
    Buffer.from(JSON.stringify({ ...valid, format: "foreign" })),
    Buffer.from(JSON.stringify({ ...valid, workspaceId: randomUUID() })),
    Buffer.from(JSON.stringify({ ...valid, unsupported: true })),
    Buffer.from(
      JSON.stringify(valid).replace('"version":1', '"version":1,"version":1'),
    ),
    Buffer.from([0xff]),
  ];
  for (const bytes of fixtures) {
    fs.writeFileSync(file, bytes);
    assert.throws(() => store.get(request), { code: "STORAGE_UNAVAILABLE" });
    assert.throws(
      () => store.save({ ...request, expectedRevision: 0, layout: layout() }),
      { code: "STORAGE_UNAVAILABLE" },
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
  }
});
test("strict input rejects unknown fields, unsafe identities, duplicate nodes and nonfinite geometry", (t) => {
  const { store, request } = setup(t);
  for (const change of [
    { workspaceId: "../escape" },
    { canvasId: "other" },
    { path: "/outside" },
  ])
    assert.throws(() => store.get({ ...request, ...change }), {
      code: "INVALID_REQUEST",
    });
  const invalidLayouts = [
    { ...layout(), command: "execute" },
    { nodes: [{ id: "node", x: Infinity, y: 0 }], viewport: layout().viewport },
    { nodes: [{ id: "node", x: 0, y: NaN }], viewport: layout().viewport },
    { nodes: [{ id: "node", x: 10001, y: 0 }], viewport: layout().viewport },
    {
      nodes: [
        { id: "node", x: 0, y: 0 },
        { id: "node", x: 1, y: 1 },
      ],
      viewport: layout().viewport,
    },
    { nodes: new Array(1), viewport: layout().viewport },
    { nodes: [{ id: "__proto__", x: 0, y: 0 }], viewport: layout().viewport },
    {
      nodes: [{ id: "x".repeat(129), x: 0, y: 0 }],
      viewport: layout().viewport,
    },
    { nodes: [{ id: "\ud800", x: 0, y: 0 }], viewport: layout().viewport },
    { nodes: [], viewport: { x: 0, y: 0, scale: 0.249 } },
    { nodes: [], viewport: { x: 0, y: 0, scale: 2.001 } },
  ];
  for (const invalid of invalidLayouts)
    assert.throws(
      () => store.save({ ...request, expectedRevision: 0, layout: invalid }),
      { code: "INVALID_REQUEST" },
    );
  const accessor = { ...request };
  Object.defineProperty(accessor, "canvasId", {
    get() {
      throw new Error("Unexpected getter");
    },
  });
  assert.throws(() => store.get(accessor), { code: "INVALID_REQUEST" });
  assert.throws(() => store.get(Object.assign(Object.create(null), request)), {
    code: "INVALID_REQUEST",
  });
  assert.equal(store.get(request).revision, 0);
});
test("128 unique nodes and scale endpoints save while overflow preserves existing geometry", (t) => {
  const { store, request } = setup(t);
  const nodes = Array.from({ length: 128 }, (_, index) => ({
    id: `node-${index}`,
    x: index,
    y: -index,
  }));
  assert.equal(
    store.save({
      ...request,
      expectedRevision: 0,
      layout: { nodes, viewport: { x: -10000, y: 10000, scale: 0.25 } },
    }).revision,
    1,
  );
  assert.throws(
    () =>
      store.save({
        ...request,
        expectedRevision: 1,
        layout: {
          nodes: [...nodes, { id: "overflow", x: 0, y: 0 }],
          viewport: layout().viewport,
        },
      }),
    { code: "INVALID_REQUEST" },
  );
  assert.equal(
    store.save({
      ...request,
      expectedRevision: 1,
      layout: { nodes, viewport: { x: 0, y: 0, scale: 2 } },
    }).revision,
    2,
  );
});
test("symlink, hardlink and redirected directory storage fail closed", (t) => {
  const { store, directory, request, parent } = setup(t);
  store.save({ ...request, expectedRevision: 0, layout: layout() });
  const file = path.join(
    directory,
    request.workspaceId,
    `${request.canvasId}.json`,
  );
  const target = path.join(parent, "preserve");
  fs.renameSync(file, target);
  for (const link of [
    () => fs.symlinkSync(target, file),
    () => fs.linkSync(target, file),
  ]) {
    link();
    assert.throws(() => store.get(request), { code: "STORAGE_UNAVAILABLE" });
    assert.throws(
      () => store.save({ ...request, expectedRevision: 0, layout: layout() }),
      { code: "STORAGE_UNAVAILABLE" },
    );
    fs.unlinkSync(file);
  }
  const elsewhere = path.join(parent, "elsewhere");
  fs.mkdirSync(elsewhere);
  const redirected = path.join(parent, "redirected");
  fs.symlinkSync(elsewhere, redirected);
  const unsafe = createCanvasLayoutStore({
    directory: path.join(redirected, "new-child"),
  });
  assert.throws(() => unsafe.get(request), { code: "STORAGE_UNAVAILABLE" });
  assert.throws(
    () => unsafe.save({ ...request, expectedRevision: 0, layout: layout() }),
    { code: "STORAGE_UNAVAILABLE" },
  );
  assert.deepEqual(fs.readdirSync(elsewhere), []);
  assert.equal(JSON.parse(fs.readFileSync(target, "utf8")).revision, 1);
});
test("busy locks preserve existing layout and never authorize operations", (t) => {
  const { store, directory, request } = setup(t);
  store.save({ ...request, expectedRevision: 0, layout: layout() });
  const lock = path.join(
    directory,
    request.workspaceId,
    `${request.canvasId}.json.lock`,
  );
  fs.writeFileSync(lock, "owned elsewhere");
  assert.throws(
    () => store.save({ ...request, expectedRevision: 1, layout: layout() }),
    { code: "STORAGE_BUSY" },
  );
  assert.equal(store.get(request).revision, 1);
  assert.equal(fs.readFileSync(lock, "utf8"), "owned elsewhere");
  assert.deepEqual(Object.keys(store.get(request)).sort(), [
    "layout",
    "revision",
  ]);
});
