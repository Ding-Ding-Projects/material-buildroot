import {LitElement,html,css,nothing} from 'lit';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/progress/linear-progress.js';
import {localizedCopy} from './language-wording';
import {materialIcon} from './material-icons';
import {captureOwnedStatus,displayOwnedStatus} from './owned-status';
import type {HaosSummary} from '../shared/haos';

/** Builds Home Assistant OS images and the Home Assistant Material container image with the source repository's own recipe. */
export class HaosImagePanel extends LitElement{
 static properties={language:{type:String},revision:{state:true}};
 language='en';revision=0;
 private state?:HaosSummary;private pending=false;private feedback='';private defconfig='';private timer?:number;
 connectedCallback(){super.connectedCallback();void this.call('status');}
 disconnectedCallback(){super.disconnectedCallback();window.clearTimeout(this.timer);}
 private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
 private async call(action:'status'|'choose-source'|'choose-output'|'start'|'cancel',extra:{kind?:'image'|'container';defconfig?:string}={}){
  if(this.pending&&action!=='status')return;
  if(action!=='status'){this.pending=true;this.feedback='';this.revision++;}
  try{
   const reply=await window.studio?.haos?.({action,...extra});
   if(!reply?.ok||!reply.result)throw Error(reply?.code||'DESKTOP_REQUIRED');
   this.state=reply.result;
   const configs=this.state.source?.defconfigs||[];
   if(!configs.includes(this.defconfig))this.defconfig=configs.includes('ova')?'ova':configs[0]||'';
  }catch(error){
   const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'UNAVAILABLE';
   this.feedback=captureOwnedStatus(this,'feedback',this.l.bind(this),l=>l('The host did not confirm this action.','主機未有確認呢個操作。'))+' '+code;
  }finally{
   if(action!=='status')this.pending=false;
   this.revision++;
   window.clearTimeout(this.timer);
   if(this.state?.job?.state==='running')this.timer=window.setTimeout(()=>void this.call('status'),2000);
  }
 }
 private size(bytes:number){return bytes>=1024**3?`${(bytes/1024**3).toFixed(2)} GiB`:`${(bytes/1024**2).toFixed(1)} MiB`;}
 private stateLabel(state:string){return ({running:this.l('Running','執行中',true),succeeded:this.l('Finished','已完成',true),failed:this.l('Failed','失敗',true),cancelled:this.l('Cancelled','已取消',true)} as Record<string,string>)[state]||state;}
 private source(){
  const s=this.state?.source;
  if(!s)return html`<p>${this.l('Choose a repository that contains an operating-system folder with its own Buildroot tree, such as Home Assistant Material. Its own Makefile and builder container are used; nothing is written to the repository.','請揀一個有 operating-system 資料夾同自己 Buildroot 樹嘅儲存庫，例如 Home Assistant Material。會用佢自己嘅 Makefile 同建置容器，唔會寫入儲存庫。',true)}</p>`;
  return html`<dl><dt>${this.l('Repository','儲存庫',true)}</dt><dd>${s.path}</dd>
   ${s.externalName?html`<dt>${this.l('Buildroot tree','Buildroot 樹',true)}</dt><dd>${s.externalName}${s.treeVersion?` ${s.treeVersion}`:''} · ${s.defconfigs.length} ${this.l('boards','個板',true)}</dd>`:nothing}
   <dt>${this.l('Container image recipe','容器映像配方',true)}</dt><dd>${s.containerRecipe?this.l('Found','已找到',true)+(s.core?` · core ${s.core}`:''):this.l('Not in this repository','此儲存庫冇',true)}</dd></dl>`;
 }
 private job(){
  const j=this.state?.job;if(!j)return nothing;
  const running=j.state==='running';
  return html`<section class="job" aria-label=${this.l('Current image build','目前映像建置',true)}>
   <div class="row"><strong>${j.kind==='image'?this.l('Operating system image','作業系統映像',true):this.l('Container image','容器映像',true)} · ${j.label}</strong><span class="chip ${j.state}">${this.stateLabel(j.state)}</span>
    <md-outlined-button ?disabled=${!running||this.pending} @click=${()=>this.call('cancel')}>${materialIcon('stop','icon')}${this.l('Cancel build','取消建置',true)}</md-outlined-button></div>
   ${running?html`<md-linear-progress indeterminate aria-label=${this.l('Build in progress','建置進行中',true)}></md-linear-progress>`:nothing}
   <p class="muted">${this.l('Saved to','儲存到',true)} ${j.folder}${j.commit?html` · ${this.l('commit','提交',true)} <code>${j.commit.slice(0,12)}</code>`:nothing}</p>
   ${j.error?html`<p class="warning">${j.error}</p>`:nothing}
   ${j.artifacts.length?html`<ul class="files">${j.artifacts.map(a=>html`<li><strong>${a.name}</strong><span>${this.size(a.bytes)}</span><code>${a.sha256}</code></li>`)}</ul>`:nothing}
   ${j.image?html`<p>${this.l('Local image','本機映像',true)} <code>${j.label}</code> · ${this.size(j.image.bytes)} · <code>${j.image.id.slice(0,19)}</code></p>`:nothing}
   <pre tabindex="0" aria-label=${this.l('Build log','建置記錄',true)}>${j.lines.slice(-200).join('\n')}</pre>
  </section>`;
 }
 render(){
  const s=this.state,running=s?.job?.state==='running',busy=this.pending||running;
  return html`<section aria-label=${this.l('Operating system and container images','作業系統同容器映像',true)}>
   <h3>${this.l('Operating system and container images','作業系統同容器映像',true)}</h3>
   ${this.source()}
   <div class="row">
    <md-outlined-button ?disabled=${busy} @click=${()=>this.call('choose-source')}>${materialIcon('folder_open','icon')}${s?.source?this.l('Change repository','更換儲存庫',true):this.l('Choose repository','揀儲存庫',true)}</md-outlined-button>
    <md-outlined-button ?disabled=${busy} @click=${()=>this.call('choose-output')}>${materialIcon('save','icon')}${this.l('Choose output folder','揀輸出資料夾',true)}</md-outlined-button>
   </div>
   ${s?html`<p class="muted">${this.l('Output folder','輸出資料夾',true)}: ${s.output}</p>`:nothing}
   ${s?.source?.defconfigs.length?html`<div class="row">
    <md-outlined-select .label=${this.l('Board','板',true)} ?disabled=${busy} .value=${this.defconfig} @change=${(e:Event)=>{this.defconfig=(e.target as HTMLSelectElement).value;this.revision++;}}>
     ${s.source.defconfigs.map(name=>html`<md-select-option value=${name} ?selected=${name===this.defconfig}><div slot="headline">${name}</div></md-select-option>`)}
    </md-outlined-select>
    <md-filled-button ?disabled=${busy||!this.defconfig} @click=${()=>this.call('start',{kind:'image',defconfig:this.defconfig})}>${materialIcon('play_arrow','icon')}${this.l('Build operating system image','建置作業系統映像',true)}</md-filled-button>
   </div><p class="muted">${this.l('The first build of a board takes one to two hours and tens of gigabytes. Later builds reuse the compiler cache. Update bundles are signed with a one-time key unless the release key is provided.','每塊板第一次建置要一至兩個鐘同幾十 GB。之後會重用編譯快取。冇提供正式金鑰時，更新套件會用一次性金鑰簽署。',true)}</p>`:nothing}
   ${s?.source?.containerRecipe?html`<div class="row"><md-filled-button ?disabled=${busy} @click=${()=>this.call('start',{kind:'container'})}>${materialIcon('play_arrow','icon')}${this.l('Build container image locally','喺本機建置容器映像',true)}</md-filled-button><span class="muted">${this.l('Tagged home-assistant-material:local. Nothing is pushed.','標籤為 home-assistant-material:local，唔會推送。',true)}</span></div>`:nothing}
   ${this.job()}
   <p role="status">${displayOwnedStatus(this,'feedback',this.feedback,this.language)}</p>
  </section>`;
 }
 static styles=css`:host{display:block;min-width:0}h3{margin:8px 0;font-size:16px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}p{margin:8px 0;overflow-wrap:anywhere}.muted{font-size:13px;color:var(--md-sys-color-on-surface-variant)}.warning{color:var(--md-sys-color-error)}dl{display:grid;grid-template-columns:minmax(120px,1fr) 3fr;gap:6px;margin:8px 0}dt{color:var(--md-sys-color-on-surface-variant)}dd{margin:0;overflow-wrap:anywhere;min-width:0}md-outlined-button,md-filled-button{min-height:48px}md-outlined-select{min-width:180px;max-width:100%}.job{margin-top:12px;padding:16px;border-radius:16px;background:var(--md-sys-color-surface-container);min-width:0}.chip{padding:4px 12px;border-radius:8px;font-size:13px;background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}.chip.failed{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}.chip.succeeded{background:var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container)}.files{list-style:none;padding:0;margin:8px 0;display:grid;gap:6px}.files li{display:grid;grid-template-columns:minmax(0,2fr) auto;gap:4px 12px}.files code{grid-column:1/-1;font-size:12px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:20rem;overflow:auto;border:1px solid var(--md-sys-color-outline-variant);border-radius:12px;padding:12px;font-size:12px;margin:8px 0 0}code{font-family:'Roboto Mono',monospace;overflow-wrap:anywhere}@media(max-width:560px){dl{grid-template-columns:minmax(0,1fr)}}`;
}
customElements.define('haos-image-panel',HaosImagePanel);
