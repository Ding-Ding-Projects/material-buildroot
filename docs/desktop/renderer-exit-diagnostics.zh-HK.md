# Renderer退出診斷

[English](renderer-exit-diagnostics.md) · [桌面文件](README.md)

主程序會先撤銷桌面能力，保留原有安全行為，再將最新 `render-process-gone` 事件記錄到程式本機user-data目錄下 `diagnostics/renderer-exit.json`。冇自動reload、restart或復原聲稱。

固定version-1 JSON只含 `schemaVersion`、固定event名 `renderer-exit`、白名單native `reason`（否則 `unknown`）、帶正負號數字 `exitCode`、封裝來源SHA同產品version（不可用就 `null`），以及UTC事件時間。唔複製URL、page content、profile paths、environment values、匯入用語或任意event properties。只保留最新一份收據，新record寫好先取代舊份。Destination欠缺或不可寫，診斷記錄不可用，但唔影響能力撤銷。

收據只報native退出通知，唔診斷根本原因、唔證明作業系統故障，亦唔證明修復成功。Focused checks涵蓋exact fields、arbitrary-input排除、bounded replacement、invalid-code保留同write failure唔拋出。原文最初界線係：要等packaged application真發event先有real capture。後來特定候選觀察請分開讀[權限指南嘅記錄](configuration-domains.zh-HK.md#分開理解語義不可用)，唔由固定欄位推斷因果。
