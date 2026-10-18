import {localizedCopy} from './language-wording';
import {keyed} from 'lit/directives/keyed.js';
import {getCommandActionEntries,registerContextActionProvider} from './command-surfaces';
import {openAppearanceEditor} from './appearance-panel';
import {LitElement, html, css, nothing} from 'lit';
import {materialIcon} from './material-icons';
import './settings-search';
import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/button/text-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/dialog/dialog.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

export type WorkspaceDestination = {id:string; en:string; zh:string; icon:string};
type OpenTab = {id:string; destination:string; name:string; pinned:boolean; group:string; owner?:string};
type Group = {id:string; name:string; collapsed:boolean};
const storageKey='material-buildroot.workspace-tabs.v1';
/** Navigation metadata only. Execution authority and drafts remain in the owning workspace. */
export class WorkspaceTabs extends LitElement {
  static properties={language:{type:String}, destinations:{attribute:false}, tabs:{state:true}, active:{state:true}, edge:{state:true}, groups:{state:true}, dialog:{state:true}, catalogMatches:{state:true}, groupName:{state:true}, notice:{state:true}, closePreview:{state:true}, includePinned:{state:true}, masterRows:{state:true}, masterState:{state:true}, revealedTab:{state:true}};
  language='bilingual'; destinations:WorkspaceDestination[]=[]; tabs:OpenTab[]=[]; active=''; edge='left'; groups:Group[]=[];
  dialog:''|'catalog'|'manage'|'master'=''; catalogMatches:string[]|null=null; groupName=''; notice='';
  private masterRows:Array<{id:string;windowId:string;tabId:string;label:string;group:string;workspace:string;pinned:boolean}>=[];
  private masterState='';
  private revealedTab='';
  private masterGeneration=0;
  private publicationRequired=true;
  private publishing=false;
  private publicationVersion=0;
  private subscriptions:Array<()=>void>=[];
  private providersChanged=()=>this.requestUpdate();
  private opener?:HTMLElement;
  private dialogGeneration=0;
  private dialogTransition:Promise<void>=Promise.resolve();
  private dragged='';
  private closePreview:OpenTab[]=[];
  private includePinned=false;
  private groupMatches:string[]|null=null;
  private memberMatches=new Map<string,string[]>();
  static styles=css`
    :host{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden;color:inherit}
    .layout{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden}.layout.right{flex-direction:row-reverse}.layout.top{flex-direction:column}.layout.bottom{flex-direction:column-reverse}
    aside{display:flex;flex-direction:column;gap:4px;flex:0 0 220px;min-height:0;max-width:40%;padding:8px;background:var(--md-sys-color-surface-container);border:1px solid var(--md-sys-color-outline-variant)}
    .top aside,.bottom aside{flex:0 0 auto;max-width:none;max-height:40%;flex-direction:row;align-items:stretch}
    .strip{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:auto;gap:4px;flex:1}.top .strip,.bottom .strip{flex-direction:row}
    .pinned{flex:0 1 auto;max-height:40%;overflow:auto;border-bottom:1px solid var(--md-sys-color-outline)}.top .pinned,.bottom .pinned{max-width:40%;max-height:none;display:flex}
    .tab{display:flex;align-items:center;min-width:0}.tab md-text-button{width:100%;text-align:start}.tab[aria-selected=true]{background:var(--md-sys-color-secondary-container);border-radius:12px}.tab:focus-visible{outline:3px solid var(--md-sys-color-primary);outline-offset:-3px}
    .top .tab,.bottom .tab{flex:0 0 180px}.label{overflow-wrap:anywhere}.controls{display:flex;flex-wrap:wrap;gap:4px}.content{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden}::slotted(main){flex:1;min-width:0;min-height:0}
    md-dialog{width:min(900px,96vw);max-width:min(900px,96vw);max-height:90vh}.results{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:8px;min-width:0}.results>*{min-width:0;max-width:100%}.results>md-outlined-button{height:auto;min-height:40px;white-space:normal;overflow-wrap:anywhere}.result{border:1px solid var(--md-sys-color-outline-variant);padding:8px;border-radius:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}.result strong{flex:1;overflow-wrap:anywhere;min-width:100px}md-outlined-select{min-width:120px}md-outlined-text-field{max-width:100%}.group{font-weight:600}.status{font-size:12px;overflow-wrap:anywhere}
    @media(max-width:700px){aside{flex-basis:64px;max-width:25%;padding:2px}aside .label,aside .group-name{display:none}.top aside,.bottom aside{max-width:none}aside .controls{flex-direction:column}.top .tab,.bottom .tab{flex-basis:64px}}
  `;
  connectedCallback(){super.connectedCallback();
    window.addEventListener('command-action-providers-changed',this.providersChanged);
    this.subscriptions.push(registerContextActionProvider('workspace-tabs',({target})=>{
      if(target.getRootNode()!==this.renderRoot)return [];
      const tabTarget=target.closest<HTMLElement>('[data-tab-id]'),groupTarget=target.closest<HTMLElement>('[data-group-id]');
      const tab=this.tabs.find(t=>t.id===tabTarget?.dataset.tabId);
      if(tab&&tabTarget)return [
        {id:'appearance',label:this.l('Edit tab appearance…','編輯分頁外觀…',true),run:()=>openAppearanceEditor(tabTarget,this.language)},
        {id:'pin',label:tab.pinned?this.l('Unpin tab','取消固定分頁',true):this.l('Pin tab','固定分頁',true),run:()=>this.pin(tab)},
        {id:'earlier',label:this.l('Move tab earlier','分頁移前',true),run:()=>this.move(tab,-1)},
        {id:'later',label:this.l('Move tab later','分頁移後',true),run:()=>this.move(tab,1)},
        {id:'group',label:this.l('Move into group…','移入群組…',true),run:()=>this.show('manage')},
        {id:'close',label:this.l('Close tab','關閉分頁',true),disabled:tab.pinned,run:()=>this.remove(tab)},
        {id:'manage',label:this.l('Manage tabs and docking…','管理分頁同停靠位置…',true),run:()=>this.show('manage')}
      ];
      if(groupTarget)return [{id:'group-appearance',label:this.l('Edit group appearance…','編輯群組外觀…',true),run:()=>openAppearanceEditor(groupTarget,this.language)},{id:'manage',label:this.l('Manage groups…','管理群組…',true),run:()=>this.show('manage')}];
      return [];
    }));
    const activate=window.studio?.onWorkspaceTabActivate?.(id=>{const tab=this.tabs.find(t=>t.id===id);if(tab)this.choose(tab);});if(activate)this.subscriptions.push(activate);
    const changed=window.studio?.onWorkspaceTabsChanged?.(()=>{if(this.publicationRequired&&!this.publishing)void this.publish();if(this.dialog==='master')void this.refreshMaster();});if(changed)this.subscriptions.push(changed);
    try{const value=JSON.parse(localStorage.getItem(storageKey)||'null');if(value?.version===1){this.edge=['left','right','top','bottom'].includes(value.edge)?value.edge:'left';this.groups=Array.isArray(value.groups)?value.groups.filter((g:any)=>typeof g.id==='string'&&typeof g.name==='string').slice(0,100):[];this.tabs=Array.isArray(value.tabs)?value.tabs.filter((t:any)=>typeof t.id==='string'&&typeof t.destination==='string'&&typeof t.name==='string').slice(0,200).map((t:any)=>({...t,pinned:t.pinned===true,group:this.groups.some(g=>g.id===t.group)?t.group:''})):[];this.active=typeof value.active==='string'?value.active:'';}}catch{this.notice=this.l('Saved tab layout could not be read.','未能讀取已儲存分頁排列。',true);}}
  disconnectedCallback(){this.dialogGeneration++;this.masterGeneration++;this.opener=undefined;window.removeEventListener('command-action-providers-changed',this.providersChanged);for(const unsubscribe of this.subscriptions)unsubscribe();this.subscriptions=[];super.disconnectedCallback();}
  protected firstUpdated(){void this.publish();}
  protected updated(changed:Map<string,unknown>){if(changed.has('language'))void this.publish();}
  private async publish(){const bridge=window.studio?.workspaceTabs;if(!bridge)return;this.publicationRequired=true;const version=++this.publicationVersion;if(this.publishing)return;this.publishing=true;try{const reply=await bridge({action:'publish',tabs:this.tabs.map(tab=>({id:tab.id,label:this.title(tab).slice(0,300),group:this.groups.find(g=>g.id===tab.group)?.name||'',pinned:tab.pinned,workspace:tab.owner||(tab.id.startsWith('workspace:')?tab.id.slice(10):'')}))});if(reply.ok&&version===this.publicationVersion)this.publicationRequired=false;}catch{/* A disconnected host cannot provide cross-window discovery. */}finally{this.publishing=false;if(version!==this.publicationVersion)void this.publish();}}

  private async refreshMaster(){const generation=++this.masterGeneration;this.masterState=this.l('Loading actual application windows…','正在載入實際視窗…',true);try{const reply=await window.studio?.workspaceTabs?.({action:'list'});if(generation!==this.masterGeneration)return;if(!reply?.ok||!reply.windows)throw Error();this.masterRows=reply.windows.flatMap(window=>window.tabs.map(tab=>({...tab,id:`${window.id}:${tab.id}`,windowId:window.id,tabId:tab.id})));this.masterState=this.l(`${reply.windows.length} registered application window(s).`,`${reply.windows.length} 個已登記視窗。`);}catch{if(generation===this.masterGeneration){this.masterRows=[];this.masterState=this.l('Host window discovery unavailable. Local tab management remains available.','未能探索主機視窗；仍可管理本機分頁。',true);}}}
  private async activateMaster(row:{windowId:string;tabId:string}){try{const reply=await window.studio?.workspaceTabs?.({action:'activate',windowId:row.windowId,tabId:row.tabId});this.masterState=reply?.ok?this.l('Activation requested. The owning workspace retains its draft protections.','已要求開啟；所屬工作區保留草稿保護。',true):this.l('That tab is no longer available. Refresh the list.','該分頁已無法使用，請重新整理。',true);}catch{this.masterState=this.l('Host activation unavailable.','未能透過主機開啟。',true);}}
  private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
  private title(tab:OpenTab){const d=this.destinations.find(d=>d.id===tab.destination);return tab.name||(d?this.l(d.en,d.zh):tab.destination);}
  private save(){void this.publish();try{localStorage.setItem(storageKey,JSON.stringify({version:1,tabs:this.tabs,groups:this.groups,active:this.active,edge:this.edge}));}catch{this.notice=this.l('Tab layout is available for this session only.','分頁排列只適用於本次工作階段。',true);}}
  /** Called only after the owner has accepted navigation and its unsaved-work decision. */
  acknowledge(destination:string,name='',workspaceId='',owner=''){
    const id=workspaceId?`workspace:${workspaceId}`:`utility:${owner}:${destination}`;
    let tab=this.tabs.find(t=>t.id===id);
    if(!tab){if(this.tabs.length>=200){this.notice=this.l('Close an existing tab before opening another (limit 200).','請先關閉現有分頁再開新分頁（上限 200）。',true);return;}tab={id,destination,name,pinned:false,group:'',owner};this.tabs=[...this.tabs,tab];}
    else this.tabs=this.tabs.map(t=>t.id===id?{...t,destination,name,owner}:t);
    this.active=id;this.save();
  }
  private request(destination:string,id?:string){this.dispatchEvent(new CustomEvent('workspace-destination',{bubbles:true,composed:true,detail:{destination,tabId:id,projectContext:this.tabs.find(t=>t.id===id)?.owner}}));}
  private choose(tab:OpenTab){this.revealedTab=tab.id;this.request(tab.destination,tab.id);}
  private queueDialog(action:()=>Promise<void>){
    this.dialogTransition=this.dialogTransition.then(action).catch(()=>{
      this.notice=this.l('Dialog transition could not finish. Try opening it again.','對話框未能完成切換，請再試開啟。',true);
    });
    return this.dialogTransition;
  }
  private show(mode:'catalog'|'manage'|'master',event?:Event){
    const generation=++this.dialogGeneration;
    const opener=event?.currentTarget instanceof HTMLElement?event.currentTarget:undefined;
    return this.queueDialog(async()=>{
      if(generation!==this.dialogGeneration||!this.isConnected)return;
      const dialog=this.renderRoot.querySelector('md-dialog') as import('@material/web/dialog/dialog').MdDialog|null;
      if(!dialog)return;
      if(dialog.open){await this.finishDialogClose(false);if(dialog.open)return;}
      if(generation!==this.dialogGeneration||!this.isConnected)return;
      this.opener=opener;this.dialog=mode;this.closePreview=[];this.catalogMatches=null;this.groupMatches=null;
      await this.updateComplete;
      if(generation!==this.dialogGeneration||!this.isConnected)return;
      if(mode==='master')void this.publish().then(()=>{if(generation===this.dialogGeneration&&this.dialog==='master')void this.refreshMaster();});
      await dialog.show();
    });
  }
  private async finishDialogClose(restoreFocus:boolean){
    const dialog=this.renderRoot.querySelector('md-dialog') as import('@material/web/dialog/dialog').MdDialog|null;
    // Material's promise settles after its closed event. Keep the rendered mode
    // intact throughout the animation and never overlap show() with close().
    await dialog?.close();
    if(dialog?.open)return;
    const opener=this.opener;this.opener=undefined;this.dialog='';this.masterGeneration++;
    await this.updateComplete;
    if(restoreFocus&&this.isConnected&&opener?.isConnected)opener.focus();
  }
  private close(){this.dialogGeneration++;return this.queueDialog(()=>this.finishDialogClose(true));}
  private cancelDialog(event:Event){event.preventDefault();void this.close();}
  private async tabAppearance(tab:OpenTab){this.revealedTab=tab.id;await this.close();await this.updateComplete;const target=Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[data-tab-id]')).find(el=>el.dataset.tabId===tab.id);if(target)openAppearanceEditor(target,this.language);}
  private pin(tab:OpenTab){this.tabs=this.tabs.map(t=>t.id===tab.id?{...t,pinned:!t.pinned}:t);this.save();}
  private move(tab:OpenTab,delta:number){const peers=this.tabs.filter(t=>t.pinned===tab.pinned&&t.group===tab.group);const other=peers[peers.indexOf(tab)+delta];if(!other)return;const next=[...this.tabs],a=next.indexOf(tab),b=next.indexOf(other);[next[a],next[b]]=[next[b],next[a]];this.tabs=next;this.save();}
  private previewClose(inverse:boolean){const search=this.renderRoot.querySelector('settings-search') as import('./settings-search').SettingsSearch|null;if(!search||!(search.regex?search.pattern:search.query).trim()||search.error||this.catalogMatches===null){this.notice=this.l('Enter a valid nonempty search before closing tabs.','請先輸入有效而非空白嘅搜尋，再關閉分頁。',true);return;}this.closePreview=this.tabs.filter(t=>(this.includePinned||!t.pinned)&&(inverse?!this.catalogMatches!.includes(t.id):this.catalogMatches!.includes(t.id)));}
  private remove(tab:OpenTab){this.removeBatch([tab]);}
  private removeBatch(selected:OpenTab[]){
    const ids=new Set(selected.map(tab=>tab.id));
    const tabs=this.tabs.filter(tab=>ids.has(tab.id));
    if(!tabs.length)return;
    let completed=false;
    this.dispatchEvent(new CustomEvent('workspace-close',{bubbles:true,composed:true,detail:{tabs,complete:()=>{
      if(completed)return;
      completed=true;
      const activeRemoved=ids.has(this.active);
      this.tabs=this.tabs.filter(tab=>!ids.has(tab.id));
      if(activeRemoved){this.active='';const next=this.tabs[0];if(next)this.choose(next);}
      this.save();
    }}}));
  }
  private key(event:KeyboardEvent,tab:OpenTab){const vertical=['left','right'].includes(this.edge);const prev=vertical?'ArrowUp':'ArrowLeft',next=vertical?'ArrowDown':'ArrowRight';if(event.altKey&&event.key.toLowerCase()==='p'){event.preventDefault();this.pin(tab);return;}if(event.key===prev||event.key===next){event.preventDefault();const delta=event.key===prev?-1:1;if(event.altKey){this.move(tab,delta);return;}const nodes=Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[role=tab]'));const current=nodes.findIndex(n=>n.dataset.tabId===tab.id);nodes[(current+delta+nodes.length)%nodes.length]?.focus();}if(event.key==='Enter'||event.key===' '){event.preventDefault();this.choose(tab);}if(event.key==='Home'||event.key==='End'){event.preventDefault();const nodes=this.renderRoot.querySelectorAll<HTMLElement>('[role=tab]');nodes[event.key==='Home'?0:nodes.length-1]?.focus();}}
  private tabView(tab:OpenTab){const d=this.destinations.find(d=>d.id===tab.destination);return html`<div class="tab" role="tab" tabindex=${this.active===tab.id?0:-1} aria-selected=${this.active===tab.id} aria-controls="workspace-content" aria-label=${this.title(tab)} data-tab-id=${tab.id} data-appearance-owner="workspace-tabs" data-appearance-key=${`tab:${tab.id}`} data-workspace-appearance="tab" data-experience-id=${`workspace-tab:${tab.id}`} draggable="true" @keydown=${(e:KeyboardEvent)=>this.key(e,tab)} @dragstart=${()=>this.dragged=tab.id} @dragover=${(e:DragEvent)=>e.preventDefault()} @drop=${(e:DragEvent)=>{e.preventDefault();const source=this.tabs.find(t=>t.id===this.dragged);if(!source||source.pinned!==tab.pinned)return;const next=this.tabs.filter(t=>t!==source);next.splice(next.indexOf(tab),0,{...source,group:tab.group});this.tabs=next;this.save();}}><md-text-button tabindex="-1" title=${this.title(tab)} aria-label=${this.title(tab)} @click=${()=>this.choose(tab)}>${materialIcon(d?.icon||'folder_open')}<span class="label">${tab.pinned?'● ':''}${this.title(tab)}</span></md-text-button></div>`;}
  render(){const available=this.tabs.filter(t=>this.destinations.some(d=>d.id===t.destination)||t.destination.startsWith('project:'));const unpinned=available.filter(t=>!t.pinned);const catalog=getCommandActionEntries(this.language).filter(entry=>entry.providerId==='workspace');const entries=this.dialog==='catalog'?catalog.map(entry=>({id:entry.id,text:entry.label})):this.dialog==='master'?this.masterRows.map(row=>({id:row.id,text:`${row.label} ${row.group} ${row.windowId} ${row.workspace} ${row.pinned?this.l('Pinned','已固定',true):''}`})):available.map(t=>({id:t.id,text:`${this.title(t)} ${this.groups.find(g=>g.id===t.group)?.name||''} ${t.pinned?this.l('Pinned','已固定',true):''}`}));return html`<div class=${`layout ${this.edge}`} data-experience-id="workspace-shell"><aside aria-label=${this.l('Workspace tabs','工作區分頁',true)}><div class="controls"><md-text-button data-control="new-tab" data-experience-id="workspace-new-tab" aria-label=${this.l('New tab','新分頁',true)} title=${this.l('New tab','新分頁',true)} @click=${(e:Event)=>this.show('catalog',e)}>${materialIcon('add')}<span class="label">${this.l('New tab','新分頁',true)}</span></md-text-button><md-text-button data-control="tab-list" data-experience-id="workspace-tab-list" aria-label=${this.l('Search and manage all tabs','搜尋同管理所有分頁',true)} title=${this.l('Search and manage all tabs','搜尋同管理所有分頁',true)} @click=${(e:Event)=>this.show('manage',e)}>${materialIcon('menu')}</md-text-button><md-text-button data-experience-id="workspace-master-search" aria-label=${this.l('Search tabs across application windows','搜尋所有視窗分頁',true)} title=${this.l('Search tabs across application windows','搜尋所有視窗分頁',true)} @click=${(e:Event)=>this.show('master',e)}>${materialIcon('search')}</md-text-button></div><div class="pinned" role="tablist" aria-label=${this.l('Pinned tabs','已固定分頁',true)} aria-orientation=${['left','right'].includes(this.edge)?'vertical':'horizontal'}>${available.filter(t=>t.pinned).map(t=>this.tabView(t))}</div><div class="strip" role="tablist" aria-label=${this.l('Open tabs','已開啟分頁',true)} aria-orientation=${['left','right'].includes(this.edge)?'vertical':'horizontal'}>${unpinned.filter(t=>!t.group).map(t=>this.tabView(t))}${this.groups.map(g=>html`<div><md-text-button class="group" aria-expanded=${!g.collapsed} data-group-id=${g.id} data-appearance-owner="workspace-tabs" data-appearance-key=${`group:${g.id}`} data-workspace-appearance="group" data-experience-id=${`workspace-group:${g.id}`} @click=${()=>{this.groups=this.groups.map(x=>x===g?{...g,collapsed:!g.collapsed}:x);this.save();}}>${materialIcon('folder_open')}<span class="group-name">${g.name}</span></md-text-button>${unpinned.filter(t=>t.group===g.id&&(!g.collapsed||t.id===this.revealedTab)).map(t=>this.tabView(t))}</div>`)}</div>${this.notice?html`<span role="status" class="status">${this.notice}</span>`:nothing}</aside><div class="content" id="workspace-content" role="tabpanel" aria-label=${this.l('Active workspace','目前工作區',true)}><slot></slot></div></div><md-dialog @cancel=${this.cancelDialog}><div slot="headline">${this.dialog==='catalog'?this.l('New tab: choose a destination','新分頁：選擇目的地',true):this.dialog==='master'?this.l('All application windows and tabs','所有視窗同分頁',true):this.l('Tabs and groups','分頁同群組',true)}</div><div slot="content" class="results">${keyed(this.dialog,html`<settings-search data-experience-id=${`workspace-${this.dialog}-search`} .language=${this.language} .label=${this.l('Search destinations or tabs','搜尋目的地或分頁',true)} .entries=${entries} @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();if(JSON.stringify(this.catalogMatches)!==JSON.stringify(e.detail)){this.catalogMatches=e.detail;this.closePreview=[];}}}></settings-search>`)}${this.dialog==='catalog'?catalog.filter(entry=>this.catalogMatches===null||this.catalogMatches.includes(entry.id)).map(entry=>html`<md-outlined-button data-experience-id=${`workspace-catalog:${entry.id}`} ?disabled=${entry.disabled===true} @click=${async()=>{await this.close();void entry.run();}}>${materialIcon(this.destinations.find(d=>`workspace:${d.id}`===entry.id)?.icon||'open_in_new')}${entry.label}</md-outlined-button>`):this.dialog==='master'?html`<p role="status">${this.masterState}</p><md-text-button @click=${()=>this.refreshMaster()}>${this.l('Refresh actual windows','重新整理實際視窗',true)}</md-text-button>${this.masterRows.filter(row=>this.catalogMatches===null||this.catalogMatches.includes(row.id)).map(row=>html`<div class="result"><strong>${row.label}</strong><span>${row.windowId} · ${row.workspace} · ${row.group} · ${row.pinned?this.l('Pinned','已固定',true):this.l('Unpinned','未固定',true)}</span><md-text-button @click=${()=>this.activateMaster(row)}>${this.l('Open owning window and tab','開啟所屬視窗同分頁',true)}</md-text-button></div>`)}`:html`<md-outlined-select data-experience-id="workspace-edge" .label=${this.l('Tab edge','分頁位置',true)} .value=${this.edge} @change=${(e:Event)=>{this.edge=(e.target as HTMLSelectElement).value;this.save();}}>${[['left','Left','左邊'],['right','Right','右邊'],['top','Top','上方'],['bottom','Bottom','下方']].map(([v,en,zh])=>html`<md-select-option value=${v} ?selected=${this.edge===v}><div slot="headline">${this.l(en,zh)}</div></md-select-option>`)}</md-outlined-select><p>${this.l('Arrow keys move focus; Alt + arrow reorders; Alt + P pins. Closing a tab does not delete its project.','方向鍵移動焦點；Alt 加方向鍵調整次序；Alt 加 P 固定。關閉分頁唔會刪除專案。',true)}</p><label><input type="checkbox" .checked=${this.includePinned} @change=${(e:Event)=>{this.includePinned=(e.target as HTMLInputElement).checked;this.closePreview=[];}}>${this.l('Include pinned tabs in close preview','關閉預覽包括已固定分頁',true)}</label><div class="controls"><md-text-button data-experience-id="workspace-close-matching" @click=${()=>this.previewClose(false)}>${this.l('Preview close matching tabs','預覽關閉符合搜尋分頁',true)}</md-text-button><md-text-button data-experience-id="workspace-close-not-matching" @click=${()=>this.previewClose(true)}>${this.l('Preview close nonmatching tabs','預覽關閉不符合搜尋分頁',true)}</md-text-button></div>${this.closePreview.length?html`<section aria-label=${this.l('Close preview','關閉預覽',true)}><p>${this.l('Tabs to close','將關閉嘅分頁',true)}: ${this.closePreview.length}</p><ul>${this.closePreview.map(t=>html`<li>${this.title(t)} ${t.pinned?this.l('(pinned)','（已固定）',true):''}</li>`)}</ul><md-outlined-button @click=${()=>{this.removeBatch(this.closePreview);this.closePreview=[];}}>${this.l('Confirm close previewed tabs','確認關閉預覽分頁',true)}</md-outlined-button><md-text-button @click=${()=>this.closePreview=[]}>${this.l('Cancel','取消',true)}</md-text-button></section>`:nothing}${available.filter(t=>this.catalogMatches===null||this.catalogMatches.includes(t.id)).map(t=>html`<div class="result" data-experience-id=${`workspace-manage:${t.id}`}><strong>${this.title(t)}</strong><md-text-button data-control="tab-appearance" @click=${()=>this.tabAppearance(t)}>${this.l('Edit tab appearance…','編輯分頁外觀…',true)}</md-text-button><md-text-button @click=${async()=>{await this.close();this.choose(t);}}>${this.l('Open','開啟',true)}</md-text-button><md-text-button data-control="pin" @click=${()=>this.pin(t)}>${t.pinned?this.l('Unpin','取消固定',true):this.l('Pin','固定',true)}</md-text-button><md-text-button aria-label=${this.l('Move earlier','移前',true)} data-control="move-earlier" @click=${()=>this.move(t,-1)}>${materialIcon('arrow_upward')}</md-text-button><md-text-button aria-label=${this.l('Move later','移後',true)} data-control="move-later" @click=${()=>this.move(t,1)}>${materialIcon('arrow_downward')}</md-text-button><md-outlined-select .label=${this.l('Group','群組',true)} .value=${t.group} @change=${(e:Event)=>{this.tabs=this.tabs.map(x=>x===t?{...t,group:(e.target as HTMLSelectElement).value}:x);this.save();}}><md-select-option value="" ?selected=${!t.group}><div slot="headline">${this.l('No group','無群組',true)}</div></md-select-option>${this.groups.map(g=>html`<md-select-option .value=${g.id} ?selected=${t.group===g.id}><div slot="headline">${g.name}</div></md-select-option>`)}</md-outlined-select><md-text-button data-control="close-tab" ?disabled=${t.pinned} @click=${()=>this.remove(t)}>${this.l('Close','關閉',true)}</md-text-button></div>`)}<md-outlined-text-field data-experience-id="workspace-group-name" .label=${this.l('New group name','新群組名稱',true)} maxlength="120" .value=${this.groupName} @input=${(e:Event)=>this.groupName=(e.target as HTMLInputElement).value}></md-outlined-text-field><md-text-button ?disabled=${!this.groupName.trim()} @click=${()=>{this.groups=[...this.groups,{id:crypto.randomUUID(),name:this.groupName.trim(),collapsed:false}];this.groupName='';this.save();}}>${this.l('Create group','建立群組',true)}</md-text-button><settings-search data-experience-id="workspace-group-search" .language=${this.language} .label=${this.l('Search groups','搜尋群組',true)} .entries=${this.groups.map(g=>({id:g.id,text:g.name}))} @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();if(JSON.stringify(this.groupMatches)!==JSON.stringify(e.detail)){this.groupMatches=e.detail;this.requestUpdate();}}}></settings-search>${this.groups.filter(g=>this.groupMatches===null||this.groupMatches.includes(g.id)).map(g=>html`<div class="result"><md-outlined-text-field .label=${this.l('Group name','群組名稱',true)} .value=${g.name} maxlength="120" @change=${(e:Event)=>{const name=(e.target as HTMLInputElement).value.trim();if(name){this.groups=this.groups.map(x=>x===g?{...g,name}:x);this.save();}}}></md-outlined-text-field><md-text-button @click=${()=>{this.groups=this.groups.filter(x=>x!==g);this.tabs=this.tabs.map(t=>t.group===g.id?{...t,group:''}:t);this.save();}}>${this.l('Remove group, keep tabs','移除群組，保留分頁',true)}</md-text-button><md-text-button aria-label=${this.l('Move group earlier','群組移前',true)} @click=${()=>{const index=this.groups.indexOf(g);if(index>0){const groups=[...this.groups];[groups[index-1],groups[index]]=[groups[index],groups[index-1]];this.groups=groups;this.save();}}}>${materialIcon('arrow_upward')}</md-text-button><settings-search data-experience-id=${`workspace-group-search:${g.id}`} .language=${this.language} .label=${this.l('Search this group','搜尋此群組',true)} .entries=${available.filter(t=>t.group===g.id).map(t=>({id:t.id,text:this.title(t)}))} @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();if(JSON.stringify(this.memberMatches.get(g.id))!==JSON.stringify(e.detail)){this.memberMatches.set(g.id,e.detail);this.requestUpdate();}}}></settings-search>${available.filter(t=>t.group===g.id&&(!this.memberMatches.has(g.id)||this.memberMatches.get(g.id)!.includes(t.id))).map(t=>html`<md-text-button @click=${async()=>{await this.close();this.choose(t);}}>${this.title(t)}</md-text-button>`)}</div>`)}`}</div><div slot="actions"><md-text-button @click=${()=>this.close()}>${this.l('Close','關閉',true)}</md-text-button></div></md-dialog>`;}
}
customElements.define('workspace-tabs',WorkspaceTabs);

// Handle the explicit modifier path before the global context card is installed.
document.addEventListener('contextmenu',event=>{if(!event.shiftKey)return;const target=event.composedPath().find(node=>node instanceof HTMLElement&&node.hasAttribute('data-workspace-appearance')) as HTMLElement|undefined;if(!target)return;const root=target.getRootNode();if(!(root instanceof ShadowRoot)||!(root.host instanceof WorkspaceTabs))return;event.preventDefault();event.stopImmediatePropagation();openAppearanceEditor(target,root.host.language);},true);
