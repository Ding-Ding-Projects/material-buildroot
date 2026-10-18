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
  referencePages,
  MAX_ARTICLE,
  MAX_ASSET,
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
    sources = {},
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
  fs.mkdirSync(path.join(root, "src/main/documentation"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/main/documentation/releases.json"), JSON.stringify({ version: 1, entries: [] }));
  for (const [source, content] of Object.entries(sources)) {
    fs.mkdirSync(path.dirname(path.join(root, source)), { recursive: true });
    fs.writeFileSync(path.join(root, source), content);
  }
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
test("article body search text is plain, bounded, verified and limited to indexed articles", async (t) => {
  const f = await fixture(t, {
    readme:
      "# Reader\n\nThe **quarantined** overlay keeps `make all` &amp; <b>raw</b> text.\n\n```sh\nbr2-external-tree\n```\n",
  });
  await f.build();
  const service = f.service();
  const { entries } = service.searchText();
  assert.equal(entries.length, service.list().articles.length);
  const reader = entries.find((entry) => entry.id === articleId("README.md"));
  assert.equal(reader.truncated, false);
  assert.match(reader.text, /The quarantined overlay keeps make all & <b>raw<\/b> text\./);
  assert.match(reader.text, /br2-external-tree/);
  assert.doesNotMatch(reader.text, /<strong>|<code>|<pre>/);
  assert.equal(JSON.stringify(entries).includes("Never bundle this unindexed"), false);
  const operations = createOperationsService({
    directory: path.join(f.root, ".operations"),
    documentationDirectory: f.output,
    dialog: {},
    version: "0.1.0",
  });
  t.after(() => operations.dispose());
  const reply = await operations.request(JSON.stringify({ action: "documentation.searchText" }));
  assert.equal(reply.ok, true);
  assert.equal(reply.result.entries.length, entries.length);
  const extra = await operations.request(JSON.stringify({ action: "documentation.searchText", extra: true }));
  assert.equal(extra.ok, false);
  const file = path.join(f.output, "articles", `${reader.id}.md`);
  fs.appendFileSync(file, "tampered");
  assert.throws(() => f.service().searchText(), { code: "CORRUPT_BUNDLE" });
});

test("linked JSON and link-only images use opaque complete source-reference reads without changing Markdown inventory", async (t) => {
  const json = JSON.stringify({ text: '</pre><script>alert(1)</script> & [hidden](untracked.json)', nested: { okay: true } }, null, 2);
  const f = await fixture(t, {
    readme: '# Reader\n\n[Data](docs/data.json) [Again](docs/data.json) [Pixel](assets/pixel.png)\n',
    sources: { 'docs/data.json': json, 'docs/unreferenced.json': '{"never":"indexed but not linked"}' },
  });
  const built = await f.build();
  assert.equal(built.complete, true);
  assert.equal(built.documents, 10);
  assert.equal(built.references, 2);
  assert.equal(built.assets, 1);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.output, 'index.json')));
  assert.equal(manifest.documents.length, 10);
  assert.equal(manifest.references.filter((item) => item.kind === 'json').length, 1);
  const ref = manifest.references.find((item) => item.kind === 'json');
  assert.equal(ref.sha256, createHash('sha256').update(json).digest('hex'));
  assert.equal(fs.readFileSync(path.join(f.output, ref.file), 'utf8'), json);
  const service = f.service();
  const reader = service.read({ id: articleId('README.md') });
  assert.match(reader.html, new RegExp(`data-document-id="${articleId('docs/data.json')}"`));
  assert.match(reader.html, new RegExp(`data-document-id="${articleId('assets/pixel.png')}"`));
  const data = service.read({ id: ref.id });
  assert.match(data.html, /Page 1 of 1/);
  assert.match(data.html, /&lt;\/pre&gt;&lt;script&gt;/);
  assert.doesNotMatch(data.html, /<script|<\/pre><script|data-document-link-id|href="(?:https?|file):/);
  assert.equal(data.article.title, 'data.json');
  assert.equal(JSON.stringify(data).includes('docs/data.json'), false);
  assert.match(service.read({ id: articleId('assets/pixel.png') }).html, /src="documentation\/assets\/[a-f0-9]{64}\.png"/);
  assert.throws(() => service.read({ id: articleId('docs/unreferenced.json') }), { code: 'NOT_FOUND' });
  const { sourceSnapshot } = await import('../website/source-boundary.mjs');
  const originals = [...manifest.documents, ...manifest.assets, ...manifest.references].map((item) => item.source);
  assert.equal(manifest.sourceSnapshot, sourceSnapshot(f.root, [...new Set(originals)].sort()));
});

test("JSON page reads preserve all bytes, expose next and previous opaque IDs and bound rendered HTML", async (t) => {
  const json = JSON.stringify({ text: '😀漢字'.repeat(70000) + '"<&>'.repeat(10000) });
  assert.ok(Buffer.byteLength(json) > MAX_ARTICLE);
  const f = await fixture(t, { readme: '# Reader\n\n[Data](docs/large.json)\n', sources: { 'docs/large.json': json } });
  assert.equal((await f.build()).complete, true);
  const service = f.service();
  let id = articleId('docs/large.json'), previous = null, reconstructed = '', count = 0;
  const indexedIds = new Set(service.list().articles.map((article) => article.id));
  const searchableIds = new Set(service.searchText().entries.map((entry) => entry.id));
  const seen = new Set();
  const decode = (value) => value.replace(/&(amp|lt|gt|quot);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"' })[entity]);
  while (id) {
    assert.ok(!seen.has(id)); seen.add(id);
    assert.ok(indexedIds.has(id), 'Each restorable page is admitted in the existing article index');
    assert.ok(searchableIds.has(id));
    const result = service.read({ id });
    const restored = f.service().read({ id });
    assert.equal(restored.article.id, id);
    assert.equal(restored.html, result.html);
    assert.ok(Buffer.byteLength(result.html) <= MAX_ARTICLE);
    const page = /Page (\d+) of (\d+)/.exec(result.html);
    assert.equal(Number(page[1]), ++count);
    const body = /<code class="language-json">([\s\S]*)<\/code>/.exec(result.html)[1];
    reconstructed += decode(body);
    const before = /data-document-id="([^"]+)">Previous page/.exec(result.html);
    assert.equal(before?.[1] || null, previous);
    previous = id;
    id = /data-document-id="([^"]+)">Next page/.exec(result.html)?.[1];
    if (!id) assert.equal(count, Number(page[2]));
  }
  assert.equal(reconstructed, json);
  assert.deepEqual(Buffer.from(reconstructed), Buffer.from(json));
  assert.equal(service.searchText().entries.find((entry) => entry.id === articleId('docs/large.json')).truncated, false);
  assert.throws(() => service.read({ id: articleId('docs/large.json\0page:999') }), { code: 'NOT_FOUND' });
});

test("UTF-8 source page boundaries retain every character and exact byte boundary inputs", () => {
  for (let shift = 0; shift < 4; shift++) {
    const original = 'a'.repeat(65536 - shift) + '😀'.repeat(20000);
    const pages = referencePages(original);
    assert.equal(pages.join(''), original);
    assert.ok(pages.every((page) => Buffer.byteLength(page) <= 65536));
    assert.ok(pages.every((page) => !page.includes('\ufffd')));
  }
  assert.deepEqual(referencePages('x'.repeat(65536)), ['x'.repeat(65536)]);
  assert.deepEqual(referencePages(''), ['']);
  const maximum = '"' + '😀'.repeat((MAX_ASSET - 4) / 4) + '"  ';
  const pages = referencePages(maximum);
  assert.equal(pages.length, 129);
  assert.equal(pages.join(''), maximum);
  assert.ok(pages.every((page) => Buffer.byteLength(page) <= 65536));
  assert.equal(Buffer.byteLength(pages.join('')), MAX_ASSET);
});

test("source references accept the exact raw-byte limit and preserve the total bundle limit", async (t) => {
  const maximum = '"' + '😀'.repeat((MAX_ASSET - 4) / 4) + '"  ';
  const f = await fixture(t, { readme: '# Reader\n\n[Maximum](docs/maximum.json)\n', sources: { 'docs/maximum.json': maximum } });
  assert.equal((await f.build()).complete, true);
  const first = f.service().read({ id: articleId('docs/maximum.json') });
  assert.match(first.html, /Page 1 of 129/);
  assert.ok(Buffer.byteLength(first.html) <= MAX_ARTICLE);
  const originalRead = fs.readSync;
  let sourceReads = 0;
  fs.readSync = function (...args) {
    const result = originalRead.apply(this, args);
    if (result === MAX_ASSET) sourceReads++;
    return result;
  };
  try {
    const entries = f.service().searchText().entries;
    assert.equal(entries.length, 139);
    assert.equal(sourceReads, 1, 'One search operation reads each raw JSON source once, regardless of page count');
    assert.equal(entries.at(-1).truncated, false, 'The short final page is represented in full');
  } finally { fs.readSync = originalRead; }
  const sources = {}, links = [];
  for (let index = 0; index < 8; index++) {
    sources[`docs/reference-${index}.json`] = maximum;
    links.push(`[Reference ${index}](docs/reference-${index}.json)`);
  }
  const oversized = await fixture(t, { readme: '# Reader\n\n' + links.join(' '), sources });
  await assert.rejects(oversized.build(), /total size limit/);
  assert.equal(fs.existsSync(oversized.output), false);
});

test("virtual source pages share the existing reader inventory bound", async (t) => {
  const sources = {};
  for (let index = 0; index < 873; index++) sources[`docs/article-${index}.md`] = '# Article\n';
  sources['docs/maximum.json'] = '"' + '😀'.repeat((MAX_ASSET - 4) / 4) + '"  ';
  const f = await fixture(t, { readme: '# Reader\n\n[Maximum](docs/maximum.json)\n', sources });
  await assert.rejects(f.build(), /reader page limit/);
  assert.equal(fs.existsSync(f.output), false);
});

test("source-reference controls localize through the strict optional read language without changing source data", async (t) => {
  const json = JSON.stringify({ text: '</pre><script>Never translate this source 中文</script>'.repeat(2000) });
  const f = await fixture(t, { readme: '# Reader\n\n[Data](docs/data.json) [Pixel](assets/pixel.png)\n', sources: { 'docs/data.json': json } });
  await f.build();
  const service = f.service(), id = articleId('docs/data.json');
  const en = service.read({ id }), zh = service.read({ id, language: 'zh-HK' }), both = service.read({ id, language: 'bilingual' });
  assert.match(en.html, /Next page/);
  assert.doesNotMatch(zh.html, /Next page|Source reference pages|JSON source reference/);
  assert.match(zh.html, /下一頁/);
  assert.match(zh.html, /aria-label="原始參考資料分頁"/);
  assert.match(both.html, /Next page \/ 下一頁/);
  const body = (view) => /<code class="language-json">([\s\S]*)<\/code>/.exec(view.html)[1];
  assert.equal(body(en), body(zh));
  assert.equal(body(en), body(both));
  const nextId = /data-document-id="([^"]+)">下一頁/.exec(zh.html)[1];
  assert.match(service.read({ id: nextId, language: 'zh-HK' }).html, /上一頁/);
  assert.match(service.read({ id: articleId('assets/pixel.png'), language: 'zh-HK' }).html, /內附圖片原始參考資料/);
  assert.equal(service.read({ id: articleId('PLAN.md'), language: 'zh-HK' }).html, service.read({ id: articleId('PLAN.md') }).html);
  const operations = createOperationsService({ directory: path.join(f.root, '.localized-operations'), documentationDirectory: f.output, dialog: {}, version: '0.1.0' });
  t.after(() => operations.dispose());
  const request = (value) => operations.request(JSON.stringify(value));
  for (const language of ['en', 'zh-HK', 'bilingual']) {
    const result = await request({ action: 'documentation.read', id, language });
    assert.equal(result.ok, true);
    assert.equal(body(result.result), body(en));
  }
  assert.equal((await request({ action: 'documentation.read', id })).ok, true);
  for (const language of ['english', '', null, 42, {}, ['en']]) {
    assert.throws(() => service.read({ id, language }), { code: 'INVALID_REQUEST' });
    assert.equal((await request({ action: 'documentation.read', id, language })).code, 'INVALID_REQUEST');
  }
  assert.throws(() => service.read({ id, language: undefined }), { code: 'INVALID_REQUEST' });
  assert.equal((await request({ action: 'documentation.read', id, language: 'en', path: 'docs/data.json' })).code, 'INVALID_REQUEST');
});

test("source-reference admission leaves escaping, missing, untracked, unsupported, malformed and oversized targets incomplete", async (t) => {
  const f = await fixture(t, {
    readme: '# Reader\n\n[Untracked](docs/untracked.json) [Escape](../outside.json) [Encoded](%2e%2e%2foutside.json) [Absolute](/outside.json) [Drive](C%3a/secret.json) [Missing](docs/missing.json) [Other](docs/data.txt) [Malformed](docs/bad.json) [Encoding](docs/encoding.json) [Large](docs/oversized.json) [SVG](assets/unsafe.svg) [Broken fragment](assets/pixel.png#missing)\n',
    sources: { 'docs/data.txt': '{}', 'docs/bad.json': '{broken', 'docs/encoding.json': Buffer.from([0xff]), 'docs/oversized.json': ' '.repeat(MAX_ASSET + 1), 'assets/unsafe.svg': '<svg onload="alert(1)"/>' },
  });
  fs.writeFileSync(path.join(f.root, 'docs/untracked.json'), '{"hidden":true}');
  fs.writeFileSync(path.join(path.dirname(f.root), 'outside.json'), '{"hidden":true}');
  const result = await f.build();
  assert.equal(result.complete, false);
  assert.equal(result.references, 1); // The image is admitted, but its nonexistent fragment is not.
  const read = f.service().read({ id: articleId('README.md') });
  for (const target of ['docs/untracked.json', '../outside.json', '%2e%2e%2foutside.json', '/outside.json', 'C%3a/secret.json', 'docs/missing.json', 'docs/data.txt', 'docs/bad.json', 'docs/encoding.json', 'docs/oversized.json', 'assets/unsafe.svg', 'assets/pixel.png#missing'])
    assert.ok(read.issues.some((issue) => issue.reference === target), target);
  assert.doesNotMatch(read.html, /<svg|hidden/);
});

test("link and inline image references share one asset and malformed PNG bytes remain unavailable", async (t) => {
  const f = await fixture(t, { readme: '# Reader\n\n[Pixel](assets/pixel.png) ![Pixel](assets/pixel.png) [Invalid](assets/invalid.png)\n', sources: { 'assets/invalid.png': 'not an image' } });
  const result = await f.build();
  assert.equal(result.assets, 1);
  assert.equal(result.references, 1);
  assert.equal(result.complete, false);
  assert.ok(f.service().list().issues.some((issue) => issue.reference === 'assets/invalid.png'));
});

test("reference hashes, raw bytes and strict manifest records fail closed while old bundles remain readable", async (t) => {
  const f = await fixture(t, { readme: '# Reader\n\n[Data](docs/data.json) [Pixel](assets/pixel.png)\n', sources: { 'docs/data.json': '{"okay":true}' } });
  await f.build();
  const indexPath = path.join(f.output, 'index.json');
  const original = fs.readFileSync(indexPath), manifest = JSON.parse(original);
  const reference = manifest.references.find((item) => item.kind === 'json');
  const rawPath = path.join(f.output, reference.file), raw = fs.readFileSync(rawPath);
  fs.writeFileSync(rawPath, '{"okay":false}');
  assert.throws(() => f.service().list(), { code: 'CORRUPT_BUNDLE' });
  fs.writeFileSync(rawPath, raw);
  for (const mutate of [
    (value) => { value.extra = true; },
    (value) => { value.references = null; },
    (value) => { value.references[0].extra = true; },
    (value) => { value.references[0].kind = 'html'; },
    (value) => { value.references[0].file = '../outside.json'; },
    (value) => { value.references[0].id = articleId('README.md'); },
    (value) => { value.references.push(value.references[0]); },
    (value) => { value.references[0].bytes = MAX_ASSET + 1; },
    (value) => { value.references[0].sha256 = '0'.repeat(64); },
    (value) => { value.references.find((item) => item.kind === 'image').file = 'assets/' + '0'.repeat(64) + '.png'; },
  ]) {
    const changed = JSON.parse(original); mutate(changed);
    fs.writeFileSync(indexPath, JSON.stringify(changed));
    assert.throws(() => f.service().read({ id: reference.id }));
  }
  fs.writeFileSync(indexPath, original);
  fs.unlinkSync(rawPath);
  assert.throws(() => f.service().list(), { code: 'INVALID_BUNDLE' });
  const old = await fixture(t);
  await old.build();
  const oldIndex = path.join(old.output, 'index.json'), previous = JSON.parse(fs.readFileSync(oldIndex));
  delete previous.references;
  fs.writeFileSync(oldIndex, JSON.stringify(previous));
  assert.equal(old.service().list().complete, true);
  assert.match(old.service().read({ id: articleId('README.md') }).html, /<table>/);
});

test("source-reference file links, linked ancestors and multiply linked JSON cannot enter the bundle", async (t) => {
  const f = await fixture(t, { readme: '# Reader\n\n[Hard link](docs/hard.json) [Linked ancestor](docs/linked/outside.json)\n' });
  const outside = path.join(path.dirname(f.root), 'outside-sources'); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'outside.json'), '{"outside":true}');
  fs.linkSync(path.join(outside, 'outside.json'), path.join(f.root, 'docs/hard.json'));
  const links = require('./helpers/filesystem-links.cjs');
  links.symlinkSync(outside, path.join(f.root, 'docs/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  execFileSync('git', ['add', 'docs/hard.json'], { cwd: f.root });
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: f.root, input: '{"outside":true}' }).toString().trim();
  execFileSync('git', ['update-index', '--add', '--cacheinfo', '100644', blob, 'docs/linked/outside.json'], { cwd: f.root });
  const result = await f.build();
  assert.equal(result.references, 0);
  assert.equal(result.complete, false);
  await links.fileLinkCase(t, 'real JSON source symbolic link', async () => {
    const linked = await fixture(t, { readme: '# Reader\n\n[Linked](docs/linked.json)\n' });
    links.symlinkSync(path.join(outside, 'outside.json'), path.join(linked.root, 'docs/linked.json'));
    execFileSync('git', ['add', 'docs/linked.json'], { cwd: linked.root });
    assert.equal((await linked.build()).references, 0);
  });
});

test("current indexed documentation has no unresolved source links and every admitted reference opens through the bounded reader", async (t) => {
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'documentation-inventory-'));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  const { bundleDocumentation } = await import('../scripts/documentation/bundle.mjs');
  const { documentSources } = await import('../website/inventory.mjs');
  const result = await bundleDocumentation({ root, output });
  assert.equal(result.documents, (await documentSources(root)).length);
  assert.equal(result.issues, 0);
  assert.equal(result.complete, true);
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'index.json')));
  const service = createDocumentationService({ directory: output });
  assert.equal(service.list().complete, true);
  for (const reference of manifest.references) {
    const view = service.read({ id: reference.id });
    assert.equal(view.complete, true);
    assert.ok(Buffer.byteLength(view.html) <= MAX_ARTICLE);
    assert.equal(view.article.id, reference.id);
    assert.doesNotMatch(view.html, /(?:src|href)="(?:file|https?):/);
  }
  t.diagnostic(JSON.stringify(result));
});
