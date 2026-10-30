import {LitElement,html,css} from 'lit';
import '@material/web/button/text-button.js';
import {materialIcon} from './material-icons';
/** A retained expandable section driven by a registered Material button. */
export class WorkspaceSection extends LitElement{
 static properties={open:{type:Boolean,reflect:true}};open=false;
 static styles=css`:host{display:block;min-width:0}md-text-button{width:100%;min-height:48px;white-space:normal;text-align:start;--md-text-button-container-shape:16px}.body[hidden]{display:none}.body{min-width:0;padding-block:8px}`;
 render(){return html`<md-text-button aria-expanded=${this.open} aria-controls="section-body" @click=${()=>this.open=!this.open}>${materialIcon(this.open?'remove':'add','icon')}<slot name="heading"></slot></md-text-button><div id="section-body" class="body" ?hidden=${!this.open}><slot></slot></div>`;}
}
customElements.define('workspace-section',WorkspaceSection);
