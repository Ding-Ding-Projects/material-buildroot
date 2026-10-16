# 共用模式、專注控制及旁白

[English](shared-modes.md) · [偏好索引](README.md)

「專注及旁白」提供五個獨立便利控制，全部預設關閉並保留喺目前本機設定。Focus 勾出活躍面板/記錄/章節，移除非活躍 elevation 而唔減文字對比。Low stimulation 移除動態並減弱已探索 open shadow root 重點色，包括動態掛載，系統減少動態獨立遵守。只有明確非必要 routine 通知隱藏，警告、決定及未分類仍顯示。Time awareness 喺工作列顯示階段經過及離上次輸入時間。One thing at a time 保留使用者下一步文字。Momentum 喺二十分鐘冇互動提供非阻塞提示，略過一小時保留。重設回預設，唔作醫療聲明。

共用偏好登記仍係依據。未知或啟用共用狀態強制英文、隱藏旁白語言自訂同食品目錄，套用英文前取消排隊旁白。用已登記憑證離開後可恢復個人語言，唔取代或放寬登記、vault、修訂及復原。

## 旁白

明確開啟先講，英文及香港粵語分開 voice picker，預設自動。讀實際平台 voices，訂閱延後列表，身份用 `voiceURI`。所選 voice 消失仍保存選擇，標示目前 fallback；network voice 有標示，離線跳過。冇該語言 voice 就明示能力缺少，唔虛構。

rate 0.1–10、pitch 0–2，預設皆 1，雙語依序英文再粵語。sample、pause、resume、stop 操作平台隊列。模式及已獲准操作事件只講固定本地化句子，分類 cooldown 及有界序列隊列。序號拒絕重複或舊事件，事件內容同 ID 唔入語音。失敗、中斷及部分操作用 error 類，唔受普通 cooldown。下一步自填、憑證、記錄、路徑、任意 DOM 或受保護內容唔會讀出。

低刺激會靜音但保留 enabled 選擇。觀察 live region 改變會保守暫停三秒，唔讀該內容，重複會延長，唔解除手動暫停。呢個係共存，唔係偵測 screen reader。元件卸載會清 root observer 同 speech 訂閱。

## 歷史及轉移

每次儲存喺獨立 attention namespace 排隊遮蔽快照，重用程式 bare Git 歷史。待用隊列本機持續保留並按序重試，失敗顯示待保留並停止再改，唔報已完成。每頁 25 修訂，還原追加新快照，唔改歷史。

JSON 匯出/入只轉模式開關、旁白 enabled、語言、rate、pitch，排除任意下一步、voice ID 及 snooze 時間；呢啲本機值喺匯入/還原保留。整份有界 schema 先驗，未知鍵及大於 2048 位元組拒絕，成功匯入建新歷史。受保護共用模式隱藏匯入及還原。IPC 只固定歷史動作/有界快照，唔提供路徑或指令。

## 排程

原語言/主題/profile 流程保留，原生排程服務負責 timezone、DST、跨午夜、確定優先及基底還原，唔建競爭 timer 或將臨時值存為基底。專注及旁白目前只係本機偏好，唔係新排程欄位。

## 公開食品目錄

只從公開 `Ding-Ding-Projects/dim-sum-photos` 取名稱，只准已發佈 `catalog-v1` release volume 相符 PNG，缺相片明示，唔將資料/圖複製來源亦唔生成代替圖。

主機固定 HTTPS、有界回覆、12 秒 timeout、一次一個目錄請求及一分鐘重試。相片轉址只准 release delivery hostname，顯示層唔可提供 URL/路徑。成功圖片可快取於程式資料，帶來源/目錄修訂，寫失敗唔宣稱離線。目錄 metadata 只留記憶體，所以全新離線啟動即使有圖片仍會報目錄不可用。

每次合資格啟動主機只抽一次，成功率十份一。只有載入已儲存完成 setup 且未有互動先要求；School mode 同 quiet mode 抑制。延後回覆遇互動、限制變更或拆卸即丟。可選展示八秒自關，唔搶焦點唔延誤生產工作，冇 surprise opt-out 設定。

## 驗收及剩餘覆蓋

只建置交付，實際 voices、重啟、輸入、版面及無障礙未核實，正式建置有自己來源收據。以下保持未完成：封閉 shadow/第三方冇 DOM 不能樣式化；靜音要明確 routine 分類，唔猜文字；冇自動 screen-reader 偵測，live-region 共存未驗；其他事件要自己固定句映射，唔讀任意狀態；host append 成功同本機 ack 之間中斷可重複追加遮蔽快照，保留舊歷史但跨重啟未去重；共用幽默樣式、逐控制說明及完整設定搜尋仍欠；目錄 metadata 離線 cache、40 個篩選結果之後分頁及完整互動仍欠；每個更新及特殊啟動都抑制 surprise 嘅證據仍欠；timezone/DST 優先及受保護模式轉換仍需來源綁定實際驗收。
