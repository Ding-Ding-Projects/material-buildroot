# ISO 設定組合與韌體

[English](profile-and-firmware.md) · [欄位目錄](README.md) · [ISO 工作流程](../iso-workflow.zh-HK.md)

## 用途與建議預設

呢個引導設定用嚟製作 x86-64 BIOS 光碟映像，採用 GRUB2 同初始 RAM 檔案系統。可以將韌體理解為電腦開機時讀取嘅第一份指引，開機載入器再負責載入 Linux。來源必須已啟用 x86-64 同 Linux。Easy 模式會讀取真正嘅來源，只有所需選項可以選用時先提供此設定，唔會憑空假設某個 Buildroot 版本或其他韌體已獲支援。

## 例子與限制

設定識別碼係 `x86_64-bios-grub2-initrd`。韌體用 BIOS，開機載入器用 GRUB2，檔案系統用 initrd，輸出格式用 ISO9660。此設定冇配置或驗證 UEFI 同混合 USB 啟動。核心同原有套件選擇仍由項目決定；選咗 ISO 唔代表會自動加上桌面環境。

## 復原與進階控制

任何必要選項無法使用時，Apply 會保持停用。請先選合適嘅開發板、啟用 Linux，並查看相關 Kconfig 相依條件，再重新檢查。Advanced 模式保留套件預設同完整配置編輯器。手動啟用 UEFI 唔能夠證明此 BIOS 流程支援 UEFI。

## 建議下一篇

[執行環境與資源](runtime-and-resources.zh-HK.md) · [配置與復原](configuration-and-recovery.zh-HK.md)
