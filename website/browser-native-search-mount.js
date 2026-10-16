import './browser-native-search';
/** Each mounted field owns its full expression workbench and isolated worker. */
export function mountLocalSearch(parent, labelEn, labelZh, entries, apply) {
  const control=document.createElement('browser-native-search');
  const refresh=()=>{const mode=document.documentElement.dataset.language;control.language=mode==='zh'?'zh-HK':mode==='en'?'en':'bilingual';control.label=mode==='zh'?labelZh:mode==='both'?`${labelEn} · ${labelZh}`:labelEn;};
  refresh();control.entries=entries;
  control.addEventListener('settings-filter',event=>apply(new Set(event.detail)));
  parent.append(control);document.querySelector('#language')?.addEventListener('change',refresh);
  return control;
}
export function mountSectionSearch(section, en, zh) {
  const targets=[...section.children].filter(element=>['DETAILS','MD-OUTLINED-TEXT-FIELD','MD-OUTLINED-SELECT'].includes(element.tagName)||element.classList.contains('visitor-checks'));
  const holder=document.createElement('div');section.querySelector('h2')?.after(holder);
  const entries=()=>targets.map((element,index)=>({id:String(index),text:[element.textContent,element.label,element.value,element.getAttribute('aria-label')].filter(Boolean).join(' ').slice(0,70000)}));
  const search=mountLocalSearch(holder,en,zh,entries(),ids=>targets.forEach((element,index)=>{element.hidden=!ids.has(String(index));element.style.display=element.hidden?'none':'';}));
  section.addEventListener('change',()=>{search.entries=entries();});document.querySelector('#language')?.addEventListener('change',()=>{search.entries=entries();});
  return search;
}
