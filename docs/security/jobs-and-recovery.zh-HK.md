# 耐久工作及本機安全服務

[English](jobs-and-recovery.md) · [安全索引](README.md)

主機專用 `src/main/jobs/manager.cjs` 只接明確 adapter 函數 registry，renderer 唔可提供執行檔、指令、PID 或 adapter。排隊前主機要按操作 schema 驗 payload，manager 有界 JSON 唔代替 adapter 准入或檔案能力。

`createJobManager({ directory, adapters })` 回 `enqueue`、`get`、`list`、`run`、`cancel`、`retry`、`page`，每目錄只留一個 manager。enqueue 要 `kind`、`payload`、`ownerId`，可選 `operationId` 使同請求 idempotent，衝突拒絕。`run(id, ownerId, expectedSequence)`、取消及重試都驗 owner/序號。retry 新工作以 `retryOf` 連舊記錄，保留部分結果。

adapter 收 `(payload, { signal, jobId, log, item, checkpoint })`，要等實際結束先報最終取消。abort 先 running→cancelling，settle 先 cancelled；adapter 要觀察 signal，只停自己資源，觀察者斷線唔係取消證據。排隊可未跑就取消。exception 只一般失敗，唔保存原始秘密。結果、進度、log、item 由已接入 adapter 清理先保存，唔入憑證或原始驗證資料。

metadata 同目錄獨佔暫存、flush、atomic rename。log/item 各耐久 JSON，`page(id, 'item' | 'log', { after, limit })` 最多 100、有遞增 cursor、唔自動清理。冇固定總 queue 上限，但目錄目前全載記憶體，完整無限目錄分頁待做。item 應列 succeeded/failed/skipped/uncertain、目的地身份、核實輸出摘要及下一步。manager 保留型別值，唔自己宣稱驗輸出。

重開保留 queued/final，running/cancelling 變 interrupted 加新序號，唔恢復外部工作或宣稱 rollback。主機要核實實際 runtime/輸出先提供安全重試。各平台 directory flush、跨程序鎖、power-loss orphan 核對及大目錄未有驗收聲明，唔可多程序同目錄，冇原生 Windows crash/power-loss 測試。

## 確切目的地確認及 TOTP

`createConfirmationService` 發短期 operation/destination 挑戰及兩個獨立鍵，確認要兩鍵同 slider `1`。回隨機值一次用完，包括錯綁嘗試。動作/目的地改變、到期、取消、replay 或滑桿未完成都拒絕。主機要由已驗 device/file 能力解析確切目的地，破壞操作前即消耗，再驗能力。記憶體值重啟消失。獨立鍵 UI、焦點、清理需重建說明及實體身份重驗係另外整合，冇裝置破壞測試。

`totp`/`verifyTotp` 用 RFC 6238 SHA-1/256/512，原 focused suite 查十八個 Appendix B 向量。`createAuthenticator` 要主機 vault read/write，登記只回 ID 及 protected reference，renderer 唔應收到秘密。原切片 manual/QR、受保護 UI、OS vault、replay counter、rate limit 及 companion 配對仍待整合，後續見獨立文章。碼相符唔係 broker grant，體驗政策唔可當 broker 認證。

原文章記錄 2026-10-15 Linux 十六測試通過：`node --test tests/jobs.test.cjs tests/confirmation.test.cjs tests/authenticator.test.cjs tests/experience-policy.test.cjs tests/notifications.test.cjs`。只證明所測有界服務，包括重開頁讀、owner/stale、取消結算、retry、重啟中斷、到期/目的地及 RFC，唔完成 PH04/程式/瀏覽器/原生驗收，本輪冇重跑。

## 體驗政策、支援及等候復原

`src/main/security/experience-policy.cjs` 提供 `createExperiencePolicyService({ directory, vault, now, openFolder, attempts, waitMs })`。directory 要實際 app-data 復原位置，主機提供可信 file-manager 同 vault。六政策：`pin`、`password`、`pin+password`、`password+totp`、`pin+totp`、`password+pin+totp`。

`enroll({ targetId, policy, credentials, confirmation, duration, disclosureAccepted })` 每目標獨立 vault，重複 factor 及 OTP 要目前有效碼。PIN/password 用 salted scrypt，唔明文。duration `{ mode: 'surface' | 'minutes' | 'session', minutes }`。`list`、`get`、`isLocked`、`requireUnlocked`、`unlock`、`relock`、`leaveSurface`、`remove` 都精確目標。重啟全部鎖，unlock 只記憶體。vault 不可用唔扣次數或降 factor，同目標並行驗證拒絕。UI 要每條受保護 route 強制 `requireUnlocked`，提供錨定有序 factor/keypad；服務唔攔 DOM。

答錯扣每目標共用次數，用完指數等候最多一小時。`challenge(target, { schoolMode })`、`hit(nonce, cell)`、`answer(nonce, value)` 實作 ladder：五次四選食品答錯到十條算式，錯算式到 timed mole，失敗回原時計，School mode 由算式開始。只主機記憶體單次 nonce 評分，mole 用主機收到時間，每個只計一次，未完 round 唔收。通過只完等候、恢復正常等候同樣次數、保留 escalation，唔解鎖或授 broker。跨元素 rolling hour 最多跳過三次並持久保存，倒退時間唔縮等候或補額度，持久最近修改時間限制重啟時鐘。挑戰重啟消失，browser-native 另有流程。

`createTicket`、`tickets`、`advanceTicket` 只本機虛構支援，`recovery` 回精確資料夾同本機聲明，`openRecoveryFolder` 只可信 callback 並傳遞不可用/失敗。冇遞迴刪或網絡，ticket/policy/skip 原子保存。本地化、搜尋/批次、無障礙及逐元素攔截需整合證據。

## 通知及變更記錄

`src/main/jobs/notifications.cjs` 提供 `createNotificationStore({ directory, now })`，有 `notify({title, message, severity, context})`、`review({notificationId, status})`、`changelog({version, date, sourceUrl, changes})`、`page({after, limit})`。通知、read/dismiss/resolve 及事實變更係不可變編號檔，review 唔刪原事件，每次最多 100，唔自動清理。URL 只無憑證 HTTPS，訊息/變更只資料，顯示文字唔係 HTML。主機先清理 context，rich markup 及離線文章係另外整合。

## 儲存准入

讀寫前查全部既有組件拒絕符號連結，可用時 no-follow，檔名前驗 UUID/counter，分頁驗序號。寫 metadata 失敗保留舊檔及記憶體，清自有暫存。唔係 OS 全域鎖或敵意競爭保證，每目錄一可信 manager。`get(id, ownerId)`、`list(ownerId)`、`page(id, channel, pagination, ownerId)` 可 filter，IPC wrapper 必須總提供已認證主機 owner。
