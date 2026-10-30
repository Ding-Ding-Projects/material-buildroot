import {live} from 'lit/directives/live.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/chips/chip-set.js';
import {LitElement, css, html, nothing, type PropertyValues} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import {localizedCopy} from './language-wording';
import {materialIcon} from './material-icons';
import './settings-search';
import '@material/web/checkbox/checkbox.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';

export type ImageLibraryRow = {id:string; name:string; authorized:boolean|null};
type AccessFilter = 'all'|'available'|'renewal'|'open';

/** Presentation of host-owned records. Selection never grants filesystem authority. */
export class ShellImageLibrary extends LitElement {
  static properties={language:{type:String},rows:{attribute:false},openIds:{attribute:false},busy:{type:Boolean},state:{type:String},filter:{state:true},matchedIds:{state:true},selected:{state:true},notice:{state:true}};
  language='en'; rows:ImageLibraryRow[]=[]; openIds:string[]=[]; busy=false; state='loading';
  private filter:AccessFilter='all'; private matchedIds:string[]|null=null; private selected=new Set<string>(); private notice='';
  static styles=css`
    :host{display:block;min-width:0}*{box-sizing:border-box}.toolbar,.filters,.selection,.card-head,.card-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .toolbar{justify-content:space-between;margin:24px 0 16px}h2{font-size:20px;font-weight:500;margin:0}h3{font-size:18px;margin:0;overflow-wrap:anywhere;flex:1;min-width:0}
    .filters{margin:12px 0}.filters [aria-pressed=true]{background:var(--md-sys-color-secondary-container);border-radius:24px}.selection{position:sticky;top:8px;z-index:3;width:fit-content;max-width:100%;padding:8px 12px;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);border-radius:28px;margin:12px 0;box-shadow:var(--app-elevation-3)}md-filter-chip{min-height:44px;--md-filter-chip-container-height:44px}.selection label{display:flex;align-items:center;min-height:44px}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px;align-items:stretch}.card{display:flex;flex-direction:column;gap:16px;padding:20px;border:1px solid var(--md-sys-color-outline-variant);border-radius:24px;background:var(--md-sys-color-surface-container-low);min-width:0;box-shadow:var(--app-elevation-1)}.card[data-selected]{border-color:var(--md-sys-color-primary);background:var(--md-sys-color-primary-container)}
    .avatar{display:flex;align-items:center;justify-content:center;width:56px;height:56px;flex-shrink:0;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);clip-path:polygon(50% 0%,63% 8%,79% 6%,86% 21%,100% 30%,96% 46%,100% 62%,88% 73%,84% 89%,68% 91%,55% 100%,42% 93%,26% 97%,17% 84%,3% 76%,6% 60%,0% 45%,9% 31%,11% 15%,27% 11%,38% 2%)}.card[data-renewal]{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}.card[data-renewal] p{color:inherit}.card[data-renewal] .avatar{clip-path:none;border-radius:16px;background:var(--md-sys-color-error);color:var(--md-sys-color-on-error)}.avatar md-icon{color:inherit}.card-actions{margin-top:auto}.card-head md-icon{color:var(--md-sys-color-primary)}.badge{font-size:12px;line-height:1.4;padding:6px 10px;border-radius:8px;background:var(--md-sys-color-surface-container-high);width:fit-content}.badge.renewal{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
    p{font-size:14px;line-height:1.5;margin:0;color:var(--md-sys-color-on-surface-variant);overflow-wrap:anywhere}.empty{padding:32px 24px;border:1px dashed var(--md-sys-color-outline-variant);border-radius:16px;display:grid;gap:12px}.empty md-icon{font-size:32px}md-outlined-button,md-text-button{min-height:44px}settings-search{display:block;min-width:0}
    :focus-visible{outline:3px solid var(--md-sys-color-primary);outline-offset:3px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
  `;
  private l(en:string,zh:string){return localizedCopy(en,zh,this.language,true);}
  protected willUpdate(changed:PropertyValues){if(changed.has('rows')){const ids=new Set(this.rows.map(row=>row.id));this.selected=new Set([...this.selected].filter(id=>ids.has(id)));}}
  private visibleRows(){return this.rows.filter(row=>(this.matchedIds===null||this.matchedIds.includes(row.id))&&(this.filter==='all'||this.filter==='available'&&row.authorized===true||this.filter==='renewal'&&row.authorized===false||this.filter==='open'&&this.openIds.includes(row.id)));}
  private toggle(id:string,checked:boolean){const next=new Set(this.selected);if(checked)next.add(id);else next.delete(id);this.selected=next;}
  private request(row:ImageLibraryRow){this.dispatchEvent(new CustomEvent('image-library-open',{bubbles:true,composed:true,detail:{id:row.id,renew:row.authorized===false}}));}
  private exportSelection(){
    // A catalogue export contains records only, never paths, grants or image bytes.
    const projects=this.rows.filter(row=>this.selected.has(row.id)).map(({id,name})=>({id,name}));
    if(!projects.length)return;
    try{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,kind:'project-catalogue',projects},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='project-catalogue.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.notice=this.l('Catalogue download requested. This contains project names and identifiers, not images or access permissions.','已要求下載目錄，只包含專案名稱同識別碼，唔包含映像或存取權。');}catch{this.notice=this.l('Catalogue download could not be started. Selection is retained.','未能開始下載目錄，已保留選擇。');}
  }
  render(){const rows=this.visibleRows(),allSelected=rows.length>0&&rows.every(row=>this.selected.has(row.id));return html`
    <div class="toolbar"><h2>${this.l('Your image projects','你嘅映像專案')}</h2><md-text-button ?disabled=${this.state==='loading'} @click=${()=>this.dispatchEvent(new CustomEvent('image-library-refresh',{bubbles:true,composed:true}))}>${materialIcon('refresh','icon')}${this.l('Refresh projects','重新整理專案')}</md-text-button></div>
    <settings-search .language=${this.language} .label=${this.l('Search image projects','搜尋映像專案')} .entries=${this.rows.map(row=>({id:row.id,text:row.name}))} @settings-filter=${(event:CustomEvent<string[]>)=>{event.stopPropagation();this.matchedIds=event.detail;}}></settings-search>
    <md-chip-set class="filters" aria-label=${this.l('Filter projects','篩選專案')}>${([['all','All projects','全部專案'],['available','Folder access saved','已儲存資料夾存取權'],['renewal','Needs access','需要存取權'],['open','Open workspaces','已開啟工作區']] as const).map(([id,en,zh])=>html`<md-filter-chip .label=${this.l(en,zh)} .selected=${live(this.filter===id)} @click=${()=>{this.filter=id;this.requestUpdate();}}></md-filter-chip>`)}</md-chip-set>
    ${this.state==='loading'?html`<p role="status">${this.l('Reading saved projects…','正在讀取已儲存專案…')}</p>`:nothing}
    ${this.state==='unavailable'?html`<p role="status">${this.l('Project catalogue unavailable. Previous records may be stale. Refresh to retry; access is checked again when opening.','專案目錄未能使用，之前記錄可能過時。請重新整理再試，開啟時會再次核對存取權。')}</p>`:nothing}
    ${this.rows.length?html`<div class="selection" role="toolbar" aria-label=${this.l("Selected project actions","已選專案操作")}><label><md-checkbox aria-label=${this.l('Select visible projects','選取可見專案')} .checked=${allSelected} .indeterminate=${!allSelected&&rows.some(row=>this.selected.has(row.id))} @change=${(event:Event)=>{const next=new Set(this.selected);for(const row of rows){if((event.target as HTMLInputElement).checked)next.add(row.id);else next.delete(row.id);}this.selected=next;}}></md-checkbox>${this.l('Select visible','選取可見項目')}</label><span role="status">${this.selected.size} ${this.l('selected','已選取')}</span><md-text-button ?disabled=${!this.selected.size} @click=${this.exportSelection}>${this.l('Export selected catalogue','匯出已選目錄')}</md-text-button><md-text-button ?disabled=${!this.selected.size} @click=${()=>this.selected=new Set()}>${this.l('Clear selection','清除選擇')}</md-text-button></div>`:nothing}
    <div class="cards">${repeat(rows,row=>row.id,row=>html`<article class="card" ?data-renewal=${row.authorized===false} ?data-selected=${this.selected.has(row.id)}><div class="card-head"><span class="avatar" aria-hidden="true">${materialIcon(row.authorized===false?'folder_open':'inventory_2')}</span><h3>${row.name}</h3><md-checkbox aria-label=${this.l('Select project','選取專案')+' '+row.name} .checked=${this.selected.has(row.id)} @change=${(event:Event)=>this.toggle(row.id,(event.target as HTMLInputElement).checked)}></md-checkbox></div><span class=${'badge'+(row.authorized===false?' renewal':'')}>${row.authorized===false?this.l('Renew folder access','更新資料夾存取權'):this.openIds.includes(row.id)?this.l('Workspace open','工作區已開啟'):this.l('Saved project','已儲存專案')}</span><p>${this.l('Open the workspace to inspect configuration, builds and verified outputs. A saved project is not a completed image.','開啟工作區以檢視設定、建置同已驗證輸出。已儲存專案唔代表映像已完成。')}</p><div class="card-actions"><md-outlined-button data-resume-project=${row.id} ?disabled=${this.busy} @click=${()=>this.request(row)}>${materialIcon('folder_open','icon')}${row.authorized===false?this.l('Renew access','更新存取權'):this.l('Open workspace','開啟工作區')}</md-outlined-button></div></article>`)}</div>
    ${!rows.length&&this.state==='ready'?html`<div class="empty">${materialIcon('folder_open')}<h3>${this.rows.length?this.l('No matching projects','無符合專案'):this.l('Start with an image project','由映像專案開始')}</h3><p>${this.rows.length?this.l('Change the search or access filter to see other saved projects.','更改搜尋或存取權篩選以查看其他已儲存專案。'):this.l('Create a guided image draft or open existing Buildroot source using the actions above.','使用上方操作建立引導映像草稿，或者開啟現有 Buildroot 來源。')}</p></div>`:nothing}
    ${this.notice?html`<p role="status">${this.notice}</p>`:nothing}`;}
}
customElements.define('shell-image-library',ShellImageLibrary);
