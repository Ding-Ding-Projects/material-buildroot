# 配置服務

[English](configuration.md) · [桌面文件](README.md)

主程序服務讀輸出 `.config`，有型別編輯時保留未識別行。寫入前驗證符號名同 bool、tristate、string、integer、hexadecimal 值。注入 workspace resolver 必須回明確授權正式來源同獨立輸出根目錄；executor 要真正執行已接納 `olddefconfig` 並回成功，冇模擬 make 後備。

`createConfigurationService({resolveWorkspace, executor})` 提供 `inspect`、`apply`、`listDefconfigs`、`applyDefconfig`、`undo`。要求帶 `workspaceId`，修改另帶檢查回傳 SHA-256 `revision`。每輸出根有程序內串行佇列。同目錄暫存再 rename，協調失敗還原舊配置，保留 20 份前配置供順序復原。成功回有效值同要求差異。Defconfig 只發現已授權來源 `configs` 正常檔，拒絕目錄／檔案符號連結越界。

離線 Kconfig adapter 內置 ISC 授權 Kconfiglib 14.1.0。`scripts/configuration/vendor/provenance.json` 記官方 PyPI metadata URL、archive URL、已驗證 archive SHA-256 同內置檔雜湊，執行時唔下載。`createKconfigAdapter({pythonExecutable, admitted:true})` 要絕對、主機已接納 Python，作可選 `semanticAdapter` constructor 參數。回真實 menu tree、型別／值、choices／selection、ranges、defaults、dependencies、visibility、assignable states 同 help。adapter 可用時，有型別修改拒絕未定義符號或錯配型別。

主機 resolver 可附 `kconfig: {entrypoint, prefix, environment, externalRoots}`。Buildroot 通常 `Config.in` 同空 prefix；Linux 類用 `Kconfig`／`CONFIG_`。全部設定只由可信主機提供。helper 用受控環境，拒絕授權 source/output/external trees 外讀取、阻止 subprocess evaluation 同 Python plugin 執行，限制深度／節點／JSON 並設逾時。需 command expansion 嘅配置會如實失敗，直到有獨立接納路線。

Kernel、BusyBox、U-Boot 用主機明確偵測根對 `domains.linux`、`domains.busybox`、`domains.uboot`，各自要 `granted:true`，唔猜 package output 路徑。可供白名單 `reconcileTarget`：`olddefconfig`、`linux-olddefconfig`、`busybox-oldconfig`、`uboot-olddefconfig`。executor 負責對正確來源真正執行，缺 domain grant 拒絕。語意讀回唔證明特定 Buildroot 版本生成環境相容；真實 make 驗收獨立。

此服務基線仍未完成來源 defconfig 最小保存、按序外部 defconfig 偵測同跨程序持久鎖。程序內串行唔防外部工具同時改輸出。

套件模型驗證 build system、source、hashes、license、有序 patches 同含權限 modes 嘅 overlay mappings。`savePackageModel` 喺明確授權根原子儲存修訂檢查 JSON，呢個儲存 API 同下方外部樹配方編寫分開。

`node --test tests/configuration*.test.cjs` 用真正本機 Python 檢查 Kconfig 型別、menu、choice、range、dependency/help、載入值、有型別驗證、隔離 Node helper 協調成功／失敗、rollback、undo、修訂競爭同符號連結拒絕。只證服務規格，唔係 Buildroot make 或 Windows/WSL/Docker 執行驗收。

## 外部套件編寫

`package-authoring.cjs` 嘅 `createPackageAuthoringService({resolveExternalTree, withLock})` 提供 `preview`／`apply`。resolver 只收工作區同外部樹 id，回明確授權根。主機鎖覆蓋整個非同步操作，須排除該樹配置、建置同來源修改。渲染器唔可提供根路徑或 shell。

已準備外部樹要有正常 UTF-8 `external.desc`、`Config.in`、`external.mk`，descriptor 提供已驗證名稱。Preview 生成 `package/<name>/Config.in`、`<name>.mk`、`<name>.hash`，顯示佢哋同整合行精確前後文字。保留根內容，識別標準 wildcard make inclusion 避免重複配方。既有生成路徑只可用確切檢視 revision／preview hash 覆寫，其他檔不變。

typed model 要 name、version、HTTP(S) archive URL、source filename、homepage、license expression／filenames、build system／dependencies、明確 Kconfig dependency symbols、help、SHA-256/SHA-512。每 archive 同授權檔要 hash entry。雜湊係供檢視宣告，操作唔下載上游或證明正確。字面值拒絕 Make/Kconfig injection 同路徑越界。Python package 要支援嘅明確 setup type。Generic recipe 只含 metadata，警告自訂 build/install commands 要另行檢視流程。此 API 未實作 patch 內容、overlay 複製、hooks、推斷依賴或自訂指令。

Apply 鎖內重查所有 before-images 同 preview，同目錄暫存保留 permissions 再 rename。記憶體保留受影響文字／modes，寫失敗會復原已寫檔、刪自己新檔同新空目錄。復原失敗報 `PACKAGE_ROLLBACK_FAILED`，唔假報成功。程序 crash 唔受記憶體 rollback 保護。符號連結、過大或非 UTF-8 既有內容修改前拒絕。

格式按官方 [package directory](https://github.com/buildroot/buildroot/blob/2025.02.1/docs/manual/adding-packages-directory.adoc)、[generic infrastructure](https://github.com/buildroot/buildroot/blob/2025.02.1/docs/manual/adding-packages-generic.adoc)、[external tree](https://github.com/buildroot/buildroot/blob/2025.02.1/docs/manual/customize-outside-br.adoc)。集中測試真正暫存樹 preview/apply、負面注入／連結、過期預覽同注入部分寫入 rollback，唔證套件執行建置。

## 初始化外部樹

`previewInitialize`／`applyInitialize` 接受 `{workspaceId, externalTreeId, descriptor: {name, description}}`，apply 再要 `revision`／`previewHash`。同 resolver／非同步鎖保護嘅目錄必須已存在且完全空白。已準備、部分或衝突樹回 `EXTERNAL_DIRECTORY_NOT_EMPTY` 並不變。

name 1–64 ASCII 字母／數字／底線，字母開頭；description 1–80 ASCII 字母／數字／空格／`. , _ ( ) + -`，字母或數字開頭。拒額外欄位、多行或可執行插值。Preview 顯示三根檔精確內容，`external.mk` 用官方排序 package wildcard。revision 綁正式目錄、檔案系統身分同空狀態；hash 綁全部生成內容，改 descriptor 要新 review。

Apply 用獨佔同目錄暫存同原子 no-overwrite hard-link 發佈，唔取代預覽後出現檔。部分失敗只喺目前內容仍匹配時移除本交易發佈檔，保留無關並行檔。交易檔已改或復原失敗報 `PACKAGE_ROLLBACK_FAILED` 並保留衝突。記憶體交易唔聲稱 crash recovery。初始化後可用既有配方 API。Linux fixtures 驗證實際初始化、修訂／身分變化、衝突、注入同部分寫入保留；原生 Windows／真實 Buildroot 未驗。

## 已啟用外部 Kconfig 輸入

Buildroot 檢查由主機提供 `kconfig: {buildroot: true, externalRoots: [canonicalRoot, ...], environment: {HOSTARCH, HOST_GCC_VERSION, BR2_VERSION_FULL}}`，保留 root 次序。每樹要正常非 symlink `external.desc`／`Config.in`，descriptor name 唯一。名稱／描述讀實際授權 descriptor，唔收渲染器 environment。adapter 推導 `BR2_EXTERNAL_<NAME>_PATH`／`_DESC`，按序回 `semantics.externalTrees`。

bridge 推導 source/output/configuration 環境路徑，將 `.br2-external.in.paths`、menus 同支援 provider inputs 作唯讀記憶體檔。包括實際外部 `Config.in`、nested package definitions、既有 `provides/{toolchains,jpeg,openssl,skeleton,init}.in`／`linux/Config.ext.in`，按選定次序。跟來源生成結構但唔改 output 或跑 shell script。nested include symlink 越界仍阻擋，唔確立外部版本偵測或全部 Buildroot 版本等價。

曾唯讀檢查真實 [Buildroot 2025.02.1 archive](https://buildroot.org/downloads/buildroot-2025.02.1.tar.xz)，觀察 SHA-256 `a3216907e7ce1bbd38413e20b0861641b160ecc40dd7b598febb7f12984b3206`。無外部樹解析 11,467 menu nodes，保留八個 library warnings；真實來源 fixture 亦載入授權外部 package。只證該版本 inspection，唔係 `make olddefconfig`、build、Windows 或全支援版本認證。可用 `MATERIAL_BUILDROOT_KCONFIG_SOURCE=/path/to/buildroot-2025.02.1 node --test tests/configuration-external-kconfig.test.cjs` 重現；普通 fixtures 獨立驗證次序、載入有效值、providers、重複 descriptor、symlink 拒絕同 output 不變。

## 偵測同匯入既有套件

`createPackageDiscoveryService({resolveRoots, withLock})` 讀已授權來源同啟用外部樹。`resolveRoots(workspaceId)` 回 `{granted:true, sourceRoot, externalTrees:[{id,root}]}`；`withLock(canonicalRootsArray, asyncWork)` 保護全讀取。要求只含 id 同搜尋控制，唔含路徑；模組唔執行 source、shell、Make 或 Kconfig。

`discover({workspaceId, query?, offset?, limit?})` 掃實際目錄，回確定性 package identities、recipe hashes，同靜態 Kconfig declarations（types、prompts、source-relative locations）。`Config.in.host` 同冇 Kconfig declaration 配方亦可發現。純文字不分大小寫 substring 搜實際名稱／路徑／declarations；靜態目錄同已評估 menus、visibility、effective dependencies 分開。

頁預設 50、最多 100，512 KiB 頁內容預算可能縮頁，`nextOffset` 按實際回傳數前進。回 total matches、revision、scan limits 同 symlink-skip 警告。每掃最多 50,000 directory entries、64 MiB recipe/config bytes、八層、15 秒；每檔讀取最多 1 MiB。declaration summary/help 另有數量／大小界限同 truncation 指示。

`importPackage({workspaceId, packageId, revision})` 核對目錄 revision，再讀有限 snapshot，回可用精確 Base64 位元組、SHA-256、sizes、字面 help 同可安全理解嘅 typed draft。只解讀支援字面 metadata／infrastructure，唔評估 commands、額外 variables 或其他 syntax。欠 typed draft 唔移除或重寫 source。

只有全部 recipe/config/hash 文字精確等於由 draft 生成，且冇其他 package files，先可 typed round trip。comments、自訂 commands、額外 files、不支援語法或欠位元組會阻止取代。外部編寫服務獨立強制保留，回 `PACKAGE_MANUAL_EDIT_REQUIRED` 而唔覆寫；仍可回有用 draft 供檢視。

Import 最多 256 檔同 32 MiB inspected data；單檔 payload 64 KiB、總 captured bytes 256 KiB，較大只回 size/hash 同不可用原因。hash 每檔最多 8 MiB，超過明確無 hash；唔跟 symlink，偵測／匯入唔改檔。

Fixtures 驗證 source/external 搜尋、分頁、host-only package、symbol locations/help、精確支援匯入、comment/custom 保留、stale revision、symlink 同 payload limits。可選真實 2025.02.1 測試發現逾 3,000 recipe identities、BusyBox declarations，保留不支援上游 zlib recipe。指令：`MATERIAL_BUILDROOT_KCONFIG_SOURCE=/path/to/buildroot-2025.02.1 node --test tests/configuration-package-discovery.test.cjs`。只係來源 inspection，唔係 package build／原生 Windows。

## 外部修改同保留保護

Resolver roots 必須已正式化，拒絕現時經替代 symlink 解析嘅路徑。每 service instance 保留各 workspace/tree/root 首次 device/inode/birth 身分。主機可加 `sourceIdentity: {dev,ino}` 同 external-tree `identity: {dev,ino}` 綁首次原生選擇證據。同 path 有意重新授權替代目錄需要新 instance；鎖內工作前後再查 roots。

有限檔讀取可用時以 `O_NOFOLLOW` 開 leaf，比較讀前後 handle metadata，回傳前重查正式目錄／檔快照。directory listing 同完成 catalogue/snapshot 同樣重查。觀察到外部替代／修改會拒絕，補足程式內鎖，唔當鎖能阻其他 writer。唔聲稱 OS snapshot 或原生 Windows race 驗收。

path inspection、open-handle 同最終重查都拒絕 link count 唔係一嘅檔，唔暴露由其他位置 hardlink 入授權樹嘅位元組。編寫 before-image reader 用同樣有限 handle 檢查。

revision 串流 hash 配置／配方收據，唔逐配方重複序列化共用文字／symbol arrays。保留 declarations 每 config 限 512／128 KiB，每 source tree 10,000／4 MiB，全掃 20,000／8 MiB；prompt/help 各有長度上限。`symbolStats` 報保留／宣告數、bytes、truncation、budgets 同 streaming revision-input bytes。截短明確標示，搜尋全部 package names 同已保留 declaration text。即使修改係冇保留細節嘅 declaration，整檔 receipt 仍失效。每共用 array 只搜尋一次，唔重建重複 aggregate JSON。

編寫保留檢查將 snapshot hash、mode、identity 綁到已 review revision 嘅精確原 before-image。回 preview 前重查，逐目標發佈前再查。Rollback 只喺目前文字同 captured published identity 仍匹配交易時復原，獨立變更保留並報 `PACKAGE_ROLLBACK_FAILED`。只檢查可觀察變化，唔係原子 snapshot 或所有外部競爭保證。

準備暫存同改 permissions 後、rename 前再查預期 receipt；準備 rollback bytes 後同樣檢查。新檔用獨佔 hard-link 發佈，移除暫存 link 後先驗 single-link receipt，唔取代獨立出現目標。剩餘 check-to-publish 間隔唔係 OS compare-and-swap。

Authoring 同樣要求原 root 等於正式 path，可接原生 `identity: {dev,ino}`，保留首次身分並鎖內前後驗證。替代／導向 selected directory 要新主機授權同新 instance。Fixtures 涵蓋 forward／rollback 暫存準備期間修改，同導向 root 拒絕。
