import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';
test('real IndexedDB commit, abort, restart, corruption and clear stay local', { skip: !fs.existsSync(executable) }, async t => {
 const sources = new Map([
  ['/personal-vocabulary.mjs', new URL('../src/shared/personal-vocabulary.mjs', import.meta.url)],
  ['/personal-vocabulary-indexeddb.mjs', new URL('../src/shared/personal-vocabulary-indexeddb.mjs', import.meta.url)],
 ]);
 let requests = 0;
 const server = http.createServer((req, res) => {
  requests++;
  if (sources.has(req.url)) { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(sources.get(req.url))); }
  else if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Local storage verification</title>'); }
  else { res.statusCode = 404; res.end(); }
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
 const browser = await chromium.launch({ executablePath: executable, headless: true, args: ['--no-sandbox'] }); t.after(() => browser.close());
 const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.evaluate(async () => { window.core = await import('/personal-vocabulary.mjs'); window.cacheModule = await import('/personal-vocabulary-indexeddb.mjs'); });
 // Browser may request its own favicon; account only for requests triggered by the following operations.
 const result = await page.evaluate(async () => {
  const { createVocabularyController } = window.core;
  const { createIndexedDbVocabularyCache } = window.cacheModule;
  const source = String.fromCodePoint(0xe001), target = String.fromCodePoint(0xe002), other = String.fromCodePoint(0xe003);
  const bytes = replacement => new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, entries: { [source]: replacement } }));
  const cache = createIndexedDbVocabularyCache({ databaseName: 'verification-private-cache' });
  let networkCalls = 0;
  const originalFetch = window.fetch; window.fetch = () => { networkCalls++; throw Error('Unexpected network route'); };
  const controller = createVocabularyController({ privateCache: cache });
  const format = c => c.formatOwnedText(source, { kind: 'ui-copy', mode: 'en' });
  const initial = await controller.load(); await controller.importBytes(bytes(target));
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) { const request = put.apply(this, args); this.transaction.abort(); return request; };
  let aborted = false; try { await controller.importBytes(bytes(other)); } catch (e) { aborted = e.code === 'CACHE_UNAVAILABLE'; }
  IDBObjectStore.prototype.put = put;
  const preserved = format(controller) === target;
  await cache.close(); const reopened = createIndexedDbVocabularyCache({ databaseName: 'verification-private-cache' });
  const restarted = createVocabularyController({ privateCache: reopened }); await restarted.load(); const durable = format(restarted) === target;
  const raw = await new Promise((resolve, reject) => { const r = indexedDB.open('verification-private-cache', 1); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
  await new Promise((resolve, reject) => { const tx = raw.transaction('private-cache', 'readwrite'); tx.objectStore('private-cache').put(new TextEncoder().encode('{'), 'selection'); tx.oncomplete = resolve; tx.onerror = reject; }); raw.close();
  const corrupt = await restarted.load(); const shipped = format(restarted) === source;
  await restarted.importBytes(bytes(target)); await restarted.clear(); await reopened.close();
  const finalCache = createIndexedDbVocabularyCache({ databaseName: 'verification-private-cache' }); const cleared = await finalCache.read() === null; await finalCache.close();
  window.fetch = originalFetch;
  return { initial, aborted, preserved, durable, corrupt, shipped, cleared, networkCalls };
 });
 assert.deepEqual(result, { initial: { state: 'empty', active: false }, aborted: true, preserved: true, durable: true, corrupt: { state: 'corrupt', active: false }, shipped: true, cleared: true, networkCalls: 0 });
 assert.ok(requests >= 3);
});
