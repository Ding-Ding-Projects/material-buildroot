import fixtureLinks from './helpers/filesystem-links.cjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VOCABULARY_LIMITS, parseVocabularyBytes, createVocabularyController } from '../src/shared/personal-vocabulary.mjs';
import { createFileVocabularyCache } from '../src/main/privacy/personal-vocabulary-cache.mjs';
import { createIndexedDbVocabularyCache } from '../src/shared/personal-vocabulary-indexeddb.mjs';
const encode = text => new TextEncoder().encode(text);
const payload = entries => encode(JSON.stringify({ schemaVersion: 1, entries }));
const neutral = n => String.fromCodePoint(0xe000 + n);
function memoryCache() { let value = null; return { async read() { return value?.slice() ?? null; }, async replace(bytes) { value = bytes.slice(); }, async clear() { value = null; } }; }
const format = (controller, text, options = {}) => controller.formatOwnedText(text, { kind: 'ui-copy', mode: 'en', ...options });

test('strict import handles empty and dynamic inventories without disclosing content', () => {
 for (const count of [0, 1, 7000]) {
  const handle = parseVocabularyBytes(payload(Object.fromEntries(Array.from({ length: count }, (_, n) => [`neutral${n}`, neutral(n % 100)]))));
  assert.equal(JSON.stringify(handle), '{}'); assert.equal(Object.keys(handle).length, 0);
 }
 assert.doesNotThrow(() => parseVocabularyBytes(payload({ ['😀'.repeat(160)]: '😀'.repeat(1000) })));
 assert.throws(() => parseVocabularyBytes(payload({ ['😀'.repeat(161)]: '' })));
 assert.throws(() => parseVocabularyBytes(payload({ x: '😀'.repeat(1001) })));
});

test('rejects byte, UTF-8, schema, decoded duplicate, unsafe, type, and depth violations', () => {
 const invalid = [
  '{"schemaVersion":1,"schemaVersion":1,"entries":{}}',
  '{"schemaVersion":1,"entries":{"neutral":"x","\\u006eeutral":"y"}}',
  '{"schemaVersion":1,"entries":{"__proto__":"x"}}',
  '{"schemaVersion":1,"entries":{"constructor":"x"}}',
  '{"schemaVersion":1,"entries":{"prototype":"x"}}',
  '{"schemaVersion":1,"entries":{},"extra":1}',
  '{"schemaVersion":2,"entries":{}}',
  '{"schemaVersion":1,"entries":[]}',
  '{"schemaVersion":1,"entries":{"neutral":1}}',
  '{"schemaVersion":1,"entries":{"neutral":"\\u0000"}}',
  '{"schemaVersion":1,"entries":{"neutral":"\\u007f"}}',
  '{"schemaVersion":1,"entries":{"": "x"}}',
  '{"schemaVersion":1,"entries":{}} trailing',
  '{"schemaVersion":1,"entries":{"a":{"b":{"c":{"d":{"e":{"f":{"g":{}}}}}}}}}',
 ];
 for (const text of invalid) assert.throws(() => parseVocabularyBytes(encode(text)));
 assert.throws(() => parseVocabularyBytes(new Uint8Array([0xff, 0xfe])), { code: 'INVALID_UTF8' });
 assert.throws(() => parseVocabularyBytes(new Uint8Array(VOCABULARY_LIMITS.bytes + 1)), { code: 'BYTE_LIMIT' });
 const base = payload({}); const exact = new Uint8Array(VOCABULARY_LIMITS.bytes); exact.fill(32); exact.set(base); assert.doesNotThrow(() => parseVocabularyBytes(exact));
 assert.doesNotThrow(() => parseVocabularyBytes(payload({ neutral: '\t\n\r' })));
});

test('atomic imports preserve prior selection, clear restores shipped text, and corruption fails closed', async () => {
 const cache = memoryCache(), controller = createVocabularyController({ privateCache: cache });
 assert.deepEqual(await controller.load(), { state: 'empty', active: false });
 const source = neutral(1), replacement = neutral(2);
 await controller.importBytes(payload({ [source]: replacement }));
 assert.equal(format(controller, source), replacement);
 assert.deepEqual(await controller.importBytes(encode('{')), { state: 'invalid', active: true });
 assert.equal(format(controller, source), replacement);
 const restored = createVocabularyController({ privateCache: cache }); await restored.load(); assert.equal(format(restored, source), replacement);
 await cache.replace(encode('{')); assert.deepEqual(await restored.load(), { state: 'corrupt', active: false }); assert.equal(format(restored, source), source);
 await controller.clear(); assert.equal(await cache.read(), null); assert.equal(format(controller, source), source);
});

test('overlapping import and clear serialize and invocation snapshots resist mutation', async () => {
 const cache = memoryCache(); let release, began;
 const started = new Promise(resolve => began = resolve), blocked = new Promise(resolve => release = resolve);
 const original = cache.replace; cache.replace = async bytes => { began(); await blocked; return original(bytes); };
 const controller = createVocabularyController({ privateCache: cache }), bytes = payload({ [neutral(1)]: neutral(2) });
 const importing = controller.importBytes(bytes); bytes.fill(0); await started;
 const clearing = controller.clear(); release(); await Promise.all([importing, clearing]);
 assert.deepEqual(controller.status(), { state: 'empty', active: false }); assert.equal(await cache.read(), null);
 const restarted = createVocabularyController({ privateCache: cache }); await restarted.load(); assert.equal(format(restarted, neutral(1)), neutral(1));
});

test('failed cache commits preserve selected data and queued operations recover', async () => {
 const cache = memoryCache(), controller = createVocabularyController({ privateCache: cache });
 await controller.importBytes(payload({ [neutral(1)]: neutral(2) }));
 const replace = cache.replace, clear = cache.clear;
 cache.replace = async () => { throw Error('private detail must not escape'); };
 await assert.rejects(controller.importBytes(payload({ [neutral(1)]: neutral(3) })), error => error.code === 'CACHE_UNAVAILABLE' && !error.message.includes('private detail'));
 cache.clear = async () => { throw Error('failure'); }; await assert.rejects(controller.clear());
 assert.equal(format(controller, neutral(1)), neutral(2));
 cache.replace = replace; cache.clear = clear; await controller.clear(); assert.equal(format(controller, neutral(1)), neutral(1));
});

test('literal longest matching is Unicode aware, nonrecursive, and restricted to owned presentation', async () => {
 let school = false; const controller = createVocabularyController({ privateCache: memoryCache(), schoolMode: () => school });
 const a = neutral(1), b = neutral(2), c = neutral(3);
 await controller.importBytes(payload({ [a]: b, [a + a]: c, [b]: c, '😀': a, neutral: b }));
 assert.equal(format(controller, a + a), c); assert.equal(format(controller, a), b); assert.equal(format(controller, '😀'), a);
 assert.equal(format(controller, 'neutralized'), 'neutralized'); assert.equal(format(controller, 'éneutral'), 'éneutral'); assert.equal(format(controller, 'neutral_'), 'neutral_');
 for (const kind of ['code', 'path', 'url', 'command', 'log', 'external-record', undefined]) assert.equal(controller.formatOwnedText(a, { kind, mode: 'en' }), a);
 for (const mode of ['en', 'zh-HK', 'bilingual']) assert.equal(format(controller, a, { kind: 'accessible-name', mode }), b);
 school = true; assert.equal(format(controller, a), a); assert.deepEqual(controller.status(), { state: 'empty', active: false });
 school = false; assert.equal(format(controller, a), b);
 assert.deepEqual(Object.keys(controller.status()).sort(), ['active', 'state']); assert.equal(JSON.stringify(controller).includes(a), false); assert.equal(controller.exportDisclosure().includes(a), false);
});

test('file cache revalidates privately, rejects links, and clear persists across reopen', async t => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'language-cache-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
 const cache = createFileVocabularyCache({ directory }); await cache.replace(payload({ [neutral(1)]: neutral(2) }));
 const filename = path.join(directory, 'local-language-cache.json');
 await t.test('POSIX cache permission bits exclude other users', {skip:process.platform === 'win32' ? 'NTFS ACL privacy requires native ACL evidence; POSIX mode bits do not verify it.' : false}, () => assert.equal(fs.statSync(filename).mode & 0o077, 0));
 const restored = createVocabularyController({ privateCache: createFileVocabularyCache({ directory }) }); await restored.load(); assert.equal(format(restored, neutral(1)), neutral(2));
 await cache.clear(); assert.equal(await createFileVocabularyCache({ directory }).read(), null);
 fs.writeFileSync(filename, '{'); assert.deepEqual(await restored.load(), { state: 'corrupt', active: false });
 await t.test('real file symbolic links cannot redirect cache reads or mutations', async linkTest => {
 fs.unlinkSync(filename); const outside = path.join(directory, 'outside'); fs.writeFileSync(outside, '{}');
 try { fixtureLinks.symlinkSync(outside, filename); } catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') { linkTest.skip('File symbolic-link privilege unavailable; this file-link case remains unverified.'); return; } throw error; }
 await assert.rejects(cache.read()); await assert.rejects(cache.replace(payload({}))); await assert.rejects(cache.clear()); assert.equal(fs.readFileSync(outside, 'utf8'), '{}');
 });
 const link = path.join(directory, 'link'); fixtureLinks.symlinkSync(directory, link, 'dir'); assert.throws(() => createFileVocabularyCache({ directory: path.join(link, 'child') }));
});

test('IndexedDB absence is a generic local storage failure without network fallback', async () => {
 const cache = createIndexedDbVocabularyCache({ indexedDB: {} }); await assert.rejects(cache.read(), { code: 'CACHE_UNAVAILABLE' });
});

test('queued Node Buffer imports copy invocation bytes independently of Buffer.slice', async () => {
 let release, began;
 const blocked = new Promise(resolve => release = resolve), started = new Promise(resolve => began = resolve);
 const cache = memoryCache(); cache.read = async () => { began(); await blocked; return null; };
 const controller = createVocabularyController({ privateCache: cache });
 const loading = controller.load(); await started;
 const bytes = Buffer.from(payload({ [neutral(1)]: neutral(2) }));
 const importing = controller.importBytes(bytes); bytes.fill(0); release();
 await loading; assert.deepEqual(await importing, { state: 'loaded', active: true });
 assert.equal(format(controller, neutral(1)), neutral(2));
});

test('synchronous IndexedDB opening failures remain retryable with generic errors', async () => {
 let attempts = 0;
 const cache = createIndexedDbVocabularyCache({ indexedDB: { open() { attempts++; throw Error('private storage details'); } } });
 for (let n = 0; n < 2; n++) await assert.rejects(cache.read(), error => error.code === 'CACHE_UNAVAILABLE' && !error.message.includes('private storage details'));
 assert.equal(attempts, 2);
 await cache.close();
});
