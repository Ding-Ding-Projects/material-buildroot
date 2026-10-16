# 體驗偏好

[English](experience-policies.md) · [功能索引](README.md)

桌面經 context-action provider 及設定提供可逆逐元素鎖，係自我互動偏好，唔係安全、加密或操作授權。broker 獨立查能力，關窗及復原控制排除。

## 登記及解鎖

每穩定目標獨立政策/憑證，有 PIN、password、PIN+password、password+TOTP、PIN+TOTP、password+PIN+TOTP。精靈收有序 factors、確認、解鎖時間及聲明同意，PIN 打字同無障礙 keypad 用同提交及嘗試預算。TOTP 登記要由所供秘密產嘅目前碼。

有界主機准入 IPC 呼既有服務，password/PIN hash 及驗證秘密只入限 owner OS vault。公開狀態冇憑證值或參照，取代/移除要先用原 factors 解鎖，缺 protected storage 唔會明文保存。

程序啟動全部鎖，時間可至離開介面、指定分鐘或程序關閉，明確再鎖。攔 pointer、input、drag、keyboard、程式 click，共用指令 registry 對面板啟用、inline edit 及 picker 都查 access。解鎖唔重播待用動作，要自己再揀。

## 等候及本機支援

次數用盡由主機供單次到期挑戰並評分，通過恢復同正常等候一樣次數，唔重設 escalation，rolling hour 最多跳三次。唔授認證階段或 broker。限制模式由主機讀，不可用由算式而唔係食品開始，timed round 用主機時間及逐 hit 記錄。

Support Tickets 只本機虛構記錄，面板明示冇傳送或人閱讀。可搜尋、匯出、推進及選擇刪除。復原顯示真 app-data 路徑並開同一 file manager 位置，程式唔刪目錄。使用者手刪亦刪本機設定及憑證，先保存工作。

## 界線及延後驗收

持久身份用 `data-experience-id`、元素 ID 或唯一 composed ancestry，重複無穩定身份唔獲持久 target。完整逐元素、觸控/輔助攔截及全部顯示組合未完成，唔宣稱符合。此模式冇測試、審查、靜態分析、操作或畫面。vault、六政策、重啟/到期、stale handle、輸入路線、限制轉換及 timed 無障礙要 built 驗收。

## 設定、批次登記及歷史

Settings 搜尋 Experience 會開真流程。批次探索已登記目標逐個行，中間清憑證、每個獨立確認，可跳過而唔改。舊鎖要先用舊 factors 開，導覽及語言設定有明確穩定身份，registry 亦接受 unique ancestry/ID。歧義重複控制明示持久登記不可用，唔用列表位置冒認。

配置變更加耐久修訂，既有 bare history 只保留 allowlist：修訂、固定時間、target/policy/duration，面板最新 25。冇憑證、reference、hash、seed 或個人用詞。歷史寫唔到會報，下一修改等待保留該 revision，當前可用狀態仍保留。普通工作區 restore 唔改鎖或復活冇咗憑證。

外觀列身份含 target key、state、property。服務登記 appearance permission，save/reset/import/motion 都查政策；未有體驗狀態外觀修改不可用。政策管理獨立於原動作鎖，未鎖可再鎖，已鎖可去認證/復原。

## 本機驗證器配對

含 TOTP 精靈可重用本機 pairing，明確 reveal 同意後暫時顯 QR 及 manual key。使用者存入驗證器、明確指定元素，再輸目前碼，原 verifier 核碼先存獨立元素憑證。生成 SHA-1、六位、30 秒，符合引擎，唔登外部帳戶或 standalone 項。

只記憶體，取消、完成、改政策、斷線、隱藏、導覽或到期清。指定取消唔影響其他處理端。setup 唔入配置歷史、ticket export、log 或普通設定。複製要明確，警告 clipboard 可保留；自供 key 仍可。

唔證明 QR 掃描、互通、時差、生命週期或無障礙。本次冇真帳戶登記、測試、審查或擷取。
