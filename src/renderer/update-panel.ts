import {LitElement, html, css, nothing} from 'lit';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/progress/linear-progress.js';
import {localizedCopy} from './language-wording';

/** One update state shared by the persistent banner and the update workspace. */
export class UpdatePanel extends LitElement {
  static properties = {language:{type:String}, compact:{type:Boolean}, state:{state:true}, notice:{state:true}, saved:{state:true}, pending:{state:true}};
  language='bilingual'; compact=false; state:any; notice=''; saved=false; pending=false;
  canRestart:()=>boolean=()=>false;
  private timer?:ReturnType<typeof setTimeout>;
  static styles=css`:host{display:block;min-width:0}section{margin:8px 16px;padding:16px;border-radius:16px;background:var(--md-sys-color-secondary-container,#e8def8);color:var(--md-sys-color-on-secondary-container,#1d192b)}h2{font:500 18px/1.4 system-ui;margin:0 0 8px}p{overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:8px}label{display:flex;align-items:center}md-linear-progress{margin:12px 0} .note{font-size:13px}button{font:inherit}`;
  private l(en:string,zh:string){return localizedCopy(en,zh,this.language,true);}
  connectedCallback(){super.connectedCallback();void this.refresh();}
  disconnectedCallback(){clearTimeout(this.timer);super.disconnectedCallback();}
  private async refresh(){try{const r=await window.studio?.operations?.({action:'updates.state'});if(r?.ok){this.state=r.result;}}catch{this.notice=this.l('Update status unavailable. Retry when the host is ready.','未能取得更新狀態，主程式就緒後請重試。');}finally{if(this.isConnected)this.timer=setTimeout(()=>void this.refresh(),2000);}}
  private async action(action:string){
    if(this.pending)return;
    if(action==='install'&&(!this.saved||this.canRestart()!==true)){this.notice=this.l('Save or discard pending edits and stop active work before restarting. Your drafts are unchanged.','請先儲存或捨棄待處理修改，同停止執行中工作。草稿維持不變。');return;}
    this.pending=true;this.notice='';
    try{const r=await window.studio?.operations?.({action:`updates.${action}`,...(action==='install'?{confirmUnsigned:true,workSaved:true}:{})});if(!r?.ok)throw Error();this.state=r.result;}
    catch{this.notice=this.l('The update action did not complete. Your existing installation is retained. Retry discovery, or reopen the current version after installer cancellation.','更新未完成，原有安裝仍然保留。請重試檢查，或取消安裝後重新開啟現有版本。');}
    finally{this.pending=false;this.saved=false;}
  }
  render(){
    const state=this.state,status=state?.status||'idle',ready=status==='unsigned-ready';
    if(this.compact&&!ready&&!['error','cancelled'].includes(status)&&!['installation-incomplete','rollback-detected','recovery-unavailable'].includes(state?.transition))return nothing;
    const labels:Record<string,[string,string]>={idle:['Waiting for background discovery','等候背景檢查'],checking:['Checking published releases','檢查已發佈版本'],current:['This version is current','已使用最新版本'],available:['Update available','有可用更新'],downloading:['Downloading update','下載更新中'],'unsigned-ready':['Unsigned update ready','未簽署更新已就緒'],'install-requested':['Installer launch requested','已要求啟動安裝程式'],cancelled:['Download paused by you','你已暫停下載'],error:['Update failed; current installation retained','更新失敗，保留現有安裝']};
    const label=labels[status]||labels.idle;
    return html`<section aria-label=${this.l('Application updates','應用程式更新')}><h2>${this.l(...label)} ${state?.release?.version||''}</h2>
      <p role="status" aria-live="polite">${this.l('Installed version','已安裝版本')}: ${state?.currentVersion||this.l('Unavailable','未能取得')}${state?.enabled===false?this.l(' · Automatic updates require the installed Windows package.',' · 自動更新需要已安裝 Windows 套件。'):''}</p>
      <p>${this.l('Updates are unsigned. HTTPS and package hashes check transfer integrity, not publisher authenticity. Downloading never restarts the application.','更新未經簽署。HTTPS 同套件摘要只檢查傳輸完整性，唔代表發行者認證。下載唔會重新啟動程式。')}</p>
      ${status==='downloading'?html`<md-linear-progress aria-label=${this.l('Download progress','下載進度')} .value=${state.total?state.received/state.total:0}></md-linear-progress><p>${state.received||0} / ${state.total||0} ${this.l('bytes','位元組')}</p>`:nothing}
      ${state?.transition&&state.transition!=='none'?html`<p>${this.l(...({updated:['The requested version is now running.','已啟動要求更新嘅版本。'],'installation-requested':['Setup was launched. Installation is not yet confirmed.','已啟動安裝，未確認完成。'],'installation-incomplete':['The expected version is not running. Setup may have been cancelled or failed; the current version remains usable.','未啟動預期版本，安裝可能已取消或失敗，現有版本仍可使用。'],'rollback-detected':['An older version is running. Automatic rollback is not performed.','正在使用較舊版本，唔會自動回復版本。'],'recovery-unavailable':['Previous update outcome could not be read.','未能讀取上次更新結果。']} as Record<string,[string,string]>)[state.transition]||['Update outcome unavailable.','未能取得更新結果。'])}</p>`:nothing}
      ${ready?html`<label><md-checkbox .checked=${this.saved} @change=${(e:Event)=>this.saved=(e.target as HTMLInputElement).checked}></md-checkbox>${this.l('All my work is saved; close this application to install.','所有工作已儲存，可以關閉本程式安裝更新。')}</label>`:nothing}
      <nav><md-outlined-button ?disabled=${this.pending||state?.enabled===false||['checking','downloading','install-requested'].includes(status)} @click=${()=>this.action('check')}>${this.l('Check for updates','檢查更新')}</md-outlined-button>
      ${['available','error','cancelled'].includes(status)&&state?.release?html`<md-outlined-button ?disabled=${this.pending} @click=${()=>this.action('download')}>${this.l('Retry download','重試下載')}</md-outlined-button>`:nothing}
      ${['checking','downloading'].includes(status)?html`<md-text-button ?disabled=${this.pending} @click=${()=>this.action('cancel')}>${this.l('Cancel background update','取消背景更新')}</md-text-button>`:nothing}
      ${ready?html`<md-filled-button ?disabled=${this.pending||!this.saved} @click=${()=>this.action('install')}>${this.l('Restart to install update','重新啟動程式以安裝更新')}</md-filled-button><md-text-button ?disabled=${this.pending} @click=${()=>this.action('later')}>${this.l('Later','稍後')}</md-text-button>`:nothing}
      ${state?.release?html`<md-text-button @click=${()=>this.action('notes')}>${this.l('Release notes','版本說明')}</md-text-button>`:nothing}</nav>
      ${state?.later?html`<p class="note">${this.l('Update deferred. The ready reminder stays here until you choose to install.','更新已延後，提醒會保留至你選擇安裝。')}</p>`:nothing}
      <p role="status" aria-live="polite">${this.notice}</p></section>`;
  }
}
customElements.define('update-panel',UpdatePanel);
