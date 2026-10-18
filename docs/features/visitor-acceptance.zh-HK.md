# 訪客驗收同窄畫面導覽

[English](visitor-acceptance.md) · [文章目錄](README.md)

完整瀏覽器驗收流程會透過真正 New tab 目錄開啟訪客工具，確認面板可見先操作。備份匯入會完成真實兩個核取方塊同鍵盤滑桿確認。伴隨協定測試資料會先驗證 HTTP 喺傳送 challenge 前已被拒絕，再使用明確攔截嘅 HTTPS 文件來源，以建成檔案同目前 browser-bound session／public-projection schema 作後端。呢個固定測試環境唔係真實 TLS 或 LAN 驗收。

喺320 CSS像素，獨立導覽同active-tab按鈕之前保留無界限、唔換行嘅Material標籤。量度到文件寬523像素，超過320像素viewport。目前限定窄畫面樣式會限制呢啲控制並容許完整標籤換行，同時保留最少48像素高度。冇用全頁overflow裁切去隱藏內容。

驗證會分清inventory metadata title同content heading：冇H1嘅文章可以用path作browser title，而正文合法地由H2開始。瀏覽器中繼資料同真正Markdown渲染來源標題都會檢查。

確切build、重複geometry量度同full browser結果另外記錄。本機served build同synthetic companion fixture唔證明公開部署、實體手機、可聽聲音或原生桌面操作。
