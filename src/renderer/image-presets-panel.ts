import {localizedCopy} from './language-wording';
import { LitElement, html, nothing, type PropertyValues } from 'lit';
import '@material/web/button/outlined-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/progress/linear-progress.js';
import { workspaceStyles } from './workspace-styles';
export class ImagePresetsPanel extends LitElement {
 static properties={workspaceId:{type:String},language:{type:String},disabled:{type:Boolean},revision:{state:true}};
 static styles=workspaceStyles;
 workspaceId=''; language='bilingual'; disabled=false; revision=0;
 private catalog:any; private preview:any; private outcome:any; private preset='minimal'; private desktop='none'; private ssh=false; private approved=false; private busy=false; private message='';
 private isoPlan:any; private isoOutcome:any; private isoApproved=false; private isoJob:any; private isoInspection:any; private isoLogs:any[]=[]; private isoBusy=false; private isoMessage='';
 private isoEpoch=0;
 private resetIso(){this.isoEpoch++;this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoJob=undefined;this.isoInspection=undefined;this.isoLogs=[];this.isoMessage='';}
 protected updated(changed:PropertyValues){if(changed.has('workspaceId')){this.resetIso();this.catalog=undefined;this.preview=undefined;this.outcome=undefined;this.approved=false;this.message='';this.revision++;}}
 private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
 private changed(){this.resetIso();this.preview=undefined;this.approved=false;this.outcome=undefined;this.revision++;}
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
  const workspaceId=this.workspaceId,epoch=this.isoEpoch;
  const current=()=>workspaceId===this.workspaceId&&epoch===this.isoEpoch;
  const call=async(name:string,fields:Record<string,unknown>={})=>{
   const reply=await window.studio.operations({action:name,...fields});
   if(!current())throw Error('STALE_WORKSPACE');
   if(!reply.ok)throw Error(reply.code);
   return reply.result as any;
  };
  this.isoBusy=true;this.isoMessage='';this.revision++;
  try{
   if(action==='plan'){
    this.isoPlan=undefined;this.isoOutcome=undefined;this.isoApproved=false;this.isoInspection=undefined;
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
    this.isoJob=await call('build.submit',{workspaceId,target:'all',runtime:options.runtime,jobs:2});
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
   if(action==='plan'||action==='apply'){this.isoPlan=undefined;this.isoApproved=false;this.isoOutcome=undefined;}
   this.isoMessage=this.l('Operation not confirmed. Refresh the plan or job before retrying.','操作未確認，重試前請重新整理計劃或工作。',true)+' '+(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'');
  }}finally{this.isoBusy=false;this.revision++;}
 }
 private get isoActive(){return this.isoJob&&['queued','running','dispatching','cancelling'].includes(this.isoJob.state);}
 private isoWorkflow(){
  const disabled=this.disabled||this.busy||this.isoBusy||!this.workspaceId,iso=this.isoInspection?.iso;
  const structural=iso?.descriptorValid&&iso?.withinImage&&iso?.elTorito?.validationChecksumValid&&iso?.elTorito?.bootEntryValid&&iso?.elTorito?.platformId===0;
  return html`<section class="panel stack" aria-label=${this.l('BIOS ISO workflow','BIOS ISO 流程',true)}>
   <h3>${this.l('Create an x86-64 BIOS ISO','建立 x86-64 BIOS ISO',true)}</h3>
   <p>${this.l('Use an adopted x86-64 project with Linux enabled and a trusted configuration. This profile adds ISOLINUX and an initial RAM filesystem to the selected source. UEFI and other architectures are not supported by this profile. Existing package and kernel choices remain yours.','請使用已接入、啟用 Linux 同信任設定嘅 x86-64 專案。呢個組合會為所選來源加入 ISOLINUX 同初始記憶體檔案系統，唔支援 UEFI 或其他架構。現有套件同核心選擇會保留。',true)}</p>
   <h4>${this.l('1. Check the selected source','1. 檢查所選來源',true)}</h4>
   <md-outlined-button ?disabled=${disabled||this.isoActive} @click=${()=>this.isoAction('plan')}>${this.l('Check ISO prerequisites','檢查 ISO 所需設定',true)}</md-outlined-button>
   ${this.isoPlan?html`<p>${this.isoPlan.profile} · BIOS</p><ul>${this.isoPlan.requirements.map((r:any)=>html`<li><code>${r.symbol}</code>: ${r.selectable?this.l('Available','可用',true):r.reason}</li>`)}</ul><p>${this.isoPlan.applicable?this.l('Configuration requests can be applied. No ISO has been built.','可以套用設定要求，尚未建立 ISO。',true):this.l('This configuration cannot use the profile. Select an x86-64 Linux board and resolve the unavailable requirements, then check again.','呢個設定未能使用此組合。請選擇 x86-64 Linux 板卡並處理不可用設定，再重新檢查。',true)}</p>
   <label><md-checkbox ?disabled=${disabled||!this.isoPlan.applicable} .checked=${this.isoApproved} @change=${(e:Event)=>{this.isoApproved=(e.target as HTMLInputElement).checked;this.revision++;}}></md-checkbox>${this.l('Apply the listed ISO configuration requests','套用列出嘅 ISO 設定要求',true)}</label>
   <md-outlined-button ?disabled=${disabled||!this.isoApproved||!this.isoPlan.applicable} @click=${()=>this.isoAction('apply')}>${this.l('Configure BIOS ISO','設定 BIOS ISO',true)}</md-outlined-button>`:nothing}
   <h4>${this.l('2. Build with the selected runtime','2. 使用所選執行環境建置',true)}</h4>
   ${this.isoOutcome?html`<p role="status">${this.isoOutcome.effective?this.l('ISO settings retained after reconciliation. Build is still required.','協調後已保留 ISO 設定，仍需建置。',true):this.l('ISO configuration is incomplete. Required values were not retained; inspect configuration and retry.','ISO 設定未完成，所需值未保留，請檢查設定後重試。',true)}</p>`:nothing}
   <p>${this.l('Build uses the saved WSL or Docker runtime and two parallel jobs. Downloads and compilation can take a long time. Configure runtime access first.','建置使用已儲存嘅 WSL 或 Docker 執行環境，同時執行兩個工作。下載同編譯可能需時，請先設定執行環境存取。',true)}</p>
   <md-outlined-button ?disabled=${disabled||!this.isoOutcome?.effective||this.isoActive} @click=${()=>this.isoAction('build')}>${this.l('Build ISO image','建置 ISO 映像',true)}</md-outlined-button>
   ${this.isoJob?html`<p role="status">${this.l('Recorded job state','已記錄工作狀態',true)}: ${this.isoJob.state} · <code>${this.isoJob.id}</code></p>
   <md-outlined-button ?disabled=${disabled} @click=${()=>this.isoAction('refresh')}>${this.l('Refresh ISO job and log','重新整理 ISO 工作同記錄',true)}</md-outlined-button>
   <md-outlined-button ?disabled=${disabled||!this.isoActive||!['queued','running'].includes(this.isoJob.state)} @click=${()=>this.isoAction('cancel')}>${this.l('Cancel ISO build','取消 ISO 建置',true)}</md-outlined-button>
   <pre tabindex="0" style="max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere" aria-label=${this.l('First 50 build log records','首 50 筆建置記錄',true)}>${this.isoLogs.map(r=>r.value?.text??r.value?.message??(typeof r.value==='string'?r.value:JSON.stringify(r.value))).join('\n')}</pre>`:nothing}
   <h4>${this.l('3. Inspect the produced ISO','3. 檢查產生嘅 ISO',true)}</h4>
   <p><code>images/rootfs.iso9660</code></p>
   <md-outlined-button ?disabled=${disabled||this.isoActive} @click=${()=>this.isoAction('inspect')}>${this.l('Inspect ISO output','檢查 ISO 輸出',true)}</md-outlined-button>
   ${this.isoInspection?html`<p>${this.isoInspection.size} ${this.l('bytes','位元組',true)}</p><p style="overflow-wrap:anywhere">SHA-256: <code>${this.isoInspection.sha256}</code></p><p role="status">${structural?this.l('ISO descriptor and BIOS boot catalog passed structural checks.','ISO 描述同 BIOS 啟動目錄已通過結構檢查。',true):this.l('Output has not passed BIOS ISO structural checks.','輸出未通過 BIOS ISO 結構檢查。',true)}</p>`:nothing}
   <p>${this.l('Inspection checks the current file, which may come from an earlier build. Structural checks and a successful build do not prove boot: boot execution remains unverified until separately tested. Existing ISO export only copies bytes; it does not create this bootable configuration.','檢查針對目前檔案，可能來自較早建置。結構檢查同建置成功唔代表可以開機，須另外實測。現有 ISO 匯出只會複製位元組，唔會建立呢個啟動設定。',true)}</p>
   ${this.isoBusy?html`<md-linear-progress indeterminate aria-label=${this.l('ISO operation in progress','ISO 操作進行中',true)}></md-linear-progress>`:nothing}
   <p role="status" aria-live="polite">${this.isoMessage}</p>
  </section>`;
 }
 render(){return html`${this.isoWorkflow()}<section class="panel stack"><h3>${this.l('Image presets','映像預設組合',true)}</h3>
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
