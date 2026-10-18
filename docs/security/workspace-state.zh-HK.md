# 持久工作區狀態

[English](workspace-state.md) · [安全文件](README.md)

主機工作區服務保存項目規劃資料、外觀、入門完成、快照同近期活動。唔執行建置、唔將筆記當指令、唔接受渲染器檔案系統路徑、唔存憑證，亦唔證明 WSL/Docker 可用。執行同 Windows 安裝器驗收係獨立工作。

`createWorkspaceService({filePath})` 接受可信主程序喺程式使用者資料內選定嘅絕對儲存檔名，絕不可轉交渲染器提供檔名。`get()` 回 `{ok:true,state}`；`mutate(request)` 持久化後回相同形狀。`exportDocument()` 另外回 `document` JSON 字串供主機儲存對話框使用。錯誤只暴露有限代碼，唔含檔案系統詳情。

## 修改規格同界限

每次修改要整數 `expectedRevision` 匹配目前持久修訂，初始為零。

| 操作 | 額外欄位 |
| --- | --- |
| `plan.create` | `plan: {name,runtime,target,status,notes}` |
| `plan.update` | `id`、五個可編輯欄位嘅非空 `changes` 子集 |
| `plan.delete` | `id` |
| `preferences.update` | `preferences: {theme}` |
| `onboarding.complete` | 無 |
| `onboarding.update` | `onboarding: {step,runtime,name,dismissed,planId?}` |
| `onboarding.createPlan` | `plan: {name,runtime,target,status,notes}` |
| `snapshot.create` | `name` |
| `snapshot.restore` | `id` |
| `document.import` | 序列化匯出文件 `document` |

主機生成 UUID 同時間。runtime 為 `wsl`／`docker`，target 為 `image`／`sdk`／`toolchain`，status 為 `draft`／`ready-for-review`；theme 為 `system`／`light`／`dark`，預設 `system`。最多 100 計劃、名稱 80 字元、筆記 4,000 字元、20 快照，活動檢視只顯示最新 100 次成功修改。序列化資料限 1 MiB。schema version 1 要精確，拒絕未知欄位、繼承物件 schema、accessor、prototype key、重複序列化 key、過深巢狀、未支援版本同無效 enum，冇型別強轉。

## 寫入、損壞同復原

版本 JSON 適合有限小型資料交易，用 Node 內置功能，唔載入實驗 SQLite 設定 broker 亦可獨立測試。每次修改取得主機獨佔鎖、重讀並驗證磁碟、核對修訂、驗證完整結果、寫唯一 mode-0600 暫存檔、flush，再原子 rename 取代舊檔，完成後先回成功。普通失敗會移除自己暫存檔同鎖。呢個保證完整檔案取代，唔係跨檔交易或普遍斷電耐久保證。程式應保留正常單一實例生命週期。

程序中斷可能留 `.lock`。服務回 `STORAGE_BUSY`，唔會按經過時間猜擁有權或自動移除。可信主機要先確定所屬程序已結束，先可只移除其工作區鎖，冇自動覆寫／重設。

損壞、過大、外來格式同未支援版本檔案保持不變，符號連結儲存檔會拒絕。讀取報 `STORAGE_UNAVAILABLE`，之後修改亦拒絕。父目錄係主機擁有程式儲存，唔係攻擊者選嘅項目目錄。另一個可存取可信父目錄嘅程序取代目錄，超出此服務權限界線。

快照只含規劃 payload。Restore 複製 payload 到目前工作區並記新修訂／活動，唔倒退修訂或歷史。Import 喺預期修訂取代計劃、外觀同入門，保留主機歷史同快照。Export 只含版本化規劃 payload，冇活動、快照、儲存路徑、能力 handle 或憑證；唔係 Buildroot 來源／配置備份，亦唔授予執行權限。

集中 Node 測試涵蓋重啟保留、並行實例過期修訂、忙鎖、取代失敗、損壞／外來保留、符號連結、唔安全要求、欄位／數量界限、快照同驗證匯入匯出。開發主機結果唔確立 Windows 檔案系統、Electron sender 授權或原生對話框整合。主程序 IPC 必須獨立授權可信渲染器，呼叫前拒絕導覽或不可信 frame。

## 原生檔案能力

`createFileGrants({now})` 係只供主機登記庫。使用者喺原生選擇器選正式現存檔案／目錄後，回呼可用 `grant({path,kind,access,owner})`。唔可以經渲染器 IPC 暴露 `grant` 或原始 path。結果係限定 owner 嘅不透明 UUID，五分鐘有效，程式重啟後失效，最多 1,024 grants。`resolve({id,owner,relative?,write?})` 驗證 owner、時間、權限同全部原祖先身分後，回主機限定正式 path、kind、access。`revoke({id,owner})` 同 `clear()` 撤銷授權。

解析拒絕越界、絕對 relative 路徑、其他分隔符、Windows stream／保留／含糊名稱、符號連結、非正式別名同多重硬連結檔案。會重查祖先 device/inode/creation 身分同 real path，偵測父目錄取代同改變正式路徑嘅 junction 導向。讀取要目標存在；寫入只可喺已檢查現存父目錄下建立最後一層新檔。真實操作要使用前即時 resolve、保留主機限定路徑，再加操作專用保護。同步路徑解析本身唔提供原子開檔 descriptor，亦唔消除檢查同使用間惡意取代。Windows reparse 同原生選擇器要另驗證。

## 作業系統保護秘密

`createVault({safeStorage,directory})` 包住可信 Electron `safeStorage`。`availability()` 明確報不可用，絕不以明文代替加密。Linux 要可識別安全 backend，拒絕 `basic_text`／`unknown`。可信主機 `write(owner,secret)` 只收到 `vault:<UUID>`；`read(reference,owner)`／`remove(reference,owner)` 要同一 owner。唔暴露秘密讀取或無限制寫入畀渲染器 IPC；既有秘密消費服務用 owner-bound 主機適配器。

每檔只含作業系統加密位元組，owner 同 schema 喺保護 envelope 裏面。寫入建立獨佔 mode-0600 檔，flush 後先回參照。參照唔提供路徑，記錄大小、秘密大小同 owner 都有限。符號連結／多重連結記錄拒絕，目錄必須正式主機所屬。固定資料測試用認證加密檢查包裝同持久界線，唔證明真實 OS 憑證 backend 或原生 Electron 行為。

## 保留活動日誌

工作區最後 100 筆係有限展示。全部新活動保留喺相鄰主機所屬 `.activity` 目錄，每修訂一個版本驗證記錄，冇自動刪除。`activityPage({beforeRevision?,limit?})` 回 `{ok:true,events,nextBeforeRevision}`，按修訂倒序，limit 1–100，預設 50。分頁只讀有限 payload，記憶體最多一頁候選目錄。

修改先 flush 下一修訂日誌再取代狀態，工作區修訂係提交界線。失敗／中斷取代可留下一修訂記錄；分頁排除超出已提交修訂者，之後成功嘗試只取代該未提交修訂。已提交記錄同有限狀態檢視核對，唔以矛盾內容覆寫。遇到既有有限活動會回填，但舊版本丟棄記錄唔可重建。日誌同狀態係程式擁有資料，唔係抗惡意竄改審計記錄。

## 可恢復入門設定

`onboarding` 為 `{step:0|1|2,runtime:"wsl"|"docker",name:string,dismissed:boolean,planId?:UUID}`，預設 `{step:0,runtime:"wsl",name:"",dismissed:false}`。name 最多 80 字元，可空白初稿。`onboarding.update` 喺預期修訂取代此完整進度。dismissed 同 `onboardingCompleted` 獨立，略過唔代表完成，完成亦保留進度。快照同匯出含進度。

`onboarding.createPlan` 係設定精靈計劃步驟：同一交易、同一修訂、一筆活動建立計劃，同時按該計劃設 `{step:2,runtime,name,dismissed:false,planId}`。如果進度指向仍存在計劃就重用，唔建立新計劃，所以中斷／遺失回覆重試唔會重複。記錄計劃已刪就建立並記新計劃。寫入失敗保留舊檔，計劃同進度都唔套用。設定以外 `plan.create` 不變。

精確舊 version-one 工作區、快照或匯出欠新進度欄位時，喺記憶體加預設，保留計劃、修訂、完成、偏好、快照同歷史。讀取唔改寫檔案，下次成功修改先持久化新形狀。未知欄位同錯誤進度拒絕並保留原檔，唔可重建舊版本從未儲存嘅進度。

## 持久採用項目身分

`createProjectStore({filePath})` 喺獨立 version-one `material-buildroot-projects` 文件保存精確 `{id,name,root,source,output}`。`list()` 回獨立記錄；載入唔發 grants、唔信任來源或授權執行。重啟後操作層要將描述符標示待授權，重新取得原生選擇器授權後先重連工作或讀項目檔。

可信主機只喺選擇器授權同檔案重查後呼叫 `adopt({name,root,source,output})`。三個正式路徑相同回原 UUID，否則新 UUID。重新採用保留原身分同顯示名，名稱唔定義身分。path 係有限、正規化主機平台絕對字串，儲存字串只係資料唔係權限。Windows drive letter 正規化大小寫，其餘正式拼寫精確比較，避免合併真正大小寫敏感目錄。呼叫者提供真正正式 path，唔係渲染器路徑、短名別名或 junction 拼寫。初版 Windows 唔接納 UNC／device paths。

最多 1,000 描述符同 8 MiB 序列化資料，冇自動刪除。name 80 字元、path UTF-8 4,096 位元組；拒絕錯誤 UTF-8、未知欄位、accessor、prototype-shaped 物件、重複 key、重複身分／路徑三元組同未支援格式。欠檔從空開始；損壞、外來同符號連結儲存保留並報不可用。

Adopt 取得獨佔鎖、重讀磁碟、建立 mode-0600 暫存、flush 同原子取代。新採用推進私有儲存修訂，重新採用唔重寫。忙鎖明確，唔按猜測逾時清除。測試涵蓋重啟穩定身分、純資料載入、回傳獨立記錄、危險輸入、保留錯誤位元組、取代失敗、符號連結同 1,000 邊界。Windows 檔案系統同授權復原需原生證據。

## 持久畫布位置

`createCanvasLayoutStore({directory})` 只存非秘密節點位置同 viewport，唔授項目／主機操作權、唔執行圖節點，唔將 id 當路徑。操作服務先獨立要求已授權項目。

同步 API：`get({workspaceId,canvasId})` 同 `save({workspaceId,canvasId,expectedRevision,layout})`，回獨立 JSON `{revision,layout}`。欠檔回修訂零同 `{nodes:[],viewport:{x:0,y:0,scale:1}}`，唔建立檔。成功只將該工作區／畫布修訂加一。workspaceId 係正式小寫 UUID；canvasId 只可 `package-dependencies` 或 `guest-topology`。

layout 精確 `{nodes:[{id,x,y}],viewport:{x,y,scale}}`，最多 128 唯一節點。id 非空有效 UTF-8，最多 128 字元同 256 位元組，拒絕控制字元／prototype 保留名。含 `/` 套件 id 仍係普通資料。座標有限數值 -10,000 至 10,000，scale 0.25 至 2，含邊界。拒絕未知欄位、繼承 schema、accessor、稀疏陣列、重複節點同錯誤序列化，冇強轉。

每個文件版本化並綁確切工作區／畫布，最多 128 KiB。使用／建立前檢查祖先正式身分。符號連結目錄／檔、多重連結、外來格式、未知版本、錯誤身分、損壞／無效 UTF-8 都拒絕，舊檔不變。

Save 取得逐文件獨佔鎖、重讀預期修訂、flush 唯一 mode-0600 暫存，再原子取代；取代前重查目錄身分同目前狀態。過期修訂保留完整舊 layout。普通失敗刪自己暫存／鎖，別人鎖不動。中斷鎖要可信復原，唔自動到期。呢個係程式資料儲存，唔抵抗特權程序搶換目錄，亦唔保證所有斷電情況。

清理錯誤嘅 `code` 只用 `INVALID_REQUEST`、`REVISION_CONFLICT`、`STORAGE_BUSY`、`STORAGE_UNAVAILABLE`，訊息冇路徑。集中測試涵蓋重啟、工作區／畫布隔離、過期修訂、取代失敗、損壞／外來保留、幾何界限、128 節點、嚴格危險輸入拒絕、symlink/hardlink 同忙鎖。Windows 同即時編輯器驗收分開。

## 持久項目選項

`createProjectOptionsStore({directory})` 將環境偏好同外部樹描述符同身分／授權分開。同步 `get({workspaceId})` 回 `{revision,runtime,externalTrees}`，欠資料回 `{revision:0,runtime:null,externalTrees:[]}` 且唔建檔。`save({workspaceId,expectedRevision,runtime,externalTrees})` 取代完整 payload 並回新修訂。每個正式小寫 UUID 工作區各有文件／修訂。

runtime 只可 `null`、`{kind:"wsl",distribution}` 或 `{kind:"docker",image,uid,gid}`。WSL 名符合 `[A-Za-z0-9][A-Za-z0-9_.-]{0,79}`。Docker image 最多 512 字元，要不可變小寫 `@sha256:` 加 64 十六進位字元，符合操作接納式。UID/GID 為 1 至 65,535 整數。拒絕原生執行、可變 image tag、環境覆寫同額外欄位。

最多 32 外部樹，每個精確 `{path,name}`。path 正規化主機平台絕對字串，最多 4,096 UTF-8 位元組；name 符合 `[A-Za-z][A-Za-z0-9_]{0,63}`。拒絕重複 path/name、錯誤 UTF-8、控制字元、越界拼寫、accessor、繼承 schema、稀疏陣列同未知欄位。Windows drive letter 大寫，其餘正式拼寫保留，唔混淆大小寫敏感目錄。初版排除 UNC/device、alternate data streams 同含糊／保留路徑部分。

外部 path 係原生選擇後資料，讀取唔自動解析或啟用，所以未掛載／不可用樹仍可保留偏好。載入唔建立環境實例、掛目錄、授檔案權、信任來源或授權建置。啟用前主機要新項目／外部樹 grants、重查實際路徑，同獨立接納環境。持久偏好唔會自行恢復權限。

文件用精確 version-one `material-buildroot-project-options`，限 256 KiB。驗證正式祖先、拒絕符號／多重連結、核對已開檔身分，保留損壞、外來、錯配或錯誤 UTF-8。寫入用逐工作區獨佔鎖、重讀修訂、flush mode-0600 暫存、重查目錄同內容，再原子取代。過期修訂／普通寫入失敗保留完整舊 payload。外來鎖不動，中斷鎖由可信主機復原。

錯誤用上述四個已清理代碼。集中 Linux 固定資料測試涵蓋重啟、獨立預設、WSL/Docker/null、嚴格環境／外部樹接納、32 樹、過期修訂、取代失敗、損壞保留同連結／鎖保護。Windows 執行環境同檔案系統驗收仍未證明。
