# 開始使用

[English](Getting-started.md) · [Wiki 首頁](Home.zh-HK.md)

## 先行一小步

1. 閱讀[新手入門](../features/guided-documentation.zh-HK.md)。瀏覽器選擇只教你流程，唔會執行任何工作。
2. 選可信任 Buildroot 來源同獨立輸出目錄。來源好似食譜，輸出係製作檔案嘅地方；需要保留舊結果時，請分開存放。
3. 喺已安裝程式選擇並授權合適 WSL 2 發行版或已認可 Docker Linux 建置映像。Buildroot 唔會原生喺 Windows 執行，建置要用非 root 帳戶。
4. 目前 ISO 候選需要已啟用 Linux 嘅 x86-64 來源。跟住[BIOS ISO 流程](../desktop/iso-workflow.zh-HK.md)檢查條件、檢視並套用計劃，只有確認配置有效先建置。
5. 重新整理真實工作，再檢查輸出。已儲存計劃唔係成功建置。判斷不確定結果或重試前，先讀[欄位指南](../desktop/iso-fields/README.md)。

## 有乜可用，又證明咗乜？

[發佈歷史](https://github.com/Ding-Ding-Projects/material-buildroot/releases)有普通未簽署 Squirrel.Windows 安裝包，可能顯示不明發行者警告。[Build 233.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.1-build.233.1)，來源 `21bf4ad4c6e1fb19a8a48fae57cdca6d63777c6a`，已有正常安裝後啟動、About 導覽同返回工作區驗證，見[交付記錄](../../README.md)。後來 Build 234.1 發佈係另一回事，此處未證明佢已安裝。新 ISO 候選介面唔會因此變成已驗收安裝版本。

真實非 root 建置產生 12,357,632 位元組 BIOS GRUB2 ISO，SHA-256 為 `1d75d40b94e3c441aaaead9109f8074f62334931e1d84a576f3d7a36ec566dba`。未修改映像喺 QEMU 10.0.13、Cirrus VGA 同 RTL8139 啟動。Linux 6.12.9 主控台指令、暫存檔讀寫、DHCP、兩次內部閘道回覆同正常關機已通過。呢個係客體內部網絡，唔係互聯網或 LAN 證據；RAM 檔案系統亦唔證明重新啟動後資料保留。請讀[製作收據](../evidence/iso-production/README.md)同[消費端限制](../evidence/iso-boot/README.md)。

目前引導設定只適用 BIOS。UEFI、混合 USB 同 VMware/VirtualBox 驗收仍分開處理。更廣泛嘅 VMDK、VDI 同 OVA 計劃唔證明已交付行為。伴隨連線已有來源，真實配對主機 TLS/LAN 驗收仍獨立追蹤。

## 給下一位實作者

先讀[目前交接](../../HANDOFF.md)、[分階段路線圖](../../ROADMAP.md)同[分工清單](../planning/implementation-queue.json)。保留綁定來源嘅證據；依賴驗收嘅工作，喺自己嘅證據存在之前保持未勾選。[功能清單](../planning/feature-coverage.md)分開記錄桌面、文件同伴隨介面要求。目前 ISO 製作同啟動證據唔會完成無關功能或所有目標組合。
