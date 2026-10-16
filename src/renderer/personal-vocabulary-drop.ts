import {localizedCopy} from './language-wording';
import {LitElement,html,css,nothing} from 'lit';
import '@material/web/labs/card/filled-card.js';
import '@material/web/focus/md-focus-ring.js';
import {styles as typeStyles} from '@material/web/typography/md-typescale-styles.js';
import {vocabulary,type VocabularyOutcome} from './owned-copy';

/** Nonmodal portal plumbing; all visible surface chrome belongs to MdFilledCard. */
class PersonalVocabularyFeedback extends LitElement{
 static properties={text:{type:String},phase:{type:String},kind:{type:String}};
 text='';phase='';kind='applied';
 static styles=[typeStyles,css`
 :host{position:fixed;inset:0;margin:0;width:100%;height:100%;border:0;padding:16px;box-sizing:border-box;background:transparent;overflow:visible;pointer-events:none;display:grid;place-items:center}
 :host::backdrop{background:transparent;pointer-events:none}
 md-filled-card{box-sizing:border-box;width:min(900px,100%);max-height:100%;overflow:auto;overscroll-behavior:contain;padding:24px;pointer-events:auto}
 .text{display:block;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--md-sys-color-on-surface,#1d1b20)}
 .enter{animation:wording-enter 240ms ease-out both}.exit{animation:wording-exit 180ms ease-in both}
 .announcement{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
 @keyframes wording-enter{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
 @keyframes wording-exit{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-8px)}}
 @media(prefers-reduced-motion:reduce){.enter,.exit{animation:none}}
 `];
 render(){
  // The card is optionally scrollable/focusable for the full 1000-code-point
  // heading. It is never autofocused, modal, or a keyboard trap. Text is not cut.
  const style=this.kind==='applied'&&[...this.text].length<=120?'md-typescale-headline-large':'md-typescale-body-large';
  return html`<div class="announcement" role="status" aria-live="polite" aria-atomic="true">${this.text}</div>
   ${this.text?html`<md-filled-card id="feedback-card" class=${this.phase} tabindex="0" role="region" aria-label=${this.text}><md-focus-ring for="feedback-card" inward></md-focus-ring><span class=${'text '+style}>${this.text}</span></md-filled-card>`:nothing}`;
 }
}
customElements.define('personal-vocabulary-feedback',PersonalVocabularyFeedback);

/** Walk composed ancestors without reading user text or private control values. */
function composedParent(node:Node):Node|null{
 if(node instanceof Element&&node.assignedSlot)return node.assignedSlot;
 return node.parentNode instanceof ShadowRoot?node.parentNode.host:node.parentNode;
}
function activeModal():HTMLDialogElement|null{
 let focused:Element|null=document.activeElement;
 while(focused?.shadowRoot?.activeElement)focused=focused.shadowRoot.activeElement;
 for(let node:Node|null=focused;node;node=composedParent(node)){
  if(node instanceof HTMLDialogElement&&node.matches(':modal'))return node;
  if(node instanceof Element&&node.localName==='md-dialog'){
   const dialog=node.shadowRoot?.querySelector<HTMLDialogElement>('dialog:modal');if(dialog)return dialog;
  }
 }
 // Focus can temporarily be on the document while a native modal is opening.
 const candidates:HTMLDialogElement[]=[];
 const scan=(root:Document|ShadowRoot)=>{for(const element of root.querySelectorAll('*')){if(element instanceof HTMLDialogElement&&element.matches(':modal'))candidates.push(element);if(element.shadowRoot)scan(element.shadowRoot);}};
 scan(document);return candidates.at(-1)??null;
}

/** Desktop-owned admission; feedback is mounted in the current accessible boundary. */
export class PersonalVocabularyDrop extends LitElement{
 static properties={language:{type:String}};
 language='bilingual';
 private unsubscribe?:()=>void;private unsubscribeOutcome?:()=>void;
 private timers:ReturnType<typeof setTimeout>[]=[];private epoch=0;
 private motion=matchMedia('(prefers-reduced-motion: reduce)');
 private view=new PersonalVocabularyFeedback();private currentText='';private kind='applied';
 private observer=new MutationObserver(()=>{void this.syncBoundary();});
 private boundaryEpoch=0;
 connectedCallback(){
  super.connectedCallback();this.view.setAttribute('popover','manual');
  window.addEventListener('dragover',this.dragover,true);window.addEventListener('drop',this.drop,true);window.addEventListener('focusin',this.focusChanged,true);
  this.unsubscribe=vocabulary.subscribe(()=>{if(!vocabulary.available())this.reset();});
  this.unsubscribeOutcome=vocabulary.subscribeOutcome(outcome=>{void this.receive(outcome);});
  this.motion.addEventListener('change',this.motionChanged);
  const root=this.getRootNode();if(root instanceof ShadowRoot||root instanceof Document)this.observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 }
 disconnectedCallback(){
  window.removeEventListener('dragover',this.dragover,true);window.removeEventListener('drop',this.drop,true);window.removeEventListener('focusin',this.focusChanged,true);
  this.unsubscribe?.();this.unsubscribeOutcome?.();this.motion.removeEventListener('change',this.motionChanged);this.observer.disconnect();
  this.reset();this.view.remove();super.disconnectedCallback();
 }
 private l(en:string,zh:string,authored=false){return localizedCopy(en,zh,this.language,authored);}
 private presentationHeadline(headline:string|null){
  // Display-only fallback. Never normalize the mapping or a nonblank heading;
  // other Unicode formatting characters retain their existing behavior.
  return headline===null||/^[ \t\r\n]*$/u.test(headline)
   ?this.l('Personal wording applied','已套用個人用語',true):headline;
 }
 private clearRenderedText(){
  // Retain Lit's comment anchors and TextPart nodes so the next outcome can
  // update the same component after synchronous privacy suppression.
  this.view.shadowRoot?.querySelectorAll('.announcement,.text').forEach(element=>{
   const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
   let node:Node|null;while((node=walker.nextNode()))node.nodeValue='';
  });
 }
 private reset(){
  ++this.epoch;++this.boundaryEpoch;this.timers.forEach(clearTimeout);this.timers=[];this.currentText='';this.view.text='';this.view.phase='';
  // Clear rendered private text synchronously, before a Lit update can wait behind
  // another task. The retained component has no application-data persistence.
  this.clearRenderedText();
  const card=this.view.shadowRoot?.querySelector('md-filled-card');card?.removeAttribute('aria-label');
  if(this.view.matches(':popover-open'))this.view.hidePopover();
  this.view.remove();
 }
 private later(action:()=>void,delay:number){this.timers.push(setTimeout(action,delay));}
 private hasFiles(event:DragEvent){return Array.from(event.dataTransfer?.types??[]).includes('Files');}
 private dragover=(event:DragEvent)=>{if(!this.hasFiles(event))return;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect=vocabulary.available()?'copy':'none';};
 private drop=(event:DragEvent)=>{if(!this.hasFiles(event))return;event.preventDefault();event.stopImmediatePropagation();if(!vocabulary.available())return;const files=event.dataTransfer?.files;void vocabulary.importFile(files?.length===1?files[0]:null);};
 private focusChanged=()=>{void this.syncBoundary();};
 private motionChanged=()=>{if(this.currentText&&this.motion.matches){this.timers.forEach(clearTimeout);this.timers=[];this.view.phase='hold';this.later(()=>this.reset(),3000);}};
 private async syncBoundary(){
  if(!this.currentText||!this.isConnected||!vocabulary.available())return;
  const modal=activeModal();let target:Node=this.renderRoot;
  if(modal){
   this.observer.observe(modal,{attributes:true,attributeFilter:['open']});
   const root=modal.getRootNode();const host=root instanceof ShadowRoot?root.host:null;
   // Material's documented content slot projects into the native modal. Never
   // append application content into the dependency's owned shadow internals.
   if(host?.localName==='md-dialog'){
    const content=host.querySelector<HTMLElement>('[slot="content"]');
    if(!content){this.reset();return;}target=content;
   }else target=modal;
  }
  if(this.view.parentNode===target)return;
  const version=++this.boundaryEpoch;
  this.view.text='';
  this.clearRenderedText();
  // First connection must precede updateComplete: Lit defers an initial update
  // until connected. The destination receives an empty live region first.
  target.appendChild(this.view);await this.view.updateComplete;
  if(version!==this.boundaryEpoch||!this.currentText||!this.isConnected||!vocabulary.available())return;
  if(!this.view.matches(':popover-open'))this.view.showPopover();
  // The live region is first installed empty inside the active modal's content,
  // then populated. Both success and generic failure share this exact path.
  this.view.text=this.currentText;
 }
 private async receive(outcome:VocabularyOutcome){
  this.reset();if(!this.isConnected||!vocabulary.available()||outcome.state==='suppressed')return;
  this.kind=outcome.state;
  this.currentText=outcome.state==='applied'?this.presentationHeadline(outcome.headline):outcome.state==='invalid'?this.l('Choose one valid vocabulary JSON file, no larger than 256 KiB. Existing wording was not changed.','請選擇一個有效嘅詞彙 JSON 檔，最大 256 KiB。原有用語未有變更。',true):this.l('The local file or storage could not confirm the change. Reload and review the saved wording before retrying.','本機檔案或儲存未能確認變更。請重新載入並檢視已儲存用語，再試一次。',true);
  this.view.kind=this.kind;this.view.setAttribute('data-outcome',this.kind);this.view.phase=this.motion.matches?'hold':'enter';
  const version=this.epoch;await this.syncBoundary();
  if(version!==this.epoch||!this.currentText||!this.isConnected||!vocabulary.available())return;
  const enter=this.motion.matches?0:240;
  if(enter)this.later(()=>{this.view.phase='hold';},enter);
  this.later(()=>{if(this.motion.matches){this.reset();return;}this.view.phase='exit';this.later(()=>this.reset(),180);},enter+3000);
 }
 render(){return nothing;}
}
customElements.define('personal-vocabulary-drop',PersonalVocabularyDrop);
