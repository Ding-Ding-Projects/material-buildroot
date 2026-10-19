"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  createProjectOptionsStore,
} = require("../src/main/storage/project-options-store.cjs");
function setup(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "project-options-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const directory = path.join(parent, "options"),
    workspaceId = randomUUID();
  return {
    parent,
    directory,
    workspaceId,
    request: { workspaceId },
    store: createProjectOptionsStore({ directory }),
  };
}
const wsl = () => ({ kind: "wsl", distribution: "Ubuntu-24.04" });
const docker = () => ({
  kind: "docker",
  image: `registry.example/buildroot@sha256:${"a".repeat(64)}`,
  uid: 1000,
  gid: 1000,
});
test("runtime and external tree metadata persist independently without granting authority", (t) => {
  const { parent, directory, store, request } = setup(t);
  assert.deepEqual(store.get(request), {
    revision: 0,
    runtime: null,
    externalTrees: [],
  });
  assert.equal(fs.existsSync(directory), false);
  const externalTrees = [
    { path: path.join(parent, "not-currently-mounted"), name: "Board_Support" },
  ];
  const saved = store.save({
    ...request,
    expectedRevision: 0,
    runtime: wsl(),
    externalTrees,
  });
  assert.equal(saved.historyWarning, false);
  const {historyWarning, ...savedOptions} = saved;
  assert.deepEqual(savedOptions, { revision: 1, runtime: wsl(), externalTrees });
  assert.deepEqual(
    createProjectOptionsStore({ directory }).get(request),
    savedOptions,
  );
  saved.externalTrees[0].name = "Mutated";
  assert.equal(store.get(request).externalTrees[0].name, "Board_Support");
  assert.deepEqual(store.get({ workspaceId: randomUUID() }), {
    revision: 0,
    runtime: null,
    externalTrees: [],
  });
  const switched = store.save({
    ...request,
    expectedRevision: 1,
    runtime: docker(),
    externalTrees,
  });
  assert.equal(switched.runtime.kind, "docker");
  assert.equal(Object.hasOwn(switched, "authorized"), false);
  assert.deepEqual(
    store.save({
      ...request,
      expectedRevision: 2,
      runtime: null,
      externalTrees: [],
    }),
    { revision: 3, runtime: null, externalTrees: [], historyWarning: false },
  );
});
test("stale saves and replacement failures retain the previous complete options", (t) => {
  const { directory, request, store } = setup(t);
  const previous = store.save({
    ...request,
    expectedRevision: 0,
    runtime: wsl(),
    externalTrees: [],
  });
  assert.throws(
    () =>
      createProjectOptionsStore({ directory }).save({
        ...request,
        expectedRevision: 0,
        runtime: docker(),
        externalTrees: [],
      }),
    { code: "REVISION_CONFLICT" },
  );
  const rename = fs.renameSync;
  fs.renameSync = () => {
    throw new Error("Replacement failed");
  };
  try {
    assert.throws(
      () =>
        store.save({
          ...request,
          expectedRevision: 1,
          runtime: docker(),
          externalTrees: [],
        }),
      { code: "STORAGE_UNAVAILABLE" },
    );
  } finally {
    fs.renameSync = rename;
  }
  const {historyWarning, ...previousOptions} = previous;
  assert.equal(historyWarning, false);
  assert.deepEqual(store.get(request), previousOptions);
  assert.deepEqual(fs.readdirSync(directory).sort(), [`${request.workspaceId}.json`, `${request.workspaceId}.json.history.git`].sort());
});
test("unsafe runtimes, unknown fields, accessors and malformed identities are rejected", (t) => {
  const { store, request } = setup(t);
  const save = (runtime) =>
    store.save({ ...request, expectedRevision: 0, runtime, externalTrees: [] });
  for (const runtime of [
    { kind: "native" },
    { ...wsl(), distribution: "Ubuntu;id" },
    { ...wsl(), command: "sh" },
    { ...docker(), image: "ubuntu:latest" },
    { ...docker(), image: `image@sha256:${"A".repeat(64)}` },
    { ...docker(), uid: 0 },
    { ...docker(), gid: 65536 },
    { ...docker(), uid: 1.5 },
    { ...docker(), environment: {} },
  ])
    assert.throws(() => save(runtime), { code: "INVALID_REQUEST" });
  const accessor = {};
  Object.defineProperty(accessor, "kind", {
    get() {
      throw new Error("Unexpected getter");
    },
  });
  assert.throws(() => save(accessor), { code: "INVALID_REQUEST" });
  assert.throws(() => store.get({ workspaceId: "../outside" }), {
    code: "INVALID_REQUEST",
  });
  assert.throws(() => store.get({ ...request, path: "/outside" }), {
    code: "INVALID_REQUEST",
  });
  assert.throws(() => store.get(Object.assign(Object.create(null), request)), {
    code: "INVALID_REQUEST",
  });
  assert.throws(
    () =>
      store.save({
        ...request,
        expectedRevision: 0,
        runtime: null,
        externalTrees: [],
        grants: [],
      }),
    { code: "INVALID_REQUEST" },
  );
  assert.equal(store.get(request).revision, 0);
});
test("external paths and names are bounded, normalized and unique with a 32-tree ceiling", (t) => {
  const { parent, request, store } = setup(t);
  const tree = { path: path.join(parent, "external"), name: "Valid_Name" };
  const invalidLists = [
    [tree, tree],
    [tree, { ...tree, path: path.join(parent, "other") }],
    [tree, { ...tree, name: "Other" }],
    [{ ...tree, path: "relative" }],
    [{ ...tree, path: tree.path + "/../alias" }],
    [{ ...tree, path: tree.path + "\0" }],
    [{ ...tree, path: "/" + "x".repeat(4096) }],
    [{ ...tree, name: "1name" }],
    [{ ...tree, name: "x".repeat(65) }],
    [{ ...tree, name: "name-dash" }],
    [{ ...tree, capability: "opaque" }],
    new Array(1),
  ];
  for (const externalTrees of invalidLists)
    assert.throws(
      () =>
        store.save({
          ...request,
          expectedRevision: 0,
          runtime: null,
          externalTrees,
        }),
      { code: "INVALID_REQUEST" },
    );
  const externalTrees = Array.from({ length: 32 }, (_, index) => ({
    path: path.join(parent, `tree-${index}`),
    name: `Tree_${index}`,
  }));
  assert.equal(
    store.save({
      ...request,
      expectedRevision: 0,
      runtime: docker(),
      externalTrees,
    }).externalTrees.length,
    32,
  );
  assert.throws(
    () =>
      store.save({
        ...request,
        expectedRevision: 1,
        runtime: null,
        externalTrees: [
          ...externalTrees,
          { path: path.join(parent, "overflow"), name: "Overflow" },
        ],
      }),
    { code: "INVALID_REQUEST" },
  );
  assert.equal(store.get(request).revision, 1);
});
test("corrupt, foreign, mismatched and invalid UTF-8 records remain unchanged", (t) => {
  const { directory, request, store } = setup(t);
  store.save({
    ...request,
    expectedRevision: 0,
    runtime: wsl(),
    externalTrees: [],
  });
  const file = path.join(directory, `${request.workspaceId}.json`),
    valid = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const bytes of [
    Buffer.from("broken"),
    Buffer.from(JSON.stringify({ ...valid, format: "foreign" })),
    Buffer.from(JSON.stringify({ ...valid, workspaceId: randomUUID() })),
    Buffer.from(JSON.stringify({ ...valid, unsupported: true })),
    Buffer.from(
      JSON.stringify(valid).replace('"version":2', '"version":2,"version":2'),
    ),
    Buffer.from([0xff]),
  ]) {
    fs.writeFileSync(file, bytes);
    assert.throws(() => store.get(request), { code: "STORAGE_UNAVAILABLE" });
    assert.throws(
      () =>
        store.save({
          ...request,
          expectedRevision: 0,
          runtime: null,
          externalTrees: [],
        }),
      { code: "STORAGE_UNAVAILABLE" },
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
  }
});
test("linked storage and redirected directories fail closed while foreign locks remain untouched", async (t) => {
  const { directory, request, parent, store } = setup(t);
  store.save({
    ...request,
    expectedRevision: 0,
    runtime: wsl(),
    externalTrees: [],
  });
  const file = path.join(directory, `${request.workspaceId}.json`),
    target = path.join(parent, "preserve");
  fs.renameSync(file, target);
  let linkCaseIndex=0;
  for (const link of [
    () => require('./helpers/filesystem-links.cjs').symlinkSync(target, file),
    () => fs.linkSync(target, file),
  ]) {
    await require('./helpers/filesystem-links.cjs').fileLinkCase(t,`real linked-file boundary ${++linkCaseIndex}`,async()=>{
    link();
    assert.throws(() => store.get(request), { code: "STORAGE_UNAVAILABLE" });
    assert.throws(
      () =>
        store.save({
          ...request,
          expectedRevision: 0,
          runtime: null,
          externalTrees: [],
        }),
      { code: "STORAGE_UNAVAILABLE" },
    );
    fs.unlinkSync(file);
    });
  }
  fs.renameSync(target, file);
  fs.writeFileSync(`${file}.lock`, "another owner");
  assert.throws(
    () =>
      store.save({
        ...request,
        expectedRevision: 1,
        runtime: null,
        externalTrees: [],
      }),
    { code: "STORAGE_BUSY" },
  );
  assert.equal(fs.readFileSync(`${file}.lock`, "utf8"), "another owner");
  assert.equal(store.get(request).revision, 1);
  const elsewhere = path.join(parent, "elsewhere");
  fs.mkdirSync(elsewhere);
  const redirected = path.join(parent, "redirected");
  require('./helpers/filesystem-links.cjs').symlinkSync(elsewhere, redirected);
  const unsafe = createProjectOptionsStore({
    directory: path.join(redirected, "new-child"),
  });
  assert.throws(() => unsafe.get(request), { code: "STORAGE_UNAVAILABLE" });
  assert.throws(
    () =>
      unsafe.save({
        ...request,
        expectedRevision: 0,
        runtime: null,
        externalTrees: [],
      }),
    { code: "STORAGE_UNAVAILABLE" },
  );
  assert.deepEqual(fs.readdirSync(elsewhere), []);
});
