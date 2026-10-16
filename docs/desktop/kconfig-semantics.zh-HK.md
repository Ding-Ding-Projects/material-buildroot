# Kconfig 求值及來源信任

[English](kconfig-semantics.md) · [桌面索引](README.md)

綑綁 Kconfiglib 14.1.0 仍由 `scripts/configuration/vendor/provenance.json` 檔案摘要鎖定，提供求值後選單、符號、choice、範圍、依賴及可見性資料。來源原生設定目標仍係協調依據，解析樹唔保證相容全部目前 Linux 版本。

## 安全主機檢視

`createKconfigAdapter({pythonExecutable, admitted:true})` 用明確選定 Python 執行固定綑綁 helper。預設唯讀模式拒絕子程序及已授權樹以外讀取，需要指令展開來源會不可用，唔虛構巨集結果。兩種模式都停用來源 Python 函數模組。

## 可信 Linux 執行環境

主機專用另一構造器為 `createKconfigAdapter({executeInspection, resolveAdmission, timeoutMs})`，兩個回呼都唔公開到 IPC。`resolveAdmission(roots)` 要解析目前主機權限並回覆以下資料。

```json
{
  "sourceTrusted": true,
  "runtime": "wsl2",
  "admissionId": "host-owned-authorization-id",
  "sourceRevision": "source-content-revision",
  "configRevision": "configuration-content-revision"
}
```

另一支援值為 `docker`。授權必須綁定執行環境、來源、輸出及全部啟用外部樹，內容或執行權限相關變更就失效。單一路徑或 HEAD 唔足以代表有修改來源，發出權限前要明確信任來源執行。

`executeInspection` 收固定 `inspect-kconfig-v1`、授權 ID、執行環境 ID、已驗證請求、綑綁內容及 `AbortSignal`。bundle 帶實際 helper/解析器 Base64 位元組、SHA-256 及版本。請求包含已授權來源、輸出、外部路徑、Kconfig 入口、前綴、環境及綁定，唔包含執行檔或顯示層 shell 指令。

傳輸要再驗授權，將全部路徑及環境路徑值轉為所選 Linux 路徑，喺專用臨時目錄物化並驗證相同 bundle，只以 `-I -B` 啟動固定 Python helper，標準輸入送請求。程序擁有權、後代取消、輸出上限及清理要用既有受驗生命週期。回傳解析 JSON，非零及格式錯誤要傳遞，並尊重取消。適配器預設等 30 秒，可設 100–120000 毫秒，最多 16 MiB JSON；傳輸收集期間就要限制，唔係收晒先查。

可信求值係來源執行，唔係 Python 沙箱。Linux Kconfig `shell` 巨集會執行可信來源指令，所以啟用前要非 root Linux 程序及來源專用綁定。隔離及檔案存取由主機負責。helper 本身唔寫設定，但來源指令可有該執行環境允許副作用，只授予所選來源真正需要存取。

回覆要回傳相同授權、來源及設定修訂，完成後主機再讀權限，改變就拒絕。`evaluationMode` 分 `read-only-host` 同 `trusted-linux-runtime-v1`，`reconciliationAuthority` 明示 `source-native-conf-required`。Kconfig `info` 同 JSON 協定分開，保留為有界診斷。不支援語法、缺工具、環境不可用或信任被拒絕都係不可用，唔係成功替代。

## 傳輸及剩餘整合

helper 可信模式及固定傳輸位於 `src/main/execution/kconfig-inspection.cjs`。主機構造 `createKconfigInspection({execution, resolveContext, onOwnership})` 並將回呼傳入 `executeInspection`。context resolver 只收授權 ID，回現有執行 grant、已接入環境、確切範疇來源/輸出及同 `resolveAdmission` 相同綁定，每次重算內容修訂。元件可喺輸出樹內，但根配對必須符合探索記錄；外部根亦要完全符合目前 grant。

傳輸啟動前及完成後核對根身份及准入。Docker 使用摘要鎖定映像、非 root 身份、唯讀來源/輸出/外部掛載、冇網絡、唯讀 container 根及專用臨時檔案系統。WSL 使用已授權發行版、非 root 預設帳戶及現有檔案權限，唔係 container 沙箱。兩者都要 `python3` 同 `setsid`，缺少會明確失敗，唔自動安裝或者切換。

固定啟動器查核 bundle 位元組、有界串流、內部 30 秒期限，執行來源前回報程序身份。WSL 取消先驗 boot、PID namespace、PID 開始時間及程序群組，Docker 則查操作標籤及 daemon。可選擁有權回呼容許主機喺解析器收到輸入前寫耐久收據，未驗擁有權唔會取消。

本文章原始實作收據仍列工作區授權接線為必要條件；目前桌面接線狀態另見[元件設定範疇](configuration-domains.zh-HK.md)，唔由舊收據推斷新版本驗收。原有設定服務仍保留先前設定、檢查衝突、執行固定原生協調，失敗還原。可信檢視唔取代交易寫入。

## 驗收及官方參考

原實作未執行 WSL、Docker、解析器、測試或實際驗收；現代來源相容及正式傳輸仍未核實。

- [Linux Kconfig 巨集語言](https://cdn.kernel.org/doc/html/latest/kbuild/kconfig-macro-language.html)
- [Kconfiglib 上游](https://github.com/ulfalizer/Kconfiglib)
- [Linux Kconfig 語言](https://kernel.org/doc/html/latest/kbuild/kconfig-language.html)
