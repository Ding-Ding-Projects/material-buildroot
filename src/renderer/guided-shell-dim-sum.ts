import {css,type PropertyValues} from 'lit';
import {DimSumPanel} from './dim-sum-panel';

/** Keep startup presentation mounted while the optional catalogue controls are closed. */
export class GuidedShellDimSum extends DimSumPanel {
  static properties={...DimSumPanel.properties,controlsVisible:{type:Boolean,attribute:'controls-visible',reflect:true}};
  controlsVisible=false;
  static styles=css`${DimSumPanel.styles}
    :host{display:contents}
    :host(:not([controls-visible])) > md-outlined-button,
    :host(:not([controls-visible])) > .catalog{display:none!important}
  `;
  protected updated(changed:PropertyValues){
    if(changed.has('controlsVisible')&&changed.get('controlsVisible')===true&&!this.controlsVisible){this.closeCataloguePresentation();}
    super.updated(changed);
  }
}
customElements.define('guided-shell-dim-sum',GuidedShellDimSum);
