import {LitElement, html, css, nothing} from 'lit';
import {localizedCopy} from './language-wording';
import {materialIcon} from './material-icons';
import '@material/web/button/text-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

export interface FormGuide {
  title: string;
  purpose: string;
  steps: string[];
  example: string;
  expected: string;
  options?: string[];
  validate?: (value: string) => string;
}
/** Optional, isolated practice. It never receives the live field value or host authority. */
export class GuidedForms extends LitElement {
  static properties = {guide:{attribute:false},language:{type:String},opened:{state:true},step:{state:true},sample:{state:true},result:{state:true}};
  guide?:FormGuide; language='bilingual'; opened=false; step=0; sample=''; result='';
  static styles=css`:host{display:block;min-width:0}md-icon-button{width:44px;height:44px}section{padding:12px;border:1px solid var(--md-sys-color-outline-variant);border-radius:12px;overflow-wrap:anywhere;background:var(--md-sys-color-surface-container)}p{white-space:pre-wrap}.row{display:flex;flex-wrap:wrap;gap:8px}md-outlined-text-field,md-outlined-select{width:100%;min-width:0}:focus-visible{outline:3px solid var(--md-sys-color-primary);outline-offset:2px}`;
  private l(en:string,zh:string){return localizedCopy(en,zh,this.language,true);}
  private reset(){this.step=0;this.sample=this.guide?.example||'';this.result='';}
  private close(){this.opened=false;this.reset();void this.updateComplete.then(()=>this.renderRoot.querySelector<HTMLElement>('#entry')?.focus());}
  private validation(){return this.guide?.validate?.(this.sample)||'';}
  render(){const g=this.guide;if(!g)return nothing;return html`<md-icon-button id="entry" aria-label=${this.l('Help and practice:','說明同練習：')+' '+g.title} title=${g.title} aria-expanded=${String(this.opened)} aria-controls="guide-panel" @click=${()=>{if(this.opened)this.close();else{this.reset();this.opened=true;}}}>${materialIcon('info')}</md-icon-button>${this.opened?html`<section id="guide-panel" role="region" aria-label=${g.title} @keydown=${(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();this.close();}}}><h4>${g.title}</h4><p>${g.purpose}</p><p>${this.l('Step','步驟')} ${this.step+1} / ${g.steps.length}</p><p>${g.steps[this.step]}</p><p>${this.l('Isolated example. No files, settings or active draft are changed.','獨立範例，唔會更改檔案、設定或使用中草稿。')}</p>${g.options?html`<md-outlined-select .label=${g.title} .value=${this.sample} @change=${(e:Event)=>{this.sample=(e.target as HTMLSelectElement).value;this.result='';}}>${g.options.map(option=>html`<md-select-option .value=${option}><div slot="headline">${option}</div></md-select-option>`)}</md-outlined-select>`:html`<md-outlined-text-field .label=${this.l('Practice value','練習值')} .value=${this.sample} @input=${(e:Event)=>{this.sample=(e.target as HTMLInputElement).value;this.result='';}}></md-outlined-text-field>`}<p>${this.l('Expected result:','預期結果：')} ${g.expected}</p><p role="status" aria-live="polite">${this.result}</p><div class="row"><md-text-button ?disabled=${this.step===0} @click=${()=>this.step--}>${this.l('Back','返回')}</md-text-button><md-text-button @click=${()=>{const error=this.validation();this.result=error||this.l('Practice value accepted. This is only a preview.','練習值已接受，只係預覽。');if(!error&&this.step<g.steps.length-1)this.step++;}}>${this.step<g.steps.length-1?this.l('Validate and next','驗證並繼續'):this.l('Try example','試用範例')}</md-text-button><md-text-button @click=${this.reset}>${this.l('Reset example','重設範例')}</md-text-button><md-text-button @click=${this.close}>${this.l('Cancel / close','取消／關閉')}</md-text-button></div></section>`:nothing}`;}
}
customElements.define('guided-forms',GuidedForms);

/** Bounded semantic draft history. Disk writes remain separately reviewed host operations. */
export class DraftHistory<T> {
  private previous:T[]=[];private next:T[]=[];private current:T;
  constructor(initial:T){this.current=structuredClone(initial);}
  record(value:T){if(JSON.stringify(value)===JSON.stringify(this.current))return;this.previous=[...this.previous.slice(-49),this.current];this.current=structuredClone(value);this.next=[];}
  get canUndo(){return this.previous.length>0;} get canRedo(){return this.next.length>0;}
  restore(redo=false):T|undefined{const source=redo?this.next:this.previous,target=redo?this.previous:this.next;const value=source.pop();if(value===undefined)return;target.push(this.current);this.current=structuredClone(value);return structuredClone(value);}
}
