# Browser-native visitor consumers

The visitor workspace has real local operations alongside separately labelled learning examples and the authenticated companion. These consumers never use a companion session, transmit workbench contents, claim native host authority, accept personal-vocabulary JSON, or execute arbitrary commands. The existing desktop-only vocabulary guide remains unchanged.

## Current source implementation

| Identity | Concrete visitor consumer | Remaining identity scope |
| --- | --- | --- |
| `exports` | Current plan JSON, readable Markdown/text; selected recovery copy; browser preferences; filtered local requests/notices | All supported structured formats, round-trip imports for new stores, full collection export beyond loaded records |
| `local-history` | Manual named IndexedDB plan snapshots; preserve current plan before restore; restore adds a subsequent snapshot | Automatic every-mutation history, protected access, complete date/action filtering, retention UI, native version-control backing |
| `file-converter` | Explicit UTF-8 `.txt`/`.md` selection up to 1 MiB, in-memory editor, LF text/Markdown and versioned JSON text-envelope output | Other seven categories and full document/PDF tools, disk-backed transfer queue |
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
