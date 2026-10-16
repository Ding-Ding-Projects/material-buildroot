# 瀏覽器配對及私人網絡授權

[English](browser-pairing.md) · [功能索引](README.md)

桌面擁有人明確選擇私人監聽地址、可信 HTTPS 憑證及匹配私鑰，啟動要原生確認。唔開公開地址、自動登記、憑證例外、改防火牆或者主機安全設定。

## 配對 Edge 或 Chrome

1. 喺瀏覽器伴隨控制設定 TLS、選本機地址，再原生批准啟動。
2. 選 Microsoft Edge 或 Google Chrome，輸入可辨認裝置名、精確 HTTPS 網站 origin 同最少範圍。
3. 建五分鐘單次挑戰，只輸入網站配對控制，唔放網址、匯出或記錄。
4. 瀏覽器顯示隨機實例 ID，原生批准前比較 ID、來源、裝置名、瀏覽器、peer 同範圍。
5. 一小時工作階段固定呢啲選擇，改範圍要新挑戰及原生批准，瀏覽器唔可以自授權。

品牌只係相容提示，裝置名係擁有人自填，唔係硬件或瀏覽器認證。認證使用私人 Secure/HttpOnly cookie、記憶體 CSRF、綁定瀏覽器實例及原網絡 peer。peer 改變、重載、到期或撤銷都要重新配對。唔好用 proxy 將端點暴露公網；server 拒絕非私人 peer，忽略 forwarding header。

## 請求及主機協定

配對只接受 `challenge`、`clientNonce`、`browser`，原生建立挑戰只接受 `origin`、`scopes`、`browser`、`deviceName`。之後呼叫要 cookie、`X-CSRF-Token`，加原本 `clientNonce` 作 `X-Companion-Client`。動作精確為 `action`、`args`、`sequence`、`nonce`。遞增序號、唯一 nonce、嚴格參數、有界請求及每階段只一個未完成動作，防止重複執行同平行序號歧義。失敗或不確定唔自動重試。

可信主機可提供 `actionContracts`，每個具名動作有 scope 同同步 `validate(args)`。既有動作只可用原固定 scope 取代驗證，registry 只由主機提供，唔由 IPC 或瀏覽器輸入；controller `allowedScopes` 亦獨立由主機決定。派送收到凍結 context：`sessionId`、`origin`、`browser`、`deviceName`、`clientId`、凍結 `scopes`、`operationId` 及 `isAuthorized()`。處理端每次敏感讀/寫前要再次檢查，專案權限同工作階段範圍分開。

## 撤銷及結算

原生撤銷、斷線及停止監聽移除新權限。已執行操作保留實際結算同 `authorityRevoked`，唔假稱已停止主機工作；撤銷後完成嘅結果唔披露。斷線即使網絡遺失仍清本機階段，畫面明示需要原生撤銷；停止 listener 使待用原生登記批准失效。

## 瀏覽器網絡控制

頁面要頂層 HTTPS secure context，端點為明確私人 IPv4 或 IPv6 loopback 加 port，唔做 DNS 探索、掃描、mixed-content 降級、停用 TLS 或改 permission policy。精確 origin CORS 同有界舊私人網絡 preflight 唔代替瀏覽器本身 local-network 批准。拒絕、不可信憑證、cookie 限制或企業政策都可能阻止配對，畫面報不確定，唔重試或放寬保護。

目前指引見 [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access)及 [Microsoft Edge Local Network Access](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access)。瀏覽器同原生主機批准係獨立決定。

## 驗收狀態

此變更只有來源，刻意冇測試、靜態分析、瀏覽器操作、啟動監聽、登記、TLS 信任、LAN 提示、實際撤銷或畫面擷取。封裝成功唔係執行或安全驗收，完整檢查前唔宣稱可操作驗收完成。
