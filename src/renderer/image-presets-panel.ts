import {localizedCopy} from './language-wording';
import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import '@material/web/button/outlined-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/labs/card/filled-card.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import {live} from 'lit/directives/live.js';
import {materialIcon} from './material-icons';
import { workspaceStyles } from './workspace-styles';
import {captureOwnedStatus,displayOwnedStatus} from './owned-status';
type IsoBoardEntry={id:string;name:string;origin:string;order:number;root:string;sha256:string};
type IsoBoardCatalog={revision:string;outputRoot:string;entries:IsoBoardEntry[]};
type GuideButton=HTMLButtonElement & {ariaControlsElements:Element[]|null;ariaDescribedByElements:Element[]|null};
export class ImagePresetsPanel extends LitElement {
 static properties={workspaceId:{type:String},language:{type:String},disabled:{type:Boolean},revision:{state:true},configurationGeneration:{type:Number}};
 static styles=[workspaceStyles,css`:host{height:auto;flex-shrink:0}[hidden]{display:none!important} details{overflow-wrap:anywhere} summary{cursor:pointer;min-height:44px} md-outlined-select{max-width:100%} .step-nav{display:flex;flex-wrap:wrap;gap:12px} summary md-icon{vertical-align:middle;margin-right:8px}.profile-info-entry{position:relative;align-self:flex-start}.profile-info-entry md-icon-button{width:44px;height:44px}.profile-info-entry [role=tooltip]{display:none;position:absolute;left:0;bottom:100%;width:max-content;max-width:calc(100vw - 64px);padding:8px;border-radius:8px;background:var(--md-sys-color-inverse-surface,#322f35);color:var(--md-sys-color-inverse-on-surface,#f5eff7);z-index:1;overflow-wrap:anywhere}.profile-info-entry:hover [role=tooltip],.profile-info-entry:focus-within [role=tooltip]{display:block}.profile-guide{padding:16px;max-width:100%;min-width:0}.profile-guide h4{margin-top:0}.profile-guide h4:focus-visible{outline:2px solid var(--md-sys-color-primary);outline-offset:4px}.profile-example-choices{display:flex;flex-wrap:wrap;gap:8px}.board-path{overflow-wrap:anywhere}md-outlined-button{max-width:100%;height:auto;min-height:48px;white-space:normal;overflow-wrap:anywhere;padding-block:8px}`];
 workspaceId=''; language='bilingual'; disabled=false; revision=0; configurationGeneration=0;
 private catalog:any; private preview:any; private outcome:any; private preset='minimal'; private desktop='none'; private ssh=false; private approved=false; private busy=false; private message='';
 private isoPlan:any; private isoOutcome:any; private isoApproved=false; private isoJob:any; private isoInspection:any; private isoLogs:any[]=[]; private isoBusy=false; private isoMessage='';
 private isoEpoch=0; private isoMode='easy'; private isoRuntime:any; private isoStep=0; private isoResumed=false;
 private profileGuideOpen=false;private profileExample:'ram'|'disc'='ram';private profileExampleResult:'ram'|'disc'|null=null;
 // Adapter for the pinned @material/web 2.5.0 icon-button shadow DOM. Its
 // ARIA delegation excludes ID references; bind real elements across the root.
 private guideRelationGeneration=0;
 private guideRelationButtons=new Set<GuideButton>();
 private clearGuideRelations(){this.guideRelationGeneration++;for(const button of this.guideRelationButtons){button.ariaControlsElements=null;button.ariaDescribedByElements=null;}this.guideRelationButtons.clear();}
 private async bindGuideRelations(){
  const generation=++this.guideRelationGeneration;
  const entries=['profile','runtime'].map(kind=>({kind,host:this.renderRoot.querySelector<LitElement>(`#iso-${kind}-info`)}));
  await Promise.all(entries.map(({host})=>host?.updateComplete));
  if(!this.isConnected||generation!==this.guideRelationGeneration)return;
  const current=new Set<GuideButton>();
  for(const {kind,host} of entries){
   if(!host||host!==this.renderRoot.querySelector(`#iso-${kind}-info`))continue;
   const button=host.shadowRoot?.querySelector('button#button');
   const guide=this.renderRoot.querySelector(`#iso-${kind}-guide`),tooltip=this.renderRoot.querySelector(`#iso-${kind}-tooltip`);
   if(!(button instanceof HTMLButtonElement)||!guide||!tooltip||!('ariaControlsElements' in button)||!('ariaDescribedByElements' in button))continue;
   const target=button as GuideButton;
   target.ariaControlsElements=[guide];target.ariaDescribedByElements=[tooltip];current.add(target);
  }
  for(const button of this.guideRelationButtons)if(!current.has(button)){button.ariaControlsElements=null;button.ariaDescribedByElements=null;}
  this.guideRelationButtons=current;
 }
 private runtimeGuideOpen=false;private runtimeExampleTried=false;
 private resetRuntimeGuide(){this.runtimeGuideOpen=false;this.runtimeExampleTried=false;}
 private async toggleRuntimeGuide(open:boolean){
  this.resetRuntimeGuide();this.runtimeGuideOpen=open;this.revision++;const epoch=this.isoEpoch;
  await this.updateComplete;if(!this.isConnected||epoch!==this.isoEpoch||this.runtimeGuideOpen!==open)return;
  this.renderRoot.querySelector<HTMLElement>(open?'#iso-runtime-guide-heading':'#iso-runtime-info')?.focus();
 }
 connectedCallback(){super.connectedCallback();this.requestUpdate();}
 private resetProfileGuide(){this.profileGuideOpen=false;this.profileExample='ram';this.profileExampleResult=null;}
 disconnectedCallback(){this.clearGuideRelations();this.resetProfileGuide();this.resetRuntimeGuide();this.revision++;super.disconnectedCallback();}
 private async toggleProfileGuide(open:boolean){
  this.resetProfileGuide();this.profileGuideOpen=open;this.revision++;const epoch=this.isoEpoch;
  await this.updateComplete;if(!this.isConnected||epoch!==this.isoEpoch||this.profileGuideOpen!==open)return;
  this.renderRoot.querySelector<HTMLElement>(open?'#iso-profile-guide-heading':'#iso-profile-info')?.focus();
 }
 private isoBoards?:IsoBoardCatalog;private isoBoardId='';private isoBoardApproved=false;
 private isoBoardResult?:{name:string;ready:boolean;undoDepth:number};
 private clearBoards(){this.isoBoards=undefined;this.isoBoardId='';this.isoBoardApproved=false;this.isoBoardResult=undefined;}
 private resetIso(){this.isoEpoch++;this.resetProfileGuide();this.resetRuntimeGuide();this.clearBoards();this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoJob=undefined;this.isoInspection=undefined;this.isoLogs=[];this.isoMessage='';this.isoRuntime=undefined;this.isoStep=0;this.isoResumed=false;}
 protected willUpdate(changed:PropertyValues){if(changed.has('configurationGeneration')&&changed.get('configurationGeneration')!==undefined){this.isoEpoch++;this.clearBoards();this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoInspection=undefined;this.isoMessage=this.l('Configuration changed. Check and apply the ISO profile again before building.','設定已更改，建置前請重新檢查同套用 ISO 組合。',true);}}
 protected updated(changed:PropertyValues){void this.bindGuideRelations();if(changed.has('workspaceId')){this.resetIso();this.restoreIso();this.catalog=undefined;this.preview=undefined;this.outcome=undefined;this.approved=false;this.message='';this.revision++;if(this.workspaceId&&!this.disabled)void this.isoAction('plan');}}
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
 private async isoAction(action:'plan'|'apply'|'build'|'refresh'|'cancel'|'inspect'|'boards'|'boardApply'){
  if(this.isoBusy||this.busy||this.disabled||!this.workspaceId||!window.studio?.operations)return;
  if((action==='boards'||action==='boardApply')&&this.isoActive)return;
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
   if(action==='boards'){
    this.clearBoards();
    this.isoBoards=await call('defconfig.catalog',{workspaceId});
    this.isoBoardId=this.boardChoices()[0]?.id??'';
   }else if(action==='boardApply'){
    const selected=this.boardChoices().find(entry=>entry.id===this.isoBoardId);
    if(!this.isoBoardApproved||!this.isoBoards||!selected)return;
    const result=await call('defconfig.apply',{workspaceId,revision:this.isoBoards.revision,id:selected.id});
    const enabled=(name:string)=>result.values?.[name]===true||result.values?.[name]==='y';
    this.isoEpoch++;this.clearBoards();this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoInspection=undefined;this.catalog=undefined;this.preview=undefined;this.approved=false;
    this.isoBoardResult={name:selected.name,ready:enabled('BR2_x86_64')&&enabled('BR2_LINUX_KERNEL'),undoDepth:Number.isInteger(result.undoDepth)?result.undoDepth:0};
    this.saveIso();this.dispatchEvent(new CustomEvent('configuration-changed',{bubbles:true,composed:true,detail:{kind:'iso-board-preset'}}));
   }else if(action==='plan'){
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
   if(action==='boards'||action==='boardApply'){this.clearBoards();this.isoPlan=undefined;this.isoApproved=false;this.isoOutcome=undefined;}
   if(action==='plan'||action==='apply'||action==='build'){this.isoPlan=undefined;this.isoApproved=false;this.isoOutcome=undefined;}
   const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'';
   this.isoMessage=captureOwnedStatus(this,'isoMessage',this.l.bind(this),l=>(['KCONFIG_SEMANTICS_UNAVAILABLE','KCONFIG_SOURCE_TRUST_REQUIRED','KCONFIG_SOURCE_TRUST_CHANGED'].includes(code)?l('ISO compatibility is not confirmed. Choose Review source execution permission, review the exact source and runtime, then explicitly allow the scope if you trust it. Permission is not granted automatically.','ISO 相容性未確認。請選「核對來源執行權限」，核對確切來源同執行環境，信任後先明確批准範圍。唔會自動授權。'):['KCONFIG_RUNTIME_UNAVAILABLE','RUNTIME_REQUIRED'].includes(code)?l('A usable project runtime is required. Open Projects & runtime, select and authorize the project environment, then return and check ISO prerequisites again.','需要可用嘅專案執行環境。請開啟「專案同執行環境」，選擇同授權專案環境，再返回重新檢查 ISO 所需設定。'):(action==='boards'||action==='boardApply')?l('The PC preset result is unconfirmed. Review permission and refresh source PC presets before retrying. Inspect the current configuration first if the response was lost.','電腦預設設定結果未確認。請核對權限同重新尋找來源預設設定後再試；回覆遺失時，請先檢視目前設定。'):l('Operation not confirmed. Refresh the plan or job before retrying.','操作未確認，重試前請重新整理計劃或工作。'))+' '+code);
  }}finally{this.isoBusy=false;if(current())this.saveIso();this.revision++;}
 }
 private get isoActive(){return this.isoJob&&['queued','running','dispatching','cancelling'].includes(this.isoJob.state);}
 private boardChoices(){
  const names=['pc_x86_64_bios_defconfig','qemu_x86_64_defconfig'];
  return (this.isoBoards?.entries??[]).filter(entry=>entry.origin==='buildroot'&&entry.order===0&&names.includes(entry.name)).sort((a,b)=>names.indexOf(a.name)-names.indexOf(b.name));
 }
 private boardLabel(entry:IsoBoardEntry){return entry.name==='pc_x86_64_bios_defconfig'?this.l('BIOS PC sample: start here for a PC','BIOS 電腦範例：電腦由此開始',true):this.l('QEMU x86-64 sample: for a virtual machine','QEMU x86-64 範例：虛擬機使用',true);}
 private boardChooser(disabled:boolean){
  const choices=this.boardChoices(),selected=choices.find(entry=>entry.id===this.isoBoardId),result=this.isoBoardResult;
  return html`<section class="stack" aria-label=${this.l('Choose a PC starting point','選擇電腦起點',true)}><h4>${this.l('Need a PC starting point?','需要電腦起點？',true)}</h4>
   <p>${this.l('If your project is empty or uses the wrong processor, start with a board preset supplied by its source. This selects the processor and Linux kernel together; no symbol names need to be typed. Keep an existing suitable configuration if you do not want to replace it.','專案未設定或處理器唔合適時，可由來源提供嘅板卡預設設定開始。佢會一併選擇處理器同 Linux 核心，毋須輸入設定符號。唔想取代現有合適設定就保留原設定。',true)}</p>
   <md-outlined-button ?disabled=${disabled||this.isoActive} @click=${()=>this.isoAction('boards')}>${materialIcon('search','icon')}${this.l('Find source PC presets','尋找來源電腦預設設定',true)}</md-outlined-button>
   ${this.isoBoards?html`${choices.length?html`<md-outlined-select .label=${this.l('Discovered PC starting point','已發現電腦起點',true)} .value=${this.isoBoardId} ?disabled=${disabled||this.isoActive} @change=${(event:Event)=>{this.isoBoardId=(event.target as HTMLSelectElement).value;this.isoBoardApproved=false;this.revision++;}}>${choices.map(entry=>html`<md-select-option value=${entry.id}>${materialIcon(entry.name==='pc_x86_64_bios_defconfig'?'computer':'memory','start')}<div slot="headline">${this.boardLabel(entry)}</div><div slot="supporting-text">${entry.name}</div></md-select-option>`)}</md-outlined-select>
   <p>${this.l('These are source-provided samples, not a promise that every PC works. The PC sample targets BIOS startup; the QEMU sample targets an emulated machine. UEFI-only hardware needs a different workflow. The source may also retain disk-image or post-build actions.','以上係來源提供嘅範例，唔保證每部電腦適用。電腦範例用 BIOS 啟動；QEMU 範例用模擬機器。只支援 UEFI 嘅硬件須用另一個流程。來源亦可能保留磁碟映像或建置後動作。',true)}</p>
   ${selected?html`<dl><dt>${this.l('Selected source preset','所選來源預設設定',true)}</dt><dd><code>${selected.name}</code></dd><dt>${this.l('Source directory','來源目錄',true)}</dt><dd class="board-path">${selected.root}</dd><dt>${this.l('Output configuration to replace','將取代嘅輸出設定',true)}</dt><dd class="board-path">${this.isoBoards.outputRoot}</dd></dl>`:nothing}
   <p>${this.l('Applying replaces this output configuration, including its package and kernel choices, and runs reconciliation. Existing source files are not edited. The host keeps configuration undo history for this session and restores the previous configuration if reconciliation fails. Use a separate output folder if you want both configurations.','套用會取代此輸出設定，包括套件同核心選擇，並執行協調；唔會編輯現有來源檔案。主機會喺本次工作階段保留設定復原記錄，協調失敗時還原先前設定。想保留兩套設定就使用獨立輸出資料夾。',true)}</p>
   <label><md-checkbox aria-label=${this.l('Replace this output configuration with the selected PC preset','以所選電腦預設設定取代此輸出設定',true)} .checked=${this.isoBoardApproved} ?disabled=${disabled||this.isoActive||!selected} @change=${(event:Event)=>{this.isoBoardApproved=(event.target as HTMLInputElement).checked;this.revision++;}}></md-checkbox>${this.l('Replace this output configuration with the selected PC preset','以所選電腦預設設定取代此輸出設定',true)}</label>
   <md-outlined-button ?disabled=${disabled||this.isoActive||!selected||!this.isoBoardApproved} @click=${()=>this.isoAction('boardApply')}>${materialIcon('check','icon')}${this.l('Apply this PC starting point','套用此電腦起點',true)}</md-outlined-button>`:html`<p role="status">${this.l('This source does not list either supported starting-point name. No preset has been invented or applied. Use Advanced to review its complete board catalogue, or choose a source containing a suitable PC preset.','此來源冇列出兩個支援嘅起點名稱，未有虛構或套用預設設定。請用進階模式核對完整板卡清單，或選擇包含合適電腦預設設定嘅來源。',true)}</p>`}`:nothing}
   ${result?html`<p role="status"><code>${result.name}</code>: ${result.ready?this.l('Preset applied; the returned effective configuration enables x86-64 and Linux. Review source execution permission again for the changed configuration, then check and configure the ISO profile. No ISO was built.','已套用預設設定；傳回嘅實際設定啟用咗 x86-64 同 Linux。請為已更改設定重新核對來源執行權限，再檢查同設定 ISO 組合。未有建立 ISO。',true):this.l('Preset application returned without the required x86-64 and Linux values. ISO readiness is not confirmed. Review the source and configuration before continuing.','預設設定傳回時未保留所需 x86-64 同 Linux 值，ISO 就緒狀態未確認。繼續前請核對來源同設定。',true)}</p>${result.undoDepth>0?html`<p>${this.l('The configuration editor can undo this change during this session. Review permission again first because the configuration scope changed.','設定編輯器可喺本次工作階段復原此更改。設定範圍已變，請先重新核對權限。',true)}</p>`:nothing}`:nothing}
   ${this.isoHelp('Which starting point should I choose?','Use the BIOS PC sample for a BIOS PC starting point, or the QEMU sample for an emulated machine. They are offered only when the selected source actually lists them. Read the full guide for replacement, recovery and hardware limits.','BIOS 電腦可由 BIOS 電腦範例開始，模擬機器則用 QEMU 範例。只有所選來源實際列出時先提供。完整指南說明取代、復原同硬件限制。','Easy ISO board presets')}
  </section>`;
 }
 private isoHelp(title:string,en:string,zh:string,article:string){return html`<details><summary>${materialIcon('help_outline')}${this.l(title,zh,true)}</summary><p>${this.l(en,zh,true)}</p><md-outlined-button @click=${()=>this.dispatchEvent(new CustomEvent('open-documentation',{bubbles:true,composed:true,detail:{title:article}}))}>${materialIcon('description','icon')}${this.l('Read the field guide','閱讀欄位指南',true)}</md-outlined-button></details>`;}
 private runtimeGuidance(){
  const label=this.l('Explain saved execution runtime','說明已儲存執行環境',true);
  const runtime=this.isoRuntime;
  const reference=runtime?.kind==='wsl'&&typeof runtime.distribution==='string'&&runtime.distribution?`WSL: ${runtime.distribution}`:runtime?.kind==='docker'&&typeof runtime.image==='string'&&runtime.image?`Docker: ${runtime.image}`:this.l('Runtime identity is unknown.','執行環境身分未明。',true);
  return html`<div class="profile-info-entry"><md-icon-button id="iso-runtime-info" data-guidance-target="iso-runtime-control" aria-label=${label} aria-expanded=${this.runtimeGuideOpen} @click=${()=>this.toggleRuntimeGuide(!this.runtimeGuideOpen)}>${materialIcon('info')}</md-icon-button><span id="iso-runtime-tooltip" role="tooltip">${label}</span></div>
   <md-filled-card id="iso-runtime-guide" class="profile-guide" role="region" aria-labelledby="iso-runtime-guide-heading" ?hidden=${!this.runtimeGuideOpen} @keydown=${(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();void this.toggleRuntimeGuide(false);}}}>
    ${this.runtimeGuideOpen?html`<h4 id="iso-runtime-guide-heading" tabindex="-1">${this.l('Where does the build run?','建置喺邊度執行？',true)}</h4>
     <p>${this.l('The saved runtime is the Linux environment where this project builds. This guide reads the choice already returned by the project; opening it does not discover, select or authorize another environment.','已儲存執行環境就係專案建置使用嘅 Linux 環境。此說明只讀取專案已回傳嘅選擇；開啟說明唔會尋找、選取或授權其他環境。',true)}</p>
     <p class="board-path" data-runtime-reference>${reference}</p>
     <p>${this.l('A saved name is not proof of access or readiness. If the runtime is missing, unknown or inaccessible, open Projects & runtime, review the discovered environment and its permissions, then return and check ISO prerequisites again. No build has started here.','已儲存名稱唔代表有存取權或已就緒。如果環境欠缺、未明或無法存取，請開啟「專案同執行環境」，核對已偵測環境同權限，再返回重新檢查 ISO 所需設定。呢度未有開始建置。',true)}</p>
     <p>${this.l('The guided build requests two parallel jobs. Think of two work spaces: up to two tasks can run at once while others wait. This is not a speed, memory or completion-time guarantee. Use the separate Build controls for custom resource reservations.','引導建置要求兩個並行工作，好似兩個工作位置：最多兩項工作同時執行，其他等候。呢個唔係速度、記憶體或完成時間保證。自訂資源預留請用另外嘅建置控制項。',true)}</p>
     <p>${this.l('Worked example only: four pretend tasks share two work spaces. Try the example to see the first group. It does not read files, start jobs or change the saved runtime.','以下只係練習例子：四項模擬工作共用兩個位置。試行例子可以睇第一組分配，唔會讀取檔案、開始工作或更改已儲存環境。',true)}</p>
     <div class="step-nav"><md-outlined-button @click=${()=>{this.runtimeExampleTried=true;this.revision++;}}>${materialIcon('play_arrow','icon')}${this.l('Try two-job example','試行兩工作例子',true)}</md-outlined-button><md-outlined-button @click=${()=>{this.runtimeExampleTried=false;this.revision++;}}>${materialIcon('refresh','icon')}${this.l('Reset runtime example','重設執行環境例子',true)}</md-outlined-button></div>
     <p role="status" aria-live="polite">${this.runtimeExampleTried?this.l('Example only: 2 running, 2 waiting. No real job was started.','只係例子：2 項執行中，2 項等候，未有開始任何真實工作。',true):nothing}</p>
     <div class="step-nav"><md-outlined-button @click=${()=>this.dispatchEvent(new CustomEvent('open-documentation',{bubbles:true,composed:true,detail:{title:'ISO runtime and resources'}}))}>${materialIcon('description','icon')}${this.l('Read runtime guide','閱讀執行環境指南',true)}</md-outlined-button><md-outlined-button @click=${()=>this.toggleRuntimeGuide(false)}>${materialIcon('close','icon')}${this.l('Close runtime guide','關閉執行環境說明',true)}</md-outlined-button></div>`:nothing}
   </md-filled-card>`;
 }
 private profileGuidance(){
  const label=this.l('Explain detected image profile','說明已偵測映像組合',true);
  return html`<div class="profile-info-entry"><md-icon-button id="iso-profile-info" data-guidance-target="iso-profile-control" aria-label=${label} aria-describedby="iso-profile-tooltip" aria-controls="iso-profile-guide" aria-expanded=${this.profileGuideOpen} @click=${()=>this.toggleProfileGuide(!this.profileGuideOpen)}>${materialIcon('info')}</md-icon-button><span id="iso-profile-tooltip" role="tooltip">${label}</span></div>
   <md-filled-card id="iso-profile-guide" class="profile-guide" role="region" aria-labelledby="iso-profile-guide-heading" ?hidden=${!this.profileGuideOpen} @keydown=${(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();void this.toggleProfileGuide(false);}}}>
    ${this.profileGuideOpen?html`<h4 id="iso-profile-guide-heading" tabindex="-1">${this.l('What does this image profile do?','呢個映像組合會做甚麼？',true)}</h4>
     <p>${this.l('This guide prepares one Linux disc file for an x86-64 PC using BIOS startup. GRUB2 is the loader that starts Linux. UEFI-only startup is not configured by this profile.','此指南為用 BIOS 啟動嘅 x86-64 電腦準備一個 Linux 光碟檔案。GRUB2 係啟動 Linux 嘅載入器，此組合唔會設定只用 UEFI 嘅啟動方式。',true)}</p>
     <p>${this.l('The guided choice uses initrd: a copy of the Linux root files is loaded into memory when the computer starts. Programs can change that RAM copy while running. This does not rewrite the ISO file or prove that changes will survive a restart.','引導選項使用 initrd：電腦啟動時會將 Linux 根檔案副本載入記憶體。程式運行期間可以改動 RAM 副本，但唔會因此改寫 ISO 檔案，亦唔代表重新啟動後會保留改動。',true)}</p>
     <p>${this.l('Worked example only: compare where a sample note could be changed. No file is created, no real profile is changed and no build or permission request runs. The example starts with the RAM choice used by this guide.','以下只係練習例子，比較範例筆記可以喺邊度改動。唔會建立檔案、更改真實組合、執行建置或要求權限。例子預先選取此指南使用嘅 RAM 選項。',true)}</p>
     <md-chip-set aria-label=${this.l('Example root filesystem location','範例根檔案系統位置',true)}><md-filter-chip has-icon .label=${this.l('RAM copy example','RAM 副本例子',true)} .selected=${live(this.profileExample==='ram')} @click=${()=>{this.profileExample='ram';this.profileExampleResult=null;this.revision++;}}>${materialIcon('memory','icon')}</md-filter-chip><md-filter-chip has-icon .label=${this.l('Read-only disc example','唯讀光碟例子',true)} .selected=${live(this.profileExample==='disc')} @click=${()=>{this.profileExample='disc';this.profileExampleResult=null;this.revision++;}}>${materialIcon('inventory_2','icon')}</md-filter-chip></md-chip-set>
     <div class="profile-example-choices"><md-outlined-button @click=${()=>{this.profileExampleResult=this.profileExample;this.revision++;}}>${materialIcon('play_arrow','icon')}${this.l('Try example','試用例子',true)}</md-outlined-button><md-outlined-button @click=${()=>{this.profileExample='ram';this.profileExampleResult=null;this.revision++;}}>${materialIcon('refresh','icon')}${this.l('Reset example','重設例子',true)}</md-outlined-button></div>
     <p role="status" aria-live="polite">${this.profileExampleResult==='ram'?this.l('Example result: the note can change in the running RAM copy. This does not update the ISO file. Saving across restarts is not demonstrated.','例子結果：筆記可以喺運行中嘅 RAM 副本改動，但唔會更新 ISO 檔案。此例子未示範重新啟動後保存資料。',true):this.profileExampleResult==='disc'?this.l('Example result: a direct disc root is read-only. It is a source alternative shown for comparison; this Easy ISO guide still uses its fixed RAM profile.','例子結果：直接光碟根目錄係唯讀。呢個來源替代選項只用作比較；簡易 ISO 指南仍使用固定 RAM 組合。',true):nothing}</p>
     <p>${this.l('For your real image, check the selected source, review the exact configuration requests, then use the separate Configure and Build actions. The expected generated name is images/rootfs.iso9660. A plan or this example is not proof of an image that boots.','真正製作映像時，請檢查所選來源、核對確切設定要求，再分別使用設定同建置操作。預期產生檔名為 images/rootfs.iso9660。計劃或此例子唔係映像可以開機嘅證明。',true)}</p>
     <div class="profile-example-choices"><md-outlined-button @click=${()=>this.dispatchEvent(new CustomEvent('open-documentation',{bubbles:true,composed:true,detail:{title:'ISO profile and firmware'}}))}>${materialIcon('description','icon')}${this.l('Read the profile guide','閱讀組合指南',true)}</md-outlined-button><md-outlined-button @click=${()=>this.toggleProfileGuide(false)}>${materialIcon('close','icon')}${this.l('Close profile guide','關閉組合指南',true)}</md-outlined-button></div>`:nothing}
   </md-filled-card>`;
 }
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
   ${this.profileGuidance()}<md-outlined-select id="iso-profile-control" label=${this.l('Detected image profile','已偵測映像組合',true)} .value=${this.isoPlan?.applicable||this.isoOutcome?.effective?'bios-iso':''} disabled><md-select-option value=""><div slot="headline">${this.l('Check source compatibility','檢查來源相容性',true)}</div></md-select-option><md-select-option value="bios-iso">${materialIcon('computer','start')}<div slot="headline">${this.l('Linux disc for a BIOS PC','BIOS 電腦使用嘅 Linux 光碟',true)}</div><div slot="supporting-text">${this.l('Initial RAM filesystem; UEFI unavailable','初始記憶體檔案系統；UEFI 未可用',true)}</div></md-select-option></md-outlined-select>
   <h4>${this.l('Where will it be built?','喺邊度建置？',true)}</h4><p>${this.l('Use this project’s already selected Linux environment. No command or image name needs to be typed here.','使用專案已選擇嘅 Linux 環境，毋須喺呢度輸入指令或映像名稱。',true)}</p>${this.runtimeGuidance()}<md-outlined-select id="iso-runtime-control" label=${this.l('Saved execution runtime','已儲存執行環境',true)} .value=${this.isoRuntime?'saved':''} disabled><md-select-option value=""><div slot="headline">${this.l('No runtime discovered','未偵測到執行環境',true)}</div></md-select-option>${this.isoRuntime?html`<md-select-option value="saved">${materialIcon('computer','start')}<div slot="headline">${this.isoRuntime.kind}: ${this.isoRuntime.distribution??this.isoRuntime.image??''}</div></md-select-option>`:nothing}</md-outlined-select>

   <p>${this.l('Use an adopted x86-64 project with Linux enabled and a trusted configuration. This profile adds GRUB2 and an initial RAM filesystem to the selected source. UEFI and other architectures are not supported by this profile. Existing package and kernel choices remain yours.','請使用已接入、啟用 Linux 同信任設定嘅 x86-64 專案。呢個組合會為所選來源加入 GRUB2 同初始記憶體檔案系統，唔支援 UEFI 或其他架構。現有套件同核心選擇會保留。',true)}</p>
   <h4>${this.l('1. Check the selected source','1. 檢查所選來源',true)}</h4>
   <md-outlined-button ?disabled=${disabled||this.isoActive} @click=${()=>this.isoAction('plan')}>${this.l('Check ISO prerequisites','檢查 ISO 所需設定',true)}</md-outlined-button>
   <md-outlined-button ?disabled=${disabled||this.isoActive} @click=${this.reviewPermission}>${materialIcon('security','icon')}${this.l('Review source execution permission','核對來源執行權限',true)}</md-outlined-button>
   <p>${this.l('First-time setup may need permission to inspect this source. Review opens the exact source and runtime below; nothing is approved until you select the consent checkbox and Allow this scope.','首次設定可能需要來源檢視權限。核對會開啟下方確切來源同執行環境；只有勾選同意並按「批准此範圍」後先授權。',true)}</p>
   ${this.boardChooser(disabled)}
   ${this.isoPlan?html`<p>${this.isoPlan.profile} · BIOS</p><ul>${this.isoPlan.requirements.map((r:any)=>html`<li><code>${r.symbol}</code>: ${r.selectable?this.l('Available','可用',true):r.reason}</li>`)}</ul><p>${this.isoPlan.applicable?this.l('Configuration requests can be applied. No ISO has been built.','可以套用設定要求，尚未建立 ISO。',true):this.l('This configuration cannot use the profile yet. Choose a source PC starting point above, review its replacement and permission steps, then check again. Advanced configuration remains available.','此設定暫時未能使用此組合。請喺上方選擇來源電腦起點，核對取代同權限步驟，再重新檢查。進階設定仍可使用。',true)}</p>
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
