import {localizedCopy} from './language-wording';
import {LitElement, html, css, nothing} from 'lit';
import {SettingsSearch} from './settings-search';
import {materialIcon} from './material-icons';
import '@material/web/dialog/dialog.js';
import '@material/web/button/outlined-button.js';
import '@material/web/switch/switch.js';

/** Trusted renderer providers own persistent target identity and their editor validation. */
export type ContextActionContext = {target:HTMLElement;language:string};
export type ContextProviderAction = {id:string;label:string;context?:string;disabled?:boolean;run:()=>void|Promise<void>};
export type ContextActionProvider = (context:ContextActionContext)=>readonly ContextProviderAction[];
const contextProviders=new Map<string,ContextActionProvider>();
const accessProviders=new Map<string,(target:HTMLElement)=>boolean>();
const providerIdPattern=/^[a-z][a-z0-9.-]{0,63}$/;
export function registerContextActionProvider(providerId:string,provider:ContextActionProvider):()=>void {
  if(!providerIdPattern.test(providerId)||typeof provider!=='function'||contextProviders.has(providerId)||contextProviders.size>=16)throw new Error('INVALID_CONTEXT_PROVIDER');
  contextProviders.set(providerId,provider);
  return ()=>{if(contextProviders.get(providerId)===provider)contextProviders.delete(providerId);};
}
/** False or an unavailable policy blocks original consumers, never management actions. */
export function registerCommandAccessProvider(providerId:string,provider:(target:HTMLElement)=>boolean):()=>void {
  if(!providerIdPattern.test(providerId)||typeof provider!=='function'||accessProviders.has(providerId)||accessProviders.size>=16)throw new Error('INVALID_COMMAND_ACCESS_PROVIDER');
  accessProviders.set(providerId,provider);
  return ()=>{if(accessProviders.get(providerId)===provider)accessProviders.delete(providerId);};
}
export type CommandProviderAction = ContextProviderAction & {target?:HTMLElement};
export type CommandActionEntry = CommandProviderAction & {providerId:string};
export type CommandActionProvider = (context:{language:string})=>readonly CommandProviderAction[];
const commandProviders=new Map<string,CommandActionProvider>();
const commandIdValid=(id:unknown):id is string=>typeof id==='string'&&id.trim().length>0&&id.length<=256&&!/[\u0000-\u001f\u007f]/.test(id);
function commandContributions(provider:CommandActionProvider,language:string):CommandProviderAction[]{
  try{
    const values=provider({language});if(!Array.isArray(values)||values.length>256)return [];
    const seen=new Set<string>();const accepted:CommandProviderAction[]=[];
    for(const value of values){
      if(!value||!commandIdValid(value.id)||seen.has(value.id)||typeof value.label!=='string'||!value.label.trim()||value.label.length>240||typeof value.run!=='function'||value.context!==undefined&&(typeof value.context!=='string'||value.context.length>500)||value.target!==undefined&&!(value.target instanceof HTMLElement))continue;
      seen.add(value.id);accepted.push(value);
    }
    return accepted;
  }catch{return [];}
}
/** Providers expose real navigation/editor consumers, not renderer command strings. */
export function registerCommandActionProvider(providerId:string,provider:CommandActionProvider):()=>void {
  if(!providerIdPattern.test(providerId)||typeof provider!=='function'||commandProviders.has(providerId)||commandProviders.size>=16)throw new Error('INVALID_COMMAND_ACTION_PROVIDER');
  commandProviders.set(providerId,provider);window.dispatchEvent(new Event('command-action-providers-changed'));
  return ()=>{if(commandProviders.get(providerId)===provider){commandProviders.delete(providerId);window.dispatchEvent(new Event('command-action-providers-changed'));}};
}
/** Stable, duplicate-free inventory shared by the command card and destination catalogs. */
export function getCommandActionEntries(language:string):readonly CommandActionEntry[]{
  const entries:CommandActionEntry[]=[];
  for(const [providerId,provider] of commandProviders){
    for(const action of commandContributions(provider,language)){
      if(entries.length>=512)return entries;
      const id=providerId+':'+action.id;
      entries.push({...action,id,providerId,disabled:action.disabled===true||!!action.target&&(!action.target.isConnected||disabled(action.target)),run:async()=>{
        if(commandProviders.get(providerId)!==provider)return;
        // Resolve the current action again: removed targets and changed restrictions stay current.
        const current=commandContributions(provider,language).find(item=>item.id===action.id);
        if(!current||current.disabled===true||current.target&&(!current.target.isConnected||disabled(current.target)))return;
        await current.run();
      }});
    }
  }
  return entries;
}

function commandAccessBlocked(target:HTMLElement):boolean {
  for(const provider of accessProviders.values()){try{if(provider(target)!==true)return true;}catch{return true;}}
  return false;
}

type Control = HTMLElement & {label?:string; value?:string; checked?:boolean; selected?:boolean; disabled?:boolean; type?:string; min?:string; max?:string; step?:string; language?:string; updateComplete?:Promise<unknown>};
type Action = {id:string; label:string; context:string; target?:Control; shortcut?:string; run:()=>void|Promise<void>; kind?:'field'|'toggle'|'picker'; disabled?:boolean};
const selector='md-text-button,md-filled-button,md-outlined-button,md-filled-tonal-button,md-icon-button,md-primary-tab,md-secondary-tab,md-outlined-text-field,md-filled-text-field,md-checkbox,md-switch,md-slider,md-outlined-select,md-filled-select,button,a[href],input,textarea,select';
const pickerSelector='md-outlined-select,md-filled-select,select';
const fieldSelector='md-outlined-text-field,md-filled-text-field,input,textarea,md-slider';
const toggleSelector='md-checkbox,md-switch,input[type=checkbox]';
/** Labels and bindings share this registry; only implemented bindings appear. */
const bindings=[{id:'palette',shortcut:'Ctrl+Shift+F',matches:(e:KeyboardEvent)=>e.ctrlKey&&e.shiftKey&&!e.altKey&&!e.metaKey&&e.key.toLowerCase()==='f'}, {id:'context',shortcut:'Shift+F10',matches:(e:KeyboardEvent)=>!e.ctrlKey&&!e.altKey&&!e.metaKey&&e.shiftKey&&e.key==='F10'}];
const parent=(el:Element):Element|null=>el.parentElement||(el.getRootNode() instanceof ShadowRoot?(el.getRootNode() as ShadowRoot).host:null);
function ancestors(el:Element):Element[]{const result:Element[]=[];for(let p:Element|null=el;p;p=parent(p))result.push(p);return result;}
function disabled(el:Control){return !!el.disabled||commandAccessBlocked(el)||ancestors(el).some(p=>p.hasAttribute('inert')||p.getAttribute('aria-disabled')==='true'||p.getAttribute('data-locked')==='true'||p.hasAttribute('locked'));}
function label(el:Control){return (el.label||el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,240);}
function controls(root:ParentNode):Control[]{
  const found:Control[]=[];
  for(const el of root.querySelectorAll<Control>('*')){
    if(el.closest('command-surfaces,searchable-picker,regex-workbench,settings-search'))continue;
    if(el.matches(selector))found.push(el);
    // Material controls own their internal anatomy. Index the public control once.
    if(el.shadowRoot&&!el.localName.startsWith('md-')&&!['command-surfaces','searchable-picker','regex-workbench','settings-search'].includes(el.localName))found.push(...controls(el.shadowRoot));
  }
  return found;
}
function activeElement():Control|null {let el=document.activeElement as Control|null;while(el?.shadowRoot?.activeElement)el=el.shadowRoot.activeElement as Control;return el;}
/** Shared palette, element menus and picker consumer. No command strings cross IPC. */
class CommandSurfaces extends LitElement {
  static properties={mode:{state:true},actions:{state:true},matched:{state:true},language:{state:true},wide:{state:true},targetName:{state:true},notice:{state:true}};
  mode:'palette'|'context'|'picker'='palette';actions:Action[]=[];matched:string[]=[];language='bilingual';wide=false;targetName='';notice='';
  private pickers=new WeakMap<Control,SearchablePicker>();private searches=new WeakMap<Control,Map<string,SettingsSearch>>();private searchControl?:SettingsSearch;private origin?:Control;private contextTarget?:Control;private searchEntries:{id:string;text:string}[]=[];private rowIndex=0;
  static styles=css`:host{font:inherit;color:var(--md-sys-color-on-surface)}md-dialog{--md-dialog-container-color:var(--md-sys-color-surface-container-high,#fff);max-width:calc(100vw - 24px);width:720px;max-height:calc(100dvh - 24px)}md-dialog.wide{width:calc(100vw - 24px);height:calc(100dvh - 24px)}[slot=content]{display:grid;gap:12px;min-width:0}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant)}.row>div{display:grid;gap:8px;min-width:0}.row small{overflow-wrap:anywhere}.row md-outlined-text-field{width:100%;min-width:0}md-text-button{min-height:48px;white-space:normal}kbd{font:inherit;white-space:nowrap}.preview{padding:8px;border-radius:12px;background:var(--md-sys-color-surface-container);overflow-wrap:anywhere}settings-search{display:block}p{overflow-wrap:anywhere}`;
  private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
  private get app(){return document.querySelector('material-buildroot') as Control|null;}
  private currentLanguage(){const app=this.app as any;return app?.effectiveLanguage||app?.state?.language||'bilingual';}
  private dialog(){return this.renderRoot.querySelector('md-dialog') as HTMLElement&{show:()=>Promise<void>;close:()=>Promise<void>;open:boolean};}
  private makeActions():Action[]{
    const root=this.app?.shadowRoot;if(!root)return [];
    return controls(root).filter(el=>{
      const chain=ancestors(el);
      if(chain.some(p=>p.localName==='command-surfaces'))return false;
      const dialog=chain.find(p=>p.localName==='md-dialog');
      if(dialog&&!dialog.hasAttribute('open')&&dialog.id!=='actions-dialog')return false;
      if(el.type==='password'||el.getAttribute('type')==='file'||el.hasAttribute('hidden'))return false;
      return !!label(el);
    }).map((el,index)=>({id:`control-${index}`,label:label(el),context:ancestors(el).filter(p=>p.localName.endsWith('-panel')||p.id).map(p=>p.id||p.localName).reverse().join(' / '),target:el,disabled:disabled(el),kind:el.matches(pickerSelector)?'picker':el.matches(toggleSelector)?'toggle':el.matches(fieldSelector)?'field':undefined,run:()=>this.activate(el)}));
  }
  private registeredActions():Action[]{
    return getCommandActionEntries(this.currentLanguage()).map(entry=>({id:'registered-'+entry.id,label:entry.label,context:entry.context||'',target:entry.target,disabled:entry.disabled,run:async()=>{
      await this.dialog().close();
      try{await entry.run();}catch{this.notice=this.l('The selected command could not be completed. Inspect its original surface before retrying.','未能完成所選指令，重試之前請檢視原有介面。',true);if(!this.dialog().open)await this.dialog().show();}
    }}));
  }
  private paletteInventory(actions:Action[]){
    const unique=new Map<string,Action>();for(const action of actions)if(!unique.has(action.id))unique.set(action.id,action);
    this.actions=Array.from(unique.values()).slice(0,1000);
    this.searchEntries=this.actions.map(a=>({id:a.id,text:a.label+' '+a.context}));
    if(this.searchControl)this.searchControl.entries=this.searchEntries;
    if(unique.size>1000)this.notice=this.l('Showing the first 1,000 commands. Open a narrower destination to find its controls.','顯示首 1,000 項指令，請開啟較細範圍目的地尋找控制項。',true);
  }
  private settingActions():Action[]{
    const app=this.app as any;
    const definitions:[string,string,string,string,string?][]=[
      ['theme','Theme','主題','.settings-grid md-outlined-select'],
      ['schedules','Scheduled preferences','偏好排程','scheduled-preferences-panel','#schedule-heading'],
      ['schedule-history','Schedule history','排程歷史','scheduled-preferences-panel','#schedule-history'],
      ['source-enrollment','External settings source enrollment','外部設定來源登記','scheduled-preferences-panel','#source-enrollment-heading'],
      ['shared','Shared preference','共用偏好','shared-mode-panel','#shared-heading'],
      ...(!app?.restricted?[['language','Interface language','介面語言','#language-select'],['vocabulary-status','Personal vocabulary status','個人詞彙狀態','personal-vocabulary-panel','#status'],['vocabulary-upload','Import or replace personal vocabulary','匯入或取代個人詞彙','personal-vocabulary-panel','#upload'],['vocabulary-clear','Clear personal vocabulary','清除個人詞彙','personal-vocabulary-panel','#clear']] as [string,string,string,string,string?][]:[])
    ];
    return definitions.map(([id,en,zh,selector,inner])=>({id:'setting-'+id,label:this.l(en,zh),context:this.l('Settings','設定',true),run:async()=>{
      await this.dialog().close();await app.navigate('settings');await app.updateComplete;if(app.route!=='settings')return;
      (app.shadowRoot.querySelector('settings-search') as SettingsSearch|null)?.reset();await app.updateComplete;
      let control:Control|null=id==='theme'?Array.from(app.shadowRoot.querySelectorAll('.settings-grid md-outlined-select') as NodeListOf<Control>).find(el=>el.id!=='language-select')||null:app.shadowRoot.querySelector(selector);
      if(inner&&control){await control.updateComplete;control=control.shadowRoot?.querySelector(inner)||null;}
      if(control){for(const element of ancestors(control))if(element instanceof HTMLDetailsElement)element.open=true;await this.reveal(control);}
    }}));
  }
  private async articleActions():Promise<Action[]>{
    const app=this.app as any;if(app?.restricted||!window.studio?.operations)return [];
    try{
      const response=await window.studio.operations({action:'documentation.list'});if(!response.ok||app.restricted)return [];
      const articles=(response.result as {articles?:{id:string;title:string;category:string}[]})?.articles;
      if(!Array.isArray(articles))return [];
      return articles.filter(a=>typeof a.id==='string'&&typeof a.title==='string').map(a=>({id:'article-'+a.id,label:a.title,context:this.l('Documentation','文件',true)+' / '+String(a.category||''),run:async()=>{
        await this.dialog().close();await app.navigate('operations');await app.updateComplete;if(app.route!=='operations'||app.restricted)return;
        const operations=app.shadowRoot.querySelector('operations-panel') as any;if(!operations)return;operations.tab='documentation';await operations.updateComplete;
        const panel=operations.shadowRoot?.querySelector('documentation-panel') as any;if(!panel||panel.restricted)return;await panel.open(a.id);await panel.updateComplete;
        const heading=panel.shadowRoot?.querySelector('article h1,article h2,h1,h2') as HTMLElement|null;if(heading){heading.tabIndex=-1;heading.scrollIntoView({block:'nearest'});heading.focus();}
      }}));
    }catch{return [];}
  }
  private async reveal(el:Control){
    const chain=ancestors(el);
    // Navigate using the original destination consumers, preserving unsaved-work prompts.
    const app=this.app as any;
    const inOperations=chain.some(p=>p.localName==='operations-panel');
    if(inOperations&&app?.route!=='operations'){await app.navigate('operations');await app.updateComplete;if(app.route!=='operations')return false;}
    const operations=chain.find(p=>p.localName==='operations-panel') as any;
    if(operations){
      const map:Record<string,string>={'source-panel':'source','package-panel':'package','guest-panel':'guests','tools-panel':'tools','documentation-panel':'documentation','companion-panel':'companion','regex-workbench':'regex'};
      const panel=chain.find(p=>map[p.localName]);if(panel){operations.tab=map[panel.localName];await operations.updateComplete;}
    }
    for(const element of chain)if(element instanceof HTMLDetailsElement)element.open=true;
    if(!el.isConnected)return false;
    // Hidden or locked surfaces must never be revealed by removing their restrictions.
    if(ancestors(el).some(p=>p.hasAttribute('hidden')||p.hasAttribute('inert')))return false;
    el.scrollIntoView({block:'nearest'});el.focus();
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{outline:'3px solid var(--md-sys-color-primary)'},{outline:'3px solid transparent'}],{duration:900});
    return true;
  }
  private async activate(el:Control){
    if(!el.isConnected||disabled(el))return;
    await this.dialog().close();
    const dialog=ancestors(el).find(p=>p.id==='actions-dialog');
    if(dialog){await (dialog as HTMLElement & {show:()=>Promise<void>}).show();el.click();return;}
    if(!await this.reveal(el))return;
    if(el.matches(pickerSelector)){await this.openPicker(el);return;}
    if(!el.matches(fieldSelector+','+toggleSelector))el.click();
  }
  private async present(actions:Action[],mode:'palette'|'context'|'picker',origin?:Control){
    this.origin=origin||activeElement()||undefined;this.language=this.currentLanguage();this.mode=mode;this.actions=actions;this.rowIndex=0;this.notice='';
    this.searchEntries=actions.map(a=>({id:a.id,text:`${a.label} ${a.context}`}));this.matched=actions.map(a=>a.id);
    try{this.wide=localStorage.getItem('command-palette-size')==='wide';}catch{this.wide=false;}
    const key=(mode==='palette'?this.app:origin)||this.app;
    if(key){let byMode=this.searches.get(key);if(!byMode){byMode=new Map();this.searches.set(key,byMode);}let control=byMode.get(mode);
      if(!control){control=document.createElement('settings-search') as SettingsSearch;control.addEventListener('settings-filter',(event:Event)=>{if(this.searchControl!==control)return;this.matched=(event as CustomEvent<string[]>).detail;this.rowIndex=0;});byMode.set(mode,control);}
      control.language=this.language;control.label=this.l('Filter these actions','篩選呢啲操作',true);control.entries=this.searchEntries;this.searchControl=control;
    }
    this.requestUpdate();await this.updateComplete;const search=this.searchControl;
    if(!this.dialog().open)await this.dialog().show();await search?.updateComplete;search?.focusQuery();
  }
  async openPalette(origin?:Control){
    this.language=this.currentLanguage();
    const modal=this.app?.shadowRoot?.querySelector('md-dialog[open]');
    if(modal&&modal.id!=='actions-dialog')return;
    const actions=[...this.registeredActions(),...this.settingActions(),...this.makeActions()];this.targetName=this.l('Commands and workspace controls','指令同工作區控制項',true);await this.present(actions.slice(0,1000),'palette',origin);this.paletteInventory(actions);const articles=await this.articleActions();if(this.mode==='palette'&&this.dialog().open&&articles.length){this.paletteInventory([...actions,...articles]);}
  }
  async openContext(target:Control){
    this.language=this.currentLanguage();
    this.contextTarget=target;this.targetName=label(target)||target.localName;
    const actionTarget=ancestors(target).find(p=>p.matches(selector)) as Control|undefined;
    const actions:Action[]=[{id:'focus',label:this.l('Go to this element','前往呢個元素',true),context:this.targetName,target,run:async()=>{await this.dialog().close();await this.reveal(target);}}];
    if(actionTarget)actions.push({id:'activate',label:this.l('Open or activate','開啟或啟用',true),context:label(actionTarget),target:actionTarget,disabled:disabled(actionTarget),kind:actionTarget.matches(pickerSelector)?'picker':actionTarget.matches(toggleSelector)?'toggle':actionTarget.matches(fieldSelector)?'field':undefined,run:()=>this.activate(actionTarget)});
    let providerUnavailable=false;
    for(const [providerId,provider] of contextProviders){
      try{
        const contributed=provider({target,language:this.currentLanguage()});
        if(!Array.isArray(contributed)||contributed.length>32){providerUnavailable=true;continue;}
        const ids=new Set<string>();
        for(const action of contributed){
          if(!action||!providerIdPattern.test(action.id)||ids.has(action.id)||typeof action.label!=='string'||!action.label.trim()||action.label.length>240||typeof action.run!=='function'||action.context!==undefined&&(typeof action.context!=='string'||action.context.length>500)){providerUnavailable=true;continue;}
          ids.add(action.id);
          // No original target field: managing a restriction is not activation of that control.
          actions.push({id:'provider-'+providerId+'-'+action.id,label:action.label,context:action.context||'',disabled:action.disabled===true,run:async()=>{
            if(!target.isConnected)return;
            await this.dialog().close();
            try{await action.run();}catch{this.notice=this.l('The selected editor could not be opened. No original action was executed.','未能開啟所選編輯器，冇執行原有操作。',true);if(!this.dialog().open)await this.dialog().show();}
          }});
        }
      }catch{providerUnavailable=true;}
    }
    actions.push({id:'palette',label:this.l('Find commands','尋找指令',true),context:'',shortcut:bindings[0].shortcut,run:()=>this.openPalette(target)});
    await this.present(actions,'context',target);if(providerUnavailable)this.notice=this.l('Some element actions are unavailable. Existing actions remain available.','部分元素操作未能使用，現有操作仍可使用。',true);
  }
  async openPicker(target:Control){
    if(disabled(target))return;
    let picker=this.pickers.get(target);
    if(!picker){picker=document.createElement('searchable-picker') as SearchablePicker;this.parentElement?.append(picker);this.pickers.set(target,picker);}
    await picker.openFor(target,this.currentLanguage());
  }
  private async run(action:Action){if(action.disabled||action.target&&disabled(action.target))return;await action.run();}
  private write(action:Action,value:string|boolean){
    const el=action.target;if(!el?.isConnected||disabled(el)||el.hasAttribute('readonly')||(el as Control & {readOnly?:boolean}).readOnly)return;
    if(typeof value==='boolean'){if(el.localName==='md-switch')el.selected=value;else el.checked=value;}else el.value=value;
    el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));el.dispatchEvent(new Event('change',{bubbles:true,composed:true}));this.requestUpdate();
  }
  private keys(e:KeyboardEvent){
    const search=this.renderRoot.querySelector('settings-search') as SettingsSearch;
    if(e.key==='Escape'&&(search?.query||search?.pattern)){e.preventDefault();e.stopPropagation();search.reset();return;}
    const rows=Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[data-action]')).filter(el=>!(el as Control).disabled);
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&!e.composedPath().some(p=>p instanceof Element&&p.matches('regex-workbench,md-outlined-text-field,md-checkbox,md-switch,md-slider'))){
      e.preventDefault();this.rowIndex=e.key==='Home'?0:e.key==='End'?rows.length-1:(this.rowIndex+(e.key==='ArrowDown'?1:-1)+rows.length)%Math.max(rows.length,1);rows[this.rowIndex]?.focus();
    }
  }
  render(){const visible=this.actions.filter(a=>this.matched.includes(a.id));return html`<md-dialog class=${this.wide?'wide':''} @keydown=${this.keys} @closed=${()=>{if(this.origin?.isConnected)this.origin.focus();}}><div slot="headline">${this.targetName}</div><div slot="content">${this.searchControl}${this.mode==='palette'?html`<p class="preview">${this.l('Results use the current controls. Opening a destination refreshes the available controls on your next search. Passwords and file inputs are excluded.','結果使用目前控制項。開啟目的地後，下次搜尋會更新可用控制項。密碼同檔案輸入唔會列出。',true)}</p>`:nothing}${visible.length?visible.map(action=>html`<div class="row"><div><md-text-button data-action=${action.id} ?disabled=${action.disabled} aria-keyshortcuts=${action.shortcut||nothing} @click=${()=>this.run(action)}>${materialIcon(action.kind?'tune':'arrow_forward','icon')}${action.label}</md-text-button><small>${action.context}</small>${action.kind==='toggle'?html`<label><md-switch ?selected=${!!(action.target?.localName==='md-switch'?action.target.selected:action.target?.checked)} aria-label=${action.label} ?disabled=${action.disabled} @change=${(e:Event)=>this.write(action,!!(e.target as Control).selected)}></md-switch>${this.l('Current value','目前值',true)}</label>`:action.kind==='field'?html`<md-outlined-text-field .label=${action.label} .value=${String(action.target?.value??'')} .type=${action.target?.type==='number'?'number':'text'} ?disabled=${action.disabled} @input=${(e:Event)=>this.write(action,(e.target as Control).value||'')}></md-outlined-text-field>`:nothing}</div>${action.shortcut?html`<kbd aria-hidden="true">${action.shortcut}</kbd>`:nothing}</div>`):html`<p role="status">${this.l('No matching actions. Clear or change the filter.','搵唔到符合操作，請清除或更改篩選。',true)}</p>`}${this.notice?html`<p role="status">${this.notice}</p>`:nothing}</div><div slot="actions">${this.mode==='palette'?html`<md-text-button @click=${()=>{this.wide=!this.wide;try{localStorage.setItem('command-palette-size',this.wide?'wide':'card');}catch{this.notice=this.l('Size applies for this session only.','大小只適用於本次工作階段。',true);}}}>${this.wide?this.l('Card view','卡片檢視',true):this.l('Full-window view','全視窗檢視',true)}</md-text-button>`:nothing}<md-text-button @click=${()=>this.dialog().close()}>${this.l('Close','關閉',true)}</md-text-button></div></md-dialog>`;}
}
customElements.define('command-surfaces',CommandSurfaces);

/** Each select owns a separate searchable dialog, including selects inside workbenches. */
class SearchablePicker extends LitElement {
  static properties={language:{state:true},options:{state:true},matched:{state:true},heading:{state:true}};
  language='bilingual';options:Control[]=[];matched:string[]=[];heading='';
  private target?:Control;private entries:{id:string;text:string}[]=[];
  static styles=css`md-dialog{width:640px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);--md-dialog-container-color:var(--md-sys-color-surface-container-high,#fff)}[slot=content]{display:grid;gap:8px;min-width:0}md-text-button{min-height:48px;white-space:normal}small{padding-inline-start:8px}`;
  private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language);}
  private dialog(){return this.renderRoot.querySelector('md-dialog') as HTMLElement&{show:()=>Promise<void>;close:()=>Promise<void>;open:boolean};}
  async openFor(target:Control,language:string){
    this.target=target;this.language=language;this.heading=label(target)||this.l('Choose an option','選擇選項',true);
    this.options=Array.from(target.querySelectorAll<Control>('md-select-option,option'));
    this.entries=this.options.map((o,i)=>({id:String(i),text:label(o)||String(o.value??'')}));
    this.matched=this.entries.map(e=>e.id);await this.updateComplete;
    if(!this.dialog().open)await this.dialog().show();
    const search=this.renderRoot.querySelector('settings-search') as SettingsSearch;await search?.updateComplete;search?.focusQuery();
  }
  private async choose(option:Control){
    const target=this.target;if(!target?.isConnected||disabled(target)||option.disabled)return;
    target.value=String(option.value??'');
    target.dispatchEvent(new Event('input',{bubbles:true,composed:true}));target.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
    await this.dialog().close();if(target.isConnected)target.focus();
  }
  private keys(e:KeyboardEvent){
    const search=this.renderRoot.querySelector('settings-search') as SettingsSearch;
    if(e.key==='Escape'&&(search.query||search.pattern)){e.preventDefault();e.stopPropagation();search.reset();return;}
    if(!['ArrowDown','ArrowUp'].includes(e.key)||e.composedPath().some(p=>p instanceof Element&&p.localName==='regex-workbench'))return;
    const items=Array.from(this.renderRoot.querySelectorAll<Control>('[data-option]')).filter(e=>!e.disabled);if(!items.length)return;
    const focused=e.composedPath().find(p=>p instanceof Element&&p.hasAttribute('data-option'));
    const current=items.indexOf(focused as Control);e.preventDefault();items[(current+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();
  }
  render(){return html`<md-dialog @keydown=${this.keys} @closed=${()=>{if(this.target?.isConnected)this.target.focus();}}><div slot="headline">${this.heading}</div><div slot="content"><settings-search .language=${this.language} .label=${this.l('Filter options','篩選選項',true)} .entries=${this.entries} @settings-filter=${(e:CustomEvent)=>this.matched=e.detail}></settings-search>${this.options.map((option,index)=>this.matched.includes(String(index))?html`<md-text-button data-option=${index} ?disabled=${!!option.disabled} @click=${()=>this.choose(option)}>${label(option)||String(option.value??'')}${option.value===this.target?.value?html`<small>${this.l('Selected','已選取',true)}</small>`:nothing}</md-text-button>`:nothing)}${!this.matched.length?html`<p role="status">${this.l('No matching options. Clear or change the filter.','搵唔到符合選項，請清除或更改篩選。',true)}</p>`:nothing}</div><div slot="actions"><md-text-button @click=${()=>this.dialog().close()}>${this.l('Close','關閉',true)}</md-text-button></div></md-dialog>`;}
}
customElements.define('searchable-picker',SearchablePicker);


customElements.whenDefined('material-buildroot').then(async()=>{
  const app=document.querySelector('material-buildroot') as Control|null;if(!app)return;await app.updateComplete;
  const surface=document.createElement('command-surfaces') as CommandSurfaces;
  const shell=app.shadowRoot?.querySelector('.shell');if(!shell)return;shell.append(surface);
  const target=(event:Event)=>(event.composedPath().find(p=>p instanceof HTMLElement&&p.matches(selector)&&p.localName.startsWith('md-'))||event.composedPath().find(p=>p instanceof HTMLElement&&!p.localName.startsWith('md-icon')&&!['svg','path'].includes(p.localName))) as Control|undefined;
  const inside=(event:Event)=>event.composedPath().includes(surface);
  document.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(bindings[0].matches(e)){e.preventDefault();e.stopImmediatePropagation();void surface.openPalette(target(e));return;}
    if(!inside(e)&&(bindings[1].matches(e)||e.key==='ContextMenu')){const el=target(e);if(el){e.preventDefault();e.stopImmediatePropagation();void surface.openContext(el);}return;}
    const select=e.composedPath().find(p=>p instanceof HTMLElement&&p.matches(pickerSelector)) as Control|undefined;
    if(select&&['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();void surface.openPicker(select);}
  },true);
  document.addEventListener('contextmenu',e=>{if(inside(e))return;const el=target(e);if(!el||!ancestors(el).includes(app))return;e.preventDefault();void surface.openContext(el);},true);
  document.addEventListener('click',e=>{
    const path=e.composedPath();const select=path.find(p=>p instanceof HTMLElement&&p.matches(pickerSelector)) as Control|undefined;
    if(select){e.preventDefault();e.stopImmediatePropagation();void surface.openPicker(select);return;}
    if(inside(e))return;
    const button=path.find(p=>p instanceof HTMLElement&&p.querySelector('.palette-label')) as Control|undefined;
    if(button&&button.localName==='md-text-button'){e.preventDefault();e.stopImmediatePropagation();void surface.openPalette(button);}
  },true);
  let touch:ReturnType<typeof setTimeout>|undefined;
  document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||inside(e))return;const el=target(e);if(el)touch=setTimeout(()=>void surface.openContext(el),650);},true);
  for(const name of ['pointerup','pointercancel','pointermove'])document.addEventListener(name,()=>clearTimeout(touch),true);
});
