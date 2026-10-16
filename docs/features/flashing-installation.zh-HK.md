# 寫入媒體及安裝流程

[English](flashing-installation.md) · [功能索引](README.md)

輸出檢視器有實體媒體及 ISO 客體準備嘅確切目的地流程。喺已接入輸出選檔及路線，建立兩分鐘預覽。主機解析檔案能力、檢查格式並計摘要，顯示層路徑或指令唔授權。

## 實體媒體

探索明確經原生管理員同意啟動綑綁 Windows helper，以固定 Get-Disk 列清單。USB、SD 及實體裝置共用保護：排除 boot、system、online、mounted、唯讀及身份不全，只有原本已 offline 磁碟可用。程式唔自動 unmount、offline、改主機開機設定或重啟。

檢視容量、主機身份、來源格式、長度及 SHA-256，輸入確切身份先繼續。程式原生確認之後，提升權限 helper 仲有破壞確認，預設取消。取消提升或任何確認唔係成功。

helper 同意後再核目的地，獨佔開啟，以 IOCTL 核磁碟號碼及容量，寫前再驗身份。來源保持開啟且唔分享寫/刪，先摘要再寫，只接受已識別 sector 對齊磁碟/ISO header，有界區塊寫入、flush、讀回已寫範圍計摘要。相符唔證明可啟動，映像以外位元組唔擦除或消毒。

取消合作式作用於自己操作。部分寫或讀回失敗收據仍未完成，唔好開機或使用該裝置；從獨立備份恢復，或者準備並明確確認新寫入。取消唔會恢復被覆寫位元組。請求及結果收據保存在程式本機資料供復原，唔自動刪。

## ISO 客體準備

ISO-9660 可經現有服務準備新擁有 VirtualBox 或 VMware 客體，網絡關閉。只建立安裝媒體連接，之後喺虛擬機控制建立自有空磁碟、連接、檢視硬件並明確啟動，再於客體完成安裝。狀態為 `guest-created-installation-pending`，唔報安裝成功；啟動、停止及復原沿用原有擁有權控制。

## 封裝協定

獨立 `native/flashing/MaterialBuildroot.Flash.csproj` 用 `net8.0-windows`、self-contained `win-x64` 同 `requireAdministrator` manifest。根建置負責經正常入口發佈 helper，放 `MaterialBuildroot.Flash.exe` 於 `resources/native/flashing/`，旁邊 `manifest.json` 有 `protocol: 1` 同小寫執行檔 SHA-256 `sha256`。程式每次啟動前查摘要。呢個只係封裝一致性，唔係發行者認證，執行檔仍未簽署。SDK 取得及版本由根依賴 manifest 管，唔屬此元件。

helper 只接受一個程式建立絕對請求檔參數、協定第 1 版同唯一 nonce。主機建立請求並驗對應結果 nonce，唔接受任意 shell、執行檔、script 或顯示層裝置路徑。PowerShell 只用於固定原生提升啟動及磁碟列舉，此 helper 同轉換/檔案 broker 分開。

## 交付及驗收

原來源只完成編寫，該次未編原生 helper、包括資源、封裝、批准管理員、探索磁碟、寫入、取消、讀回、準備 ISO、安裝客體、開機或驗收畫面。封裝未提供執行檔及匹配清單前，實體操作以 `FLASH_HELPER_UNAVAILABLE` 停止。唔宣稱 PH07-T07 實際驗收，亦唔喺整合前宣稱實體寫入封裝可用。
