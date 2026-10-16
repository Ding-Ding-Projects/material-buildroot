import {LitElement, html, css, nothing} from 'lit';
import {SettingsSearch} from './settings-search';
import {materialIcon} from './material-icons';
import '@material/web/dialog/dialog.js';
import '@material/web/button/outlined-button.js';
import '@material/web/switch/switch.js';

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
function disabled(el:Control){return !!el.disabled||ancestors(el).some(p=>p.hasAttribute('inert')||p.getAttribute('aria-disabled')==='true'||p.getAttribute('data-locked')==='true'||p.hasAttribute('locked'));}
function label(el:Control){return (el.label||el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,240);}
function controls(root:ParentNode):Control[]{
  const found:Control[]=[];
  for(const el of root.querySelectorAll<Control>('*')){
    if(el.closest('command-surfaces,regex-workbench,settings-search'))continue;
    if(el.matches(selector))found.push(el);
    // Material controls own their internal anatomy. Index the public control once.
    if(el.shadowRoot&&!el.localName.startsWith('md-')&&!['command-surfaces','regex-workbench','settings-search'].includes(el.localName))found.push(...controls(el.shadowRoot));
  }
  return found;
}
function activeElement():Control|null {let el=document.activeElement as Control|null;while(el?.shadowRoot?.activeElement)el=el.shadowRoot.activeElement as Control;return el;}
/** Shared palette, element menus and picker consumer. No command strings cross IPC. */
class CommandSurfaces extends LitElement {
  static properties={mode:{state:true},actions:{state:true},matched:{state:true},language:{state:true},wide:{state:true},targetName:{state:true},notice:{state:true}};
  mode:'palette'|'context'|'picker'='palette';actions:Action[]=[];matched:string[]=[];language='bilingual';wide=false;targetName='';notice='';
  private searches=new WeakMap<Control,Map<string,SettingsSearch>>();private searchControl?:SettingsSearch;private origin?:Control;private contextTarget?:Control;private searchEntries:{id:string;text:string}[]=[];private rowIndex=0;
  static styles=css`:host{font:inherit;color:var(--md-sys-color-on-surface)}md-dialog{--md-dialog-container-color:var(--md-sys-color-surface-container-high,#fff);max-width:calc(100vw - 24px);width:720px;max-height:calc(100dvh - 24px)}md-dialog.wide{width:calc(100vw - 24px);height:calc(100dvh - 24px)}[slot=content]{display:grid;gap:12px;min-width:0}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant)}.row>div{display:grid;gap:8px;min-width:0}.row small{overflow-wrap:anywhere}.row md-outlined-text-field{width:100%;min-width:0}md-text-button{min-height:48px;white-space:normal}kbd{font:inherit;white-space:nowrap}.preview{padding:8px;border-radius:12px;background:var(--md-sys-color-surface-container);overflow-wrap:anywhere}settings-search{display:block}p{overflow-wrap:anywhere}`;
  private l(en:string,zh:string){return this.language==='en'?en:this.language==='zh-HK'?zh:`${en} · ${zh}`;}
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
      control.language=this.language;control.label=this.l('Filter these actions','篩選呢啲操作');control.entries=this.searchEntries;this.searchControl=control;
    }
    this.requestUpdate();await this.updateComplete;const search=this.searchControl;
    if(!this.dialog().open)await this.dialog().show();await search?.updateComplete;search?.focusQuery();
  }
  async openPalette(origin?:Control){
    const modal=this.app?.shadowRoot?.querySelector('md-dialog[open]');
    if(modal&&modal.id!=='actions-dialog')return;
    const actions=this.makeActions();this.targetName=this.l('Commands and current workspace controls','指令同目前工作區控制項');await this.present(actions,'palette',origin);
  }
  async openContext(target:Control){
    this.contextTarget=target;this.targetName=label(target)||target.localName;
    const actionTarget=ancestors(target).find(p=>p.matches(selector)) as Control|undefined;
    const actions:Action[]=[{id:'focus',label:this.l('Go to this element','前往呢個元素'),context:this.targetName,target,run:async()=>{await this.dialog().close();await this.reveal(target);}}];
    if(actionTarget)actions.push({id:'activate',label:this.l('Open or activate','開啟或啟用'),context:label(actionTarget),target:actionTarget,disabled:disabled(actionTarget),kind:actionTarget.matches(pickerSelector)?'picker':actionTarget.matches(toggleSelector)?'toggle':actionTarget.matches(fieldSelector)?'field':undefined,run:()=>this.activate(actionTarget)});
    actions.push({id:'palette',label:this.l('Find commands','尋找指令'),context:'',shortcut:bindings[0].shortcut,run:()=>this.openPalette(target)});
    await this.present(actions,'context',target);
  }
  async openPicker(target:Control){
    if(disabled(target))return;
    const options=Array.from(target.querySelectorAll<Control>('md-select-option,option'));
    this.targetName=label(target)||this.l('Choose an option','選擇選項');
    const actions:Action[]=options.map((option,index)=>({id:`option-${index}`,label:label(option)||String(option.value??''),context:option.value===target.value?this.l('Selected','已選取'):'',disabled:!!option.disabled,run:async()=>{
      if(!target.isConnected||disabled(target)||option.disabled)return;
      target.value=String(option.value??'');target.dispatchEvent(new Event('input',{bubbles:true,composed:true}));target.dispatchEvent(new Event('change',{bubbles:true,composed:true}));await this.dialog().close();target.focus();
    }}));
    await this.present(actions,'picker',target);
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
  render(){const visible=this.actions.filter(a=>this.matched.includes(a.id));return html`<md-dialog class=${this.wide?'wide':''} @keydown=${this.keys} @closed=${()=>{if(this.origin?.isConnected)this.origin.focus();}}><div slot="headline">${this.targetName}</div><div slot="content">${this.searchControl}${this.mode==='palette'?html`<p class="preview">${this.l('Results use the current controls. Opening a destination refreshes the available controls on your next search. Passwords and file inputs are excluded.','結果使用目前控制項。開啟目的地後，下次搜尋會更新可用控制項。密碼同檔案輸入唔會列出。')}</p>`:nothing}${visible.length?visible.map(action=>html`<div class="row"><div><md-text-button data-action=${action.id} ?disabled=${action.disabled} aria-keyshortcuts=${action.shortcut||nothing} @click=${()=>this.run(action)}>${materialIcon(action.kind?'tune':'arrow_forward','icon')}${action.label}</md-text-button><small>${action.context}</small>${action.kind==='toggle'?html`<label><md-switch ?selected=${!!(action.target?.localName==='md-switch'?action.target.selected:action.target?.checked)} aria-label=${action.label} ?disabled=${action.disabled} @change=${(e:Event)=>this.write(action,!!(e.target as Control).selected)}></md-switch>${this.l('Current value','目前值')}</label>`:action.kind==='field'?html`<md-outlined-text-field .label=${action.label} .value=${String(action.target?.value??'')} .type=${action.target?.type==='number'?'number':'text'} ?disabled=${action.disabled} @input=${(e:Event)=>this.write(action,(e.target as Control).value||'')}></md-outlined-text-field>`:nothing}</div>${action.shortcut?html`<kbd aria-hidden="true">${action.shortcut}</kbd>`:nothing}</div>`):html`<p role="status">${this.l('No matching actions. Clear or change the filter.','搵唔到符合操作，請清除或更改篩選。')}</p>`}${this.notice?html`<p role="status">${this.notice}</p>`:nothing}</div><div slot="actions">${this.mode==='palette'?html`<md-text-button @click=${()=>{this.wide=!this.wide;try{localStorage.setItem('command-palette-size',this.wide?'wide':'card');}catch{this.notice=this.l('Size applies for this session only.','大小只適用於本次工作階段。');}}}>${this.wide?this.l('Card view','卡片檢視'):this.l('Full-window view','全視窗檢視')}</md-text-button>`:nothing}<md-text-button @click=${()=>this.dialog().close()}>${this.l('Close','關閉')}</md-text-button></div></md-dialog>`;}
}
customElements.define('command-surfaces',CommandSurfaces);

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
    if(select&&!inside(e)&&['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();void surface.openPicker(select);}
  },true);
  document.addEventListener('contextmenu',e=>{if(inside(e))return;const el=target(e);if(!el||!ancestors(el).includes(app))return;e.preventDefault();void surface.openContext(el);},true);
  document.addEventListener('click',e=>{
    if(inside(e))return;
    const path=e.composedPath();const select=path.find(p=>p instanceof HTMLElement&&p.matches(pickerSelector)) as Control|undefined;
    if(select){e.preventDefault();e.stopImmediatePropagation();void surface.openPicker(select);return;}
    const button=path.find(p=>p instanceof HTMLElement&&p.querySelector('.palette-label')) as Control|undefined;
    if(button&&button.localName==='md-text-button'){e.preventDefault();e.stopImmediatePropagation();void surface.openPalette(button);}
  },true);
  let touch:ReturnType<typeof setTimeout>|undefined;
  document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||inside(e))return;const el=target(e);if(el)touch=setTimeout(()=>void surface.openContext(el),650);},true);
  for(const name of ['pointerup','pointercancel','pointermove'])document.addEventListener(name,()=>clearTimeout(touch),true);
});
