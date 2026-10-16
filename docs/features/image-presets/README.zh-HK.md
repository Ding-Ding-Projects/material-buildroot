# 映像預設及目標帳戶計劃

[English](README.md) · [功能索引](../README.md)

## 預設

設定提供附加式 minimal、desktop、server、appliance。minimal 要 BusyBox，server 另加 Dropbear，appliance 加 SquashFS；minimal 唔剝走既有設定。desktop 喺所選來源語義 Kconfig 中有可指派布林符號時選 Weston、Cage 或 X.Org。X.Org 係顯示 server，唔係完整桌面 shell。

先讀能力、揀預設、預覽符號、確認再套用，沿用設定服務修訂、執行信任、協調、回復及復原。缺符號、依賴不符或過期就停止，協調可能改要求值，面板會顯示有效結果。預覽係設定計劃，唔係真桌面或者可啟動證據。

## 鎖密碼帳戶及公開金鑰

獨立面板接受非 root 小寫帳戶、2000–60000 固定 UID/GID，及原生選擇器揀單一 Ed25519 公開金鑰。key 只留主機記憶體最多十五分鐘，下次操作移除過期值，顯示層只見不透明 handle。解析器核 SSH 二進位結構，拒絕其他類型、選項、多 key 或私鑰，丟棄註解，唔回內容或路徑，唔記錄。

預覽要已選 SSH server、執行信任、目前 Kconfig 語義、三個字串設定、來源 users/permissions 實作及 manual 檔、預設 skeleton 帳戶資料庫。綁定來源摘要、設定修訂、現有表內容、執行路徑映射及帳戶選擇。現有表同名或 ID 衝突、overlay 含 home 或身份資料庫就停止。未支援變數路徑、授權根外、自訂 skeleton、缺檔或路徑映射都唔猜測。

確認後再核計劃，喺授權輸出新建唯一目錄，獨佔保留既有資料。內有密碼鎖 `!` users table、home overlay `.ssh/authorized_keys`，以及 home/`.ssh` 為 0700、key 為 0600、指定 UID/GID 嘅 permissions table。附加至 `BR2_ROOTFS_USERS_TABLES`、`BR2_ROOTFS_OVERLAY`、`BR2_ROOTFS_DEVICE_TABLE` 再協調，唔取代檔案或清單。協調失敗保留生成檔供復原，設定服務還原先前設定，有效值不符明示未完成。

支援既有 container `/source`、`/output` 及授權外部掛載，WSL 要明確 Linux 來源/輸出儲存路徑，其他映射不支援。只準備 target 輸入，唔建主機帳戶或即時 target，唔產私鑰或收密碼。密碼登記未提供。SSH 實作嘅鎖帳戶行為不同，真登入、映像帳戶、shell 及擁有權要喺真 target 核實。套件帳戶衝突仍由 target build 負責。

依據 [Buildroot manual](https://buildroot.org/downloads/manual/manual.html) 第 9.5、9.6、25、26 節，所選來源不同時仍以實際能力檢查決定。

## 驗收狀態

快速交付冇測試、靜態分析、執行或畫面，冇 target build、配置帳戶、建主機帳戶或 SSH 登入。桌面證據、目標帳戶/認證、安全密碼登記及實際驗收仍未完成。
