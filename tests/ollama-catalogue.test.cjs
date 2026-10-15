"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { createOllamaCatalogue, parsePage, pageUrl } = require("../src/main/tools/ollama-catalogue.cjs");
const page = (title, content) => '<!doctype html><html><head><title>' + title + '</title></head><body>' + content + '</body></html>';
const library = page("library", '<script><a href="/library/invented">fake</a></script><a href="/library/fixture">Fixture</a><a rel="next" href="/library?sort=alphabetical&amp;page=2">Next</a>');
const second = page("library", '<a href="/library/second">Second</a><a rel="prev" href="/library?sort=alphabetical">Previous</a>');
const tags = family => page('Tags · ' + family, '<a href="/library/' + family + ':latest"><span>abc123abc123 • 2.0GB • 128K context window • Text, Image input</span></a><a href="/library/' + family + ':q4"><span>def123def123 • 1.2GB • 32K context window • Text input</span></a>');
async function fixture(work) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ollama-catalogue-")); try { await work(directory); } finally { await fs.rm(directory, { recursive: true, force: true }); } }
function transport(calls) { return async (url, options) => { calls.push(url); assert.equal(options.redirect, "error"); assert.equal(options.credentials, "omit"); assert.deepEqual(options.headers, { accept: "text/html" }); const value = url.includes("page=2") ? second : url.includes("/fixture/tags") ? tags("fixture") : url.includes("/second/tags") ? tags("second") : library; return new Response(value, { headers: { "content-type": "text/html; charset=utf-8", etag: '"fixture"' } }); }; }
test("catalogue parses official-shaped data only and retains opaque rounded metadata", () => {
  assert.deepEqual(parsePage(library, "https://ollama.com/library?sort=alphabetical").families, ["fixture"]);
  const parsed = parsePage(tags("fixture"), "https://ollama.com/library/fixture/tags", "fixture");
  assert.equal(parsed.variants.length, 2);
  assert.equal(parsed.variants[0].sizeDisplay, "2.0GB");
  assert.equal(parsed.variants[0].contextDisplay, "128K");
  assert.equal(parsed.variants[0].inputDisplay, "Text, Image");
  assert.equal(parsed.variants[0].sizeBytes, null);
  assert.equal(parsed.variants[0].capabilities, null);
  assert.equal(parsed.variants[0].license, null);
});
test("catalogue rejects SSRF, unsupported pagination, truncated and dynamic source shapes", () => {
  for (const url of ["http://169.254.169.254/library", "https://ollama.com.evil.example/library", "https://user:pass@ollama.com/library", "https://ollama.com/library?url=http://localhost", "https://ollama.com/library/../admin"])
    assert.throws(() => pageUrl(url));
  assert.throws(() => parsePage(library.replace('/library?sort=alphabetical&amp;page=2', 'https://example.com/next'), "https://ollama.com/library"), { code: "CATALOGUE_SOURCE_URL_REJECTED" });
  assert.throws(() => parsePage(library.replace('</html>', ''), "https://ollama.com/library"), { code: "CATALOGUE_HTML_INCOMPLETE" });
  assert.throws(() => parsePage(library.replace('<body>', '<body><div hx-trigger="revealed">'), "https://ollama.com/library"), { code: "CATALOGUE_DYNAMIC_PAGINATION_UNSUPPORTED" });
});
test("catalogue traverses pagination/all families, atomically persists revision and serves offline pages", () => fixture(async directory => {
  const calls = [], catalogue = createOllamaCatalogue({ directory, fetchImpl: transport(calls), paceMs: 0 });
  const refreshed = await catalogue.execute({ action: "ollama.catalogue.refresh" });
  assert.equal(refreshed.refreshing, false);
  assert.deepEqual(refreshed.counts, { models: 2, variants: 4, pages: 4 });
  assert.equal(refreshed.completeness.exhaustive, false);
  assert.ok(calls.includes("https://ollama.com/library?sort=alphabetical&page=2"));
  const offline = createOllamaCatalogue({ directory, fetchImpl: async () => { throw Error("offline"); } });
  const result = await offline.execute({ action: "ollama.catalogue.page", family: "fixture", limit: 1 });
  assert.equal(result.items.length, 1);
  assert.equal(result.next, 1);
  assert.equal(result.revision, refreshed.revision);
  await assert.rejects(offline.execute({ action: "ollama.catalogue.refresh" }));
  assert.equal((await offline.status()).revision, refreshed.revision);
  assert.equal((await offline.status()).lastSuccessfulRefresh, refreshed.lastSuccessfulRefresh);
  await catalogue.dispose(); await offline.dispose();
}));
test("global page/byte limits and parser failures preserve prior valid cache", () => fixture(async directory => {
  const catalogue = createOllamaCatalogue({ directory, fetchImpl: transport([]), paceMs: 0 });
  const old = await catalogue.execute({ action: "ollama.catalogue.refresh" });
  const bounded = createOllamaCatalogue({ directory, fetchImpl: transport([]), paceMs: 0, limits: { pages: 1 } });
  await assert.rejects(bounded.execute({ action: "ollama.catalogue.refresh" }), { code: "CATALOGUE_PAGE_LIMIT" });
  assert.equal((await bounded.status()).revision, old.revision);
  const bytes = createOllamaCatalogue({ directory, fetchImpl: transport([]), paceMs: 0, limits: { bytes: 10 } });
  await assert.rejects(bytes.execute({ action: "ollama.catalogue.refresh" }), { code: "CATALOGUE_BYTE_LIMIT" });
  assert.equal((await bytes.status()).revision, old.revision);
  const malformed = createOllamaCatalogue({ directory, fetchImpl: async () => new Response('broken', { headers: { "content-type": "text/html" } }), paceMs: 0 });
  await assert.rejects(malformed.execute({ action: "ollama.catalogue.refresh" }), { code: "CATALOGUE_HTML_INCOMPLETE" });
  assert.equal((await malformed.status()).revision, old.revision);
}));
test("typed cancellation aborts real streamed HTTP and preserves missing/old state", () => fixture(async directory => {
  let ready;
  const started = new Promise(resolve => ready = resolve);
  const server = http.createServer((_request, response) => { response.writeHead(200, { "content-type": "text/html" }); response.write('<html>'); ready(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const catalogue = createOllamaCatalogue({ directory, paceMs: 0, fetchImpl: async (_url, options) => { const response = await fetch('http://127.0.0.1:' + server.address().port, options); return new Response(response.body, { headers: response.headers }); } });
    const pending = catalogue.execute({ action: "ollama.catalogue.refresh" });
    const rejected = assert.rejects(pending);
    await started;
    assert.equal((await catalogue.execute({ action: "ollama.catalogue.cancel" })).cancelling, true);
    await rejected;
    assert.equal((await catalogue.status()).available, false);
    await catalogue.dispose();
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}));
test("tag names never imply sizes and changed cache provenance is rejected", () => fixture(async directory => {
  const parsed = parsePage(page("Tags · fixture", '<a href="/library/fixture:8GB">fixture:8GB</a>'), "https://ollama.com/library/fixture/tags", "fixture");
  assert.equal(parsed.variants[0].sizeDisplay, null);
  assert.equal(parsed.variants[0].digestDisplay, null);
  const catalogue = createOllamaCatalogue({ directory, fetchImpl: transport([]), paceMs: 0 });
  await catalogue.execute({ action: "ollama.catalogue.refresh" });
  const target = path.join(directory, "official-catalogue.json");
  const record = JSON.parse(await fs.readFile(target, "utf8"));
  record.snapshot.sources[0].url = "http://169.254.169.254/library";
  record.revision = require("node:crypto").createHash("sha256").update(JSON.stringify(record.snapshot)).digest("hex");
  await fs.writeFile(target, JSON.stringify(record));
  await assert.rejects(catalogue.execute({ action: "ollama.catalogue.page" }));
}));
test("HTML tokenizer accepts unquoted links and ignores attribute/raw-text/template decoys", () => {
  const html = page("library", '<a title=\'example href="/library/invented"\' href="/library/fixture">Fixture</a><a href=/library/second>Second</a><template><a href=/library/template-fake>fake</a></template><textarea><a href=/library/text-fake>fake</a></textarea>');
  assert.deepEqual(parsePage(html, "https://ollama.com/library").families, ["fixture", "second"]);
  assert.throws(() => parsePage(page("library", '<a href=/library/fixture>Fixture</a><script>const example="<a href=/library/invented>fake</a>";'), "https://ollama.com/library"), {code:"CATALOGUE_HTML_INCOMPLETE"});
  assert.throws(() => parsePage(page("library", '<a href=/library/fixture>Fixture</a><!-- unterminated'), "https://ollama.com/library"), {code:"CATALOGUE_HTML_INCOMPLETE"});
  const tag = parsePage(page("Tags · fixture", '<a href=/library/fixture:latest><script>999TB</script><!-- 999K context window --><span title=\'class="font-mono"\'>abcdefabcdef</span>2.0GB</a>'), "https://ollama.com/library/fixture/tags", "fixture").variants[0];
  assert.equal(tag.sizeDisplay,"2.0GB");assert.equal(tag.contextDisplay,null);assert.equal(tag.digestDisplay,null);
});
test("cache growth during retained-handle read is rejected within its original byte bound", () => fixture(async directory => {
  const catalogue=createOllamaCatalogue({directory,fetchImpl:transport([]),paceMs:0});await catalogue.refresh();
  const target=path.join(directory,"official-catalogue.json"),initial=(await fs.stat(target)).size;
  const originalOpen=fs.open;let requested=0;
  fs.open=async function(file,...args){const handle=await originalOpen.call(this,file,...args);if(file===target){const originalRead=handle.read.bind(handle);let mutated=false;handle.read=async function(...readArgs){requested+=readArgs[2];if(!mutated){mutated=true;await fs.truncate(target,65*1024*1024);}return originalRead(...readArgs);};}return handle;};
  try{await assert.rejects(catalogue.status(),{code:"CATALOGUE_CACHE_CHANGED"});assert.ok(requested<=initial+1);}finally{fs.open=originalOpen;}
}));
test("cache replacement with a symlink after open fails identity admission", () => fixture(async directory => {
  const catalogue=createOllamaCatalogue({directory,fetchImpl:transport([]),paceMs:0});await catalogue.refresh();
  const target=path.join(directory,"official-catalogue.json"),saved=path.join(directory,"saved.json"),other=path.join(directory,"other.json");await fs.copyFile(target,other);
  const originalOpen=fs.open;
  fs.open=async function(file,...args){const handle=await originalOpen.call(this,file,...args);if(file===target){const originalRead=handle.read.bind(handle);let mutated=false;handle.read=async function(...readArgs){if(!mutated){mutated=true;await fs.rename(target,saved);await fs.symlink(other,target);}return originalRead(...readArgs);};}return handle;};
  try{await assert.rejects(catalogue.status(),{code:"CATALOGUE_CACHE_CHANGED"});}finally{fs.open=originalOpen;}
}));
test("atomic publication is explicitly noncancellable once rename begins", () => fixture(async directory => {
  const catalogue=createOllamaCatalogue({directory,fetchImpl:transport([]),paceMs:0});await catalogue.refresh();
  const originalRename=fs.rename;let cancellation;
  fs.rename=async function(from,to){if(to===path.join(directory,"official-catalogue.json"))cancellation=await catalogue.execute({action:"ollama.catalogue.cancel"});return originalRename.call(this,from,to);};
  try{const result=await catalogue.refresh();assert.deepEqual(cancellation,{cancelling:false,reason:"CATALOGUE_COMMIT_IN_PROGRESS"});assert.equal(result.lastAttempt.state,"completed");assert.equal((await catalogue.status()).revision,result.revision);}finally{fs.rename=originalRename;}
}));
