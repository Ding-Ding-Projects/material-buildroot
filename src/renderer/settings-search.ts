import {localizedCopy} from './language-wording';
import {captureOwnedStatus, displayOwnedStatus} from './owned-status';
import {LitElement, html, css, nothing} from 'lit';
import {m3IconButton} from './design-system/m3-styles';
import './regex-workbench';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/switch/switch.js';
import type {MdSwitch} from '@material/web/switch/switch';
import '@material/web/button/text-button.js';
import '@material/web/iconbutton/icon-button.js';
/** An isolated local search and its adjacent complete expression workbench. */
export class SettingsSearch extends LitElement {
  static properties = {language:{type:String}, restricted:{type:Boolean}, label:{type:String}, entries:{attribute:false}, query:{state:true}, pattern:{state:true}, flags:{state:true}, regex:{state:true}, open:{state:true}, error:{state:true}, count:{state:true}};
  language='bilingual'; restricted=false; label=''; entries:{id:string;text:string}[]=[];
  query=''; pattern=''; flags='i'; regex=false; open=false; error=''; count=0;
  private worker?:Worker; private timer?:ReturnType<typeof setTimeout>; private generation=0;
  static styles=[m3IconButton,css`:host{display:block;grid-column:1/-1;min-width:0}.search{height:48px;border-radius:999px;background:var(--md-sys-color-surface-container-high);display:flex;align-items:center;gap:4px;padding:0 4px 0 16px;color:var(--md-sys-color-on-surface-variant);width:100%;min-width:0;cursor:text}.search input{flex:1;min-width:0;border:0;padding:0 8px;background:transparent;color:var(--md-sys-color-on-surface);font:inherit;font-size:16px;line-height:24px;letter-spacing:.5px;outline:none}.search input::placeholder{color:var(--md-sys-color-on-surface-variant)}.search:focus-within{outline:2px solid var(--md-sys-color-primary);outline-offset:-2px}.ib.on{color:var(--md-sys-color-primary)}.regex-mode{display:flex;align-items:center;gap:8px;margin:6px 8px 0;font-size:12px;line-height:16px;color:var(--md-sys-color-on-surface-variant)}.regex-mode[hidden]{display:none}.count{margin:4px 16px 0;font-size:12px;line-height:16px;color:var(--md-sys-color-on-surface-variant)}.count.quiet{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.bar{display:flex;align-items:center;gap:8px;position:relative}md-icon-button{flex:0 0 48px;--md-icon-button-state-layer-height:48px;--md-icon-button-state-layer-width:48px}.search-control{position:relative;min-width:0}md-outlined-text-field{flex:1;min-width:0}.builder{position:relative;margin-top:8px;padding:16px;border:1px solid var(--md-sys-color-outline);border-radius:16px;background:var(--md-sys-color-surface-container);display:grid;gap:12px;max-height:65vh;overflow:auto}label{display:flex;align-items:center;gap:12px;min-height:44px;font-size:13px}p{font-size:12px;margin:4px 0;color:var(--md-sys-color-on-surface-variant)}:focus-visible{outline:3px solid var(--md-sys-color-primary);outline-offset:2px}regex-workbench{display:block;min-width:0}`];
  reset(){this.query='';this.pattern='';this.flags='i';this.regex=false;this.error='';this.search();}
  focusQuery(){(this.renderRoot.querySelector('.search input') as HTMLElement|null)?.focus();}
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
  render(){const label=this.label||this.l('Search settings','搜尋設定',true);return html`<div class="bar"><label class="search sm"><span class="ms" aria-hidden="true">search</span><input aria-label=${label} placeholder=${label} maxlength="2000" .value=${this.regex?this.pattern:this.query} @input=${(e:Event)=>{const value=(e.target as HTMLInputElement).value;this.query=value;this.pattern=value;}}><button class="ib sl ${this.regex||this.open?'on':''}" aria-label=${this.l('Open full regex workbench','開啟完整正規表達式工作台',true)} title=${this.l('Regular expression builder','正規表達式建立器',true)} aria-expanded=${this.open} aria-controls="expression-builder" @click=${(event:Event)=>{event.preventDefault();this.open=!this.open;}}><span class="ms s20" aria-hidden="true">regular_expression</span></button></label></div><label class="regex-mode"><md-switch icons aria-label=${this.l('Use regular expression','使用正規表達式',true)} .selected=${this.regex} @change=${(e:Event)=>{this.regex=(e.target as MdSwitch).selected;this.pattern=this.query;}}></md-switch>${this.l('Use regular expression','使用正規表達式',true)}</label><div id="expression-builder" class="builder" role="region" aria-label=${this.l("Regex workbench for this search","此搜尋嘅正規表達式工作台",true)} ?hidden=${!this.open} style=${this.open?'':'display:none'} @keydown=${(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();this.open=false;this.focusQuery();}}}><regex-workbench .language=${this.language} .pattern=${this.pattern} .flags=${this.flags} @pattern-change=${(e:CustomEvent)=>{e.stopPropagation();this.pattern=e.detail.pattern;this.query=this.pattern;this.flags=e.detail.flags;}}></regex-workbench><md-text-button @click=${()=>{this.regex=true;this.search();}}>${this.l('Use this expression','使用呢個表達式',true)}</md-text-button><md-text-button @click=${()=>{this.open=false;this.focusQuery();}}>${this.l('Close workbench','關閉工作台',true)}</md-text-button></div><p role="status" class="count ${this.query||this.error?'':'quiet'}">${this.count} ${this.l('matches','個符合項目',true)} ${this.error?displayOwnedStatus(this,'error',this.error,this.language):nothing}</p>`;}
}
customElements.define('settings-search',SettingsSearch);
