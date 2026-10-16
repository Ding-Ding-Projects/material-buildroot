# Local personal vocabulary boundary

The reusable loader contains no built-in mappings. Original shipped wording remains unchanged until the user explicitly imports a valid local file or a valid private cache is reloaded. The portable service contract and current desktop integration are described separately below. Website and companion upload consumers remain separate acceptance work.

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

The browser test uses a task-owned headless Chromium context and local source-module server. It proves the IndexedDB adapter, not a built application UI or native Windows runtime. Whole-interface copy coverage, whole-application export exclusions, phone/high-scale accessibility, built-artifact screenshots, independent A/D/C evidence, and native host verification remain open. No feature-ledger completion is claimed.

## Current desktop controls

The desktop Settings workspace now provides localized import/replace and Clear controls through genuine Material buttons and a native file picker. Settings search and the command palette focus the actual control. A dedicated private IndexedDB database stores the bounded vocabulary separately from workspace snapshots and exports. The interface displays only generic status; it does not expose file names, counts, hashes or mappings.

The desktop consumer immediately suppresses substitutions when Clear is requested. If durable deletion fails, substitutions remain suppressed and further imports or clears are disabled for that renderer session. The recovery message requires a full application reload; it does not claim deletion succeeded. Reload validates retained bytes again, so a valid cache whose deletion failed may become active again when shared preference permits. This presentation rule is additional to the portable controller's prior-selection retention described above.

Active or unavailable shared preference omits vocabulary and language settings, search results and palette routes. It forces application-owned controls to English while retaining saved base preferences and cache bytes. A later confirmed inactive state restores eligibility and reloads the private cache. Shared preference status events supersede older pending status responses.

The explicit owned-copy consumer currently covers static shell route labels and accessible names, settings headings and vocabulary palette actions. Interpolated records, provider strings, paths, commands, identifiers and documentation bodies remain exact. This is a bounded consumer inventory, not complete interface-wide customization. Browser checks cover actual IndexedDB operations, failed deletion suppression, reload revalidation and shared-mode transitions with neutral generated inputs. Native protected storage and cross-application mode interoperability remain unverified.


## Desktop drop application and transient feedback

The desktop consumer accepts exactly one local file with a JSON suffix anywhere in its content window. Settings import uses the same serialized file reader, existing bounded parser and private IndexedDB cache. Invalid, oversized, non-JSON and multiple-file drops preserve the last valid selection and show a generic localized notice. Filenames and file contents are not displayed or logged. File drops never navigate the application away from its workspace.

A successful import reports success only when that import returned a loaded and active state, never merely because an older selection remains active. The sole transient heading comes from the imported entry for the ordinary phrase `private vocabulary`, or the localized neutral fallback when that entry is absent. It is carried in a private in-process callback, not a DOM event, public record, history entry or export. The heading is rendered as text, announced politely and discarded after entry, approximately three seconds of hold and exit. Reduced motion uses a static hold. The full-window outer presentation is pointer-transparent and never autofocuses or introduces modal focus management. Its genuine Material Web 2.5.0 filled card can be deliberately focused and scrolled to read the complete maximum-length heading; it never traps focus. The card uses the installed component’s supported slot, bundled typography and focus ring, rather than custom card chrome. Both successful and invalid/unavailable results use one manual-popover route. While a Material dialog is active, the feedback and its initially empty polite live region are mounted inside that dialog’s supported content slot before announcing the text. Closing or opening a dialog relocates the transient feedback to the current accessible boundary without dismissing or replacing the original dialog.

Shared preference changes suppress wording and transient feedback synchronously. Queued file reads are invalidated by a mode change or clear request. An already-started durable cache transaction may settle while the mode is active, but cannot render private output or report a successful celebration in that state. A later inactive transition revalidates the actual cache. Listener, boundary-observer and timer teardown removes the drop consumer and transient output when its owning element disconnects. Reset and shared-mode suppression synchronously clear rendered headline text and accessible labels before removing the portal. Existing failed-clear behavior is unchanged.

The interaction tests are source-browser fixtures, not built Windows evidence. Native file dropping, actual screen-reader speech, full-window top-layer appearance, high-scale layout, source-bound screenshots and current packaged persistence remain unverified until separately exercised. This section does not claim feature completion or broader copy coverage.


### Focused desktop-drop verification

The current source passed TypeScript checking and 18 focused headless Edge renderer cases, including valid and invalid drops, Settings upload, prior-selection retention, persistence, shared-mode suppression, reduced motion, modal success/invalid/unavailable feedback, complete maximum-length heading scrolling, and existing failed-clear recovery. The repeated-invalid case first exposed a text-clearing defect: replacing a live region’s entire text content removed Lit binding markers. Clearing only existing text nodes preserves those markers while still suppressing private output synchronously. The regression now passes, with per-case page-error assertions.

The focused shared/headline run passed 11 cases and skipped three. Selecting the installed Edge executable allowed the initially skipped IndexedDB browser case to pass separately. The two remaining skips concern native ACL privacy and unavailable file-symbolic-link privilege. These separate results do not assert one new combined run.

The renderer run used an isolated headless source-preview fixture with a bounded 60-second case allowance after cold fixture loading exhausted the initial 20-second allowance. No native input, actual screen-reader speech, installed-package behavior, screenshot matrix or native privacy acceptance is claimed.
