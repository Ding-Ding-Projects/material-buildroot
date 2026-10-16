import { LitElement, html, css } from 'lit';
import '@material/web/dialog/dialog.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/slider/slider.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';

export type DestructiveChallenge = {id:string;operation:string;destination:string;keys:[string,string];expires:number;rebuildRequired:boolean};
export type DestructiveProof = {id:string;firstKey:string;secondKey:string;slider:number;rebuildConsent:boolean};
type Dialog = HTMLElement & {show:()=>Promise<void>;close:()=>Promise<void>};

/** One ephemeral dialog per action. Nothing is persisted or sent before approval. */
export class DestructiveConfirmation extends LitElement {
  static properties = {language:{type:String},challenge:{attribute:false},first:{state:true},second:{state:true},progress:{state:true},rebuild:{state:true},expired:{state:true}};
  language='en'; challenge!:DestructiveChallenge;
  first=false;second=false;progress=0;rebuild=false;expired=false;
  private finish:((proof:DestructiveProof|null)=>void)|undefined;
  private timeout?:ReturnType<typeof setTimeout>;
  private origin?:HTMLElement;
  private outcome:DestructiveProof|null=null;
  static styles=css`
    :host{font-family:inherit;color:inherit} md-dialog{max-width:min(36rem,calc(100vw - 24px));--md-dialog-container-color:var(--md-sys-color-surface-container-high)}
    .content{display:grid;gap:16px;min-width:0} p{margin:0;overflow-wrap:anywhere} code{overflow-wrap:anywhere;white-space:pre-wrap}
    label{display:flex;align-items:center;gap:12px;min-height:48px;cursor:pointer} md-slider{width:100%}
    .meter{height:12px;border-radius:6px;overflow:hidden;background:var(--md-sys-color-surface-variant)}
    .fill{height:100%;background:var(--md-sys-color-error);transition:width .18s ease-out;transform-origin:left}
    .complete{animation:authorize .4s ease-out} @keyframes authorize{50%{transform:scaleY(1.8)}}
    :focus-visible{outline:3px solid var(--md-sys-color-primary);outline-offset:3px}
    @media(prefers-reduced-motion:reduce){.fill{transition:none}.complete{animation:none}}
  `;
  private l(en:string,zh:string){return this.language==='en'?en:this.language==='zh-HK'?zh:en+' / '+zh;}
  async request(origin?:HTMLElement):Promise<DestructiveProof|null>{
    this.origin=origin;
    const result=new Promise<DestructiveProof|null>(resolve=>this.finish=resolve);
    await this.updateComplete;
    if(!this.isConnected){this.settle(null);return result;}
    this.timeout=setTimeout(()=>{this.expired=true;this.progress=0;},Math.max(0,this.challenge.expires-Date.now()));
    await (this.renderRoot.querySelector('md-dialog') as Dialog).show();
    return result;
  }
  disconnectedCallback(){super.disconnectedCallback();this.settle(null);}
  private settle(proof:DestructiveProof|null){
    clearTimeout(this.timeout);
    const finish=this.finish;this.finish=undefined;
    finish?.(proof);
    if(this.origin?.isConnected)this.origin.focus();
  }
  private async close(approve=false){
    const ready=approve&&!this.expired&&Date.now()<this.challenge.expires&&this.first&&this.second&&this.progress===100&&(!this.challenge.rebuildRequired||this.rebuild);
    const proof=ready?{id:this.challenge.id,firstKey:this.challenge.keys[0],secondKey:this.challenge.keys[1],slider:1,rebuildConsent:this.rebuild}:null;
    this.outcome=proof;
    await (this.renderRoot.querySelector('md-dialog') as Dialog).close();
    this.settle(proof);
  }
  private key(which:'first'|'second',event:Event){this[which]=(event.target as HTMLInputElement).checked;this.progress=0;}
  render(){
    if(!this.challenge)return html``;
    const ready=this.first&&this.second&&!this.expired;
    return html`<md-dialog @cancel=${(event:Event)=>{event.preventDefault();void this.close();}} @closed=${()=>this.settle(this.outcome)}>
      <div slot="headline">${this.l('Confirm clean build output','確認清除建置輸出')}</div>
      <div slot="content" class="content">
        <p>${this.l('Operation','操作')}: <code>${this.challenge.operation}</code></p>
        <p>${this.l('Exact affected output directory','確切受影響輸出目錄')}: <code>${this.challenge.destination}</code></p>
        <p>${this.l('This runs the fixed Buildroot clean target in this output directory. Generated build output is removed. Source files and configuration are retained by the clean target. Removed output cannot be restored by undo.','此操作會喺此輸出目錄執行固定嘅 Buildroot clean 目標，移除產生嘅建置輸出。clean 目標會保留原始碼同設定。已移除輸出無法復原。')}</p>
        <label><md-checkbox ?checked=${this.first} ?disabled=${this.expired} @change=${(e:Event)=>this.key('first',e)} aria-label=${this.l('Key one: affected destination reviewed','第一把鎖：已核對受影響位置')}></md-checkbox>${this.l('Key one: I reviewed the exact destination.','第一把鎖：已核對確切位置。')}</label>
        <label><md-checkbox ?checked=${this.second} ?disabled=${this.expired} @change=${(e:Event)=>this.key('second',e)} aria-label=${this.l('Key two: output removal authorized','第二把鎖：授權移除輸出')}></md-checkbox>${this.l('Key two: I authorize removal of generated output.','第二把鎖：授權移除產生嘅輸出。')}</label>
        <label><md-checkbox ?checked=${this.rebuild} ?disabled=${this.expired} @change=${(e:Event)=>{this.rebuild=(e.target as HTMLInputElement).checked;this.progress=0;}} aria-label=${this.l('Acknowledge separate rebuild consent','確認另行授權重建')}></md-checkbox>${this.l('I consent to cleaning this output and understand the next build must rebuild it. This action never starts that rebuild automatically.','同意清除此輸出，並明白下次建置需要重新產生輸出。此操作絕不會自動啟動重建。')}</label>
        <md-slider min="0" max="100" step="1" .value=${this.progress} ?disabled=${!ready||!this.rebuild} labeled aria-label=${this.l('Move confirmation to one hundred percent','將確認滑桿移至百分之一百')} @input=${(e:Event)=>{if(ready&&this.rebuild)this.progress=Number((e.target as HTMLInputElement).value);}}></md-slider>
        <div class="meter" aria-hidden="true"><div class=${this.progress===100?'fill complete':'fill'} style=${'width:'+this.progress+'%'}></div></div>
        <p role="status">${this.expired?this.l('Confirmation expired. Cancel and request again.','確認已過期，請取消並重新要求。'):this.progress===100?this.l('Authorization ready. Confirm to queue the clean target.','授權準備完成，按確認以排入清除目標。'):this.l('Both keys and the full slider are required.','必須操作兩把鎖並完成滑桿。')}</p>
      </div>
      <div slot="actions"><md-text-button @click=${()=>this.close()}>${this.l('Emergency exit','緊急退出')}</md-text-button><md-filled-button ?disabled=${!ready||!this.rebuild||this.progress!==100} @click=${()=>this.close(true)}>${this.l('Queue clean target','排入清除目標')}</md-filled-button></div>
    </md-dialog>`;
  }
}
customElements.define('destructive-confirmation',DestructiveConfirmation);

export async function requestDestructiveConfirmation(host:HTMLElement,language:string,challenge:DestructiveChallenge,origin?:HTMLElement):Promise<DestructiveProof|null>{
  let active:Element|null=document.activeElement;
  while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;
  const dialog=document.createElement('destructive-confirmation') as DestructiveConfirmation;
  dialog.language=language;dialog.challenge=challenge;
  (host.shadowRoot??host).append(dialog);
  try{return await dialog.request(origin??(active instanceof HTMLElement?active:undefined));}
  finally{dialog.remove();}
}
