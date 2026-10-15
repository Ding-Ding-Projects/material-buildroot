import type { PrivateVocabularyCache } from './personal-vocabulary.mjs';
export function createIndexedDbVocabularyCache(options?: {indexedDB?: IDBFactory; databaseName?: string}): PrivateVocabularyCache & {close(): Promise<void>};
