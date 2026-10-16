"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { pathToFileURL } = require("node:url");
const {
  createDocumentationService,
  renderMarkdown,
} = require("../src/main/documentation/service.cjs");
const articleId = (source) =>
  "doc-" + createHash("sha256").update(source).digest("hex");
const {
  createOperationsService,
} = require("../src/main/operations-service.cjs");
async function fixture(
  t,
  {
    readme = "# Reader\n\n[Plan](PLAN.md#plan) and [Reference](https://example.org/reference).\n\n![Pixel](assets/pixel.png)\n\n| Name | Value |\n| --- | --- |\n| Safe | yes |\n\n```sh\nmake all\n```\n",
  } = {},
) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "documentation-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "source"),
    output = path.join(temporary, "documentation");
  fs.mkdirSync(root);
  const { rootDocuments } = await import("../website/inventory.mjs");
  for (const source of rootDocuments) {
    fs.mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
    fs.writeFileSync(
      path.join(root, source),
      source === "README.md"
        ? readme
        : source === "PLAN.md"
          ? "# Plan\n\nOffline plan.\n"
          : `# ${source}\n\nPublic reference.\n`,
    );
  }
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(
    path.join(root, "assets/pixel.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(
    path.join(root, "docs/guide.md"),
    "# Guide\n\n## Detail\n\n[Reader](../README.md#reader)\n",
  );
  execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  fs.writeFileSync(
    path.join(root, "docs/private-unindexed.md"),
    "Never bundle this unindexed content.",
  );
  const { bundleDocumentation } = await import(
    "../scripts/documentation/bundle.mjs"
  );
  return {
    root,
    output,
    build: () => bundleDocumentation({ root, output }),
    service: (options) =>
      createDocumentationService({ directory: output, ...options }),
  };
}
test("real generated indexed articles render tables, code, admitted navigation and hashed images", async (t) => {
  const fixtureData = await fixture(t);
  const built = await fixtureData.build();
  assert.equal(built.complete, true);
  assert.equal(built.documents, 10);
  assert.equal(built.assets, 1);
  const service = fixtureData.service();
  const listed = service.list();
  assert.equal(listed.complete, true);
  assert.equal(listed.articles.length, 10);
  assert.equal(JSON.stringify(listed).includes("private-unindexed"), false);
  const article = service.read({ id: articleId("README.md") });
  assert.match(article.html, /<table>/);
  assert.match(article.html, /<pre><code class="language-sh">make all/);
  assert.match(
    article.html,
    /data-document-id="doc-[a-f0-9]{64}" data-document-anchor="plan"/,
  );
  assert.match(
    article.html,
    /src="documentation\/assets\/[a-f0-9]{64}\.png" alt="Pixel"/,
  );
  assert.match(article.html, /data-document-link-id="link-[a-f0-9]{64}"/);
  assert.equal(article.navigation.headings[0].id, "reader");
  assert.throws(() => service.read({ id: "../README.md" }), {
    code: "INVALID_REQUEST",
  });
  assert.throws(
    () => service.read({ id: articleId("docs/private-unindexed.md") }),
    { code: "NOT_FOUND" },
  );
});
test("desktop operations expose only bundled article IDs and source-bound external links", async (t) => {
  const f = await fixture(t);
  await f.build();
  const opened = [];
  const service = createOperationsService({
    directory: path.join(f.root, ".operations"),
    documentationDirectory: f.output,
    dialog: {},
    openDocumentationExternal: async (url) => opened.push(url),
    version: "0.1.0",
  });
  t.after(() => service.dispose());
  const request = (value) => service.request(JSON.stringify(value));
  assert.equal(
    (await request({ action: "documentation.list" })).result.articles.length,
    10,
  );
  assert.equal(
    (await request({ action: "documentation.read", id: "../README.md" })).ok,
    false,
  );
  const article = await request({
    action: "documentation.read",
    id: articleId("README.md"),
  });
  assert.equal(article.ok, true);
  const linkId = /data-document-link-id="([^"]+)"/.exec(article.result.html)[1];
  assert.deepEqual(opened, []);
  assert.equal(
    (
      await request({
        action: "documentation.open",
        id: articleId("README.md"),
        linkId,
        url: "https://attacker.example/",
      })
    ).code,
    "INVALID_REQUEST",
  );
  assert.equal(
    (
      await request({
        action: "documentation.open",
        id: articleId("PLAN.md"),
        linkId,
      })
    ).code,
    "LINK_NOT_ALLOWED",
  );
  assert.equal(
    (
      await request({
        action: "documentation.open",
        id: articleId("README.md"),
        linkId,
      })
    ).result.opened,
    true,
  );
  assert.deepEqual(opened, ["https://example.org/reference"]);
  await service.dispose();
  assert.equal(
    (await request({ action: "documentation.list" })).code,
    "UNAVAILABLE",
  );
});
test("shared Markdown renderer escapes raw HTML and refuses unsafe links and automatic network images", () => {
  const text =
    "# Safe\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[Danger](javascript:alert(1)) [File](file:///etc/passwd) [Data](data:text/html,evil) [Mail](mailto:user@example.org)\n\n![Remote](https://attacker.example/pixel.png)\n\n[Secure descriptive text](https://example.org/read)\n\n## Safe\n\n## Safe\n";
  const rendered = renderMarkdown(text);
  assert.doesNotMatch(
    rendered.html,
    /<script|<iframe|<img\b|href="(?:javascript|file|data|https?):/i,
  );
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.match(rendered.html, /Secure descriptive text<\/a>/);
  assert.deepEqual(
    rendered.headings.map((item) => item.id),
    ["safe", "safe-1", "safe-2"],
  );
  assert.equal(rendered.links.length, 1);
  assert.equal(rendered.links[0].url, "https://example.org/read");
  assert.ok(
    rendered.issues.some(
      (issue) => issue.reference === "https://attacker.example/pixel.png",
    ),
  );
  assert.ok(
    rendered.issues.some(
      (issue) => issue.reference === "mailto:user@example.org",
    ),
  );
});
test("external opening requires an admitted source-bound opaque link and host callback", async (t) => {
  const fixtureData = await fixture(t);
  await fixtureData.build();
  const opened = [];
  const service = fixtureData.service({
    openExternal: async (value) => {
      opened.push(value);
    },
  });
  const id = articleId("README.md"),
    html = service.read({ id }).html,
    linkId = html.match(/data-document-link-id="([^"]+)"/)[1];
  assert.deepEqual(await service.open({ id, linkId }), { opened: true });
  assert.deepEqual(opened, ["https://example.org/reference"]);
  await assert.rejects(service.open({ id: articleId("PLAN.md"), linkId }), {
    code: "LINK_NOT_ALLOWED",
  });
  await assert.rejects(service.open({ id, linkId: "https://example.org" }), {
    code: "INVALID_REQUEST",
  });
  await assert.rejects(fixtureData.service().open({ id, linkId }), {
    code: "EXTERNAL_UNAVAILABLE",
  });
  assert.equal(opened.length, 1);
});
test("missing, unindexed, escaping and unsupported assets stay visible as incomplete documentation", async (t) => {
  const fixtureData = await fixture(t, {
    readme:
      "# Reader\n\n[Unindexed](docs/private-unindexed.md) [Escape](../outside.md) [Missing anchor](PLAN.md#absent)\n\n![Unindexed](assets/unindexed.png) ![SVG](assets/unsafe.svg)\n",
  });
  fs.copyFileSync(
    path.join(fixtureData.root, "assets/pixel.png"),
    path.join(fixtureData.root, "assets/unindexed.png"),
  );
  fs.writeFileSync(
    path.join(fixtureData.root, "assets/unsafe.svg"),
    '<svg onload="alert(1)"></svg>',
  );
  execFileSync("git", ["add", "assets/unsafe.svg"], { cwd: fixtureData.root });
  const result = await fixtureData.build();
  assert.equal(result.complete, false);
  assert.equal(result.assets, 0);
  const read = fixtureData.service().read({ id: articleId("README.md") });
  assert.equal(read.complete, false);
  assert.match(read.html, /Image unavailable: SVG/);
  assert.doesNotMatch(read.html, /<svg|<img\b/);
  assert.ok(
    read.issues.some(
      (issue) => issue.reference === "docs/private-unindexed.md",
    ),
  );
  assert.ok(read.issues.some((issue) => issue.reference === "../outside.md"));
});
test("indexed symbolic-link article sources are refused and existing output is preserved", async (t) => {
  const fixtureData = await fixture(t);
  const outside = path.join(path.dirname(fixtureData.root), "outside.md");
  fs.writeFileSync(outside, "# Private outside source");
  await require('./helpers/filesystem-links.cjs').fileLinkCase(t,"real indexed source symbolic link",async()=>{
require('./helpers/filesystem-links.cjs').symlinkSync(outside, path.join(fixtureData.root, "docs/linked.md"));
  execFileSync("git", ["add", "docs/linked.md"], { cwd: fixtureData.root });
  await assert.rejects(fixtureData.build(), /symbolic link|junction/);
  assert.equal(fs.existsSync(fixtureData.output), false);
  fs.unlinkSync(path.join(fixtureData.root, "docs/linked.md"));
  execFileSync("git", ["rm", "--cached", "docs/linked.md"], {
    cwd: fixtureData.root,
    stdio: "ignore",
  });

});
  await fixtureData.build();
  const original = fs.readFileSync(path.join(fixtureData.output, "index.json"));
  await assert.rejects(fixtureData.build(), /new or empty/);
  assert.deepEqual(
    fs.readFileSync(path.join(fixtureData.output, "index.json")),
    original,
  );
});
test("missing and tampered article, manifest and image bytes fail closed", async (t) => {
  const fixtureData = await fixture(t);
  assert.throws(() => fixtureData.service().list(), { code: "INVALID_BUNDLE" });
  await fixtureData.build();
  const indexPath = path.join(fixtureData.output, "index.json"),
    original = fs.readFileSync(indexPath);
  const manifest = JSON.parse(original);
  const article = manifest.documents.find(
    (item) => item.source === "README.md",
  );
  const articlePath = path.join(fixtureData.output, article.file),
    articleBytes = fs.readFileSync(articlePath);
  fs.writeFileSync(articlePath, "# Tampered");
  assert.throws(() => fixtureData.service().read({ id: article.id }), {
    code: "CORRUPT_BUNDLE",
  });
  fs.writeFileSync(articlePath, articleBytes);
  const assetPath = path.join(fixtureData.output, manifest.assets[0].file),
    assetBytes = fs.readFileSync(assetPath);
  fs.writeFileSync(assetPath, "broken");
  assert.throws(() => fixtureData.service().list(), { code: "CORRUPT_BUNDLE" });
  fs.writeFileSync(assetPath, assetBytes);
  fs.writeFileSync(
    indexPath,
    JSON.stringify({ ...manifest, sourceSnapshot: "0".repeat(64) }),
  );
  assert.throws(() => fixtureData.service().list(), { code: "CORRUPT_BUNDLE" });
  fs.writeFileSync(indexPath, original);
  fs.unlinkSync(articlePath);
  assert.throws(() => fixtureData.service().read({ id: article.id }), {
    code: "INVALID_BUNDLE",
  });
});
test("generated path escapes, symbolic links and multiply linked files are not accepted", async (t) => {
  const fixtureData = await fixture(t);
  await fixtureData.build();
  const indexPath = path.join(fixtureData.output, "index.json"),
    original = fs.readFileSync(indexPath),
    manifest = JSON.parse(original);
  manifest.documents[0].file = "../outside.md";
  fs.writeFileSync(indexPath, JSON.stringify(manifest));
  assert.throws(() => fixtureData.service().list(), { code: "INVALID_BUNDLE" });
  fs.writeFileSync(indexPath, original);
  const target = path.join(path.dirname(fixtureData.output), "manifest-copy");
  fs.renameSync(indexPath, target);
  await require('./helpers/filesystem-links.cjs').fileLinkCase(t,"real generated manifest symbolic link",async()=>{
require('./helpers/filesystem-links.cjs').symlinkSync(target, indexPath);
  assert.throws(() => fixtureData.service().list(), { code: "INVALID_BUNDLE" });
  fs.unlinkSync(indexPath);

});
  fs.linkSync(target, indexPath);
  assert.throws(() => fixtureData.service().list(), { code: "INVALID_BUNDLE" });
});
