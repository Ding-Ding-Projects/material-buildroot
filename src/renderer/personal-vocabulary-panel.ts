import {LitElement,html,css,nothing} from 'lit';
import {materialIcon} from './material-icons';
import {vocabulary} from './owned-copy';
import {VOCABULARY_LIMITS} from '../shared/personal-vocabulary.mjs';
import '@material/web/button/outlined-button.js';
export class PersonalVocabularyPanel extends LitElement{
 static properties={language:{type:String},revision:{state:true},busy:{state:true},error:{state:true}};
 language='bilingual';revision=0;busy=false;error=false;private unsubscribe?:()=>void;
 static styles=css`:host{display:block}:host([hidden]){display:none}.row{display:flex;gap:8px;flex-wrap:wrap}h2{font-size:16px;margin:0}p{line-height:1.5}input[hidden]{display:none}md-outlined-button{min-height:48px;--md-outlined-button-container-height:48px}`;
 connectedCallback(){super.connectedCallback();this.unsubscribe=vocabulary.subscribe(()=>this.revision++);}
 disconnectedCallback(){this.unsubscribe?.();super.disconnectedCallback();}
 private l(en:string,zh:string){return this.language==='en'?en:this.language==='zh-HK'?zh:`${en} · ${zh}`;}
 focusAction(action:'upload'|'status'|'clear'){(this.renderRoot.querySelector('#'+action) as HTMLElement|null)?.focus();}
 private async importFile(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file||vocabulary.school()!=='inactive')return;this.busy=true;this.error=false;try{const bytes=file.size>VOCABULARY_LIMITS.bytes?new Uint8Array(VOCABULARY_LIMITS.bytes+1):new Uint8Array(await file.arrayBuffer());await vocabulary.import(bytes);}catch{this.error=true;}finally{this.busy=false;}}
 private async clear(){this.busy=true;this.error=false;try{await vocabulary.clear();}catch{this.error=true;}finally{this.busy=false;}}
 render(){const school=vocabulary.school();if(school==='active')return nothing;const status=vocabulary.status();return html`
 <h2>${this.l('Personal vocabulary','個人詞彙')}</h2>
 <p id="status" tabindex="-1" role="status">${school==='unknown'?this.l('Shared preference status is unavailable. Personal vocabulary is inactive.','未能取得共用偏好狀態。個人詞彙未啟用。'):this.error?this.l('Local storage could not confirm the change. Reload before trying again.','本機儲存未能確認變更。請重新載入再試。'):status.state==='loaded'?this.l('Local vocabulary loaded.','已載入本機詞彙。'):status.state==='invalid'?this.l('Invalid file. The previous valid vocabulary is retained.','檔案無效。保留之前有效嘅詞彙。'):status.state==='corrupt'?this.l('Saved vocabulary could not be validated. Clear it or replace it.','無法驗證已儲存詞彙。請清除或取代。'):this.l('No local vocabulary selected.','未選擇本機詞彙。')}</p>
 ${school==='inactive'?html`<p>${this.l('Import a vocabulary JSON file, up to 256 KiB. It stays in this application’s private local cache. Only selected interface labels change; project data, commands and documentation remain verbatim.','匯入最大 256 KiB 嘅詞彙 JSON 檔。檔案只會留喺本應用程式嘅私人本機快取。只會更改指定介面標籤；專案資料、指令同文件保持原文。')}</p>
 <div class="row"><md-outlined-button id="upload" ?disabled=${this.busy||this.error} @click=${()=>this.renderRoot.querySelector<HTMLInputElement>('#file')?.click()}>${materialIcon('upload','icon')}${status.active?this.l('Replace local vocabulary','取代本機詞彙'):this.l('Import local vocabulary','匯入本機詞彙')}</md-outlined-button><md-outlined-button id="clear" ?disabled=${this.busy||this.error||status.state==='empty'} @click=${this.clear}>${materialIcon('delete','icon')}${this.l('Clear local vocabulary','清除本機詞彙')}</md-outlined-button></div>
 <input id="file" hidden tabindex="-1" type="file" accept=".json,application/json" @change=${this.importFile}>
 <p>${this.l('Vocabulary and file metadata are excluded from exports and history. No vocabulary preview is shown.','匯出同歷史記錄唔包括詞彙同檔案中繼資料。唔會顯示詞彙預覽。')}</p>`:nothing}`;}
}
customElements.define('personal-vocabulary-panel',PersonalVocabularyPanel);
