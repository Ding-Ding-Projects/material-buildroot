# 受管理 Buildroot 執行 workflow

[English](execution-workflows.md) · [功能索引](README.md)

執行設定有固定動作建立器及專家 YAML 編輯器。先喺設定選擇並授權來源、目的地及 Linux runner。建立器需要完整 40 字元來源提交、Buildroot defconfig 名、`all`、`source`、`legal-info` 或 `sdk` 其中一個目標，以及 1–8 並行數。

## 預覽及發佈

預覽經可信主機解析來源提交、檢查目的地目前預設分支修訂、列出既有 workflow，再顯示精確 YAML、目的地路徑、來源修訂、runner 及 SHA-256。五分鐘到期，欄位或者執行選擇改變就清除畫面確認。

發佈要獨立核取同意及預覽身份/摘要。主機重新核對選擇、來源同目的地修訂，寫入前消耗預覽，建立以摘要命名、冇既有檔案 SHA 嘅新檔，再喺回傳提交讀回相同位元組先准入執行。唔覆寫現有檔案。回覆遺失或讀回失敗屬未核實，唔自動重試，要先檢視目的地再準備新嘗試。

發佈只係來源變更，唔派送。執行有獨立同意，只支援 manual dispatch 加操作 UUID。來源提交、來源名稱、設定、目標及並行數固定喺檔案，唔產生 push、pull-request、排程或發行觸發。

## 專家 YAML 准入

用 `yaml` 2.9.1 解析 YAML 1.2，亦接受 JSON 表達，唔強制 JSON。最多 UTF-8 65,536 位元組、一文件、20 層、2,000 結構節點。拒絕重複鍵、alias、anchor、自訂 tag、merge key、危險物件鍵、解析錯誤及警告。

解析器從 `env` 恢復同一建置模型，驗證後重新產生完整允許文件，再比較整棵樹。格式及 mapping 次序可不同。未知 action、任意 shell、額外 expression、權限改變、額外工作、不屬所選 runner 嘅 label 及未知欄位唔准入。不支援文字保留但唔可發佈，主機先係授權依據，唔靠顯示層驗證。

## 執行界線

產生 workflow 使用固定 checkout/upload action、唯讀來源權限、停用保留 checkout 憑證、唔遞迴 submodule 及非 root 建置。Linux runner 要支援 `apt-get` 同非互動 `sudo` 以執行固定工具安裝，不支援映像如實失敗，唔跳過必要工具。呢個建置 Linux 輸出，唔建 Windows 桌面安裝包，冇測試或 lint，唔建立程式發行。

checkout 有設定時用 `BUILDROOT_SOURCE_TOKEN`，否則 workflow 認證。獨立私有來源需要編輯器以外設定嘅有限讀取憑證，目前設定拒絕私有跨來源。編輯器唔接受、回傳或寫入憑證值。來源係可執行建置輸入，可能跑自己規則，所以只批准可信不可變來源。

完整 `output/images` 直接檔案清單以 directory descriptor 及 no-follow 讀取，最多 1,000 檔、1 GiB 映像，加 1 MiB 清單。複製及雜湊用 64 KiB 區塊，下載額外預留 32 MiB ZIP/清單空間。超大集合整份拒絕，唔默默截斷；連結、子目錄、特殊檔、非法名稱、空集合或讀取中改變都拒絕。

全部檔案同清單完成先交新 runner 暫存目錄畀 upload，部分或失敗唔上載。`manifest.json` 第 1 版記操作 UUID、workflow 提交、來源提交及每檔相對路徑、長度、SHA-256。固定名稱 `buildroot-output`、保留七日、排除隱藏檔。建置失敗後仍收集，但唔蓋過原結果；只喺完整 bundle 時上載，用無壓縮 ZIP 控制額外大小。缺少或部分清單唔係已驗證下載。

## 套件來源資料

- `yaml`，精確 `2.9.1`，ISC 授權。
- [來源](https://github.com/eemeli/yaml)
- [registry 壓縮檔](https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz)
- registry integrity：`sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==`

套件包含 ISC 授權，manifest 及 npm lockfile 記精確安裝。準備 lockfile 停用 lifecycle script，冇測試或稽核。

## 驗收狀態

此變更實作准入及讀回，冇發佈或派送外部 workflow，冇本機測試、審查、靜態分析、實際操作或畫面。真實託管/自管執行、發佈競爭、無效 YAML 拒絕、下載、本地化及無障礙仍待驗收。
