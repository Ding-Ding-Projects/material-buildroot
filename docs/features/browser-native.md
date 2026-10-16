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

The public visitor surface cannot discover native editors, run Buildroot, manage host services, install models, publish using host credentials or imply shared-mode state from local flags. Those authority boundaries do not excuse browser-native feature gaps. Full appearance editing, native-style tabs, command palette, protected locks, authenticator, scheduling, complete converter categories, per-control guidance, language humor controls and required complete exports remain unresolved source work here.

## Expression evaluation and provenance

The browser adapter copies the existing full renderer expression workbench but replaces desktop wording/status imports with neutral browser-local helpers. It imports no private vocabulary cache or desktop bridge. Each search owns its own pattern, flags, mode, sample and worker. Plain search is the default. Expression evaluation has the existing bounded startup/evaluation timeouts and terminates its worker. History, requests, notices, preferences and voice pickers mount distinct adjacent builders. Search and workbench state currently remains session-local.

The documentation producer emits both evaluator workers as same-origin ES modules and preserves module URL semantics in the main bundle. Their source paths, browser-native modules and shared presentation styles participate in the input snapshot. Offline documentation uses the existing generated asset inventory; actual cache completeness still requires runtime proof.

## Verification state

Implementation was prepared in a build-only delivery mode. No tests, static analysis, audits, browser runtime exercises, accessibility checks or screenshots were run for this change. The parent task owns the exact root build, integration, publication and subsequent acceptance records. No native, browser, installed or hosted success is claimed from this source work.

## 粵語使用說明

訪客工作區新增真實本機功能：文字檔案轉換、計劃匯出、具名稱復原副本、獨立專注模式、本機聲音旁白，以及疑難排解事項同操作通知。以上唔係學習示例，亦唔會授予桌面控制權。

計劃還原前會先儲存目前內容；非同步儲存期間如有編輯，就取消還原。復原副本同目前計劃分開保存，清除目前工作唔會刪除副本。只載入最近 1,000 份副本，舊資料仍然保留。請使用瀏覽器網站資料控制移除全部本機記錄，並留意其他同來源資料亦會刪除。

文字工具只接受最大 1 MiB 嘅 UTF-8 `.txt` 或 `.md`。原檔不變，文字只留喺記憶體。輸出會統一為 LF 換行；Markdown 係原文，JSON 文字封裝唔係計劃備份。網站只確認已要求下載，唔能確認最後儲存完成。

五項專注模式同旁白各自儲存，預設全部關閉。旁白只讀固定一般操作事件，唔讀筆記、檔案內容或配對資料。英文同香港粵語聲音必須由瀏覽器回報為本機聲音；聲音缺失會明確顯示。使用螢幕閱讀器時可手動暫停旁白。

復原事項只儲存喺瀏覽器，唔會提交畀維護者。編輯會核對版本，批次變更會分開回報成功、舊版本同未嘗試項目。請勿輸入憑證，因為本機記錄未加密。新搜尋欄各自有相鄰表達式工作台，預設使用普通文字搜尋。

目前只完成來源實作，尚未執行建置、測試、瀏覽器操作、無障礙驗證或畫面擷取。完整功能身分同 PH09-T01 仍未完成，唔應根據此文件勾選驗收。
