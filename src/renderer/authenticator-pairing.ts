import {LitElement,html,css,nothing} from 'lit';
import type {Pairing} from '../shared/authenticator';
import '@material/web/button/text-button.js';
// Transient enrollment display only. Never attach an already stored secret.
export class AuthenticatorPairing extends LitElement {
  static properties={pairing:{attribute:false},language:{type:String}};
  pairing?:Pairing; language='bilingual';
  static styles=css`:host{display:block;min-width:0}canvas{display:block;max-width:100%;height:auto;background:white;image-rendering:pixelated}code{display:block;overflow-wrap:anywhere;white-space:normal;font-size:1.1rem}p{overflow-wrap:anywhere}`;
  private l(en:string,zh:string){return this.language==='en'?en:this.language==='zh-HK'?zh:`${en} / ${zh}`;}
  updated(){const canvas=this.renderRoot.querySelector('canvas');const p=this.pairing;if(!canvas||!p)return;const ctx=canvas.getContext('2d');if(!ctx)return;const scale=4,size=(p.qr.size+8)*scale;canvas.width=size;canvas.height=size;ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';for(let y=0;y<p.qr.size;y++)for(let x=0;x<p.qr.size;x++)if(p.qr.data[y*p.qr.size+x])ctx.fillRect((x+4)*scale,(y+4)*scale,scale,scale);}
  render(){const p=this.pairing;return p?html`<p>${this.l('Temporary enrollment display. Do not record, capture or share this screen.','臨時配對畫面，請勿錄影、截圖或分享。')}</p><canvas role="img" aria-label=${this.l(`Authenticator pairing for ${p.issuer} ${p.account}; manual key and parameters follow.`,`${p.issuer} ${p.account} 驗證器配對；下方附手動金鑰同參數。`)}></canvas><p>${this.l('Manual setup key','手動設定金鑰')}</p><code>${p.secret.match(/.{1,4}/g)?.join(' ')}</code><p>${p.algorithm.toUpperCase()} · ${p.digits} ${this.l('digits','位數')} · ${p.period} ${this.l('seconds','秒')}</p><md-text-button @click=${async()=>{try{await navigator.clipboard.writeText(p.secret);this.dispatchEvent(new CustomEvent('pairing-copy',{bubbles:true,composed:true}));}catch{this.dispatchEvent(new CustomEvent('pairing-copy-unavailable',{bubbles:true,composed:true}));}}>${this.l('Copy setup key (clipboard may retain it)','複製設定金鑰（剪貼簿可能保留內容）')}</md-text-button>`:nothing;}
}
customElements.define('authenticator-pairing',AuthenticatorPairing);
