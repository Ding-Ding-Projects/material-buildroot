# 序列化操作請求

[English](operation-requests.md) · [安全索引](README.md)

`src/main/security/operation-request.cjs` 實作首版請求准入，接 JSON 文字或 UTF-8 位元組，回不可變已驗請求及內部正規摘要，唔執行、解析路徑、認證呼叫者或授予能力。

執行 schema 為 `src/shared/operation-request.schema.json`，舊 planning schema 只係歷史設計，正式只載執行版。`src/shared/api.ts` 用依 action 分辨 union，唔係 string dispatcher 回 `any`。本文原實作收據嘅 production preload/broker 整合仍需分開證據。

## 輸入限制及拒絕

最多 65,536 UTF-8 位元組、八層 container、2,048 個 container/property/literal 事件。syntax visitor 造物件前查已 decode 重複鍵、不安全 prototype 鍵、無效 Unicode、語法、註解及 trailing comma。數字要 JavaScript safe integer 範圍正規十進制整數，fraction、exponent、negative zero 喺轉數值隱藏 rounding/underflow 前拒絕。

JSON Schema 唔 coercion、補預設或移除未知欄，根及動作額外欄拒絕。opaque capability 用有界 ASCII URL-safe，唔用路徑。原五種形態係語言、建專案、預覽建置、綁預覽提交及自有工作取消，形態接受唔代表已實作。

鍵排序及非重要空白唔改摘要，參數改變會改。envelope 及巢狀資料 frozen，摘要只內部 idempotency，唔係憑證，唔同私人請求公開。拒絕只固定代碼及一般訊息，唔反射鍵、值或能力。

## 套件及來源

正式 lock 固定 MIT `jsonc-parser` 3.3.1 同 Ajv 8.20.0。visitor 關 comments、trailing comma、empty，Ajv draft-2020 關 mutation。參考[parser API](https://github.com/microsoft/node-jsonc-parser)及[Ajv options](https://ajv.js.org/options.html)，實際版本及本機來源決定准入。

## 原有證據及待整合

原文章記錄 Node 24.22.0 九個 focused local tests 通過，涵蓋五形態、正規身份、escaped duplicate、prototype、語法/UTF-8、bytes/depth/members、精度、schema 及一般診斷。獨立唯讀審查曾重現 fraction rounding/exponent underflow，修正 lexeme 後拒絕，重跑冇剩餘可行解析發現。呢啲係原有證據，唔係本輪翻譯重新測試。

下一 broker 要驗實際 IPC sender、能力 owner/real path、預期修訂、耐久 idempotency/result、中斷效果及有界事件。解析結果唔授 shell 權。原切片 production IPC、持續儲存、effectful action 及原生驗收未實作；後續整合以各自文章及證據為準。

union 原本通過 TypeScript 7.0.2：`--ignoreConfig --noEmit --strict --skipLibCheck --target es2022 --module commonjs tests/operation-request-types.ts`，三個 expected-error fixture 拒絕任意 action、錯配 args 及缺 envelope，只係編譯期證據。
