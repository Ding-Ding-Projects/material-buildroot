# 受管理 container 執行環境

[English](runtime-containers.md) · [功能索引](README.md)

執行環境工作區探索 Docker Linux engine，唔啟動或者安裝程式。探索分清缺少用戶端、daemon 不可用、存取被拒絕及非 Linux engine，並列出本機映像同 SHA-256 摘要。標籤本身唔係可執行建置輸入；準備唔會拉取映像。

## 準備及建置

1. 接入可信 Buildroot 專案，選擇輸出目錄。
2. 開啟建置，揀 Docker，更新本機映像並選擇摘要鎖定映像，或者提供其摘要參照。
3. 準備保留快取。程式建立或者重用 local-driver volume，綁定專案、映像摘要、UID/GID 及 daemon 身份；使用前核對擁有權標籤、driver 同選項。
4. 提交建置，從既有佇列、工作輸出、取消及復原控制查看真實結果。

映像必須有 `/material-buildroot-cache`，由設定嘅非 root 身份擁有及可寫，桌面目前選擇 UID/GID 1000。Docker 從映像目錄初始化具名 volume。準備只證明 volume 存在同資料相符，可寫性要到建置檢查先核實。來源同外部樹以唯讀方式掛載，既有主機輸出目錄仍係目的地，保留輸出探索同現有檔案。下載使用 `DL_DIR` 保留快取。

建置 container 根目錄唯讀，臨時可寫儲存有界，冇網絡、額外能力或者權限提升，沿用 CPU、記憶體及程序限制，唔暴露主機 socket 或 privileged 模式。全部指令由主機構造，顯示層唔可以提供 shell 指令或者 volume 名稱。

## 復原及保留

daemon 拒絕連線要由擁有人或者管理員恢復正常存取。程式唔改群組、提升權限、重啟 daemon 或放寬權限，修復後重新探索。

儲存權限錯誤喺 make 開始前停止。保留 volume，透過受支援管理修正映像目錄擁有權或者輸出目錄權限，再重試。新映像摘要使用獨立快取，唔自動刪除、chmod、chown、重設、清理或者遷移 volume。擁有權缺少或不符唔會導致接管其他 volume。

取消同探測逾時只會停止操作標籤、產生名稱及 daemon 身份相符嘅確切 container ID。未有已停止證據前，工作核對繼續隔離。daemon 不可用或者 namespace 改變屬未知，唔係清理成功。

## 驗收狀態

來源於快速交付模式實作，刻意未執行 container、測試、審查、畫面、安裝及權限或生命週期驗收。路線圖執行證據仍然未完成。此流程冇新增 HTTP API。
