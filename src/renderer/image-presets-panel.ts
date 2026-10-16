import { LitElement, html, nothing, type PropertyValues } from 'lit';
import '@material/web/button/outlined-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/checkbox/checkbox.js';
import { workspaceStyles } from './workspace-styles';
export class ImagePresetsPanel extends LitElement {
 static properties={workspaceId:{type:String},language:{type:String},disabled:{type:Boolean},revision:{state:true}};
 static styles=workspaceStyles;
 workspaceId=''; language='bilingual'; disabled=false; revision=0;
 private catalog:any; private preview:any; private outcome:any; private preset='minimal'; private desktop='none'; private ssh=false; private approved=false; private busy=false; private message='';
 protected updated(changed:PropertyValues){if(changed.has('workspaceId')){this.catalog=undefined;this.preview=undefined;this.outcome=undefined;this.approved=false;this.message='';this.revision++;}}
 private l(en:string,zh:string){return this.language==='en'?en:this.language==='zh-HK'?zh:`${en} · ${zh}`;}
 private changed(){this.preview=undefined;this.approved=false;this.outcome=undefined;this.revision++;}
 private async run(action:string){
  if(this.busy||this.disabled||!this.workspaceId||!window.studio?.operations)return;
  this.busy=true;this.message='';this.revision++;const workspaceId=this.workspaceId;
  try{const reply=await window.studio.operations({action,workspaceId,...(action==='imagePreset.catalog'?{}:{revision:this.catalog.revision,preset:this.preset,desktop:this.desktop,ssh:this.ssh})});
   if(this.workspaceId!==workspaceId)return;
   if(!reply.ok)throw Error(reply.code);
   if(action==='imagePreset.catalog'){this.catalog=reply.result;this.changed();}
   else if(action==='imagePreset.plan'){this.preview=reply.result;this.approved=false;}
   else{this.outcome=reply.result;this.catalog=undefined;this.preview=undefined;this.approved=false;this.message=this.l('Configuration reconciled. Check effective values below; no image was built or booted.','設定已協調。請核對下方實際值，未有建立或啟動映像。');this.dispatchEvent(new CustomEvent('configuration-changed',{bubbles:true,composed:true}));}
  }catch(error){if(this.workspaceId===workspaceId){this.preview=undefined;this.approved=false;this.catalog=undefined;this.message=this.l('Operation not confirmed. Refresh capabilities and check configuration trust.','操作未確認。請重新整理支援能力並核對設定信任。')+' '+(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'');}}
  finally{this.busy=false;this.revision++;}
 }
 render(){return html`<section class="panel stack"><h3>${this.l('Image presets','映像預設組合')}</h3>
 <p>${this.l('Add packages to the current board configuration. Minimal is a BusyBox baseline, not a removal of existing packages. Server includes Dropbear. Appliance adds SquashFS. Desktop requests one supported display stack. Existing packages and target settings remain in place.','喺目前板卡設定加入套件。最小組合以 BusyBox 為基礎，唔會移除現有套件。伺服器包含 Dropbear，設備加入 SquashFS，桌面要求一個支援嘅顯示組合。現有套件同目標設定會保留。')}</p>
 <md-outlined-button ?disabled=${this.disabled||this.busy||!this.workspaceId} @click=${()=>this.run('imagePreset.catalog')}>${this.l('Read selected source capabilities','讀取所選來源支援能力')}</md-outlined-button>
 ${this.catalog?html`<md-outlined-select label=${this.l('Preset','預設組合')} .value=${this.preset} ?disabled=${this.disabled||this.busy} @change=${(e:Event)=>{this.preset=(e.target as HTMLSelectElement).value;this.desktop=this.preset==='desktop'?'weston':'none';this.changed();}}>${[['minimal','Minimal','最小'],['desktop','Desktop','桌面'],['server','Server','伺服器'],['appliance','Appliance','設備']].map(([id,en,zh])=>html`<md-select-option value=${id}><div slot="headline">${this.l(en,zh)}</div></md-select-option>`)}</md-outlined-select>
 ${this.preset==='desktop'?html`<md-outlined-select label=${this.l('Display stack','顯示組合')} .value=${this.desktop} ?disabled=${this.disabled||this.busy} @change=${(e:Event)=>{this.desktop=(e.target as HTMLSelectElement).value;this.changed();}}>${this.catalog.desktops.map((d:any)=>html`<md-select-option value=${d.id} ?disabled=${!d.selectable}><div slot="headline">${d.label}</div><div slot="supporting-text">${d.symbol} ${d.reason||this.l('Selectable','可選')}</div></md-select-option>`)}</md-outlined-select>`:nothing}
 <label><md-checkbox ?disabled=${this.disabled||this.busy||this.preset==='server'} ?checked=${this.ssh||this.preset==='server'} @change=${(e:Event)=>{this.ssh=(e.target as HTMLInputElement).checked;this.changed();}}></md-checkbox>${this.l('Include Dropbear SSH package','加入 Dropbear SSH 套件')}</label>
 <md-outlined-button ?disabled=${this.disabled||this.busy} @click=${()=>this.run('imagePreset.plan')}>${this.l('Preview configuration requests','預覽設定要求')}</md-outlined-button>`:nothing}
 <p>${this.l('Use the separate account plan below for password-locked accounts and a selected public key. Password enrollment remains unavailable. Including SSH alone does not configure authentication or prove remote access; review target access settings before deployment.','請使用下方獨立帳戶計劃配置鎖定密碼帳戶及所選公鑰。密碼登記仍未可用。單單加入 SSH 唔代表已設定認證或驗證遠端存取，部署前請核對目標存取設定。')}</p>
 ${this.preview?html`<h4>${this.l('Configuration preview, not a rendered desktop','設定預覽，並非已運行桌面')}</h4><ul>${this.preview.requirements.map((r:any)=>html`<li>${r.symbol}: ${r.selectable?this.l('Available to request','可以要求'):r.reason}</li>`)}</ul><label><md-checkbox ?disabled=${this.disabled||this.busy||!this.preview.applicable} ?checked=${this.approved} @change=${(e:Event)=>{this.approved=(e.target as HTMLInputElement).checked;this.revision++;}}></md-checkbox>${this.l('Apply these additions and run configuration reconciliation','套用以上新增設定並執行協調')}</label><md-outlined-button ?disabled=${this.disabled||this.busy||!this.approved||!this.preview.applicable} @click=${()=>this.run('imagePreset.apply')}>${this.l('Apply preset','套用預設組合')}</md-outlined-button>`:nothing}
 ${this.outcome?html`<h4>${this.l('Requested and effective values','要求同實際值')}</h4><ul>${this.outcome.requestedSymbols.map((symbol:string)=>html`<li>${symbol}: ${this.l('requested','要求')} y; ${this.l('effective','實際')} ${String(this.outcome.values[symbol]??this.l('absent','不存在'))}</li>`)}</ul><p>${this.l('Configuration undo remains available in the configuration editor.','可喺設定編輯器復原。')}</p>`:nothing}
 <p role="status" aria-live="polite">${this.busy?this.l('Reading or reconciling configuration…','讀取或協調設定中…'):this.message}</p></section>`;}
}
customElements.define('image-presets-panel',ImagePresetsPanel);
