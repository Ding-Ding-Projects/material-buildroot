import {localizedCopy} from './language-wording';
import {keyed} from 'lit/directives/keyed.js';
import {getCommandActionEntries,registerContextActionProvider} from './command-surfaces';
import {openAppearanceEditor} from './appearance-panel';
import {LitElement, html, css, nothing} from 'lit';
import {materialIcon} from './material-icons';
import {m3Styles} from './design-system/m3-styles';
/** Maps the older icon names used by tab destinations to Material Symbols. */
const tabSymbol=(name:string)=>({album:'deployed_code',help_outline:'help',description:'description'} as Record<string,string>)[name]??name;
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
const edgeChoices=[['left','Left','左邊'],['right','Right','右邊'],['top','Top','上方'],['bottom','Bottom','下方']];
const storageKey='material-buildroot.workspace-tabs.v1';
/** Navigation metadata only. Execution authority and drafts remain in the owning workspace. */
export class WorkspaceTabs extends LitElement {
  static properties={compactEmpty:{type:Boolean},language:{type:String}, destinations:{attribute:false}, tabs:{state:true}, active:{state:true}, edge:{state:true}, groups:{state:true}, dialog:{state:true}, catalogMatches:{state:true}, groupName:{state:true}, notice:{state:true}, closePreview:{state:true}, includePinned:{state:true}, masterRows:{state:true}, masterState:{state:true}, revealedTab:{state:true}, stripMatches:{state:true}, stripSearch:{state:true}, drawerOpen:{state:true}, mediumLayout:{state:true}};
  compactEmpty=false;
  language='bilingual'; destinations:WorkspaceDestination[]=[]; tabs:OpenTab[]=[]; active=''; edge='left'; groups:Group[]=[];
  dialog:''|'catalog'|'manage'|'master'=''; catalogMatches:string[]|null=null; groupName=''; notice='';
  private masterRows:Array<{id:string;windowId:string;tabId:string;label:string;group:string;workspace:string;pinned:boolean}>=[];
  private masterState='';
  private revealedTab='';
  private stripMatches:string[]|null=null;
  private stripSearch=false;
  private drawerOpen=false;
  private mediumLayout=false;
  private drawerMedia?:MediaQueryList;
  private readonly onDrawerMediaChange=(event:MediaQueryListEvent)=>{this.mediumLayout=event.matches;};
  private get renderedOrientation(){return this.mediumLayout||['left','right'].includes(this.edge)?'vertical':'horizontal';}
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
  static styles=[...m3Styles,css`
    :host{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden;color:inherit}
    .layout{position:relative;display:flex;gap:16px;flex:1;min-width:0;min-height:0;overflow:hidden}.layout.right{flex-direction:row-reverse}.layout.top{flex-direction:column}.layout.bottom{flex-direction:column-reverse}
    aside{display:flex;flex-direction:column;gap:4px;flex:0 0 248px;min-height:0;max-width:40%;padding:12px 8px;background:var(--md-sys-color-surface);border:0;border-radius:28px}
    .top aside,.bottom aside{flex:0 0 auto;max-width:none;max-height:40%;flex-direction:row;align-items:stretch}
    .dock-heading{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 4px;font-size:12px;font-weight:600;color:var(--md-sys-color-on-surface-variant)}.dock-heading md-text-button{min-width:44px;min-height:44px}.dock-empty{padding:16px 12px;font-size:13px;line-height:1.5;color:var(--md-sys-color-on-surface-variant)}.strip-search{min-width:0;max-height:50vh;overflow:auto}.top .dock-heading,.bottom .dock-heading{flex:0 0 auto}.top .strip-search,.bottom .strip-search{flex:0 0 260px}aside md-text-button{min-height:44px}.tab{border-radius:20px;min-height:44px}.group{border-inline-start:3px solid var(--md-sys-color-tertiary);padding-inline-start:8px}
    .strip{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:auto;gap:4px;flex:1}.top .strip,.bottom .strip{flex-direction:row}
    .pinned{flex:0 1 auto;max-height:40%;overflow:auto;border-bottom:1px solid var(--md-sys-color-outline)}.top .pinned,.bottom .pinned{max-width:40%;max-height:none;display:flex}
    .tab{display:flex;align-items:center;min-width:0}.tab md-text-button{width:100%;text-align:start;min-height:48px;--md-text-button-container-height:48px;--md-text-button-container-shape:999px}.tab .label{flex:1;min-width:0;text-align:start}.tab[aria-selected=true]{background:var(--md-sys-color-secondary-container);border-radius:999px}.tab:focus-visible{outline:3px solid var(--md-sys-color-primary);outline-offset:-3px}
    .top .tab,.bottom .tab{flex:0 0 180px}.label{overflow-wrap:anywhere}.controls{display:flex;flex-wrap:wrap;gap:4px}.content{display:flex;flex:1;min-width:0;min-height:0;overflow:hidden}::slotted(main){flex:1;min-width:0;min-height:0}
    .compact-empty aside{padding-block:0;min-height:44px;max-height:44px}.compact-empty aside md-text-button{min-height:44px;--md-text-button-container-height:44px}.compact-empty .strip{display:none}
    md-dialog{width:min(900px,96vw);max-width:min(900px,96vw);max-height:90vh}.results{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:8px;min-width:0}.results>*{min-width:0;max-width:100%}.results>md-outlined-button{height:auto;min-height:40px;white-space:normal;overflow-wrap:anywhere}.result{border:1px solid var(--md-sys-color-outline-variant);padding:8px;border-radius:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}.result strong{flex:1;overflow-wrap:anywhere;min-width:100px}md-outlined-select{min-width:120px}md-outlined-text-field{max-width:100%}.group{font-weight:600}.status{font-size:12px;overflow-wrap:anywhere}
    .mobile-dock-bar{display:none}.drawer-close{display:none}
    @media(max-width:1180px){
      .layout,.layout.top,.layout.bottom,.layout.right{flex-direction:row;gap:0}
      .content{flex-direction:column;gap:8px}.mobile-dock-bar{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-height:48px;padding:0 8px;background:var(--md-sys-color-surface);border-radius:24px}.mobile-dock-bar md-text-button{min-height:44px}.mobile-dock-bar .current{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
      aside,.top aside,.bottom aside{display:none}.drawer-open aside,.drawer-open.top aside,.drawer-open.bottom aside{display:flex;position:absolute;z-index:10;inset:56px auto 0 0;width:min(320px,calc(100% - 16px));max-width:none;max-height:none;flex-direction:column;box-shadow:var(--app-elevation-3);overflow:auto;padding:12px;background:var(--md-sys-color-surface-container-low)}
      .drawer-open .strip,.drawer-open .pinned{flex-direction:column;max-width:none}.drawer-open .tab{flex:0 0 auto}.drawer-close{display:inline-flex}.drawer-open .strip-search{flex:0 0 auto}.drawer-open .dock-heading{flex:0 0 auto}
    }
    aside{flex:0 0 248px;padding:16px 12px;gap:2px;background:var(--surface);border-radius:28px}
    .tabs-head{display:flex;align-items:center;gap:0;padding:0 0 12px 12px;font-size:inherit;color:var(--on-surface)}
    .tabs-head .label{font-weight:500}
    .tabs-head .drawer-close{display:none}
    .grow{flex:1}
    .wtab{cursor:pointer;flex:0 0 auto}
    .wtab:focus-visible{outline:3px solid var(--secondary);outline-offset:-3px}
    .wtab .lbl{white-space:nowrap}
    .group{width:100%;border:0;background:transparent;border-radius:999px;cursor:pointer;font-family:inherit;text-align:left;padding:12px 16px}
    .group .lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .group .grp-dot{background:var(--tertiary)}
    .pinned{border-bottom:1px solid var(--outline-variant);padding-bottom:4px;margin-bottom:4px;display:flex;flex-direction:column;gap:2px}
    .pinned:empty{display:none}
    .strip{gap:2px}
    .close-tabs{align-self:flex-start;margin-top:8px}
    .dock-empty{padding:8px 16px;color:var(--on-surface-variant);font-size:12px;line-height:16px}
    .top aside,.bottom aside{border-radius:28px;padding:8px 12px}
    .top .wtab,.bottom .wtab{flex:0 0 200px}
    .top .close-tabs,.bottom .close-tabs,.top .grow,.bottom .grow{display:none}
    @media(max-width:1180px){.drawer-open .tabs-head .drawer-close{display:inline-flex}.mobile-dock-bar{background:var(--surface);border-radius:999px}}
  `];
  connectedCallback(){super.connectedCallback();
    this.drawerMedia=matchMedia('(max-width:1180px)');
    this.mediumLayout=this.drawerMedia.matches;
    this.drawerMedia.addEventListener('change',this.onDrawerMediaChange);
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
        {id:'close',label:this.l('Close tab','關閉分頁',true),disabled:tab.pinned,run:()=>this.requestClose(tab)},
        {id:'manage',label:this.l('Manage tabs and docking…','管理分頁同停靠位置…',true),run:()=>this.show('manage')}
      ];
      if(groupTarget)return [{id:'group-appearance',label:this.l('Edit group appearance…','編輯群組外觀…',true),run:()=>openAppearanceEditor(groupTarget,this.language)},{id:'manage',label:this.l('Manage groups…','管理群組…',true),run:()=>this.show('manage')}];
      return [];
    }));
    const activate=window.studio?.onWorkspaceTabActivate?.(id=>{const tab=this.tabs.find(t=>t.id===id);if(tab)this.choose(tab);});if(activate)this.subscriptions.push(activate);
    const changed=window.studio?.onWorkspaceTabsChanged?.(()=>{if(this.publicationRequired&&!this.publishing)void this.publish();if(this.dialog==='master')void this.refreshMaster();});if(changed)this.subscriptions.push(changed);
    try{const value=JSON.parse(localStorage.getItem(storageKey)||'null');if(value?.version===1){this.edge=['left','right','top','bottom'].includes(value.edge)?value.edge:'left';this.groups=Array.isArray(value.groups)?value.groups.filter((g:any)=>typeof g.id==='string'&&typeof g.name==='string').slice(0,100):[];this.tabs=Array.isArray(value.tabs)?value.tabs.filter((t:any)=>typeof t.id==='string'&&typeof t.destination==='string'&&typeof t.name==='string').slice(0,200).map((t:any)=>({...t,pinned:t.pinned===true,group:this.groups.some(g=>g.id===t.group)?t.group:''})):[];this.active=typeof value.active==='string'?value.active:'';}}catch{this.notice=this.l('Saved tab layout could not be read.','未能讀取已儲存分頁排列。',true);}}
  disconnectedCallback(){this.drawerMedia?.removeEventListener('change',this.onDrawerMediaChange);this.drawerMedia=undefined;this.dialogGeneration++;this.masterGeneration++;this.opener=undefined;window.removeEventListener('command-action-providers-changed',this.providersChanged);for(const unsubscribe of this.subscriptions)unsubscribe();this.subscriptions=[];super.disconnectedCallback();}
  protected firstUpdated(){void this.publish();}
  protected updated(changed:Map<string,unknown>){if(changed.has('language'))void this.publish();}
  private async publish(){const bridge=window.studio?.workspaceTabs;if(!bridge)return;this.publicationRequired=true;const version=++this.publicationVersion;if(this.publishing)return;this.publishing=true;try{const reply=await bridge({action:'publish',tabs:this.tabs.map(tab=>({id:tab.id,label:this.tabTitle(tab).slice(0,300),group:this.groups.find(g=>g.id===tab.group)?.name||'',pinned:tab.pinned,workspace:tab.owner||(tab.id.startsWith('workspace:')?tab.id.slice(10):'')}))});if(reply.ok&&version===this.publicationVersion)this.publicationRequired=false;}catch{/* A disconnected host cannot provide cross-window discovery. */}finally{this.publishing=false;if(version!==this.publicationVersion)void this.publish();}}

  private async refreshMaster(){const generation=++this.masterGeneration;this.masterState=this.l('Loading actual application windows…','正在載入實際視窗…',true);try{const reply=await window.studio?.workspaceTabs?.({action:'list'});if(generation!==this.masterGeneration)return;if(!reply?.ok||!reply.windows)throw Error();this.masterRows=reply.windows.flatMap(window=>window.tabs.map(tab=>({...tab,id:`${window.id}:${tab.id}`,windowId:window.id,tabId:tab.id})));this.masterState=this.l(`${reply.windows.length} registered application window(s).`,`${reply.windows.length} 個已登記視窗。`);}catch{if(generation===this.masterGeneration){this.masterRows=[];this.masterState=this.l('Host window discovery unavailable. Local tab management remains available.','未能探索主機視窗；仍可管理本機分頁。',true);}}}
  private async activateMaster(row:{windowId:string;tabId:string}){try{const reply=await window.studio?.workspaceTabs?.({action:'activate',windowId:row.windowId,tabId:row.tabId});this.masterState=reply?.ok?this.l('Activation requested. The owning workspace retains its draft protections.','已要求開啟；所屬工作區保留草稿保護。',true):this.l('That tab is no longer available. Refresh the list.','該分頁已無法使用，請重新整理。',true);}catch{this.masterState=this.l('Host activation unavailable.','未能透過主機開啟。',true);}}
  private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
  private edgeLabel(){const row=edgeChoices.find(([id])=>id===this.edge);return row?this.l(row[1],row[2]):'';}
  private tabTitle(tab:OpenTab){const d=this.destinations.find(d=>d.id===tab.destination);return tab.name||(d?this.l(d.en,d.zh):tab.destination);}
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
  private async toggleDrawer(){
    this.drawerOpen=!this.drawerOpen;await this.updateComplete;
    const target=this.renderRoot.querySelector<HTMLElement>(this.drawerOpen?'aside [data-control=new-tab]':'[data-control=drawer-toggle]');target?.focus();
  }
  private choose(tab:OpenTab){this.revealedTab=tab.id;this.drawerOpen=false;this.request(tab.destination,tab.id);}
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
  private async tabAppearance(tab:OpenTab){this.revealedTab=tab.id;this.stripSearch=false;this.stripMatches=null;await this.close();await this.updateComplete;const target=Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[data-tab-id]')).find(el=>el.dataset.tabId===tab.id);if(target)openAppearanceEditor(target,this.language);}
  private pin(tab:OpenTab){this.tabs=this.tabs.map(t=>t.id===tab.id?{...t,pinned:!t.pinned}:t);this.save();}
  private move(tab:OpenTab,delta:number){const peers=this.tabs.filter(t=>t.pinned===tab.pinned&&t.group===tab.group);const other=peers[peers.indexOf(tab)+delta];if(!other)return;const next=[...this.tabs],a=next.indexOf(tab),b=next.indexOf(other);[next[a],next[b]]=[next[b],next[a]];this.tabs=next;this.save();}
  private previewClose(inverse:boolean){const search=this.renderRoot.querySelector('md-dialog settings-search') as import('./settings-search').SettingsSearch|null;if(!search||!(search.regex?search.pattern:search.query).trim()||search.error||this.catalogMatches===null){this.notice=this.l('Enter a valid nonempty search before closing tabs.','請先輸入有效而非空白嘅搜尋，再關閉分頁。',true);return;}this.closePreview=this.tabs.filter(t=>(this.includePinned||!t.pinned)&&(inverse?!this.catalogMatches!.includes(t.id):this.catalogMatches!.includes(t.id)));}
  private requestClose(tab:OpenTab){this.removeBatch([tab]);}
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
  private key(event:KeyboardEvent,tab:OpenTab){const vertical=this.renderedOrientation==='vertical';const prev=vertical?'ArrowUp':'ArrowLeft',next=vertical?'ArrowDown':'ArrowRight';if(event.altKey&&event.key.toLowerCase()==='p'){event.preventDefault();this.pin(tab);return;}if(event.key===prev||event.key===next){event.preventDefault();const delta=event.key===prev?-1:1;if(event.altKey){this.move(tab,delta);return;}const nodes=Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[role=tab]'));const current=nodes.findIndex(n=>n.dataset.tabId===tab.id);nodes[(current+delta+nodes.length)%nodes.length]?.focus();}if(event.key==='Enter'||event.key===' '){event.preventDefault();this.choose(tab);}if(event.key==='Home'||event.key==='End'){event.preventDefault();const nodes=this.renderRoot.querySelectorAll<HTMLElement>('[role=tab]');nodes[event.key==='Home'?0:nodes.length-1]?.focus();}}
  /** Match display order and collapsed-group visibility without changing workspace selection. */
  private displayedTabs(){
    const available=this.tabs.filter(tab=>(this.destinations.some(destination=>destination.id===tab.destination)||tab.destination.startsWith('project:'))&&(this.stripMatches===null||this.stripMatches.includes(tab.id)));
    return [
      ...available.filter(tab=>tab.pinned),
      ...available.filter(tab=>!tab.pinned&&!tab.group),
      ...this.groups.flatMap(group=>available.filter(tab=>!tab.pinned&&tab.group===group.id&&(!group.collapsed||tab.id===this.revealedTab))),
    ];
  }
  private tabEntryId(){const displayed=this.displayedTabs();return displayed.find(tab=>tab.id===this.active)?.id??displayed[0]?.id;}
  private tabView(tab:OpenTab){if(this.stripMatches!==null&&!this.stripMatches.includes(tab.id))return nothing;const d=this.destinations.find(d=>d.id===tab.destination);const on=this.active===tab.id;return html`<div class="wtab ndi c sl ${on?'on':''}" role="tab" tabindex=${this.tabEntryId()===tab.id?0:-1} aria-selected=${on} aria-controls="workspace-content" aria-label=${this.tabTitle(tab)+(tab.pinned?', '+this.l('pinned','已固定',true):'')} title=${this.tabTitle(tab)} data-tab-id=${tab.id} data-appearance-owner="workspace-tabs" data-appearance-key=${`tab:${tab.id}`} data-workspace-appearance="tab" data-experience-id=${`workspace-tab:${tab.id}`} draggable="true" @click=${()=>this.choose(tab)} @keydown=${(e:KeyboardEvent)=>this.key(e,tab)} @dragstart=${()=>this.dragged=tab.id} @dragover=${(e:DragEvent)=>e.preventDefault()} @drop=${(e:DragEvent)=>{e.preventDefault();const source=this.tabs.find(t=>t.id===this.dragged);if(!source||source.pinned!==tab.pinned)return;const next=this.tabs.filter(t=>t!==source);next.splice(next.indexOf(tab),0,{...source,group:tab.group});this.tabs=next;this.save();}}><span class="ms s20" aria-hidden="true">${tabSymbol(d?.icon||'folder_open')}</span><span class="label lbl">${this.tabTitle(tab)}</span>${tab.pinned?html`<span class="ms s18 fill" aria-hidden="true">keep</span>`:nothing}</div>`;}
  render(){const available=this.tabs.filter(t=>this.destinations.some(d=>d.id===t.destination)||t.destination.startsWith('project:'));const unpinned=available.filter(t=>!t.pinned);const catalog=getCommandActionEntries(this.language).filter(entry=>entry.providerId==='workspace');const entries=this.dialog==='catalog'?catalog.map(entry=>({id:entry.id,text:entry.label})):this.dialog==='master'?this.masterRows.map(row=>({id:row.id,text:`${row.label} ${row.group} ${row.windowId} ${row.workspace} ${row.pinned?this.l('Pinned','已固定',true):''}`})):available.map(t=>({id:t.id,text:`${this.tabTitle(t)} ${this.groups.find(g=>g.id===t.group)?.name||''} ${t.pinned?this.l('Pinned','已固定',true):''}`}));return html`<div class=${`layout ${this.edge} ${this.compactEmpty&&!available.length?'compact-empty':''} ${this.drawerOpen?'drawer-open':''}`} data-experience-id="workspace-shell"><aside id="workspace-drawer" @keydown=${(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();this.drawerOpen=false;(this.renderRoot.querySelector('[data-control=drawer-toggle]') as HTMLElement|null)?.focus();}}} aria-label=${this.l('Workspace tabs','工作區分頁',true)}><div class="dock-heading tabs-head"><button class="ib sl drawer-close" aria-label=${this.l("Close workspace drawer","關閉工作區抽屜",true)} @click=${()=>{this.drawerOpen=false;(this.renderRoot.querySelector("[data-control=drawer-toggle]") as HTMLElement|null)?.focus();}}><span class="ms" aria-hidden="true">close</span></button><span class="label title-s">${this.l('Tabs','分頁',true)}</span><span class="grow"></span><button class="ib sl" aria-label=${this.l('Search open tabs','搜尋已開啟分頁',true)} title=${this.l('Search open tabs','搜尋已開啟分頁',true)} aria-expanded=${this.stripSearch} @click=${()=>{this.stripSearch=!this.stripSearch;if(!this.stripSearch)this.stripMatches=null;}}><span class="ms s20" aria-hidden="true">manage_search</span></button><button class="ib sl" data-control="tab-list" data-experience-id="workspace-tab-list" aria-label=${this.l('Search and manage all tabs','搜尋同管理所有分頁',true)} title=${this.l('Search and manage all tabs','搜尋同管理所有分頁',true)} @click=${(e:Event)=>this.show('manage',e)}><span class="ms s20" aria-hidden="true">view_sidebar</span></button><button class="ib sl" data-experience-id="workspace-master-search" aria-label=${this.l('Search tabs across application windows','搜尋所有視窗分頁',true)} title=${this.l('Search tabs across application windows','搜尋所有視窗分頁',true)} @click=${(e:Event)=>this.show('master',e)}><span class="ms s20" aria-hidden="true">travel_explore</span></button><button class="ib sm tonal sl" data-control="new-tab" data-experience-id="workspace-new-tab" aria-label=${this.l('New tab','新分頁',true)} title=${this.l('New tab','新分頁',true)} @click=${(e:Event)=>this.show('catalog',e)}><span class="ms" aria-hidden="true">add</span></button></div>${this.stripSearch?html`<div class="strip-search"><settings-search .language=${this.language} .label=${this.l('Search open tabs','搜尋已開啟分頁',true)} .entries=${available.map(tab=>({id:tab.id,text:this.tabTitle(tab)}))} @settings-filter=${(event:CustomEvent<string[]>)=>{event.stopPropagation();this.stripMatches=event.detail;}}></settings-search></div>`:nothing}<div class="pinned" role="tablist" aria-label=${this.l('Pinned tabs','已固定分頁',true)} aria-orientation=${this.renderedOrientation}>${available.filter(t=>t.pinned).map(t=>this.tabView(t))}</div><div class="strip" role="tablist" aria-label=${this.l('Open tabs','已開啟分頁',true)} aria-orientation=${this.renderedOrientation}>${unpinned.filter(t=>!t.group).map(t=>this.tabView(t))}${this.groups.map(g=>html`<div><button class="group nd-head sl" aria-expanded=${!g.collapsed} data-group-id=${g.id} data-appearance-owner="workspace-tabs" data-appearance-key=${`group:${g.id}`} data-workspace-appearance="group" data-experience-id=${`workspace-group:${g.id}`} @click=${()=>{this.groups=this.groups.map(x=>x===g?{...g,collapsed:!g.collapsed}:x);this.save();}}><span class="grp-dot" aria-hidden="true"></span><span class="group-name lbl">${g.name}</span><span class="ms s20" aria-hidden="true">${g.collapsed?'chevron_right':'expand_more'}</span></button>${unpinned.filter(t=>t.group===g.id&&(!g.collapsed||t.id===this.revealedTab)).map(t=>this.tabView(t))}</div>`)}</div>${!available.length?html`<p class="dock-empty label">${this.l("Open a project to keep its workspace here. New tab contains tools, settings and every destination.","開啟專案後，工作區會保留喺呢度。新分頁包含工具、設定同所有目的地。",true)}</p>`:nothing}${this.notice?html`<span role="status" class="status">${this.notice}</span>`:nothing}<span class="grow"></span><button class="btn text sl close-tabs" data-control="close-tabs-matching" @click=${(e:Event)=>this.show('manage',e)}><span class="ms" aria-hidden="true">tab_close</span>${this.l('Close tabs containing…','關閉包含某啲字嘅分頁…',true)}</button></aside><div class="content" id="workspace-content" role="tabpanel" aria-label=${this.l('Active workspace','目前工作區',true)}><div class="mobile-dock-bar"><md-text-button data-control="drawer-toggle" aria-controls="workspace-drawer" aria-expanded=${this.drawerOpen} aria-label=${this.l('Open workspace drawer','開啟工作區抽屜',true)} @click=${this.toggleDrawer}>${materialIcon('menu')}${this.l('Tabs','分頁',true)}</md-text-button><span class="current">${this.tabs.find(tab=>tab.id===this.active)?this.tabTitle(this.tabs.find(tab=>tab.id===this.active)!):this.l('Workspace navigation','工作區導覽',true)}</span><md-text-button data-control="compact-new-tab" @click=${(event:Event)=>this.show('catalog',event)}>${materialIcon('add')}${this.l('New tab','新分頁',true)}</md-text-button><md-text-button data-control="compact-manage-tabs" aria-label=${this.l('Search tabs and change docking','搜尋分頁同更改停靠位置',true)} @click=${(event:Event)=>this.show('manage',event)}>${materialIcon('search')}</md-text-button></div><slot></slot></div></div><md-dialog @cancel=${this.cancelDialog}><div slot="headline">${this.dialog==='catalog'?this.l('New tab: choose a destination','新分頁：選擇目的地',true):this.dialog==='master'?this.l('All application windows and tabs','所有視窗同分頁',true):this.l('Tabs and groups','分頁同群組',true)}</div><div slot="content" class="results">${keyed(this.dialog,html`<settings-search data-experience-id=${`workspace-${this.dialog}-search`} .language=${this.language} .label=${this.l('Search destinations or tabs','搜尋目的地或分頁',true)} .entries=${entries} @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();if(JSON.stringify(this.catalogMatches)!==JSON.stringify(e.detail)){this.catalogMatches=e.detail;this.closePreview=[];}}}></settings-search>`)}${this.dialog==='catalog'?catalog.filter(entry=>this.catalogMatches===null||this.catalogMatches.includes(entry.id)).map(entry=>html`<md-outlined-button data-experience-id=${`workspace-catalog:${entry.id}`} ?disabled=${entry.disabled===true} @click=${async()=>{await this.close();void entry.run();}}>${materialIcon(this.destinations.find(d=>`workspace:${d.id}`===entry.id)?.icon||'open_in_new')}${entry.label}</md-outlined-button>`):this.dialog==='master'?html`<p role="status">${this.masterState}</p><md-text-button @click=${()=>this.refreshMaster()}>${this.l('Refresh actual windows','重新整理實際視窗',true)}</md-text-button>${this.masterRows.filter(row=>this.catalogMatches===null||this.catalogMatches.includes(row.id)).map(row=>html`<div class="result"><strong>${row.label}</strong><span>${row.windowId} · ${row.workspace} · ${row.group} · ${row.pinned?this.l('Pinned','已固定',true):this.l('Unpinned','未固定',true)}</span><md-text-button @click=${()=>this.activateMaster(row)}>${this.l('Open owning window and tab','開啟所屬視窗同分頁',true)}</md-text-button></div>`)}`:html`<md-outlined-select data-experience-id="workspace-edge" .label=${this.l('Tab edge','分頁位置',true)} .value=${this.edge} .displayText=${this.edgeLabel()} @change=${(e:Event)=>{this.edge=(e.target as HTMLSelectElement).value;this.save();}}>${edgeChoices.map(([v,en,zh])=>html`<md-select-option value=${v} ?selected=${this.edge===v}><div slot="headline">${this.l(en,zh)}</div></md-select-option>`)}</md-outlined-select><p>${this.l('Arrow keys move focus; Alt + arrow reorders; Alt + P pins. Closing a tab does not delete its project.','方向鍵移動焦點；Alt 加方向鍵調整次序；Alt 加 P 固定。關閉分頁唔會刪除專案。',true)}</p><label><input type="checkbox" .checked=${this.includePinned} @change=${(e:Event)=>{this.includePinned=(e.target as HTMLInputElement).checked;this.closePreview=[];}}>${this.l('Include pinned tabs in close preview','關閉預覽包括已固定分頁',true)}</label><div class="controls"><md-text-button data-experience-id="workspace-close-matching" @click=${()=>this.previewClose(false)}>${this.l('Preview close matching tabs','預覽關閉符合搜尋分頁',true)}</md-text-button><md-text-button data-experience-id="workspace-close-not-matching" @click=${()=>this.previewClose(true)}>${this.l('Preview close nonmatching tabs','預覽關閉不符合搜尋分頁',true)}</md-text-button></div>${this.closePreview.length?html`<section aria-label=${this.l('Close preview','關閉預覽',true)}><p>${this.l('Tabs to close','將關閉嘅分頁',true)}: ${this.closePreview.length}</p><ul>${this.closePreview.map(t=>html`<li>${this.tabTitle(t)} ${t.pinned?this.l('(pinned)','（已固定）',true):''}</li>`)}</ul><md-outlined-button @click=${()=>{this.removeBatch(this.closePreview);this.closePreview=[];}}>${this.l('Confirm close previewed tabs','確認關閉預覽分頁',true)}</md-outlined-button><md-text-button @click=${()=>this.closePreview=[]}>${this.l('Cancel','取消',true)}</md-text-button></section>`:nothing}${available.filter(t=>this.catalogMatches===null||this.catalogMatches.includes(t.id)).map(t=>html`<div class="result" data-experience-id=${`workspace-manage:${t.id}`}><strong>${this.tabTitle(t)}</strong><md-text-button data-control="tab-appearance" @click=${()=>this.tabAppearance(t)}>${this.l('Edit tab appearance…','編輯分頁外觀…',true)}</md-text-button><md-text-button @click=${async()=>{await this.close();this.choose(t);}}>${this.l('Open','開啟',true)}</md-text-button><md-text-button data-control="pin" @click=${()=>this.pin(t)}>${t.pinned?this.l('Unpin','取消固定',true):this.l('Pin','固定',true)}</md-text-button><md-text-button aria-label=${this.l('Move earlier','移前',true)} data-control="move-earlier" @click=${()=>this.move(t,-1)}>${materialIcon('arrow_upward')}</md-text-button><md-text-button aria-label=${this.l('Move later','移後',true)} data-control="move-later" @click=${()=>this.move(t,1)}>${materialIcon('arrow_downward')}</md-text-button><md-outlined-select .label=${this.l('Group','群組',true)} .value=${t.group} .displayText=${t.group?this.groups.find(g=>g.id===t.group)?.name??'':this.l('No group','無群組',true)} @change=${(e:Event)=>{this.tabs=this.tabs.map(x=>x===t?{...t,group:(e.target as HTMLSelectElement).value}:x);this.save();}}><md-select-option value="" ?selected=${!t.group}><div slot="headline">${this.l('No group','無群組',true)}</div></md-select-option>${this.groups.map(g=>html`<md-select-option .value=${g.id} ?selected=${t.group===g.id}><div slot="headline">${g.name}</div></md-select-option>`)}</md-outlined-select><md-text-button data-control="close-tab" ?disabled=${t.pinned} @click=${()=>this.requestClose(t)}>${this.l('Close','關閉',true)}</md-text-button></div>`)}<md-outlined-text-field data-experience-id="workspace-group-name" .label=${this.l('New group name','新群組名稱',true)} maxlength="120" .value=${this.groupName} @input=${(e:Event)=>this.groupName=(e.target as HTMLInputElement).value}></md-outlined-text-field><md-text-button ?disabled=${!this.groupName.trim()} @click=${()=>{this.groups=[...this.groups,{id:crypto.randomUUID(),name:this.groupName.trim(),collapsed:false}];this.groupName='';this.save();}}>${this.l('Create group','建立群組',true)}</md-text-button><settings-search data-experience-id="workspace-group-search" .language=${this.language} .label=${this.l('Search groups','搜尋群組',true)} .entries=${this.groups.map(g=>({id:g.id,text:g.name}))} @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();if(JSON.stringify(this.groupMatches)!==JSON.stringify(e.detail)){this.groupMatches=e.detail;this.requestUpdate();}}}></settings-search>${this.groups.filter(g=>this.groupMatches===null||this.groupMatches.includes(g.id)).map(g=>html`<div class="result"><md-outlined-text-field .label=${this.l('Group name','群組名稱',true)} .value=${g.name} maxlength="120" @change=${(e:Event)=>{const name=(e.target as HTMLInputElement).value.trim();if(name){this.groups=this.groups.map(x=>x===g?{...g,name}:x);this.save();}}}></md-outlined-text-field><md-text-button @click=${()=>{this.groups=this.groups.filter(x=>x!==g);this.tabs=this.tabs.map(t=>t.group===g.id?{...t,group:''}:t);this.save();}}>${this.l('Remove group, keep tabs','移除群組，保留分頁',true)}</md-text-button><md-text-button aria-label=${this.l('Move group earlier','群組移前',true)} @click=${()=>{const index=this.groups.indexOf(g);if(index>0){const groups=[...this.groups];[groups[index-1],groups[index]]=[groups[index],groups[index-1]];this.groups=groups;this.save();}}}>${materialIcon('arrow_upward')}</md-text-button><settings-search data-experience-id=${`workspace-group-search:${g.id}`} .language=${this.language} .label=${this.l('Search this group','搜尋此群組',true)} .entries=${available.filter(t=>t.group===g.id).map(t=>({id:t.id,text:this.tabTitle(t)}))} @settings-filter=${(e:CustomEvent)=>{e.stopPropagation();if(JSON.stringify(this.memberMatches.get(g.id))!==JSON.stringify(e.detail)){this.memberMatches.set(g.id,e.detail);this.requestUpdate();}}}></settings-search>${available.filter(t=>t.group===g.id&&(!this.memberMatches.has(g.id)||this.memberMatches.get(g.id)!.includes(t.id))).map(t=>html`<md-text-button @click=${async()=>{await this.close();this.choose(t);}}>${this.tabTitle(t)}</md-text-button>`)}</div>`)}`}</div><div slot="actions"><md-text-button @click=${()=>this.close()}>${this.l('Close','關閉',true)}</md-text-button></div></md-dialog>`;}
}
customElements.define('workspace-tabs',WorkspaceTabs);

// Handle the explicit modifier path before the global context card is installed.
document.addEventListener('contextmenu',event=>{if(!event.shiftKey)return;const target=event.composedPath().find(node=>node instanceof HTMLElement&&node.hasAttribute('data-workspace-appearance')) as HTMLElement|undefined;if(!target)return;const root=target.getRootNode();if(!(root instanceof ShadowRoot)||!(root.host instanceof WorkspaceTabs))return;event.preventDefault();event.stopImmediatePropagation();openAppearanceEditor(target,root.host.language);},true);
