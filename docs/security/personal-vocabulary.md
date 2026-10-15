# Local personal vocabulary boundary

The reusable loader contains no built-in mappings. Original shipped wording remains unchanged until the user explicitly imports a valid local file or a valid private cache is reloaded. This document describes the shared non-GUI service. Application, website, and companion upload controls and presentation wiring are separate acceptance work and are not completed by this module.

## Portable input contract

The JSON root is an object with exactly two required fields: `schemaVersion`, whose numeric value is `1`, and `entries`, an object from source strings to replacement strings. There are no other root fields, arrays, nested replacement objects, implicit defaults, legacy migrations, or sample dictionaries. An empty inventory is valid. No minimum, exact, or maximum entry count is imposed independently of the byte limit.

The complete original input must be valid UTF-8 and at most 262,144 bytes, including whitespace. JSON is checked before ordinary parsing to reject duplicate decoded keys, including escaped spellings of the same key. Maximum object nesting is eight; the admitted schema itself needs only root and entries objects. Keys contain one to 160 Unicode code points. The keys `__proto__`, `prototype`, and `constructor` are refused at every object level. Replacement values are strings of zero to 1,000 Unicode code points. C0 control characters except tab, line feed, and carriage return, plus DEL, are refused in values. Unknown versions, unexpected fields, invalid types, malformed JSON, unsafe keys, oversized inputs, and excessive nesting are rejected as a whole.

`parseVocabularyBytes(bytes)` accepts a `Uint8Array` and returns an opaque frozen handle. The handle exposes no inventory, serializable content, source identity, count, or file metadata. Parse errors contain a generic message and bounded symbolic error code, never source text or the parser's original error. Every load revalidates the private cache. Corrupt or unsupported cache data fails closed to shipped wording.

## Controller API

`createVocabularyController({ privateCache, schoolMode })` accepts a local cache adapter with asynchronous `read`, `replace`, and `clear` functions, plus an optional function reporting the current School mode. It exposes:

- `load()`: validate cached bytes before selecting them. Missing cache yields `empty`; corrupt or unreadable cache yields `corrupt` and shipped wording.
- `importBytes(bytes)`: snapshot the input at invocation, validate the complete snapshot, durably replace the cache, then select it. Invalid input yields `invalid`, preserving any prior valid selection. A storage failure rejects with a generic error and preserves the prior selection.
- `clear()`: durably clear the cache before dropping the selection. A failed clear preserves the prior selection and reports failure.
- `status()`: only `{ state, active }`, where state is `empty`, `loaded`, `invalid`, or `corrupt`. No filenames, paths, timestamps, entry counts, hashes, previews, or file identities are returned. An invalid import can have `active: true` because a previous valid selection remains selected.
- `formatOwnedText(text, { kind, mode })`: apply mappings only when kind is `ui-copy` or `accessible-name` and mode is `en`, `zh-HK`, or `bilingual`. Other kinds and omitted/unknown modes return the original string.
- `exportDisclosure()`: generic text explaining the exclusion of local language data and file metadata from exports and history.

All asynchronous controller mutations are serialized in invocation order, including loads, imports, and clears. An import queued before clear cannot complete afterward and resurrect the old selection. Mutating the caller's byte array after invoking import cannot change the queued selection. A rejected operation does not poison the queue. Keep exactly one controller per private cache: independent controllers, tabs, or host processes do not share this queue and must coordinate their ownership separately.

School mode returns shipped wording and an empty/inactive generic status without deleting the prior valid cache. Turning it off restores that selection. Consumers must separately omit the upload controls, routes, search/palette results, and related copy while School mode is active; a disabled or hidden-but-discoverable control does not satisfy that requirement.

## Matching and immutable content

Matching is literal, case sensitive, and deterministic. It uses Unicode code points without case folding or normalization. At each position, the longest matching source wins. A match must start and end outside adjacent Unicode letters, numbers, combining marks, and underscore. Matching resumes after the matched original source; replacement output is never rescanned, so mappings do not cascade or recurse. Punctuation and emoji otherwise retain their literal behavior.

Only explicitly owned UI-copy segments and accessible names may be passed to the formatter. Commands, code, identifiers, URLs, file paths, logs, user records, and factual external text must remain separate immutable segments and must never be submitted as `ui-copy`. The formatter deliberately does not crawl the DOM, rewrite arbitrary text nodes, interpret markup, or attempt to infer the meaning of mixed-content strings. Consumers must use text rendering, never HTML insertion, and preserve those immutable fragments when composing a label. Calling the formatter with an approved kind is an explicit assertion by that consumer that the text is eligible.

## Isolated cache adapters and exclusions

`createFileVocabularyCache({ directory })` in `src/main/privacy/personal-vocabulary-cache.mjs` requires a caller-owned private application-data directory, isolated from workspace settings, snapshots, history, exports, synchronization, telemetry, and diagnostics. It does not accept a source filename or remember the imported file's metadata. Reads are bounded and revalidated, existing symbolic-link components are refused, and writes use exclusive same-directory temporary files with mode 0600, file flush, and atomic rename. Clear atomically replaces the cache with an empty tombstone, preventing stale contents from reappearing when a later deletion fails. Symlink checks are defense in depth, not an OS-wide race or cross-process lock guarantee. Windows ACL and power-loss behavior have not been verified.

`createIndexedDbVocabularyCache({ indexedDB, databaseName })` in `src/shared/personal-vocabulary-indexeddb.mjs` uses local per-origin, per-browser-profile IndexedDB only. It validates reads and writes, and reports completion only after its transaction commits. Aborted replacements preserve the previous committed selection. Clear deletes the selection in a read-write transaction. `close()` releases the database connection. No sync API, account, fetch, remote storage, or fallback network route exists. The host must keep companion imports local to each client rather than transferring them automatically to another surface.

Only validated cache bytes belong in these stores. Never serialize a cache, source metadata, handle, or formatted private output into ordinary settings, undo/history, export, notification, diagnostic, crash report, repository, prompt, analytics, telemetry, screenshot, or publication. The generic exclusion disclosure does not itself filter another service's export: consumers must keep these stores entirely outside their export and history inventories. No source filename or actual private payload was read or added during implementation.

## Verification and remaining work

`node --test tests/personal-vocabulary.test.mjs tests/personal-vocabulary-browser.test.mjs` passes eleven tests on Linux. Tests use generated neutral strings only. They cover dynamic inventory, Unicode and original byte bounds, UTF-8 errors, decoded duplicate keys, schema rejection, private opaque handles, prior-selection preservation, overlapping import/clear, caller mutation including Node Buffer aliasing, retry after synchronous IndexedDB open failure, queue recovery, corruption, literal matching, presentation-kind refusal, School suppression/restoration, cache reload and clear, link rejection, generic failures, and real Chromium IndexedDB commit/abort/reopen/corruption/clear without network fallback.

The browser test uses a task-owned headless Chromium context and local source-module server. It proves the IndexedDB adapter, not a built application UI or native Windows runtime. The visible localized upload/replace/clear controls, semantic picker, search and command-palette routes, all eligible text/accessible-name consumers, whole-application export exclusions, phone/high-scale accessibility, built-artifact screenshots, independent A/D/C evidence, and native host verification remain separate integration work. No feature-ledger completion is claimed.
