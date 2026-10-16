# 主機准入及偏好

[English](host-and-preferences.md) · [桌面索引](README.md)

production入口 `src/main/index.cjs` 只開封裝 `dist/index.html`，context isolation、renderer sandbox，關Nodeintegration。拒新window/permission/webview/錯navigation，CSP關network/frame/object/外script。preload只bootstrap、typedrequest、固定windowcontrol及已驗operationevent訂閱/idempotent移除。IPC要精確ownedwebcontents、頂層frame及packagedURL。

主機normalappdata擁有 `desktop-owner`、`desktop-settings` 及DB，只授 `settings.setLanguage`，caller唔揀principal/directory/scope。reload、renderer終止、windowdestroy撤grant，一小時到期。過期儲存只refreshbootstrap一次，storedrevision不變先重試同request，stale保pending、重載並要再Save，failed/unavailable唔報成功。

load時guidance及停languagecontrol，save報進度防重複。stale/expired後revision變保pending請review，display/doc用刷新saved值。失回覆結果unknown，Save停到restart；拒絕再refresh失敗有獨立restartguidance。最後confirmedlanguage及真default/saved來源同pending分開。Discard只本機reset唔sendhost，focus返select，saving/unknown時停用，離開再返Save旁guidance仍有。windowcommandfail有界處理，唔unhandled。

三mode en/zh-HK/bilingual，fresh預設雙語。成功沿parser/capability/SQLitetransaction/replyeventtranslator，只emit該筆exactrecordedevent，唔重播舊。event不可用reply仍依據。gracefulclose後restart讀saved，corrupt/foreign/locked/interrupted保留unavailable、禁Save，未實作crashrecovery。

singleinstance喺store前，第二launchfocus舊窗。normalquit撤權/closeDB，唔為測試替換productionstore。明確 `--verification-user-data=<absolute-directory>` 初始前選獨立profile，唔改env/normal，供自有fresh目錄唔任意舊資料。證據要分sourceboundexe/所選目錄同normaldefault。

systemtheme初始，light/dark只當階段，Settings明示。version來installedpackage，source/UTCbuildtime來rootdriver封裝前寫 `dist/build-info.json`，缺/壞顯Unavailable。套件唔宣稱缺少runtime資源目錄，唔暗示adapters。

原focusedlocal涵sender/frame/bounds/unknown/namespace/expiry/reload/durablereplay/eventdedupe/windowcommands/eventshape/listenercleanup，broker涵graceful/invalidpreserve，type含renderer/bridge。以下native有界，freshhost/abruptrecovery/全無障礙未驗。

## 歷史封裝里程碑

`3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd` executable經真processrestart保存還原三語，48語言/theme/viewport/runtimescale組合、52layoutreceipt含startup通過。兩個已檢原擷取在[桌面證據](../evidence/desktop-shell/README.md)，有provenance及互動限制。

該里程碑工作區刻意空，冇虛構專案，唔暗示creation/build/VM/encryptedpublication可用。該版light/dark只session，darkforeground及翻譯選themelabel喺matrix前修正。觀察nativeDPI144，runtime/CDPfactor唔代獨立OSscale。冇installer/release/freshhost/Buildroot驗收聲明。

原26host/preload/broker及背景Tab、subscribe/unsubscribe、malformedIPC用 `aa91c34f4588a0dae85faef169c4dcf542c307d0`，之後renderer改但host檔不變，仍唔重標新run。六buildtoolcheck喺 `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`。本輪翻譯唔重跑或擴大歷史證據。
