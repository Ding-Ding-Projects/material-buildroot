# 本機用語檔拖放嘅原生提示

[English](vocabulary-drop-sound.md) · [桌面文件](README.md)

本機用語檔drop完成validation同persistence後，desktop renderer可為真實結果要求一次native sound。成功選OS本機 `Media\tada.wav`；invalid選目前native `SystemHand` sound alias。Endpoint唔收內容、檔名、paths、mappings或validation details。

Sandboxed preload提供 `window.studio.vocabularyDropSound({kind: 'applied' | 'invalid'})`。Preload同main都拒其他property或enum。Main亦要求admitted desktop sender，queued playback前再查authority。最多四pending requests，包括active。Accepted按序經hidden、bounded local child processes做synchronous native playback。

路線尊重現有volume、mute同sound scheme，完全唔改設定，無network/downloaded sound，唔跑renderer commands，唔記imported content。Accepted native回 `{ok: true, status: 'requested'}`，只確認native call，唔係人耳可聽證明。Missing media、unsupported host、unavailable playback或full queue分別回unavailable/busy，唔改import成功／失敗。Missing success sound唔用generic beep代替。

Focused checks覆strict enum、unauthorized senders、accessor拒絕、serialized order、bounded queue、authority revocation、native argv、local-only media同preload narrowing。實際可聽程度取決於主機音訊設定同硬件。
