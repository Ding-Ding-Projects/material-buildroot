# 原生WSL內容意圖同配置同意

[English](native-wsl-content-intent.md) · [安全文件](README.md)

WSL項目喺已接納、非root Linux檔案系統內擷取內容。主機遍歷UNC路徑唔適合原生Linux連結，可能將有效連結報成無法讀取目錄。固定程式所屬Python helper喺記憶體執行，唔將所選來源複製到Windows，亦唔向來源或輸出寫helper檔。只回傳彙總摘要、數量同有限處理分類資料。

Version3收據保留共用界限：50,000項、512MiB合併位元組、每來源檔64MiB、十秒擷取工作同深度64。讀來源同配置時唔跟開檔連結，拒硬連結同特殊檔，讀前後核身分。每個遍歷連結部分必須屬已擷取namespace。已存在referent內容必須擷取；缺目標必須仍缺。中途外部alias即使最後返回內部都拒絕。發收據前再核連結鏈同已保存身分。

唯一獨立檔案大小分類係已宣告Buildroot預設下載快取。只喺有效配置精確為 `BR2_DL_DIR="$(TOPDIR)/dl"`，且對應cache係admitted source內已驗身分普通目錄時適用。每個cache byte仍會hash，計入同一entry/byte/time/depth界限。Cache archive每檔固定256MiB，source仍64MiB。拒unsupported/duplicate declaration、cache aliases、oversized內容同mutation。Cache identity、exact declaration digest同aggregate cache-content digest都屬intent，唔會靜靜排除。

Configuration consent、queue submission、dispatch checks同scheduler revalidation用同一runtime-aware capture。只hash link text嘅舊host receipt不足授權linked Kconfig；native receipt要更強link/content checks成功先容許。Configuration permission可執行已接納來源原生Make同Kconfig inspection commands，但permission或catalog inspection成功唔證明完整firmware build。

Transport擷取前後驗admitted WSL project，worker內再核identity，submit input前記exact owned session，並要求verified cleanup。取消同cleanup unavailable都明確失敗。Configuration inspector保source/runtime binding，用已接納Linux path mapping，唔要求host filesystem重新解讀Linux links。
