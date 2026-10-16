# Browser-native visitor consumers

The visitor workspace has real local operations alongside separately labelled learning examples and the authenticated companion. These consumers never use a companion session, transmit workbench contents, claim native host authority, accept personal-vocabulary JSON, or execute arbitrary commands. The existing desktop-only vocabulary guide remains unchanged.

## Current source implementation

| Identity | Concrete visitor consumer | Remaining identity scope |
| --- | --- | --- |
| `exports` | Current plan JSON, readable Markdown/text; selected recovery copy; browser preferences; filtered local requests/notices | Formats now include the explicit structured envelopes below; round-trip imports for new stores and full collection export beyond loaded records remain open |
| `local-history` | Manual named IndexedDB plan snapshots; preserve current plan before restore; restore adds a subsequent snapshot | Automatic every-mutation history, protected access, complete date/action filtering, retention UI, native version-control backing |
| `file-converter` | Explicit UTF-8 `.txt`/`.md` selection and structured text output, plus the durable paged raster conversion queue below | Remaining document/PDF, audio/video, archive and other category adapters; complete tool acceptance |
| `download-handoff` | Local Blob download request, bounded URL lifetime, honest final-save uncertainty | Native editor discovery, verified transfer completion, paired-client transfer |
| `regex-search` | Isolated full expression workbench adapted from the renderer, adjacent to each added local search; actual worker search | Complete public-page and nested-picker inventory, persisted query/snippet state, broader engine requirements beyond the inherited workbench |
| `adhd-modes` | Independent persisted Focus, Low stimulation, Time awareness, One thing at a time and Momentum | Full surface-wide integration, humor levels and shared restrictions |
| `narration` | Opt-in generic operation events, browser-reported local English/Hong Kong Cantonese voices, sequential bilingual speech, rate/pitch, stop, explicit screen-reader pause | Full event inventory, cross-surface screen-reader coordination and complete category controls |
| `display-name` | Persisted visitor heading/title, reset, unchanged storage/package identity | Automatic append-only rename history and complete renamed notification/about copy |
| `support-tickets` | Real local requests with create/edit, optimistic revision checks, open/resolved/archive statuses and search/export | Protected recovery ladder and authenticated support submission are not provided by this local desk |
| `notifications` | Persisted fixed generic local operation notices, own search/export and unavailable-storage state | Full notification category coverage, advanced date range and bulk review/dismissal |
| `bulk-actions` | Loaded request selection, shift-click range, all/invert/clear, per-record revision checks, cancellable status updates and partial results | Complete keyboard-range support and every other collection |
| `authenticator` | AES-GCM/PBKDF2 browser vault, explicit Base32 enrollment, local HMAC time codes, reveal/idle/hidden locking, encrypted export and encrypted mutation ledger | Encrypted backup restore, QR enrollment, full protected-history restore, independently verified clock and standards vectors |
| `element-locks` | Vault-password-backed local enrollment, timed/on-leave unlock, capture-phase interaction suppression and locked appearance protection | Browser data remains owner-resettable; complete cross-tab policy synchronization, every shadow element and full policy dimensions |
| `tabs` | Explicit tool catalogue, existing-tab reuse, pin/reorder/group labels, four saved edges, keyboard movement, search and selected unpinned close | Full group workflows, drag ordering, every menu destination and complete tab acceptance matrix |
| `funny-emoji` | Independent persisted English/Cantonese levels, default 5; authored browser-module wording helper and decorative dialog emoji preference | Immediate repaint for every module, legacy guides/articles and all message categories |
| `info-icon-guidance` | Above-control info actions for named visitor fields and every shared appearance property, worked examples, isolated resettable validation playgrounds | Complete hand-written inventory across all controls and nested dialogs |
| `guided-forms` | Field-specific boundaries, worked local examples and actual validated actions | Complete staged form workflows and every control's playground |
| `appearance-editor` | Real per-element/state shared-schema controls, validated local JSON, undo/redo, scoped reset | Full timeline/layers, every shadow-internal element, durable dynamic identities and automatic protected history |
| `color-picker` | Continuous HSV/alpha controls, exact color grammar conversion, representation readouts, opaque contrast and actual target application | Complete gamut/profile-aware contrast, saved color history and all palette routes |
| `logo-customization` | Bounded isolated PNG/JPEG decode, fit/focal/crop/background, PNG derivatives, local apply/reset/export | Additional admitted image formats, broader icon surfaces and runtime proof |
| `context-menus` | Pointer, Shift+F10/context key and touch-hold element actions with adjacent search | Protected element locks and every shadow-internal/menu surface |
| `command-palette` | Ctrl+Shift+F discovers current visitor controls, inline switches/single-line edits use original events, exact control navigation | Complete menu/destination inventory, all control kinds and appearance-access coordination |
| `super-confirmation` | Fresh two-key/full-slider confirmation for current plan reset/import, preference reset, appearance import/reset, schedule reset and logo reset | Every remaining destructive or replacement action, complete animation/proof matrix |
| `scheduled-settings` | Actual recurring weekday/overnight language/theme interval with local-time semantics, preserved manual base, reset/export | Multiple rule precedence, complete appearance settings, protected external sources and Home Assistant |
| `progress-recovery` | Initiator status for reading/export/storage/bulk mutations; stale-edit preservation and retry instructions | Durable cross-process jobs and complete recovery inventory |

These are source implementations, not complete acceptance of any catalogue identity. PH09-T01 remains open. Existing language, theme, visitor plan/import/export and offline documentation consumers remain independent.

## Local storage and reset boundaries

The existing `mb-visitor-workspace-v1` plan remains the authority for current goal, notes and checks. Restoring a recovery copy updates this same plan rather than maintaining a disconnected second plan. A failed current-plan write keeps the in-memory plan unchanged. The pre-restore copy is committed before replacement; edits detected during that asynchronous save cancel the restore. A later snapshot failure leaves the operation incomplete and asks the visitor to inspect current state.

`material-buildroot-visitor-recovery-v1` stores manual recovery copies. The newest 1,000 are loaded through a descending cursor. Older copies are retained, not silently deleted. Clearing current work does not clear these copies. The selected-copy JSON is accepted by the existing visitor backup import. This is a browser snapshot store, not a native version-control repository.

`mb-visitor-preferences-v1` stores bounded browser presentation/narration preferences. Defaults have every attention mode and narration disabled, automatic voices, rate and pitch 1, and no custom name or next action. Reset removes only this preference record. Other tabs receive changes through the storage event. Browser storage denial is shown honestly; active memory state is not described as durable.

`material-buildroot-visitor-records-v1` contains local requests and generic notices. Requests are never submitted externally. Edits and bulk status changes compare the previously observed revision in the same IndexedDB transaction. Archiving retains data. Bulk cancellation stops subsequent operations and reports updated, stale and unattempted counts. New requests, existing request bodies and source text can contain personal material; the controls warn against credentials and disclose unencrypted local storage.

Deleting all website data through browser controls removes these browser-owned stores, together with other data for this origin. No control claims that these stores survive profile deletion or provide confidentiality from other same-origin code.

## Text, exports and unavailable capabilities

File selection checks extension and byte size before reading; fatal UTF-8 decoding and NUL rejection keep unsupported binary input out. A generation counter prevents an older file read from replacing a newer edit or clear. Original files are never modified. Text stays in memory and is not written into history or notices.

Text and Markdown exports normalize line endings to LF and retain the remaining text. Markdown is source, not rendered or sanitized HTML. JSON text envelopes contain `version`, `encoding`, `lineEndings` and `text`; they are not plan backups. Export buttons request a browser download and expressly cannot prove its final saved path or completion. JSON plan exports preserve the current version 1 backup shape. Human-readable plan exports are not round-trip backups.

The public visitor surface cannot discover native editors, run Buildroot, manage host services, install models, publish using host credentials or imply shared-mode state from local flags. Those authority boundaries do not excuse browser-native feature gaps. Full appearance timeline/layers, complete tab/group behavior, protected-lock policy dimensions, complete authenticator backup/QR/history routes, multi-source scheduling, complete converter categories, complete per-control guidance, every-surface wording coverage and required complete exports remain unresolved source work here.

## Expression evaluation and provenance

The browser adapter copies the existing full renderer expression workbench but replaces desktop wording/status imports with neutral browser-local helpers. It imports no private vocabulary cache or desktop bridge. Each search owns its own pattern, flags, mode, sample and worker. Plain search is the default. Expression evaluation has the existing bounded startup/evaluation timeouts and terminates its worker. History, requests, notices, preferences and voice pickers mount distinct adjacent builders. Search and workbench state currently remains session-local.

The documentation producer emits both evaluator workers as same-origin ES modules and preserves module URL semantics in the main bundle. Their source paths, browser-native modules and isolated browser presentation styles and shared appearance/decoder source participate in the input snapshot. Offline documentation uses the existing generated asset inventory; actual cache completeness still requires runtime proof.

## Verification state

Implementation was prepared in a build-only delivery mode. No tests, static analysis, audits, browser runtime exercises, accessibility checks or screenshots were run for this change. The parent task owns the exact root build, integration, publication and subsequent acceptance records. No native, browser, installed or hosted success is claimed from this source work.

## 粵語使用說明

訪客工作區新增真實本機功能：文字檔案轉換、計劃匯出、具名稱復原副本、獨立專注模式、本機聲音旁白，以及疑難排解事項同操作通知。以上唔係學習示例，亦唔會授予桌面控制權。

計劃還原前會先儲存目前內容；非同步儲存期間如有編輯，就取消還原。復原副本同目前計劃分開保存，清除目前工作唔會刪除副本。只載入最近 1,000 份副本，舊資料仍然保留。請使用瀏覽器網站資料控制移除全部本機記錄，並留意其他同來源資料亦會刪除。

文字工具只接受最大 1 MiB 嘅 UTF-8 `.txt` 或 `.md`。原檔不變，文字只留喺記憶體。輸出會統一為 LF 換行；Markdown 係原文，JSON 文字封裝唔係計劃備份。網站只確認已要求下載，唔能確認最後儲存完成。

五項專注模式同旁白各自儲存，預設全部關閉。旁白只讀固定一般操作事件，唔讀筆記、檔案內容或配對資料。英文同香港粵語聲音必須由瀏覽器回報為本機聲音；聲音缺失會明確顯示。使用螢幕閱讀器時可手動暫停旁白。

復原事項只儲存喺瀏覽器，唔會提交畀維護者。編輯會核對版本，批次變更會分開回報成功、舊版本同未嘗試項目。請勿輸入憑證，因為本機記錄未加密。新搜尋欄各自有相鄰表達式工作台，預設使用普通文字搜尋。

目前只完成來源實作，尚未執行建置、測試、瀏覽器操作、無障礙驗證或畫面擷取。完整功能身分同 PH09-T01 仍未完成，唔應根據此文件勾選驗收。

## Appearance, navigation, confirmation and scheduling

The appearance editor consumes the shared bounded property schema without importing the desktop wording/cache or authority modules. Every admitted field writes actual scoped CSS for its selected visitor element and real interaction state. Property/state selectors cannot be supplied by imported files. Appearance imports validate the complete document before confirmation and storage. Undo/redo retains up to 50 session revisions. Structural target identity is explicitly limited across page updates and repeated dynamic records; the companion, recovery-record collection and shadow-internal controls are excluded rather than falsely treated as covered.

Continuous HSV/alpha sliders and exact browser color grammar feed real foreground/background actions. Conversion uses an sRGB canvas and discloses gamut/profile loss. Opaque contrast is not represented as final contrast on an alpha or animated surface. The workspace logo uses a dedicated same-origin worker with format/header/dimension/output bounds and a five-second deadline. Only generated PNG derivatives are stored; the selected original remains in memory. Fit, focal point, zoom and background reach that worker. The heading image is a visitor presentation change, not a package/icon identity change.

The command palette enumerates up to 300 current admitted visitor controls. Inline switches and single-line fields use the original control state and input/change handlers. Navigation opens the actual control rather than claiming an operation executed. Companion controls and credentials are excluded. Pointer, keyboard and touch element menus offer real appearance navigation with their own local search; the local experience-lock route is separately implemented, with its narrower limits below.

Destructive confirmation is a fresh in-page Material dialog with two independent keys, a full-range slider, an expiry, cancellation and focus return. Plan clearing, backup replacement, preference reset and the new appearance/schedule/logo reset/import controls use it. This is a user-experience confirmation, not authentication or host authorization. Other unwrapped operations remain listed as incomplete rather than inheriting a blanket claim.

The language/theme schedule stores one bounded recurring interval. Start is inclusive and end exclusive. For overnight rules, the early-morning portion belongs to the preceding selected weekday. Evaluation uses the current local wall clock and reports the observed timezone; clock/DST changes immediately affect subsequent evaluations. It operates only while the page is open, reevaluates every 30 seconds and on visibility changes, and restores the saved manual base outside the interval. Scheduled effective values are not persisted over manual preferences. Multiple rules, protected external APIs, Home Assistant and other appearance settings are not implemented by this consumer.

粵語補充：外觀控制會實際套用至所選訪客元素同互動狀態，唔會製造成功或載入證據。顏色工具同標誌轉換有實際輸出，但完整動畫時間軸、受保護元素鎖同全部 Shadow 內部控制仍未完成。Ctrl+Shift+F 選單使用原有控制項事件；配對權限保持獨立。重設及指定取代操作須完成兩項確認同百分之一百滑桿。語言／主題排程只喺此頁開啟期間運作，按本機時間同所選星期套用，時段以外會恢復手動設定。

## Encrypted authenticator and local experience locks

The browser authenticator is independent of operating-system credential storage and authenticated companion sessions. It uses a nonextractable AES-GCM key derived by PBKDF2-HMAC-SHA-256 with a random 16-byte salt and 310,000 iterations. Each save uses a fresh 12-byte nonce and stable application-specific additional authenticated data. The complete account collection and mutation ledger are encrypted before IndexedDB storage. The envelope exposes only its version, random encryption parameters, ciphertext and revision. A transaction compares the expected prior revision before publishing an edit.

Passwords and enrollment inputs are masked and cleared from their controls after submission. Account lists omit enrollment secrets. TOTP uses Web Crypto HMAC, an eight-byte big-endian time counter and dynamic truncation, adapted from the existing host algorithm. SHA-1, SHA-256 and SHA-512, six/seven/eight digits and 15/30/60/120-second periods are explicitly offered. Codes require an explicit reveal action and are never automatically narrated or copied. Page hiding and ten idle minutes lock the vault and remove displayed account/code content. Clock discontinuity is diagnosed locally; absolute device-clock accuracy is unknown. No standards-vector or runtime claim is made.

The vault admits 50 accounts and 100 encrypted creation/removal events. Reaching the ledger bound blocks mutation instead of truncating history. The ledger is not full secret-snapshot restoration. Encrypted export is available; encrypted import, password rotation and QR enrollment remain absent. Losing the local password has no recovery through this page. Same-origin code can access unlocked browser data, and JavaScript cannot promise physical memory erasure. This is an explicit browser boundary, not a claim of equivalence to a host credential vault.

Element experience locks use the unlocked local vault as their user-experience factor. They never grant host or companion authority. Enrollment names an unambiguous scoped element, persists its identity and starts locked. Unlock is explicit, bounded to 1–60 minutes, and can relock after focus leaves the element. Locking the vault relocks enrolled elements. Capture-phase handlers intercept ordinary pointer/keyboard/input/drop interaction and preserve captured field values; appearance mutation also checks locked identities. Password, recovery, lock-management and companion controls are excluded to preserve recovery. Already-started operations are not cancelled. Missing/ambiguous targets retain their policy and report unavailable rather than applying to another element. Same-origin code or browser-data deletion can reset the experience restriction. Complete cross-tab policy propagation and every protected policy dimension are not implemented.

## Visitor tabs, wording and guidance

Visitor tabs reuse the actual mounted section nodes. New tab lists the concrete visitor tools; reselecting one focuses the existing tab. Closing hides a section without destroying drafts or local data. Open order, active tab, pins, edge and group labels persist separately in `mb-visitor-tabs-v1`. Arrow/Home/End navigation, move-earlier/later controls, selected unpinned close, four edges and responsive top placement are source-implemented. The companion remains separate. Group labels are not a full group-management implementation, and drag ordering and the full application-destination catalogue remain open.

`mb-visitor-tone-v1` stores independent English and Cantonese levels 1–5, defaulting to 5, plus decorative dialog emoji. Serious level 1 retains the factual sentence; other levels append authored light wording. Record values are not translated into private vocabulary. This helper is bound to the new browser modules, with only some consumers repainting immediately; full legacy-guide/article and every-message coverage remains open.

`browser-native-guidance.js` declares named core fields and the shared appearance property inventory. Each admitted field has its own information action above it, actual behavior/boundary explanation, a worked example and a resettable isolated playground. Appearance playgrounds use the same bounded schema; other examples explicitly state their narrower validation. They never mutate live plans, settings, files or account records. This is not a declaration that every visitor control already has guidance.

粵語安全補充：驗證器使用本機密碼加密整個帳戶集，唔等於作業系統安全儲存，亦唔係配對驗證。代碼須明確選擇先顯示，頁面隱藏或閒置十分鐘後會鎖定。加密備份還原、QR 登記同完整秘密歷史還原仍未完成。元素鎖只係可由使用者重設嘅體驗限制，唔會授予主機權限。

粵語導覽補充：分頁保留原有控制項同草稿，新增分頁會列出實際訪客工具。幽默程度各自儲存，唔會改變事實或私人詞彙界線。指定欄位同外觀屬性有獨立指引及試用區，但全體控制項覆蓋仍未完成。以上全部仍屬來源實作，未有執行或驗收證據。

## Structured record export formats

The current plan, selected recovery copy, loaded matching recovery requests and loaded matching operation notices now offer 17 explicit formats: JSON, JSON Lines, YAML 1.2 using JSON-compatible syntax, TOML, XML, CSV, TSV, Markdown, offline HTML, SQLite SQL, JavaScript, TypeScript, Python, Go, Rust, exact-snapshot JSON Schema and Protobuf.

The serializer accepts only bounded JSON-representable data, limits nesting to 32 levels and serialized JSON to 4 MiB, and rejects unsupported or oversized values rather than silently dropping them. TOML contains a JSON string; XML contains base64-encoded UTF-8 JSON; CSV/TSV retain one full JSON cell rather than flattening nested fields; language-source formats retain the JSON payload. The Protobuf envelope is a real wire-format message with field 1 holding UTF-8 JSON bytes, with its schema disclosed beside the control. The JSON Schema format constrains the exact exported snapshot, not a generalized application schema.

Exports remain local download requests and do not claim final filesystem completion. Formatting is UTF-8 with LF. Formats needing envelope decoding say so before export. Only the existing supported version 1 plan shape can be imported by the current plan importer; exporting another format does not imply a matching import workflow. Authenticator secrets are excluded from generic record exports and retain their separately encrypted-only export.

The default six-digit logo background is normalized to opaque eight-digit HEX before the existing bounded decoder consumes it. This source correction follows the first documentation production and has not received runtime acceptance.

## Durable browser image queue

The image route uses a separate IndexedDB database, `material-buildroot-visitor-image-queue-v1`, and stores the explicitly selected source bytes and completed output blobs. PNG/JPEG inputs are bounded to 2 MiB, dimensions no greater than 4096 per side and four million pixels. Signature admission precedes storage; the isolated worker performs full header/animation/dimension checks before decoding. Output dimensions are 16–2048 per side with a four-million-pixel bound. Output supports actual browser PNG, JPEG and WebP encoders; an encoder fallback with a different MIME type is rejected, never renamed. Output metadata and color-profile loss and lossy-quality effects are disclosed.

The queue has no fixed record-count cap and displays 20 records per page. Browser storage quota remains a real capacity limit. Each search explicitly scopes itself to the current page. Page reads use generation binding so an older request cannot replace the newest page. Source/output bytes are excluded from metadata exports, which retain the current selected/matching page scope. Original names are visible local records, not external status messages.

One `navigator.locks` lease owns the producer across tabs. If that API is unavailable, production is unavailable rather than proceeding without exclusion. Claims and terminal publication compare the exact attempt identity in IndexedDB transactions. A prior `running` record found under a newly acquired exclusive lease becomes `interrupted`, never successful and never automatically replayed. Explicit retry changes only eligible failed/interrupted/cancelled intents back to pending. Conversion starts only through the start control.

An isolated worker has a 15-second deadline and reports actual admitted/decoded stages. Cancel terminates active work before publication; once publication begins, the interface reports that cancellation cannot retract it. Stop-after-current prevents the next claim. Completed results become downloadable only after storage publication. A Blob download request does not prove final filesystem completion. Browser page exit can leave an interrupted record, which retains its source and options for explicit recovery.

This is a raster category implementation, not the full eight-category converter. PDF, office, audio/video, SVG/animated image and archive conversions remain unavailable through this route. No native executable, cloud service or hidden desktop operation is substituted. The implementation uses existing bounded image admission source and native browser primitives without adding an unpinned runtime dependency. Its source changes postdate the first documentation build and remain unproduced until another assigned root build.

粵語轉換補充：圖片佇列會保存明確選取嘅本機原檔同完成輸出，每頁顯示二十項，唔會以固定記錄數量偷偷截斷。瀏覽器配額仍然限制容量。只有取得跨分頁獨佔控制先會開始轉換，重試亦要明確操作。中斷唔等於成功，下載要求亦唔等於檔案已儲存完成。此路線只處理列明嘅點陣圖片格式，唔會將未完成嘅 PDF、音訊、影片或封存功能當作已交付。

## Nonsecret settings and binary output encoding

The same structured export controls also consume the current visitor presentation/narration preferences, saved local schedule, stored appearance overrides and wording-style preferences. These scoped exports exclude authenticator data and logo pixels. Each control names its actual record scope; the appearance and schedule formats retain their original versions, while decoding an envelope still requires the disclosed format-specific step.

Completed raster outputs up to 4 MiB can be encoded as Base64 or hexadecimal text from their actual stored bytes. This is reversible byte encoding, not compression or encryption. Larger outputs retain their ordinary binary download route and receive a clear size-limit message rather than a partial text export. This delivers a bounded binary category consumer for existing image outputs, not arbitrary-file decoding or the full binary conversion inventory.

## Bundled PDF and ZIP parser routes

The documentation manifest pins `pdf-lib` 1.17.1 and `fflate` 0.8.2 exactly, with npm integrity records. Their MIT licenses and the bundled PDF transitive package licenses are copied into the offline asset inventory. No CDN or runtime package acquisition is used. These parsers run in a dedicated same-origin worker with a 30-second deadline and explicit input/page/member/output bounds. A worker deadline is not a hard browser heap limit; native isolation and rendered acceptance are not claimed.

The PDF route offers inspect, extract, reorder, rotate, merge, selected-page split into ZIP, and standard-title/metadata operations. At most ten inputs totaling 20 MiB and 2,000 pages are admitted; split is limited to 100 selected pages. Other writes consume the first PDF and exact requested page order; merge consumes all inputs in the shown order. Output is reopened and page count, geometry, rotation and content-stream hashes are compared in order. This does not establish font/resource equivalence or visual rendering. Document-level outlines, attachments, forms and signatures can be lost in copied-page output, with disclosure before execution. Recognized signed, encrypted, malformed and unsupported input is rejected. Removing standard metadata is not redaction and does not remove every page-level or embedded metadata object.

The ZIP route creates archives from up to 200 explicitly selected supported local files, 8 MiB each and 32 MiB total. Compression level 0–9 is real; filenames receive numbered prefixes to prevent silent duplicate replacement. Produced archives are reopened and member lengths/CRC values compared. ZIP inspection validates a bounded central directory, safe member names, declared sizes and supported layout. External extraction is deliberately limited to stored members, with exact size/CRC validation. Deflate members remain inspectable but extraction is unavailable until a separately bounded decoder route is admitted. ZIP64, encryption, encrypted headers, directory-only entries, legacy non-UTF-8 filenames and 7z are not supported here.

PDF/ZIP inputs and outputs currently remain in page memory, separate from the durable raster queue. Cancel terminates the worker and removes offered pending output. A completed result exposes an explicit download; a download request is not final save proof. Inspection and result metadata can be exported separately. These routes do not complete the universal queue, full document format or full archive requirements.

粵語文件補充：PDF 同 ZIP 解析器以確切版本隨網站打包，唔使用 CDN，執行時亦唔會取得套件。PDF 輸出會重新開啟比對頁數、幾何、旋轉同內容串流次序，但唔等於視覺呈現驗收。移除標準中繼資料唔等於遮蓋敏感內容。ZIP 支援真實壓縮建立、有限結構檢視同儲存方式成員解壓，其他格式界線會列明。兩條路線目前只喺頁面記憶體運作，尚未接入完整持久佇列。

## Eight-category browser source coverage

The visitor tool catalogue now reaches concrete browser consumers in each of the eight categories. This table is source routing, not a claim of complete category, offline, visual or runtime acceptance.

| Category | Actual browser consumer | Explicit remaining limits |
| --- | --- | --- |
| Documents/PDF | Bundled PDF inspection/page operations and structural reopening | Office/EPUB conversions, rendered equivalence, full opaque-feature handling and durable queue integration |
| Images | Durable raster queue with native PNG/JPEG/WebP output | Additional source formats, full metadata/color fidelity, all presets and runtime acceptance |
| Audio | Local decoder graph plus bounded PCM16 stereo WAV preview | MP3/FLAC encoding, full-length jobs, exact source fidelity and durable queue integration |
| Video | Browser-supported WebM preview encoder and bounded canvas frames | MP4 output, arbitrary codecs, lossless remuxing, exact container timing and durable queue integration |
| Archives | ZIP creation, structural inspection and stored-member extraction | External Deflate extraction, encryption, ZIP64, 7z and full archive settings |
| Structured Data/Spreadsheets | Bounded CSV/TSV parser, exact-string structured result, CSV/TSV and coding-format exports | Native spreadsheet workbooks, formulas, formatting, richer typing and durable queue integration |
| Code/Text | Actual local UTF-8 text/Markdown input and normalized output envelopes | Rich encoding/code adapters and full file queue integration |
| Binary Encodings | Dedicated Base64/HEX encode/decode worker for recognized binary formats | Arbitrary opaque formats and full encoding inventory |

## Native browser audio/video previews

The media surfaces use the browser's own decoder graph, AudioWorklet and supported MediaRecorder capabilities. They do not capture a microphone, camera, screen or desktop, and do not call a server or native executable. Audio from the selected media element is rerouted into an AudioContext graph; only silence reaches the output destination for the PCM path, while video recording uses a media-stream destination. The submitted media bytes are the only source. API references: [media element routing](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource), [worklet processing](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process), and [encoder capability reporting](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).

Inputs are bounded to 32 MiB and recording to 1–60 requested media seconds. The selected duration intentionally trims longer content. WAV output uses observed PCM samples, the actual context sample rate, two channels and 16-bit samples; header/data sizes and sample counts are checked. WebM output uses an available declared MIME type, scales frames within 1280×720 and requests 24 frames per second. Its EBML signature is checked, but exact final duration, frame cadence and visual equivalence are not established. Metadata, chapters, subtitles, additional tracks and original channel layout may be lost, with disclosure before conversion. Progress announcements are throttled rather than spoken every frame. Page hiding or cancellation stops the local operation and offers no partial output.

The optional `@ffmpeg/core` package was not added to the manifest or output. Registry metadata identifies 0.12.10 as GPL-2.0-or-later, while its package omits a license file. The official `v12.15` source tag resolves to `71aa99d37c02a7b4c435275ca9ef50e612f6efa1` and declares that core version, but the root license covers the MIT wrapper. Complete binary/source/license composition was not established, so that heavier alternative remains unadmitted. Native browser consumers do not depend on it.

## Structured table and binary inputs

The table worker admits UTF-8 CSV/TSV up to 1 MiB, at most 5,000 data rows, 100 columns and 65,536 characters per field. It parses escaped quotes and embedded newlines, rejects inconsistent column counts and duplicate/empty headers, and performs no numeric/date inference. Only the first 20 rows appear in the preview; exports use the full parsed result. CSV/TSV downloads disclose and default to a spreadsheet-safety apostrophe prefix for formula-like values. The separate structured exports retain exact parsed strings without that prefix. JSON vocabulary input and workbook formats are not accepted.

The binary worker admits recognized PNG/JPEG/PDF/ZIP/WAV/FLAC/MP3/MP4/WebM signatures and performs actual Base64/HEX conversion. Binary input/output is capped at 4 MiB; encoded text at 12 MiB so the route can accept its own full-sized output. Base64 decoding checks standard padding and re-encoding, and hexadecimal checks complete byte pairs. Unknown text/JSON or unknown signatures are rejected. Recognition is not a safety scan, a full decoder validation or permission to execute the resulting file. Outputs remain local download requests.

粵語媒體補充：音訊同影片使用瀏覽器原生介面，只讀取明確選取嘅檔案，唔使用咪高峰、鏡頭、桌面畫面或伺服器。預覽會按所選秒數裁短，WAV 使用實際樣本數，WebM 只按列明編碼能力輸出，完整時序同視覺等效未有驗收。

粵語表格及編碼補充：表格保留字串，唔會推斷數字日期；畫面只預覽二十列，但匯出包含完整已接納結果。CSV 安全前綴會明確改變似公式嘅儲存格，其他結構匯出保留原值。二進位工具只做列明格式嘅可還原編碼，唔係加密或安全掃描。全部新增來源仍待指定建置及另行執行驗收。

## Inactive shared-queue continuation

The next source candidate connects all eight category consumers to one durable IndexedDB queue, preserving the existing image queue database. Admission stores selected original bytes, typed options, source revision, adapter version and input digests. A browser Web Lock owns execution; pause and cancellation intents persist, interrupted work is recorded, and retry requires an explicit compatible revalidation. Publication checks the active attempt and cancellation state. Quota estimates are checked before admission and publication, but do not reserve storage. Browser-data deletion still removes these records.

Worker filenames are content-addressed and embedded in the compiled consumer map so an old page does not silently load a replacement worker at a fixed URL. Media contexts are prepared by explicit interaction, released after the queue pass, and share one worklet load per context. A hidden page interrupts media processing. The record list has bounded pages, selection, category/state filters, local search, metadata export and transition history.

This is an inactive recovery checkpoint, not a production or runtime verdict. Outstanding source work includes the image retained-result preview, digest verification for retained historical-output downloads, explicit original-input recovery, complete encrypted authenticator history/restore and remaining authenticator routes, and tab/group restrictions integration. Existing format limitations remain. Tests, runtime interaction and captures were not run. The previous documentation production receipt binds only to the earlier source candidate, not this continuation.

粵語：呢個係未啟用嘅來源恢復點，八類工具已接入共用持久佇列來源，但仍有歷史輸出、原始輸入恢復、受保護歷史及分頁群組工作未完成。未有執行測試、實際介面操作或畫面驗收；之前建置證據唔適用於呢次延續。

The subsequent source correction adds digest-checked historical-output download and original-input recovery. Each recovered input has its own explicit download control. Retained raster output now opens an actual bounded image preview instead of dispatching to a missing consumer. Legacy history without a stored digest remains unavailable through the verified recovery route. These controls remain unverified at runtime; protected authenticator history and tab/group restrictions are still unfinished.

## Encrypted account snapshot continuation

New account additions and removals retain the preceding account collection inside the encrypted vault payload. The unlocked history exposes only event metadata and whether a snapshot exists. A confirmed restore writes a new encrypted revision, retaining the replaced collection as another history snapshot. Old events without snapshots stay visible but cannot be restored. The existing optimistic storage revision protects writes against another tab. History is never silently pruned; fifty accounts, one hundred events and a 500,000-character serialized payload bound reject further mutations at capacity. Secrets never enter general queue history or plaintext exports.

This source adds local snapshot restoration only. Encrypted backup-file import, password rotation, other remaining authenticator routes and tab/group restrictions are still incomplete. No build, test, runtime interaction or capture establishes this new source behavior yet.

The next bounded continuation provides encrypted backup account restoration from a JSON file up to 700 KiB. It requires an unlocked destination vault, explicit confirmation and successful AES-GCM authentication using the backup password. Full backup payload validation occurs before a destination mutation. Only its accounts are restored; imported history is validated but deliberately not merged. Existing destination history and the replaced account snapshot remain encrypted, and the restored collection is encrypted under the destination vault password. Locking cancels in-flight admission and clears input controls. Password rotation and other remaining authenticator routes remain unfinished; this continuation has no runtime or production verdict.

Local password rotation is now present in source. An unlocked user confirms matching bounded replacement passwords; a fresh PBKDF2 salt/key re-encrypts the entire account collection and retained history in the same optimistic IndexedDB revision transaction. The live key changes only after the write completes. Locking invalidates in-flight rotation. Previously exported backups retain their original password. Rotation records a metadata-only encrypted history event and does not expose a reversible old password. Remaining authenticator enrollment routes and wider tab/group restrictions remain incomplete. This source is preserved without a production or runtime verdict.
