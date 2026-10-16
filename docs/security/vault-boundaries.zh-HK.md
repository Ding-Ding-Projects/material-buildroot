# 主機憑證庫及權限界線

[English](vault-boundaries.md) · [安全索引](README.md)

PH02-T04 來源實作，測試、靜態分析、審查及執行驗收延後，唔宣稱路線圖驗收完成。

## 受保護儲存及參照

主機 vault 經作業系統 protected storage 加密有界字串，拒絕不可用加密、純文字/未知 backend、不安全根、連結/過大檔、無效記錄及擁有人不符。呼叫方只存不透明 `vault:`，唔存明文。參照本身唔授讀/刪權，驗證器解析要提供登記擁有人。

## 明確主機擁有權

`createVault().forOwner(owner, permissions)` 只由可信主機登記。主機檢視流程後選有效 owner 及 `read`、`write`、`remove` 非空無重複子集，回覆 facade 固定擁有人及權限，呼叫唔可換 owner 或加權。撤銷使該 facade 後續操作失效，包括自己寫過參照，唔刪憑證或撤其他 facade。root vault 只留可信組合程式，root 同含秘密範圍方法都唔公開到 preload、瀏覽器配對或 renderer IPC。

型別協定位於 `src/shared/vault.ts`，factory declaration 跟實作，只授予本程序既有 protected storage，冇管理員執行、shell、啟動程序、安全設定或自動提升。要額外主機權限嘅流程仍需獨立有型別原生路線及使用者原生同意，此變更冇實作或操作該路線。

## 遮蔽操作記錄

每 facade 記憶體最多 256 筆最近操作，只固定 sequence、operation、outcome，排除 owner、reference、輸入、密文/明文、長度、路徑及平台 exception。係不可變快照，唔係耐久稽核日誌。失敗固定一般訊息/代碼，程序完結記錄消失，唔證明重啟前歷史。

## 待驗證

擁有人分隔、唯讀拒寫、撤銷、記錄上限、backend 拒絕、驗證器驗證及原生 protected storage 都需延後執行。本文冇測試、安裝或實際證據；檔案能力、指令執行及特權 installer 保留獨立擁有權及驗收。
