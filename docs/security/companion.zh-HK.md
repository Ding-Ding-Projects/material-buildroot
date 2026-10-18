# 自願啟用 HTTPS 伴隨連線嘅界線

[English](companion.md) · [安全文件](README.md)

## 歷史基線同目前規格

下方六操作協定記錄最初實作界線。目前配對另外要求已檢視瀏覽器選擇同原始 client-instance header，可信主機亦提供擴展具型別操作規格。變更見[目前瀏覽器配對](../features/browser-pairing.md)、[已驗證消費端流程](../features/companion-consumers.md)同[目前 collection 用法](../postman/api-workflow.md)。重新產生嘅分類／主 collection 列出整合後操作。以下歷史固定資料測試唔聲稱覆蓋或驗收新規格。

伺服器預設停用，只有可信桌面明確啟動先運作。只接受提供嘅 HTTPS 憑證，唔生成、安裝或信任憑證，唔跳過瀏覽器憑證檢查，唔開萬用介面或互聯網接聽。憑證準備、瀏覽器信任、作業系統防火牆權限同真實 Windows/LAN 行為需要獨立驗證。

## 可信主機 API

`createCompanionServer({tls:{key,cert},confirmPairing,onAction,now?})` 本身唔建立 listener。主機擁有兩個 TLS 值同兩個回呼。

| 方法 | 結果 |
| --- | --- |
| `start({host,port})` | Promise 回傳 `{host,port,authority,origin}` |
| `stop()` | 連線關閉後 Promise 完成，撤銷全部階段 |
| `createPairing({origin,scopes})` | `{challenge,origin,scopes,expiresAt}` |
| `revoke(sessionId)` | Boolean，表示已知階段係咪已撤銷 |
| `state()` | `{enabled,binding,sessions,operations}`，唔含 cookie、CSRF token、challenge 或 TLS 憑證 |

綁定要明確字面 loopback 或私人 IPv4。支援 IPv6 loopback，但拒絕萬用位址、DNS 名、公開 IP 同其他 IPv6。原生控制器再限制為目前觀察到嘅本機介面或 loopback。port 零要求臨時連接埠，亦可指定有效 port。單元測試唔會綁定 LAN。

`createCompanionController({dialog,parentWindow,onAction,networkInterfaces?,allowedScopes?,now?})` 加上只供桌面嘅 `request(action,args)`，回傳普通操作結果或經清理帶代碼錯誤。只可透過另外授權桌面 IPC 暴露，絕不可放入 HTTP 操作分派器。

| 桌面操作 | 參數 |
| --- | --- |
| `companion.status` | `{}` |
| `companion.configure` | `{}` |
| `companion.start` | `{host,port}` |
| `companion.stop` | `{}` |
| `companion.createPairing` | `{origin,scopes}` |
| `companion.revoke` | `{sessionId}` |

Configure 用原生憑證同私鑰選擇器，讀取有限正式路徑檔案，核對已開檔身分同 TLS context，先取代之前未啟用配置。唔回傳路徑或金鑰內容。配置只喺記憶體，重新啟動程式要重新配置；更改前先停止 listener。TLS 檔必須係正常單連結檔案，唔接受符號連結。

預設只開 `workspace:read`、`projects:read`、`jobs:read`。主機只有整合咗相應消費端授權後先可明確開啟修改範圍。配對瀏覽器唔繼承桌面使用者嘅項目授權或工作擁有權。

## 登記同 HTTP 規格

每個要求都要精確配置 Host authority 同精確批准 HTTPS Origin。Origin 唔含路徑、query、憑證、fragment 或萬用字元。主機建立五分鐘、單次 challenge 時選一個 origin 同有限 scopes，桌面顯示不透明 challenge，供使用者有意複製到瀏覽器。

瀏覽器向 `/pair` POST `{challenge,clientNonce}`，`clientNonce` 係 UUID。原生批准前已消耗 challenge。伺服器呼叫 `confirmPairing({origin,scopes,clientNonce,remoteAddress})`，只有回傳嚴格 `true`，而 listener 同 challenge 仍有效，先建立階段。同時只可一個原生審批。原生對話框顯示精確 origin 同 scopes，初始同取消動作都係 Cancel。只有 challenge 唔足以登記瀏覽器。

成功配對回覆 `{session,csrfToken,nextSequence:1}`，加主機限定 `__Host-material-companion` cookie，屬性為 `Path=/; Secure; HttpOnly; SameSite=None`。cookie 一小時到期，主機獨立執行相同期限制。瀏覽器要求帶 credentials，同 `X-CSRF-Token`。cookie 同 CSRF token 各自隨機，綁定同一階段同批准 origin。全部階段只喺記憶體，程式重啟後失效。

`POST /session` 只接受 `{}`，需要 cookie、origin 同 CSRF header，回傳目前 `{session,nextSequence}`。呢個係階段資料，唔係建置或連線成功聲稱。

`POST /actions` 精確接受 `{action,args,sequence,nonce}`。sequence 由一開始，必須等於下一個接受序號；nonce 係每次新 UUID，階段內唔可重複。接受時先預留兩者再呼叫消費端，避免平行重試重複使用同一權限。修改已接受但回覆遺失時，客戶端唔可用新 nonce 自動重試，要先核對真實工作狀態。

| 操作 | 必要範圍 | 精確參數 |
| --- | --- | --- |
| `workspace.read` | `workspace:read` | `{}` |
| `projects.list` | `projects:read` | `{}` |
| `jobs.list` | `jobs:read` | `{}` |
| `jobs.get` | `jobs:read` | `{jobId:UUID}` |
| `jobs.cancel` | `jobs:cancel` | `{jobId:UUID,expectedSequence:integer}` |
| `builds.submit` | `builds:submit` | `{workspaceId:UUID,runtime:"wsl"|"docker",target:"all"|"clean"|"sdk"|"toolchain",jobs:1..64}` |

冇任意方法名、指令、原始路徑或動態目標。接納 scope 唔等於實作操作。`onAction({action,args},context)` 要呼叫明確整合且已授權消費端，檢查配對主體項目／工作擁有權，回傳有限瀏覽器安全資料。context 有 `sessionId`、`origin`、`scopes`、`operationId` 同 `isAuthorized()`。後續效果前要再檢查授權，唔可跨非同步工作保留過期許可。唯讀根整合必須保持修改 scopes 停用。

成功回覆 `{operation,result,nextSequence}`。操作 `succeeded` 只代表消費端回呼回傳有效有限資料，唔代表已接受建置完成。真正工作狀態喺結果同後續查詢。回呼拋錯或回傳無效時，操作係 `unknown`，可能已發生效果，唔推斷 rollback 或取消，亦唔回傳原始例外詳情。

`POST /disconnect` 需要精確 `{}`、目前 cookie、精確 Host/Origin 同 CSRF，只撤銷該 cookie 階段，回覆 `{revoked:true,session:{id,status:"revoked"}}` 並清除安全 cookie。已撤銷／到期回 HTTP 401 並清 cookie。origin 唔符或缺 CSRF 唔可以撤銷另一階段。

原生 `revoke` 同 `stop` 即時停止新權限。已分派消費端工作仍會執行直到回呼真正結束。狀態記 `authorityRevoked:true`，唔偽造停止、取消或復原。關連線唔會停止委派工作，主機消費端要獨立保留持久工作狀態。

## 要求同資源界限

JSON body 限 16 KiB，拒絕重複 key、prototype key、未知欄位、無效 enum 同型別參數。消費端回覆必須普通 JSON，深度最多八，大小最多 64 KiB，陣列最多 1,000 元素。header 限 8 KiB，拒絕重複安全 header。要求、header 同 keep-alive 都有逾時界限。

每個遠端 IP 每分鐘最多 20 次配對嘗試、120 個總要求；速率桶最多 100 位址。最多 100 個未完成 challenge、100 個保留階段、1,000 個已分派操作記錄。每階段最多接受 1,000 個 nonce。容量不足明確回報，唔靜靜移走歷史或恢復舊授權。重啟清除暫時記錄並撤銷全部階段。

CORS 只反映精確已登記或目前受 challenge origin，允許 credentials 但唔用萬用字元。預檢只接納 POST 同 Content-Type/CSRF header。私人網絡預檢確認限相同批准 origins，唔覆蓋瀏覽器本機網絡權限或憑證信任。Edge/Chrome 真實權限同跨來源 cookie 行為仍需執行驗收。

## Postman collections

分類 collection：[postman/companion.postman_collection.json](postman/companion.postman_collection.json)；全部 HTTP API 主 collection：[../postman/material-buildroot.postman_collection.json](../postman/material-buildroot.postman_collection.json)。伴隨服務係唯一 HTTP 介面，所以主檔只有一個同分類鏡像嘅資料夾。

先喺桌面用自己 TLS 檔啟動，客戶端信任憑證，為確切 origin 建 challenge，再設 `baseUrl`、`origin`、`challenge`。送 **Pair browser** 並批准原生審批。將回覆 `csrfToken` 放入唔分享嘅 current value，cookie jar 保留 cookie。每次操作後將 `sequence` 設成回覆 `nextSequence`，`{{$guid}}` 每次產生新 nonce。修改操作需要桌面預設未開嘅 scopes。呢段係歷史六操作用法，目前配對額外 header 請睇上方最新指南。

`node scripts/api/generate-postman.cjs` 重新產生；`--check` 喺任一檔過期時失敗。`node --test tests/postman-collections.test.cjs` 檢查路由／操作覆蓋、冇憑證資料，並用臨時憑證向真實 loopback HTTPS 依次重播每個要求。重播唔係 Postman 程式、LAN、防火牆或瀏覽器信任結果。

## 目前驗證：瀏覽器摘要回覆

瀏覽器直接用主機私隱過濾後 `result`。`workspace.read` 回 `{revision,onboardingCompleted,plans}`，唔回完整工作區、偏好、筆記、路徑或憑證。`projects.list` 回 `{projects}`，`jobs.list` 回 `{jobs}`，只含 `src/main/operations-service.cjs` 明確選取欄位。

顯示任何記錄前先驗證完整結果：精確欄位、有限字串、非負整數計數、Boolean 同最多 1,000 記錄。格式錯誤顯示本地化不可用，唔保留原始回覆供語言重繪，亦唔顯示成功通知。回覆遺失會清除舊顯示、標記 sequence 不確定，下一要求前要刷新階段，冇自動重試。驗證唔增加授權或主機披露範圍。

`node --test tests/browser-workflow-contract.test.mjs` 執行真實主機投影同瀏覽器渲染程式碼，使用記憶體 DOM 替身，檢查錯誤／空結果、語言、遺失回覆，並將全部動態支援文章連結同產生器路由式比較。唔係已安裝瀏覽器、TLS、配對、無障礙或建成版面證據。

集中測試喺暫存目錄用 OpenSSL 建一日憑證同私鑰，使用憑證作 HTTPS 客戶端可信 CA，之後刪檔，唔停用 TLS 驗證或提交私鑰。真實 loopback HTTPS 檢查涵蓋登記、原生拒絕、cookie 屬性、Host/Origin 拒絕、CSRF、scopes、重播、到期、速率、有限 JSON、委派期間撤銷、自行斷線同精確 CORS 預檢。注入對話框測試涵蓋私人 TLS 選擇、本機介面限制同預設 Cancel。唔會測真正 LAN listener、Windows 防火牆操作、瀏覽器安裝憑證或真實配對瀏覽器執行。
