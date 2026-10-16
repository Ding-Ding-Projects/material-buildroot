# 產品正式產出 workflow

[English](product-workflows.md) · [功能索引](README.md)

執行工作區有獨立產品建置設定，同 Linux Buildroot 工作分開。經既有 GitHub CLI 登入，選公開來源及不可變 40 字元修訂，再選同一或另一既有執行來源，由 CLI 查帳戶及寫入。私有產品來源拒絕，因呢條路唔提供所需 encrypted builder。

## Runner 及建置選擇

提供 Windows 2022 託管容量，亦探索該來源可見 Windows x64 自管 runner，離線或忙碌不可選。託管可用/費用由帳戶決定，唔係預留容量；要明確確認費用及容量，冇探索權唔虛構成功。

選 Build 或 Installer。固定模型用鎖定 checkout action 取得不可變修訂，精確執行根 `build.bat /s` 或 `build-installer.bat /s` 並傳遞退出碼。Installer 用該來源既有未簽署 Squirrel.Windows。唔產測試、lint、發行、檔案上載、派送、自訂指令或使用者執行檔路徑。入口負責必要工具，無人批准提升權限可能阻止產出，唔報成功。

## 引導及專家編輯

引導產 YAML 1.2，專家只接受同模型，可改來源、不可變修訂及 target。未知 action/鍵、任意 script、權限改變、tag、alias、anchor、重複鍵或其他文件拒絕，保留輸入。最多 64 KiB、2,000 節點、20 層。

## 預覽、匯出及明確寫入

預覽查來源可讀及目的地修訂，已有 workflow 路徑拒絕。顯示完整 YAML、runner label、來源/目的地修訂及 SHA-256，五分鐘到期；選擇三十分鐘或帳戶改變失效，編輯清預覽同確認。

匯出由原生 Save，新檔獨佔保留既有，唔寫來源 workflow 或開始執行。發佈要獨立核取，重查修訂、寫前消耗預覽、讀回結果提交精確位元組。不確定標未核實唔自動重試，檔名由內容決定。普通來源寫權唔等於 workflow 寫權。

## 驗收狀態

原文章係實作狀態，建置/封裝待協調 slot，該變更冇測試、靜態分析、操作、發佈或遠端執行。runner 探索、原生匯出、YAML 拒絕及讀回仍需後續獲准驗收，唔由後來整合推斷通過。
