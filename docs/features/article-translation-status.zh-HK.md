# 文章翻譯及正式產出界線

[English](article-translation-status.md) · [工作目錄](README.md)

目前文件流程保留49篇詳細粵語參考全文、來源wiki、API指引及分類索引，英文直接連完整版本。翻譯包含行為、權限、復原、限制及證據，舊短摘要唔算完整。呢個係編寫清單，唔係翻譯審查、建置、執行或無障礙結論。

## 尚欠參考全文

- `docs/features/browser-native.md`
- `docs/features/companion-consumers.md`
- `docs/features/presentation-provenance.md`
- `docs/desktop/configuration.md`
- `docs/desktop/execution.md`
- `docs/desktop/deployment.md`
- `docs/desktop/built-in-tools.md`
- `docs/desktop/ollama-workspace.md`
- `docs/desktop/minecraft-manager.md`
- `docs/deployment/hypervisor-controls.md`
- `docs/security/workspace-state.md`
- `docs/security/companion.md`
- `docs/build/releases.md`

功能、安全及文件根索引仍欠完整翻譯，保留嘅遠端執行及文件通知changelog亦欠。之後整合可能加改文章，要保確切歷史並更新twins先宣稱全清單完成。呢份有界清單唔宣稱歷史evidence/planning/design已翻譯。

## 目前API快照

分類/總Postman從已整合主機列精確動作scope，使用明確編寫參數。當前四條工作階段route加107動作，含browserpairing/clientinstanceheader、sessionownedhandle及nativeconfirmation說明。例子唔授權，trust/consent/billingcallback唔入JSON。已產生，冇sendrequest或跑test。

## 產出及驗收

舊rootdocumentationbuild只綁 `cf590128682e0e6e15756000a66f16f4ce5482f7`，receipt SHA256 `3c540c3dd92a2df8d33bb8234944abe21e5e9a49eb53c1937d04ab0b80d17ff1`、`runtimeVerified:false`。之後翻譯/API/整合要自己獲分配producer。來源保留同生成內容promote、deploy、livecheck分開。

測試、審查、稽核、靜態分析、browser/API/native操作、無障礙及畫面延後，PH09-T04保持未勾。支援generator直接render來源wiki，但外部同步及完整source-boundoffline/search/navigation仍未核實。
