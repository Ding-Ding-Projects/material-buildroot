# 桌面更新

[English](updates.md) · [桌面索引](README.md)

已安裝 Windows 套件十五秒後由主機開始查更新，每六小時再探索。取消後手動檢查可恢復。開發及非 Windows 程序明示自動安裝不可用。操作工作區同持久 banner 共用一個 updater，顯示層每兩秒輪詢遮蔽狀態，唔啟動探索。

## Feed 及版本

固定 `Ding-Ding-Projects/material-buildroot`，最多十頁普通發行，只接受 `vX.Y.Z` 同 `vX.Y.Z-build.N.N`。數值版本必須嚴格大於 `app.getVersion()`，同版本改來源唔提供升級，發佈日期唔容許降級。封裝 `packageVersion` 要同安裝版本、tag 及 provenance 一致。託管用配置遞增 build version，本機來源版本唔自動成發行版本。

要有 `Setup.exe`、`provenance.json`、`SHA256SUMS.txt`，URL 名來源及 tag。核 provenance 摘要、版本、source/tag 關係、Windows x64、真 Squirrel、未簽署、有界大小及 installer SHA-256。HTTPS 轉址只准已配置 GitHub asset host。證明來源控制內傳輸完整，唔係獨立簽署身份。

## 下載及取消

合資格 installer 自動背景下載至自有 partial，只喺精確 HTTP range 相符先續傳。完整長度及摘要相同先顯 ready，現有完整檔重驗，啟動前再查。取消中止 request，該階段暫停排程；重試/手動查恢復，重開程式恢復正常排程並驗保留資料。損壞 partial 移除而唔安裝，現有資料及版本保留。

本地化持久 ready banner 顯精確版本、未簽署警告、發行說明、已存工作確認、`Restart to install update` 同 `Later`。Later 保留提示。更新工作區有探索、狀態、取消及下載復原；重開由全域 banner 發起，讓 shell 查草稿。

## 明確重開程式

已知未存計劃/語言、排程草稿、儲存中、設定編輯及工作都阻重開。未有完整儲存協定嘅巢狀編輯器，保守要求先關；另有明確確認保存其他草稿。主機活動操作或排隊/執行建置時阻安裝，確認開啟期間凍結新操作，原生雙語未簽署 installer 確認預設 Later。取消還焦點並保留 ready。

確認後主機再驗 staging，唔經 shell 以確切主機所選路徑啟動，唔收 renderer args。只要求正常程式 quit，保留 before-quit/beforeunload，唔強退或重啟電腦。真互動 Squirrel Setup 自己完成安裝及程式生命週期。取消、失敗或冇重開就手動開舊安裝，冇無人回復或復原安裝。

有界本機 transition receipt 記上一個及預期數值版本，下次報達預期、安裝未完成、rollback 或讀唔到收據。啟動 installer 唔代表成功，收據唔宣稱檔相容、profile migration 或 installer 認證。

## 證據界線

此來源模式冇測試或實際驗證。真 Windows 升級、原生取消、中斷傳輸、profile、未存保留、焦點、重開、版本轉換、rollback 及無障礙未核實。此工作冇更新、重開或下載已安裝程式。
