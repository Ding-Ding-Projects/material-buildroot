import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { VOCABULARY_LIMITS, parseVocabularyBytes, VocabularyError } from '../../shared/personal-vocabulary.mjs';
const require = createRequire(import.meta.url);
const storage = require('../jobs/storage.cjs');
/** Caller supplies an isolated private directory outside workspace/history stores. */
export function createFileVocabularyCache({ directory }) {
 try { directory = storage.directory(directory); } catch { throw new VocabularyError('CACHE_UNAVAILABLE'); }
 const file = path.join(directory, 'local-language-cache.json');
 const commit = bytes => {
  const temporary = file + '.' + crypto.randomUUID() + '.tmp'; let fd;
  try {
   storage.assertSafe(file); fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
   storage.assertSafe(file); fs.renameSync(temporary, file);
  } catch { throw new VocabularyError('CACHE_UNAVAILABLE'); }
  finally { if (fd !== undefined) fs.closeSync(fd); try { fs.unlinkSync(temporary); } catch {} }
 };
 return Object.freeze({
  async read() {
   let fd;
   try {
    storage.assertSafe(file);
    try { fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0)); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    const stat = fs.fstatSync(fd); if (!stat.isFile() || stat.size > VOCABULARY_LIMITS.bytes) throw new VocabularyError('INVALID_BYTES');
    // Read one extra byte to detect a file growing after its stat without an unbounded allocation.
    const buffer = Buffer.alloc(VOCABULARY_LIMITS.bytes + 1); let size = 0;
    while (size < buffer.length) { const count = fs.readSync(fd, buffer, size, buffer.length - size, null); if (!count) break; size += count; }
    if (size === 0) return null; // Durable clear tombstone; an import cannot produce an empty file.
    const bytes = new Uint8Array(buffer.subarray(0, size)); parseVocabularyBytes(bytes); return bytes;
   } catch { throw new VocabularyError('CACHE_UNAVAILABLE'); }
   finally { if (fd !== undefined) fs.closeSync(fd); }
  },
  async replace(bytes) { parseVocabularyBytes(bytes); commit(new Uint8Array(bytes)); },
  async clear() { commit(new Uint8Array()); },
 });
}
