# 搜尋及指令介面

[English](search-commands.md) · [導覽索引](README.md)

## 搜尋工作台

桌面入口匯入共用指令介面。設定、指令結果、context action 及自有 select 選項使用隔離搜尋元件，預設普通文字。旁邊 code 按鈕開完整本機表達式工作台，有構造、flags、capture/replacement 預覽、cases、時間、能力說明及階段 snippets。編表達式同步自己欄位，使用要明確。關再開設定工作台保留階段狀態。

表達式在另一 worker 執行，600 ms 期限、pattern 最多 2,000 字元、清單最多 1,000 項、每記錄 70,000 字元。無效、worker 不可用或逾時會空結果並說明，唔將失敗篩選當匹配。每記錄重設 cursor，global/sticky 唔漏狀態，未知 flags 或組合仍無效。

| 處理端 | 精確範圍 | 工作台 |
| --- | --- | --- |
| 設定及巢狀設定搜尋 | 所供設定標籤/說明，唔含匯入用詞內容 | 相鄰完整，欄位隔離 |
| 指令面板 | 已掛控制及現有目的地 | 自己 settings-search |
| 元素選單 | 適用 focus/activate/edit/discovery | 各 target 階段獨立 |
| 程式 select | 原 Material/native 選項 | 每 picker 狀態、篩選及原 value/change |
| 文件 | 收錄標題、摘要、主機授權內文及明確 fallback | 相鄰完整，連真 article worker |
| 套件目錄 | 主機原有 literal query，expression 只已載頁 | 連原頁 filter |
| 模型目錄 | 主機 cached-name literal query，expression 只已載頁 | 連原頁 filter |

套件/模型頁範圍唔假稱全未載入搜尋，亦唔將 expression 送任意主機指令。主機 query 變會失效舊頁。pattern/sample/snippet 唔上載，snippet 檔匯入匯出要明確操作。

## 指令及快捷鍵

Control+Shift+F 或 Actions 開有界可搜尋指令卡，本機偏好可切全視窗。標籤取真控制及本地化 panel context，排除 password/file input。設定結果編 field/switch 派原 input/change，select 開真選項用原處理端。導覽選 owning workspace/panel，再捲動聚焦原元素，highlight 遵減少動態。未存提示保留。

清單涵蓋目前 renderer 已實例控制，包括隱藏但已掛 panel 及既有目的地；只有導覽後先建立嘅控制要開過先可搜。係明確限制，唔係全部未來動態控制或未載文章 registry。

右鍵、Shift+F10、context key 或靜止觸控 650 ms 開元素選單，可聚焦、啟原流程或編實值，指令探索同一 Control+Shift+F。快捷標籤由共用 registry，唔虛構 save/delete/nav。disabled/inert/明確鎖目標不可操作。原切片未有 appearance/lock provider 時唔放佔位動作，後來 provider 整合見下文。

程式 Material/native select 點擊、Enter、Space、箭嘴開可搜尋 picker，使用原 value/input/change、保次序、標目前及 disabled。原生 OS file dialog 屬平台。expression builder 內 select 亦用自己 picker，揀或取消返原焦點，巢狀 picker 保父 expression 草稿。

## 原實作及延後驗收

此變更只有實作，刻意冇測試、靜態分析、審查、無障礙、操作或畫面，唔宣稱安裝/執行驗收。仍欠完整未掛控制 discovery、逐元素 appearance/認證鎖整合證據、未有搜尋列表嘅逐面清單。沿用工作台 diagnostics，唔宣稱未知 engine trace。鍵盤、觸控、三語、焦點、取消、窄版、比例、無效 expression、持續設定及原驗證全部延後。

## 建置修正歷史

原指令卡 size control 缺 template delimiter 令 bundle 唔能編譯，已補。context/picker 每 target 階段保獨立元件 query/mode/flags/snippets，開其他 target 唔覆蓋草稿，原唯讀 field 唔可 inline 寫。產出同未跑驗收分開。

## 目的地及巢狀 picker

未掛 Settings 亦可顯式去語言、主題、排程、排程歷史、外部來源登記、共用偏好及個人用詞。可讀獲准 offline index 並用原 reader 開文章。限制模式移除個人用詞及文件 discovery。巢狀 workbench select 唔取代父指令卡/草稿，appearance/認證 lock 取決 PH03-T05/PH04-T02 真整合。

## Context provider API

可信 renderer 用 `command-surfaces.ts` 嘅 `registerContextActionProvider(providerId, provider)`，回 disposer。provider 接 `{target: HTMLElement, language: string}`，回 `{id, label, context?, disabled?, run}` 本地化 action。provider/action ID 固定小寫技術值，唔係標籤，持久元素身份由明確 attribute 或既有 resolver 取，唔用臨時 palette index。最多 16 provider、各32 action。無效貢獻省略並報可用性，唔停其他 provider。

選單先關再 callback。管理動作冇 original-action target，故可管 disabled/locked 而唔執行。登記唔授主機能力、移限制或跑任意指令，editor 驗證同緊急排除仍有效。

同步 `registerCommandAccessProvider(providerId, target => boolean)` 保護原啟用、inline 寫及 picker。每 provider 都要 true，false/exception/非布林阻原動作，disposer 只移自己函數，管理動作分開。體驗 provider 亦要喺此介面外保原生事件及緊急路線。appearance/experience 各登真 editor，registry 本身唔證明 sibling 已安裝或驗收。

## 共用指令及目的地清單

`registerCommandActionProvider(providerId, ({language}) => actions)` 可喺控制未掛前登支援目的地及精確屬性/editor 回呼，回 disposer。action 有 `id`、本地化 `label`、可選 `context`/`disabled`/原 `target: HTMLElement`、真 `run`。`getCommandActionEntries(language)` 向 palette/New tab 回同 flatten 清單，ID 為 `providerId:sourceActionId`，要保 ID，唔由名稱或次序推。

最多 16 provider、各256 action、flatten512。ID 非空最多256字元、冇控制字，同 provider 重 ID/壞 action 省略，唔覆其他 provider。register/unregister 發 `command-action-providers-changed` 讓目錄更新。provider 供支援家族或目前 target 屬性，唔建無界 records×properties。

palette 先關再 callback，呼叫重新取目前 action，查 provider 存在及 disabled。原 target 亦動態查 access 並要 connected，管理/editor 冇該欄但保自己驗證，管鎖唔啟受保護 action。獨立目錄亦先關自己再呼 `run`。

workspace/appearance 各登真回呼，支援未掛目的地但唔虛構控制或執行 renderer 指令；未整合 provider 唔宣稱已登。palette 合 provider、當前控制及獲准文章，ID 去重，最多1,000可見，超出明示收窄。
