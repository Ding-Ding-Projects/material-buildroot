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

### 由原始碼建置嘅映像

作業系統映像入面有第一次開機會啟動嘅容器：Supervisor、喺真正核心裝好之前頂住 Home Assistant Core 嘅登陸頁，同埋 DNS、Audio、CLI、Multicast、Observer 呢幾個外掛。樹嘅配方平時喺 `make` 期間用 `skopeo` 全部下載。

如果儲存庫本身有其中一啲映像嘅原始碼，Material Buildroot 會用同一個提交建置佢哋，再放入作業系統映像代替下載版。Home Assistant Material 即係 `supervisor/` 同 `landingpage/`。喺 `make` 之前：

1. 讀一次樹自己嘅更新來源（或者 `--version-json` 檔），等映像同建置用同一個版本。
2. 喺一個只屬於今次建置嘅 Docker 網絡上，開一個私人登錄容器（`registry:3.0.0`，用摘要固定）。佢唔會喺呢部電腦發佈任何埠。
3. 用每個資料夾已提交內容嘅 `git archive` 建置映像，跟板嘅平台同來源入面嘅版本（例如 Supervisor 用 `BUILD_VERSION=2026.11.0.132`），用只供建置嘅標籤，所以唔會遮住呢部電腦上同名嘅已發佈映像。
4. 喺建置網絡上用樹嘅建置器映像入面嘅 `skopeo`，將每個映像複製入私人登錄，用來源寫明嘅名（例如 `ghcr.io/ding-ding-projects/amd64-hassio-supervisor`），同埋記低儲存咗嘅摘要。
5. 畀建置用戶一個 `registries.conf`，只將儲存庫自己嘅登錄前綴轉去私人登錄，再喺建置網絡上行 `make`。

之後樹嘅配方照常下載嗰啲名，攞到嘅就係由原始碼建置嘅映像。佢會印出放入作業系統映像嘅每個映像嘅摘要；只有每個由原始碼建置嘅映像都以儲存咗嘅摘要出現，建置先算成功。收據會列出由原始碼建置嘅映像、摘要同提交，同埋仍然要下載嘅映像。完咗之後，登錄、網絡同只供建置嘅標籤都會刪走。

儲存庫冇原始碼嘅映像（上游外掛）照舊由樹嘅配方下載，收據會講明。第一次開機之後，Home Assistant Core 本身由 Supervisor 按更新來源安裝，同任何 Home Assistant OS 系統一樣，唔喺映像入面。指令列加 `--no-from-source` 就全部照樹自己嘅方法下載。

### 版本來源同簽署

冇固定版本檔時，樹會讀取頻道嘅即時版本來源（Home Assistant Material 係公開嘅 `channel/stable.json`）。指令列可以用 `--version-json` 固定容器版本，同發佈流程一樣。

只有提供咗正式金鑰同證書，更新套件先會用正式金鑰簽署。本機建置會用一次性金鑰，所以佢嘅更新套件唔可以裝落正式發佈嘅系統。收據會寫明。

## 容器映像建置

跟足儲存庫嘅 `build.sh`：建置前端 wheel、由上游映像複製整合翻譯、再用固定嘅基底映像建置 `core/Dockerfile`。儲存庫會用 `--shared` 複製暫存，唔會改動佢嘅工作樹。結果只係本機映像，唔會推送。

## 可開機嘅設備 ISO

設備路線（映像、**獨立 OS**、**從來源建置容器映像**）都接受呢個儲存庫做單一來源。佢由已追蹤嘅檔案認出呢個結構：Core 喺 `core/`（專案 `homeassistant`），Material 前端喺 `frontend/`（pnpm 同 gulp），上游版本喺 `versions.json`。唔會再問你揀第二個前端儲存庫；前端修訂就係儲存庫自己嘅修訂。

準備工作會為所選修訂建立快照，只將 `core/` 同 `frontend/` 複製入建置，符號連結（代理筆記）會留低唔複製，並喺來源收據列明。之後用同上面容器映像建置一樣嘅階段建置一個映像：前端 wheel、對應上游版本嘅整合翻譯，同埋喺 `versions.json` 寫明嘅基礎映像上建置 `core/Dockerfile`。映像會標上修訂，ISO 產生器放入映像之前會核對呢個標籤。設備開機後用主機網絡同持久 `/config` 卷運行佢，埠係 8123，並用儲存庫自己嘅健康檢查（`/manifest.json`），咁主控台設備就可以報告 Home Assistant 幾時有回應。映像太大，放唔入 initramfs，所以喺 ISO 入面係一個獨立檔案，開機時會先核對雜湊值。

仍然要下載嘅：上游基礎映像，同埋提供翻譯嘅上游 Core 映像。呢個係容器入面嘅 Home Assistant Core；設備冇 Supervisor，亦冇附加元件商店。

## 指令列

```powershell
node scripts/haos/build-haos.cjs --source <儲存庫> --defconfig ova --output <資料夾> [--no-from-source]
node scripts/haos/build-container-image.cjs --source <儲存庫> --work <資料夾>
```

按 Ctrl+C 取消，清理照樣會做。

## 要求同限制

- 需要 Linux Docker 引擎（Docker Desktop 配 WSL 2 都得），同幾十 GB 空間。每塊板第一次建置要一至兩個鐘。
- 燒錄到板同空中更新係另外嘅步驟，唔包括喺呢條路線入面。

## 驗證

實際行過嘅建置、雜湊同開機檢查記錄喺[驗證記錄](../evidence/external-tree-images/README.md)。
