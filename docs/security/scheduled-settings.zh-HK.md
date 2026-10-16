# 排程偏好核心及主機服務

[English](scheduled-settings.md) · [安全索引](README.md)

`src/shared/scheduled-settings.mjs` 係portable offline候選，驗規則、civil-time時段、臨時逐設定覆寫、外部結果及persistence/history交易接縫。唔連網、寫原生儲存、改設定、輪詢timer、取憑證或操作renderer，同建置工作排程用途不同，唔接管sibling browser schema。

## 明確設定registry

每操作要主機准入registry：精確key→同步validator。key係flat身份，唔係可執行object path。base/rule/external只可含已登記且validator接受值。core唔內置一份固定appearance清單，處理端要獨立接入實際語言、theme、density、color、type、motion、display-name等，每validator驗真完整schema。憑證、授權、檔案能力、私人用詞、broker效果唔可排程，asyncvalidator唔算成功。

回獨立flat values及provenance，唔指派任意巢狀key、求值code、改永久base或宣稱GUI已套用。實際套用/重設、不可用說明、School優先、三語、可見控制、search/palette及無障礙另整合。

## 第1版文件

根精確 `schemaVersion:1`、非負integer `revision`、明確 `timeZone`、有序 `rules`。未知版唔靜默遷移，revision低於最大safeinteger，耗盡拒絕唔wrap。timezone要當前 `Intl.DateTimeFormat` 認得，明確IANA/UTC，接受runtime ICU alias唔另發明表。

rule精確id/label/enabled/priority/startDate/endDate/startTime/endTime/days/values/source。ID1–80ASCII、文件內unique；label1–160碼點冇C0/DEL；enabled布林；priority−1000至1000。日期null或真Gregorian `YYYY-MM-DD`、0001–9999，首尾包含。時間必須完整 `HH:mm`、00:00–23:59，唔接受半時段。days只 `{type:'everyday'}` 或 `{type:'weekdays',weekdays:[...]}`，1–7unique、Sunday0至Saturday6，每天係一rule唔複七份。values非空允許map，空schedule有效。

原UTF8最多262144bytes、256rules、8container層、每object256keys、array256項、key160碼點、genericstring4096、每valuesmap16384bytes，另有窄欄/source限制。scalar要JSON/finite，unsafekey、額外欄、decodedduplicate、壞UTF8/JSON/日期/設定整份拒絕。`parseScheduleBytes(bytes,options)`先驗wirebytes/duplicate；`validateScheduleDocument(input,options)`驗已parse並copy，typedcaller唔可先普通JSON.parse吞duplicate。

## Civil time及DST

`evaluateSchedule({document,base,at,registry,...sourceOptions})`收epochmilliseconds，用文件timezone、Gregorian、Latin數字及24h `Intl.DateTimeFormat` 找真本機日期/分鐘，唔猜UTCoffset，start包含end排除。

start<end同日；start>end跨午夜，凌晨屬上一civil開始日期，datebound/weekday都如此。Friday最後allowedstart、Saturday02:00結束，Saturday01:59仍活躍，02:00唔係。第一allowedstart之前凌晨唔可借未來日。

start=end代表所選整civilday午夜至下午夜，唔係由該時間起24h。DST春日可23h秋日25h，不存在分鐘冇實際instant故唔match，重複秋分鐘兩次match。跨日減法只Gregorian日期，唔用offset arithmetic。

match較高priority贏，同priority後array項贏，每setting獨立，所以高priority只改theme唔抹低prioritylanguage。完rule回其他match或原base，remote派生值唔存永久base。

## Source及真特權界線

- local `{type:'local'}` 套rule允許值。
- HTTPS `{type:'https',url,refreshMs,timeoutMs,maxResponseBytes}`，回覆只rulevalues已允許key子集。
- Home Assistant `{type:'home-assistant',baseUrl,entityId,refreshMs,timeoutMs,maxResponseBytes}`，base為originroot，entity只boundedlowercase `binary_sensor` 或 `input_boolean`，on套本機值，off唔套。

host精確allowedorigin，URL要canonical、ASCIIpath、冇double slash/query/fragment/credential，dot/encodedpath拒絕唔normalize去另一目的地。必須HTTPS，只有host另啟loopbackdev且精確准 `localhost`/`127.0.0.1`/`[::1]`加port先HTTP。refresh30sec–24h、timeout100ms–30s、response1–65536bytes，descriptor唔可token/vaultref。

語法唔做DNS/SSRF保證。下述provider獨立pin已解析目的地，拒redirect及private/link-local/metadata，除明確HomeAssistant/dev；有bytes/time/cancel及offline/auth/rate分類。HA憑證由stableaccountvault，唔入rule/response/log/history。core冇network。

## 外部generation及取消

`createExternalScheduleCoordinator(options)`只協調將來provider唔自call：

1. `reset(document)`驗新config，加generation、abort、撤舊receipt，每次改文件包括同revision外改都呼。
2. `reconcile(document,at)`取消不活躍window及結果，新clock觀察先做，重入可freshfetch。
3. `begin(document,ruleId,at)`驗active/exactidentity/minrefresh，回單請求值及 `AbortSignal`；允許替換會abort舊，provider只用admitteddescriptor。
4. `settleBytes(token,bytes,at)`驗原有界UTF8/duplicate/response；`settle(token,payload,at)`係已strictparse接縫。舊/用過、timeout、cancelgeneration、壞值唔替新結果，舊壞response唔abort新request。
5. `snapshot()`供evaluate不可變臨時receipt，`cancel()`abort/revoke全部。舊snapshot亦被取消/替換撤銷，綁exactconfig，唔可序列化重造或同revision改rule重播。

回精確 `{schemaVersion:1,status,values}`，status ready/off/failed。HTTPSready要非空validsubset，off/failed空。HA永遠空values，ready係verifiedon用rulelocal，off係verifiedoff。provider要由真Boolean映射，缺憑證/unavailable/unknown唔當ready。

有效結果觀察後一個refreshinterval失效，缺/過期/failed/invalid/off按setting落其他local/base。genericcode/ruleID只復原上下文，冇body/credential。coordinator只generation保護，唔backgroundloop，host管有限refresh、clockchange及本地化非阻塞復原。

## Persistence/history接縫

`createScheduleStore({adapter,...options})`依序load及replace(document,{expectedRevision})，snapshotcandidate、重讀驗committedbytes/revision，再adapteratomic比較exactbytes、存新bytes+history。缺expectednull，首commit0，之後各+1，increment後再驗避免revision增大超bytes。queue失敗唔毒後續。

adapter `read():Promise<Uint8Array|null>`、`commit({expectedBytes,bytes,receipt}):Promise<boolean>`，只有exact比較、document及只增history同交易成功先true，falseconflict、throwunavailable。receipt只version/createupdate/fromto，owner可同交易綁完整批准history。接縫冇自己lock/CAS/browsertransaction/durablebackend/跨processownership，分開寫doc/history唔符合，此core切片冇改workspace或hoststore。

## 原core證據及剩餘

原Linux `tests/scheduled-settings.test.mjs` 十二通過：逐setting/base、每日/weekday/date、跨夜末日、整日、IANA、DST兩次/跳分鐘/23h、schema/source/limits、stale/timeout/invalid/off、HAboolean、duplicatebytes、cancel/revoke、config綁定、transaction/historyconflict/failed/reload/revisionbytes，使用memoryadapter。唔證browser、真provider/nativevault、全settingconsumer/editor/historyUI、語言/無障礙、clockchange、runtime畫面、Windows或獨立A/D/C，offlinecorepass唔完成feature。本輪冇重跑。

## 私人每profile SQLite候選

`src/main/preferences/schedule-store.mjs` 有 `createSqliteScheduleAdapter({directory,profileId,registry,...sourceOptions})`，directory/profile只host，實作read/commit/history({after,limit})/close。兩instance可觀同DB，以SQLitetransaction及exactbytes解conflict，profile隔離，doc+historyreceipt同交易，失敗全rollback。每頁最多100，唔prune。

固定DB獨立appID/version、精確STRICTtable/index、停extension/untrusted schema、DELETEjournal/FULLsync。外來/空既有DB、header/schema不支援、link/hardlink、換身份、WAL/shm、壞ownershipcheckpoint/unknownjournal保留並拒，唔改既有settings/workspace，credential唔入DB。

sentinel-onlywrite先造rollbackjournal，atomicflush私人checkpoint綁journal/DBidentity先寫實際rows。restart可准已知ownedjournal由SQLiterollback；checkpoint前crash留未證journal就保留不可用，唔猜。係可信目錄protocolownership，唔係防可改目錄者嘅crypto。唔盲刪/恢復foreign，SQLite自己恢復已准journal。

原storeLinux十測：真multiinstance/profilehistory、兩rowwrite後rollback、checkpoint及大uncommitted寫後真子程序SIGKILL再open保舊及新commit、foreign/header/sidecar/hardlink/checkpoint、oversizerow/history、activejournal普通/symlink保留及不可用latch。用真NodeSQLite，只證所跑crash路線，唔保WindowsACL/reparse、所有powerloss階段。同步afterWrite只testhook唔renderer，冇nativeprofile/GUI。

live交易遇意外journal替換，SQLiterollback/close前no-follow移unique保留名。incident只relativeidentity/type/bytes/可選linktextdigest。原名缺時先create-newhardlink恢復，新replacement唔覆寫，保留名/incident唔prune，即使data回復目前及重開adapter仍不可用直到ownerrecovery。父/檔identity及有界symlink檢查唔保絕對敵意parentrace。SQLboundedprojection，checkpointretaineddescriptor fatalUTF8/duplicatecheck。

## 特權外部provider候選

`createScheduleSourceProvider` 喺 `src/main/preferences/schedule-provider.mjs` 收hostenrollmentarray，精確origin/kind/私人HAaddress/devloopbackflag/可選vaultref，rule唔登記destination/credential。初空所以預設無external，origin/ref/privateconsent/CA/resolver屬host，core切片冇新renderercredential/originAPI；下述獨立enrollment係後續整合。

resolve全部DNS，混合未准拒，pin一numericaddress新nonpooledconnection並核真remoteaddress。publicAPI唔可private/loopback/linklocal/metadata/multicast/unspecified/documentation/mappedprivate。HA只精確另准RFC1918/ULA，linklocal/metadata即列出仍拒。devloopback要origin+flag，否則HTTP拒。mappedIPv6保transportfamily但共正規identitycheck。TLS驗證一直開，hostCA可擴trust但冇關驗證。

只GET，拒redirect，原bytes/全操作時間/activework/encoding/type有界，status/auth/rate只generic。cancel/timeout含resolver/vault/socket，不能abort嘅resolver逾時仍佔slot直到settle防hiddenbacklog，每await後開socket/套值前再查cancel，rawrule先strictsnapshot。core管schema/generation，用settleBytes。

HA只 `/api/states/<boolean-entity>`，憑證經vault及origin-derived `schedule_ha_` owner，只送已登記Bearer。缺/拒lookup明確失敗唔略credential，entity及on/off核後轉ready/off空值，憑證/body唔回/log/persist。冇讀真使用者HA/nativevault。原provider七真自有localHTTPS可信cert測試涵蓋core、redirect/body/auth/rate/cert、fixtureonoff/vaultref、private/mapped/linklocal/mixedDNS、timeout/concurrency/cancel、socketcancel、mappedIPv6，只fixture唔live/native證據。

## 主機偏好服務

`createSchedulePreferencesService` 喺 `src/main/preferences/service.mjs` 組store/coordinator/provider，目前原服務只准 `language`、`appearance.theme`，唔宣稱全appearance。host供directory/profileId/baseReader及可選trusteddependencies，baseReader要回兩真persisted值或throw，唔假default。start真watch+有界tick，reload/evaluate主機clock並subscribe/status；read回validdoc/null、replace存、history真receipt、refreshactiveexternal、cancel撤結果並至少30秒暫停、close清watch/timer/provider。host-only `evaluate({at})`預覽唔將任意clock入live。

safeevent精確available/watching/running/revision/externalAvailable/effective/evaluatedAt，effective只兩允許值/每key來源/appliedruleID/genericissue，冇doc/URL/body/ref/credential。storage/base/watch不可用effective null，唔假base。emptyenrollment externalAvailable false，只代表能力唔係health，真失敗每ruleissue。

replace可接IPCowner供每calltrustedauthorize，唔rendererJSON，前、await後、同步SQLitecommit前查，revokedframe唔改doc/history。已commit唔能反向撤，關consumer要讀真state，唔由冇回覆猜rollback，唔共用globalmutableauthorizer。

原service五測真SQLite/watch/eval/preview、exactevent、不可用、close、revokedpendingread零效果，冇editor/nativeenrollment/fullappearance/Windows驗收。refresh兩boundedworker派送時先begin，後rule排隊唔白花timeout；issue按rule去重，精確provider優先corefallback，唔翻倍。原五真TLSrule證最多2並行各有attempt，五authfail五issue且localfallback有效。

原storefailure亦證外來incident唔阻SQLiteclose或留writerlock，發incident失敗仍保foreign並close；retentionrename失敗用create-newhardlink核身份先移舊名，留名供復原，之後profile不可用。全部retention寫都失敗/敵意parent/實體儲存壞唔保絕對可恢復。

## 桌面橋接

main喺privateprofile建service，base讀現有settings/workspace，external初空。startup失敗unavailable，shutdown取消並等自有操作。sandboxbridge接status/read/replace/history/refresh/cancel及下述3enrollment，拒unknown/duplicate/oversizeUTF8/rendererclock/path/transport/vaultref。前後驗frame，每mutationliveauthorizer再查commit，unsubscribe只自己listener。eventfilter/freeze唔含descriptor/credential，錯只allowlist。

原combined40checks覆core/store/provider/service/IPC/preload，真SQLite儲存/刷新/讀/conflict/history且base不變，只Linuxsource，唔封裝Windows/GUI。

## 明確持久來源登記

服務 `enrollmentList/Save/Remove` 由 `src/main/preferences/source-enrollments.mjs`，bridge精確 `enrollment.list/save/remove`。圖形及真usercredential另驗。成功先 `{available:true,revision,entries}`，entry含opaqueID/label/exactorigin/kind/exactprivateaddress/credentialConfigured；布林只代表存ref，唔證nativevault/credential成功，ref/value唔回或event。

profile精確format/version/revision/entries，最多32、每origin一、UUID、label96碼點、HTTPSorigin2048字元、HA最多16address，檔128KiB。origincanonical冇path/query/fragment/credential，useroperation唔可HTTP/devloopback、CA/resolver/path/vaultref，trustedfixture另hostdependency。

privateaddress要明確Booleanconsent及精確RFC1918IPv4/ULAIPv6，唔加metadata/linklocal/loopback/CIDR。DNS/IP/connectedcheck照用，setup唔DNS/socket/fetch/讀credential。HA輸入只臨時，再vaultstableoriginowner，唔入log/history/reply。每rotation新protectedref先atomicmetadata，舊唔覆/prune。保舊要明確 `retainCredential:true`、同origin/kind、冇newtoken，省略唔等retain/clear。

save/remove要observedrevision，跨instancecreate-newownerlock，vaultawait後及publication前比exactbytes/identity及authorize。revoked/fail唔發布，失敗/unknown孤新vaultref保留。有界no-followdescriptor、duplicatecheck、exclusive暫存/flush/rename，Linuxflushparent。foreign/corrupt/oversize/link/replaced保留不可用，crash未知lock唔自刪，唔保atomicFSCAS/universalpowerloss/nativeACL。

語法同networkauthority分開，`schedule-validation.mjs`只取origin驗localrule，唔grant socket。unenrolledrule保持inert，移enrollment後local/edit/base仍可用，provider只准currentmap。缺回 `SOURCE_NOT_ENROLLED`，讀唔到回 `SOURCE_ENROLLMENTS_UNAVAILABLE`，壞enrollment唔使localprofile整份無效或把URL當權限。

watchenrollmentchange換map、abort舊、撤generation、重算temporary，唔改rules/base。讀/發布失敗同樣refresh/revoke，live冇payload，details只explicitlist，空/不可用唔宣ready。

原enrollment13測涵蓋restart/list/replace/remove、instanceconflict、privateconsent、未知field、bounds不prune、freshref/retain、vaultawaitrevocation/close零publish無ownedlock、orphan、corrupt/foreign/duplicate/oversize/link、同revision改、fail保舊、移除inert/localfallback、真TLSgenerationrevocation且setup無DNS/socket。獨立review修replaceoptions：改/刪origin保strictvalidation、advance真SQLiterevision、唔授網絡。vault係controlledtest，冇真HA/native證據，GUI/credential/A/D/C/Windows開放。

之後host/enrollment/IPC/preload原43checks含真save/list/remove、只ref保存、reply無秘密、setup無DNS、revokedmutation拒絕，同先前40core/host及全Node suite分開。本輪翻譯冇執行以上任何歷史測試。
