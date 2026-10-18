# 選擇套件建置目標

[English](package-targets.md) · [桌面指南](README.md)

套件係所選Buildroot來源入面一個元件；套件操作就係要求Buildroot處理該元件。要完整映像，**Build target／建置目標**保留 `all`。要處理單一元件，先用 **Search source packages／搜尋來源套件**，揀 **Source package／來源套件**，再揀 **Package action／套件操作**，按 **Select package action／選擇套件操作**。檢視結果目標、執行環境同並行數後，先另外用 **Queue build／排入建置**。選取本身絕唔提交建置。

## 搵套件，同時保留選擇

主機經 `build.targets` 提供完整已發現來源清單，介面唔會只留第一頁。每頁50個符合項目，**Previous packages／上一頁套件**同 **Next packages／下一頁套件**支援鍵盤。如果有效選取唔喺目前頁，會額外保留一項並標 **Selected outside this page／已選取，唔喺本頁**，所以最多掛載51項。計數列出符合數、來源總數同顯示範圍。

冇結果會顯示復原說明，改query或關regex就可普通瀏覽。**Refresh targets／更新目標**重新查來源目錄，已移除或唔再接納嘅選取會清除。3,263項來源清單fixture驗最後一項可達、鍵盤分頁同跨篩選保留，係該fixture完整數量，唔係每個Buildroot版本固定承諾。來源存在某套件唔代表目前配置已啟用。

## 文字同表達式搜尋

預設literal，不分大小寫比較套件名。相鄰完整regex workbench獨立管理pattern同flags，pattern最多2,000字元。Worker每訊息最多1,000項，每項文字最多70,000字元；flags限 `dgimsuvy`，唔可重複，亦受browser regex engine支援限制。

Regex對完整清單分批處理，共用一個600ms期限。只有目前query generation全部批次成功，先發佈matching IDs。Invalid、worker unavailable或timeout唔會提供部分結果，會顯示復原訊息。改query或離開regex會令舊回覆失效。呢個只限制搜尋，唔執行或配置套件。

## 每個操作做乜

- `rebuild`：重建所選套件。反向依賴同最終映像可能仍舊，之後應執行完整映像目標。Toolchain或ABI變化可能需要完整清理重建。
- `reconfigure`：重跑該套件配置同編譯，反向依賴同映像限制相同。
- `dirclean`：移除該套件產生嘅建置目錄，下次由頭建。已安裝檔案同反向依賴唔會自動重建，必須確認精確輸出目的地嘅破壞操作。
- `download`：透過所選已接納環境要求來源下載目標，仍受配置、環境同網絡限制。

提交時主機按目前catalogue同source/configuration intent驗package/action。標籤或已保存選取唔授檔案系統或執行權限。Destructive targets沿用exact-destination確認。Runtime discovery、資源接納、queue、取消同cleanup仍係分開流程。Chooser只收命名操作，唔收任意shell。

## 證據同限制

`tests/renderer/renderer-package-chooser.spec.mjs` 有來源綁定renderer fixtures，涵蓋完整3,263項、bounded options、鍵盤分頁、保留選取、移除套件拒絕、literal/regex、全成或全敗timeout、late reply拒絕、本地化窄畫面，同選取期間冇 `build.submit`。Fixture host供清單並記requests，唔跑native build。Native GUI、真runtime提交、destructive confirmation同ISO製作／啟動都要獨立source-bound證據。此文章冇新增native或ISO成功聲稱。
