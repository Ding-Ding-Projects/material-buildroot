import {localizedCopy} from './language-wording';
import {captureOwnedStatus, displayOwnedStatus} from './owned-status';
import {LitElement, html, css, nothing} from 'lit';
import {materialIcon} from './material-icons';
import './regex-workbench';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/button/text-button.js';
/** An isolated local search and its adjacent complete expression workbench. */
export class SettingsSearch extends LitElement {
  static properties = {language:{type:String}, restricted:{type:Boolean}, label:{type:String}, entries:{attribute:false}, query:{state:true}, pattern:{state:true}, flags:{state:true}, regex:{state:true}, open:{state:true}, error:{state:true}, count:{state:true}};
  language='bilingual'; restricted=false; label=''; entries:{id:string;text:string}[]=[];
  query=''; pattern=''; flags='i'; regex=false; open=false; error=''; count=0;
  private worker?:Worker; private timer?:ReturnType<typeof setTimeout>; private generation=0;
  static styles=css`:host{display:block;grid-column:1/-1;min-width:0}.bar{display:flex;align-items:center;gap:8px;position:relative}md-outlined-text-field{flex:1;min-width:0}.builder{padding:12px;border:1px solid var(--md-sys-color-outline);border-radius:16px;background:var(--md-sys-color-surface-container);display:grid;gap:12px;max-height:65vh;overflow:auto}label{display:flex;align-items:center}p{font-size:12px}regex-workbench{display:block;min-width:0}`;
  reset(){this.query='';this.pattern='';this.flags='i';this.regex=false;this.error='';this.search();}
  focusQuery(){(this.renderRoot.querySelector('md-outlined-text-field') as HTMLElement|null)?.focus();}
  private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
  disconnectedCallback(){this.lastIds=null;this.generation++;this.worker?.terminate();clearTimeout(this.timer);super.disconnectedCallback();}
  protected updated(changed:Map<string,unknown>){if(['query','pattern','flags','regex','entries'].some(key=>changed.has(key)))this.search();}
  private lastIds:string[]|null=null;
  private emit(ids:string[]){this.count=ids.length;if(this.lastIds?.length===ids.length&&ids.every((id,index)=>this.lastIds![index]===id))return;this.lastIds=[...ids];this.dispatchEvent(new CustomEvent('settings-filter',{bubbles:true,composed:true,detail:ids}));}
  private search(){
    const generation=++this.generation;this.worker?.terminate();clearTimeout(this.timer);this.error='';
    if(!this.regex){this.emit(this.entries.filter(e=>e.text.toLocaleLowerCase().includes(this.query.toLocaleLowerCase())).map(e=>e.id));return;}
    let settled=false;
    const fail=()=>{if(generation!==this.generation||settled)return;settled=true;this.worker?.terminate();clearTimeout(this.timer);this.error=captureOwnedStatus(this,'error',this.l.bind(this),l=>l('Expression invalid, unavailable or timed out. Change it or use literal search.','表達式無效、未能使用或逾時。請更改或使用文字搜尋。'));this.emit([]);};
    try {
      const worker=this.worker=new Worker(new URL('./documentation-search-worker.ts',import.meta.url),{type:'module'});
      this.timer=setTimeout(fail,600);worker.onerror=fail;
      // Keep the worker's per-message bound and one deadline for the whole query.
      // Matches are published only after every chunk succeeds for this generation.
      const entries=this.entries,pattern=this.pattern,flags=this.flags,ids:string[]=[];let offset=0;
      const send=()=>{try{worker.postMessage({pattern,flags,articles:entries.slice(offset,offset+1000)});}catch{fail();}};
      worker.onmessage=e=>{
        if(generation!==this.generation||settled)return;
        if(!e.data.ok||!Array.isArray(e.data.ids)){fail();return;}
        ids.push(...e.data.ids);offset+=1000;
        if(offset<entries.length){send();return;}
        settled=true;clearTimeout(this.timer);worker.terminate();this.emit(ids);
      };
      send();
    } catch { fail(); }
  }
  render(){return html`<div class="bar"><md-outlined-text-field .label=${this.label||this.l('Search settings','搜尋設定',true)} .value=${this.regex?this.pattern:this.query} maxlength="2000" @input=${(e:Event)=>{const value=(e.target as HTMLInputElement).value;this.query=value;this.pattern=value;}}></md-outlined-text-field><md-icon-button aria-label=${this.l('Open full regex workbench','開啟完整正規表達式工作台',true)} aria-expanded=${this.open} @click=${()=>this.open=!this.open}>${materialIcon('code')}</md-icon-button></div><label><md-checkbox aria-label=${this.l('Use regular expression','使用正規表達式',true)} ?checked=${this.regex} @change=${(e:Event)=>{this.regex=(e.target as HTMLInputElement).checked;this.pattern=this.query;}}></md-checkbox>${this.l('Use regular expression','使用正規表達式',true)}</label><div class="builder" ?hidden=${!this.open} style=${this.open?'':'display:none'} @keydown=${(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();this.open=false;this.focusQuery();}}}><regex-workbench .language=${this.language} .pattern=${this.pattern} .flags=${this.flags} @pattern-change=${(e:CustomEvent)=>{e.stopPropagation();this.pattern=e.detail.pattern;this.query=this.pattern;this.flags=e.detail.flags;}}></regex-workbench><md-text-button @click=${()=>{this.regex=true;this.search();}}>${this.l('Use this expression','使用呢個表達式',true)}</md-text-button><md-text-button @click=${()=>{this.open=false;this.focusQuery();}}>${this.l('Close workbench','關閉工作台',true)}</md-text-button></div><p role="status">${this.count} ${this.l('matches','個符合項目',true)} ${this.error?displayOwnedStatus(this,'error',this.error,this.language):nothing}</p>`;}
}
customElements.define('settings-search',SettingsSearch);
