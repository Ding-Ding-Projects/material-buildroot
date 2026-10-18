# Article source-language metadata

The documentation producer derives article language from the tracked source path. An exact `.zh-HK.md` suffix declares Cantonese (`zh-HK`); other admitted Markdown articles retain the English (`en`) default. This follows the existing translation filename convention. It does not inspect prose, translate content or certify that an article is a complete translation.

The article metadata displays **Project record · Cantonese source** or **Project record · English source**, with corresponding Cantonese interface labels. Each label declares its own language. The rendered Markdown body has an explicit `lang` attribute independent of the visitor's English, Cantonese or bilingual heading preference. Changing that preference changes interface labels only, never the article contents or source identity. The surrounding shell remains English with individually marked translated spans.

Article routes, original source links, bookmarks and Markdown rendering remain unchanged. The production checker verifies the expected label and body language for every generated article. `node website/test-article-language.mjs` exercises both source kinds and rejects swapped labels, missing labels, missing language and the wrong body language while checking exact content preservation. Built browser checks remain separate from these source checks.

## 粵語說明

產生器按來源檔名判斷文章語言：精確以 `.zh-HK.md` 結尾就標為粵語，其他已接納 Markdown 沿用英文預設。呢個係檔名規約，唔會自動翻譯、分析全文或證明翻譯完整。文章正文同介面標籤各自宣告語言；切換頁首語言只改介面，唔改文章內容、網址或來源連結。正式檢查器會逐篇核對標籤同正文語言，瀏覽器實際顯示同鍵盤操作仍須另外驗證。
