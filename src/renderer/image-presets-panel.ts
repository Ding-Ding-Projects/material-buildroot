import {localizedCopy} from './language-wording';
import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import '@material/web/button/outlined-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/progress/linear-progress.js';
import {materialIcon} from './material-icons';
import { workspaceStyles } from './workspace-styles';
import {captureOwnedStatus,displayOwnedStatus} from './owned-status';
export class ImagePresetsPanel extends LitElement {
 static properties={workspaceId:{type:String},language:{type:String},disabled:{type:Boolean},revision:{state:true},configurationGeneration:{type:Number}};
 static styles=[workspaceStyles,css`[hidden]{display:none!important} details{overflow-wrap:anywhere} summary{cursor:pointer;min-height:44px} md-outlined-select{max-width:100%} .step-nav{display:flex;flex-wrap:wrap;gap:12px} summary md-icon{vertical-align:middle;margin-right:8px}`];
 workspaceId=''; language='bilingual'; disabled=false; revision=0; configurationGeneration=0;
 private catalog:any; private preview:any; private outcome:any; private preset='minimal'; private desktop='none'; private ssh=false; private approved=false; private busy=false; private message='';
 private isoPlan:any; private isoOutcome:any; private isoApproved=false; private isoJob:any; private isoInspection:any; private isoLogs:any[]=[]; private isoBusy=false; private isoMessage='';
 private isoEpoch=0; private isoMode='easy'; private isoRuntime:any; private isoStep=0; private isoResumed=false;
 private resetIso(){this.isoEpoch++;this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoJob=undefined;this.isoInspection=undefined;this.isoLogs=[];this.isoMessage='';this.isoRuntime=undefined;this.isoStep=0;this.isoResumed=false;}
 protected willUpdate(changed:PropertyValues){if(changed.has('configurationGeneration')&&changed.get('configurationGeneration')!==undefined){this.isoEpoch++;this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoInspection=undefined;this.isoMessage=this.l('Configuration changed. Check and apply the ISO profile again before building.','設定已更改，建置前請重新檢查同套用 ISO 組合。',true);}}
 protected updated(changed:PropertyValues){if(changed.has('workspaceId')){this.resetIso();this.restoreIso();this.catalog=undefined;this.preview=undefined;this.outcome=undefined;this.approved=false;this.message='';this.revision++;if(this.workspaceId&&!this.disabled)void this.isoAction('plan');}}
 private saveIso(){try{localStorage.setItem('iso-workflow-'+this.workspaceId,JSON.stringify({version:1,step:this.isoStep,mode:this.isoMode,jobId:this.isoJob?.id??null}));}catch{this.isoMessage=this.l('Progress could not be saved on this device.','未能喺呢部電腦儲存進度。',true);}}
 private restoreIso(){try{const saved=JSON.parse(localStorage.getItem('iso-workflow-'+this.workspaceId)||'null');if(saved?.version===1&&Number.isInteger(saved.step)&&saved.step>=0&&saved.step<=2){this.isoStep=saved.step;this.isoMode=saved.mode==='advanced'?'advanced':'easy';this.isoResumed=true;if(typeof saved.jobId==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(saved.jobId))this.isoJob={id:saved.jobId,state:'unverified',sequence:0};}}catch{/* Untrusted local progress never restores configuration success. */}}
 private moveIso(step:number){this.isoStep=Math.max(0,Math.min(2,step));this.saveIso();this.revision++;void this.updateComplete.then(()=>this.renderRoot.querySelector<HTMLElement>('[data-step]:not([hidden]) h4')?.focus());}
 private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
 private changed(){this.resetIso();this.preview=undefined;this.approved=false;this.outcome=undefined;this.revision++;}
 permissionReviewCurrent(epoch:number){return this.isConnected&&epoch===this.isoEpoch;}
 async returnFromPermission(epoch:number,recheck=false){
  if(!this.permissionReviewCurrent(epoch))return;
  if(recheck)await this.isoAction('plan');
  await this.updateComplete;if(!this.permissionReviewCurrent(epoch))return;
  const heading=this.renderRoot.querySelector<HTMLElement>('[data-step]:not([hidden]) h4');heading?.focus();heading?.scrollIntoView({block:'start',behavior:'auto'});
 }
 private reviewPermission(){
  if(this.disabled||this.busy||this.isoBusy||this.isoActive||!this.workspaceId)return;
  this.saveIso();this.dispatchEvent(new CustomEvent('review-iso-permission',{bubbles:true,composed:true,detail:{workspaceId:this.workspaceId,epoch:this.isoEpoch}}));
 }
 private async run(action:string){
  if(this.busy||this.isoBusy||this.isoActive||this.disabled||!this.workspaceId||!window.studio?.operations)return;
  this.busy=true;this.message='';this.revision++;const workspaceId=this.workspaceId;
  try{const reply=await window.studio.operations({action,workspaceId,...(action==='imagePreset.catalog'?{}:{revision:this.catalog.revision,preset:this.preset,desktop:this.desktop,ssh:this.ssh})});
   if(this.workspaceId!==workspaceId)return;
   if(!reply.ok)throw Error(reply.code);
   if(action==='imagePreset.catalog'){this.catalog=reply.result;this.changed();}
   else if(action==='imagePreset.plan'){this.preview=reply.result;this.approved=false;}
   else{this.resetIso();this.outcome=reply.result;this.catalog=undefined;this.preview=undefined;this.approved=false;this.message=this.l('Configuration reconciled. Check effective values below; no image was built or booted.','設定已協調。請核對下方實際值，未有建立或啟動映像。',true);this.dispatchEvent(new CustomEvent('configuration-changed',{bubbles:true,composed:true}));}
  }catch(error){if(this.workspaceId===workspaceId){this.preview=undefined;this.approved=false;this.catalog=undefined;this.message=this.l('Operation not confirmed. Refresh capabilities and check configuration trust.','操作未確認。請重新整理支援能力並核對設定信任。',true)+' '+(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'');}}
  finally{this.busy=false;this.revision++;}
 }
 private async isoAction(action:'plan'|'apply'|'build'|'refresh'|'cancel'|'inspect'){
  if(this.isoBusy||this.busy||this.disabled||!this.workspaceId||!window.studio?.operations)return;
  const api=window.studio.operations;
  const workspaceId=this.workspaceId,epoch=this.isoEpoch;
  const current=()=>workspaceId===this.workspaceId&&epoch===this.isoEpoch;
  const call=async(name:string,fields:Record<string,unknown>={})=>{
   const reply=await api({action:name,...fields});
   if(!current())throw Error('STALE_WORKSPACE');
   if(!reply.ok)throw Error(reply.code);
   return reply.result as any;
  };
  this.isoBusy=true;this.isoMessage='';this.revision++;
  try{
   if(action==='plan'){
    this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoInspection=undefined;
    const options=await call('project.options',{workspaceId});this.isoRuntime=options.runtime;
    const catalog=await call('imagePreset.catalog',{workspaceId});
    this.isoPlan=await call('imagePreset.isoPlan',{workspaceId,revision:catalog.revision});
   }else if(action==='apply'){
    if(!this.isoApproved||!this.isoPlan?.applicable)return;
    this.isoOutcome=undefined;this.isoInspection=undefined;this.isoJob=undefined;this.isoLogs=[];
    this.isoOutcome=await call('imagePreset.isoApply',{workspaceId,revision:this.isoPlan.revision});
    this.isoApproved=false;this.isoPlan=undefined;this.catalog=undefined;this.preview=undefined;
    this.dispatchEvent(new CustomEvent('configuration-changed',{bubbles:true,composed:true}));
   }else if(action==='build'){
    if(!this.isoOutcome?.effective||this.isoActive)return;
    this.isoInspection=undefined;
    const options=await call('project.options',{workspaceId});
    if(!options.runtime)throw Error('RUNTIME_REQUIRED');
    this.isoJob=await call('imagePreset.isoBuild',{workspaceId,revision:this.isoOutcome.revision,profile:this.isoOutcome.profile,runtime:options.runtime,jobs:2});
    this.isoLogs=[];
   }else if(action==='refresh'){
    if(!this.isoJob)return;
    const jobs=await call('jobs.list');
    const job=jobs.find((j:any)=>j.id===this.isoJob.id);
    if(!job)throw Error('JOB_UNAVAILABLE');
    this.isoJob=job;
    const page=await call('jobs.page',{id:job.id,after:0,limit:50});
    this.isoLogs=page.records??[];
   }else if(action==='cancel'){
    if(!this.isoActive)return;
    this.isoJob=await call('jobs.cancel',{id:this.isoJob.id,sequence:this.isoJob.sequence});
   }else{
    this.isoInspection=undefined;
    this.isoInspection=await call('artifacts.inspect',{workspaceId,path:'images/rootfs.iso9660'});
   }
  }catch(error){if(current()){
   if(action==='plan'||action==='apply'||action==='build'){this.isoPlan=undefined;this.isoApproved=false;this.isoOutcome=undefined;}
   const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'';
   this.isoMessage=captureOwnedStatus(this,'isoMessage',this.l.bind(this),l=>(['KCONFIG_SEMANTICS_UNAVAILABLE','KCONFIG_SOURCE_TRUST_REQUIRED','KCONFIG_SOURCE_TRUST_CHANGED'].includes(code)?l('ISO compatibility is not confirmed. Choose Review source execution permission, review the exact source and runtime, then explicitly allow the scope if you trust it. Permission is not granted automatically.','ISO 相容性未確認。請選「核對來源執行權限」，核對確切來源同執行環境，信任後先明確批准範圍。唔會自動授權。'):['KCONFIG_RUNTIME_UNAVAILABLE','RUNTIME_REQUIRED'].includes(code)?l('A usable project runtime is required. Open Projects & runtime, select and authorize the project environment, then return and check ISO prerequisites again.','需要可用嘅專案執行環境。請開啟「專案同執行環境」，選擇同授權專案環境，再返回重新檢查 ISO 所需設定。'):l('Operation not confirmed. Refresh the plan or job before retrying.','操作未確認，重試前請重新整理計劃或工作。'))+' '+code);
  }}finally{this.isoBusy=false;if(current())this.saveIso();this.revision++;}
 }
 private get isoActive(){return this.isoJob&&['queued','running','dispatching','cancelling'].includes(this.isoJob.state);}
 private isoHelp(title:string,en:string,zh:string,article:string){return html`<details><summary>${materialIcon('help_outline')}${this.l(title,zh,true)}</summary><p>${this.l(en,zh,true)}</p><md-outlined-button @click=${()=>this.dispatchEvent(new CustomEvent('open-documentation',{bubbles:true,composed:true,detail:{title:article}}))}>${materialIcon('description','icon')}${this.l('Read the field guide','閱讀欄位指南',true)}</md-outlined-button></details>`;}
 private isoWorkflow(){
  const disabled=this.disabled||this.busy||this.isoBusy||!this.workspaceId,iso=this.isoInspection?.iso;
  const structural=iso?.descriptorValid&&iso?.withinImage&&iso?.elTorito?.validationChecksumValid&&iso?.elTorito?.bootEntryValid&&iso?.elTorito?.platformId===0;
  return html`<section class="panel stack" aria-label=${this.l('BIOS ISO workflow','BIOS ISO 流程',true)}>
   <h3>${this.l('Make a Linux disc image','製作 Linux 光碟映像',true)}</h3><p>${this.l('An ISO is one file containing a disc. This guide prepares an image for a PC that starts in BIOS mode, an older startup method. Newer UEFI-only PCs are not supported here.','ISO 係一個包含光碟內容嘅檔案。呢份指南為使用較舊 BIOS 啟動方式嘅電腦準備映像，唔支援只用新式 UEFI 嘅電腦。',true)}</p>
   <md-outlined-select label=${this.l('Configuration mode','設定模式',true)} .value=${this.isoMode} @change=${(e:Event)=>{this.isoMode=(e.target as HTMLSelectElement).value;this.saveIso();this.revision++;}}><md-select-option value="easy">${materialIcon('check','start')}<div slot="headline">${this.l('Easy: detected defaults','簡易：已偵測預設值',true)}</div></md-select-option><md-select-option value="advanced">${materialIcon('tune','start')}<div slot="headline">${this.l('Advanced: manual configuration','進階：手動設定',true)}</div></md-select-option></md-outlined-select>
   ${this.isoMode==='advanced'?html`<p>${this.l('Use the preset controls and full configuration editor below for manual package, kernel and filesystem values. Recheck this ISO profile after changes. The guided build still uses its fixed defaults.','請使用下方預設組合同完整設定編輯器，手動調整套件、核心同檔案系統。改動後請重新檢查 ISO 組合；導引建置仍使用固定預設值。',true)}</p>`:nothing}
   ${this.isoResumed?html`<p role="status">${this.l('Saved progress restored. Configuration and output must be checked again; saved progress is not a completed build.','已還原儲存進度。設定同輸出須重新核對；儲存進度唔代表建置完成。',true)}</p>`:nothing}
   ${this.isoMode==='easy'?html`<p role="status">${this.l('Step','步驟',true)} ${this.isoStep+1} / 3</p><md-linear-progress .value=${this.isoStep/3} aria-label=${this.l('Guide position, not build completion','指南位置，唔係建置完成度',true)}></md-linear-progress>`:nothing}
   <div data-step ?hidden=${this.isoMode==='easy'&&this.isoStep!==0}>
   <h4 tabindex="-1">${this.l('What would you like to make?','想製作甚麼？',true)}</h4>
   <md-outlined-select label=${this.l('Detected image profile','已偵測映像組合',true)} .value=${this.isoPlan?.applicable||this.isoOutcome?.effective?'bios-iso':''} disabled><md-select-option value=""><div slot="headline">${this.l('Check source compatibility','檢查來源相容性',true)}</div></md-select-option><md-select-option value="bios-iso">${materialIcon('computer','start')}<div slot="headline">${this.l('Linux disc for a BIOS PC','BIOS 電腦使用嘅 Linux 光碟',true)}</div><div slot="supporting-text">${this.l('Initial RAM filesystem; UEFI unavailable','初始記憶體檔案系統；UEFI 未可用',true)}</div></md-select-option></md-outlined-select>
   ${this.isoHelp('Profile and firmware help','Recommended supported route: x86-64, BIOS, GRUB2 and an initial RAM filesystem. Example output: images/rootfs.iso9660. UEFI is unavailable in this profile; an unsupported source must be reconfigured before applying.','建議支援組合：x86-64、BIOS、GRUB2 同初始記憶體檔案系統。例如輸出 images/rootfs.iso9660。呢個組合唔支援 UEFI；來源唔支援時須先重新設定。','ISO profile and firmware')}
   <h4>${this.l('Where will it be built?','喺邊度建置？',true)}</h4><p>${this.l('Use this project’s already selected Linux environment. No command or image name needs to be typed here.','使用專案已選擇嘅 Linux 環境，毋須喺呢度輸入指令或映像名稱。',true)}</p><md-outlined-select label=${this.l('Saved execution runtime','已儲存執行環境',true)} .value=${this.isoRuntime?'saved':''} disabled><md-select-option value=""><div slot="headline">${this.l('No runtime discovered','未偵測到執行環境',true)}</div></md-select-option>${this.isoRuntime?html`<md-select-option value="saved">${materialIcon('computer','start')}<div slot="headline">${this.isoRuntime.kind}: ${this.isoRuntime.distribution??this.isoRuntime.image??''}</div></md-select-option>`:nothing}</md-outlined-select>
   ${this.isoHelp('Runtime and resource help','The saved project runtime is selected automatically. Use Runtime settings to choose an actually discovered WSL distribution or admitted Docker image. This guided build uses two jobs; use the Build controls for custom resource reservations. Missing runtime access requires setup before retrying.','自動選擇專案已儲存執行環境。請喺執行環境設定選擇實際偵測到嘅 WSL 發行版或已授權 Docker 映像。導引建置使用兩個工作；自訂資源請用建置控制項。存取未就緒時請先完成設定。','ISO runtime and resources')}

   <p>${this.l('Use an adopted x86-64 project with Linux enabled and a trusted configuration. This profile adds GRUB2 and an initial RAM filesystem to the selected source. UEFI and other architectures are not supported by this profile. Existing package and kernel choices remain yours.','請使用已接入、啟用 Linux 同信任設定嘅 x86-64 專案。呢個組合會為所選來源加入 GRUB2 同初始記憶體檔案系統，唔支援 UEFI 或其他架構。現有套件同核心選擇會保留。',true)}</p>
   <h4>${this.l('1. Check the selected source','1. 檢查所選來源',true)}</h4>
   <md-outlined-button ?disabled=${disabled||this.isoActive} @click=${()=>this.isoAction('plan')}>${this.l('Check ISO prerequisites','檢查 ISO 所需設定',true)}</md-outlined-button>
   <md-outlined-button ?disabled=${disabled||this.isoActive} @click=${this.reviewPermission}>${materialIcon('security','icon')}${this.l('Review source execution permission','核對來源執行權限',true)}</md-outlined-button>
   <p>${this.l('First-time setup may need permission to inspect this source. Review opens the exact source and runtime below; nothing is approved until you select the consent checkbox and Allow this scope.','首次設定可能需要來源檢視權限。核對會開啟下方確切來源同執行環境；只有勾選同意並按「批准此範圍」後先授權。',true)}</p>
   ${this.isoPlan?html`<p>${this.isoPlan.profile} · BIOS</p><ul>${this.isoPlan.requirements.map((r:any)=>html`<li><code>${r.symbol}</code>: ${r.selectable?this.l('Available','可用',true):r.reason}</li>`)}</ul><p>${this.isoPlan.applicable?this.l('Configuration requests can be applied. No ISO has been built.','可以套用設定要求，尚未建立 ISO。',true):this.l('This configuration cannot use the profile. Select an x86-64 Linux board and resolve the unavailable requirements, then check again.','呢個設定未能使用此組合。請選擇 x86-64 Linux 板卡並處理不可用設定，再重新檢查。',true)}</p>
   <label><md-checkbox aria-label=${this.l('Apply the listed ISO configuration requests','套用列出嘅 ISO 設定要求',true)} ?disabled=${disabled||!this.isoPlan.applicable} .checked=${this.isoApproved} @change=${(e:Event)=>{this.isoApproved=(e.target as HTMLInputElement).checked;this.revision++;}}></md-checkbox>${this.l('Apply the listed ISO configuration requests','套用列出嘅 ISO 設定要求',true)}</label>
   <md-outlined-button ?disabled=${disabled||!this.isoApproved||!this.isoPlan.applicable} @click=${()=>this.isoAction('apply')}>${this.l('Configure BIOS ISO','設定 BIOS ISO',true)}</md-outlined-button>`:nothing}
   ${this.isoHelp('Effective configuration help','Apply only after reviewing the live source requirements. Reconciliation must retain every required value. A rejected or stale revision needs a fresh check; configuration undo is available in the editor.','檢閱實際來源要求後先套用。協調必須保留全部所需值。版本過期或被拒絕時請重新檢查；編輯器提供設定復原。','ISO configuration and recovery')}
   </div><div data-step ?hidden=${this.isoMode==='easy'&&this.isoStep!==1}><h4 tabindex="-1">${this.l('Make the image file','製作映像檔案',true)}</h4>${!this.isoOutcome?.effective?html`<p>${this.l('Go Back to check and apply the configuration before starting a new build. An existing job can still be refreshed below.','開始新建置前請返回檢查同套用設定，現有工作仍可喺下方重新整理。',true)}</p>`:nothing}
   ${this.isoOutcome?html`<p role="status">${this.isoOutcome.effective?this.l('ISO settings retained after reconciliation. Build is still required.','協調後已保留 ISO 設定，仍需建置。',true):this.l('ISO configuration is incomplete. Required values were not retained; inspect configuration and retry.','ISO 設定未完成，所需值未保留，請檢查設定後重試。',true)}</p>`:nothing}
   <p>${this.l('Build uses the saved WSL or Docker runtime and two parallel jobs. Downloads and compilation can take a long time. Configure runtime access first.','建置使用已儲存嘅 WSL 或 Docker 執行環境，同時執行兩個工作。下載同編譯可能需時，請先設定執行環境存取。',true)}</p>
   <md-outlined-button ?disabled=${disabled||!this.isoOutcome?.effective||this.isoActive} @click=${()=>this.isoAction('build')}>${this.l('Build ISO image','建置 ISO 映像',true)}</md-outlined-button>
   ${this.isoJob?html`<p role="status">${this.l('Recorded job state','已記錄工作狀態',true)}: ${this.isoJob.state} · <code>${this.isoJob.id}</code></p>
   <md-outlined-button ?disabled=${disabled} @click=${()=>this.isoAction('refresh')}>${this.l('Refresh ISO job and log','重新整理 ISO 工作同記錄',true)}</md-outlined-button>
   <md-outlined-button ?disabled=${disabled||!this.isoActive||!['queued','running'].includes(this.isoJob.state)} @click=${()=>this.isoAction('cancel')}>${this.l('Cancel ISO build','取消 ISO 建置',true)}</md-outlined-button>
   <pre tabindex="0" style="max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere" aria-label=${this.l('First 50 build log records','首 50 筆建置記錄',true)}>${this.isoLogs.map(r=>r.value?.text??r.value?.message??(typeof r.value==='string'?r.value:JSON.stringify(r.value))).join('\n')}</pre>`:nothing}
   </div><div data-step ?hidden=${this.isoMode==='easy'&&this.isoStep!==2}><h4 tabindex="-1">${this.l('Check the result','核對結果',true)}</h4><p>${this.l('Your generated file is named rootfs.iso9660. Keep this name while building; export a separately named copy later if needed.','產生嘅檔案名為 rootfs.iso9660。建置期間保留此名稱，有需要可稍後匯出另一個名稱嘅副本。',true)}</p>
   <p><code>images/rootfs.iso9660</code></p>
   ${this.isoHelp('Output name and validation help','Buildroot chooses rootfs.iso9660 in the existing output images directory. No filename guess is needed. Normal incremental builds may replace generated files; choose a separate output directory during project adoption to preserve an earlier image. Export uses a new basename and rejects an existing destination. Check SHA-256 and structure, then verify boot separately.','Buildroot 會喺現有輸出 images 目錄產生 rootfs.iso9660，毋須估檔名。一般增量建置可能更新產生檔案；要保留舊映像，請接入專案時選擇獨立輸出目錄。匯出使用新檔名並拒絕現有目的地。請核對 SHA-256 同結構，再另外驗證開機。','ISO output and validation')}
   ${this.isoHelp('Cancellation and recovery help','Cancel requests interruption of this exact job. Refresh until a terminal state is recorded. Partial output can remain and is not a usable ISO by implication. Review the log, resolve the cause, then rebuild; no automatic deletion or retry occurs.','取消只要求中斷呢個確實工作。請重新整理直至記錄終止狀態。可能保留部分輸出，唔代表係可用 ISO。請檢查記錄並處理原因，再重新建置；唔會自動刪除或重試。','ISO configuration and recovery')}

   <md-outlined-button ?disabled=${disabled||this.isoActive||this.isoJob?.state==='unverified'} @click=${()=>this.isoAction('inspect')}>${this.l('Inspect ISO output','檢查 ISO 輸出',true)}</md-outlined-button>
   ${this.isoInspection?html`<p>${this.isoInspection.size} ${this.l('bytes','位元組',true)}</p><p style="overflow-wrap:anywhere">SHA-256: <code>${this.isoInspection.sha256}</code></p><p role="status">${structural?this.l('ISO descriptor and BIOS boot catalog passed structural checks.','ISO 描述同 BIOS 啟動目錄已通過結構檢查。',true):this.l('Output has not passed BIOS ISO structural checks.','輸出未通過 BIOS ISO 結構檢查。',true)}</p>`:nothing}
   <p>${this.l('Inspection checks the current file, which may come from an earlier build. Structural checks and a successful build do not prove boot: boot execution remains unverified until separately tested. Existing ISO export only copies bytes; it does not create this bootable configuration.','檢查針對目前檔案，可能來自較早建置。結構檢查同建置成功唔代表可以開機，須另外實測。現有 ISO 匯出只會複製位元組，唔會建立呢個啟動設定。',true)}</p>
   </div>
   ${this.isoMode==='easy'?html`<nav class="step-nav" aria-label=${this.l('ISO guide steps','ISO 指南步驟',true)}><md-outlined-button ?disabled=${disabled||this.isoStep===0} @click=${()=>this.moveIso(this.isoStep-1)}>${materialIcon('arrow_back','icon')}${this.l('Back','返回',true)}</md-outlined-button>${this.isoStep<2?html`<md-outlined-button ?disabled=${disabled||(this.isoStep===0?!this.isoOutcome?.effective:!['succeeded','failed','cancelled','interrupted'].includes(this.isoJob?.state))} @click=${()=>this.moveIso(this.isoStep+1)}>${materialIcon('arrow_forward','icon')}${this.l('Next','下一步',true)}</md-outlined-button>`:nothing}</nav>`:nothing}
   ${this.isoBusy?html`<md-linear-progress indeterminate aria-label=${this.l('ISO operation in progress','ISO 操作進行中',true)}></md-linear-progress>`:nothing}
   <p role="status" aria-live="polite">${displayOwnedStatus(this,'isoMessage',this.isoMessage,this.language)}</p>
  </section>`;
 }
 render(){return html`${this.isoWorkflow()}<section ?hidden=${this.isoMode==='easy'} class="panel stack"><h3>${this.l('Image presets','映像預設組合',true)}</h3>
 <p>${this.l('Add packages to the current board configuration. Minimal is a BusyBox baseline, not a removal of existing packages. Server includes Dropbear. Appliance adds SquashFS. Desktop requests one supported display stack. Existing packages and target settings remain in place.','喺目前板卡設定加入套件。最小組合以 BusyBox 為基礎，唔會移除現有套件。伺服器包含 Dropbear，設備加入 SquashFS，桌面要求一個支援嘅顯示組合。現有套件同目標設定會保留。',true)}</p>
 <md-outlined-button ?disabled=${this.disabled||this.busy||this.isoBusy||this.isoActive||!this.workspaceId} @click=${()=>this.run('imagePreset.catalog')}>${this.l('Read selected source capabilities','讀取所選來源支援能力',true)}</md-outlined-button>
 ${this.catalog?html`<md-outlined-select label=${this.l('Preset','預設組合',true)} .value=${this.preset} ?disabled=${this.disabled||this.busy||this.isoBusy||this.isoActive} @change=${(e:Event)=>{this.preset=(e.target as HTMLSelectElement).value;this.desktop=this.preset==='desktop'?'weston':'none';this.changed();}}>${[['minimal','Minimal','最小'],['desktop','Desktop','桌面'],['server','Server','伺服器'],['appliance','Appliance','設備']].map(([id,en,zh])=>html`<md-select-option value=${id}><div slot="headline">${this.l(en,zh)}</div></md-select-option>`)}</md-outlined-select>
 ${this.preset==='desktop'?html`<md-outlined-select label=${this.l('Display stack','顯示組合',true)} .value=${this.desktop} ?disabled=${this.disabled||this.busy||this.isoBusy||this.isoActive} @change=${(e:Event)=>{this.desktop=(e.target as HTMLSelectElement).value;this.changed();}}>${this.catalog.desktops.map((d:any)=>html`<md-select-option value=${d.id} ?disabled=${!d.selectable}><div slot="headline">${d.label}</div><div slot="supporting-text">${d.symbol} ${d.reason||this.l('Selectable','可選',true)}</div></md-select-option>`)}</md-outlined-select>`:nothing}
 <label><md-checkbox ?disabled=${this.disabled||this.busy||this.isoBusy||this.isoActive||this.preset==='server'} ?checked=${this.ssh||this.preset==='server'} @change=${(e:Event)=>{this.ssh=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox>${this.l('Include Dropbear SSH package','加入 Dropbear SSH 套件',true)}</label>
 <md-outlined-button ?disabled=${this.disabled||this.busy||this.isoBusy||this.isoActive} @click=${()=>this.run('imagePreset.plan')}>${this.l('Preview configuration requests','預覽設定要求',true)}</md-outlined-button>`:nothing}
 <p>${this.l('Use the separate account plan below for password-locked accounts and a selected public key. Password enrollment remains unavailable. Including SSH alone does not configure authentication or prove remote access; review target access settings before deployment.','請使用下方獨立帳戶計劃配置鎖定密碼帳戶及所選公鑰。密碼登記仍未可用。單單加入 SSH 唔代表已設定認證或驗證遠端存取，部署前請核對目標存取設定。',true)}</p>
 ${this.preview?html`<h4>${this.l('Configuration preview, not a rendered desktop','設定預覽，並非已運行桌面',true)}</h4><ul>${this.preview.requirements.map((r:any)=>html`<li>${r.symbol}: ${r.selectable?this.l('Available to request','可以要求',true):r.reason}</li>`)}</ul><label><md-checkbox ?disabled=${this.disabled||this.busy||this.isoBusy||this.isoActive||!this.preview.applicable} ?checked=${this.approved} @change=${(e:Event)=>{this.approved=(e.target as HTMLInputElement).checked;this.revision++;}}></md-checkbox>${this.l('Apply these additions and run configuration reconciliation','套用以上新增設定並執行協調',true)}</label><md-outlined-button ?disabled=${this.disabled||this.busy||this.isoBusy||this.isoActive||!this.approved||!this.preview.applicable} @click=${()=>this.run('imagePreset.apply')}>${this.l('Apply preset','套用預設組合',true)}</md-outlined-button>`:nothing}
 ${this.outcome?html`<h4>${this.l('Requested and effective values','要求同實際值',true)}</h4><ul>${this.outcome.requestedSymbols.map((symbol:string)=>html`<li>${symbol}: ${this.l('requested','要求',true)} y; ${this.l('effective','實際',true)} ${String(this.outcome.values[symbol]??this.l('absent','不存在',true))}</li>`)}</ul><p>${this.l('Configuration undo remains available in the configuration editor.','可喺設定編輯器復原。',true)}</p>`:nothing}
 <p role="status" aria-live="polite">${this.busy?this.l('Reading or reconciling configuration…','讀取或協調設定中…',true):this.message}</p></section>`;}
}
customElements.define('image-presets-panel',ImagePresetsPanel);
