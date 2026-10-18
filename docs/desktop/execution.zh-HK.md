# 項目執行適配器

[English](execution.md) · [桌面文件](README.md)

本文保留各次來源增量嘅規格同當時證據界線；較後嘅特定ISO製作結果唔會自動完成全部執行／復原要求。

`src/main/execution/index.cjs` 係主程序adapter，有TypeScript declaration，唔係IPC dispatcher，唔授renderer paths。Host要native project grant同明確source execution consent，再呼叫 `grantProject({root, source, output, trustedSource: true})`。目錄已存在；source/output喺granted canonical root內分開且唔重疊，要source Makefile。Build path只接ASCII字母／數字／separators／colon／dot／underscore／plus／hyphen，拒空格同make/shell metacharacters，包括make variable `$` expansion。不支援path要明確選compatible location，唔自動搬移；唔刪或provision distributions/images/source/output/volumes。

`discover()` 十秒／64KiB探Docker server OS同WSL distributions。Missing tools係 `unavailable`，非Windows WSL係 `unsupported-platform`，唔install或build。

`start({grantId, runtime, target, jobs}, onLog)` 重驗canonical dirs/filesystem identities，回 `{completion, cancel}`。Targets只 `all`, `olddefconfig`, `savedefconfig`, `legal-info`, `source`, `show-info`, `graph-depends`；冇destructive clean或任意make args，jobs1–64。Instance內同source/output並行拒絕，host應保留一instance並用durable scheduler作global admission/revision/resources。

Docker要明確cached digest image同non-root UID/GID，欠image失敗唔pull。Owned random container，drop capabilities、no privilege escalation、無network、512PIDs、2CPU、4GiB。Source read-only/output writable，唔mount credentials/socket。Cancel只stop owned container，cleanup失敗獨立。此bounded adapter冇network，fetch-dependent需預載sources或日後admitted fetch。此基線named volume/permission repair未完，bind mounts唔證已實作。

WSL要explicit distribution，經 `wslpath` 轉host dirs。固定Linux launcher查non-root UID，在owned `setsid` session跑make，第一行標session，後續source output唔可取代identity，用於精確TERM/KILL。欠 `setsid`/`make`/`wslpath` 或non-root配置真失敗。Distribution provisioning、Linux-managed storage、Windows permissions/reparse/current WSL喺此基線未驗。Windows-mounted path可能慢。

全部argv分開，`shell:false`，唯一shell係固定程式加positional path/target，防renderer插值；自訂Makefile仍以runtime user權限執行任意source-controlled logic，non-root/container唔令untrusted source安全。Consent同revision/source locks由host負責。此基線configuration argv／scoped terminals未完。

Logs callback串流，原adapter合併限16MiB，超限 `output-limit` 取消，build24小時。Cancel/timeout/overflow用owned cleanup，remote cleanup失敗 `runtime-cleanup-failed` 要host recovery。OS process-group唔能限制刻意逃逸trusted source程序，唔claim app-restart reconnect。Durable logs/recovery由host manager處理。

`node --test tests/execution.test.cjs` 原18個Linux checks覆argv/target/root/path/symlink/grant replacement/discovery/limits/timeout/cancel/Docker隔離及cleanup failure，真non-root make fixture產出而source不變。Fixture adapter只host constructor開，唔係Windows runtime。該次冇WSL/daemon Buildroot image/Windows/managed Actions/native capture，PH05未完成。

## 來源取得同已檢視升級

`source.cjs` 匯出 `SourceService`。Host `grantRoot(root)` 授現存canonical parent；`clone`/`adopt`收一validated child同 `trustedSource: true`。Clone拒非空/symlink，停recursive submodules，用detached immutable commit，失敗保留partial。Production URL只HTTPS，無embedded credentials/query/control。Local filesystem transport只host `allowLocalFixture`。Host可選absolute Git；path/transport/lock callbacks唔來renderer。

Git argv分開，停system/global config、credential helpers、prompting、source hooks，只HTTPS。Trusted repo config/build logic仍係明確信任source一部分，唔sandbox Git。Private credential enrollment/archive/LTS recommendations另行。Command十分鐘／4MiB，中斷clone保留。

`status(projectId)` 報actual commit、branch/detached、tracked/untracked/submodule changes同dirty。`acquireRef` fetch明確ref而唔改checkout。`previewUpgrade` 要full immutable commit，回bounded diff/dirty/unknown output compatibility。`applyUpgrade` 要preview、expected original commit同consent，拒dirty/changed，只改checkout，output不變，回prior commit供另preview rollback。保留branch refs/untracked/edits，成功checkout唔推斷compatibility/snapshot/config migration。

Upgrade要host `acquireSourceLock(canonicalSource)` 回release function，原子排除active execution/source edits，欠／拒ownership即失敗；service亦串行自己mutation。Native reparse/race、Git期間external edit、durable preview、真interrupted network未驗。`node --test tests/source.test.cjs` 六local Git fixtures驗provenance/fetch/immutable apply/rollback/dirty保留/unsafe拒絕/lock denial，冇public network或current Windows Git證據。

## Managed GitHub Actions

`actions.cjs` 匯出 `ActionsService`, `generateWorkflow`, `validateExpertWorkflow`, `createGitHubTransport`。Host注OS-vault credential callback，明確選execution repo/workflow。唔自動create repo/write workflow/persist credentials/deploy/release/publish。Standard hosted只 `ubuntu-24.04`；self-hosted Linux/X64要labels同billing consent，review查compatible online runner；larger hosted labels拒絕。

Generator固定Buildroot workflow：commit-pinned checkout/upload、read-only permissions、non-root、validated named target、explicit source repo/defconfig、immutable revision input、no persisted checkout credentials、bounded time、uploaded output。係真body但唔自動install；runner prerequisites/licensing/source trust由host接納。Hosted/self-hosted相容未執行。

Expert validation只exact generated grammar（CRLF normalize），拒arbitrary YAML/anchors/extra actions/permission/shell edits，唔係general parser。改supported settings要new typed model/review。`reviewWorkflow` resolve ref，讀exact commit remote bytes，dispatch要求匹配並recheck ref。GitHub接受branch/tag，owner可能check同dispatch間移ref；用protected dedicated ref/trusted repo。Observed run不同workflow commit拒絕，但唔retroactively阻外部mutation，唔claim immutable ref。

Dispatch回correlation operation ID，唔造run ID。`observe`搜exact operation title再驗run/revision，未見係 `awaiting-run`。`jobs`讀真job/runner，cancel保持 `cancel-requested` 到觀察結果。`receipt`冇token，可host durable保存；`reconnect`驗repo/operation/run/revision先恢復observe。Discovery/runner/job lists有限並報truncation；run discovery最新100，busy時可能需retry/saved receipt。

Artifact download驗屬observed run、exact compressed size、caller SHA-256（包括有提供嘅API digest），寫exclusive partial，再link verified file，唔overwrite。ZIP extract另行。Destination先由host save grant resolve，renderer path唔授權。Failed/truncated只刪自己partial。Fetch bounded，只signed Azure storage redirects，redirect去API credentials；其他provider需admission。含credentials transport errors換bounded public codes。

`node --test tests/actions.test.cjs` 九mock tests驗workflow effects/runner billing/read discovery/byte review/dispatch/cancel/reconnect/download/truncation/credential stripping/hostile redirects。冇authenticated GitHub、hosted build、billing、repo mutation或live download，係protocol證據。

## Host來源操作整合

`src/main/source-operations.cjs` 嘅 `createSourceOperations` 用exact fields/bounded public errors。Host callbacks：`chooseDirectory()`、`resolveWorkspace(workspaceId)`、`onSourceAdopted({root, source, revision, branch})`、`acquireSourceLock(canonicalSource)`。Picker回native existing parent或cancel；resolver只authorized trusted `{source}`。Registration用selected parent作root、保留outputs，可回 `code: "ADOPTION_REQUIRED"` 並保留clone，host project store保存後回 `{workspaceId}`。Lock原子排除build/config/source，欠時 `code: "SOURCE_BUSY"`。`sourceOptions`只host dependencies。

`handle` 各action除 `action` 外欄位如下：

| 操作 | 欄位 |
| --- | --- |
| `source.choose` | 無 |
| `source.clone` | `selectionId`, child `directory`, HTTPS `url`, `ref`, `trust: true` |
| `source.status` | `workspaceId` |
| `source.ref` | `workspaceId`, `ref` |
| `source.upgrade.preview` | `workspaceId`, immutable `revision` |
| `source.upgrade.apply` | `workspaceId`, `previewId`, `expectedRevision`, `consent: true` |
| `source.rollback.preview` | `workspaceId`, successful Apply嘅 `rollbackId` |
| `source.rollback.apply` | `workspaceId`, rollback `previewId`, `expectedRevision`, `consent: true` |

回 `{ok: true, ...result}`／`{ok: false, code}`，clone/selection唔回raw errors/stderr/paths。Handles綁workspace/expected revision/upgrade或rollback，rollback要fresh diff同explicit Apply。Unknown fields/renderer paths/commands拒絕。Clone唔自動cleanup，包括registration失敗。只HTTPS Git clone，冇archive。Grants/previews/rollback receipts session-scoped，restart要re-adopt/new preview。`node --test tests/source-operations.test.cjs` 四local Git fixtures驗registration conflict保留、selected clone/fetch/upgrade/rollback同negative authority/trust/foreign preview/stale/consent/dirty/lock，唔驗Windows/network；root dispatch/renderer另整合。

## 有序外部樹

`grantProject` 可收host `externalTrees: string[]`，預設空；非空要 `trustedExternalTrees: true`，表示明確execution consent。Renderer paths先native admission。Regrant完整驗新值先加grant，失敗唔撤舊grant。

最多32unique canonical dirs，按輸入次序，各有normal非symlink `external.desc`/`Config.in`/`external.mk`。拒alias、unsafe chars、Windows drive prefix以外colon、同output overlap；可host獨立選root外樹。記directory/descriptor identity，執行前包括async translation後重查，missing/replaced/symlink報 `external-path-changed`。只驗authority/existence，唔係完整descriptor semantics或immutable content。

Launcher只一 `BR2_EXTERNAL=...` make argument，renderer唔供vars/options。Linux fixture用canonical ordered paths，WSL逐樹translate並拒unsafe，Docker只讀mount `/external/0`、`/external/1` 等，傳ordered colon list。空明確 `BR2_EXTERNAL=`。保留source/output/cancel，source locks仍host。四新增Linux checks覆consent/count/duplicate/descriptor/regrant/replace/delete/Docker argv同真non-root make ordered list、descriptor不變；suite18過，該次無WSL/daemon。

## Compiler環境

`probeEnvironment({grantId, runtime})` 由真 `gcc -dumpmachine`／`gcc -dumpfullversion -dumpversion` 回 `{hostArchitecture, hostGccVersion}`，唔收caller command/script/environment/compiler args。Architecture取compiler target第一部分，Buildroot aliases：`i.86`→`x86`、`sun4u`→`sparc64`、`arm*`/`sa110`→`arm`、`ppc64`→`powerpc64`、`ppc`/`macppc`→`powerpc`、`sh*`→`sh`，唔取running kernel。保留full GCC，consumer另推major。Probe前後重驗project/external grants；missing tools/bad output/expired/root明確失敗。

Docker同cached digest/non-root，無project mounts、read-only root、無network、dropped caps、bounded CPU/RAM/PIDs，timeout只停owned probe。WSL固定Linux八秒timeout、一秒kill grace，欠GNU `timeout`明確prerequisite失敗；outer十秒/4KiB。Linux fixture要host-only flag/non-root。兩checks驗argv/normalize/invalid/root/extra fields/revoked同真Linux compiler；另12mapped/unchanged target fixture，18suite過，唔證WSL/daemon/Windows。

## 並行持久建置排程

`src/main/jobs/scheduler.cjs` 嘅 `createBuildScheduler` 排既有durable manager，唔取代ownership/cancel/retry/log/restart記錄。Host一scheduler同一manager，enqueue durable `payload.intent` `{projectId, sourceRevision, configRevision}`。Revision要真content evidence，例如admitted source revision加bounded all-source dirty snapshot，同authoritative config revision；directory identities/path唔係content。Enqueue前capture，retry保留原intent，dispatch唔靜靜換current source。

Host `resolveAdmission(job)`核原intent同current content，回 `{projectId, source, output, externalTrees?, resourceDomain, storageDomain, cpuSlots, memoryBytes, storageBytes, intent: {sourceRevision, configRevision}}`。Scheduler比較intent/驗canonical dirs，持source/output/external leases及可選host `acquireLease(admission)`後再resolve，防stale觀察。Host配置/package/source mutations必須用同leases。Root dispatch另整合。

`observeResources(admission)` 回 `{resourceDomain, storageDomain, cpuSlots, memoryAvailableBytes, storageAvailableBytes}`，未知null。Domain代表shared capacity，唔係job：同runtime共享resource domain，同filesystem outputs共享storage domain。Unknown保持queued `BLOCKED_RESOURCE_UNKNOWN`。Explicit `limits`有global `{maxConcurrent, cpuSlots, memoryBytes, storageBytes}`，positive CPU/RAM、nonnegative storage係host reservations，唔係measured needs/future promises。Observed capacity亦限制每runtime/filesystem，active builds已佔memory同reservations保守合併，觀察後usage仍會變。

`pump()` 最多 `maxScan`，每次rotate window。只每project最早queued有資格，獨立project可並行。Project/source/output/external leases跨project排除ancestor/descendant overlap。`acquireMutationLease({projectId, source, output, externalTrees?})` 回idempotent release或 `SOURCE_BUSY`。Leases/reservations保留到真completion，包括async cancel cleanup；release mutation會再要求排程。Capacity/external變更要host再pump，唔無限poll。Callbacks預設15秒，`callbackTimeoutMs`最多60；timeout保持queued `BLOCKED_ADMISSION_TIMEOUT`，late lease即釋放。

`status()` 無paths報running reservations/blocked reasons，`awaitIdle()` 等目前scheduling/running，可留blocked queued。`close()` 停新admission保留queue，唔取消active；host可經manager明確cancel再await cleanup。Reload queue要new host-validated pass，interrupted唔自動replay。Unexpected run-start失敗隔離該instance，唔重複retry。九focused checks用真durable manager/controlled adapters驗concurrency/FIFO/resources/unknown/cancel reservation/ancestor exclusion/close/restart/races/immutable intent/scan fairness/lease recovery/callback timeout，唔係real consumption。

## Runtime資源觀察

`probeResources({grantId, runtime})` 回 `{cpuSlots, memoryAvailableBytes, storageAvailableBytes, observedAt, constraintModel}`，metrics非負safe integer或null。Fixed non-root commands讀affinity CPU、可見cgroup-v2祖先CPU quotas/memory limit-current、Linux `MemAvailable`、output filesystem `df -Pk`。cgroup v1/inaccessible hierarchy/unresolved namespace留CPU/RAM未知；fractional CPU向下取whole slots，唔用猜測host值。

Docker同cached digest/non-root、fixed2CPU/4GiB、drop caps/no network，只read-only mount output量真filesystem；host cgroup namespace唯讀觀察，unsupported policy真失敗。WSL只translate granted output，同fixed timeout/kill grace。兩者outer十秒/4KiB，root/external identity前後驗。只support admission，唔enforce WSL quota或保證build fit。兩新增checks驗Docker readonly argv、unknown同真non-root Linux df且output不變，無native WSL/daemon/Windows。指令 `node --test tests/execution.test.cjs tests/build-scheduler.test.cjs`。

## 桌面佇列整合

Operations用durable scheduler。`build.submit` 收exact `{workspaceId,target,runtime,jobs}` 同可選exact `resources:{cpuSlots,memoryBytes,storageBytes}`，回accepted durable queued job，唔claim started。Scheduling查native authority、original intent、actual probes、leases，再content recheck。Unavailable runtime/unknown capacity留queue有reason，冇direct-start fallback。

Legacy至少2CPU/4GiB RAM/8GiB storage。WSL default `max(2,jobs)` CPU，explicit要cover make parallelism。Docker至少完整fixed2CPU/4GiB，不受make jobs改變。Explicit CPU最多64，WSL RAM256MiB–256GiB，Docker4–256GiB，storage0–1TiB。拒invalid/extra fields。係admission budgets，唔係measured requirement/output estimate/new runtime args。Zero storage只移除free-space floor，唔代表無寫入；source/output保留同filesystem失敗獨立。

Default global最多4builds、32CPU、32GiB RAM、128GiB storage；trusted host可其他validated policy。一個conservative local resource domain合併supported local runtimes，storage用host device identity；observations再限。Docker probe驗並排除自己artificial2CPU/4GiB leaf，讀shared parent/VM容量，真inherited限制仍有效，唔將independent container quotas加成假host容量。WSL reservations唔設OS quotas，admission唔保證future use/physical capacity/build成功。

`jobs.pump` exact `{}` 要求bounded pass，`scheduler.status` exact `{}` 回 `{closed,running,blocked,reservations,counts,limits,defaultReservations}`。Running含job/project IDs/resources，blocked含job IDs/reasons，無paths/source bytes。Reasons：`BLOCKED_RESOURCE_UNKNOWN`, `BLOCKED_CPU_LIMIT`, `BLOCKED_MEMORY_LIMIT`, `BLOCKED_STORAGE_LIMIT`, `BLOCKED_SOURCE_BUSY`, `BLOCKED_PROJECT_FIFO`, `BLOCKED_INTENT_CHANGED`, `BLOCKED_AUTHORIZATION_REQUIRED`, `BLOCKED_EXTERNAL_AUTHORIZATION_REQUIRED`。Capacity要fresh timestamp，unavailable/malformed/stale唔猜。冇continuous loop。

同project FIFO、獨立不重疊可並行。Leases/reservations到實際完成及cancel cleanup。Config writes/runtime preferences/external activation/package/source clone-ref-upgrade-rollback用同ancestor-aware leases；未存在clone child保守鎖existing selected ancestor。會改output嘅guest/conversion亦取leases，inspection仍可用。只協調admitted service，唔隔離其他apps或trusted source刻意執行任意code。Server/tool processes/external editors唔因此變managed jobs。

## 綁內容建置意圖

`src/main/jobs/build-intent.cjs` capture普通source files、有序external同output `.config` deterministic aggregate receipts，path/inode唔代content。Digest含relative names/modes/full normal-file hashes/literal symlink bytes/bounded Git HEAD-ref-packed-ref-shallow receipts。排除Git config/hooks/logs/index/object history，bytes唔入payload。Non-UTF-8 names明確失敗，唔alias decoded names。Ref-only change令intent失效但唔保存history/credential config；config digest分missing同actual bytes。

Metadata version2：`{version,entries,bytes,excludesGitObjectHistory:true,symlinkPolicy:"link-text-only",symlinks,limitations:["SYMLINK_TARGETS_OUTSIDE_CAPTURED_FILE_NAMESPACE_ARE_NOT_BOUND"]}`。只hash/count/policy/limitation離helper，唔回／存source contents/path inventory/symlink destinations。Runtime/reservations另typed fields。

Link-text-only支援Buildroot filesystem-template absolute target-system links，只讀link text/identity，唔resolve/traverse/copy/read referent。普通in-tree target獨立hash，namespace外referents明確唔係immutable captured inputs。Link text唔授別host path；仍需source execution consent，receipt唔係sandbox或全部custom build可讀檔reproducibility lock。Git refs/project/config roots/external authority有更嚴canonical/link checks。

Capture最多50,000entries、512MiB total reads、64MiB每file、depth64、十秒，directory enumeration亦用global entry budget。Bounded buffers/nofollow可用則用，open/read後驗descriptor，拒multiply linked regular files，回前重驗identities。Corrupt/changing/unsupported/excess明確失敗，唔改inputs或降級。Roots/config唔可symlink；external要current native handles。係optimistic checks，唔係對抗最後check後hostile replacement嘅atomic CAS。

Queued jobs retry永留原 `{projectId,sourceRevision,configRevision}`，changed就blocked，`jobs.retry`唔捕current冒充舊intent；新 `build.submit`先係new content submission。Reload無persisted authority，要native adoption/new external selection/activation先probe/execute。Old records欠intent保持blocked，冇path-only fallback。Shutdown停admission、保queue、cancel owned、await cleanup；pre-execution hashing取消唔可late launch。

Host/hash fixtures用真manager/controlled adapters驗concurrency/FIFO/unknown/insufficient/reservations/stale source-config-external/unchanged retry/restart reauth/leases/cancel/dispose/preservation。Official2025.02.1唯讀capture19,423entries、約22.2MB、181literal links、約4.5–5.3秒，只證該source capture，唔係build。此單元native Windows/WSL/daemon未驗。

## 持久清理隔離

Host要求runtime start前寫pending recovery。Effects前await ownership checkpoints：Docker綁operation token/owned container同observed daemon；WSL綁distribution/boot/PID namespace，再session PID/start time，先開fixed startup gate。最後await checkpoint後、startup authorization前重查live grants/dir/external identities/cancellation。Pre-spawn authority拒絕唔留source/output locks。

Recovery只bounded identities/job/workspace IDs/times，無source bytes/credentials/paths，最多1,024unresolved同1MiB serialized，滿就拒絕唔prune。唔授權。Invalid/foreign/oversized/duplicate-key/multiply-linked/symlink/unexpectedly changed storage保留並拒。JSON最多1MiB/depth16，每object decoded duplicate keys拒絕。

Typed `RUNTIME_NOT_STARTED` preflight證owned runtime未spawn，可清pending成failed job；ownership checkpoint failures唔適用此證明，保持拒絕。

Unverified cleanup係 `interrupted`，即使要求取消亦唔可報成功cancel。Quarantine跨restart、因unknown shared consumption阻全部新build，拒同saved project source/output/external descriptors重疊mutation。Descriptors只denial evidence，唔新filesystem authority。獨立inspection可用；native project同相同ordered external reauth仍可，隔離期間改paths拒絕。冇automatic expiry/timer lease release。

`scheduler.status`另回 `quarantine:{unavailable,records:[{jobId,workspaceId,reason}]}` 同 `quarantinedReservations:{cpuSlots,memoryBytes,storageBytes}`，同active totals分開。Reasons `RUNTIME_CLEANUP_UNVERIFIED`／`RUNTIME_IDENTITY_UNAVAILABLE`，新admission `BLOCKED_RUNTIME_RECOVERY_REQUIRED`，無ownership receipts/paths。Old interrupted欠reservation唔等於known free。

`jobs.reconcile`只 `{id}`，要renewed project/external authority、read-only ownership `verified-stopped`、fresh known CPU/RAM/storage，先清record再pump。Unavailable runtime/changed daemon-distribution namespace/reused identity/missing checkpoint/unknown capacity保quarantine。唔收renderer assertions/arbitrary PID/path/receipt/assume-stopped flag。唔kill任意runtime、reconnect舊build或mark成功；retry保original intent。

Linux fixtures驗journal preservation/unverified cancel/restart reauth/admission-mutation block/missing ownership/failed recovery/unknown capacity/explicit recovery。Real Windows/WSL/Docker recovery未驗，刻意escape同external restart超出owned模型。

## 桌面佇列控制

Builds有Inspect queue同Recheck admission。前者讀limits/counts/active/quarantined reservations/reasons；後者可開始eligible queued work。Submission typed CPU/RAM/storage；details保captured target/jobs/source-config identity，唔靜靜換current content。

Interrupted cleanup有Renew project access同Verify cleanup；renew開native project及external reauth。Verify只currently adopted project可用，呼叫narrow reconcile。Unknown identity/failed verification保持recovery required，冇assume-stopped捷徑或saved path授權。

十四affected browser checks同兩viewport checks通過queue/catalogue整合，包括pending cancel/unavailable/retained English feedback，以及960px雙語暗色、1440px英文亮色可達操作。Native pickers/runtime cleanup/upstream access喺呢啲checks係controlled fixtures，唔係native acceptance。
