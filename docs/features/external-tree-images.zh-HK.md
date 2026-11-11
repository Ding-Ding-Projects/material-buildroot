# 用外部樹建置 Home Assistant OS 同容器映像

有啲專案自帶 Buildroot 樹，而唔係畀標準 Buildroot 用嘅 defconfig。Home Assistant OS 同佢嘅 Home Assistant Material 分支都有一個 `operating-system/` 資料夾，入面有內附嘅 `buildroot/`、每塊板一個 defconfig 嘅 `buildroot-external/` 樹、`Makefile`，同建置容器用嘅 `Dockerfile`。Material Buildroot 會用專案自己嘅配方建置，唔會自己重新詮釋。

## 喺邊度

**建置 → 作業系統同容器映像。**

1. **揀儲存庫。** 揀儲存庫根目錄（或者直接揀 `operating-system` 資料夾）。面板會列出樹入面定義嘅板，例如 `ova`、`rpi5_64`、`generic_x86_64`，亦會講個儲存庫有冇 Home Assistant Material 容器配方。
2. **揀輸出資料夾。** 完成嘅映像、`build.log` 同 `receipt.json` 會放喺呢度一個新子資料夾。預設係程式自己嘅 `os-images` 資料夾。
3. **板 → 建置作業系統映像。** 開始一次建置，記錄會即時顯示，**取消建置** 可以停止。
4. **喺本機建置容器映像** 會用同一個儲存庫建置 `home-assistant-material:local`。

一次只會行一個建置。面板唔接受任何指令：板一定要係樹列出嘅，資料夾一定要經原生資料夾揀選器。

## 作業系統建置做咩

| 步驟 | 做咩 |
| --- | --- |
| 建置器映像 | 用樹自己嘅 `Dockerfile` 做 `docker build`，內容來自已提交樹嘅 `git archive`，所以建置器同來源完全一致。 |
| 建置卷 | 一個 Docker 卷放來源同輸出。Buildroot 喺 Linux 檔案系統上行，保留符號連結同大細楷，亦比 Windows 掛載快好多。 |
| 匯出來源 | 用 `git archive` 匯入已提交嘅原始位元組，唔做換行轉換，然後交畀非特權建置用戶（UID 1000）。 |
| 建置映像 | 喺樹嘅建置器入面行 `make <板>`，同佢自己嘅 `build.sh` 同發佈流程一樣。容器係特權模式，因為配方要行自己嘅 Docker 去攞 Supervisor 同附加元件容器；Buildroot 本身係用建置用戶行，唔係 root。 |
| 收集 | 將 `haos_*` 檔案複製到輸出資料夾，每個檔案嘅大小同 SHA-256 寫入 `receipt.json`。 |
| 清理 | 移除今次嘅建置卷同建置器標籤。共用嘅編譯同下載快取卷（`material-buildroot-haos-cache`）會保留，之後建置會快啲。 |

來源儲存庫只會被讀取，唔會寫入佢嘅工作樹。

### 版本來源同簽署

冇固定版本檔時，樹會讀取頻道嘅即時版本來源（Home Assistant Material 係公開嘅 `channel/stable.json`）。指令列可以用 `--version-json` 固定容器版本，同發佈流程一樣。

只有提供咗正式金鑰同證書，更新套件先會用正式金鑰簽署。本機建置會用一次性金鑰，所以佢嘅更新套件唔可以裝落正式發佈嘅系統。收據會寫明。

## 容器映像建置

跟足儲存庫嘅 `build.sh`：建置前端 wheel、由上游映像複製整合翻譯、再用固定嘅基底映像建置 `core/Dockerfile`。儲存庫會用 `--shared` 複製暫存，唔會改動佢嘅工作樹。結果只係本機映像，唔會推送。

## 指令列

```powershell
node scripts/haos/build-haos.cjs --source <儲存庫> --defconfig ova --output <資料夾>
node scripts/haos/build-container-image.cjs --source <儲存庫> --work <資料夾>
```

按 Ctrl+C 取消，清理照樣會做。

## 要求同限制

- 需要 Linux Docker 引擎（Docker Desktop 配 WSL 2 都得），同幾十 GB 空間。每塊板第一次建置要一至兩個鐘。
- 燒錄到板同空中更新係另外嘅步驟，唔包括喺呢條路線入面。

## 驗證

實際行過嘅建置、雜湊同開機檢查記錄喺[驗證記錄](../evidence/external-tree-images/README.md)。
