# 綑綁離線文件

[English](offline-documentation.md) · [安全索引](README.md)

文件包由既有公開網站文章清單產生，唔任意探索檔案。`scripts/documentation/bundle.mjs` 匯入 `website/inventory.mjs` 及 `website/source-boundary.mjs`，只接已收錄公開 Markdown，拒絕連結/逃逸。未收錄文章或圖唔入包，唔網絡取得。

`node scripts/documentation/bundle.mjs --root <repository> --output <generated-documentation-directory>` 要新或空、唔喺已收錄來源內嘅輸出。根 build 負責乾淨 staging/封裝，helper唔替換非空目錄。

- `index.json`：精確第1版 `material-buildroot-documentation`，有 `sourceSnapshot`、`documents`、`assets`、`issues`。
- `articles/doc-<source-path-sha256>.md`：保原文章位元組。
- `assets/<content-sha256>.png`、`.jpg`、`.webp`：有相符signature嘅已准本機 raster。

document 精確 `{id,source,file,title,category,language,summary,sha256,bytes,anchors}`，asset `{source,file,sha256,bytes,mime}`，issue `{source,reference,reason}`。aggregate snapshot 綁排序來源路徑及複製bytes，算法同網站；並行來源改變snapshot就產生失敗，空輸出替換前驗完整staging。

文章512KiB、圖片8MiB、合內容加manifest64MiB，manifest1MiB，最多1,000文章/1,000圖片參照/10,000 issues。SVG/GIF、遠端圖、未收錄、缺文章/anchor都明示缺口，唔默默算完整。SVG欠獲准sanitizer所以略過。

## 主機及顯示協定

`createDocumentationService({directory,openExternal?})` 只接可信主機絕對生成目錄，提供同步 `list()`、`searchText()`、`read({id})`，及非同步 `open({id,linkId})`，唔收路徑。未知欄或壞ID拒絕。

`list()` 回 `{articles,navigation,issues,complete}`，文章metadata精確 `{id,title,category,language,summary}`，navigation `{categories:[{name,articles:[{id,title}]}],headings:[]}`。`read({id})` 回 `{article,html,navigation,issues,complete}`，目前標題為 `{id,text,level}`。有任何issue即 `complete:false`，讀唔取得資源或開連結。

`searchText()` 回 `{entries:[{id,text,truncated}]}`，每已收錄文章一項。驗同aggregate，使用production renderer，移tags、decode entities、壓空白，每文章32,768字元並明示截短。未收錄唔入。桌面無參數 `documentation.searchText`，renderer以目前index核每項先本機match。

服務再驗manifest精確schema、生成檔名、大小、hash、UTF-8、圖signature及snapshot。symbolic link、junction改canonical path或multiply linked拒絕，缺/壞檔只sanitized失敗，唔部分成功。SHA-256抓不同步或意外改變，唔係防可同時改程式與manifest者嘅signature。

## Markdown、連結及圖片

`renderMarkdown(text,{source?,documents?,assets?})` 共用於其他獲准文案，回 `{html,headings,links,issues}`，固定parser `html:false`、關automatic linkify。table/fence/heading/reference link/描述文字可讀，raw HTML escape，唔開script/iframe/任意嵌入。其他處理端仍要自己來源准入及外連授權，共用renderer唔授主機能力。

內連 `href="#"`、`data-document-id`、可選 `data-document-anchor`，目標要喺獲准清單。GUI攔attribute用ID讀，缺/不安全顯disabled加issue。heading ID確定且重名加suffix。

外連只HTTPS，冇憑證、controls或別scheme。HTML只帶不透明source-bound `data-document-link-id`，唔直接外URL。明確點選先 `open({id,linkId})`，重讀驗文章、重算linkset、核ID先可信 `openExternal(url)`，唔接受renderer URL。`{opened:true}` 只表示開啟請求，唔證瀏覽器載入。

本機圖用 `documentation/assets/` 加escape alt。遠端、data image或未知格式顯不可用。root要將確切圖放renderer旁，保嚴CSP，唔接受任意HTML或resource path繞過服務。

錯誤只 `INVALID_REQUEST`、`INVALID_BUNDLE`、`CORRUPT_BUNDLE`、`NOT_FOUND`、`LINK_NOT_ALLOWED`、`EXTERNAL_UNAVAILABLE`，冇底層路徑。新增來源要正常index准入及重新產生。

## 原有證據界線

原Linux fixture建臨時Git index、真bundle並由service讀，涵蓋格式/導覽、raw HTML/XSS拒絕、scheme、source-bound開連、缺/未收錄/逃逸、SVG、linked article、壞hash、snapshot及linked storage，唔取網絡或提交私鑰/來源資料。

原開發機曾產63文章、11圖、23未解/不支援參照，明示不完整。只係該來源觀察，唔保證之後count。實際renderer、封裝resource及Windows另需證據，bundle同測試唔證完整offline。本輪翻譯冇重跑原測試或更新歷史數字。
