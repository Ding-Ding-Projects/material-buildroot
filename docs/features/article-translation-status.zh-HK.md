# 文章翻譯同正式產出界線

[English](article-translation-status.md) · [工作目錄](README.md)

目前文件流程保留原有49篇詳細粵語參考全文、來源wiki全文、API流程全文同已翻譯分類索引。既有英文文章保留完整翻譯連結。另外新增七篇完整粵語文章，涵蓋四個ISO欄位、ISO工作流程、ISO製作同新手文件指南；原文同譯文都由[ISO欄位索引](../desktop/iso-fields/README.md)連接。翻譯包括行為、權限、復原、限制同證據界線，舊文章嘅短摘要唔計完整全文。呢個係編寫清單，唔係翻譯審查、建置、執行或無障礙驗收結論。

## 新增ISO同入門全文

- [設定組合同韌體](../desktop/iso-fields/profile-and-firmware.zh-HK.md)
- [執行環境同資源](../desktop/iso-fields/runtime-and-resources.zh-HK.md)
- [配置同復原](../desktop/iso-fields/configuration-and-recovery.zh-HK.md)
- [輸出同驗證](../desktop/iso-fields/output-and-validation.zh-HK.md)
- [ISO工作流程](../desktop/iso-workflow.zh-HK.md)
- [ISO製作](../desktop/iso-production.zh-HK.md)
- [新手文件指南](guided-documentation.zh-HK.md)

以上係完整編寫譯文，唔係舊短摘要。三篇粵語wiki亦已同步目前英文，包括已安裝build233.1、只有發佈證據嘅build234.1，同有限範圍ISO消費端證據。呢個係來源翻譯對應，唔係新增執行驗收。

## 其他完整參考全文

先前列出嘅十三篇參考已有十二篇完整譯文。剩餘伺服器管理文章仍列喺下方。來源 `382373f97c9b915d051dd1cf94667eb131a4c372` 嘅文件曾通過有限範圍瀏覽器檢查，但舊結果唔涵蓋之後新增譯文。

- [展示來源證明](presentation-provenance.zh-HK.md)
- [Ollama工作區](../desktop/ollama-workspace.zh-HK.md)
- [受管理虛擬機控制](../deployment/hypervisor-controls.zh-HK.md)
- [產物同部署](../desktop/deployment.zh-HK.md)
- [未簽署Windows發佈](../build/releases.zh-HK.md)
- [HTTPS伴隨連線界線](../security/companion.zh-HK.md)
- [持久工作區狀態](../security/workspace-state.zh-HK.md)
- [配置服務](../desktop/configuration.zh-HK.md)
- [已驗證伴隨連線消費端](companion-consumers.zh-HK.md)
- [內置工具服務](../desktop/built-in-tools.zh-HK.md)
- [項目執行適配器](../desktop/execution.zh-HK.md)
- [瀏覽器原生訪客功能](browser-native.zh-HK.md)

譯文保留原文歷史驗證界線，唔會更新執行證據。

## 目前工作流程新增文章

五篇新來源文章已有完整粵語全文：訪客驗收、文章來源語言、原生WSL內容意圖、個人用語拖放提示音同原生拖放提示。套件目標指南亦同時有英文同粵語。分類索引連到每對文章；來源或fixture界線唔代表native或ISO驗收。伺服器管理全文仍未編寫。

## 尚欠參考全文

以下目前參考仍未有完整粵語全文：

- `docs/desktop/minecraft-manager.md`

功能根索引、安全根索引同文件根索引仍需要完整翻譯頁。保留嘅遠端執行同文件通知更新記錄亦未有全文。之後來源整合可新增或改變文章；要保留確切歷史並更新對應譯文，先可聲稱全清單完成。呢份有限清單唔聲稱歷史證據、規劃或設計資料已翻譯。

## 目前API快照

分類同主Postman JSON由已整合消費端模組取得精確接納操作名稱同scope，使用明確編寫嘅參數例子。目前快照有四條session routes同107個typed action requests，包括browser pairing/client-instance headers、session-owned handles同native-confirmation說明。例子唔授權；原生trust、consent同billing callbacks絕唔係JSON參數。產生步驟已跑，但冇送要求或執行測試。

## 正式產出同驗收

較早根文件建置只綁來源 `cf590128682e0e6e15756000a66f16f4ce5482f7`，收據SHA-256 `3c540c3dd92a2df8d33bb8234944abe21e5e9a49eb53c1937d04ab0b80d17ff1`，`runtimeVerified: false`。之後翻譯、collections同整合要自己獲分配嘅製作程序。來源保留同生成內容提升、部署、實際線上檢查分開。

先前延後只描述當時編寫階段，唔係目前所有證據。新ISO製作同有限QEMU啟動證據已存在，build233.1亦另有已安裝啟動記錄，但都唔證明新文件譯文或候選原生介面。PH09-T04要等自己整合瀏覽器、導覽、無障礙同部署證據完整先勾選。支援產生器直接顯示來源wiki，但外部wiki同步同完整綁來源離線／搜尋／導覽驗收仍未核實。
