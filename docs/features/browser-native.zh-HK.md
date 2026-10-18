# 瀏覽器原生訪客功能

[English](browser-native.md) · [文章目錄](README.md)

訪客工作區有真正本機操作，同另外標示嘅學習示例、已認證伴隨連線分開。呢啲功能唔使用companion session、唔傳工作區內容、唔聲稱native host權限、唔接受個人詞彙JSON、唔執行任意commands。既有desktop-only詞彙guide不變。

## 來源實作清單

下表記錄初始實作同剩餘範圍；後文續篇明確新增嘅部分以續篇為準。來源存在唔代表任何identity完整驗收，PH09-T01仍開放。既有language/theme/visitor plan/import/export/offline documentation各自獨立。

| Identity | 真實訪客功能 | 未完成範圍 |
| --- | --- | --- |
| `exports` | current plan JSON/Markdown/text、selected recovery、preferences、filtered requests/notices | 新stores round-trip同超loaded records完整export；格式見下文 |
| `local-history` | named IndexedDB snapshots、restore前保current、restore後新snapshot | 每mutation自動history、protected access、date/action filter、retention UI、native version control |
| `file-converter` | UTF-8 `.txt`/`.md`、structured output、durable raster queue | 其他categories同完整acceptance，續篇補明示路線 |
| `download-handoff` | local Blob download、bounded URL lifetime、final save未知 | native editor discovery、verified transfer、paired-client transfer |
| `regex-search` | 每search獨立完整workbench、worker search | 全public/nested pickers、persisted query/snippets、更廣engine |
| `adhd-modes` | 獨立保存Focus、Low stimulation、Time awareness、One thing at a time、Momentum | 全surface、humor/shared restrictions整合 |
| `narration` | opt-in generic events、本機英／港粵voices、sequential bilingual、rate/pitch/stop/screen-reader pause | 完整events、跨surface協調、category controls |
| `display-name` | heading/title保存/reset，storage/package identity不變 | append-only rename history、全部notification/about |
| `support-tickets` | local create/edit、revision checks、open/resolved/archive、search/export | protected recovery ladder/authenticated submission |
| `notifications` | persisted固定generic notices、獨立search/export、storage unavailable | 全categories、date range、bulk review/dismiss |
| `bulk-actions` | loaded selection、shift range、all/invert/clear、revision check、cancel/partial results | 完整keyboard range同其他collections |
| `authenticator` | AES-GCM/PBKDF2 vault、Base32、HMAC time codes、reveal/idle/hidden lock、encrypted export/ledger | 原基線backup/QR/history restore/clock/vectors，續篇列新增 |
| `element-locks` | vault-password enrollment、timed/on-leave unlock、capture-phase suppression、locked appearance | owner可reset，cross-tab/every shadow/full policy |
| `tabs` | explicit tools、reuse、pin/reorder/group labels、four edges、keyboard/search/unpinned close | full groups/drag/all destinations/matrix |
| `funny-emoji` | 英／粵獨立levels預設5、authored helper、dialog emoji | every module即時重繪、legacy/all messages |
| `info-icon-guidance` | named fields/shared appearance properties上方info、examples、isolated playgrounds | 所有controls/nested dialogs手寫inventory |
| `guided-forms` | field boundaries/examples/validated actions | 完整staged forms同每control playground |
| `appearance-editor` | per-element/state shared-schema、validated JSON、undo/redo/reset | timeline/layers/shadow internals/durable identities/automatic protected history |
| `color-picker` | continuous HSV/alpha、exact grammar、readouts、opaque contrast、apply | gamut/profile contrast、saved history/all routes |
| `logo-customization` | bounded isolated PNG/JPEG、fit/focal/crop/background、PNG derivatives/apply/reset/export | more formats/icon surfaces/runtime proof |
| `context-menus` | pointer/Shift+F10/context key/touch-hold、adjacent search | locks同every shadow/menu surface |
| `command-palette` | Ctrl+Shift+F、current controls、原events inline edit/navigation | complete destinations/all kinds/access coordination |
| `super-confirmation` | fresh two keys/full slider，plan/preference/appearance/schedule/logo指定reset/import | 其他destructive/replacement、完整animation/proof |
| `scheduled-settings` | local weekday/overnight language/theme、manual base/reset/export | 多rules precedence、全部appearance、protected sources/Home Assistant |
| `progress-recovery` | read/export/storage/bulk initiator state、stale保留/retry | durable cross-process jobs/full recovery |

## 本機儲存同重設

`mb-visitor-workspace-v1` 仍係goal/notes/checks依據。Restore更新同一plan，唔另建斷開副本。Current寫失敗保memory不變。Pre-restore copy先提交，async save期間有edit就cancel restore；之後snapshot失敗留incomplete並要求檢視。

`material-buildroot-visitor-recovery-v1` 存manual copies，descending cursor只載最新1,000，舊份保留。Clear current唔刪copies，selected-copy JSON可原backup import。係browser snapshot唔係native version-control repo。

`mb-visitor-preferences-v1` 存有限presentation/narration。預設五attention modes同narration關閉、自動voice、rate/pitch1、無custom name/next action。Reset只刪此record，其他tabs經storage event更新。Storage拒絕如實顯示，memory唔當durable。

`material-buildroot-visitor-records-v1` 存local requests/generic notices，唔提交外部。Edit/bulk同一IndexedDB transaction比observed revision。Archive保資料，bulk cancel停後續並報updated/stale/unattempted。Request/body/source可能private，提示唔輸credentials，同披露未加密。Browser刪全部origin data會連其他stores一齊刪，唔claim profile deletion後保留或隔絕同origin code。

## 文字、匯出同權限

Selection先查extension/bytes，fatal UTF-8同NUL拒unsupported binary。Generation counter防舊read覆新edit/clear。原檔不變，text只memory，唔入history/notices。文字工具最多1MiB UTF-8 `.txt`/`.md`。Text/Markdown normalize LF保其餘內容；Markdown係source唔係rendered/sanitized HTML。JSON envelope含 `version`, `encoding`, `lineEndings`, `text`，唔係plan backup。Download只要求browser保存，唔證final path/completion。Plan JSON保version1形狀，可讀plan export唔係round-trip。

Public visitor唔發現native editors、唔跑Buildroot/manage host/install models/用host credentials publish，唔由local flags推shared-mode。呢啲權限限制唔豁免browser功能缺口。初版完整appearance timeline、tabs/groups、lock policy、authenticator routes、multi-source scheduling、converter categories、每control guidance、every-surface wording、complete exports仍未完，續篇逐項更新。

旁白只讀fixed generic events，唔讀notes/files/pairing；英／港粵聲音需browser報local，欠voice明示，可手動pause配合screen reader。

## 表達式同來源證明

Browser adapter複用renderer完整expression workbench，但desktop wording/status換neutral local helpers，唔import private vocabulary cache/desktop bridge。每search自有pattern/flags/mode/sample/worker，plain預設，bounded startup/evaluation timeout後terminate。History/requests/notices/preferences/voice pickers各有adjacent builder，state目前session-local。

Producer將兩evaluator workers打成same-origin ES modules，保module URL語意。Source paths/browser modules/isolated styles/shared appearance-decoder參與input snapshot。Offline用generated asset inventory，真cache completeness要runtime proof。

## 原實作驗證狀態

Build-only來源交付冇tests/static analysis/audits/browser/accessibility/captures。主協調任務負責exact root build/integration/publication/acceptance。唔由來源宣稱native/browser/installed/hosted成功。

## 外觀、導覽、確認同排程

Appearance讀shared bounded property schema，唔import desktop wording/cache/authority。每admitted field對selected visitor element同真interaction state寫scoped CSS。Imported files唔供property/state selectors。Import全驗後先confirm/store，undo/redo最多50session revisions。Structural identity跨page updates/repeated dynamic records有限，companion/recovery collection/shadow internals明確排除。

Continuous HSV/alpha同exact browser grammar驅動真foreground/background。sRGB canvas轉換披露gamut/profile loss，opaque contrast唔當alpha/animated final contrast。Logo same-origin worker檢format/header/dimensions/output，五秒deadline；只存generated PNG，original只memory。Fit/focal/zoom/background傳worker，heading image只visitor presentation，唔改package/icon identity。

Palette最多300admitted current controls；inline switches/single-line用原state/input/change handlers，navigation開真control唔claim executed，排除companion/credentials。Pointer/keyboard/touch menus有appearance navigation同local search，experience locks按下文較窄界線。

Destructive confirmation係fresh Material dialog：兩獨立keys、full-range slider、expiry/cancel/focus return。Plan clear、backup replace、preference reset、指定appearance/schedule/logo reset/import用佢。只UX confirmation，唔係auth或host grant；其他unwrapped仍未完。

Language/theme存一bounded recurring interval，start含end唔含。Overnight早晨屬前一selected weekday。本機wall clock、報observed timezone，clock/DST改變影響下次eval。只page open運作，每30秒同visibility change重評，時段外還原manual base。Scheduled effective唔覆persisted manual。Multiple rules/protected APIs/Home Assistant/其他appearance未實作。

## 加密驗證器同本機體驗鎖

Browser authenticator同OS vault/companion session獨立。PBKDF2-HMAC-SHA-256用random16-byte salt、310,000iterations，derive nonextractable AES-GCM key。每save新12-byte nonce同穩定app-specific AAD。Account collection同mutation ledger加密先存IndexedDB，envelope只露version/random parameters/ciphertext/revision，transaction比較expected revision先publish。

Password/enrollment masked，submit後清controls，account list無secrets。TOTP用Web Crypto HMAC、8-byte big-endian time counter、dynamic truncation，改編host算法。明確供SHA-1/256/512、6/7/8digits、15/30/60/120秒。Code要explicit reveal，唔auto narrate/copy。Page hidden或idle十分鐘lock並移除account/code顯示。Clock discontinuity本機診斷，absolute clock accuracy未知，唔claim standards vectors/runtime。

Vault最多50accounts、100encrypted create/remove events，滿拒mutation唔truncate。初版ledger唔係full secret snapshot restore；encrypted export有，import/password rotation/QR當時未有，後續段落明確補充。Lost password頁面無recovery。同origin code可讀unlocked data，JS唔保證physical memory擦除，唔等同host vault。

Element locks用unlocked vault作UX factor，唔授host/companion。Enrollment要unambiguous scoped element，存identity並locked。Unlock明確1–60分鐘，可focus leave後relock；vault lock令全部relock。Capture-phase攔普通pointer/keyboard/input/drop，保captured values，appearance亦查locked identities。為復原排除password/recovery/lock-management/companion controls。唔cancel已開始operations。Missing/ambiguous保policy並報unavailable，唔套錯element。同origin code/browser deletion可reset，初版cross-tab/full dimensions未完。

## 分頁、用語同指引

Visitor tabs重用真mounted sections，New tab列實際tools，再選focus existing；close只hide，唔毀draft/data。`mb-visitor-tabs-v1`分開存order/active/pins/edge/group labels。Source有Arrow/Home/End、move earlier/later、selected unpinned close、four edges、responsive top。Companion獨立，group labels唔係完整groups，drag/full destinations未完。

`mb-visitor-tone-v1`英／粵獨立1–5預設5，加decorative emoji。Level1保factual sentence，其他加authored輕鬆用語，唔將record值變private vocabulary。只綁新modules，部分即時repaint，legacy/article/every-message未全覆蓋。

`browser-native-guidance.js`列named core fields同shared appearance inventory，每field有上方info、行為／界線、worked example、resettable isolated playground。Appearance用同bounded schema，其他examples明說較窄validation，唔改live plan/settings/files/accounts。唔代表每visitor control已有guide。

## 結構記錄匯出

Current plan、selected recovery、loaded matching requests/notices有17格式：JSON、JSON Lines、JSON-compatible YAML1.2、TOML、XML、CSV、TSV、Markdown、offline HTML、SQLite SQL、JavaScript、TypeScript、Python、Go、Rust、exact-snapshot JSON Schema、Protobuf。

Serializer只bounded JSON-representable，depth32、JSON4MiB，unsupported/oversized拒絕唔靜靜丟。TOML放JSON string，XML放Base64 UTF-8 JSON，CSV/TSV一完整JSON cell唔flatten，language-source保JSON payload。Protobuf係真wire message field1 UTF-8 JSON bytes，control旁披露schema。JSON Schema只限制exact snapshot，唔係general app schema。

全部local download requests，唔claim final filesystem，UTF-8/LF，需envelope decode格式先說明。Importer只支援既有version1plan，其他export唔暗示import。Authenticator secrets排除generic，只有獨立encrypted export。Default六位logo background先normalize opaque八位HEX再bounded decoder；此source correction晚於first production，當時無runtime acceptance。

## 持久圖片佇列

`material-buildroot-visitor-image-queue-v1` IndexedDB存明確selected original bytes同completed blobs。PNG/JPEG最多2MiB、每邊4096、四百萬pixels。Storage前signature admission，isolated worker decode前full header/animation/dimension。Output每邊16–2048、四百萬pixels，真browser PNG/JPEG/WebP encoder，fallback MIME不同拒絕唔改名。披露metadata/color-profile loss/lossy effects。

無fixed record-count cap，每頁20，browser quota真限制。Search明示current page，generation binding防舊page回覆覆新。Metadata exports排source/output bytes，範圍current selected/matching page。Original names係local records，唔外部status。

一 `navigator.locks` 跨tab producer lease，API欠則production不可用，唔無排他照做。Claim/terminal publish IndexedDB transaction比exact attempt。新exclusive lease見舊 `running` 就 `interrupted`，唔success/autoreplay。Explicit retry只failed/interrupted/cancelled轉pending，只有Start先convert。

Worker15秒，報真admitted/decoded。Cancel publication前terminate，已publish開始就說不可撤。Stop-after-current阻next claim。只有storage publication後可download，Blob request唔證final save。Page exit可留interrupted，保source/options供明確復原。

此路線只raster唔係全八類，PDF/office/audio/video/SVG/animation/archive喺此image route唔可用，唔代native/cloud/hidden desktop。用既有bounded image admission/browser primitives，冇unpinned runtime。來源晚於first docs build，需新assigned root build。

## 非秘密設定同二進位輸出

相同structured exports亦支援current presentation/narration、saved schedule、appearance overrides、wording-style。排authenticator/logo pixels，逐control講scope，appearance/schedule保version，envelope需格式decode。

Completed raster最多4MiB可按stored bytes編Base64/hex，係可逆byte encoding唔係compression/encryption。較大仍binary download，清楚size limit唔partial text。只existing image outputs bounded binary consumer，唔係任意file decoding／full inventory。

## 內置PDF同ZIP

Manifest精確 `pdf-lib`1.17.1、`fflate`0.8.2加npm integrity，MIT同PDF transitive licences入offline inventory，無CDN/runtime acquisition。Dedicated same-origin worker30秒，input/page/member/output bounds；deadline唔係hard browser heap limit，唔claim native isolation/rendered acceptance。

PDF提供inspect/extract/reorder/rotate/merge/selected-page split成ZIP/standard title-metadata。最多十inputs總20MiB、2,000pages，split最多100selected。其他writes用first PDF同exact order，merge用全部shown order。Output reopen按序比page count/geometry/rotation/content-stream hashes，唔證font/resource/visual等價。Copied pages可能失outlines/attachments/forms/signatures，execute前披露。Recognized signed/encrypted/malformed/unsupported拒絕。Remove standard metadata唔係redaction，唔移除全部page/embedded metadata。

ZIP建立最多200selected supported files，每檔8MiB/總32MiB，真compression0–9，numbered prefixes防duplicate替代。Reopen比member length/CRC。Inspect驗bounded central directory/safe names/declared sizes/layout。External extract只stored members，exact size/CRC。Deflate可inspect，extract等另bounded decoder。唔支援ZIP64/encryption/encrypted headers/directory-only/legacy非UTF-8/7z。

PDF/ZIP inputs/outputs目前page memory，同durable raster分開。Cancel terminate worker移pending output，completed explicit download唔係save proof。Inspection/result metadata可另export，唔完成universal queue/full docs/archive要求。

## 八類瀏覽器來源覆蓋

目錄而家連到每類實際browser consumer。係source routing，唔係完整category/offline/visual/runtime驗收。

| 類別 | 實際功能 | 明確限制 |
| --- | --- | --- |
| Documents/PDF | 內置PDF檢查、頁操作、structural reopen | Office/EPUB、rendered equivalence、opaque features、durable queue |
| Images | durable raster queue、PNG/JPEG/WebP | 更多source formats、metadata/color fidelity、all presets/runtime |
| Audio | local decoder graph、bounded PCM16 stereo WAV | MP3/FLAC encoding、full length、source fidelity、durable queue |
| Video | browser WebM preview、bounded canvas frames | MP4/arbitrary codecs/lossless remux/exact timing/queue |
| Archives | ZIP create/inspect/stored extract | external Deflate/encryption/ZIP64/7z/full settings |
| Structured Data/Spreadsheets | bounded CSV/TSV、exact-string result、CSV/TSV/coding exports | native workbooks/formulas/format/richer typing/queue |
| Code/Text | local UTF-8/Markdown、normalized envelopes | rich encoding/code adapters/full queue |
| Binary Encodings | recognized formats Base64/HEX worker | arbitrary opaque formats/full inventory |

## Browser原生音訊／影片預覽

Media用browser decoder graph、AudioWorklet、supported MediaRecorder，唔擷取mic/camera/screen/desktop，唔叫server/native executable。Selected media element audio經AudioContext；PCM只silence到output，video recording用media-stream destination。唯一來源係selected bytes。API：[media routing](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource)、[worklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process)、[encoder capability](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)。

Inputs32MiB，record1–60requested media seconds，故意截長內容。WAV用observed PCM/actual sample rate/two channels/16-bit，核header/data sizes/sample count。WebM用available declared MIME，frames限1280×720、要求24fps，驗EBML，但唔確立exact duration/cadence/visual equivalence。可能失metadata/chapters/subtitles/extra tracks/original channel layout，轉前披露。Progress節流，唔每frame講。Hidden page/cancel停local operation，唔提供partial output。

可選 `@ffmpeg/core` 冇加入manifest/output。Registry0.12.10標GPL-2.0-or-later但package欠license file；official `v12.15` source tag係 `71aa99d37c02a7b4c435275ca9ef50e612f6efa1`，宣告該core版本，但root licence只cover MIT wrapper。完整binary/source/licence composition未確立，所以未接納，native browser consumers唔依賴佢。

## 表格同二進位輸入

Table worker只UTF-8 CSV/TSV≤1MiB、5,000data rows、100columns、每field65,536characters。解析escaped quotes/embedded newlines，拒列數不一致/duplicate或empty headers，唔推numeric/date。Preview前20rows，export full result。CSV/TSV預設明示formula-like加apostrophe safety prefix，其他structured exports保exact strings唔加prefix。唔收vocabulary JSON/workbooks。

Binary worker接PNG/JPEG/PDF/ZIP/WAV/FLAC/MP3/MP4/WebM signatures，真Base64/HEX encode/decode。Binary input/output4MiB，encoded text12MiB容納自己完整輸出。Base64驗standard padding/re-encoding，hex完整byte pairs；unknown text/JSON/signatures拒絕。Recognition唔係safety scan/full decoder validation/execution permission。Output仍local download requests。

## 未啟用共用佇列續篇

下一來源候選將八類接一durable IndexedDB queue，保原image database。Admission存selected originals/typed options/source revision/adapter version/input digests。Browser Web Lock擁有execution，pause/cancel intents持久，中斷記錄，retry要explicit compatible revalidation。Publication比active attempt/cancel，admit/publish前quota estimate只檢查唔預留。Browser data deletion仍刪記錄。

Worker filenames content-addressed，編入consumer map，舊頁唔會固定URL偷載替代worker。Media contexts由explicit interaction準備，queue pass後release，每context共用一worklet load。Hidden page interrupt media。List bounded pages/selection/category-state filters/local search/metadata export/transition history。

呢個係inactive recovery checkpoint，唔係production/runtime verdict。當時待image retained-result preview、historical output digest download、original input recovery、encrypted history/restore同authenticator、tab/group restrictions。格式limits保留，冇tests/runtime/captures，舊receipt只綁舊candidate。

後續source correction加digest-checked historical output download同original input recovery，每input有自己download。Retained raster有真bounded image preview，唔再dispatch missing consumer。Legacy history欠digest，verified recovery route不可用。Runtime仍未驗，當時protected history同groups仍未完。

## 加密帳戶快照續篇

Account add/remove將前collection放encrypted vault payload。Unlocked history只露event metadata/snapshot是否存在。Confirmed restore寫new encrypted revision，replaced collection另留snapshot。Old event無snapshot仍可見但不可restore。Optimistic revision防另一tab寫。唔靜靜prune；50accounts/100events/500,000-byte UTF-8 payload滿即拒。Secrets唔入general queue/plaintext exports。

呢次只local snapshot restore，當時backup import/password rotation/其他enrollment/groups仍未完，冇build/test/runtime/capture證據。

下一bounded continuation加≤700KiB JSON encrypted backup accounts restore。要unlocked destination、explicit confirmation、backup password AES-GCM驗證。Full payload validation後先mutation，只restore accounts；imported history驗但刻意唔merge。保destination history/replaced snapshot encrypted，restored用destination password加密。Lock取消in-flight admission清controls。此階段rotation等仍未完，無production/runtime verdict。

之後source加local password rotation：unlocked user確認matching bounded new passwords，用fresh PBKDF2 salt/key將全部accounts/history喺同optimistic IndexedDB revision re-encrypt。Write完先換live key，lock invalidates in-flight。舊exports用舊password不變。Rotation記metadata-only encrypted event，唔露可還原舊password。其他enrollment/wider restrictions仍未完，無production/runtime verdict。

## 分頁群組同本機限制續篇

Mounted tabs加active/selected assignment、whole-group selection/rename、selected ungroup、active-group close保pinned。Group label覆stable section identities，close保draft/records。Active-tab navigation發cancellable local request，由experience-lock controller先處理再開directly locked section。只convenience restriction，唔係host auth或防same-origin code。

另一tab有效rule change取代local view並清temporary unlocks。Invalid或externally removed config保current rules、清unlock、停new enrollment到recovery。Browser-local，唔共用companion authority。Full group catalog/all restriction dimensions/remaining authenticator/formats仍未完，無production/runtime/test/capture verdict。

TOTP enrollment新增bounded `otpauth://totp/` URI，只parse唔navigate。拒duplicate/unknown parameters、issuer conflict、unsupported algorithms/out-of-range，form保admitted algorithm/digits/exact period。Period integer1–86400秒。PNG/JPEG QR只browser BarcodeDetector報QR support先讀，≤2MiB、four-million decoded pixels、exactly one result。Missing support/ambiguous/invalid明示，保URI/manual route，當時無camera/clipboard。Lock清enrollment，唔plaintext export/log，production/RFC vectors/decoder/runtime仍待。

Bounded account-list continuation加label edit、earlier/later、group assignment、matching selection/inversion、confirmed bulk remove。每success新encrypted prior snapshot，search含group labels，payload驗optional group names。List metadata只unlocked可見。Icon editing、clipboard/camera、獨立history-manager auth、history filtering/diff/retention同其他restriction dimensions仍未完，無test/production/runtime結果。
