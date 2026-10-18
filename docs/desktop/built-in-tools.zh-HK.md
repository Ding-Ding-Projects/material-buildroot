# 內置工具服務

[English](built-in-tools.md) · [桌面文件](README.md)

主程序入口 `src/main/tools/index.cjs` 匯出 `createToolsService(options)`；非同步 `execute(request, {signal, onProgress})` 回 `ok` 或穩定錯誤碼。唔暴露shell、任意URL、renderer檔案路徑、環境展開或PATH executable discovery。只經已驗證broker接駁，host options唔交renderer。

Host提供 `resolveGrant(id, mode)`，由現有native picker grant回absolute file/directory。`executables` 記錄 `{path, sha256, bundled: true}`，每次重hash。需要獨立packaged-artifact admission，設flag唔係驗證。外部轉換要真實sandbox驗證後先設 `isolationVerified`；此實作本身唔建立可攜OS converter sandbox。

## 可呼叫操作

| 類別 | 操作 | 欄位 |
| --- | --- | --- |
| Ollama | `ollama.status`, `ollama.tags`, `ollama.running` | 無 |
| Ollama | `ollama.show`, `ollama.pull` | `model` |
| Ollama | `ollama.chat` | `model`、有限role/content `messages` |
| Ollama | `ollama.install` | 可選Boolean `acquire`/`repair`，引導私人管理安裝 |
| Converter | `converter.catalog`, `converter.convert` | `category`, `format`, `sourceId`, `destinationId` |
| Queue | `queue.add`, `queue.page`, `queue.run`, `queue.cancel`, `queue.recover`, `queue.resume` | 按操作用 `job`, `after`/`limit`, `id` |
| Minecraft | `minecraft.versions`, `minecraft.install` | 按操作用 `edition`, `version`, `directoryId` |
| Minecraft | `minecraft.configure` | `directoryId`、typed `properties`、`acceptEula: true` |
| Minecraft | `minecraft.start`, `minecraft.stop`, `minecraft.status` | `serverId`，start另有 `directoryId`, `memoryMiB`, `target` |
| Editor | `editor.open` | 已接納 `editorId`, `sourceId` |
| Forge | `forge.preview`, `forge.publish` | Preview: `provider`, `repository`, `sourceId`; publish: `previewId`, `confirmSha256` |

Ollama只用 `http://127.0.0.1:11434` 固定API。Response/request/stream line/duration有限。Pull/chat增量解析progress、保留UTF-8邊界、error record令操作失敗，AbortSignal取消transport。唔虛構catalogue或download success。Managed controller有完整inventory固定官方Windows x64 manifest；其他host欠已review對應manifest就不可用。低層installer欠manifest回 `MISSING_VERIFIED_PAYLOAD`。固定payload支援verified cache或明確開啟有限official acquisition、嚴格archive/hash、安全extract同atomic versioned install，保留舊models/installations。

Converter有documents/images/audio/video/archives/structured data/text/binary encodings。Native UTF-8、JSON formatting、CSV preservation、base64/hex真正處理檔。FFmpeg/ImageMagick/Pandoc argv adapters要admitted payload同isolation；LibreOffice/archive待verified adapters停用。Output喺target旁暫存、有界限、可用時驗signature、hash，再no-overwrite發佈，source不變。獨立PDF adapter經qpdf做inspect/merge/selected-page split/extract/reorder/rotation/metadata removal。Advanced semantic validation、廣格式、真實decoder資源隔離同packaged proof未完成。CSV只保留UTF-8，唔係通用spreadsheet conversion。

Disk queue喺host `queueDirectory` 每item一JSON，初版只收conversion/model pull，串行逐記錄讀；page最多100記錄記憶體，唔受queue總長影響。Cancel/resume/restart recovery/state/results持久化，orphan running變interrupted，唔靜靜retry。私人trusted directory需single-instance ownership；resource exhaustion、power-failure crash atomicity同大型真實queue驗收未證。

Minecraft Java用Mojang官方manifest，下載只白名單HTTPS、無redirect，驗宣告size同server SHA-1再發佈 `server.jar`。Typed配置要online auth、明確EULA，初版拒覆寫現有配置。Local Java用admitted runtime，container要admitted Docker同host immutable `minecraftJavaImage` digest，drop capabilities、禁止提權、CPU/memory上限，預設network disabled。明確 `network: 'bridge'` 加validated `port` 只將Java TCP發到 `127.0.0.1`，唔開public firewall或證gameplay。Handles屬服務，stop只signal自己child。此基線server readiness、process recovery、console admin、container teardown、Bedrock payload、flavour install、SSH仍未完；後續manager文件另記擴展。固定official Bedrock page、Fabric/Paper metadata、Modrinth metadata/download可呼叫，plugin要code/licence consent，unsupported target唔報success。

Editor只啟動host `editorIds` 接納editor，加一個granted file argument。結果描述process completion，唔獨立證文件顯示。Forge preview綁provider/repository/source SHA-256；publish要matching review、source不變、scoped host `getCredential` 同提供verified readback嘅 `forgePublish`。預設冇transport/credential，preview唔publish，secret唔入結果。

## 驗證同剩餘驗收

`node --test tests/tools.test.cjs` 驗真實bounded HTTP/cancel、owned child cancel、file conversion/hash、restart queue、injection拒絕、missing payload同publication review。Fixture唔係真實Ollama/Minecraft/editor/converter/forge證據。Windows packaging、native services、完整GUI、assistant checkpoint orchestration、catalogue completeness、PDF semantics、authenticated external write/readback仍待，PH08未完成。

## 額外適配器規格

`ollama.chat` terminal後回 `{completed, message: {role: 'assistant', content}, doneReason, metrics}`；progress為 `{type: 'chat-token', message: {content}, done, ...}`，pull為 `{type: 'model-pull', status, completed, total, ...}`，沿Ollama fields。可即時render tokens，用final message持久化。

`pdf.execute` 接 `operation`（`inspect`, `merge`, `split`, `extract`, `reorder`, `rotate`, `metadata`）、`sourceId`或bounded `sourceIds`、`destinationId`、integer `pages`、`degrees` 90/180/270或 `mode: 'remove'`。固定 `qpdf` 必需；寫前驗signature、qpdf integrity同bounded page count，output再驗integrity/exact count先atomic publication。Split每request一selected-page output，host整合後queue可排多次。內容/order/rotation/metadata semantic post-write仍未完，count過唔代表語意過。Executable protocol fixture只驗invoke/count拒絕，唔係native qpdf。

Host install options：`ollamaInstallDirectory`, `ollamaCachedPayload`, `allowOllamaAcquisition`, `ollamaPayload`。Payload含exact `version`, `platform`, `arch`, `length`, `sha256`, `kind: 'executable' | 'tar' | 'zip'`, `executablePath`, `members: [{path, sha256}]`；online另要official `url`。優先cache。Tar要admitted `tar`，extract前拒traversal/unexpected files/links。驗全部members，保留舊version/model stores，唔改PATH/startup、唔要elevation或claim health。只reviewed Ollama release URLs同bounded official redirects。Provenance由host review，renderer唔供manifest/URL/destination。

Discovery actions：`minecraft.bedrock.discovery`、`minecraft.flavours`（`flavour: 'paper' | 'fabric'`，Paper可選version）、`minecraft.plugins`（`projectId`）、`minecraft.plugin.install`（`versionId`, granted `directoryId`, `acceptPluginCode: true`, `acceptLicense: true`）。Modrinth要supported loader、primary JAR、fixed CDN、exact length/SHA-512。只驗provenance/integrity唔係plugin safety；official page changed/unsupported metadata明確失敗，唔造版本。

## 原生執行檔接納

`src/main/tools/payload-manager.cjs` 嘅 `createPayloadManager({directory, bundledManifest, dialog, parentWindow})` 提供host-only `list()`/`choose(toolId)`/`resolve(toolId)`，以 `payloadManager` 傳 `createToolsService`。只接FFmpeg、ImageMagick、Pandoc、LibreOffice、ebook-convert、qpdf、Java、Docker、tar、Ollama。Renderer只known ID，path只native picker。預設Cancel notice顯示file/hash/account permission後先fixed bounded version probe。basename/version只識program family，唔證publisher或sandbox。

Bundled manifest優先，changed/invalid bytes拒絕。User-selected保留 `origin: 'user-selected'`, `bundled: false`，唔當bundled dependencies。Receipt原子存private app dir，每resolve再驗canonical path/regular file/SHA-256。Version mismatch/cancel/path/hash變化保留舊receipt。Static renderer-shaped records唔enable runtime。冇PATH search、arbitrary ID、network install或automatic execution task。

User tools係明確consented fallback，唔滿足完整bundled offline adapters或isolation，isolation gate仍必需，unsupported停用。Pinning唔消除同帳戶race或證runtime。`node --test tests/payload-manager.test.cjs tests/tools.test.cjs` 驗fixture probe/persistence/cancel/version失敗保留/path/hash變化，唔係Windows package/publisher/real adapter/GUI證據。

## 要求接納同所屬關閉

每action先exact schema，再resolve/network/launch。Unknown action、extra top/nested fields、bad grants/ports/pages、recursive queue jobs、unsupported types拒絕。Admitted request先clone再async。Queue新增typed `pdf.execute`，persisted records bounded、拒symlink、replay再admit，唔恢復重啟後file grant。

`dispose()` async拒新work、abort active、等queue取消持久化、停所屬server。Container generated name經fresh validated executable固定Docker stop；local children先termination，再bounded kill/wait。欠settlement報 `PROCESS_STOP_UNVERIFIED`，timer/signal唔係confirmed cleanup。唔收編／停無關process/container/queue/server。

Minecraft start要write-capable dir grant同host-only `authorizeServerExecution(directoryId)` 嚴格 `true`，綁explicit native consent執行server/plugin code。Renderer欄位唔授權，grant consent唔證user JAR安全。Converter/PDF仍要real sandbox receipt，native admission唔設 `isolationVerified`。集中fixtures另證effects前拒絕、queued PDF protocol、stream cancel持久queue同child exit，唔係gameplay/Docker/native qpdf/Windows acceptance。

## 固定受管理Ollama安裝同復原

`src/main/tools/ollama-managed.cjs` 嘅 `createManagedOllamaController` 收private absolute `directory`、native `dialog`/`parentWindow`、可選verified `bundledPayload`同reviewed `manifest`。Tools options有 `ollamaManagedDirectory` 就自動建。Windows x64 default固定官方 **0.40.5**（2026-10-14發佈），其他platform要另review對應manifest。

| 要求 | 行為 |
| --- | --- |
| `ollama.managed.status` | manifest可用性、installed bytes驗證、phase/version/owned process |
| `ollama.install` 可選Boolean `acquire`/`repair` | native review，優先bundled/cache，可選固定official acquisition，安裝唔啟動 |
| `ollama.managed.start` | 明確啟動admitted files/private models，驗exact owned listener/version，欠native ownership callbacks不可用 |
| `ollama.managed.stop` | 只停retained owned tree，要求settlement proof |

分開 `versions`/`cache`/`models` 同atomic receipt，保留現有system/user installation、models、config、PATH、startup。安裝唔偷啟動。Owned version損壞要明確 `repair: true`；保留舊dir，完整驗new再promote，失敗還原，唔刪models。Progress `type: 'ollama-install'`，phases `download`, `extract`, `verify`, `promote`, `installed`，已知時有bytes。收AbortSignal，另有 `cancel()`/`dispose()`。

官方archive曾喺Linux下載到ignored cache檢查，冇安裝或執行Windows軟件。大小 **1,471,226,485 bytes**，SHA-256 `5134ce7e3bc8e94d0494721c799ec293b429450d0c52461b0ee3647dd3bb4bb7` 匹配official release API。全部 **82 regular members** 獨立讀/hash，展開 **1,942,972,275 bytes**。Committed manifest有每member name/length/SHA-256；archive/extracted third-party bytes唔提交。Tagged upstream MIT保留 `src/main/tools/ollama-LICENSE.txt`，archive另有16 licence/notice，extract時原樣保留。

Native Node ZIP驗central/local identities、完整inventory、expansion bounds、hash、duplicate/case-collision、unsupported encryption/compression、unsafe Windows aliases先atomic publication，唔跑installer/shell/external unzip/unpinned download。只fixed official route/reviewed redirects，staging前查storage，cache/extracted bytes再驗。Linux fixtures唔跑Windows。

Publisher證據只限official origin/published digest。PE係AMD64，embedded PKCS7 subject **Ollama Inc.**；呢個唔係signature verification。Windows Authenticode image/trust/revocation、final-handle identity/sharing、native install/button、long-path/runtime仍未驗。Managed start用built-in Windows ownership adapter，或host `verifyListener({pid, host, port})`／`stopOwnedTree({pid, child})` 回matching verified/settled PID。欠native capability報 `OWNED_RUNTIME_VERIFICATION_UNAVAILABLE`，唔收編無關loopback listener。Native execution/descendants settlement/GUI同payload acquisition/extraction分開。

`node --test tests/ollama-managed.test.cjs tests/tools.test.cjs tests/payload-manager.test.cjs` 驗真ZIP extract、hash/inventory拒絕、private cache install、explicit acquisition、confirmation cancel、corruption recovery/preservation，唔完成Windows或全部Ollama roadmap。取消證據分native review、真stream HTTP download、真ZIP extract；fixtures驗incomplete installed files移除、extract cancel後verified cache可重用、舊installed/models保留。Windows取消同GUI仍待。

## Windows受管理程序擁有權

Windows自動建 `createWindowsOllamaProcessAdapter`。固定app-owned PowerShell/C# helper經system PowerShell，無profiles/shell expansion/execution-policy change/renderer executable或command。Launch資料係private pipes typed JSON。其他platform需另supported adapter，Linux fixtures唔跑Windows helper。

Helper以read-only sharing開並保留admitted executable/library handles，驗length/SHA-256/final path/reparse/hardlink，保護dirs。Suspended建立Ollama，加入新Job Object（handle close時terminate），保留handle/PID/creation-time/executable identity，再resume。Assign失敗阻正常執行。固定 `serve`、loopback host、owned model destination；long-path prefixes保留同native handle檢查。

Health/version前驗root process仍alive，`Get-NetTCPConnection`將11434 listener歸精確process。Protocol replies綁private nonce、request ID、PID、creation time。Image/PID/response mismatch、native modules unavailable、欠ownership都拒絕。Status refresh查真owned listener/version；install/start中報phase同retained verdict，唔重複hash約2GB。

Stop針retained Job Object，等active-process count零先釋放file protections／關helper。並行stop共用operation。Launch取消關control pipe，helper執行前查取消，已建job要terminate/settle先報cleanup。Helper crash或欠proof報unverified-stop，唔success。Dispose涵蓋尚未建立identity嘅launch，唔adopt/signal/terminate無關services。

`ollama.managed.cancel` 嚴格無參數，回 `{cancelling: boolean}`，原要求pending時取消active install/start；已建立runtime stop分開。Download仍可status/progress。Linux protocol fixtures驗handoff、PID/image mismatch、settlement失敗/retry、concurrent stop、cancel/dispose races，只驗JS boundary。PowerShell/C#原來源未喺Windows執行，native compilation/policy/modules/Job Object/listener attribution/long paths/sharing/start/stop/cancel/GUI仍明確待驗。

## 有證據模型規劃

`ollama.hardware`、`ollama.fit`（model，可選 `contextTokens` 128–1,048,576）、`ollama.capabilities`（model）。Model要精確匹配真local API installed tag/digest。Bounded `/api/tags`、`/api/show`、再tags，digest/size變化拒絕。API冇atomic tags/show，呢個一致性檢查唔係immutable server snapshot。唔用remote catalogue、模型名推斷或虛構hardware。

Hardware分開報真host total/current available RAM、CPU arch/cores、host指定model volume free/total space，唔回private path。GPU/CPU-backend未知，除非host提供 `ollamaHardwareProbe({signal})`，可回 `{cpuBackendSupported: boolean, gpu: {state: 'verified', observedAt, devices: [{backend, driverSupported, totalBytes, availableBytes}]}}`。Backend限小寫cuda/rocm/vulkan/metal。Malformed/failed/超五分鐘data未知，default唔claim native GPU/driver probe。

Fit帶time、digest/declared metadata、hardware、reasons、assumptions，同 **Runs well**／**Runs with limits**／**Unlikely**／**Unknown**。Weight size來真installed artifact inventory。Supported standard-attention架構按declared layer/head/embedding/key-value width算明示f16 KV-cache。Default context最多4,096 tokens且唔超model max，預留runtime overhead加20%margin。Unsupported/missing metadata Unknown，quantization/model name唔代actual size/dimensions。

Runs well要verified compatible single-device available GPU memory同current RAM足夠；Runs with limits要verified CPU support/current RAM fit，唔claim GPU offload。Unlikely要available verified placement證current memory不足，唔將total RAM當free。Potential hybrid無allocation evidence未知。無GPU證據，總verdict仍Unknown，即使分開RAM estimate合適。只係保守text-only memory planning，唔係throughput、attachment memory或成功load。

Capabilities只 `/api/show` declarations，欠／錯誤保持unknown。Image/tool calling唔代表attachment transport；`attachments.transferEnabled` false並列missing validated-transport。完整official revisioned catalogue、full pagination/offline cache、native GPU、attachment decode/upload、harness checkpoint/rollback喺此基線未完；下節續篇只補其明示部分。Fit fixtures係合成protocol/evidence，hardware/disk fixture讀真Linux，唔證Windows/GPU。

Identity明示 `identityConsistency: 'matching-tag-before-and-after'`。Show用mutable tag，即使起初選digest。前後digest/size匹配只抓觀察到net change，唔證atomic metadata、全程tag不變（ABA）或immutable digest-bound show。唔假設官方show接受digest addressing。單獨metadata extraction無前後檢查標 `unverified-tag-show-association`。

## 官方觀察模型目錄

`src/main/tools/ollama-catalogue.cjs` 嘅 `createOllamaCatalogue({directory, fetchImpl})` refresh/cache官方library。Host透過 `ollamaCatalogueDirectory` 給private `ollama-catalogue` dir，或trusted consumer注入 `ollamaCatalogue`。四actions：`ollama.catalogue.status`, `ollama.catalogue.refresh`, `ollama.catalogue.cancel`, `ollama.catalogue.page`，page可選 `family`、plain-text `query`、zero-based `offset`、`limit` 1–100。唔收renderer URL/header/credentials/cookies/source override。

Local assistant顯示status、official refresh同獨立cancel、cached name search、50-item pages、family drill-down。相鄰regex只bounded worker過濾loaded page。Status分observed counts、last success、last attempt、staleness；欠exact metadata Unknown，browse唔install/start。Late cancel報publishing，需final readback。Typed host actions真實，browser fixtures只驗presentation/request，唔混歷史live traversal。

Adapter讀 `https://ollama.com/library?sort=alphabetical`，發現每admitted family，再遍歷官方 `/library/{family}/tags` 同observed supported pagination。Bounded tokenizer支援quoted/unquoted attributes，quoted contents唔當real attributes，排除raw-text/template/comment links/metadata。未終止tags/comments/raw-text拒絕。只extract data，唔執行scripts/styles/comments/external instructions。固定official HTTPS origin/path patterns，pagination key/value嚴格；external/unsupported pagination、dynamic infinite-scroll、changed title、empty/truncated page拒絕。無redirect/auth/cookies，驗type/UTF-8，opaque strings唔變commands/capabilities。

Refresh兩workers，每request停125ms，20秒request timeout、十分鐘總期限。最多10,000pages、256MiB總response、8MiB每response、5,000families、100,000variants。達界限incomplete，保留舊valid cache。Cancel abort fetches並settle兩workers。Complete observed traversal staging/hash/sync/atomic promote。Publication前接受取消保留last snapshot；rename前進不可取消 `refreshPhase: 'publishing'`，cancel回 `{cancelling: false, reason: 'CATALOGUE_COMMIT_IN_PROGRESS'}`，唔混淆late refusal同accepted abort。

Cache用一retained nofollow handle，bounded chunks最多initial length加一byte，總64MiB；查regular/link、pre/open/post/path/root identity、size/change time，growth/replacement/symlink race拒絕，再查record hash/provenance origins/schema/bounds。Cached read無network。Page/status有retained revision/time、age/staleness、last source availability同partial progress。Default stale24hours，新觀察唔證upstream冇變。

Revision係local snapshot SHA-256，唔係upstream release。每source記URL/response SHA-256/observed time/bytes/ETag/Last-Modified，snapshot記start/completion。`completeness.traversal` 為 `complete-observed-official-source`，`exhaustive`／`metadataComplete` **false**，HTML冇authoritative total/atomic revision可證完整同時清單。遍歷中changes、未公告結構、historical/deleted entries唔涵蓋，唔用curated/hardcoded list代遍歷。

Tag rows保留exact tags同normalized display labels（approx size/context/input type/明示short digest）。Size/context係opaque strings；欠exact admitted metadata，`sizeBytes`, `contextTokens`, `capabilities`, `quantization`, `license`為null。Model名/input label唔證capability/licence/fit/performance，remote fit全Unknown，installed fit/capabilities分開。此單元未做registry-manifest/config/licence admission或更精確metadata，唔下載model blobs。

歷史唯讀live traversal喺2026-10-15 21:57:33.958 UTC完成，觀察253families、7,492tags、254pages、30,924,563response bytes，30.8秒。Local revision `bf714f86ede206772edfe00a0c859b8610285560d4a5f650421234ac2cc5953c`。只係歷史觀察，唔係今日數量或exhaustive。Ignored cache離線重開成功。當時cloud direct Node fetch不可用，既有proxy `node --use-env-proxy` 成功。Production可注入trusted networking，保持source policy，唔公開proxy credentials/raw pages/cache payload。

`node --test tests/ollama-catalogue.test.cjs` 驗parser boundaries/pagination/complete fixture traversal/atomic offline reuse/global limits/old cache/provenance/no name guesses，同真stream HTTP fixture取消。Windows runtime同此唯讀目錄單元分開，仍喺其他位置待驗。
