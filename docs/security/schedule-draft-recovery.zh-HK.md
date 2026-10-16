# 本機排程草稿復原

[English](schedule-draft-recovery.md) · [安全索引](README.md)

主機為完整驗證本機排程草稿提供獨立只增不改歷史，記錄唔會啟用、求值、聯絡供應商或套設定，編輯器另需驗收。

## 主機動作

有型別橋接只加以下 envelope：

```ts
{ action: 'draft.discard', document: ScheduleDocument }
{ action: 'draft.list', after: number, limit: number }
{ action: 'draft.read', sequence: number }
```

discard 回主機序號及時間，list 只收據、continuation 及 `hasMore`，read 回有原修訂嘅已驗文件或 null。還原只編輯資料，套用仍要目前有效 schedule 嘅明確修訂儲存。

全部要自有頂層 frame 及可用、inactive 共用模式，缺少/active/unknown/throw 都阻存取。commit 前及回覆前再次驗權。renderer 唔可供 authorizer、儲存目錄或 credential reference。

## 儲存及上限

獨立 profile 目錄、SQLite application ID 及精確 schema，唔改已存文件收據。lazy open，草稿庫壞唔阻有效排程啟動/讀。

只准完整 valid local-source rules，登記、憑證、未知欄、外部規則拒絕。混合編輯先明確投影本機資料，之後還原再合目前外部記錄。原獨立來源審查及 browser recovery cases 曾通過，原生封裝待驗。

最多64筆、原文262,144位元組、合計16,777,216、每頁20收據、實體DB64MiB，唔有 eviction/delete，滿就明確錯誤並保舊。64×最大文件等於aggregate，尚有record slot嘅合法追加唔會超aggregate，所以唔聲稱另有可到達 aggregate refusal branch。

保留 path identity、schema、journal identity、transaction marker、rollback 及外來證據檢查，壞/外來庫保留並不可用。原生 ACL 私隱及敵意 journal 替換係獨立證據缺口。

## 原有驗證

原 native Node 十個新 storage/service/IPC cases 冇skip；之後真子程序喺插入/spill後終止，重開rollback未提交草稿、保原記錄及sequence分配。原active store/service/IPC regression23項：19pass、0fail、4skip；四個要替換active journal，主機sharing阻止。另個native sharing-denial/rollback曾跑過通過，唔將skip外來證據路線標已驗。

只證目前主機有界行為，唔證封裝互動、全部語言無障礙、安裝profile、全新主機或全路線圖。見[原生後續證據](../evidence/native-windows-20261016/README.md)。本輪翻譯冇重跑以上檢查。
