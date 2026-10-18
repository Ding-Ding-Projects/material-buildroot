import {html, css, nothing, type PropertyValues} from 'lit';
import {AttentionModePanel} from './attention-mode-panel';
import {localizedCopy} from './language-wording';
import './guided-shell-dim-sum';

/** Retain the existing attention controller and actions without a permanent toolbar. */
export class GuidedShellAttention extends AttentionModePanel {
  private returnFocus?:HTMLElement;
  private escape=(event:KeyboardEvent)=>{if(this.opened&&event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();this.opened=false;}};
  connectedCallback(){super.connectedCallback();document.addEventListener('keydown',this.escape);}
  disconnectedCallback(){document.removeEventListener('keydown',this.escape);super.disconnectedCallback();}
  static styles=css`${AttentionModePanel.styles}
    :host{display:contents}
    .guided-attention{display:contents}
    .guided-attention.is-open{display:block;position:fixed;inset:76px 16px auto auto;width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 100px);overflow:auto;z-index:30;background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);border:1px solid var(--md-sys-color-outline-variant);border-radius:20px;padding:16px;box-shadow:0 8px 24px #0003}
    .guided-attention section{position:static;max-width:100%;max-height:none;box-shadow:none}
    .attention-feedback{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;padding:8px 16px;background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);max-height:25vh;overflow:auto}
    .attention-feedback p{margin:0;overflow-wrap:anywhere}
  `;
  open(opener?:HTMLElement){this.returnFocus=opener;this.opened=true;}
  private restoreFocus(){
    const root=this.getRootNode();
    const fallback=root instanceof ShadowRoot?root.querySelector<HTMLElement>('#attention-button'):null;
    const target=this.returnFocus?.isConnected&&this.returnFocus.checkVisibility()?this.returnFocus:fallback;
    if(target?.isConnected&&target.checkVisibility())target.focus();
  }
  protected updated(changed:PropertyValues){
    super.updated(changed);
    if(changed.has('opened')){
      if(this.opened)this.renderRoot.querySelector<HTMLElement>('.guided-attention')?.focus();
      else if(changed.get('opened')===true)this.restoreFocus();
    }
  }
  protected renderDimSum(){return html`<guided-shell-dim-sum .language=${this.language} .restricted=${this.restricted} .startupEligible=${this.startupEligible} .quiet=${this.preferences.modes.lowStimulation} .controlsVisible=${this.opened}></guided-shell-dim-sum>`;}
  render(){return html`${this.renderFeedback()}<div class=${'guided-attention'+(this.opened?' is-open':'')} role=${this.opened?'region':nothing} tabindex="-1" aria-label=${this.opened?localizedCopy('Attention and narration','專注同旁白',this.language,true):nothing} @keydown=${(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented){event.stopPropagation();this.opened=false;}}}>${this.renderDimSum()}${this.renderSettings()}</div>`;}
}
customElements.define('guided-shell-attention',GuidedShellAttention);
