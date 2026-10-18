import {html, css, type PropertyValues} from 'lit';
import {AttentionModePanel} from './attention-mode-panel';
import {localizedCopy} from './language-wording';

/** Retain the existing attention controller and actions without a permanent toolbar. */
export class GuidedShellAttention extends AttentionModePanel {
  private returnFocus?:HTMLElement;
  static styles=css`${AttentionModePanel.styles}
    :host{display:contents}
    .guided-attention[hidden]{display:none!important}
    .guided-attention{position:fixed;inset:76px 16px auto auto;width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 100px);overflow:auto;z-index:30;background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);border:1px solid var(--md-sys-color-outline-variant);border-radius:20px;padding:16px;box-shadow:0 8px 24px #0003}
    .guided-attention section{position:static;max-width:100%;max-height:none;box-shadow:none}
    .guided-attention .strip{flex-wrap:wrap}
  `;
  open(opener?:HTMLElement){this.returnFocus=opener;this.opened=true;}
  protected updated(changed:PropertyValues){
    super.updated(changed);
    if(changed.has('opened')){
      if(this.opened)this.renderRoot.querySelector<HTMLElement>('.guided-attention')?.focus();
      else this.returnFocus?.focus();
    }
  }
  render(){return html`<div class="guided-attention" ?hidden=${!this.opened} role="region" tabindex="-1" aria-label=${localizedCopy('Attention and narration','專注同旁白',this.language,true)} @keydown=${(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();this.opened=false;}}}>${super.render()}</div>`;}
}
customElements.define('guided-shell-attention',GuidedShellAttention);
