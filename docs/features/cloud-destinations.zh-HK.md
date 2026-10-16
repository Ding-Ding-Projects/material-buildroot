# 私人雲端目的地

[English](cloud-destinations.md) · [功能索引](README.md)

PH07-T09 為輸出檢視器加入 S3-compatible、Azure Blob、Google Cloud Storage 及既有 GitHub Releases 流程。原文章收據只係來源，該變更當時未建置、測試、審查、傳輸或視覺驗證；新來源同生產收據要分開記錄。

## 操作流程

1. 選已接入工作區及一個輸出檔，唔支援目錄或自動收集來源。
2. 原生選擇器匯入目的地 JSON，喺原生確認檢視精確範圍。主機用既有 vault 加密憑證，綁新目的地 ID；顯示層請求唔帶憑證或目的地 URL。
3. 選目的地並預覽確切上載，顯示相對檔名、帳戶/container、唯一物件名、長度、SHA-256 及兩分鐘有效期，呢一步唔連網。
4. 同意確切檔案、目的地、網絡傳送及可能費用，再喺原生對話核對。主機製作已授權檔案快照，查身份/摘要後開始耐久工作。
5. 更新歷史看進度、取消或重試中斷物件讀回。面板連接時每 2.5 秒更新進行中工作。

只准私人目的地。S3 要四個 public-access-block 全開，compatible endpoint 亦要支援該 API 及條件建立。Azure 要確認 container 冇公開存取，GCS 明確 `publicAccessPrevention: enforced`，唔接受無法驗證 inherited。GitHub 要私有來源及精確標籤既有普通發行。唔建立或修改來源、發行、bucket、container、IAM policy 或帳戶。

## 登記格式

本機 JSON 精確包含 `version`、`profile`、`credential`，最多 32 KiB，保留最多 32 設定檔。輸入檔唔刪或改，要保護本機檔，真實憑證唔放來源、對話、畫面或記錄。

```json
{
  "version": 1,
  "profile": {
    "provider": "s3",
    "label": "Private build outputs",
    "endpoint": "https://s3.us-east-1.amazonaws.com",
    "bucket": "example-private-build-output",
    "region": "us-east-1",
    "prefix": "builds/"
  },
  "credential": {
    "accessKeyId": "EXAMPLEONLY",
    "secretAccessKey": "EXAMPLE-NOT-A-CREDENTIAL"
  }
}
```

全部例值係佔位。S3 可另加 `sessionToken`。Azure profile 為 `provider: "azure"`、`label`、`account`、`container`、`prefix`；GCS 為 `provider: "gcs"`、`label`、`bucket`、`prefix`；GitHub 為 `provider: "github"`、`label`、`repository`（`owner/name`）、`tag`。後三種 credential 用 `accessToken`。只用短期、限所選目的地讀寫及私隱檢查權限。到期停止並重新登記，未實作自動更新或 IAM 配置。

prefix 只 ASCII 字母、數字、底線、連字號及結尾 `/`，例如 `builds/project/`。檔名最多 120 個 ASCII 字母、數字、點、連字號或底線，非空且最多 1 GiB。S3 endpoint 要 HTTPS origin，唔含憑證、query、path 或非預設 port。匯入 endpoint 係主機明確信任，只接受可信管理員登記，冇顯示層任意 endpoint/指令。

## 供應商協定及來源

適配器只用固定主機請求並拒絕轉址，唔引入第三方 SDK。

| 供應商 | 協定及行為 | 官方參考 |
| --- | --- | --- |
| S3-compatible | S3 2006-03-01、Signature V4、`PutObject`、`If-None-Match: *`、SHA-256 請求摘要、完整 `GetObject` | [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)、[public access block](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetPublicAccessBlock.html) |
| Azure Blob | REST `2023-11-03`、bearer、只新建 block blob PUT、完整 GET | [Put Blob](https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob)、[Container Properties](https://learn.microsoft.com/en-us/rest/api/storageservices/get-container-properties) |
| Google Cloud Storage | JSON v1、media insert `ifGenerationMatch=0`、完整 `alt=media` | [Insert](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/insert)、[條件](https://docs.cloud.google.com/storage/docs/request-preconditions) |
| GitHub Releases | 既有已鎖定/批准 `gh`、`repo view`、`release view`、唔覆寫嘅 `release upload`、`release download` | [Upload](https://cli.github.com/manual/gh_release_upload)、[Download](https://cli.github.com/manual/gh_release_download) |

GitHub CLI 權限及摘要沿用執行設定，子程序環境只注入該目的地有限憑證，丟棄 stderr，唔改用 raw HTTP 或依賴環境帳戶。其他 provider exception/response 唔入歷史，網絡失敗只記有界代碼。

## 完整性、取消及重試

每預覽用 prefix 內不可猜物件名或者發行檔案名。PUT 只新建，GitHub 唔用 `--clobber`。主機邊比較摘要/身份邊複製至保留傳送資料夾，provider 上載快照，唔用可變顯示層路徑。

成功要求完整讀回位元組長度及 SHA-256 相同，並再次確認私人範圍，PUT 成功本身唔係成功。既有耐久工作記 queued、running、cancelling、cancelled、failed、interrupted、succeeded，進度收據記准入、上載及讀回而冇秘密。

取消中止自己操作，十分鐘期限包含准入、上載及讀回。取消或斷線唔證明遠端未寫完，遠端物件同本機快照都保留。重啟進行中工作變 interrupted，唔係成功。重試要原生確認，只讀回同一物件，唔再上載；缺少或不完整要新預覽及新名稱。唔覆寫或刪既有物件，移除設定檔只隱藏，保留歷史及加密復原材料。

## 待驗收及排除範圍

四個 provider 真實帳戶、有限憑證、拒絕、私隱改變、條件衝突及讀回未核實。各階段取消、程序重啟、快照保留、重試及費用仍未驗收，語言、鍵盤、screen reader 及版面亦未驗收。公開目的地、目錄/來源收集、multipart 續傳、憑證更新同自動刪除刻意唔屬此有界流程。
