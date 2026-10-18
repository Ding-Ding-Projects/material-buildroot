# 產物與部署

[English](deployment.md) · [桌面文件](README.md)

`src/main/deployment/index.cjs` 匯出 `createDeploymentService`。主程序提供已批准產物根目錄、可選執行檔路徑同明確登記嘅適配器。渲染器只收到產物相對名稱同不透明操作識別碼，唔可以選執行檔、URL、憑證、SSH 指令或實體磁碟寫入器。

## 已實作操作

產物瀏覽器列檔案時唔會跟隨目錄符號連結。檢查拒絕解析後超出根目錄嘅路徑，串流計算 SHA-256，文字預覽限 8 KiB，格式中繼資料最多讀 1 MiB。可識別原始 MBR/GPT 磁碟、ISO9660、VDI、VMDK、qcow2、tar、zip、gzip 同 xz 簽章。分割區資料假設每磁區 512 位元組，只報告範圍，唔掛載或執行映像。超出檢查窗口嘅 GPT 陣列保持不可用。識別封存格式唔代表可解壓或已驗證完整性。

Manifest 將所選路徑排序並雜湊其內容，可附明確來源、Buildroot、配置、工具鏈同環境鎖。重複建置比較會報告新增、移除、改變輸出同鎖變更。位元組相等只涵蓋所選檔。`collectCompliance` 收集 Buildroot legal-info 檔同校驗和、有限 CSV 預覽，同授權標示 `NOASSERTION` 嘅 SPDX 檔案清單，唔推斷法律結論或聲稱完整套件 SBOM。

VirtualBox 偵測執行 `VBoxManage --version`；VMware 執行 `vmrun -T ws list`，後者只證明指令可用，唔確立 Workstation 版本。建立、編輯、啟動同正常停止客體用固定 argv。客體限於所屬 UUID 同管理目錄，登記庫保留未完成建立狀態供復原。正式接線必須提供主機擁有、位於建置輸出之外嘅持久管理目錄；預設隔離暫存目錄唔支援重啟復原。NAT 係預設，硬件支援 CPU 數、記憶體同 BIOS/EFI。附加磁碟會複製批准磁碟到客體目錄並核對雜湊，保留原映像。VMware VMDK 輸入必須由服務目前轉換階段產生。停止要求維持 `shutdown-requested`，直到 `refreshGuest` 觀察到關機，唔提供強制斷電。此適配器原生客體啟動同關機驗收仍未證明。

拓撲 API 每客體提供四個 NIC 同四個媒體槽。`networks` 形狀為 `{slot: 1..4, mode: nat|none|bridged|hostonly, interface?}`。VirtualBox 橋接同 host-only 必須從目前 `discoverNetworks` 清單選介面；VMware 用 Workstation 預設橋接或 host-only 網絡，冇明確介面選擇。`storage` 為 `{slot: 0..3, kind: disk|iso, artifact}`，ISO 要有 ISO9660 簽章，磁碟要獨立，唔帶 backing file、加密或快照。編輯會執行真實 VirtualBox SATA 附加／卸除指令，或修改所屬已停止 VMware VMX。卸除副本仍保留喺磁碟。

`createDiskArtifact({outputName, format: vdi|vmdk, capacityMiB})` 用固定 qemu-img argv 建立獨立空白磁碟，容量限 64–1,048,576 MiB，先驗證主機所屬暫存輸出，再以獨佔方式複製到之前不存在嘅產物檔名。新 VMDK 可接納作後續所屬客體附件。畫布可用客體 ID 加 NIC／媒體槽形成穩定節點身分；移動節點只改版面。

`previewGuestEdit({id, expectedRevision, hardware?, networks?, storage?})` 回傳會到期嘅 `previewId`、確切下一份管理配置同目前修訂。`editGuest({id, expectedRevision, previewId})` 只消耗該計劃一次。提供陣列會取代全部槽，省略陣列會保留原配置。預覽同套用都檢查真實停止狀態、目前介面清單同來源／副本媒體雜湊。套用亦檢查預覽記錄嘅主機配置指紋。逐客體操作鎖拒絕同時套用，修訂拒絕過期呼叫者。部分 CLI 失敗產生 `configuration-unknown`，觀察到關機亦唔會清除此狀態；必須明確成功重新套用配置先可啟動。只帶舊 `diskName` 欄位嘅登記庫，要重新匯入儲存先可編輯，避免靜靜遺失舊附件。回傳資料描述適配器套用配置，唔係已驗證客體硬件或開機行為。

轉換預覽綁定輸入 SHA-256 同不存在嘅目標。`qemu-img info` 拒絕 backing file、加密同快照。固定格式轉換喺暫存目錄執行，只有目標仍不存在先連結完成輸出。來源支援原始磁碟、VDI 同 qcow2，輸出支援 raw/VDI/VMDK/qcow2。此轉換服務唔提供 ISO 製作或 OVA/OVF 設備匯入；支援嘅匯入路線係由磁碟建立客體。另設 ISO 製作流程唔會改變此轉換界線。

## 適配器登記

雲端適配器只接受主機登記、明確主機白名單內嘅 HTTPS 上傳同讀回端點。S3-compatible、Azure Blob、GCS 同 GitHub Releases 用指定物件簽署 URL／SAS，或主機端有限範圍授權回呼。登記提供已選物件；GitHub 仲要確切上傳端點同方法。程式唔偵測帳戶、發出雲端憑證或建立發佈。Azure 加 `x-ms-blob-type: BlockBlob`，S3/GCS 加 SHA-256 中繼資料。預覽唔含 URL 或憑證，五分鐘到期並綁定本機位元組。重新導向會拒絕。成功必須下載讀回物件，核對確切大小同 SHA-256，單憑接受上傳回覆唔夠。Abort signal 傳到上傳同讀回。重試要新預覽，部分提供者狀態可能需由提供者端清理。

遠端適配器係固定 `material-buildroot-v1` 子系統嘅明確傳輸界線。登記固定主機、連接埠、憑證參照、已批准 Linux process/Docker 或 Windows WSL/Docker 類型，同 SHA-256 SSH 主機指紋。注入傳輸必須喺開子系統前強制核對指紋並回報觀察到嘅金鑰。具型別 capability/start/observe/cancel 訊息帶 manifest 同固定建置目標，只可取消由此服務建立嘅工作。此模組未實作子系統傳輸、遠端 helper 部署、manifest 傳送、持久重連同下載輸出驗證，唔聲稱真實 SSH 執行。

寫入媒體要明確接納平台適配器。預覽檢查確切裝置身分、容量、掛載／系統狀態同映像雜湊。實體非卸除式磁碟要另行主機接納。短效單次 token 配合已檢視身分先可授權；確認重新檢查裝置、容量同映像位元組。適配器開目標時必須原子重新驗證擁有權、支援取消，並回傳讀回 SHA-256、長度同裝置身分。預設冇安裝主機磁碟寫入器，測試只用記憶體適配器。取消可留下不完整媒體，唔可以話已證明復原。

## 驗證同未完成驗收

執行 `node --test tests/deployment.test.cjs`。固定資料檢查越界路徑拒絕、分割區資料、manifest／合規資料、確切虛擬化及轉換 argv、拓撲媒體附加同保留、過期預覽、並行操作、主機配置變化、部分失敗、登記 HTTP 要求同讀回、遠端工作擁有權，同寫入身分／token 失敗。唔會寫實體裝置。

PH07 仍未完成。此參考記錄嘅待驗證項目包括實際 Windows VirtualBox/VMware 版本、BIOS/UEFI 客體開機／登入／網絡／持久儲存／正常關機、完整桌面及帳戶配置、安全設備匯入、原生橋接／host-only、ISO 匯出、SDK 匯出及消費端試建、遠端 helper／傳輸／復原、有限憑證庫整合、真實提供者帳戶及讀回，同平台寫入／取消／復原。Secure Boot 冇測試或聲稱。後來個別流程證據要按其來源另行閱讀，唔會自動完成此整體清單。
