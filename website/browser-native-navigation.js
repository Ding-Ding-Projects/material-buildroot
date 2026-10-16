import {browserCopy} from './browser-native-tone.js';
import '@material/web/dialog/dialog.js';
import {mountLocalSearch} from './browser-native-search-mount.js';
const l=(en,zh)=>browserCopy(en,zh);
/** Discover actual visitor controls at invocation time, not a claimed feature catalogue. */
export function mountBrowserNavigation(visitor) {
  const panel=document.createElement('section');panel.className='visitor-card';panel.id='browser-native-navigation';
  const title=document.createElement('h2');title.id='browser-navigation-title';panel.setAttribute('aria-labelledby',title.id);
  const explanation=document.createElement('p');const open=document.createElement('md-outlined-button');open.setAttribute('aria-keyshortcuts','Control+Shift+F');
  const content=document.createElement('div');panel.append(title,explanation,open,content);
  let dialog;const excluded=element=>element.closest('#browser-native-navigation,#browser-native-authenticator,#browser-native-locks,[data-browser-locked],.companion-status,.companion-connected,#browser-native-attention,md-dialog,[type=password]');
  const showSection=element=>{visitor.dispatchEvent(new CustomEvent('browser-native-open-section',{detail:{element}}));for(let ancestor=element.parentElement;ancestor&&ancestor!==visitor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;element.hidden=false;element.style.removeProperty('display');element.scrollIntoView({behavior:'instant',block:'center'});element.focus();};
  const label=element=>element.getAttribute('aria-label')||element.label||element.textContent.trim();
  const palette=async()=>{
    if(dialog)return;const origin=document.activeElement;let requestedFocus;dialog=document.createElement('md-dialog');dialog.style.maxWidth='min(48rem, calc(100vw - 24px))';
    const headline=document.createElement('div');headline.slot='headline';headline.textContent=l('Visitor command palette','訪客命令選單');
    const body=document.createElement('div');body.slot='content';const searchHolder=document.createElement('div');const rows=document.createElement('div');const status=document.createElement('p');status.role='status';body.append(searchHolder,rows,status);
    const candidates=[...visitor.querySelectorAll('md-filled-button,md-outlined-button,md-text-button,md-switch,md-checkbox,md-outlined-text-field')].filter(element=>!excluded(element)&&label(element)&&!element.disabled&&!element.readOnly&&element.type!=='password').slice(0,300);
    const controls=candidates.map((element,index)=>({element,id:String(index),label:label(element).slice(0,500)}));
    const render=ids=>{rows.replaceChildren();for(const item of controls.filter(item=>ids.has(item.id))){const row=document.createElement('div');row.className='companion-record';const name=document.createElement('p');name.textContent=item.label;row.append(name);
      const go=document.createElement('md-text-button');go.textContent=l('Go to this control','前往此控制項');go.addEventListener('click',()=>{requestedFocus=item.element;dialog.close();});row.append(go);
      if(['MD-SWITCH','MD-CHECKBOX'].includes(item.element.tagName)){
        const toggle=document.createElement(item.element.localName);const property=item.element.tagName==='MD-SWITCH'?'selected':'checked';toggle[property]=item.element[property];toggle.setAttribute('aria-label',item.label);toggle.addEventListener('change',()=>{if(!item.element.isConnected||item.element.disabled)return;item.element[property]=toggle[property];item.element.dispatchEvent(new Event('change',{bubbles:true}));});row.append(toggle);
      }else if(item.element.tagName==='MD-OUTLINED-TEXT-FIELD'&&item.element.type!=='textarea'){
        const field=document.createElement('md-outlined-text-field');field.label=item.label;field.type=item.element.type||'text';field.value=item.element.value;field.maxLength=item.element.maxLength;field.style.width='100%';for(const key of ['min','max','step'])if(item.element[key])field[key]=item.element[key];field.addEventListener('input',()=>{if(!item.element.isConnected||item.element.disabled)return;item.element.value=field.value;item.element.dispatchEvent(new Event('input',{bubbles:true}));});field.addEventListener('change',()=>{if(item.element.isConnected&&!item.element.disabled)item.element.dispatchEvent(new Event('change',{bubbles:true}));});row.append(field);
      }
      rows.append(row);
    }status.textContent=l(`${ids.size} matching controls in the first ${controls.length} admitted visitor controls.`,`${ids.size} 個符合控制項，範圍為首 ${controls.length} 個已接納訪客控制項。`);};
    const search=mountLocalSearch(searchHolder,'Search visitor controls','搜尋訪客控制項',controls.map(item=>({id:item.id,text:item.label})),render);
    const close=document.createElement('md-text-button');close.slot='actions';close.textContent=l('Close','關閉');close.addEventListener('click',()=>dialog.close());dialog.append(headline,body,close);document.body.append(dialog);
    dialog.addEventListener('closed',()=>{const old=dialog;dialog=undefined;old.remove();if(requestedFocus?.isConnected)showSection(requestedFocus);else if(origin?.isConnected)origin.focus();},{once:true});await dialog.show();search.focusQuery();
  };
  open.addEventListener('click',palette);
  document.addEventListener('keydown',event=>{if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==='f'&&!dialog){event.preventDefault();palette();}});
  const refresh=()=>{
    title.textContent=l('Find the next action','尋找下一步');explanation.textContent=l('Open the live visitor control palette with Ctrl+Shift+F. Switches and single-line values use the original controls and validation. Destructive actions still require their own confirmation. Companion controls are not included.','按 Ctrl+Shift+F 開啟即時訪客控制選單。開關同單行數值會使用原有控制項及驗證。破壞性操作仍須另外確認，不包含配對控制。');open.textContent=l('Open command palette (Ctrl+Shift+F)','開啟命令選單（Ctrl+Shift+F）');
    content.replaceChildren();const sections=[...visitor.querySelectorAll('section.visitor-card')].filter(section=>section!==panel&&!excluded(section));
    for(const section of sections){const heading=section.querySelector('h2');if(!heading)continue;const button=document.createElement('md-text-button');button.textContent=heading.textContent;button.addEventListener('click',()=>{heading.tabIndex=-1;showSection(heading);});content.append(button);}
  };
  visitor.prepend(panel);refresh();document.querySelector('#language')?.addEventListener('change',refresh);
}





