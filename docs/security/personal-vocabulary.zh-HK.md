# 本機個人用詞界線

[English](personal-vocabulary.md) · [安全索引](README.md)

共用loader冇內置映射，使用者明確匯入有效本機檔或者重載有效私人cache前，保留原裝用詞。portable協定同目前桌面分開描述，網站/伴隨upload仍獨立驗收。

## 輸入協定

JSON根只精確兩欄：數值1嘅 `schemaVersion`，同來源字串→替代字串物件 `entries`。冇額外根欄、array、巢狀replacement、隱式預設、舊版遷移或例字典。空清單有效，除bytes外唔限定最少/精確/最多項。

原輸入要有效UTF-8，含空白最多262,144bytes。普通parse前拒絕decode後重複鍵，包括escape拼法。最多八層，schema實際只用root/entries。key1–160 Unicode碼點，每層拒 `__proto__`、`prototype`、`constructor`。值0–1,000碼點，拒C0除tab/LF/CR及DEL。未知版、欄、型別、壞JSON、unsafe key、超bytes/depth整份拒絕。

`parseVocabularyBytes(bytes)` 接 `Uint8Array` 回opaque frozen handle，唔暴露內容、來源身份、數量或檔案metadata。錯誤只一般訊息/有界代碼，冇來源或parser原錯。每次load重驗cache，壞/未知回原裝文案。

## Controller API

`createVocabularyController({ privateCache, schoolMode })` 接非同步read/replace/clear cache同可選School mode函數。

- `load()`：先驗cache，缺為empty、壞/不可讀為corrupt及原文。
- `importBytes(bytes)`：呼叫時snapshot，整份驗後耐久replace先選中。invalid保舊有效，storage失敗一般錯並保舊。
- `clear()`：耐久clear先清選擇，失敗保舊並報錯。
- `status()`：只 `{state,active}`，state為empty/loaded/invalid/corrupt，冇名/路徑/時間/count/hash/preview/identity。invalid可能active true，因舊有效仍選中。
- `formatOwnedText(text,{kind,mode})`：只ui-copy/accessible-name同en/zh-HK/bilingual，其他或缺mode回原字串。
- `exportDisclosure()`：只一般說明排除本機語言資料及檔案metadata。

load/import/clear依呼叫順序序列，clear前import唔可之後復活舊值；呼叫後改caller bytes唔影響snapshot，拒絕唔毒化隊列。每cache只一controller，其他controller/tab/process唔共用，要另管擁有權。

School mode回原文及empty/inactive一般狀態但唔刪舊cache，關閉恢復。處理端要另行移除upload、route、search/palette及相關copy，disabled或隱藏仍可搜唔符合。

## 匹配及不可改內容

literal、case-sensitive、確定，按Unicode碼點，唔case-fold/normalize。每位置最長來源優先，起訖唔可貼Unicode letter/number/mark/underscore。從原來源匹配後繼續，replacement唔再掃，唔cascade/recursive，標點/emoji照字面。

只明確自有UI/accessible片段可送formatter。指令、code、ID、URL、路徑、log、使用者記錄及外部事實分開不可變，唔標ui-copy。唔爬DOM、改任意text node、解markup或猜混合字串。只text render唔HTML，組label保不變片段。approved kind係處理端明確宣告有資格。

## 隔離cache及排除

`createFileVocabularyCache({directory})` 位於 `src/main/privacy/personal-vocabulary-cache.mjs`，要caller-owned私人appdata，同設定、快照、歷史、匯出、同步、遙測及診斷隔離。唔接來源檔名或記metadata。讀有界再驗，拒symlink組件，寫同目錄exclusive0600暫存、flush、rename。clear原子寫empty tombstone，之後刪失敗唔復活。symlink係多層防護，唔保OS全race/跨程序lock，Windows ACL/power loss未驗。

`createIndexedDbVocabularyCache({indexedDB,databaseName})` 喺 `src/shared/personal-vocabulary-indexeddb.mjs`，只本機每origin/profile IndexedDB，驗讀寫，transaction commit先報完成，abort保舊。clear讀寫交易刪selection，`close()`放connection。冇sync/account/fetch/remote/fallback，companion匯入要留各client本機，唔自動轉面。

只validated bytes可入cache，cache、source metadata、handle或formatted private output唔入普通settings、undo/history、export、notification、diagnostic、crash report、來源、prompt、analytics、telemetry、畫面或publication。一般exclusion聲明唔會替另一export過濾，要整個store排除。實作冇讀或加入真私人payload/來源檔名。

## 原有驗證及剩餘工作

原 `node --test tests/personal-vocabulary.test.mjs tests/personal-vocabulary-browser.test.mjs` Linux十一測試通過，只中性生成字串。涵蓋動態count、Unicode/bytes、UTF8、decoded duplicate、schema、opaque、保舊、import/clear、caller mutation含Buffer alias、同步IDB open失敗重試、queue、corrupt、literal、kind拒絕、School恢復、cache reload/clear、link、一般錯及真ChromiumIDB commit/abort/reopen/corrupt/clear且冇network fallback。

用自有headless Chromium及本機source server，只證adapter，唔係built UI或Windows。整面copy、全export排除、手機/高scale無障礙、built畫面、獨立A/D/C及native仍開放，唔勾feature ledger。本輪翻譯冇重跑。

## 目前桌面控制

Settings真Material按鈕及native picker提供本地化import/replace/Clear，search/palette聚焦真控制。獨立private IDB同workspace/history/export分隔，只一般status，冇name/count/hash/mapping。

Clear要求即抑制替代，durable delete失敗仍抑制，該renderer禁再import/clear，要求完整reload，唔報刪成功。reload重驗，失敗刪而仍validcache可喺shared允許後再active。呢個展示規則額外於portable controller保舊。

active或不可用shared隱用詞/語言設定、搜尋/route，強制自有英文但保base/cache，之後確認inactive先重載。新status event優先過舊pending回覆。明確自有copy目前覆蓋shell靜態route及accessible、Settings heading及用詞palette；插值、provider、path、command、ID、文件body原樣。係有界，唔係全UI。原browser checks用中性輸入驗IDB、failed-clear、reload及shared，native vault/跨程式未驗。

## 拖放及臨時回饋

content window任何位置只收一個JSON副檔名本機檔，Settings同序列reader/parser/privateIDB。invalid/oversize/非JSON/多檔保舊顯一般本地化notice，唔顯名/內容或log，唔導覽離工作區。

只有本次import回loaded且active先報成功，唔因舊值仍active當成功。唯一臨時heading由匯入 `private vocabulary` 條目，缺則中性本地化fallback。經私人程序callback，唔DOM event/public/history/export。text render、polite announce、進場後約三秒hold再退及丟棄，減少動態用static hold。全視窗外層pointer-transparent、唔autofocus/modal，真MaterialWeb2.5.0 filled card可刻意focus/scroll完整最長headline但唔trap，使用支援slot、bundled type及focus ring，唔自造card chrome。

成功及invalid/unavailable同manual-popover路線，Material dialog active時feedback及初空polite region先掛supported content slot再announce。對話開/關只搬feedback到可達界線，唔dismiss/replace原對話。

shared變更同步抑制用詞/feedback，mode或clear使排隊read失效。已開始cache transaction可喺active時完成，但唔顯私人文案/成功慶祝，後inactive再驗真cache。卸載清listener/observer/timer/drop/feedback，reset/shared先同步清headline及accessible再移portal，failed-clear不變。

source-browser fixture唔係built Windows證據，native drop、真screen-reader、top-layer、高scale、source-bound畫面及目前封裝持續性待驗，唔宣稱feature或更廣copy完成。

## 原有focused drop證據

原source TypeScript及18headless Edge cases通過，包括valid/invalid、Settings、保舊、持續、shared、reduced-motion、modal三結果、最大heading scroll及failed-clear。repeated-invalid曾暴露清整live-region text移除Lit binding marker，修正只清現text node，保marker並同步抑private，回歸通過，每case查page error。

另一shared/headline11pass/3skip，指定已裝Edge令原skip IDB另跑通過；剩2skip為native ACL及無file-symlink privilege。唔合成一場新run。原headless source fixture冷載超20秒後用60秒case限，唔宣稱native input、真speech、installed、畫面matrix或nativeprivacy。本輪冇重跑以上歷史。
