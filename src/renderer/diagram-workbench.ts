import {captureOwnedStatus,displayOwnedStatus} from "./owned-status";
import {materialIcon} from "./material-icons";
import { LitElement, html, svg, css, nothing, type PropertyValues } from "lit";
import "@material/web/button/outlined-button.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/select/outlined-select.js";
import "@material/web/select/select-option.js";
export type DiagramNode = {id:string;label:string;detail?:string;kind:string;removable?:boolean};
export type DiagramEdge = {from:string;to:string};
type Point = {x:number;y:number};
type Layout = {positions:Record<string,Point>;x:number;y:number;scale:number};
/** A layout editor. Semantic changes are dispatched to the owning typed form. */
export class DiagramWorkbench extends LitElement {
  static properties={nodes:{attribute:false},edges:{attribute:false},language:{type:String},title:{type:String},selected:{type:String},layoutKey:{type:String},workspaceId:{type:String},canvasId:{type:String},revision:{state:true}};
  nodes:DiagramNode[]=[];edges:DiagramEdge[]=[];language="bilingual";title="";selected="";layoutKey="";revision=0;workspaceId="";canvasId="";
  private savedRevision:number|undefined;private saving=false;private saveMessage="";
  private layout:Layout={positions:{},x:30,y:30,scale:1};
  private undoStack:Layout[]=[];private redoStack:Layout[]=[];
  private drag?:{id:string;start:Point;origin:Point;before:Layout};
  static styles=css`
    :host{display:flex;flex-direction:column;min-width:0;height:100%;min-height:0;color:var(--md-sys-color-on-surface);font:13px Roboto,Arial,sans-serif}
    .tools{flex-shrink:0;display:flex;align-items:center;gap:3px;flex-wrap:wrap;padding:4px 8px;border-bottom:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container)}
    .tools:first-child{gap:0;padding:0 2px}.tools:first-child strong{flex-basis:100%;padding:4px 6px}.tools:last-of-type span{flex:1;min-width:100px}
    .tools strong{margin-right:auto;font-size:12px}.tools span{font-variant-numeric:tabular-nums;font-size:11px}
    md-icon-button{--md-icon-button-state-layer-height:40px;--md-icon-button-state-layer-width:40px;width:48px;height:48px}
    .viewport{position:relative;flex:1;min-height:60px;overflow:hidden;touch-action:none;background-color:var(--md-sys-color-surface);background-image:radial-gradient(var(--md-sys-color-outline-variant) 1px,transparent 1px);background-size:20px 20px;cursor:grab}
    .world{position:absolute;inset:0;transform-origin:0 0;overflow:visible}
    .world>svg{position:absolute;overflow:visible;width:1px;height:1px;pointer-events:none}.world>svg line{stroke:var(--md-sys-color-outline);stroke-width:2}
    .node{position:absolute;width:180px;min-height:66px;--md-outlined-button-container-shape:8px;--md-outlined-button-outline-color:var(--md-sys-color-outline);background:var(--md-sys-color-surface-container);border-radius:8px;cursor:move;text-align:left}
    .node[selected]{background:var(--md-sys-color-primary-container);--md-outlined-button-outline-color:var(--md-sys-color-primary);box-shadow:0 0 0 2px var(--md-sys-color-primary)}
    .node span{display:block;overflow-wrap:anywhere;white-space:normal}.node small{display:block;font-size:11px;color:var(--md-sys-color-on-surface-variant)}
    .node-name{position:absolute;pointer-events:none;transform-origin:center;display:block;width:140px;box-sizing:border-box;padding:2px 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px;text-align:center;background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);border-radius:4px}
    .footer{flex-shrink:0;display:flex;gap:8px;align-items:center;border-top:1px solid var(--md-sys-color-outline-variant);padding:6px 8px;background:var(--md-sys-color-surface-container)}
    md-outlined-select{flex:1;min-width:0;--md-outlined-field-top-space:7px;--md-outlined-field-bottom-space:7px;font-size:12px}
    .hint{font-size:11px;color:var(--md-sys-color-on-surface-variant);margin:0;padding:4px 8px;background:var(--md-sys-color-surface-container)}
    .empty{padding:24px;color:var(--md-sys-color-on-surface-variant)}
  `;
  private l(en:string,zh:string){return this.language==="en"?en:this.language==="zh-HK"?zh:`${en} · ${zh}`;}
  protected updated(changed:PropertyValues){
    if(changed.has("layoutKey")){this.layout={positions:{},x:30,y:30,scale:1};this.undoStack=[];this.redoStack=[];this.selected="";this.savedRevision=undefined;this.saveMessage=captureOwnedStatus(this,"saveMessage",this.l.bind(this),l=>"");}
    if(changed.has("nodes")||changed.has("layoutKey")){
      let altered=false;this.nodes.forEach((n,i)=>{if(!this.layout.positions[n.id]){this.layout.positions[n.id]={x:i===0?20:280+(Math.floor((i-1)/4)*230),y:i===0?130:20+((i-1)%4)*100};altered=true;}});
      if(altered)this.revision++;
    }
  }
  private point(id:string){return this.layout.positions[id]||{x:0,y:0};}
  private save(before=structuredClone(this.layout)){this.undoStack=[...this.undoStack.slice(-49),before];this.redoStack=[];}
  private emit(){this.revision++;this.dispatchEvent(new CustomEvent("diagram-layout-change",{bubbles:true,composed:true,detail:{layoutKey:this.layoutKey,nodes:this.nodes.map(n=>({id:n.id,...this.point(n.id)})),viewport:{x:this.layout.x,y:this.layout.y,scale:this.layout.scale}}}));}
  private select(id:string){this.selected=id;this.dispatchEvent(new CustomEvent("diagram-select",{bubbles:true,composed:true,detail:{id}}));}
  private start(e:PointerEvent,id=""){
    if(e.button!==0)return;e.stopPropagation();const el=e.currentTarget as HTMLElement;el.setPointerCapture(e.pointerId);
    if(id)this.select(id);
    this.drag={id,start:{x:e.clientX,y:e.clientY},origin:id?{...this.point(id)}:{x:this.layout.x,y:this.layout.y},before:structuredClone(this.layout)};
  }
  private move(e:PointerEvent){if(!this.drag)return;const d=this.drag,scale=d.id?this.layout.scale:1;
    const point={x:d.origin.x+(e.clientX-d.start.x)/scale,y:d.origin.y+(e.clientY-d.start.y)/scale};
    if(d.id)this.layout.positions[d.id]={x:Math.max(-10000,Math.min(10000,Math.round(point.x/10)*10)),y:Math.max(-10000,Math.min(10000,Math.round(point.y/10)*10))};
    else{this.layout.x=point.x;this.layout.y=point.y;}this.revision++;
  }
  private end(){if(!this.drag)return;const before=this.drag.before;this.drag=undefined;if(JSON.stringify(before)!==JSON.stringify(this.layout)){this.save(before);this.emit();}}
  private adjust(change:()=>void){this.save();change();this.emit();}
  private zoom(delta:number){this.adjust(()=>this.layout.scale=Math.max(.25,Math.min(2,Math.round((this.layout.scale+delta)*100)/100)));}
  private fit(){const bounds=this.renderRoot.querySelector('.viewport')?.getBoundingClientRect();if(!bounds||!this.nodes.length)return;
    const xs=this.nodes.map(n=>this.point(n.id).x),ys=this.nodes.map(n=>this.point(n.id).y),left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left+180,height=Math.max(...ys)-top+80;
    this.adjust(()=>{this.layout.scale=Math.max(.25,Math.min(1.5,(bounds.width-48)/width,(bounds.height-48)/height));this.layout.x=(bounds.width-width*this.layout.scale)/2-left*this.layout.scale;this.layout.y=(bounds.height-height*this.layout.scale)/2-top*this.layout.scale;});
  }
  private history(redo=false){const from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack;const previous=from.pop();if(!previous)return;to.push(structuredClone(this.layout));this.layout=previous;this.emit();}
  private keys(e:KeyboardEvent,id:string){const vectors:Record<string,Point>={ArrowLeft:{x:-10,y:0},ArrowRight:{x:10,y:0},ArrowUp:{x:0,y:-10},ArrowDown:{x:0,y:10}};
    if(vectors[e.key]){e.preventDefault();e.stopPropagation();const v=vectors[e.key];this.adjust(()=>{const p=this.point(id);this.layout.positions[id]={x:p.x+v.x,y:p.y+v.y};});}
    if(e.key==="Delete"&&this.nodes.find(n=>n.id===id)?.removable){e.preventDefault();this.removeSelected();}
  }
  private removeSelected(){this.dispatchEvent(new CustomEvent("diagram-remove",{bubbles:true,composed:true,detail:{id:this.selected}}));}
  private async persist(write=false){
    if(!this.workspaceId||!window.studio?.operations||this.saving)return;
    const key=this.layoutKey;this.saving=true;this.saveMessage=captureOwnedStatus(this,"saveMessage",this.l.bind(this),l=>"");this.revision++;
    try{
      const layout={nodes:this.nodes.map(n=>({id:n.id,...this.point(n.id)})),viewport:{x:this.layout.x,y:this.layout.y,scale:this.layout.scale}};
      const reply=await window.studio.operations({action:write?"canvas.write":"canvas.read",workspaceId:this.workspaceId,canvasId:this.canvasId,...(write?{expectedRevision:this.savedRevision,layout}:{})});
      if(key!==this.layoutKey)return;if(!reply.ok)throw new Error(reply.code);
      const result=reply.result as {revision:number;layout:null|typeof layout};
      this.savedRevision=result.revision;
      if(!write&&result.layout){this.save();this.layout={positions:{...this.layout.positions,...Object.fromEntries(result.layout.nodes.map(n=>[n.id,{x:n.x,y:n.y}]))},...result.layout.viewport};}
      this.saveMessage=captureOwnedStatus(this,"saveMessage",this.l.bind(this),l=>write?l("Layout saved","佈局已儲存"):l("Saved layout loaded; no semantic changes","已載入儲存佈局，無語意變更"));
    }catch(error){if(key===this.layoutKey){this.savedRevision=undefined;this.saveMessage=captureOwnedStatus(this,"saveMessage",this.l.bind(this),l=>l("Layout not confirmed. Reload before saving again.","未能確認佈局，請重新載入再儲存。")+" "+(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:""));}}finally{this.saving=false;this.revision++;}
  }
  private icon(label:string,icon:string,action:()=>void,disabled=false){return html`<md-icon-button aria-label=${label} title=${label} ?disabled=${disabled} @click=${action}>${materialIcon(icon)}</md-icon-button>`;}
  render(){const selected=this.nodes.find(n=>n.id===this.selected);return html`
    <div class="tools" role="toolbar" aria-label=${this.l("Canvas tools","畫布工具")}><strong>${this.title}</strong>
      ${this.icon(this.l("Undo layout","復原佈局"),"undo",()=>this.history(),!this.undoStack.length)}${this.icon(this.l("Redo layout","重做佈局"),"redo",()=>this.history(true),!this.redoStack.length)}
      ${this.icon(this.l("Zoom out","縮小"),"zoom_out",()=>this.zoom(-.1),this.layout.scale<=.25)}<span>${Math.round(this.layout.scale*100)}%</span>${this.icon(this.l("Zoom in","放大"),"zoom_in",()=>this.zoom(.1),this.layout.scale>=2)}
      ${this.icon(this.l("Fit diagram","符合畫布"),"crop_square",()=>this.fit(),!this.nodes.length)}
      ${this.icon(this.l("Pan left","向左平移"),"arrow_back",()=>this.adjust(()=>this.layout.x-=40))}${this.icon(this.l("Pan right","向右平移"),"arrow_forward",()=>this.adjust(()=>this.layout.x+=40))}
    </div>
    <div class="viewport" role="region" aria-label=${this.title} @pointerdown=${(e:PointerEvent)=>this.start(e)} @pointermove=${this.move} @pointerup=${this.end} @pointercancel=${this.end}>
      ${!this.nodes.length?html`<p class="empty">${this.l("Add records in the inspector to populate this canvas.","喺檢視器加入記錄以填入畫布。")}</p>`:nothing}
      <div class="world" style=${`transform:translate(${this.layout.x}px,${this.layout.y}px) scale(${this.layout.scale})`}>
        <svg aria-hidden="true">${this.edges.map(edge=>{const a=this.point(edge.from),b=this.point(edge.to);return svg`<line x1=${a.x+180} y1=${a.y+33} x2=${b.x} y2=${b.y+33}></line>`;})}</svg>
        ${this.nodes.map(node=>html`<md-outlined-button class="node" style=${`left:${this.point(node.id).x}px;top:${this.point(node.id).y}px`} ?selected=${this.selected===node.id} aria-pressed=${this.selected===node.id} title=${`${node.label}, ${node.detail||node.kind}`} aria-label=${`${node.label}, ${node.detail||node.kind}`} @click=${()=>this.select(node.id)} @pointerdown=${(e:PointerEvent)=>this.start(e,node.id)} @pointermove=${this.move} @pointerup=${this.end} @pointercancel=${this.end} @keydown=${(e:KeyboardEvent)=>this.keys(e,node.id)}><span aria-hidden="true">${this.layout.scale>=.85?html`${node.label}<small>${node.detail||node.kind}</small>`:nothing}</span></md-outlined-button>${this.layout.scale<.85?html`<span class="node-name" aria-hidden="true" style=${`left:${this.point(node.id).x+90}px;top:${this.point(node.id).y+33}px;transform:translate(-50%,-50%) scale(${1/this.layout.scale})`}>${node.label}</span>`:nothing}`)}
      </div>
    </div>
    <div class="footer"><md-outlined-select .label=${this.l("Selected node","已選節點")} .value=${this.selected} .displayText=${selected?.label||this.l("Select a node","選擇節點")} @change=${(e:Event)=>this.select((e.target as HTMLSelectElement).value)}>${this.nodes.map(node=>html`<md-select-option .value=${node.id}><div slot="headline">${node.label}</div></md-select-option>`)}</md-outlined-select>${this.icon(this.l("Remove selected dependency","移除所選相依項目"),"delete",()=>this.removeSelected(),!selected?.removable)}</div>
    <div class="tools">${this.icon(this.l("Load saved layout","載入儲存佈局"),"download",()=>this.persist(),this.saving||!this.workspaceId)}${this.icon(this.l("Save diagram layout","儲存畫布佈局"),"save",()=>this.persist(true),this.saving||this.savedRevision===undefined||this.nodes.length>128)}<span role="status">${displayOwnedStatus(this,"saveMessage",this.saveMessage,this.language)||this.l("Load before saving. Layout is separate from semantic Apply.","儲存前請先載入，佈局同語意套用分開。")}</span></div>
    <p class="hint">${this.l("Drag to arrange, background to pan. Arrow keys move a focused node by 10 units. Undo/redo changes layout only.","拖曳排列，拖曳背景平移。方向鍵每次移動已聚焦節點 10 單位，復原／重做只會改變佈局。")}</p>
  `;}
}
customElements.define("diagram-workbench",DiagramWorkbench);
