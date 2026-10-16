# API 集合

[English](README.md)

- [安全配對、檢視、操作及斷線](api-workflow.zh-HK.md)

[總 Postman 集合](material-buildroot.postman_collection.json)同分類檔案而家包含四條 HTTPS 工作階段路由，以及已整合主機 `actionContracts` 嘅 107 個有型別動作。呢個係來源協定快照，唔證明已配對執行或者伴隨功能全部完成。欄位及標頭跟[目前配對協定](../features/browser-pairing.md)，每個動作仍受[處理端界線](../features/companion-consumers.md)、範圍及獨立原生權限限制。產品 HTTP 介面係可選 HTTPS 伴隨服務。桌面 IPC 唔係 HTTP，唔建立集合；界線列於[安全索引](../security/README.md)。

兩份集合由 `node scripts/api/generate-postman.cjs` 產生，現有 `tests/postman-collections.test.cjs` 係原有基礎測試，唔宣稱涵蓋新動作。本輪重新產生已整合擴充快照，冇執行測試，唔宣稱真實 Postman、瀏覽器配對、TLS 或 LAN 驗收通過。

產生器會辨認已整合 `src/main/security/companion-consumers.cjs`。存在時列出實際 action contract 同 scope，採用已編寫參數範本，加入瀏覽器配對欄位同工作階段 client-binding 標頭；新動作冇範本就停止產生。不存在時只產生有明確標示嘅六動作基礎快照。整合處理端後要重新產生，來源支援擴充唔等於 JSON 已更新。範例唔授予工作階段權限，需要原生確認嘅操作仍要桌面批准。此輪只重新產生來源快照，冇執行 API、測試或實際配對。
