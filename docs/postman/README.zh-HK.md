# API 集合

[English](README.md)

- [安全配對、檢視、操作及斷線](api-workflow.zh-HK.md)

[總 Postman 集合](material-buildroot.postman_collection.json)涵蓋產品提供嘅全部 HTTP API，目前只有可選 HTTPS 伴隨服務。分類集合及使用方法見[伴隨協定文章](../security/companion.md#postman-collections)。桌面 IPC 唔係 HTTP，唔建立集合；界線列於[安全索引](../security/README.md)。

兩份集合由 `node scripts/api/generate-postman.cjs` 產生，現有 `tests/postman-collections.test.cjs` 提供檢查。本輪文件工作冇執行產生器或測試，唔宣稱真實 Postman、瀏覽器配對、TLS 或 LAN 驗收通過。
