# Language, voice, and display wording

The desktop keeps its existing persisted English, Hong Kong Cantonese and bilingual language choice. Fresh settings use bilingual and the system theme. The independent voice controls live below the language-save controls in Settings and are indexed by settings search. Both humor levels default to 5 and can be reset independently to 5. Level 1 uses explicit neutral Cantonese alternatives and the factual English base without added tone. Levels 2 through 5 add language-specific tone to complete application-authored message sentences, including warnings and errors. Compact control labels stay unchanged. The original message facts remain intact.

The shared sentence formatter is used by the existing panel localization helpers. Literal-only call sites explicitly identify authored copy; dynamic records and interpolated values remain outside replacement. Neutral Cantonese alternatives are checked-in full-string resources, not runtime search-and-replace rules. Captured status messages retain authored spans separately and format them on display, so changing language, humor or the vocabulary also updates already-visible status messages without changing external values. Tone resources are separate from formatting and preference storage. Connected Lit components repaint when wording preferences change. Shared restricted mode forces English and suppresses tone and vocabulary controls while retaining their saved choices.

The display name accepts an empty value or up to 96 Unicode code points, rejects control and direction-override characters, and changes the local header and About title only. Empty restores Material Buildroot. It does not change installed identity, package names, project data, paths or exported records. Preferences use a dedicated versioned local cache with bounded readback and exact field validation. Storage failure is displayed without reporting a successful save; invalid cached data falls back to defaults. No source filename is retained.

Personal vocabulary continues to use the existing Settings picker and window-wide drop route. The complete payload must satisfy schema version 1, the 256 KiB UTF-8 limit, depth 8, 160 code points per key and 1,000 per value, with duplicate and unsafe keys rejected. There is no fixed entry count. Replacement and clear use the same private cache controller; clearing restores shipped wording. File contents, paths and mappings do not enter logs, exports, history or network calls. Replacement applies to explicitly declared authored interface-copy boundaries, including labels and accessible names, never dynamic localized strings that might include external records. The existing drop celebration remains the success feedback route.

## Current limits

This change is source implementation only. Production, runtime, persistence, accessibility, all language/layout tuples and editorial completeness have not been exercised in this task. Existing English-only provider records and technical identifiers remain verbatim. Literal authored Cantonese copy uses neutral resource alternatives before tone is applied. Dynamic technical/provider values are intentionally unchanged. Native title-bar behavior, complete runtime copy coverage and new panels authored by concurrent work remain outside this source receipt. The deployed documentation surface is independent and is not made complete by these desktop changes.

## 香港粵語

桌面保留原有英文、香港粵語同雙語設定；首次使用預設雙語同系統主題。設定頁新增兩個獨立幽默程度控制，預設各為 5，可以分開重設。第 1 級唔加語氣文字，第 2 至 5 級會為完整訊息加入各自語言嘅語氣，錯誤同警告嘅事實保持不變。共用限制模式會使用英文並暫停幽默同個人詞彙，原有選擇仍然保留。

顯示名稱只影響本機頁首同關於標題，留空即恢復原名，唔改安裝識別、檔案或者匯出。個人詞彙沿用原有本機匯入及拖放流程，完整驗證先套用，清除即還原原文。本次只完成原始碼，未執行實際介面、重新啟動、無障礙或者完整翻譯驗證；已加入明確中性語句資源，幽默語氣分開處理；外部記錄保持原文。原生標題列行為同執行時完整覆蓋仍待驗證。
