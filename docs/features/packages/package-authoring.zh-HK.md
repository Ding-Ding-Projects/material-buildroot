# 套件編寫及來源編輯器交接

[English](package-authoring.md) · [套件索引](README.md)

## 開始草稿

開啟已接入專案「套件編寫」，選已準備及授權 `BR2_EXTERNAL`，或者用外部樹流程初始化空目錄。選樹寫入同啟用於建置係獨立操作。

型別編輯器支援 `generic`、`autotools`、`cmake`、`meson`、`cargo`、`go`、`python` 固定壓縮來源資料：名稱、版本、直接 HTTP(S) 壓縮檔網址、basename、首頁、說明、授權表達式、授權檔、建置依賴及 `BR2_` 條件。Python 另選支援 setup type。來源/首頁唔可有憑證、query 或 fragment，來源網址尾要符合檔名，唔推斷工具鏈依賴或求值 Kconfig。

GNU Hello 例子會取代草稿但刻意留空摘要，要為來源同每個授權檔提供實際 SHA-256 或 SHA-512。編輯器唔下載或虛構摘要，目前授權檔只接受 basename，唔係巢狀路徑。

## Patch、選項及檔案操作

| 控制 | 支援行為 |
| --- | --- |
| 有序 patch | 最多 64 個 HTTPS 網址，可上移、下移及刪除，按序產生 `_PATCH`，由 Buildroot 之後套用；編輯器唔下載或執行，未有本機 patch 上載及摘要產生 |
| Configure 選項 | Autotools/CMake/Meson 最多 64 行固定選項，產生 `_CONF_OPTS`；每個最多 512 字元，唔含空格或 shell expression，其他基礎設施拒絕非空選項 |
| 有序 hook | 最多 64 個結構化 `copy` 或 `mkdir`，時機為 `PRE_CONFIGURE`、`POST_CONFIGURE`、`PRE_BUILD`、`POST_BUILD`、`POST_INSTALL_TARGET`，畫面次序決定同階段登記，階段間次序由 Buildroot 決定 |
| Overlay 映射 | 最多 64 個已存在外部樹檔案至不同 target 目的地，明確三位八進制權限 `000`–`777`，喺其他檔案 hook 後產生 post-install target hook |

hook 來源相對解壓後建置目錄，目的地同樣相對該目錄，只有 `POST_INSTALL_TARGET` 相對 target 檔案系統。`copy` 固定產生 `$(INSTALL) -D -m`，`mkdir` 用 `$(INSTALL) -d -m`，唔接受自由 shell。generic 唔獲自訂建置命令，未支援語法要用來源編輯器，再獨立信任建置。

overlay 來源相對外部樹，目的地相對 target，唔帶開頭 `/`，例如 `board/demo/banner.txt` 至 `etc/banner.txt`，`644`。來源必須已存在且可安全讀，內容摘要及身份納入預覽修訂；Apply 重算時來源改變會失效。但唔係將檔案複製到凍結建置輸入，之後外部變更唔喺保證內。

路徑只容許字母、數字、底線、點、加號、連字號及斜線，拒絕空、絕對、穿越同以連字號開頭組件。權限只描述 target 操作，唔改主機來源權限。

## 預覽、同意及套用

選「預覽產生檔案」，逐份看前後內容同權限，再明確批准套用。修改會失效預覽及同意，Apply 寫前再核外部樹修訂及產生內容摘要，沿用已授權樹、安全路徑、根鎖及回復。回復失敗標未完成，唔報成功。

產生 `Config.in`、`.mk`、`.hash` 及父外部樹 include。帶結構化擴充欄位亦產生 `material-package.json`，記第 1 版 schema、外部樹名及保留重匯入模型。刪晒列表後仍保存空列表，唔留過期資料。套用唔啟用樹、執行 recipe、驗證相容或保證建置成功，來源信任同提交建置分開。

## 探索及保留現有 recipe

展開「探索及匯入來源套件」，讀已接入來源同授權外部樹聲明及原始位元組。只靜態讀，唔執行 make，原有目錄、大小及穿越上限照用。

只有可逐位元組再產生原檔先可匯入型別編輯器。先驗結構資料，再比較新內容；額外檔案、不支援語法、會丟失嘅註解或格式及外部修改都阻止自動往返，原檔仍可唯讀或手動編輯。匯入取代草稿前要同意，寫入仍要新預覽及 Apply。

## 開啟已安裝編輯器

主機只查已知 Notepad、使用者/全機 Visual Studio Code、Notepad++ 安裝位置，回普通執行檔，唔接受任意執行檔或命令列。目前只探索 Windows，其他主機回空列表，裝喺其他位置亦唔會找到。

喺已檢視套件檔旁選編輯器再開啟。主機重新探索、核匯入修訂、檔案摘要及路徑，唔經 shell 啟動。支援 `.mk`、`.in`、`.hash`、`.patch`、`.json`、`.txt`、`.sh`、`.conf`，不分大小寫。只報程序啟動，唔代表完成編輯或儲存；存檔後先更新探索，再匯入或交接。

## 設定及失敗復原

控制唔可設定任意主機編輯器路徑或指令，操作由草稿、外部樹、快照及已探索編輯器組成；執行信任、輸出及外部樹啟用沿用獨立設定。

- patch URL、選項、路徑、重複 overlay 目的地或者 mode 無效會停止預覽，修正再預覽。
- overlay 檔缺少或不安全，要授權及揀正確樹，再修相對路徑。
- `REVISION_CONFLICT` 或 `PACKAGE_PREVIEW_CONFLICT`：現檔或模型同已檢視版本唔符，更新、比較，再同意。
- `PACKAGE_MANUAL_EDIT_REQUIRED`：自動產生唔能保留 recipe，檢視原檔再用編輯器。
- `EDITOR_NOT_AVAILABLE`、`EDITOR_FILE_NOT_ADMITTED`、`EDITOR_LAUNCH_FAILED`：交接未完成，重新探索或揀獲准檔案，嘗試啟動唔係存檔。
- `PACKAGE_ROLLBACK_FAILED`：重試前檢視外部樹，保留剩餘檔案，唔假設已完整回復。

控制只限制產生語法及主機存取，唔認證下載 patch、來源、匯入 recipe 或之後修改內容，授權真正建置前要檢視。

## 正式產出及延後驗收

原實作來源 `2f2aa74b78f91e8d8f22888f597cbcbd87c6243a`、樹 `14f588fa78eba708f6c4c9343893791530a9ff68` 嘅精確根 `build.bat /s` 結束碼 0，產生桌面目錄。其 `release/app/build-receipt.json` SHA-256 為 `8c38d3f8e76fb21c6d38efc3ae6033c0579f7ca1cf97c4756a1b4937d5902bc9`，`win-unpacked/resources/app.asar` 為 23,631,436 位元組，SHA-256 `970446cf4b0e8de1e4a42a4c8e802a9e5ec9398aa28f50ce058df03bc8b2c616`，收據 `runtimeVerified: false`、`installer: false`。

只證明該來源產出，唔綁定之後整合或文件提交；新累積建置要自己來源身份。此輪刻意冇測試、審查、稽核、靜態分析、執行或畫面。真實 patch/hook/overlay、編輯器、安裝、無障礙及版面仍未驗收。
