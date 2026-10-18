# 未簽署 Windows 發佈

[English](releases.md)

本文逐段保留原始發佈記錄嘅時間同證據界線。較早版本嘅功能限制只描述當時版本，唔應讀成今日所有來源仍未實作。

## 已驗證 build 49.1 中繼資料

普通發佈 [v0.1.0-build.49.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0-build.49.1) 綁定 `7a6b2b5ee5d23f9029d3128d9961cb8aef52cf79`。五個發佈檔嘅大小同摘要全部匹配，三個小型中繼資料檔亦獨立下載。[已清理收據](../evidence/native-windows-20261016/release-v0.1.0-build.49.1.json) 唔聲稱安裝包／套件下載或安裝。Scallop Har Gow 原圖公開，HEAD 要求回覆 HTTP 200，冇取得圖片位元組。原工作流程終止 API 提供首工作開始 `2026-10-16T10:17:41Z`、發佈步驟完成 `2026-10-16T10:21:23Z`，歷時 `00:03:42`。修正說明同未改檔案已精確讀回。日後自動註記已有集中來源檢查同獨立審查，託管交付仍待證明。

## 已發佈版本 0.1.0

自動流程 [38682722692](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38682722692) 後來成功完成，建立普通發佈 `v0.1.0-build.1.1`，取代下段仍執行中嘅觀察。首個 `v0.1.0` 直接下載仍穩定。

[下載 Setup.exe](https://github.com/Ding-Ding-Projects/material-buildroot/releases/download/v0.1.0/Setup.exe)，或查看[普通 v0.1.0 發佈](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0)。不可變標籤解析為 `0881a3a3f58c85bf73f57035b3a09da3acbbe1a8`。五個上傳檔嘅大小同 SHA-256 均同本機匹配。有限安裝啟動證據報告版本 0.1.0、該來源同可用儲存，已安裝執行檔／封存同完整套件匹配。Setup 退出碼不可用；簽署程序稽核、更新配對同自動更新未證明。當時記錄邊界，流程 38682722692 仍執行中。首個桌面里程碑唔完成整體安裝器、更新器或產品驗收。

首個可下載里程碑 0.1.0 只含有限桌面外殼同持久語言設定，當時未實作項目建立、Buildroot 執行同自動更新。初始代號 **Classic Har Gow · 蝦餃** 從 `assets/branding/release-codename.json` 記錄嘅公開目錄修訂解析。早期發佈連結原始公開相片，冇重複附件。

## 公開相片參照同修正

中途變更 `7b679a713d87350253106fba7e6dbd30a7522a67` 錯誤地將所選食物 PNG 同目錄項目複製入此消費端來源，並附加到消費端發佈。當前修正移除來源副本同原生點陣解碼器。唔會聲稱歷史副本同附件從未存在；修正既有發佈檔同說明係另一項需明確驗證嘅操作。

`assets/branding/release-codename.json` 保留為歷史有限資料，唔係第二個目錄依據，亦唔證明執行時 About 消費端。唔安全本機來源變更或已追蹤複製目錄仍係發佈錯誤。可選命名改為將目前公開目錄固定到確切修訂，列出普通 `catalog-v1*` 發佈檔同完整有限項目發佈歷史，再按目錄次序揀第一道未用過而已發佈嘅菜。確切公開雙語名稱、來源修訂、原始 URL、發佈大小／雜湊同標籤映射會進入說明同來源記錄。歷史名稱同正文提及只係保守避免重用嘅資料，唔係指示。

命名查詢上限為 45 秒、60 個要求、每清單 20 頁、5,000 道菜同 10,000 個發佈檔項目。來源不可用、逾時、歷史唔完整或冇未用菜名，都會明確發佈只有版本嘅版本，唔會因命名而令發佈失敗或靜靜重用。中繼資料檢查唔下載或解碼圖片，觸及界限唔聲稱查詢完整。About、更新記錄同網站名稱展示仍係獨立驗收缺口。

時間預算喺中繼資料同處理檢查點合作執行；同步解析或字串操作可喺下次檢查前完成，但已觀察到期後唔可以回傳選名。八個集中案例通過，包括取得中繼資料後到期。

命名成功時，說明同公開來源記錄只連到擁有原圖嘅公開發佈，消費端發佈期間唔生成、下載、複製或附加圖片。暫存發佈清單拒絕圖片／相片封存新增，保留安裝包、來源記錄、校驗和、唯一普通發佈分類同標籤／來源／讀回檢查。靜態共用 `windows-release` 並行群組用 `queue: max` 並停用取消，跨分支串行選名同發佈。支援佇列最多 100 個等待執行，滿額後新增執行會取消，見[官方並行文件](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)。佇列接納同託管執行係外部證據，冇新增流程測試或 lint。此修正來源實際發佈喺原記錄仍待處理。

重複 PNG 已從任務所屬 `v0.1.0-build.47.1` 同 `v0.1.0-build.48.1` 撤回。讀回驗證修正說明同另外五個未改檔。原標籤同來源／校驗檔保留，說明披露歷史圖片項目。公開原件同精確本機復原副本仍已驗證，冇改寫來源歷史。

## 本機製作同發佈

從已提交、未改來源執行確切 `build-installer.bat /s`，按 `build-manifest.json` 啟動固定 Node.js 24.22.0、MinGit 2.56.0.2 同桌面執行環境 44.7.2，安裝精確 npm 鎖，製作真正未簽署 Squirrel.Windows 輸出。`scripts/release/prepare.cjs <exact-source-sha>` 先驗證收據同 Squirrel 記錄，再只將 Setup.exe、RELEASES 同 full/delta 套件複製到新 `release/publish`，加入精簡公開來源記錄同 SHA-256。既有暫存發佈目錄會保留並拒絕操作，唔覆寫。

安裝器可能觸發不明發行者或 SmartScreen 警告。為原有產品圖示啟用執行檔資源編輯，但程式簽署同憑證自動偵測仍停用，唔係簽署聲稱。原生 Authenticode 讀回、安裝、啟動同更新證據同封裝製作分開。首個套件唔證明更新配對或自動更新器。

## 自動發佈

`.github/workflows/release.yml` 喺每個分支推送同手動觸發執行，排除標籤事件避免循環。因冇可用項目自有相容執行器，選用 `windows-2025`。佢呼叫確切根安裝入口，發佈唯一普通標籤 `v<version>-build.<run-number>.<attempt>`，綁定確切流程來源 SHA。唔覆寫舊標籤或附件。發佈後讀回全部安裝檔、精簡來源、校驗和同標籤提交。說明記錄首工作開始、發佈完成同量度歷時。流程冇測試、lint 或型別檢查，所以可能發佈本機檢查會失敗嘅來源；本機驗證另外報告。

憑證順序為 `RELEASE_TOKEN`、`ORG_TOKEN`、`GITHUB_TOKEN`。值只喺支援環境通道，唔寫輸出。失敗後仍安全收集及上傳，保留七日，收集錯誤唔掩蓋原結果。排除來源樹、快取、依賴目錄同憑證。

## 工作依賴同限制

`package` 工作需要固定 Windows 映像供應嘅 Windows PowerShell/.NET 同封存支援、checkout v4、upload v4、根 manifest 可攜工具／執行環境、完整 npm 鎖同 GitHub CLI 2.96.0。發佈 CLI 由官方發佈下載，用固定 SHA-256 放到工作暫存目錄，使用前啟動。根入口支援冷／暖工具取得，唔作全域安裝。Squirrel 支援封裝器透過固定 npm 路線取得自己所需工具。新託管工作同原生安裝驗收要等真正執行；依賴清單唔係證據。

## 品牌

`assets/branding/mark.json` 係既有分層建置標誌嘅幾何來源。`scripts/build/branding.cjs` 確定性產生 SVG、256 像素 PNG，同 16、24、32、48、64、128、256 像素 ICO 項目，`--check` 核對精確位元組。桌面視窗、執行檔同 Squirrel setup 用項目 ICO。文件產生器複製到 `site/assets/icon.ico`，安裝中繼資料用精確已部署項目 URL。聲稱發佈前要驗證 URL 真實交付。

## 終止流程計時

發佈器喺建立同全部附件／標籤讀回期間，將所屬計時區塊明確留為待定，唔會將讀回前本機時鐘當流程完成。獨立 `workflow_run: completed` 註記只監聽 Windows 發佈流程，透過 GitHub CLI 重新驗證成功、同來源庫、push/manual 嘅該次嘗試。

註記器只執行完成流程 SHA 上已檢視嘅預設分支程式碼，唔檢出觸發分支、還原共用快取、下載執行產物、解讀發佈說明或執行來源套件中繼資料。最小預設分支檢出提供註記 helper、已驗證可攜 Node 啟動同固定 GitHub CLI。工作需要 Windows PowerShell/.NET 封存、checkout v4、可信 manifest 嘅 Node 24.22.0、既有固定啟動路線嘅 GitHub CLI 2.96.0，同 upload-artifact v4。只安裝缺少嘅固定執行環境，冇 npm 依賴、產品建置、測試或 lint。託管啟動同事件交付需真實執行先驗證。

時間來自原嘗試完整有限工作清單：最早工作 `started_at`、最後發佈步驟 `completed_at`，同最遲終止工作 `completed_at`。必要 **Workflow completed** 欄位係最終發佈步驟 completed_at，歷時亦喺所有檔／標籤讀回後該步驟結束。最遲工作完成另標為最後輸出收集附加證據，唔代替標題或歷時。唔用未支援執行完成欄位或可變 `updated_at`。缺少、無效、不成功、不完整或矛盾資料，會令計時未完成，只令註記操作失敗；原成功發佈仍獨立記錄。

註記先驗證來源／版本／執行／嘗試、普通發佈身分同精確標籤，再只修改唯一分隔計時區塊。精確讀回說明，確認檔案未變。唔建立發佈、標籤或來源庫推送，所以唔遞迴發佈。同一完成嘗試重跑係冪等。監聽器必須存在預設分支，舊執行冇所屬區塊時唔會靜靜重寫。

量度時間只屬原發佈流程。註記操作同其終止結果係另一證據界線，唔計入原歷時。本機註記時間唔可聲稱註記流程已完成。整體計時驗收需要發佈說明讀回，加獨立註記流程終止成功，避免將過早完成聲稱搬去另一個步驟。

官方參考：[完成事件及可信預設分支執行](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)、[特定嘗試工作計時資料](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt)。
