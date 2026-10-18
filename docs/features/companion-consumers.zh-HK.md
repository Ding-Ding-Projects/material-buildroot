# 已驗證伴隨連線消費端

[English](companion-consumers.md) · [文章目錄](README.md)

## 已實作來源路線

已驗證瀏覽器有十個明確工作流程：來源／項目、配置／建置、輸出／雲端傳輸、本機模型、受管理伺服器、受管理客體、遠端 Buildroot、產品流程發佈、檔案轉換、偏好／復原。切換只改可見控制，唔送主機要求。佢有獨立項目工作區、選定項目、可選校驗比較初稿、檔選擇、結果畫面同有限要求歷史，唔共用訪客儲存。Session、handles、主機結果同最後50項要求摘要只喺頁面記憶體。Reload 要重新配對，唔恢復授權；endpoint偏好同認證分開。明確 Save/Restore/Clear local draft 只保存命名build target、parallelism、configuration domain、clone folder/ref初稿，上限1,024字元。恢復唔提交要求，唔恢復session/project/file/source-selection能力。

有型別主機適配器只接納下列精確操作，受目前scope限制。非破壞建置用命名目標選擇同有限並行控制，唔係command字串。

| 操作 | 範圍 | 消費端 |
| --- | --- | --- |
| cloud.list | deployment:read  | 已登記目的地標籤同傳輸狀態，唔含憑證 |
| cloud.retry | deployment:write  | 原生確認後，重試讀回此階段擁有嘅保留雲端物件 |
| cloud.cancel | deployment:write  | 只要求取消由此階段／項目開始嘅上傳 |
| cloud.start | deployment:write  | 原生批准確切檔案後開始此階段預覽 |
| cloud.preview | deployment:write  | 為已登記目的地雜湊並預覽此階段所選輸出 |
| models.chat.start | tools:write  | 用此階段已獲披露模型開始暫時回覆 |
| models.chat.read | tools:write  | 讀取此階段對話下一個有限回覆區塊 |
| models.chat.cancel | tools:write  | 要求取消此階段對話 |
| conversion.queue | tools:write  | 用目前原生授權排入此階段持久轉換 |
| pdf.queue | tools:write  | 用原生所選輸入排入檢查／合併／分割／擷取／重排／旋轉／移除中繼資料 |
| tools.queue.page | tools:read  | 每頁50項讀取目前階段佇列 |
| tools.queue.history | tools:read  | 讀有限歷史摘要，唔恢復授權 |
| tools.queue.get | tools:read  | 讀目前階段操作結果同進度點 |
| tools.queue.cancel | tools:write  | 按觀察到嘅序號要求取消 |
| conversion.choose | tools:write  | 原生輸入或新輸出選擇器，限定此階段 |
| conversion.catalog | tools:read  | 真實八類適配器可用狀態 |
| conversion.run | tools:write  | 按命名類別／格式轉換此階段所選檔 |
| servers.versions / servers.flavours / servers.plugins | servers:read  | 真實 edition/version/flavour/plugin 偵測，明確可用狀態 |
| servers.paper.builds / servers.fabric.options | servers:read  | 發現精確穩定安裝選項 |
| servers.choose | servers:write  | 原生目錄選擇同原生伺服器執行同意 |
| servers.configuration.read / servers.configuration.save | servers:read / servers:write  | 有型別 properties，同另經原生批准嘅停機配置 |
| servers.install / servers.paper.install / servers.fabric.install / servers.plugin.install | servers:write  | 對已接納目錄選擇建立原生確認持久安裝工作 |
| servers.start | servers:write  | 原生確認所屬本機／SSH程序／容器生命週期 |
| servers.remote.preview / servers.remote.execute / servers.remote.status | servers:write / servers:read  | 原生檢視確切SSH目的地、hash綁定持久傳輸同真實進度 |
| servers.list | servers:read  | 已儲存管理伺服器擁有權摘要，唔含主機路徑 |
| servers.status | servers:read  | 此階段已獲披露伺服器嘅目前管理狀態 |
| servers.stop | servers:write  | 另經原生確認後使用既有管理器停止 |
| models.catalogue.page / models.catalogue.refresh | tools:read / tools:write  | 分頁官方觀察目錄，同原生批准持久更新 |
| models.pull / models.install | tools:write  | 原生批准持久模型下載同受管理環境取得 |
| models.managed.status / models.runtime.start / models.runtime.stop | tools:read / tools:write  | 真實原生環境狀態，同分開確認所屬生命週期 |
| models.status | tools:read  | 實際本機模型服務版本 |
| models.list | tools:read  | 已安裝模型名稱、大小同摘要 |
| workspace.read | workspace:read  | 工作區摘要 |
| projects.choose / projects.adopt | projects:write  | 原生資料夾選擇，同分開精確來源信任批准 |
| projects.list | projects:read  | 選目前已採用項目 |
| runtimes.list / runtimes.configure / runtimes.prepare / runtimes.wsl.project | runtimes:read / runtimes:write  | 真實WSL2／固定本機映像偵測、原生選擇、所屬volume準備同Linux側項目採用 |
| config.trust.preview / config.trust.grant | configuration:read / configuration:write  | 綁來源／配置／環境預覽，同另經原生確認執行信任 |
| project.options | projects:read  | 環境類型、修訂同外部樹授權摘要 |
| source.rollback.preview | source:write  | 預覽此階段來源變更建立嘅復原 |
| source.rollback.apply | source:write  | 原生patch檢視後套用該復原 |
| source.upgrade.preview | source:write  | 預覽不可變來源修訂，將記錄留喺此階段 |
| source.upgrade.apply | source:write  | 原生patch檢視後套用精確預覽，保留既有rollback快照 |
| source.choose | source:write  | 開原生目的地選擇器，只喺此階段保留選擇 |
| source.clone.official | source:write  | 原生批准官方來源複製同項目採用 |
| source.status | source:read  | 實際來源修訂、分支、未提交狀態同快照數 |
| config.details | configuration:read  | 單一符號綁修訂help、相依條件、ranges同assignable states |
| config.inspect | configuration:read  | Boolean／數字配置列同觀察修訂 |
| config.apply | configuration:write  | 桌面批准後一個有型別、綁修訂變更 |
| config.undo | configuration:write  | 桌面批准後綁修訂復原 |
| defconfig.apply | configuration:write  | 桌面批准後精確目錄選擇 |
| defconfig.catalog | configuration:read  | 可信配置目錄，含修訂同雜湊 |
| build.targets | projects:read  | 已偵測命名／套件目標 |
| builds.submit | builds:submit  | 以有限並行數排入已批准非破壞命名目標 |
| jobs.owned | jobs:read  | 此配對階段開始嘅建置，同取消控制 |
| jobs.list | jobs:read  | 目前主機擁有工作摘要 |
| jobs.get | jobs:read  | 刷新之前向此階段披露嘅工作 |
| jobs.cancel | jobs:cancel  | 按觀察序號要求取消由此階段開始嘅建置 |
| packages.list / packages.files / packages.editors | packages:read  | 分頁套件偵測、修訂／檔雜湊資料同已安裝原生編輯器 |
| packages.editor.open | packages:write  | 此階段檔記錄嘅原生確認可見編輯器交接 |
| product.inspect / product.runners / product.preview | forge:read  | 精確來源庫／帳戶檢查、接納執行器清單同有型別不可變流程預覽 |
| product.selectRunner / product.publish / product.export | forge:write  | 分開原生計費／執行器批准，同精確生成YAML發佈／匯出批准 |
| remote.list / remote.enroll / remote.reconnect | remote:read / remote:write  | 清理目標／工作記錄，同原生descriptor／host-key登記 |
| remote.transfer / remote.start | remote:write  | 原生檢視項目傳輸，同命名、綁來源遠端建置 |
| remote.adopt | remote:write  | 目標重連後新原生授權恢復確切歷史工作 |
| remote.observe / remote.cancel / remote.outputs / remote.download | remote:read / remote:write  | 階段所屬觀察／取消／輸出偵測，同原生選定下載 |
| guests.discover / guests.list / guests.refresh | guests:read  | 已接納虛擬化工具、管理記錄同觀察狀態 |
| guests.create / guests.disk.create | guests:write  | 原生檢視確切輸出媒體客體建立，同新虛擬磁碟建立 |
| guests.launch / guests.stop | guests:write  | 原生確認可見啟動同正常停止，帶預期修訂 |
| sdk.preview / sdk.export | outputs:read / outputs:write  | 階段綁定封存資料預覽，同原生確認保留位元組SDK匯出 |
| outputs.manifest | outputs:write  | 原生確認目前所選輸出handles嘅manifest |
| outputs.browse | outputs:read  | 瀏覽已採用項目輸出資料夾 |
| outputs.inspect | outputs:read  | 檔案類型、位元組數同檢查摘要 |
| outputs.checksum | outputs:read  | 計算SHA-256，並比較可選預期摘要 |

伺服器分派前驗參數schema同scope；消費端每次呼叫前、await讀取後重查授權。項目操作重驗已採用root identity。輸出id係限定一session/project嘅opaque handles，每session有自己viewer。瀏覽器唔可送host path、generic IPC、create grant、select executable或assert native consent。

## 設定同恢復

三步guide先檢視pairing，要求選native-admitted project，再讀目前runtime/external-tree admission先完成。Back/Next同本機保存只留guide progress。捕捉project/session identity防遲到回覆驗證另一選擇。完成開productive configuration。欠runtime指出真正native-approved C discovery/selection路線，唔生成虛構環境或將saved progress當grant。執行互動同reload acceptance仍待處理。

## 獨立控制搜尋同偏好

每個C workflow有literal-first控制搜尋同相鄰完整regex workbench，重用隔離search component，唔用visitor storage。Worker expression有既有界限。匹配只改可見控制，唔改host authority或remote queries。Native catalogue filters仍係literal server queries，唔聲稱可regex搜尋未見remote records。

Authenticated workspace有獨立English/Cantonese/bilingual、light/dark/system、100/125/150/200 percent text-size，存喺獨立有限browser key，唔改visitor settings或host權限。靜態控制即時改標籤；既有host結果文字保持原渲染，直到明確refresh。來源增量唔係完整localization/layout/accessibility證據。

## 既有受管理伺服器

列清理ownership records、refresh manager state，同native-confirmed stop已披露server，唔由persisted metadata推斷ownership/readiness。原生directory selection、typed configuration、真實version/flavour/plugin discovery，同native-approved vanilla/Paper/Fabric/plugin install用既有services同durable queue。Bedrock明確欠checksum admission，唔假裝可安裝。此C路線Fabric保留bootstrap-only同unpublished-digest限制。四個process/container targets用精確native confirmation同ownership checks，SSH保留strict known-host／authentication。

Native-reviewed source distribution preview將hash同exact destination綁session，再入durable transfer queue。取消保留remote-state-unknown／partial-destination，唔假報rollback。Trusted start context喺request JSON以外提供 `authorizeExecution`，畀native manager跨scheduled restart保留。只有manager回per-launch `instanceId`先啟動automatic revocation stop，送 `expectedInstanceId`，identity取代即停止observer。冇receipt就唔聲稱自動stop。Target/runtime/distribution可用性由既有adapter執行。

## 原生檔案轉換

用既有native input/new-output pickers，browser只見names同session-owned ids，唔見filesystem paths。Category/format反映真正adapter可用性，未封裝adapter停用。Run只用目前session所選read/write grants。Revocation要求abort所屬operation，lost reply仍unknown，唔claim output rollback。保留no-overwrite同output-signature checks。

C有自己durable host queue、serialized execution、bounded pages、result/checkpoint reads同sequence cancellation。PDF支援inspect/merge/split/extract/reorder/rotate/metadata removal，經既有admitted adapter。欠payload或isolation admission令真實job失敗，唔模擬結果。Historical records唔恢復native file權限，replacement work要明確重新選inputs同new output。

## 本機模型

Refresh installed models、選模型、輸入prompt，再明確經tools scope送出。Prompt/reply暫時保存，local draft同request history唔記內容。讀有限chunks，只取消目前session獲接納chat。Revocation經host observer要求取消，直到service真實回狀態前只係requested。

另可分頁official observed catalogue，native-confirmed durable jobs做catalogue refresh、admitted pulls同managed runtime acquisition。既有安裝／models受native service保護。Runtime start進行中可cancel；成功native-approved start之後保留runtime，stop要另native approval。Revocation唔聲稱runtime已關。Persistent conversation management仍未完成。

## 取消同復原

Cancellation係要求唔係結果，要查job sequence、originating session同host ownership，再用既有queue取消方法。Refresh到host真實terminal state。Lost response係unknown，唔係success，唔自動重試。Session unavailable阻新呼叫。C開始build，host observer會喺expiry/revocation要求cancel，但已接受queue work保留host durable lifecycle同observed terminal state，disconnect唔代表取消完成。

Revocation後完成嘅source/output reads唔披露新結果。投影排除source working-tree paths、raw logs、snapshots、output content previews同credentials。Client只render text nodes，接受每view已知欄位。

## 未完成範圍

此增量唔完成PH09-T03或全部C identities。以下係實作缺口，唔係豁免：

- Destructive build submission同job retry仍未完成；non-destructive named build喺最後enqueue再查live session，用desktop-adopted runtime/source grant入durable scheduler。
- Configuration string/credential editing、完整semantic menus、defconfig save、presets、account provisioning、structured package/external-tree authoring要專用capability-bound controls。現有package discovery、file-hash metadata同visible editor handoff綁session，browser唔供executable/path。Boolean/tristate/integer/hex列有bounded symbol filter、100-row pages、semantic type/assignability同revision help。Edit/undo/defconfig apply經獨立native approval用trusted transaction，每要求帶observed revision，唔收browser consent。
- Custom clone、source ref取得、historical rollback discovery要更多native selection／revision approval。Official clone用native destination picker、session selection同獨立trust批准，browser冇trust/consent Boolean。Upgrade session保存immutable preview，apply前native review真實patch；rollback限此session建立record，同native review/current revision。超16,000字元patch要完整native流程，唔截短批准。
- Rich artifact content、多檔manifest選擇／比較、advanced guest topology/edit/import、physical media、raw remote logs排除。已實作enrolled destinations、exact selected-output preview同upload start。Start消耗目前session preview，native確認exact file/destination；host-only callback喺native approval後、snapshot後同transfer effects前再查。Revocation只要求所屬取消，保留partial/unknown，唔rollback。Preview唔upload或授publication。Readback retry限session/project保留upload，要native確認，enqueue及每effect前再驗，只驗 retained object，唔靜靜重上傳／覆寫。
- Full version descriptors、native SSH authentication enrollment、完整persistent conversations、assistant/recovery、general artifact/release forge publication仍需專用authenticated consumers；product workflow publication已有typed native-approved路線。
- Appearance/navigation/history/exports/accessibility/localization/locks等shared identities要獨立C記錄，visitor implementation唔係C證據。
- Native credentials enrollment、TLS selection、listener binding、executable selection同OS consent仍只屬desktop權限，C要請求已批准結果，唔模擬同意。

## SDK同輸出來源

選current output file預覽SDK metadata或create manifest。Preview限定session/project並到期。Export要native批准exact hash/size/destination，再用byte-preserving流程，consumer-build/runtime verification仍false。唔解壓、唔執行toolchain、唔覆寫existing output。Manifest只由host轉譯session-owned handles。

## 套件同外部編輯器

Package search用既有source/external catalogue，每頁25。File metadata綁import revision同exact file hash，唔回raw bytes。Host偵測native editors，獨立native prompt顯示exact file/editor同visible-launch後果，再由package discovery重驗並開啟。全部package fields structured authoring仍未完成。

## 受管理客體

Create用session-owned output handle、bounded hardware、BIOS/EFI同NAT/none。Native confirmation顯示source hash/provider/hardware，既有manager複製media前再查hash/grant。New virtual disk用reviewed name/format/bounded capacity。Launch/graceful stop要另native confirmation同current revision。Create唔係boot proof，launch唔係login/network proof，stop request唔係shutdown completed。完成native-approved客體喺session revocation後仍由desktop管理，唔暗示自動關機。

## 通用遠端Buildroot

Remote descriptors同private host details只喺native desktop選取確認，唔輸入browser credentials。C只收sanitized names/kinds同opaque IDs。Project transfer／named build用既有snapshot/revalidation/reservations。Request JSON以外trusted callback按每async request隔離，native waits後同每SSH call/effect前查，revoked只cancel其in-flight transport。Remote worker可能已接受仍跑，native觀察前interruption unknown，唔rollback。C核terminal identity/source digest同accepted transfer；outputs按returned name/hash接納，native選目錄下載再驗digest。Historical recovery要native reconnect後新批准exact target/job/source digest，service重讀record先授session控制；persisted browser state唔恢復權限。Existing-project adoption同樣native workspace/source/output pickers加獨立source-trust。唔投影raw logs/machine paths。

## 產品流程發佈

Browser只提供repository ids、immutable source revision同build/installer選擇。Runner清單來native account，billing/runner要native prompt同setup service重驗。Workflow由既有strict model生成，唔收browser commands/expert YAML。Native publish/export approval顯示exact destination、base/source revisions、SHA-256同完整有限generated YAML。Host-only callbacks喺account/native waits後、API/filesystem writes前查。Publication保留精確readback，唔dispatch runner或證明build/release。Private-source execution限制不變。

## 原生環境同配置接納

Discovery只列觀察到WSL2 distributions同pinned local images。Selection要native approval同fresh discovery再存runtime。Container storage用既有owned-volume adapter，唔pull image或聲稱permissions已驗。Linux-side project用native picker同verified receipt，revoked admission唔登記project。Configuration execution trust由current native roots、source/config revisions同runtime預覽，再native批准；host-only callback喺snapshot後、grant存前重查。Browser JSON冇trust Boolean/callback。

## 驗證狀態

只係來源實作。原speed-focused任務刻意延後tests、static analysis、reviews、browser/runtime同captures，該lane冇啟動listener、paired request、host action、build或publication。Build/integration屬協調任務。Source存在唔係runtime acceptance/security proof/full identity closure。
