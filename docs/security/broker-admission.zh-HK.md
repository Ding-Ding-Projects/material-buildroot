# 耐久設定 broker 准入

[English](broker-admission.md) · [安全索引](README.md)

狀態係 `settings.setLanguage` data-only 核心及原有有界行為證據，唔係正式 IPC、檔案能力、建專案、Buildroot 執行、介面或完整功能交付。

## 可信主機界線

`src/main/broker.cjs` 經嚴格 parser 接序列請求，可信主機另外提供 caller，JSON 唔可自報 principal。未知欄、JSON 或版本錯回 `INVALID_REQUEST`，每個操作同設定/事件讀喺效果或結果披露前驗 opaque capability。其他 parser 接受 action 授權後回 `NOT_IMPLEMENTED`，唔改儲存。

database path、project namespace 及 registry 由主機擁有，唔由 renderer dispatcher 提供。`createCapabilityRegistry` 發 principal/project/action/expiry 綁定 grant，32 random bytes→43 字元參照，最多 4,096 活 grant，預設五分鐘、最多一小時。用程序單調 clock，到期或撤銷移 grant。新程序冇舊權限，重新授權要明確；同程序重開 store 唔等於重啟 registry。

## 耐久交易及重試

`src/main/storage/settings-store.cjs` 用內置 SQLite，原本喺 Node 24.22.0 實作 create/insert/read，固定表/動作用參數化 SQL，請求唔公開 SQL、shell、路徑或動態 dispatcher。

缺 principal/project row 預設 bilingual，revision `0000000000000000000000000000000000000000`。授權變更單一 immediate transaction 包 language/revision、operation digest/result 及有序 event，耐久鍵 `(principal, namespace, operationId)`。相同語義重試回舊結果、唔改設定/加事件；同鍵不同內容 `OPERATION_CONFLICT`；過期修訂 `STALE_REVISION` 保留資料，呢種拒絕唔係已接受操作，可新檢視後重試。

第 1 版 semantic digest 用排序 JSON，排除臨時 capability，但保 action/args/project/expected revision/version/operation ID，同 parser 全 envelope 摘要刻意不同。重啟後有效新 grant 可恢復舊結果，披露仍先授權。失敗全 transaction rollback，事件最多 1,000，帶 `hasMore`、`nextSequence`，明確下一頁。

固定代碼 `OK`、`INVALID_REQUEST`、`NOT_AUTHORIZED`、`NOT_IMPLEMENTED`、`OPERATION_CONFLICT`、`STALE_REVISION`、`STORAGE_UNAVAILABLE`。錯誤唔含 payload、能力、database path、SQL 或 SQLite exception，可信 store 亦只一般訊息。

## Database 身份及中斷

必須可信主機目錄，祖先唔符號/junction/轉址，database/ownership 要普通單連結。exclusive-create marker 阻合作並行，SQLite exclusive、zero busy wait、full synchronous、DELETE journal，唔開 WAL。

開前有 WAL/shm/rollback sidecar 就不可用，開住時按檔案身份追蹤 SQLite 自己 journal。操作再查 database、marker、祖先、sidecar，替換即停。既有檔喺任何可寫 SQLite open/pragma 前准入，100-byte header 要 SQLite、application ID `0x4d425253`、version1、DELETE mode。唯讀連線要求精確 table/index SQL，額外 table/view/trigger 拒絕。缺失、外來、空既有檔唔初始化，只 constructor 獨佔新建先初始化。重開同樣檢，舊版遷移另行檢視。外來 WAL 由 header 拒絕，唔叫 SQLite 改 mode。關閉只刪自己 marker，SQLite 管自己 journal，唔刪其他 sidecar。

突然退出可留 marker/journal，此切片冇自動 stale-lock 或 hot-journal 復原，要保留再用可信復原。原測試證明中斷序列輸入無效、正常重開保留交易、模擬中斷檔保留並拒絕，唔證明 power loss。唔防同目錄寫權敵意程序或 in-place database mutation，OS permission 及日後 handle-relative 能力獨立。原 Windows junction 測過，其他 reparse/敵意競爭未核實。

## 原有 focused 證據

原文章記錄以下，唔係本輪重跑：

```text
.cache/toolchains/node-24.22.0/active/node.exe --test tests/broker.test.cjs tests/broker-contract.test.cjs
20 tests, 20 pass, 0 fail, 0 skipped
```

涵蓋授權修改、修訂/事件持久、key-order 重試、改內容衝突、owner/action/project、到期/撤銷、跨 principal/project、重開/regrant、caller claim、未實作隔離、授權過期 rollback、並行 open、外來 sidecar、linked parent、marker 替換、一般錯、grant 上限、中斷輸入/檔、外來 DB、cursor。rollback 用 commit 前撤銷，已寫 setting/event/idempotency 仍全回復，任意 trigger 由 schema 拒絕。

原切片正式 IPC 認證、principal、permission UI、原生檔 grant、crash recovery、migration/backup、多程序及其他動作未實作，冇 build/installer/GUI 驗收。

## 內部及公開型別接縫

`src/shared/broker-core.ts` 定義 result/event/store/authority/caller，factory 暴露型別 core。`src/main/security/broker-contract.cjs` 嚴格將有效內部成功/固定失敗轉 `OperationReply`，未知額外欄一般不可用。event 要精確欄，產 version1 succeeded `OperationEvent`。timestamp 喺同 transaction 寫，重開/replay 不變，唔用觀察時間代替。無效 event 固定診斷，唔用 cast 或 broad unknown 放寬。

修補後原 focused 二十測試零失敗/跳過，包括外來 v1、冇 sidecar v0 WAL 前後位元組、journal header、schema、sidecar；真 app ID 加額外 table/trigger 仍拒絕並保留 byte/schema/file inventory，空檔仍空。真 core 成功/event 經 translator，各固定錯同無效翻譯有精確斷言。

原型別驗證 Node24.22.0：

```text
node node_modules/typescript/lib/tsc.js --ignoreConfig --noEmit --strict --allowJs --target ES2022 --module nodenext --moduleResolution nodenext --skipLibCheck tests/broker-contract-types.ts
exit 0
```

檢內/外接縫、factory、缺 timestamp、未知 code、錯 public-as-internal 及 caller。原切片 preload 接線仍欠。database 准入驗 format/schema ownership，唔認證敵意程序或 row 內容，可信目錄仍必要；後續整合唔由此舊收據推斷驗收。
