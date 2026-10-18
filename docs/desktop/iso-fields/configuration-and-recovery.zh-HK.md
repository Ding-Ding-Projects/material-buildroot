# ISO 配置與復原

[English](configuration-and-recovery.md) · [欄位目錄](README.md)

## 用途與建議預設

批准固定 ISO 設定要求之前，先預覽目前來源需要嘅條件。Apply 會重新協調 Kconfig，並回報要求嘅每個值係咪仍然有效。建議只喺確認配置有效後先開始建置。指令正常結束，同要求真正生效，係兩回事。

## 例子與限制

有效流程係 Check、批准、Configure、Build、Refresh，最後 Inspect。來源修訂已改變，就必須重新預覽。即使 Apply 回覆成功，只要 `effective: false`，配置仍然未完成，Build 唔會啟用。配置編輯器仍保留復原上一步嘅功能。

## 取消與復原

Cancel 只針對已記錄嘅工作身分同序號。提出取消之後要繼續 Refresh，直到主機回報終止狀態。要求取消唔代表程序已停止。途中可能已產生部分輸出，唔可以將佢當成可啟動媒體。

先讀記錄，處理實際原因，再明確開始新建置。流程唔會自動刪除或重試。切換工作區會清除本機計劃畫面，但唔會取消主機上進行中嘅工作；需要跟進時，請到原有 Jobs 檢視找回工作。

## 建議下一篇

[輸出與驗證](output-and-validation.zh-HK.md) · [完整工作流程](../iso-workflow.zh-HK.md)
