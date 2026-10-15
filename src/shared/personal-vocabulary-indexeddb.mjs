import { parseVocabularyBytes, VocabularyError } from './personal-vocabulary.mjs';
/** Per-origin, per-browser-profile storage. No synchronization or network route. */
export function createIndexedDbVocabularyCache({ indexedDB = globalThis.indexedDB, databaseName = 'local-language-cache-v1' } = {}) {
 let pending;
 const open = () => {
  if (!indexedDB || typeof indexedDB.open !== 'function') return Promise.reject(new VocabularyError('CACHE_UNAVAILABLE'));
  if (!pending) {
 const opening = new Promise((resolve, reject) => {
   let request, unavailable = false; try { request = indexedDB.open(databaseName, 1); } catch { reject(new VocabularyError('CACHE_UNAVAILABLE')); return; }
   request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('private-cache')) request.result.createObjectStore('private-cache'); };
   request.onerror = request.onblocked = () => { unavailable = true; pending = undefined; reject(new VocabularyError('CACHE_UNAVAILABLE')); };
   request.onsuccess = () => { const db = request.result; if (unavailable) { db.close(); return; } db.onversionchange = () => { db.close(); pending = undefined; }; resolve(db); };
  });
  pending = opening;
  opening.catch(() => { if (pending === opening) pending = undefined; });
 }
  return pending;
 };
 const transaction = async (mode, action) => {
  const db = await open();
  return new Promise((resolve, reject) => {
   let tx, result;
   try { tx = db.transaction('private-cache', mode); const request = action(tx.objectStore('private-cache')); request.onsuccess = () => { result = request.result; }; }
   catch { reject(new VocabularyError('CACHE_UNAVAILABLE')); return; }
   tx.oncomplete = () => resolve(result);
   tx.onerror = tx.onabort = () => reject(new VocabularyError('CACHE_UNAVAILABLE'));
  });
 };
 return Object.freeze({
  async read() { const value = await transaction('readonly', store => store.get('selection')); if (value === undefined) return null; if (!(value instanceof Uint8Array)) throw new VocabularyError('INVALID_BYTES'); parseVocabularyBytes(value); return new Uint8Array(value); },
  async replace(bytes) { parseVocabularyBytes(bytes); const snapshot = new Uint8Array(bytes); await transaction('readwrite', store => store.put(snapshot, 'selection')); },
  async clear() { await transaction('readwrite', store => store.delete('selection')); },
  async close() { if (pending) { const db = await pending; db.close(); pending = undefined; } },
 });
}
