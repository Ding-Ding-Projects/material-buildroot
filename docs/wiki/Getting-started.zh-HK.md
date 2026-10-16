# 從計劃開始

[English](Getting-started.md) · [Wiki 首頁](Home.zh-HK.md)

## 給使用者

預期流程係選擇開發板或者虛擬機預設、Linux 建置環境、設定系統、建置再匯出映像。引導同專家操作都屬要求。

首個桌面目標係 Windows x64；Buildroot 喺 WSL 2 或 Docker Linux container 執行。首批客體目標係 x86_64 VMware Workstation 同 VirtualBox，包含 BIOS 及 UEFI 預設。規劃輸出有可啟動 ISO、VMDK、VDI 同 OVA，格式列出唔等於已驗證可啟動。

[發行歷史](https://github.com/Ding-Ding-Projects/material-buildroot/releases)提供普通 Windows 安裝包，使用未簽署 Squirrel.Windows，可能顯示不明發行者警告。建置及發行證據同安裝、更新及執行驗收分開，後者仍未完成。此輪刻意延後測試及畫面擷取；伴隨連線已有來源，實際配對主機驗收分開追蹤。

閱讀[完整計劃](../../PLAN.md)、[決定記錄](../../DECISIONS.md)同[分階段路線圖](../../ROADMAP.md)。文件按標示記錄要求或者建議，唔係已執行證據。

## 給下一位實作者

先讀[目前交接](../../HANDOFF.md)。此輪每個未完成路線圖葉節點分配一位獨立實作者、分支同工作目錄，再將已完成貢獻整合至 `main`。分配以[清單](../planning/implementation-queue.json)為準，驗收依賴工作延後時保持未勾選，阻礙要保留明確交接。

[功能清單](../planning/feature-coverage.md)除 Buildroot 專用流程外，映射 109 個身份及 436 個介面記錄。每個適用桌面、文件及伴隨連線介面都需要獨立驗證。
