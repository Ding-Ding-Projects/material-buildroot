import type {AttentionPreferences} from './attention-modes';

/** Styles registered roots without reading their text, values or protected state. */
export class AttentionSurfaces {
 private roots=new Map<ShadowRoot,{style:HTMLStyleElement;observer:MutationObserver}>();
 private documentObserver:MutationObserver;
 private timer:ReturnType<typeof setTimeout>|undefined;
 private disposed=false;
 private preferences:AttentionPreferences;
 constructor(preferences:AttentionPreferences,private liveAnnouncement:()=>void=()=>{}){this.preferences=preferences;this.documentObserver=new MutationObserver(records=>this.changed(records));this.documentObserver.observe(document,{childList:true,subtree:true,characterData:true});this.discover();}
 private changed(records:MutationRecord[]){if(records.some(record=>{const element=record.target instanceof Element?record.target:record.target.parentElement;return !!element?.closest('[role="alert"],[role="status"],[aria-live="polite"],[aria-live="assertive"]');}))this.liveAnnouncement();this.schedule();}
 private schedule(){if(this.timer||this.disposed)return;this.timer=setTimeout(()=>{this.timer=undefined;this.discover();},100);}
 private rules(){return `@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`+
  (this.preferences.modes.focus?`:is(.panel,.record,.rule,article,section):focus-within{outline:2px solid var(--md-sys-color-primary);outline-offset:-2px}:is(.panel,.record,.rule,article,section):not(:focus-within):not(:hover){box-shadow:none!important}`:'')+
  (this.preferences.modes.lowStimulation?`*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}:host{--md-sys-color-primary:var(--md-sys-color-on-surface);--md-sys-color-secondary:var(--md-sys-color-on-surface-variant)}[data-notification-priority="routine"][data-nonessential="true"]{display:none!important}`:'');
 }
 discover(){if(this.disposed)return;for(const [root,entry] of this.roots){if(!root.host.isConnected){entry.observer.disconnect();entry.style.remove();this.roots.delete(root);}}
  const visit=(root:ParentNode)=>{for(const element of root.querySelectorAll('*')){const nested=element.shadowRoot;if(!nested)continue;if(!this.roots.has(nested)){const style=document.createElement('style');style.setAttribute('data-attention-style','');const observer=new MutationObserver(records=>this.changed(records));nested.append(style);observer.observe(nested,{childList:true,subtree:true,characterData:true});this.roots.set(nested,{style,observer});}const entry=this.roots.get(nested)!;const rules=this.rules();if(entry.style.textContent!==rules)entry.style.textContent=rules;if(!entry.style.isConnected)nested.append(entry.style);visit(nested);}};visit(document);
 }
 apply(preferences:AttentionPreferences){this.preferences=preferences;this.discover();}
 dispose(){this.disposed=true;clearTimeout(this.timer);this.documentObserver.disconnect();for(const entry of this.roots.values()){entry.observer.disconnect();entry.style.remove();}this.roots.clear();}
}
