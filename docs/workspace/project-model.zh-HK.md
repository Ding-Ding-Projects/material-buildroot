# 有版本專案模型

[English](project-model.md) · [工作區索引](README.md)

PH02-T01 只有來源編寫，此模式未測試、獨立審查、安裝遷移、跨介面隔離或執行，路線圖驗收仍開放。

## 身份及記錄

安裝身份 `com.dingdingprojects.materialbuildroot`、套件 `material-buildroot`、Squirrel `MaterialBuildroot` 不變，顯示名唔變儲存身份，唔改安裝目錄或搬資料。

`src/shared/project-model.ts` 定義持久目錄及選項。專案保留 UUID、顯示名、根/來源/輸出；原有身份相符重用 UUID。metadata 唔授檔案權，重開仍要新主機授權。

目錄及選項為第 2 版，明確 ownership `{ applicationId: "com.dingdingprojects.materialbuildroot", surface: "desktop" }`。選項仍按 UUID 分檔，各自保留修訂及交易界線。

## 遷移及保留

兩個 store 接受精確已知 v1，記憶體遷移到 v2 後回資料，保留 UUID、修訂、路徑、環境、外部樹名及順序。讀唔會寫，成功新增目錄或存選項先用原獨佔鎖、暫存、flush、rename 寫 v2。重接已有專案唔作無必要覆寫。

未知版本/鍵、無效內容、重複鍵及 app/surface 不符停止，唔重設、截斷或以空預設取代新版/損壞檔。修訂衝突同 storage-busy 分開。新版只可有 desktop 身份，唔可替換瀏覽器文件。驗證同檔案保護由 store 執行，唔只靠 TypeScript。

遷移只向前，舊 v1 build 唔保證讀 v2。降級前由擁有人備份，冇自動反向轉換。

## 外部樹順序

選項最多 32 個 `{ path, name }`，位置有意義，載入/儲存/遷移都保留。名稱按 Buildroot 規則，重名/重路徑拒絕，唔排序或默默去重。環境保留具名 WSL 或摘要鎖定 Docker 及非 root UID/GID。外部樹再授權係獨立操作，metadata 唔授權。

## 介面隔離及驗收

桌面資料喺原有主機操作儲存根。公開文件訪客用 browser origin 同自己 local-storage 格式。伴隨偏好/臨時配對屬瀏覽器，傳輸唔變桌面檔。v2 加持久界線，唔搬或接管瀏覽器儲存。跨 origin、安裝 profile 及重啟仍需實際驗收。

延後包括 v1 ID/順序遷移、v2 重開、未知版保留、身份拒絕、鎖/修訂衝突、失敗寫保留、升級/改顯示名身份，以及桌面/文件/伴隨重載重啟隔離。建置或來源檢視唔證明以上通過。
