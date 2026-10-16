# 共用體驗模式主機協定候選

[English](shared-mode.md) · [安全索引](README.md)

`src/main/privacy/shared-mode-service.cjs` 提供明確共用本機記錄、即時觀察、精確改名及本機驗證退出，係可重用協定候選。原要求冇找到已存在通用路徑或跨程式憑證交換，caller要向每個參與程式提供同一獲准絕對 `sharedDirectory` 及相容protected vault。各程式 `userData` 或browser-origin local storage唔建立通用狀態。

既有sibling瀏覽器用自己origin storage/broadcast，唔覆其格式或宣稱相容。共用檔名唔證跨產品解密，provider要相容帳戶/provider身份，支援主機互通未核實。

## 精確磁碟協定

固定 `shared-mode-v1.json`，根精確 `protocol`、`schemaVersion`、`revision`、`active`、`displayName`、`credential`。protocol `shared-experience-mode`、version1、新小寫UUIDv4、active布林。displayName1–96碼點、含非空白、冇C0/DEL，拼寫空格原樣。

credential null或精確kind/reference，kind pin/password/passkey，reference為vault UUID。active必須有credential。檔最多8192UTF8bytes，未知欄/版、decoded duplicate、壞UTF8/JSON、無效credential或外protocol拒絕，唔初始化/覆寫。唔存password/PIN/hash/passkey registration/用詞bytes/檔metadata/普通偏好。

vault owner固定 `shared_experience_mode_v1`，主機注入 `write(owner,protectedString)`、`read(reference,owner)`。PIN/password verifier保護字串，獨立random16-byte salt、32-byte scrypt，非同步N16384/r8/p1、32MiB，`timingSafeEqual` 比較。登記規則PIN4–12十進位、password8–1024碼點、輸入最多4096UTF8bytes，要重複確認，verifier唔匯出或回傳。

## 主機 API

`createSharedModeService({ sharedDirectory, vault, passkey?, watchFactory?, watchRetries?, retryDelayMs? })`，宣告在 `shared-mode-service.d.cts`。

- `start()` 准入目錄、觀察、load，唔隱式初始化/覆寫。
- `initialize({displayName?})` 只檔真正缺少時建inactive無credential，冇自選名先用原名。
- `enrollCredential({expectedRevision,kind,secret?,confirmation?,current?,registration?})` 存新verifier，舊已存在要 `current:{secret}` 或 `{assertion}` 先驗。驗證/vault/保存失敗保舊可用，record提交失敗嘅新孤立vault保留唔自清。
- `enter({expectedRevision})` 要已設credential metadata，設active但唔先讀/證verifier，vault喺登記/替換/退出檢。唔可稱enter證健康或保證日後能退出，退出驗唔到明確錯，使用者reset仍可。
- `leave({expectedRevision,secret?,assertion?})` 驗目前credential先inactive。
- `rename({expectedRevision,displayName})` 精確儲存，所有copy/accessibility/discovery都要用選名。
- `status()`、`subscribe(listener)` 只安全snapshot；`reload()` 再驗storage；`close()` 停觀察/新修改。
- `recovery()` 回精確共用目錄/record及體驗聲明，冇刪除或盲resetcredential方法。

snapshot只有available/watching/configured/active/displayName/revision/credentialKind，冇reference/verifier。不可讀/觀察則available false，configured/active/revision/kind null，保最後成功精確選名，唔換原名。健康真正冇檔係明確reset/unconfigured，唔同壞/不可讀。使用者刪共用record係文件reset，影響所有參與程式。

passkey adapter要真 `enroll(registration)`、`verify(storedRegistration,assertion)`，自管新challenge、replay、帳戶綁定、平台同意及crypto，registration入vault。冇adapter回 `PASSKEY_UNAVAILABLE`，唔發明替代。本程式未實作或證native provider。

## 並行、觀察及准入

每修改create-new獨佔 `shared-mode-v1.json.lock`，保randomowner值/檔身份，重讀真record、查expected revision並保精確bytes/身份。非同步credential後及atomic替換前再驗bytes/身份/lock。外部沿同revision改或者相同bytes換inode都判stale並保留，別process有限busy唔無限等或靜默覆。lock初始化失敗只移證明原inode且含自己生成完整/部分prefix者，foreign replacement不變。只刪自己身份/值，外來/換/壞/stale唔自動刪。crash可留lock需擁有人恢復，唔猜PID、殺程序或按年齡判stale。

寫同目錄exclusive暫存、flush、atomic rename，失敗保舊commit。父身份保留再驗，拒symlink祖先/檔、hardlink、換目錄及unsafe身份。支援時no-follow，前後身份及有界讀，唔任意長。最終read→rename唔係atomic compare-exchange，合作writer要用protocol鎖；不合作仍可競爭，唔保全部敵意race。directoryfsync/powerloss及Windowsreparse/ACL待主機驗。

directorywatch可跨atomic rename，向獨立實例即時傳模式/改名/credentialkind，合併事件。watch錯/意外關即不可用，預設最多三次有界延後重接，耗盡要新service，缺watch唔默認off。subscriber只一般snapshot，其exception唔log或漏資料。

## 處理端責任及排除

係體驗偏好，唔係broker認證、加密、帳戶授權或防控制機器者。退出唔mintgrant/session。完整耐久lockoutbudget/unlockladder未整合，完整認證體驗前仍必要。

程式/瀏覽器各自要可找到控制、即時mode/精確改名、active強制英文，移除不准language/humor/vocabulary/surprise控制、route、搜尋/palette、preview及參照。保原偏好/validcache但唔套用，成功驗退出先恢復。unavailable唔推inactive，browserbridge要scope pairing同currentstate，origin-localBoolean唔代通用。

共用record/reference/verifier唔入普通export/snapshot/undo/history/sync/notification/diagnostic/log/telemetry。私人用詞cache獨立，冇payload/filemetadata入此service。實作只genericsource/error/中性test，冇讀真私人字典或protectedcredential。

## 原有檢查及界線

原Linux `node --test tests/shared-mode.test.cjs` 十二focused通過，涵蓋兩真 `fs.watch` 觀enter/rename/credential/exit、restart/reset、stale、真child lock contention、watch retry/選名、corrupt/foreign/duplicate/link/hardlink、根換、vault/passkey不可用、lock失擁、atomicrename失敗、同revision改/同bytesinode換、tempflush期間改、lock初始化cleanup/retry保foreign。in-memoryvault只驗服務，唔證OS安全或跨產品解密。原 `npx tsc --noEmit` 通過，冇GUI/companionbridge/通用既有程式/nativeWindows/passkey/全School驗收。本輪冇重跑。

## 桌面主機界線

主機喺使用者localappdata下供共用 `Ding-Ding Projects/shared-experience-v1` 同獨立protectedcredential目錄，Windows用localappdata、Linuxdevelopment用userdata。係明確選協定位置，唔證其他產品/provider互通。主機用protectedstorage並拒不可用/不安全，nativeWindows/跨產品解密未驗。

獨立verificationprofile用自己目錄，唔查改使用者真shared/vault，所以其證據唔證正常主機跨程式即時傳播。

封裝mainframe經 `studio:shared-mode`，有界duplicate-awareparser及精確action。PIN/password登記、exit、rename、revision留主機，recovery另明確read。未有provider唔暴露passkey，唔log/echo輸入或加record到workspaceexport/history。只genericboundedcode，成功或失敗非同步後都再驗frame。event只有效snapshot，configured/unconfigured/unknown一致，冇reference/hash。shutdown取消watch/close，startup等URL載入。

原host/core/preloadLinux17cases通過，含parser、async success/failure revokedframe、event及listenercleanup。GUI、完整forced-English/抑制及nativevault另需整合驗收。
