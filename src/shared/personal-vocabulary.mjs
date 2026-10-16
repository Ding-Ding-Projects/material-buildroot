/** Local data only. This module contains no mappings and performs no I/O. */
export const VOCABULARY_LIMITS = Object.freeze({ bytes: 256 * 1024, depth: 8, keyCodePoints: 160, valueCodePoints: 1000 });
const handles = new WeakMap();
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const word = /[\p{L}\p{N}\p{M}_]/u;
const control = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
export class VocabularyError extends Error {
 constructor(code) { super('The local language data could not be used.'); this.name = 'VocabularyError'; this.code = code; }
}
const fail = code => { throw new VocabularyError(code); };
// Parse object keys before JSON.parse can discard decoded duplicates.
function checkJson(text) {
 let at = 0;
 const space = () => { while (/[\x20\t\r\n]/u.test(text[at] || '')) at++; };
 const string = () => {
  const start = at;
  if (text[at++] !== '"') fail('INVALID_JSON');
  while (at < text.length) {
   const c = text[at++];
   if (c === '"') { try { return JSON.parse(text.slice(start, at)); } catch { fail('INVALID_JSON'); } }
   if (c === '\\') {
    const escaped = text[at++];
    if (!escaped || !'"\\/bfnrtu'.includes(escaped)) fail('INVALID_JSON');
    if (escaped === 'u') { if (!/^[0-9a-f]{4}$/iu.test(text.slice(at, at + 4))) fail('INVALID_JSON'); at += 4; }
   } else if (c < ' ') fail('INVALID_JSON');
  }
  fail('INVALID_JSON');
 };
 const value = depth => {
  space(); const c = text[at];
  if (c === '{') {
   if (depth >= VOCABULARY_LIMITS.depth) fail('DEPTH_LIMIT');
   at++; const keys = new Set(); space(); if (text[at] === '}') { at++; return; }
   for (;;) {
    space(); const key = string(); if (keys.has(key)) fail('DUPLICATE_KEY'); if (unsafe.has(key)) fail('INVALID_SCHEMA'); keys.add(key);
    space(); if (text[at++] !== ':') fail('INVALID_JSON'); value(depth + 1); space();
    if (text[at] === '}') { at++; return; } if (text[at++] !== ',') fail('INVALID_JSON');
   }
  }
  if (c === '[') fail('INVALID_SCHEMA');
  if (c === '"') { string(); return; }
  const primitive = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(text.slice(at));
  if (!primitive) fail('INVALID_JSON'); at += primitive[0].length;
 };
 value(0); space(); if (at !== text.length) fail('INVALID_JSON');
}
export function parseVocabularyBytes(bytes) {
 if (!(bytes instanceof Uint8Array)) fail('INVALID_BYTES');
 if (bytes.byteLength > VOCABULARY_LIMITS.bytes) fail('BYTE_LIMIT');
 let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail('INVALID_UTF8'); }
 checkJson(text);
 let parsed; try { parsed = JSON.parse(text); } catch { fail('INVALID_JSON'); }
 if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length !== 2 || !Object.hasOwn(parsed, 'schemaVersion') || !Object.hasOwn(parsed, 'entries')) fail('INVALID_SCHEMA');
 if (parsed.schemaVersion !== 1) fail('UNSUPPORTED_VERSION');
 if (!parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) fail('INVALID_SCHEMA');
 const entries = [];
 for (const [key, replacement] of Object.entries(parsed.entries)) {
  if (!key || unsafe.has(key) || [...key].length > VOCABULARY_LIMITS.keyCodePoints || typeof replacement !== 'string' || [...replacement].length > VOCABULARY_LIMITS.valueCodePoints || control.test(replacement)) fail('INVALID_SCHEMA');
  entries.push([key, replacement]);
 }
 const canonical = new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, entries: parsed.entries }));
 if (canonical.byteLength > VOCABULARY_LIMITS.bytes) fail('BYTE_LIMIT');
 const handle = Object.freeze(Object.create(null)); handles.set(handle, { entries, bytes: canonical }); return handle;
}
function matcher(handle) {
 const vocabulary = handles.get(handle); if (!vocabulary) fail('INVALID_HANDLE');
 const root = new Map();
 for (const [key, replacement] of vocabulary.entries) {
  let node = root; for (const character of key) { if (!node.has(character)) node.set(character, new Map()); node = node.get(character); } node.replacement = replacement;
 }
 return text => {
  const points = [...text]; const output = [];
  for (let start = 0; start < points.length;) {
   let found, node = root;
   if (start === 0 || !word.test(points[start - 1])) {
    for (let end = start; end < points.length; end++) {
     node = node.get(points[end]); if (!node) break;
     if (node.replacement !== undefined && (end + 1 === points.length || !word.test(points[end + 1]))) found = { end: end + 1, replacement: node.replacement };
    }
   }
   if (found) { output.push(found.replacement); start = found.end; } else output.push(points[start++]);
  }
  return output.join('');
 };
}
export function createVocabularyController({ privateCache, schoolMode = () => false }) {
 if (!privateCache || !['read', 'replace', 'clear'].every(key => typeof privateCache[key] === 'function')) fail('CACHE_UNAVAILABLE');
 let selected = null, replace = text => text, state = 'empty', queue = Promise.resolve();
 const status = () => schoolMode() ? { state: 'empty', active: false } : { state, active: selected !== null };
 const select = handle => { selected = handle; replace = handle ? matcher(handle) : text => text; };
 const serialize = task => { const result = queue.then(task); queue = result.catch(() => {}); return result; };
 const cacheAction = async task => { try { return await task(); } catch { throw new VocabularyError('CACHE_UNAVAILABLE'); } };
 return Object.freeze({
  status,
  load() { return serialize(async () => {
   let bytes; try { bytes = await privateCache.read(); } catch { select(null); state = 'corrupt'; return status(); }
   if (bytes === null) { select(null); state = 'empty'; return status(); }
   try { select(parseVocabularyBytes(bytes)); state = 'loaded'; } catch { select(null); state = 'corrupt'; }
   return status();
  }); },
  importBytes(bytes) {
   // Snapshot at invocation, before a queued operation can observe caller mutation.
   const snapshot = bytes instanceof Uint8Array && bytes.byteLength <= VOCABULARY_LIMITS.bytes ? new Uint8Array(bytes) : bytes instanceof Uint8Array ? null : undefined;
   return serialize(async () => {
    let candidate; try { if (snapshot === null) fail('BYTE_LIMIT'); candidate = parseVocabularyBytes(snapshot); } catch { state = 'invalid'; return status(); }
    await cacheAction(() => privateCache.replace(new Uint8Array(handles.get(candidate).bytes)));
    select(candidate); state = 'loaded'; return status();
   });
  },
  clear() { return serialize(async () => { await cacheAction(() => privateCache.clear()); select(null); state = 'empty'; return status(); }); },
  formatOwnedText(text, { kind, mode } = {}) {
   if (typeof text !== 'string') fail('INVALID_TEXT');
   if (!['ui-copy', 'accessible-name'].includes(kind) || !['en', 'zh-HK', 'bilingual'].includes(mode) || schoolMode()) return text;
   return replace(text);
  },
  // Expose only the exact approved celebration heading, never the mapping inventory.
  appliedHeadline() {
   if (schoolMode() || state !== 'loaded' || !selected) return null;
   const entry = handles.get(selected).entries.find(([key]) => key === 'private vocabulary');
   return entry ? entry[1] : null;
  },
  exportDisclosure() { return 'Local language data and file metadata are excluded from exports and history.'; },
 });
}
