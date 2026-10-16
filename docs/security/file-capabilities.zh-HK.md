# 原生檔案能力

[English](file-capabilities.md) · [安全索引](README.md)

原生對話取得只限工作階段嘅檔案權限，顯示層路徑唔建立 grant。專案 grant 為綁 owner 隨機 ID、五分鐘到期、讀或讀寫。可信主機匯入 adapter 可用 `importFile` 發唯讀單檔 grant，唔公開顯示層。專案目錄及工具輸入/輸出仍由原生對話取得。

每次取得/解析檢查 volume root 同全部現有組件，記 dev/inode/birth 並比原生精確 real path。拒絕符號連結、轉向其他位置 junction、hardlink 檔、特殊檔、大小寫 alias、network/device path、Windows 保留名及結尾點/空格 alias。父目錄或目標被換就失效，變更專案 grant 撤銷。新輸出要已有受檢父目錄，唔覆寫。

主程序 `translate` 先解析 grant 再呼可信轉換器，之後再解析及比受檢物件。只接受正規絕對 POSIX，冇控制字、反斜線或雙開頭斜線。轉換器係主機函數，唔係 renderer code 或指令字串。既有執行 adapter 自己管理 WSL/container 映射，呢個唔加新環境或 shell。

## 限制及延後驗收

路徑檢查唔係作業系統 handle-relative 沙箱，外部程序仍可喺解析後、以路徑開檔前競爭。處理端要用前即解析、輸出獨佔建立並保留執行准入。保留原生路徑/身份嘅未知 reparse 要原生 handle 檢查先可作更強聲明。

快速模式刻意延後測試、靜態分析、獨立審查、操作及畫面。PH02-T03 未核實，包括原生 Windows reparse/大小寫及非同步轉換。
