import {html,nothing} from 'lit';
import {localizedCopy} from './language-wording';
const stages:Record<string,[string,string]>={preparing:['Preparation','準備'],source:['Source preparation','來源準備'],configuring:['Configuration','設定'],building:['Image build','映像建置'],packaging:['Packaging','封裝']};
const explanations:Record<string,[string,string]>={
 BUILD_STEP_FAILED:['A required build step did not complete. Review this stage before retrying.','必要建置步驟未完成，重試前請核對此階段。'],
 PRODUCER_INTERNAL_FAILED:['The image producer encountered an internal failure. No successful output is confirmed.','映像產生程序發生內部錯誤，未確認成功輸出。'],
 SPEC_INVALID:['The build specification was rejected. Review the image choices and create a new preview.','建置規格被拒絕，請核對映像選擇並重新預覽。'],
 IO_FAILED:['A required file operation did not complete. Check available storage and access through the runtime setup controls.','必要檔案操作未完成，請透過執行環境設定核對儲存空間同存取權。'],
 GUEST_ASSETS_UNAVAILABLE:['Required guest assets are unavailable. This build cannot produce a verified guest image.','所需訪客資源未可用，此建置未能產生已核實訪客映像。'],
 ARCHIVE_FORMAT_UNSUPPORTED:['The selected image archive format is unsupported. Choose a supported archive.','所選映像封存格式未受支援，請選擇支援嘅封存檔。'],
 ARCHIVE_INVALID:['The selected image archive did not pass validation. Select and inspect the source again.','所選映像封存檔未通過驗證，請重新選擇同檢查來源。'],
 SAVED_IMAGE_IDENTITY_MISMATCH:['The saved archive could not be bound to the selected image identity. The build stopped before compilation.','未能將已儲存封存檔綁定至所選映像識別。建置已喺編譯前停止。'],
 SOURCE_IDENTITY_MISMATCH:['The source identity changed. Select the source and create a fresh preview.','來源識別已更改，請重新選擇來源並建立新預覽。'],
 PREPARED_BUNDLE_INVALID:['The prepared bundle did not pass validation. Prepare and review a new complete bundle.','準備套件未通過驗證，請重新準備同核對完整套件。'],
 CONFIG_INVALID:['The generated configuration did not pass validation. Review the configuration choices.','產生嘅設定未通過驗證，請核對設定選擇。'],
 DOCKER_DAEMON_UNAVAILABLE:['The container engine is unavailable in the selected runtime. Inspect runtime readiness in the setup controls.','所選執行環境嘅容器引擎未可用，請喺設定控制檢查就緒狀態。'],
 REGISTRY_AUTH_REQUIRED:['The registry requires authentication. No image access was confirmed.','登錄庫需要認證，尚未確認映像存取權。'],
 REGISTRY_TLS_FAILED:['The registry TLS connection could not be verified. Existing security checks remain enforced.','未能核實登錄庫 TLS 連線，現有安全檢查維持生效。'],
 REGISTRY_NETWORK_FAILED:['The runtime could not reach the image registry. Check connectivity before retrying.','執行環境未能連接映像登錄庫，重試前請核對連線。'],
 DOCKER_PULL_FAILED:['The container image download failed. Check the image reference and runtime access.','容器映像下載失敗，請核對映像參照同執行環境存取權。'],
 DOCKER_INSPECT_FAILED:['The container image could not be inspected. Image compatibility remains unverified.','未能檢查容器映像，映像相容性仍未核實。'],
 DOCKER_SAVE_FAILED:['The container image archive could not be written. No complete archive was confirmed.','未能寫入容器映像封存檔，未確認完整封存檔。'],
 DOCKER_LOAD_FAILED:['The container image archive could not be loaded. Inspect the selected archive.','未能載入容器映像封存檔，請檢查所選封存檔。'],
 DOCKER_COMPOSE_FAILED:['The application service bundle could not be processed. Review the prepared source and its supported configuration.','未能處理應用程式服務套件，請核對準備來源同支援設定。'],
 DOCKER_TAG_FAILED:['The container image reference could not be assigned. No ready output is confirmed.','未能指定容器映像參照，未確認就緒輸出。'],
};
export type ApplianceDiagnostic={schemaVersion:number;stage:string;code:string;tool:string;exitCode:number|null};
export function applianceDiagnosticView(job:{state:string;diagnosticStatus?:string;diagnostic?:ApplianceDiagnostic}|undefined,language:string){
 if(!job||!job.diagnosticStatus&&job.state!=='failed')return nothing;
 const l=(en:string,zh:string)=>localizedCopy(en,zh,language,true),d=job.diagnostic;
 const valid=job.diagnosticStatus==='available'&&d?.schemaVersion===1&&Object.hasOwn(stages,d.stage)&&Object.hasOwn(explanations,d.code)&&['docker','python3','curl','tar','make','producer'].includes(d.tool)&&(d.exitCode===null||Number.isInteger(d.exitCode)&&d.exitCode>=-255&&d.exitCode<=255);
 if(!valid)return html`<p class="notice" role="status">${job.diagnosticStatus==='invalid'||job.diagnosticStatus==='available'?l('The diagnostic record is invalid. The build failed, but its specific cause is not verified.','診斷記錄無效。建置已失敗，但具體原因未核實。'):l('A validated diagnostic record is unavailable. The build failed; its cause has not been established.','未有已驗證診斷記錄。建置已失敗，原因尚未確認。')}</p>`;
 return html`<section aria-label=${l('Build failure details','建置失敗詳情')}><h4>${l('Build failure details','建置失敗詳情')}</h4><p>${l(...explanations[d.code])}</p><dl><dt>${l('Phase','階段')}</dt><dd>${l(...stages[d.stage])}</dd><dt>${l('Tool','工具')}</dt><dd><code>${d.tool}</code></dd><dt>${l('Exit code','結束代碼')}</dt><dd>${d.exitCode===null?l('Not reported','未提供'):d.exitCode}</dd><dt>${l('Diagnostic code','診斷代碼')}</dt><dd><code>${d.code}</code></dd></dl></section>`;
}
