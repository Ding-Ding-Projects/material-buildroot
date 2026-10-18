# 常見問題

[English](FAQ.md) · [Wiki 首頁](Home.zh-HK.md)

## 而家可以下載 Material Buildroot 嗎？

[發行歷史](https://github.com/Ding-Ding-Projects/material-buildroot/releases)有普通未簽署 Squirrel.Windows 安裝包。請選擇實際發行，閱讀附加檔案同來源資料。單憑封裝已發佈唔係安裝證據。[Build 233.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.1-build.233.1)，來源 `21bf4ad4c6e1fb19a8a48fae57cdca6d63777c6a`，另有正常安裝後啟動同 About／工作區導覽驗證，記錄喺[交付界線](../../README.md)。Build 234.1 發佈唔證明佢已安裝。目前 ISO 候選介面仍需自己嘅原生發佈驗收。

## Buildroot 直接喺 Windows 執行嗎？

桌面程式以 Windows 為目標，Buildroot 本身喺 WSL 2 或 Docker Linux 執行。已有逐項目環境選擇同真實 WSL/Docker 檢查。完整非 root BIOS GRUB2 ISO 建置亦已成功，見[製作證據](../evidence/iso-production/README.md)。呢個結果唔證明每個環境、重新啟動或目標組合。參閱[專案流程](../features/projects/project-workflows.zh-HK.md)同[執行環境設定](../features/execution/setup.md)。

## 只係輸入命令列選項嘅表格嗎？

唔係。要求設計包括有型別控制、引導設定、依賴說明、套件及 overlay 編輯器，同適合嘅鍵盤可操作畫布。專家終端係補充，唔代替呢啲工作流程。

## 支援 VMware 同 VirtualBox 嗎？

兩者仍係必要客體目標，各有驗收要求。目前已示範嘅 BIOS ISO 消費端係 QEMU 10.0.13 配 Cirrus VGA 同 RTL8139，唔係 VMware 或 VirtualBox 驗收證據。未修改映像到達 Linux 6.12.9、接受主控台指令、讀寫暫存檔、取得 DHCP、連到內部閘道同正常關機。初始 RAM 檔案系統係暫時性嘅。其他 QEMU 組合有已保留嘅顯示、驅動或早期核心限制。請讀[確切啟動證據同限制](../evidence/iso-boot/README.md)。

## 瀏覽器伴隨連線可用嗎？

來源已實作可選 HTTPS 桌面服務及瀏覽器流程，使用明確配對、精確來源、原生主機審批、有限範圍工作階段同 CSRF 保護。真實配對、TLS 及 LAN 驗收仍未完成。文件網站唔自帶主機權限，要經另外設定及批准嘅連線。連接前閱讀[協定及私隱](../security/companion.md)同[API 指引](../postman/api-workflow.zh-HK.md)。操作收據唔代表受委派建置已完成。

## 點樣追蹤完成狀態？

[路線圖](../../ROADMAP.md)係依據，每個核取項目需要該工作及階段指定證據。發佈計劃唔等於完成程式，網站顯示來源控制狀態，訪客唔可以代貢獻者勾選。

## 邊啲決定仍然未確定？

請讀[決定記錄](../../DECISIONS.md)了解雲端目的地、遠端目標及寫入媒體流程。來源實作分別見[雲端](../features/cloud-destinations.md)、[遠端執行](../features/remote-runtimes.md)同[寫入及安裝](../features/flashing-installation.md)。執行及平台限制仍明確保留，有決定或者有適配器唔等於已驗收。
