# 個人用語拖放提示音

[English](personal-vocabulary-drop-sounds.md) · [桌面文件](README.md)

真正視窗檔案拖放，只有串行匯入回傳已驗證、已持久保存結果後先要求原生聲音。成功drop要求一次completion sound。Invalid JSON、非JSON檔名、超過256KiB同多檔drop，每次drop要求一次invalid-input sound。既有用語同可見結果訊息行為不變。

Renderer只送 `{kind: "applied"}` 或 `{kind: "invalid"}`，唔送內容、metadata、paths、匯入heading或mappings到sound endpoint。既有controller保持匯入串行。快速多次drop各保自己結果，每個continuation最多一聲音要求。獨立renderer sound queue等每次native response，唔阻後續imports。Restricted mode或Clear令queued sounds失效時會丟棄。Native endpoint亦串行，unavailable/busy保持安靜，唔自動retry。

Storage或read unavailable、restricted/unknown shared mode、feedback controls disconnected都安靜。Restoration、reload、clear同Settings picker唔觸發drop-only路線。Playback rejection被隔離，唔undo已套用檔、唔改成invalid，亦唔抑制visual celebration、reduced motion或live-region announcement。

## 驗證界線

Browser fixtures驗enum-only counts、serialized valid/invalid、restricted/unavailable suppression、pending read安靜、Settings/reload安靜，同playback rejection isolation。唔證明可聽native output；native endpoint同實體主機音訊驗收分開。
