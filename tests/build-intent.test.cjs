"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { captureBuildIntent } = require("../src/main/jobs/build-intent.cjs");
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "build-intent-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, "source"),
    output = path.join(directory, "output"),
    external = path.join(directory, "external");
  for (const selected of [source, output, external]) await fs.mkdir(selected);
  await fs.writeFile(path.join(source, "Makefile"), "all:\n\ttrue\n");
  await fs.writeFile(path.join(external, "external.mk"), "# external\n");
  return {
    directory,
    source,
    output,
    external,
    input: { source, output, externalTrees: [external] },
  };
}
test("deterministic content intent binds source, ordered external bytes and output configuration", async (t) => {
  const f = await fixture(t),
    first = await captureBuildIntent(f.input);
  assert.deepEqual(await captureBuildIntent(f.input), first);
  await fs.writeFile(path.join(f.source, "Makefile"), "all:\n\tfalse\n");
  const sourceChanged = await captureBuildIntent(f.input);
  assert.notEqual(sourceChanged.sourceRevision, first.sourceRevision);
  assert.equal(sourceChanged.configRevision, first.configRevision);
  await fs.writeFile(path.join(f.output, ".config"), "BR2_PACKAGE_BUSYBOX=y\n");
  const configChanged = await captureBuildIntent(f.input);
  assert.equal(configChanged.sourceRevision, sourceChanged.sourceRevision);
  assert.notEqual(configChanged.configRevision, sourceChanged.configRevision);
  await fs.writeFile(path.join(f.external, "external.mk"), "# changed\n");
  assert.notEqual(
    (await captureBuildIntent(f.input)).sourceRevision,
    configChanged.sourceRevision,
  );
  assert.deepEqual(Object.keys(first).sort(), [
    "configRevision",
    "snapshot",
    "sourceRevision",
  ]);
  assert.equal(JSON.stringify(first).includes(f.directory), false);
});
test("Git object history and unrelated output artifacts never become retained snapshot content", async (t) => {
  const f = await fixture(t);
  await fs.mkdir(path.join(f.source, ".git"));
  const first = await captureBuildIntent(f.input);
  await fs.writeFile(
    path.join(f.source, ".git", "config"),
    "secret-fixture-token",
  );
  await fs.writeFile(
    path.join(f.source, ".git", "object"),
    Buffer.alloc(1024 * 1024),
  );
  await fs.writeFile(path.join(f.output, "artifact.img"), "generated output");
  const next = await captureBuildIntent(f.input);
  assert.equal(next.sourceRevision, first.sourceRevision);
  assert.equal(next.configRevision, first.configRevision);
  assert.equal(next.snapshot.bytes, first.snapshot.bytes);
  assert.equal(JSON.stringify(next).includes("secret-fixture-token"), false);
});
test("internal links are hashed without following outside links or reading hardlinked data", async (t) => {
  const f = await fixture(t);
  await require('./helpers/filesystem-links.cjs').fileLinkCase(t,"real internal and outside symbolic links",async()=>{
await require('./helpers/filesystem-links.cjs').symlink("Makefile", path.join(f.source, "local-link"));
  const first = await captureBuildIntent(f.input);
  await fs.writeFile(path.join(f.source, "Makefile"), "changed target\n");
  assert.notEqual(
    (await captureBuildIntent(f.input)).sourceRevision,
    first.sourceRevision,
  );
  await require('./helpers/filesystem-links.cjs').symlink(f.directory, path.join(f.source, "escape"));
  const linked = await captureBuildIntent(f.input);
  assert.equal(linked.snapshot.symlinkPolicy, "link-text-only");
  assert.equal(linked.snapshot.symlinks, 2);
  assert.equal(linked.snapshot.version, 2);
  await fs.unlink(path.join(f.source, "escape"));

});
  const outside = path.join(f.directory, "outside");
  await fs.writeFile(outside, "outside-grant-data");
  await fs.link(outside, path.join(f.source, "hardlink"));
  await assert.rejects(captureBuildIntent(f.input), {
    code: "BLOCKED_CONTENT_UNSAFE",
  });
});
test("bounded hashing rejects changed open files, resource excess and cancellation without modifying source", async (t) => {
  const f = await fixture(t),
    makefile = path.join(f.source, "Makefile"),
    original = await fs.readFile(makefile);
  await assert.rejects(
    captureBuildIntent({ ...f.input, limits: { maxFileBytes: 1 } }),
    { code: "BLOCKED_CONTENT_LIMIT" },
  );
  await assert.rejects(
    captureBuildIntent({ ...f.input, limits: { maxEntries: 1 } }),
    { code: "BLOCKED_CONTENT_LIMIT" },
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    captureBuildIntent({ ...f.input, signal: controller.signal }),
    { code: "BLOCKED_CONTENT_CANCELLED" },
  );
  const open = fs.open;
  let changed = false;
  fs.open = async function (selected, ...args) {
    const handle = await open.call(this, selected, ...args);
    if (selected === makefile && !changed) {
      const read = handle.read.bind(handle);
      handle.read = async (...readArgs) => {
        const result = await read(...readArgs);
        if (!changed) {
          changed = true;
          await fs.writeFile(makefile, "independent changed file\n");
        }
        return result;
      };
    }
    return handle;
  };
  try {
    await assert.rejects(captureBuildIntent(f.input), {
      code: "BLOCKED_CONTENT_CHANGED",
    });
  } finally {
    fs.open = open;
  }
  assert.equal(
    await fs.readFile(makefile, "utf8"),
    "independent changed file\n",
  );
  assert.equal(original.toString(), "all:\n\ttrue\n");
});

test("Git ref-only changes invalidate intent without reading object history or local credential configuration", async (t) => {
  const f = await fixture(t);
  await fs.mkdir(path.join(f.source, ".git", "refs", "heads"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(f.source, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  await fs.writeFile(
    path.join(f.source, ".git", "refs", "heads", "main"),
    "a".repeat(40) + "\n",
  );
  const first = await captureBuildIntent(f.input);
  await fs.writeFile(
    path.join(f.source, ".git", "refs", "heads", "main"),
    "b".repeat(40) + "\n",
  );
  const next = await captureBuildIntent(f.input);
  assert.notEqual(next.sourceRevision, first.sourceRevision);
  assert.equal(next.snapshot.excludesGitObjectHistory, true);
});

test("absolute filesystem-template links are retained as text without reading or claiming external referent bytes", async (t) => {
  const f = await fixture(t),
    outside = path.join(f.directory, "external-target");
  await fs.writeFile(outside, "private outside fixture");
  await require('./helpers/filesystem-links.cjs').fileLinkCase(t,'real absolute template links',async()=>{
await require('./helpers/filesystem-links.cjs').symlink(outside, path.join(f.source, "template-link"));
  await require('./helpers/filesystem-links.cjs').symlink("/proc/mounts", path.join(f.source, "mtab-template"));
  const first = await captureBuildIntent(f.input);
  await fs.writeFile(outside, "changed outside fixture");
  const after = await captureBuildIntent(f.input);
  assert.equal(after.sourceRevision, first.sourceRevision);
  assert.equal(after.snapshot.symlinks, 2);
  assert.equal(after.snapshot.symlinkPolicy, "link-text-only");
  assert.equal(JSON.stringify(after).includes("outside fixture"), false);
  assert.deepEqual(after.snapshot.limitations, [
    "SYMLINK_TARGETS_OUTSIDE_CAPTURED_FILE_NAMESPACE_ARE_NOT_BOUND",
  ]);
});
});

test("link receipts preserve raw bytes and ambiguous non-UTF-8 filenames fail explicitly", async (t) => {
  if (process.platform === "win32") return t.skip("POSIX raw filename fixture");
  const f = await fixture(t),
    selected = path.join(f.source, "raw-link");
  await require('./helpers/filesystem-links.cjs').symlink(Buffer.from([0x61, 0xff]), selected);
  const first = await captureBuildIntent(f.input);
  await fs.unlink(selected);
  await require('./helpers/filesystem-links.cjs').symlink(Buffer.from([0x61, 0xfe]), selected);
  assert.notEqual(
    (await captureBuildIntent(f.input)).sourceRevision,
    first.sourceRevision,
  );
  const rawPath = Buffer.concat([
    Buffer.from(f.source + path.sep),
    Buffer.from([0x62, 0xff]),
  ]);
  await fs.writeFile(rawPath, "ambiguous filename");
  await assert.rejects(captureBuildIntent(f.input), {
    code: "BLOCKED_CONTENT_UNSAFE",
  });
});

test(
  "official Buildroot source admits template links with the same bounded receipt policy",
  { skip: !process.env.MATERIAL_BUILDROOT_INTENT_SOURCE },
  async (t) => {
    const source = process.env.MATERIAL_BUILDROOT_INTENT_SOURCE;
    const output = await fs.mkdtemp(
      path.join(os.tmpdir(), "official-buildroot-intent-"),
    );
    t.after(() => fs.rm(output, { recursive: true, force: true }));
    const makefile = await fs.readFile(path.join(source, "Makefile"), "utf8");
    assert.match(makefile, /BR2_VERSION\s*:?=\s*2025\.02\.1/);
    const captured = await captureBuildIntent({ source, output });
    assert.ok(captured.snapshot.entries > 10000);
    assert.ok(captured.snapshot.symlinks > 100);
    assert.equal(captured.snapshot.version, 2);
    assert.equal(captured.snapshot.symlinkPolicy, "link-text-only");
    assert.match(captured.sourceRevision, /^[a-f0-9]{64}$/);
  },
);
