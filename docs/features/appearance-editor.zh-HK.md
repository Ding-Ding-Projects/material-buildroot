# 元素外觀、動態效果及本機設定檔

[English](appearance-editor.md) · [功能索引](README.md)

Material Buildroot 經共用元素選單提供指定目標、非模態外觀編輯器，鍵盤選單同觸控長按使用同一動作。共用指令清單列出每個獲准屬性及目前目標，開啟並聚焦實際控制；執行重新解析穩定目標，缺少或身份有歧義就顯示不可用，唔修改另一元素。未揀元素時明確標示工作區介面備用目標。

本文描述來源行為。已有正式建置，但目前交付刻意未測試、靜態分析、審查、安裝執行、操作或擷取畫面。下文唔係畫面驗收，歷史收據只綁定原提交，唔重新標作新來源證明。

## 編輯及持續儲存

使用已登記 Material 控制、英文/粵語/雙語、獨立搜尋/正則、屬性或狀態重設、元素或全域重設、具名預設、本機樣式複製貼上、復原重做及已驗證 JSON 轉移。可拖曳及調整大小，Alt+箭嘴移動，Alt+Shift+箭嘴改大小，Escape 關閉並還焦點。幾何及屬性檢視器摺疊偏好本機保留，摺疊仍顯示覆寫數。窄畫面有界面板可能遮住目標，唔宣稱全部支援版面零重疊。

`src/shared/appearance.ts` 定義允許屬性、範圍及序列化。匯入聲明、selector、script 或網絡參照唔執行，唔可設定隱藏、抑制 pointer、任意定位或者移除焦點。不透明度、旋轉、縮放及位移有界，保留可操作性。適用主機屬性同時提供 Material 字型/顏色角色，讓公開元件結構接收值。

shadow-host 祖先優先用明確記錄鍵及 ID。計劃、快照、修訂、原生歷史及活動用真實穩定 ID，唔用名稱。其他靜態元素用路由結構身份。適配器辨認到冇鍵重複記錄只保留本次工作階段並說明；未保證未來 markup 改變仍穩定，其他動態介面普遍耐久身份仍未完成。

normal、hover、focus、pressed、selected、disabled、dragged、validation、loading、success、warning、error 各有獨立範圍覆寫。語義 selector 只讀既有 state/ARIA，唔虛構成功、移除驗證或授權。封閉 primitive 內部同偽元素只用支援公開角色，唔任意內部 selector。

外觀文件最多 1,000 目標、30 預設、300,000 序列化字元，未知屬性整份拒絕套用。合法但不支援 JSON 可明確保留喺獨立本機儲存，最多 650,000 字元並原樣匯出，唔套用、唔作可執行設定索引、唔送主機歷史或排程。無效 JSON 唔可保留。

## 字型及顏色

字型包括已安裝/綑綁/瀏覽器 family 選擇與預覽、大小、粗幼、斜體/oblique、裝飾線/樣式/色、雙線、大小寫、小型大寫、對齊、方向、正負字元及字距、行高、基線、上下標、描邊及陰影。`wght`、`wdth`、`slnt`、`opsz` 標準軸有真 CSS 處理，不支援軸仍保留但唔宣稱改變字面。

主機只跑一條固定隱藏唯讀字型列舉，唔收顯示層執行檔、參數或路徑，安全 family 名稱有時間、輸出及數量限制，只回名稱，字型位元組唔跨橋。未探索每字型 variable-axis 資料/範圍，只提供有界標準軸並說明。

色相使用 Material 連續光譜，飽和度、亮度、alpha 有連續滑桿及精確數值。轉換器接受瀏覽器支援命名、HEX/HEX8、RGB/RGBA、HSL/HSLA、HWB、CIELAB/LCH、OKLab/OKLCH，另有 HSV/HSB 及 CMYK。讀值有支援表達及已收錄名稱，複製一次只取一表示。工作色域為 sRGB，廣色域會被限制且唔保留 profile，畫面明示。對比值只係不透明對比，alpha 或動畫背景要檢視最終介面。

彩虹係獨立背景 sentinel，唔係 swatch 顏色。CSS 經六個色相，速度 1–10 對應 `max(2, 24 - 2 * level)` 秒，可用時同步文件時間軸，唔逐 frame 腳本重畫。作業系統或程式減少動態會取消循環並保留穩定顏色。

primary、on-primary、surface、on-surface、outline 共用色彩工具。角色顏色動態喺 renderer 支援時要求 typed color registration，唔接受任意未登記 custom property。

## 動畫及轉場

動態工作區有獨立具名 track、啟用/靜音、solo、複製、移除、排序、群組播放、數值序列偏移、每 track 2–32 有序 keyframe、本機複製貼上/反轉、每段 easing 及數值 marker。控制有 duration、自動 duration、正負 delay、end delay、repeat hold、有限/無限重複、iteration start、direction、fill、playback rate、composition、具名 easing 同可編 cubic-Bezier 點。

播放有開始、暫停、繼續、反向、停止/還原、文件時間軸 scrubbing、數值 seek、縮放及 1/60 秒步進。自動時間由 renderer 計算，唔虛構總長，repeat hold 包含喺有限長度。scroll/view 時間軸要 renderer API 支援，使用最近真實捲動容器或確切目標及明確軸。進度由來源驅動，毫秒 seek 不適用就顯示不可用，唔硬塞時間值。

manual、entry、hover、focus、press 及 state-attribute trigger 只觸發外觀，唔執行受保護動作。離開 hover/focus 或放開 press 取消預覽。重疊 track 明確用 replace/add/accumulate 及編寫次序；renderer 能力失敗如實報告並保留已編值。

三次曲線路徑用六個 ±24 px 相對座標並保持直立。spring 有質量、剛度、阻尼及速度，產生精確 32 個確定樣本，限制於允許屬性範圍，最後點貼齊目標。係明示有界取樣模型，唔係原生物理引擎。repeat hold 加靜止終點段。

每目標最多 16 track、32 編寫 keyframe、60,000 ms duration 及有界 delay、最多 100 次有限重複或明確 infinite、rate −4 至 4。無限可停止且遵守減少動態。完整動態持續文件最多 300,000 字元。轉場屬性、時間、delay 同 easing 有獨立 CSS 處理，只涵蓋允許 registry，唔係任意 CSS。

## 本機標誌

標誌編輯器提供原裝透明/淺/深展示、自訂 PNG/JPEG、fit/fill、數值焦點、裁切縮放、alpha 背景及真 32/64/128 px 預覽。隔離 worker 轉換，decode 前查 signature/尺寸，拒絕 animated PNG，輸入最多 2 MiB、尺寸 4,096、解碼四百萬 pixel，五秒終止。輸出 PNG 要 signature、尺寸及 decoder round-trip 檢查，快取 header 要符合獲准尺寸。

只產生介面所需衍生圖片，轉換壓平 profile 並丟 metadata，畫面說明。無效保留舊選擇，重設移除衍生選擇，原始位元組只留記憶體。自訂 pixel 唔進外觀匯出或主機歷史。展示改動唔改執行檔、安裝包、更新 feed、application ID 或資料目錄；唔提供作業系統圖示容器取代。

## 本機歷史及排程設定檔

`appearance-history.cjs` 喺獨立主機 namespace 重用只增不改歷史，顯示層唔選路徑。追加依序執行，底層 ref 更新仍 compare-and-swap，寫前讀後都驗安全投影。快照排除圖片/字型位元組、自訂預設/track 名、個人用詞、路徑及憑證。family 名要符合獲准安裝目錄，仍需本機 Git。

編輯器讀分頁資料，經真處理端還原成新修訂，保留目前具名預設及 track 名，因歷史刻意冇呢啲名字。樣式即時套用，歷史依序稍後保存；追加失敗明確報告，唔宣稱已保留。跨儲存套用及歷史追加唔係單一原子交易。

新增排程欄位 `appearance.profile` 為 null 或穩定本機 profile ID，原月曆、語言/主題優先次序不變。profile 保存靜態樣式、動態及標誌，排程/供應商 payload 只帶 ID。renderer 訂閱實際求值快照，驗證臨時 overlay 並喺規則完結還原手動基底。缺少、無效或鎖定 profile 如實報告，手動修改喺覆蓋底下照儲存。profile 喺外觀編輯器儲存、排程編輯器選擇，最多 20 個及 2.5 百萬字元。

## 權限及驗收

屬性列同公開 Material 控制共用 `appearance:<target>:<state>:<property>` 體驗身份。修改、復原重做、匯入及重設經登記權限 provider，motion 用目標 motion 身份。拒絕保留原值，接線唔證明持久鎖實際工作。

| 能力 | 實作處理及儲存 | 執行結論 |
| --- | --- | --- |
| 屬性及語義狀態 | allowlist、state selector、本機文件 | 未執行 |
| family 及標準軸 | 主機名稱、CSS 軸、本機值及安全歷史 | 未執行 |
| 色彩/彩虹 | sRGB 轉換、同步 CSS、值及共用速度 | 未執行 |
| track/keyframe/timing | 有界 Web Animations、本機/歷史/profile | 未執行 |
| 路徑/spring | 數值 cubic 及 32 點取樣、型別參數 | 未執行 |
| scroll/view | 能力偵測時間軸、軸值 | 未執行 |
| 指令跳轉 | 共用 provider 及穩定目標即時解析，冇獨立指令狀態 | 未執行 |
| 排程 profile | 求值 overlay、排程 ID 及本機內容 | 未執行 |
| 歷史還原 | 獨立已驗只增不改 adapter、不可變安全修訂 | 未執行 |
| 未支援匯入 | 明確本機保留及原樣匯出、獨立有界儲存 | 未執行 |
| 標誌 | 隔離 decode、獲准衍生快取 | 未執行 |

完整分層圖片編輯仍係獨立路線圖。任意 CSS、自訂屬性、字型專用軸探索、未加識別動態元素普遍身份、零重疊及完整畫面驗收仍未實作或未證明。編譯成功唔可代替鍵盤、本地化、對比、比例、decoder、時間及逐互動畫面證據。

## 穩定分頁及群組身份

分頁目標可宣告 `data-appearance-owner="workspace-tabs"`，明確有界鍵為 `tab:workspace:<backend-id>`、`tab:utility:<owner-and-destination>` 或 `group:<stable-id>`。只喺目前程式已登記 `workspace-tabs` 實例使用，固定 presentation namespace 加鍵計摘要，同路由、群組位置及祖先排序獨立。子元素由最近明確目標加各自結構 suffix，唔共用父身份。

標記只代表外觀身份，唔授權動作、改憑證、繞過 provider 或把 DOM 當權限。原檢查照用，重複即時身份仍屬有歧義，唔偷偷揀另一個。身份 attribute 改變會排程重綁，其他身份沿用原行為。舊結構記錄保留，唔自動轉 namespace，因舊位置唔證明原擁有人。此新增只有候選來源綁定建置，重排、路由、持續儲存及權限仍需獨立實際驗收。
