# 已認證狀態整合

[English](status-hub.md) · [功能索引](README.md)

可信桌面程序使用維護者本機已安裝 Status Hub JavaScript client，唔將私人訊息處理實作或憑證複製入封裝。缺少時回 `CLIENT_UNAVAILABLE`，工作區照樣可用。

## 生命週期及授權

啟動經支援 client 建立一個程序生命週期工作階段，使用程序隨機 ID 及 client 管理 session key。client 負責 HTTP、認證標頭、有界重試、訊息驗證、心跳及回覆 cursor。可用時主機報實際來源目錄清單，安裝版冇來源就如實報冇，唔虛構。關閉送 `waiting`，唔代表使用者工作完成。

`AGENT_INGEST_TOKEN` 只從可信程序設定讀取，缺少回 `MISSING_ENROLLMENT`。桌面啟動前經擁有人管理登記授權，設定變更要重開程序。client `STATUS_HUB_URL` 決定端點，顯示層唔可改端點、憑證、標題、階段、清單或傳輸選項。

## 有型別橋接

`studio.statusHub("read")` 回目前安全投影，`studio.statusHub("refresh")` 合併平行更新、發佈固定主機狀態並輪詢支援收件匣。兩者都要已獲准主框架桌面階段，未知操作拒絕。投影只含 state、有界代碼、嘗試/成功時間及認證送達布林，唔回原始傳輸錯誤、主機路徑、憑證、session key、任意收件匣或端點設定。

只有 client 記錄成功認證寫入且目前冇 degraded/error 先 `authenticated: true`，health 成功唔足夠。缺 client、缺登記及送達不可用係不同狀態。`lastSuccessAt` 只係歷史，唔將當前不可用變已連接，更新失敗唔阻生產工作。

## 驗收及剩餘範圍

來源整合本身冇新增顯示介面。實際已認證建立/更新、關閉送達、受保護 webhook、顯示事件及可見消費介面仍未核實。快速交付刻意唔測試、稽核、操作或擷取。建置收據只證明確切來源編譯/封裝。桌面 API 係 IPC，唔建立 Postman 集合。
