# 元件設定範疇

[English](configuration-domains.md) · [桌面索引](README.md)

設定工作區分開選擇 Buildroot、Linux、BusyBox 同 U-Boot。切換清除載入值同 defconfig 結果，未儲存修改要先套用或者捨棄。檢視、有型別套用、defconfig 探索、套用及復原都將所選範疇傳往主機。

## 真實元件探索

主機經已授權執行環境，以固定非 root Buildroot `printvars` 讀 `LINUX_DIR`、`BUSYBOX_DIR` 同 `UBOOT_DIR`，唔接受顯示層路徑、shell 片段、目錄猜測或者模擬結果。目錄必須係所選輸出 `build` 嘅直接子目錄，只有已啟用及準備好、設定、入口及 Makefile 都係普通檔案嘅元件可用。舊式非 Kconfig U-Boot 不可用，探索唔解壓或者下載。

修訂綁定所選範疇、解析後來源及輸出、元件目錄身份、入口、Makefile、上層 Buildroot 設定及元件 `.config`。協調前重新探索，綁定改變就拒絕。各範疇沿用序列交易、回復、要求/有效值差異及有界復原。元件來源及輸出可以同一準備目錄，Buildroot 本身仍要獨立根。

## 協調及語義

主機只派送 `linux-olddefconfig`、`busybox-oldconfig` 或 `uboot-olddefconfig`，配上對應固定 `*_KCONFIG_EDITORS` 覆寫，由 Buildroot 套件 Kconfig 編輯機制負責修正及失效重建戳記。BusyBox 經固定 `yes` 管線接收空白預設答案，唔執行顯示層輸入。操作可能改 `.config` 以外產生檔案及戳記，交易回復只還原 `.config`，唔宣稱復原全部上游影響。

目標依據 [Buildroot 2025.02.1 Kconfig 基礎設施](https://github.com/buildroot/buildroot/blob/2025.02.1/package/pkg-kconfig.mk)。舊版或者不支援目標如實失敗，來源 Make/Kconfig 必須已可信。

適配器對 Linux/U-Boot 用 `Kconfig`、BusyBox 用 `Config.in`、`CONFIG_` 前綴及實際 Buildroot 架構。原生安全解析唔執行 shell 巨集；權威執行環境適配器經明確來源執行同意接通，唔代入合成符號，有型別編輯需要語義可用。Linux defconfig 來自 `arch/<SRCARCH>/configs`，其他範疇有目錄時用 `configs`，缺少就回空清單。架構別名目前涵蓋 x86 及 AArch64，其他識別符原樣保留，不支援佈局仍不可用。

## 來源專用執行權限

`config.trustPreview`、`config.trustGrant` 同 `config.trustRevoke` 由主機提供。預覽擷取實際來源與設定位元組、根身份、啟用外部來源順序及執行環境，畫面顯示精確範圍，必須明確核取先提交不透明挑戰 ID。揀目錄或執行環境唔授權執行。

元件分兩階段：目前 Buildroot 來源/設定權限先容許固定探索，第二個預覽再列出及雜湊元件來源/設定。挑戰五分鐘失效，接受權限喺本次程序最多十五分鐘；來源、設定、根身份或執行環境改變都要再確認。撤銷清除權限及挑戰，唔跨重新啟動保留。

主機喺固定解譯傳輸前、中、後重算准入。冇執行權限時安全原生解析仍係備用，每次修改亦獨立要求目前範疇權限。畫面說明 WSL 來源指令擁有所選帳戶存取；container 檢視則唯讀掛載及冇網絡。設定協調係獨立可寫操作，檢視唔係敵意來源沙箱。

內容擷取仍受項目數、位元組同時間界限。只綁連結文字嘅舊主機收據不足授權linked Kconfig來源。目前原生WSL路線要更強namespace、referent內容同identity檢查成功先接納連結，見[原生WSL內容意圖](../security/native-wsl-content-intent.zh-HK.md)。超限或檢查失敗保持不可用，唔會暗中擴大信任。執行檢視參與取消及原有復原日誌，記錄實際程序擁有權；未核實清理保留收據。顯示層唔可傳指令、執行檔、環境映射或根路徑。

## 驗收狀態

此輪只有來源實作，未執行測試、靜態分析、實際操作或畫面擷取。WSL/container 探索、協調、平台競爭、上游影響及控制仍未核實。權威 Kconfig 傳輸已接線，正式建置分開記錄；唔代表全部元件版本相容或者重啟後歷史保留。

## 由ISO指南核對權限

權限只回答一個問題：可唔可以讓所選來源喺此執行環境執行配置檢視指令？佢唔係ISO建置結果。來源資料夾好似一份亦可包含可執行步驟嘅食譜，批准前要知道來源由誰提供，同邊個帳戶會執行。

1. 喺ISO指南選 **Review source execution permission／核對來源執行權限**。Configuration工作區會開同一工作區、Buildroot範圍嘅 **Source execution permission／來源執行權限** 區段。只開畫面唔授權。
2. 閱讀 **Review exact scope／核對確切範圍** 同顯示嘅來源、配置、外部來源次序、runtime。選錯時可以唔批准就返回。
3. 勾選 **Allow execution of this exact source revision in this runtime for configuration inspection and reconciliation.／批准喺呢個執行環境執行呢個確切來源修訂，用作檢視同協調設定。** 再按 **Allow this scope／批准此範圍**。只勾選唔係批准，主機要接受目前challenge先可報成功。
4. 讀權限結果，再按 **Return to ISO guide／返回 ISO 指南**。指南獨立檢查ISO相容性；批准唔會配置映像、排入建置或證明語義檢視可用。
5. 範圍改變或到期，選 **Review current scope again／重新核對目前範圍** 核對新資料。舊勾選唔授權另一來源或runtime。

Linux、BusyBox或U-Boot要分兩次批准。第一次針目前Buildroot來源／配置，只容許固定component discovery。第二次review先列實際發現嘅component來源／配置，再授component執行權限。欠元件或未準備好仍不可用，discovery唔下載或準備佢。

**Revoke configuration permission／撤銷設定權限** 會清除整個所選工作區嘅權限同pending challenges，唔只係畫面上嗰個component。權限只屬本次session，最多十五分鐘，綁定來源／配置／root／runtime改變就失效；pending challenge五分鐘到期。

## 分開理解語義不可用

`KCONFIG_SEMANTICS_UNAVAILABLE` 表示該次檢視未取得可用權威Kconfig語義，單憑呢個結果唔代表權限仍未批。權限結果同檢視結果要分開讀。批准唔會憑空提供interpreter、有效source environment或完成inspection，唔好由permission訊息標配置或ISO成功。

候選 `37571d3` 嘅原生觀察中，開review、勾checkbox同按 **Allow this scope** 成功，畫面報permission approved；自動ISO recheck仍回 `KCONFIG_SEMANTICS_UNAVAILABLE`。之後renderer喺 `2026-10-18T09:25:32.580Z` 以 `0xC0000005` 退出，未確立source cause。後來原本打算做嘅 `inspectConfig` 冇執行，因 `Runtime.enable` 逾時。呢個先後次序唔證明permission或inspection造成退出，未執行操作亦冇結果。請讀[renderer退出診斷](renderer-exit-diagnostics.zh-HK.md)了解收據限制；唔推斷任何復原指令、native修復成功或ISO成功。
