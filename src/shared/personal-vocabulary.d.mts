export interface VocabularyStatus { state: 'empty' | 'loaded' | 'invalid' | 'corrupt'; active: boolean }
export interface PrivateVocabularyCache { read(): Promise<Uint8Array | null>; replace(bytes: Uint8Array): Promise<void>; clear(): Promise<void> }
declare const vocabularyBrand: unique symbol;
export interface VocabularyHandle { readonly [vocabularyBrand]: true }
export const VOCABULARY_LIMITS: Readonly<{bytes: number; depth: number; keyCodePoints: number; valueCodePoints: number}>;
export class VocabularyError extends Error { readonly code: string; constructor(code: string) }
export function parseVocabularyBytes(bytes: Uint8Array): VocabularyHandle;
export function createVocabularyController(options: {privateCache: PrivateVocabularyCache; schoolMode?: () => boolean}): Readonly<{
 status(): VocabularyStatus;
 load(): Promise<VocabularyStatus>;
 importBytes(bytes: Uint8Array): Promise<VocabularyStatus>;
 clear(): Promise<VocabularyStatus>;
 formatOwnedText(text: string, options?: {kind?: 'ui-copy' | 'accessible-name'; mode?: 'en' | 'zh-HK' | 'bilingual'}): string;
 exportDisclosure(): string;
}>;
