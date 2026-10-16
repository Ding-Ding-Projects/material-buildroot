import type {ExperienceLock,ExperienceRequest,ExperienceState} from '../shared/experience-policies';
import {registerContextActionProvider,registerCommandAccessProvider} from './command-surfaces';
import './experience-policy-panel';
const locks=new Map<string,ExperienceLock>();
const values=new WeakMap<HTMLElement,{value?:string;checked?:boolean;selected?:boolean}>();
const ancestor=(el:Element):Element|null=>el.parentElement||(el.getRootNode() instanceof ShadowRoot?(el.getRootNode() as ShadowRoot).host:null);
export function resolveExperienceTarget(target:HTMLElement):string|null {
  if(target.matches("material-buildroot,.shell,header,.caption-controls,.window-actions,[data-experience-exempt]"))return null;
  const parts:string[]=[];
  for(let el:Element|null=target;el;el=ancestor(el)){
    if(el.matches('experience-policy-panel,command-surfaces,[data-experience-exempt],header,.window,.titlebar,.window-controls,[role=alert]')||el.localName==='shared-mode-panel')return null;
    const explicit=el.getAttribute('data-experience-id');
    if(explicit&&/^[A-Za-z0-9_.:-]{1,80}$/.test(explicit))parts.unshift(explicit);
    else if(el.id&&/^[A-Za-z0-9_.:-]{1,80}$/.test(el.id))parts.unshift('#'+el.id);
    else {
      const siblings=el.parentElement?.children||(el.getRootNode() instanceof ShadowRoot?(el.getRootNode() as ShadowRoot).children:[]);
      if(Array.from(siblings).filter(s=>s.localName===el!.localName).length>1)return null;
      parts.unshift(el.localName);
    }
    if(el.localName==='material-buildroot'){
      const key='element:'+parts.join('/');return key.length<=228?key:null;
    }
  }
  return null;
}
function targetLock(target:HTMLElement){for(let el:Element|null=target;el;el=ancestor(el))if(el.matches("experience-policy-panel,command-surfaces,shared-mode-panel,header,.window,[data-experience-exempt],[role=alert]"))return null;for(let el:Element|null=target;el;el=ancestor(el)){const id=resolveExperienceTarget(el as HTMLElement);const lock=id&&locks.get(id);if(lock&&(lock.locked||(lock.unlockedUntil!==undefined&&lock.unlockedUntil<=Date.now())))return lock;}return null;}
export function experienceLocked(target:HTMLElement){return !!targetLock(target);}
export async function experienceRequest(request:ExperienceRequest){
  if(!window.studio?.experiencePolicies)return {ok:false as const,code:'UNAVAILABLE'};
  try{return await window.studio.experiencePolicies(request);}catch{return {ok:false as const,code:'UNAVAILABLE'};}
}
export async function refreshExperience(){
  const reply=await experienceRequest({action:'status'});

  if(reply.ok){locks.clear();for(const lock of (reply.result as ExperienceState).locks)locks.set(lock.targetId,lock);}
  decorate(document);
  document.dispatchEvent(new CustomEvent('experience-state',{detail:reply.ok?reply.result:null}));
  return reply;
}
function decorate(root:ParentNode){for(const el of root.querySelectorAll<HTMLElement>('*')){
  if(el.localName==='experience-policy-panel')continue;
  const lock=targetLock(el);
  if(lock){if(!values.has(el)){const control=el as any;values.set(el,{value:control.value,checked:control.checked,selected:control.selected});}el.dataset.experienceLocked='true';if(!el.hasAttribute('aria-disabled')){el.dataset.experienceAria='true';el.setAttribute('aria-disabled','true');}}
  else {values.delete(el);delete el.dataset.experienceLocked;if(el.dataset.experienceAria){el.removeAttribute('aria-disabled');delete el.dataset.experienceAria;}}
  if(el.shadowRoot&&!el.localName.startsWith('md-'))decorate(el.shadowRoot);
}}
export async function openExperiencePolicy(target:HTMLElement,language='bilingual'){
  const id=targetLock(target)?.targetId||resolveExperienceTarget(target);if(!id)return;
  let panel=document.querySelector('experience-policy-panel[data-floating]') as any;
  if(!panel){panel=document.createElement('experience-policy-panel');panel.dataset.floating='true';document.body.append(panel);}
  panel.language=language;await panel.openFor(target,id);return panel;
}
export function requestExperienceUnlock(target:HTMLElement){void openExperiencePolicy(target);}
registerContextActionProvider('experience',({target,language})=>resolveExperienceTarget(target)?[{id:'lock',label:language==='en'?'Lock this element…':language==='zh-HK'?'鎖定呢個元素…':'Lock this element… · 鎖定呢個元素…',run:()=>openExperiencePolicy(target,language).then(()=>{})}]:[]);
registerCommandAccessProvider('experience',target=>{if(experienceLocked(target)){requestExperienceUnlock(target);return false;}return true;});
let pending=false;
for(const type of ['pointerdown','click','keydown','beforeinput','input','change','dragstart','submit'])document.addEventListener(type,event=>{
  if(type==='keydown'&&!['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Backspace','Delete'].includes((event as KeyboardEvent).key))return;
  const target=event.composedPath().find(p=>p instanceof HTMLElement&&!p.localName.startsWith('md-')&&p.getRootNode() instanceof Document||p instanceof HTMLElement&&p.localName.startsWith('md-')) as HTMLElement|undefined;
  if(!target||!experienceLocked(target))return;
  event.preventDefault();event.stopImmediatePropagation();
  const saved=values.get(target);if(saved){const control=target as any;for(const [key,value] of Object.entries(saved))if(value!==undefined)control[key]=value;}
  if(!pending){pending=true;queueMicrotask(()=>{pending=false;requestExperienceUnlock(target);});}
},true);
window.addEventListener('DOMContentLoaded',()=>{void refreshExperience();});
// Duration expiry comes from the host, not a renderer-controlled unlock deadline.
setInterval(()=>{void refreshExperience();},2000);
document.addEventListener('focusout',event=>{
  const target=event.composedPath().find(p=>p instanceof HTMLElement) as HTMLElement|undefined;
  if(!target)return;const id=resolveExperienceTarget(target);const lock=id&&locks.get(id);
  const next=(event as FocusEvent).relatedTarget as Node|null;
  if(lock&&!lock.locked&&lock.duration.mode==='surface'&&!target.contains(next))void experienceRequest({action:'leave',targetId:id}).then(()=>refreshExperience());
});
