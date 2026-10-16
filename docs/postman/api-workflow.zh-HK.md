# 使用 HTTP 集合，同桌面 IPC 分清界線

[English](api-workflow.md) · [API 集合索引](README.md)

產品 HTTP 介面係可選 HTTPS 伴隨連線。[分類集合](../security/postman/companion.postman_collection.json)包含實際請求，[總集合](material-buildroot.postman_collection.json)喺 Security / HTTPS companion 分類包含相同請求。兩份都係真實 Postman v2.1 JSON，由 `scripts/api/generate-postman.cjs` 同一份定義產生，只有佔位資料，唔係已執行端點或者預先批准工作階段。

## 配對、檢視、操作及斷線

1. 經原生控制以自己嘅 TLS 憑證及私鑰設定桌面伴隨服務，再透過用戶端支援流程信任憑證，唔好停用 TLS 驗證。
2. 為將要送出嘅精確 HTTPS origin 建立挑戰。將 `baseUrl` 設為桌面回報嘅完整端點，包括連接埠，再將 `origin` 同單次 `challenge` 放入不共用嘅目前值。
3. 先選新 UUID `clientId` 同原生已選 `browser`（`edge` 或 `chrome`），再送 **Pair browser**。原生審批核對瀏覽器實例、裝置名、peer、來源及範圍。之後保持同一 `clientId` 作 `X-Companion-Client`。回覆 `csrfToken` 放不共用目前值，cookie jar 存安全 cookie。單憑挑戰唔可以登記，瀏覽器及裝置名稱只係相容/使用者標籤，唔係硬件認證。
4. 用 **Read session** 取得 `nextSequence`，每次操作前設定 `sequence`。`{{$guid}}` 會產生新 UUID nonce。讀實際結果後用回覆下一序號，唔好假設上一操作已接受。
5. 用 **Disconnect** 撤銷本次工作階段；呢個唔會取消已派出工作，要另外檢視持久工作狀態。

集合唔儲存憑證、cookie、可用挑戰或工作階段憑證。填好嘅目前值唔好存入共用工作區、集合匯出、來源目錄、診斷記錄或者畫面擷取。

## 請求清單

| 請求 | 內容及權限 |
| --- | --- |
| `POST /pair` | `{challenge,clientNonce,browser}`，精確已批准來源、五分鐘單次挑戰及原生批准 |
| `POST /session` | `{}`，目前 cookie、精確來源、CSRF 及 client-binding 標頭 |
| `POST /actions` | `{action,args,sequence,nonce}`，工作階段範圍加實際處理端授權 |
| `POST /disconnect` | `{}`，目前 cookie、精確來源、CSRF 及 client-binding 標頭 |

集合有 107 個動作，名稱同範圍由已整合 `src/main/security/companion-consumers.cjs` 列舉。[處理端文章](../features/companion-consumers.md)列範圍、流程、原生批准及缺口。`scripts/api/action-examples.cjs` 只係結構範本，佔位值要換成本次工作階段真正探索及獲准值；任意 UUID 或其他工作階段預覽唔授權。桌面預設唯讀，集合有修改動作唔代表已啟用範圍、已原生確認或者成功。新動作冇範例會停止產生，唔默默漏項。

## 回覆不確定時

接受操作會先預留序號同 nonce，再派送。回覆遺失或者操作為 `unknown`，可能已有影響，唔好自動用新 nonce 再送修改。先更新工作階段，以 `jobs.list` 或 `jobs.get` 檢視，再核對實際結果。原生撤銷或斷線阻止新權限，唔證明原工作停止。

主機要求精確 Host 及 Origin、拒絕重複安全標頭、驗證型別，JSON 請求最多 16 KiB。處理端結果最多深度 8、64 KiB、每陣列 1,000 項。工作階段維持一小時，只保存在記憶體，桌面重啟後失效。[協定限制](../security/companion.md#request-and-resource-limits)列出容量、速率、CORS 及到期行為。

## 冇 Postman 請求嘅功能

專案接入、來源變更、設定、輸出檢視、歷史、文件、套件編輯及主機執行使用已驗證桌面 IPC，顯示層操作名稱唔係 HTTP 網址。雲端適配器及已認證 Status Hub 用戶端係主機向外連線，唔係產品另外提供嘅 HTTP 端點。虛構集合請求會歪曲權限界線。

## 產生及驗收

既有根目錄文件建置負責產生文章及 wiki 路由。集合由 `node scripts/api/generate-postman.cjs` 產生，現有 `--check` 可報告過期。此輪按已整合處理端重新產生擴充集合，包括目前配對及 client-binding 欄位。[歷史協定文章](../security/companion.md#postman-collections)描述原基礎測試，唔證明新動作全部覆蓋。本輪冇執行測試、Postman、TLS、瀏覽器配對、LAN 或實際操作。來源清單、產生後發佈及安裝用戶端驗收保持分開。
