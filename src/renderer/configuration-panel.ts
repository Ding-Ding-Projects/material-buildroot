import {LitElement, html, nothing, css} from 'lit';
import '@material/web/switch/switch.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';

type Change = {type:string; value:unknown};
/** A single ordered queue owns the revision used by every configuration edit. */
export class ConfigurationPanel extends LitElement {
  static properties={config:{attribute:false},api:{attribute:false},workspaceId:{type:String},domain:{type:String},language:{type:String},busy:{state:true},drafts:{state:true},diff:{state:true},notice:{state:true},page:{state:true}};
  config:any; api:any; workspaceId=''; domain='buildroot'; language='bilingual'; busy=false;
  drafts:Record<string,Change>={}; diff:any[]=[]; notice=''; page=0;
  private queue:Array<{symbol?:string;change?:Change;undo?:boolean}>=[];
  private stopped=false;
  static styles=css`:host{display:block;min-width:0}.row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--md-sys-color-outline-variant)}.description{flex:1;min-width:180px}.symbol{overflow-wrap:anywhere;font-family:monospace}md-outlined-text-field{max-width:100%;width:280px}p{overflow-wrap:anywhere}table{width:100%;table-layout:fixed;border-collapse:collapse}td,th{text-align:left;overflow-wrap:anywhere;padding:8px;border-bottom:1px solid var(--md-sys-color-outline-variant)}`;
  private l(en:string,zh:string){return this.language==='en'?en:this.language==='yue'?zh:`${en} · ${zh}`;}
  private entries(){const entries:any[]=[];const seen=new Set<string>();const walk=(node:any,menus:string[])=>{const next=node.kind==='menu'&&node.prompt?[...menus,node.prompt]:menus;if(node.symbol&&!seen.has(node.symbol)){seen.add(node.symbol);entries.push({...node,menu:next.join(' / ')});}for(const child of node.children||[])walk(child,next);};if(this.config?.semantics?.available)walk(this.config.semantics.tree,[]);return entries;}
  private signal(){this.dispatchEvent(new CustomEvent('configuration-queue',{bubbles:true,composed:true,detail:{pending:this.busy||this.queue.length>0,blocked:this.stopped}}));}
  private enqueue(symbol:string,change:Change){this.drafts={...this.drafts,[symbol]:change};this.queue.push({symbol,change});this.signal();void this.drain();}
  private async drain(){
    if(this.busy||this.stopped||!this.api||!this.config)return;
    this.busy=true;this.signal();
    const workspaceId=this.workspaceId,domain=this.domain;
    try{
      while(this.queue.length){
        const item=this.queue[0];
        const reply=await this.api({action:item.undo?'config.undo':'config.apply',workspaceId,domain,revision:this.config.revision,...(item.undo?{}:{changes:{[item.symbol!]:item.change}})});
        if(!reply.ok){this.notice=this.l('Reconciliation stopped; queued edits are retained. Inspect permission or external changes, then retry.','協調已停止，保留排隊編輯。請核對權限或外部變更，再重試。')+' '+reply.code;this.stopped=true;break;}
        this.queue.shift();this.diff=reply.result.diff||[];
        this.config={...this.config,...reply.result};
        if(item.symbol&&!this.queue.some(next=>next.symbol===item.symbol)){const drafts={...this.drafts};delete drafts[item.symbol];this.drafts=drafts;}
        this.dispatchEvent(new CustomEvent('configuration-result',{bubbles:true,composed:true,detail:this.config}));
        this.notice=this.l('Configuration reconciled. Requested and effective differences are shown below.','設定已協調，下方顯示要求值同實際值差異。');
      }
    }catch{this.stopped=true;this.notice=this.l('Outcome unavailable. Inspect current configuration before retrying; no automatic replay was attempted.','未能確認結果。重試前請檢視目前設定，未有自動重播。');}
    finally{this.busy=false;this.signal();}
  }
  private async retry(){if(this.busy)return;this.busy=true;this.signal();try{const reply=await this.api({action:'config.inspect',workspaceId:this.workspaceId,domain:this.domain});if(!reply.ok){this.notice=reply.code;return;}this.config=reply.result;this.dispatchEvent(new CustomEvent('configuration-result',{bubbles:true,composed:true,detail:this.config}));this.stopped=false;}finally{this.busy=false;this.signal();}void this.drain();}
  private undo(){this.queue.push({undo:true});this.signal();void this.drain();}
  render(){const entries=this.entries();return html`
    <p>${this.l('Each completed field edit queues reconciliation immediately. Undo runs after all earlier queued edits.','每次完成欄位編輯會即時排隊協調，復原會喺較早編輯之後執行。')}</p>
    ${entries.slice(this.page*30,this.page*30+30).map(entry=>{const value=this.drafts[entry.symbol]?.value??entry.value;const disabled=this.stopped||entry.visibility===0||(['bool','tristate'].includes(entry.type)&&!entry.assignable?.length);return html`<div class="row"><div class="description"><strong class="symbol">${entry.symbol}</strong><p>${entry.prompt||''}</p><small>${entry.menu}</small><details><summary>${this.l('Help and dependencies','說明同相依關係')}</summary><p>${entry.help||this.l('No help supplied.','未提供說明。')}</p><p class="symbol">${entry.dependency}</p>${entry.ranges?.map((r:any)=>html`<p>${r.min} … ${r.max} (${r.condition})</p>`)}</details></div>
    ${entry.type==='bool'?html`<md-switch aria-label=${entry.symbol} ?disabled=${disabled||entry.assignable?.length===1} .selected=${value===true||value==='y'} @change=${(e:Event)=>this.enqueue(entry.symbol,{type:'bool',value:(e.target as any).selected})}></md-switch>`:entry.type==='tristate'?html`<md-outlined-select label=${entry.symbol} ?disabled=${disabled||entry.assignable?.length===1} .value=${String(value)} @change=${(e:Event)=>this.enqueue(entry.symbol,{type:'tristate',value:(e.target as any).value})}>${[['n',0],['m',1],['y',2]].map(([v,n])=>html`<md-select-option value=${String(v)} ?disabled=${!entry.assignable?.includes(n)}><div slot="headline">${v}</div></md-select-option>`)}</md-outlined-select>`:['string','int','hex'].includes(entry.type)?html`<md-outlined-text-field label=${entry.symbol} ?disabled=${disabled} .value=${String(value)} supporting-text=${entry.type==='int'?this.l('Signed decimal integer','帶正負號十進位整數'):entry.type==='hex'?this.l('Hexadecimal beginning with 0x','以 0x 開頭嘅十六進位數'):this.l('Text value','文字值')} @change=${(e:Event)=>{const field=e.target as any;const text=field.value;const valid=entry.type==='int'?/^-?\d+$/.test(text):entry.type==='hex'?/^0x[\da-f]+$/i.test(text):!/[\x00-\x1f\x7f]/.test(text);field.error=!valid;if(valid)this.enqueue(entry.symbol,{type:entry.type,value:text});}}></md-outlined-text-field>`:html`<span>${String(value)}</span>`}</div>`;})}
    <div class="row"><md-text-button ?disabled=${this.page===0} @click=${()=>this.page--}>${this.l('Previous','上一頁')}</md-text-button><span>${this.page+1} / ${Math.max(1,Math.ceil(entries.length/30))}</span><md-text-button ?disabled=${(this.page+1)*30>=entries.length} @click=${()=>this.page++}>${this.l('Next','下一頁')}</md-text-button><md-outlined-button ?disabled=${this.stopped||(!this.busy&&!this.queue.length&&!this.config?.undoDepth)} @click=${this.undo}>${this.l('Queue undo','排隊復原')}</md-outlined-button></div>
    <p role="status" aria-live="polite">${this.notice} ${this.busy?this.l('Reconciling','協調中'):''} ${this.queue.length?`${this.queue.length} ${this.l('queued','項排隊中')}`:''}</p>
    ${this.stopped?html`<md-outlined-button @click=${this.retry} ?disabled=${this.busy}>${this.l('Inspect and retry retained queue','檢視並重試保留佇列')}</md-outlined-button><md-text-button ?disabled=${this.busy} @click=${()=>{this.queue=[];this.drafts={};this.stopped=false;this.signal();}}>${this.l('Discard retained queue','放棄保留佇列')}</md-text-button>`:nothing}
    ${this.diff.length?html`<h3>${this.l('Requested / effective differences','要求／實際值差異')}</h3><table><thead><tr><th>${this.l('Symbol','符號')}</th><th>${this.l('Requested','要求')}</th><th>${this.l('Effective','實際')}</th></tr></thead><tbody>${this.diff.map(row=>html`<tr><td>${row.symbol}</td><td>${String(row.requested??this.l('Absent','不存在'))}</td><td>${String(row.effective??this.l('Absent','不存在'))}</td></tr>`)}</tbody></table>`:nothing}`;}
}
customElements.define('configuration-panel',ConfigurationPanel);
