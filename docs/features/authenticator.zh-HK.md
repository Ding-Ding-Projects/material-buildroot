# 本機驗證器及配對

[English](authenticator.md) · [功能索引](README.md)

Authenticator 目的地提供本機 TOTP 登記及驗證碼，經既有工作區目錄/指令 provider 導覽。唔連帳戶服務、同步或網絡校時。

## 登記

貼 `otpauth://totp/` URI，或者輸入 base32、issuer、account、SHA-1/SHA-256/SHA-512、6–8 位及 1–86400 秒週期。保留 URI 值，拒絕重複/不支援欄、HOTP、無效編碼及 issuer 衝突。秘密輸入有界，唔出診斷。

明確同意臨時顯示再「檢視配對」。主機用固定 `qrcode` 1.5.4 產矩陣，本機 canvas 四 module 靜區，兩主題都黑白。冇 QR 服務、網絡圖、磁碟圖或者 data-URL 匯出。旁邊列分組 base32、精確 algorithm、digits、period；手動複製警告系統 clipboard 可能保留。

輸入一個目前碼完成，待用五分鐘、最多五次失敗，確認前唔保存。取消、離開或隱藏清顯示層臨時狀態，已加密秘密冇 reveal API。

圖片/clipboard-image 匯入只喺平台有 `BarcodeDetector` 時用，最多 10 MiB、解碼 16 百萬 pixel，精確接受一個 TOTP QR。沿用桌面權限，冇偵測或 clipboard 權限就顯示不可用，URI/手動仍可用。未實作 camera，冇加 camera 權限。

## 記錄及保護儲存

項目顯示分組目前碼、複製、文字倒數及明確下個碼開關，搜尋沿用文字/正則。可排序、群組、批次刪或分組，issuer/account/短文字或 emoji icon 可編但唔改秘密/參數。資料匯出明示排除秘密及驗證碼，冇刻意秘密匯出。

桌面 IPC 有界依序，回固定診斷；每秘密由限能力主機 vault 管。索引及獨立只增不改歷史只存展示資料及不透明 vault 參照。歷史管理器用 vault 保護獨立密碼 verifier、salted scrypt、五分鐘解鎖，五次錯後延遲三十秒。可分頁修訂、搜尋、遮蔽比較、加標籤、匯出遮蔽版本，明確確認及目前修訂核對後還原。改密碼要目前加確認新值，之後再鎖。

密碼導出非同步，改狀態前再次核獲准文件 generation，導覽撤銷配對同歷史權限。還原核所有引用加密記錄可讀，再建新修訂；歷史回覆冇 vault 參照或秘密。刪項仍保留加密歷史供復原，唔係安全擦除。歷史寫失敗阻止資料修改；缺少或不安全 vault、無效既有索引會拒絕，唔重設。歷史寫後索引寫失敗要復原先再修改，舊索引保留。

計碼依 RFC 6238 時間 counter 及 RFC 4226 dynamic truncation，只用裝置時間，明示未獨立驗時，偵測本機時間跳變會報告；冇外部可信參考唔能發現固定時差。同程式內驗證器用於本機體驗鎖只係裝飾性，目的地明示。

## 整合 API

`studio.authenticator` 提供獲准 `status`、`begin`、`generate`、`confirm`、`cancel`、指定 `cancelPairing`、`codes`、`remove`、`organize`、`edit`、`bulkGroup` 同密碼保護資料歷史。`generate` 明確同意 reveal 後供本機 factor 產臨時隨機登記，唔自動保存項目。最多八個臨時配對共存，處理端只取消自己 ID。共用 `authenticator-pairing` 只接臨時回覆畫矩陣，取消、過期、導覽或完成要清。鎖處理端要驗輸入碼先啟用 factor。

## 驗收及剩餘工作

只有來源，測試、靜態分析、獨立審查、操作及畫面刻意延後。RFC 向量、掃描互通、倒數轉碼、vault 重啟保留、無效資料、無障礙及窄版面未核實，未來編譯唔會代驗。

仍欠窄權限原生 camera、冇 `BarcodeDetector` 平台 decoder、歷史清理及經獨立確認嘅刻意秘密匯出。冇密碼復原，遺失歷史密碼只鎖歷史管理器，普通項目仍可用。共用配對畫面嘅本機鎖整合有獨立擁有人，要連指定取消 API 一齊整合。全部實作及驗證缺口解決前唔勾完整驗證器驗收。

## 來源及套件

- [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238)：TOTP 及公開向量。
- [RFC 4226](https://www.rfc-editor.org/rfc/rfc4226)：dynamic truncation。
- [node-qrcode](https://github.com/soldair/node-qrcode)：固定 1.5.4、MIT，可信主機用本機矩陣 encoder；lockfile 有 registry integrity，準備時冇 lifecycle script。
