import {browserCopy,browserDialogEmoji} from './browser-native-tone.js';
import '@material/web/dialog/dialog.js';
import '@material/web/slider/slider.js';
const l=(en,zh)=>browserCopy(en,zh);
/** A fresh, single-use confirmation in the current browser surface. */
export async function confirmBrowserMutation(origin,description) {
  const dialog=document.createElement('md-dialog');dialog.style.maxWidth='min(36rem, calc(100vw - 24px))';
  const title=document.createElement('div');title.slot='headline';title.textContent=l('Confirm local change','確認本機變更');if(browserDialogEmoji()){const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent='🔎 ';title.prepend(icon);}
  const content=document.createElement('div');content.slot='content';content.style.display='grid';content.style.gap='16px';
  const details=document.createElement('p');details.textContent=description;details.style.overflowWrap='anywhere';content.append(details);
  const keys=[];
  for(const [en,zh] of [['I reviewed the exact affected data.','已核對確切受影響資料。'],['I authorize this replacement or reset.','授權此取代或重設操作。']]){const label=document.createElement('label');label.style.display='flex';label.style.alignItems='center';label.style.gap='12px';label.style.minHeight='48px';const box=document.createElement('md-checkbox');box.setAttribute('aria-label',l(en,zh));label.append(box,document.createTextNode(l(en,zh)));content.append(label);keys.push(box);}
  const slider=document.createElement('md-slider');slider.min=0;slider.max=100;slider.step=1;slider.value=0;slider.disabled=true;slider.labeled=true;slider.setAttribute('aria-label',l('Move confirmation to 100 percent','將確認移至百分之一百'));content.append(slider);
  const status=document.createElement('p');status.role='status';status.setAttribute('aria-live','polite');content.append(status);
  const actions=document.createElement('div');actions.slot='actions';const cancel=document.createElement('md-text-button');cancel.textContent=l('Emergency exit','緊急退出');const accept=document.createElement('md-filled-button');accept.textContent=l('Confirm this change','確認此變更');accept.disabled=true;actions.append(cancel,accept);dialog.append(title,content,actions);document.body.append(dialog);
  let allowed=false,expired=false,settled=false;const update=()=>{const ready=keys.every(key=>key.checked)&&!expired;slider.disabled=!ready;accept.disabled=!ready||Number(slider.value)!==100;status.textContent=expired?l('Confirmation expired. Cancel and start again.','確認已過期，請取消後重新開始。'):l(`Confirmation ${slider.value}%. Both keys and 100% are required.`,`確認 ${slider.value}%。必須勾選兩項並完成百分之一百。`);};
  for(const key of keys)key.addEventListener('change',()=>{slider.value=0;update();});slider.addEventListener('input',update);update();
  const result=new Promise(resolve=>{dialog.addEventListener('closed',()=>{if(settled)return;settled=true;resolve(allowed);},{once:true});});
  cancel.addEventListener('click',()=>{allowed=false;dialog.close();});accept.addEventListener('click',()=>{if(keys.every(key=>key.checked)&&Number(slider.value)===100&&!expired){allowed=true;dialog.close();}});dialog.addEventListener('cancel',()=>{allowed=false;});
  const timer=setTimeout(()=>{expired=true;slider.value=0;update();},120000);
  try{await dialog.show();return await result;}finally{clearTimeout(timer);dialog.remove();if(origin?.isConnected)origin.focus();}
}
export function protectBrowserMutation(control,description) {
  if(!control)return;let accepted=false,pending=false;
  control.addEventListener('click',async event=>{
    if(accepted){accepted=false;return;}
    event.preventDefault();event.stopImmediatePropagation();if(pending)return;pending=true;
    try{if(await confirmBrowserMutation(control,description())){accepted=true;control.click();}}finally{pending=false;}
  },true);
}


