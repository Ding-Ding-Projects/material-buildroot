import {LitElement,html,css,nothing} from 'lit';
import '@material/web/slider/slider.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import {wording} from './language-wording-state';
import {localizedCopy} from './language-wording';
import {vocabulary} from './owned-copy';
export class LanguageWordingPanel extends LitElement{
 static properties={language:{type:String},name:{state:true},notice:{state:true}};
 language='bilingual';name=wording.get().displayName;notice='';
 static styles=css`:host{display:block;min-width:0}.row{display:flex;align-items:center;flex-wrap:wrap;gap:12px}md-slider{width:min(100%,320px)}md-outlined-text-field{width:min(100%,420px)}p{overflow-wrap:anywhere;line-height:1.5}md-text-button,md-outlined-button{min-height:48px}h3{font-size:16px}`;
 private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
 private save(change:Parameters<typeof wording.save>[0]){this.notice=wording.save(change)?'saved':'failed';}
 render(){if(vocabulary.school()!=='inactive')return nothing;const p=wording.get();return html`
 <h3>${this.l('Voice and display name','語氣同顯示名稱',true)}</h3>
 <p>${this.l('English and Cantonese each start at level 5. Humor styles messages, including errors and warnings, without changing their facts. Change or reset either language independently.','英文同粵語預設各為第 5 級。幽默會調整訊息、錯誤同警告嘅語氣，但唔改變事實。兩種語言可以分開更改或重設。',true)}</p>
 ${(['englishHumor','cantoneseHumor'] as const).map((field,index)=>html`<div><label id=${field}>${index===0?this.l('English humor','英文幽默程度',true):this.l('Cantonese humor','粵語幽默程度',true)} (${p[field]}/5)</label><div class="row"><md-slider min="1" max="5" step="1" ticks labeled .value=${p[field]} aria-label=${index===0?this.l('English humor','英文幽默程度',true):this.l('Cantonese humor','粵語幽默程度',true)} @change=${(e:Event)=>this.save({[field]:Number((e.target as HTMLInputElement).value)})}></md-slider><md-text-button @click=${()=>this.save({[field]:5})}>${index===0?this.l('Reset English humor','重設英文幽默程度',true):this.l('Reset Cantonese humor','重設粵語幽默程度',true)}</md-text-button></div></div>`)}
 <p>${this.l('1: serious. 5: most playful.','1：認真。5：最幽默。',true)}</p>
 <p role="status">${this.l('Your language settings are ready.','語言設定已準備好。',true)}</p>
 <md-outlined-text-field .label=${this.l('Application display name','應用程式顯示名稱',true)} .value=${this.name} maxlength="192" @input=${(e:Event)=>this.name=(e.target as HTMLInputElement).value}></md-outlined-text-field>
 <p>${this.l('Use up to 96 characters. Leave empty for Material Buildroot. Only the local interface title changes; installed identity, files and exports keep their original names.','最多 96 個字元。留空會使用 Material Buildroot。只更改本機介面標題；安裝識別、檔案同匯出保留原名。',true)}</p>
 <div class="row"><md-outlined-button @click=${()=>this.save({displayName:this.name.trim()})}>${this.l('Save display name','儲存顯示名稱',true)}</md-outlined-button><md-text-button @click=${()=>{this.name='';this.save({displayName:''});}}>${this.l('Reset display name','重設顯示名稱',true)}</md-text-button></div>
 <p role="status">${this.notice==='failed'||wording.unavailable()?this.l('The preference could not be stored or restored. The last confirmed values remain active; invalid saved data uses defaults.','未能儲存或還原偏好。保留上次確認嘅值；無效嘅已存資料會使用預設值。',true):this.notice==='saved'?this.l('Saved on this device.','已儲存喺呢部裝置。',true):nothing}</p>`;}
}
customElements.define('language-wording-panel',LanguageWordingPanel);
