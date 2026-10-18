import {LitElement,html,css,type PropertyValues} from 'lit';
import {live} from 'lit/directives/live.js';
import {localizedCopy} from './language-wording';
import {validImageName,type ImageCreationIntent} from './image-workflow-draft';
import {materialIcon} from './material-icons';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

/** Pre-project intent only. Native project and runtime controls remain separate. */
export class GuidedImageCreation extends LitElement{
 static properties={draft:{attribute:false},language:{type:String},blocked:{type:Boolean},nameInput:{state:true}};
 draft!:ImageCreationIntent;language='en';blocked=false;nameInput='';
 static styles=css`:host{display:block;min-width:0;padding:16px 24px;color:inherit}h2{font-size:24px;font-weight:500;margin:0 0 8px}p{line-height:1.4;margin:8px 0}.fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}md-outlined-text-field,md-outlined-select{width:100%;min-width:0}md-filled-button,md-outlined-button{min-height:44px}md-icon{font-family:'Material Icons';font-size:20px}@media(max-width:600px){:host{padding:12px}.fields{grid-template-columns:1fr}}`;
 protected willUpdate(changed:PropertyValues){if(changed.has('draft')&&this.draft)this.nameInput=this.draft.name;}
 private l(en:string,zh:string){return localizedCopy(en,zh,this.language,true);}
 private change(patch:Partial<ImageCreationIntent>){this.dispatchEvent(new CustomEvent('creation-change',{bubbles:true,composed:true,detail:patch}));}
 private purposeLabel(id:string){const labels:Record<string,[string,string]>={keep:['Keep existing contents','保留現有內容'],minimal:['Minimal Linux','精簡 Linux'],desktop:['Graphical desktop','圖像桌面'],server:['Small server','小型伺服器'],appliance:['Appliance','專用設備']};return labels[id]?this.l(...labels[id]):this.l('Unverified choice','未核實選擇');}
 private source(){this.dispatchEvent(new CustomEvent('creation-source',{bubbles:true,composed:true}));}
 render(){const d=this.draft;if(!d)return html``;return html`<h2 id="creation-heading" tabindex="-1">${d.stage==='purpose'?this.l('Purpose and target','用途同目標'):this.l('Source and runtime','來源同執行環境')}</h2>
 ${d.stage==='purpose'?html`<p>${this.l('Choose your intention first. Source compatibility is not checked yet.','先選擇製作用途，來源相容性尚未核對。')}</p><div class="fields">
 <md-outlined-text-field label=${this.l('Image name','映像名稱')} .value=${live(this.nameInput)} maxlength="64" ?error=${!validImageName(this.nameInput)} error-text=${this.l('Use a safe name of 1–64 letters, digits, dots, hyphens or underscores.','請用 1–64 個英文字母、數字、點、連字號或底線。')} @input=${(event:Event)=>{this.nameInput=(event.target as HTMLInputElement).value;if(validImageName(this.nameInput))this.change({name:this.nameInput});}}></md-outlined-text-field>
 <md-outlined-select label=${this.l('Configuration mode','設定模式')} .value=${d.mode} @change=${(event:Event)=>this.change({mode:(event.target as HTMLSelectElement).value as ImageCreationIntent['mode']})}>${[['easy','Easy','簡易'],['advanced','Advanced','進階']].map(([id,en,zh])=>html`<md-select-option value=${id}><div slot="headline">${this.l(en,zh)}</div></md-select-option>`)}</md-outlined-select>
 <md-outlined-select label=${this.l('Intended purpose (unverified)','預定用途（未核實）')} .value=${d.purpose} @change=${(event:Event)=>this.change({purpose:(event.target as HTMLSelectElement).value as ImageCreationIntent['purpose']})}>${[['keep','Keep existing contents','保留現有內容'],['minimal','Minimal Linux','精簡 Linux'],['desktop','Graphical desktop','圖像桌面'],['server','Small server','小型伺服器'],['appliance','Appliance','專用設備']].map(([id,en,zh])=>html`<md-select-option value=${id}>${materialIcon(({keep:'tune',minimal:'code',desktop:'computer',server:'link',appliance:'inventory_2'} as Record<string,string>)[id],'start')}<div slot="headline">${this.l(en,zh)}</div></md-select-option>`)}</md-outlined-select>
 <md-outlined-select label=${this.l('Intended target (unverified)','預定目標（未核實）')} value="bios-iso"><md-select-option value="bios-iso">${materialIcon('computer','start')}<div slot="headline">${this.l('x86-64 BIOS ISO','x86-64 BIOS ISO')}</div></md-select-option></md-outlined-select>
 </div>${!validImageName(this.nameInput)?html`<p class="name-save-warning" role="status">${this.l('This name is not saved. The last valid name is retained, including when you return to Images.','呢個名稱未儲存。會保留上次有效名稱，返回映像時亦一樣。')}</p>`:null}<p>${this.l('UEFI-only machines are unsupported by this producer. Package support is checked after source selection.','呢個建置流程唔支援只用 UEFI 嘅機器。選擇來源後先核對套件支援。')}</p>`:html`<p>${d.name} · ${this.purposeLabel(d.purpose)} · x86-64 BIOS · ${this.l('Intent saved; permissions and compatibility remain unverified.','已儲存意向；權限同相容性仍未核實。')}</p>`}
 <div class="actions">${d.stage==='purpose'?html`<md-filled-button ?disabled=${this.blocked||!validImageName(this.nameInput)} @click=${this.source}>${this.l('Next: source and runtime','下一步：來源同執行環境')}</md-filled-button>`:html`<md-outlined-button ?disabled=${this.blocked} @click=${()=>this.change({stage:'purpose'})}>${this.l('Back to purpose','返回用途')}</md-outlined-button>`}<md-outlined-button @click=${()=>this.dispatchEvent(new CustomEvent('creation-return',{bubbles:true,composed:true}))}>${this.l('Return to Images','返回映像')}</md-outlined-button></div>`;}
}
customElements.define('guided-image-creation',GuidedImageCreation);
