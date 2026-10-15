import {LitElement, html, css, nothing} from 'lit';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/dialog/dialog.js';
import type {Language, StudioBootstrap, OperationRequest, WindowCommand} from '../shared/api';

type ConnectionState = 'loading' | 'ready' | 'unavailable';
type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'failed' | 'unknown' | 'refresh-unavailable' | 'discarded';

/** Production composite: Material Web controls with semantic internal anatomy. */
class MaterialBuildroot extends LitElement {
 static properties={state:{state:true},route:{state:true},connection:{state:true},saveState:{state:true},windowNotice:{state:true},theme:{state:true},dark:{state:true},draft:{state:true}};
 declare state:StudioBootstrap|undefined;route='projects';connection:ConnectionState='loading';saveState:SaveState='idle';windowNotice=false;theme='system';dark=false;draft:Language='bilingual';
 private media=matchMedia('(prefers-color-scheme: dark)');private unsubscribe?:()=>void;private opener?:HTMLElement;private dialogDestination=false;
 private mediaChanged=()=>{this.dark=this.theme==='dark'||(this.theme==='system'&&this.media.matches);};
 static styles=css`
 :host{display:block;height:100%;font-family:Segoe UI,Arial,'Microsoft JhengHei',sans-serif;--md-sys-color-primary:#6750a4;--md-sys-color-on-primary:#fff;--md-sys-color-primary-container:#eaddff;--md-sys-color-on-primary-container:#21005d;--md-sys-color-surface:#fef7ff;--md-sys-color-on-surface:#1d1b20;--md-sys-color-on-surface-variant:#49454f;--md-sys-color-outline:#79747e;--md-sys-color-outline-variant:#cac4d0;--md-sys-color-secondary-container:#e8def8;--md-sys-color-on-secondary-container:#1d192b;color:var(--md-sys-color-on-surface)}
 .shell{color:var(--md-sys-color-on-surface);height:100%;display:flex;flex-direction:column;background:var(--md-sys-color-surface)}
 .dark{--md-sys-color-primary:#d0bcff;--md-sys-color-on-primary:#381e72;--md-sys-color-primary-container:#4f378b;--md-sys-color-on-primary-container:#eaddff;--md-sys-color-surface:#141218;--md-sys-color-on-surface:#e6e0e9;--md-sys-color-on-surface-variant:#cac4d0;--md-sys-color-outline:#938f99;--md-sys-color-outline-variant:#49454f;--md-sys-color-secondary-container:#4a4458;--md-sys-color-on-secondary-container:#e8def8;color-scheme:dark}
 header{display:flex;align-items:center;flex-wrap:wrap;gap:12px;min-height:64px;padding:12px 20px;border-bottom:1px solid var(--md-sys-color-outline-variant);-webkit-app-region:drag}
 .brand{flex:1;min-width:180px}.brand strong{font-size:20px}.provenance{font-size:12px;margin-top:4px;overflow-wrap:anywhere;color:var(--md-sys-color-on-surface-variant)}
 md-filled-button,md-outlined-button,md-text-button,md-outlined-select{font-family:inherit;-webkit-app-region:no-drag;max-width:100%;min-height:48px} .window{display:flex;gap:4px;-webkit-app-region:no-drag}.window md-text-button{min-width:48px}
 .body{display:flex;flex:1;min-height:0}nav{width:224px;box-sizing:border-box;padding:20px 12px;display:flex;flex-direction:column;gap:12px;border-right:1px solid var(--md-sys-color-outline-variant);overflow:auto}nav md-filled-button,nav md-outlined-button{width:100%}
 main{flex:1;min-width:0;overflow:auto;padding:24px;box-sizing:border-box}h1{font-size:28px;line-height:1.3;margin:0 0 8px;overflow-wrap:anywhere}h2{font-size:20px;margin:0 0 12px}p{line-height:1.6;max-width:76ch;overflow-wrap:anywhere}.subtitle{color:var(--md-sys-color-on-surface-variant);margin:0 0 24px}
 .panel{border:1px solid var(--md-sys-color-outline-variant);border-radius:24px;padding:24px;margin-bottom:20px}.empty{min-height:240px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}.eyebrow{font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--md-sys-color-primary)}.row{display:flex;flex-wrap:wrap;gap:16px;align-items:center}.stack{display:flex;flex-direction:column;gap:16px;max-width:650px}.stack md-outlined-select{width:100%}.status{color:var(--md-sys-color-on-secondary-container);min-height:24px;border-radius:12px;background:var(--md-sys-color-secondary-container);padding:12px 16px;overflow-wrap:anywhere}.muted{color:var(--md-sys-color-on-surface-variant)}.menu{display:none} .navlabel{display:inline}.navsymbol{display:none;font-size:18px}md-dialog{max-width:calc(100vw - 32px);--md-dialog-container-color:var(--md-sys-color-surface)}.dialog-nav{display:flex;flex-direction:column;gap:12px}
 :focus-visible{outline:3px solid var(--md-sys-color-primary);outline-offset:4px}h1:focus{outline:none}
 md-outlined-button.selected{--md-outlined-button-container-color:var(--md-sys-color-secondary-container);--md-outlined-button-label-text-color:var(--md-sys-color-on-secondary-container);background:var(--md-sys-color-secondary-container);border-radius:var(--md-outlined-button-container-shape,999px);font-weight:700}
 @media(max-width:1199px){nav{width:72px;padding:16px 8px}.navlabel{display:none}.navsymbol{display:inline}nav md-filled-button,nav md-outlined-button{min-width:48px;--md-filled-button-container-shape:16px;--md-outlined-button-container-shape:16px}main{padding:16px}}
 @media(max-width:699px){nav{display:none}.menu{display:inline-flex}header{padding:12px}.panel{padding:16px}h1{font-size:24px}.window{margin-left:auto}}
 @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto;animation:none;transition:none}}
 `;
 connectedCallback(){super.connectedCallback();this.media.addEventListener('change',this.mediaChanged);this.mediaChanged();void this.load();}
 disconnectedCallback(){this.unsubscribe?.();this.media.removeEventListener('change',this.mediaChanged);super.disconnectedCallback();}
 private l(en:string,zh:string){const language=this.state?.language??'bilingual';return language==='en'?en:language==='zh-HK'?zh:`${en} · ${zh}`;}
 private buildTime(){const value=this.state?.updatedAt;if(!value||!Number.isFinite(Date.parse(value)))return this.l('Unavailable','未能取得');try{const locale=this.state?.language==='zh-HK'?'zh-HK':'en-CA';const formatter=new Intl.DateTimeFormat(locale,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZoneName:'longOffset'});return formatter.format(new Date(value))+' ('+formatter.resolvedOptions().timeZone+')';}catch{return this.l('Unavailable','未能取得');}}
 private get busy(){return this.saveState==='saving';}
 private get canSave(){return this.connection==='ready'&&this.state?.storage==='ready'&&!this.busy&&this.saveState!=='unknown'&&this.saveState!=='refresh-unavailable';}
 private get canDiscard(){return this.canSave&&this.draft!==this.state?.language;}
 private languageName(language:Language){return language==='en'?'English':language==='zh-HK'?'香港粵語':'English + 香港粵語';}
 private confirmedPreference(){
  if(this.connection!=='ready'||this.state?.storage!=='ready')return nothing;
  const origin=this.state.origin==='default'?this.l('Application default','應用程式預設'):this.state.origin==='saved'?this.l('Saved on this device','已儲存喺呢部電腦'):this.l('Origin unavailable','未能取得來源');
  return html`<p class="muted" id="confirmed-language">${this.l('Last confirmed language','上次確認嘅語言')}: ${this.languageName(this.state.language)}. ${origin}.</p>`;
 }
 private async discardLanguage(){
  if(!this.state||!this.canDiscard)return;
  this.draft=this.state.language;
  this.saveState='discarded';
  this.windowNotice=false;
  await this.updateComplete;
  this.renderRoot.querySelector<HTMLElement>('md-outlined-select')?.focus();
 }
 private applyBootstrap(state:StudioBootstrap,resetDraft=false){
  this.state=state;
  this.connection='ready';
  if(resetDraft)this.draft=state.language;
  document.documentElement.lang=state.language==='en'?'en':'zh-HK';
 }
 private async load(){
  try{
   this.applyBootstrap(await window.studio.bootstrap(),true);
   this.unsubscribe?.();
   this.unsubscribe=window.studio.onEvent(()=>{/* Transaction results, not notifications, determine the displayed saved state. */});
  }catch{this.connection='unavailable';}
 }
 private async controlWindow(command:WindowCommand){
  try{this.windowNotice=!(await window.studio.windowControl(command));}
  catch{this.windowNotice=true;}
 }
 private storageMessage(){
  if(this.connection==='loading')return this.l('Loading saved preferences…','正在載入已儲存嘅偏好設定…');
  if(this.connection==='unavailable')return this.l('Desktop connection unavailable. Restart the application to reconnect.','未能連接桌面服務。請重新啟動應用程式再連接。');
  return this.state?.storage==='ready'?this.l('Local storage ready.','本機儲存已就緒。'):this.l('Local storage unavailable. Existing data is preserved; saving is disabled.','未能使用本機儲存。現有資料已保留，暫停儲存。');
 }
 private statusMessage(){
  if(this.saveState==='saving')return this.l('Saving language…','正在儲存語言…');
  if(this.saveState==='unknown')return this.l('Save outcome unavailable. Saving is disabled until you restart the application and review the saved language.','未能確認儲存結果。請重新啟動應用程式並檢視已儲存嘅語言，先可以再儲存。');
  if(this.saveState==='refresh-unavailable')return this.l('The save was rejected, and current settings could not be loaded. Restart the application before saving again.','儲存要求已被拒絕，亦未能載入目前設定。請重新啟動應用程式再儲存。');
  if(this.windowNotice)return this.l('The window action could not be completed. Press Alt+F4 if you need to close the application.','未能完成視窗操作。如要關閉應用程式，請按 Alt+F4。');
  if(this.connection!=='ready'||this.state?.storage!=='ready')return this.storageMessage();
  if(this.saveState==='saved')return this.l('Language saved on this device.','語言已儲存喺呢部電腦。');
  if(this.saveState==='discarded')return this.l('Pending choice reset to the last confirmed language.','已將待儲存嘅選擇還原為上次確認嘅語言。');
  if(this.saveState==='conflict')return this.l('Settings changed since this screen loaded. Your choice is retained; review it and Save again.','設定已經改咗。已保留你嘅選擇，請檢視後再儲存。');
  if(this.saveState==='failed')return this.l('Language was not saved. The previous saved setting remains in use.','語言未能儲存，繼續使用之前嘅設定。');
  return this.draft!==this.state.language?this.l('You have an unsaved language choice.','你有未儲存嘅語言選擇。'):this.l('No operation in progress.','目前冇操作進行中。');
 }
 private async navigate(route:string){this.route=route;await this.updateComplete;this.renderRoot.querySelector<HTMLElement>('h1')?.focus();}
 private async saveLanguage(){
  if(!this.state||!this.canSave)return;
  this.saveState='saving';this.windowNotice=false;
  const desired=this.draft;
  let request:OperationRequest={version:1,operationId:crypto.randomUUID(),projectId:this.state.projectId,capability:this.state.capability,expectedRevision:this.state.revision,action:'settings.setLanguage',arguments:{language:desired}};
  let rejected=false;
  try{
   let result=await window.studio.request(request);
   rejected=!result.ok;
   if(!result.ok&&result.code==='UNAUTHORIZED'){
    const current=await window.studio.bootstrap();
    this.applyBootstrap(current);
    if(current.storage!=='ready'){this.saveState='failed';return;}
    if(current.revision!==request.expectedRevision){this.saveState='conflict';return;}
    request={...request,capability:current.capability};
    rejected=false;
    result=await window.studio.request(request);
    rejected=!result.ok;
   }
   if(result.ok){
    this.applyBootstrap({...this.state,language:desired,revision:result.revision,origin:'saved'});
    this.saveState='saved';
   }else if(result.code==='STALE_REVISION'){
    this.applyBootstrap(await window.studio.bootstrap());
    this.saveState='conflict';
   }else this.saveState='failed';
  }catch{this.saveState=rejected?'refresh-unavailable':'unknown';}
 }
 private options(items:[string,string][]){return items.map(([value,label])=>html`<md-select-option value=${value}><div slot="headline">${label}</div></md-select-option>`);}
 private navigation(dialog=false){return html`${(['projects','settings'] as const).map((route,index)=>{const label=route==='projects'?this.l('Projects','專案'):this.l('Settings','設定');return html`<md-outlined-button class=${this.route===route?'selected':''} aria-label=${this.route===route?`${label}, ${this.l('current workspace','目前工作區')}`:label} @click=${async()=>{if(dialog){this.dialogDestination=true;const d=this.renderRoot.querySelector<any>('md-dialog');d?.close();}await this.navigate(route);}}><span class=${dialog?'':'navsymbol'} aria-hidden="true">${dialog?'':index===0?'▦':'⚙'}</span><span class=${dialog?'':'navlabel'}>${label}</span></md-outlined-button>`;})}`;}
 render(){return html`<div class="shell ${this.dark?'dark':''}"><header><md-text-button class="menu" aria-label=${this.l('Open navigation','開啟導覽')} @click=${(e:Event)=>{this.dialogDestination=false;this.opener=e.currentTarget as HTMLElement;this.renderRoot.querySelector<any>('md-dialog')?.show();}}>☰</md-text-button><div class="brand"><strong>Material Buildroot</strong><div class="provenance">${this.l('Version','版本')} ${this.state?.version??this.l('Unavailable','未能取得')} · ${this.l('Updated','更新時間')}: ${this.buildTime()}</div><div class="provenance">${this.l('Source','來源')}: ${this.state?.source??this.l('Unavailable','未能取得')}</div></div><div class="window">${(['minimize','maximize-restore','close'] as const).map((command,index)=>html`<md-text-button aria-label=${[this.l('Minimize','最小化'),this.l('Maximize or restore','最大化或還原'),this.l('Close application','關閉應用程式')][index]} ?disabled=${!window.studio} @click=${()=>void this.controlWindow(command)}>${['−','□','×'][index]}</md-text-button>`)}</div></header><div class="body"><nav aria-label=${this.l('Workspace navigation','工作區導覽')}>${this.navigation()}</nav><main><h1 tabindex="-1">${this.route==='settings'?this.l('Settings','設定'):this.l('Projects','專案')}</h1><p class="subtitle">${this.route==='settings'?this.l('Local preferences for this desktop workspace.','呢個桌面工作區嘅本機偏好設定。'):this.l('Your Buildroot workspace starts here.','由呢度開始你嘅 Buildroot 工作區。')}</p>${this.route==='settings'?html`<section class="panel stack" aria-busy=${this.connection==='loading'||this.busy}><h2>${this.l('Language','語言')}</h2><p>${this.l('Bilingual is the default. A successful save persists across application restarts.','預設使用雙語。成功儲存後，重新啟動都會保留。')}</p>${this.confirmedPreference()}<md-outlined-select .label=${this.l('Interface language','介面語言')} .value=${this.draft} ?disabled=${!this.canSave} @change=${(e:Event)=>{this.draft=(e.target as HTMLSelectElement).value as Language;if(this.saveState!=='unknown'&&this.saveState!=='refresh-unavailable')this.saveState='idle';this.windowNotice=false;}}>${this.options([['en','English'],['zh-HK','香港粵語'],['bilingual','English + 香港粵語']])}</md-outlined-select><div class="row" role="group" aria-label=${this.l('Language actions','語言操作')} aria-describedby="save-feedback"><md-filled-button ?disabled=${!this.canSave} @click=${this.saveLanguage}>${this.busy?this.l('Saving…','儲存中…'):this.l('Save language','儲存語言')}</md-filled-button><md-text-button ?disabled=${!this.canDiscard} @click=${this.discardLanguage}>${this.l('Discard choice','放棄選擇')}</md-text-button></div><p class="muted">${this.storageMessage()}</p><p id="save-feedback">${this.statusMessage()}</p></section><section class="panel stack"><h2>${this.l('Appearance','外觀')}</h2><md-outlined-select .label=${this.l('Theme for this session','今次工作階段嘅主題')} .value=${this.theme} .displayText=${this.theme==='light'?this.l('Light','淺色'):this.theme==='dark'?this.l('Dark','深色'):this.l('Follow system','跟隨系統')} @change=${(e:Event)=>{this.theme=(e.target as HTMLSelectElement).value;this.mediaChanged();}}>${this.options([['system',this.l('Follow system','跟隨系統')],['light',this.l('Light','淺色')],['dark',this.l('Dark','深色')]])}</md-outlined-select><p class="muted">${this.l('Theme resets to the system preference on restart. Persistent appearance settings are not implemented yet.','重新啟動後會跟隨系統。持久外觀設定仍未實作。')}</p></section>`:html`<section class="panel empty"><span class="eyebrow">${this.l('EMPTY WORKSPACE','空白工作區')}</span><h2>${this.l('No projects connected','未有已連接專案')}</h2><p>${this.l('Project creation, source discovery and build execution are not connected in this desktop slice. No host has been scanned and no build has been started.','呢個桌面版本仍未連接專案建立、來源探索同建置執行。未掃描主機，亦未開始建置。')}</p><md-filled-button @click=${()=>void this.navigate('settings')}>${this.l('Open Settings','開啟設定')}</md-filled-button></section><section class="panel"><h2>${this.l('Available now','目前可用')}</h2><p>${this.l('Choose and save your interface language, inspect build provenance, and control the desktop window.','選擇並儲存介面語言、查看建置來源，同埋控制桌面視窗。')}</p></section>`}<div class="status" role="status" aria-live="polite">${this.statusMessage()}</div></main></div><md-dialog @closed=${()=>{if(this.dialogDestination)this.renderRoot.querySelector<HTMLElement>('h1')?.focus();else this.opener?.focus();}}><div slot="headline">${this.l('Navigation','導覽')}</div><div slot="content" class="dialog-nav">${this.navigation(true)}</div><div slot="actions"><md-text-button autofocus @click=${()=>this.renderRoot.querySelector<any>('md-dialog')?.close()}>${this.l('Close','關閉')}</md-text-button></div></md-dialog></div>`;}
}
customElements.define('material-buildroot',MaterialBuildroot);
