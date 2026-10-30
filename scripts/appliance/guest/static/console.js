import './ui-vendor.mjs';
import {createVocabularyController} from './vocabulary.mjs';
const $ = id => document.getElementById(id);
let csrf='', authenticated=false, setup=false, controller=null, celebrationTimer, authEpoch=0, authorization='';
let setupStage='complete', activeOperations=0, noWeb=false, scopedTls=false;
let language=localStorage.getItem('console-language') || 'en';
if(!['en','zh-HK','bilingual'].includes(language)) language='en';
const text=(en,hk)=>language==='zh-HK'?hk:language==='bilingual'?`${en} / ${hk}`:en;
function owned(en,hk){const value=text(en,hk);return authenticated&&controller?controller.formatOwnedText(value,{kind:'ui-copy',mode:language}):value;}
function render(){
 document.documentElement.lang=language==='zh-HK'?'zh-HK':'en'; $('language').value=language;
 document.querySelectorAll('[data-en]').forEach(node=>{const target=node.matches('md-select-option')?node.querySelector('[slot=headline]'):node;target.textContent=owned(node.dataset.en,node.dataset.hk||node.dataset.en);});
 document.querySelectorAll('md-outlined-select').forEach(select=>{const selected=[...select.querySelectorAll('md-select-option')].find(option=>option.value===select.value);select.displayText=selected?.querySelector('[slot=headline]')?.textContent.trim()||'';});
 $('auth-title').textContent=text(setup?'Create console owner':'Unlock console',setup?'建立控制台擁有人':'解鎖控制台');
 $('sign-in').textContent=text(setup?'Create owner and continue':'Sign in',setup?'建立擁有人並繼續':'登入');
 $('password').autocomplete=setup?'new-password':'current-password';
 document.querySelectorAll('label[for]').forEach(label=>{const control=$(label.htmlFor);if(control?.localName.startsWith('md-')){control.label=label.textContent.trim();control.setAttribute('aria-label',label.textContent.trim());}});
 ['auth-confirm','public-confirm'].forEach(id=>$(id).setAttribute('aria-label',$(id).parentElement.querySelector('span').textContent.trim()));
 renderSetup();
 $('wording-state').textContent=owned(controller?.status().active?'Local wording loaded':'Original wording active',controller?.status().active?'已載入本機用詞':'使用原本用詞');
}
function notice(en,hk=en){$('notice').textContent=owned(en,hk);}
function clearEnrollment(){['workload-username','workload-password','workload-confirm'].forEach(id=>$(id).value='');$('enrollment-form').hidden=true;}
function lock(){clearEnrollment();document.querySelectorAll('md-outlined-select').forEach(select=>select.open=false);authEpoch++;authorization='';authenticated=false;controller=null;clearTimeout(celebrationTimer);$('celebration').textContent='';$('celebration').hidden=true;$('workspace').hidden=true;$('setup-flow').hidden=true;$('locked').hidden=false;['name','health','container-state','target','public-address','tunnel-status','notice'].forEach(id=>$(id).textContent='');$('open').removeAttribute('href');$('credential').value='';$('password').value='';$('vocabulary').value='';render();$('password').focus();}
async function api(path,body){
 const response=await fetch(path,{cache:'no-store',headers:{Authorization:`Bearer ${authorization}`},...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,Authorization:`Bearer ${authorization}`},body:JSON.stringify(body)})});
 if(response.status===401){lock();await session();throw new Error('Session expired. Sign in again.');}
 if(!response.ok)throw new Error('The action did not complete. Check the values and application status.');
 return response.json();
}
async function wording(){
 const epoch=authEpoch;
 controller=createVocabularyController({privateCache:{read:()=>{const value=localStorage.getItem('console-wording');return value===null?null:new TextEncoder().encode(value);},replace:bytes=>localStorage.setItem('console-wording',new TextDecoder().decode(bytes)),clear:()=>localStorage.removeItem('console-wording')}});
 const active=controller;await active.load();if(epoch!==authEpoch||!authenticated)return;
 if(localStorage.getItem('console-seed-checked')!== 'yes'){
  const response=await fetch('/api/seed',{cache:'no-store',headers:{Authorization:`Bearer ${authorization}`}});
  if(response.status===401){lock();throw new Error('Session expired.');}
  if(response.ok&&!active.status().active){const bytes=new Uint8Array(await response.arrayBuffer());if(epoch!==authEpoch||!authenticated)return;const outcome=await active.importBytes(bytes);if(epoch!==authEpoch||!authenticated)return;if(outcome.state!=='loaded')notice('Bundled language data is invalid. Original wording remains active.','隨附用詞資料無效，繼續使用原本用詞。');}
  if(epoch!==authEpoch||!authenticated)return;
  localStorage.setItem('console-seed-checked','yes');
 }
}
async function session(){const epoch=authEpoch;const result=await api('/api/session');if(epoch!==authEpoch)return;csrf=result.csrf;setup=result.setup;if(!result.authenticated){lock();render();return;}authenticated=true;await wording();if(epoch!==authEpoch||!authenticated)return;$('locked').hidden=true;$('workspace').hidden=false;render();await refresh();if(epoch!==authEpoch||!authenticated)return;focusPage(setupStage==='access'?'access':'workload');}
async function refresh(){
 const epoch=authEpoch, value=await api('/api/status');
 if(epoch!==authEpoch||!authenticated)return;
 noWeb=value.webAvailable===false;scopedTls=value.scopedTls===true;
 $('workload-enrollment').hidden=!value.enrollmentAvailable||value.healthy;
 $('scoped-tls-limit').hidden=!scopedTls;
 setupStage=value.setupStage||'workload';
 $('mode').value=value.tunnel.mode;$('named').hidden=value.tunnel.mode!=='named';
 $('name').textContent=value.name;
 $('target').textContent=value.target||owned('No web address configured','未設定網頁地址');
 $('health').textContent=noWeb?owned('No web interface. HTTP health was not verified.','沒有網頁介面，未有驗證 HTTP 健康狀態。'):owned(value.healthy?'Application is responding':'Application is not responding',value.healthy?'應用程式有回應':'應用程式未有回應');
 const states={running:['Container is running','容器正在運行'],stopped:['Container is stopped','容器已停止'],unavailable:['Container status unavailable','未能取得容器狀態'],unknown:['Container state is unverified','容器狀態未經驗證']};
 const state=states[value.containerState]||states.unknown;
 $('container-state').textContent=owned(...state);
 if(noWeb||!value.browserTlsReady){$('open').removeAttribute('href');$('open').setAttribute('aria-disabled','true');$('open').tabIndex=-1;}
 else{$('open').href=value.target;$('open').removeAttribute('aria-disabled');$('open').tabIndex=0;}
 $('no-web-access').hidden=!noWeb;
 ['mode','credential','auth-confirm','public-confirm','apply-access'].forEach(id=>$(id).disabled=noWeb||scopedTls);
 $('tunnel-status').textContent=owned(`Connection: ${value.tunnel.state} (${value.tunnel.mode})`,`連線：${value.tunnel.state} (${value.tunnel.mode})`);
 $('public-address').textContent=value.tunnel.address||'';
 if(!noWeb&&!value.tunnel.available)notice('Tunnel client unavailable in this image.','呢個映像未有隧道工具。');
 renderSetup();
}
async function action(button,task){button.disabled=true;activeOperations++;$('operation-progress').hidden=false;renderSetup();try{await task();}catch{notice('Action did not complete. Check your input, session and application status.','操作未完成，請檢查輸入、登入狀態同應用程式。');}finally{button.disabled=false;activeOperations--;$('operation-progress').hidden=activeOperations===0;renderSetup();}}
document.querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{$(button.dataset.clear).value='';$(button.dataset.clear).focus();});
$('auth').onsubmit=event=>{event.preventDefault();action($('sign-in'),async()=>{const password=$('password').value;$('password').value='';const result=await api(setup?'/api/setup':'/api/login',{password});authorization=result.authorization;await session();});};
$('logout').onclick=()=>action($('logout'),async()=>{const pending=api('/api/logout',{});lock();await pending;await session();});
$('refresh').onclick=()=>action($('refresh'),refresh);
$('refresh-access').onclick=()=>action($('refresh-access'),refresh);
function focusPage(page){['workload','access','settings'].forEach(id=>$(id).hidden=id!==page);document.querySelectorAll('[data-page]').forEach(item=>item.setAttribute('aria-current',item.dataset.page===page?'page':'false'));const heading=$(page).querySelector('h1');heading.tabIndex=-1;heading.focus();}
document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{['workload','access','settings'].forEach(id=>$(id).hidden=id!==button.dataset.page);document.querySelectorAll('[data-page]').forEach(item=>item.setAttribute('aria-current',item===button?'page':'false'));focusPage(button.dataset.page);});
$('mode').onchange=()=>{$('named').hidden=$('mode').value!=='named';};
$('tunnel-form').onsubmit=event=>{event.preventDefault();if(noWeb||scopedTls)return;action($('apply-access'),async()=>{const credential=$('credential').value;$('credential').value='';await api('/api/tunnel',{mode:$('mode').value,credential,authenticationConfirmed:$('auth-confirm').checked,publicConsent:$('public-confirm').checked});await refresh();notice('Access mode applied. Public endpoint verification remains separate.','連線模式已套用，公開地址仍需另外驗證。');});};
$('language').onchange=()=>{language=$('language').value;localStorage.setItem('console-language',language);render();if(authenticated)action($('refresh'),refresh);};
function theme(){const value=localStorage.getItem('console-theme')||'system';$('theme').value=value;document.documentElement.dataset.theme=value;}
$('theme').onchange=()=>{localStorage.setItem('console-theme',$('theme').value);theme();};
async function importFile(file){
 if(!authenticated||!controller)return;
 const epoch=authEpoch, active=controller;
 if(!file||file.size>262144||!file.name.toLowerCase().endsWith('.json')){notice('Select a valid JSON file under 256 KiB.','請選擇不超過 256 KiB 嘅有效 JSON 檔。');return;}
 const bytes=new Uint8Array(await file.arrayBuffer());if(epoch!==authEpoch||!authenticated)return;
 const result=await active.importBytes(bytes);if(epoch!==authEpoch||!authenticated)return;
 if(result.state!=='loaded'){notice('Invalid language data. Existing wording was preserved.','用詞資料無效，已保留原有設定。');return;}
 localStorage.setItem('console-seed-checked','yes');render();$('celebration').textContent=controller.appliedHeadline()||owned('Personal wording applied','已套用個人用詞');$('celebration').hidden=false;clearTimeout(celebrationTimer);celebrationTimer=setTimeout(()=>{$('celebration').hidden=true;$('celebration').textContent='';},3000);
}
$('vocabulary').onchange=()=>action($('clear-wording'),async()=>{await importFile($('vocabulary').files[0]);$('vocabulary').value='';});
$('clear-wording').onclick=()=>action($('clear-wording'),async()=>{const epoch=authEpoch,active=controller;if(!authenticated||!active)return;await active.clear();localStorage.setItem('console-seed-checked','yes');if(epoch===authEpoch&&authenticated)render();});
document.addEventListener('dragover',event=>event.preventDefault());document.addEventListener('drop',event=>{event.preventDefault();if(authenticated)action($('clear-wording'),()=>importFile(event.dataTransfer.files[0]));});
document.querySelector('[data-page=workload]').setAttribute('aria-current','page');
theme();render();session().catch(()=>notice('Console unavailable. Reload to retry.','控制台未能連線，請重新載入。'));
// Poll authentication to remove private in-memory presentation after expiry.
setInterval(async()=>{if(!authenticated)return;try{const value=await api('/api/session');if(!value.authenticated){lock();csrf=value.csrf;}}catch{lock();}},15000);

function renderSetup(){
 const visible=authenticated&&setupStage!=='complete';
 $('setup-flow').hidden=!visible;
 document.querySelectorAll('[data-page]').forEach(button=>button.disabled=visible);
 if(!visible)return;
 const access=setupStage==='access';
 $('setup-heading').textContent=owned(access?'Step 3 of 3: optional remote access':'Step 2 of 3: verify the application',access?'第 3 步（共 3 步）：可選遙距連線':'第 2 步（共 3 步）：驗證應用程式');
 $('setup-progress').value=access?2:1;
 ['setup-next','setup-skip','setup-finish'].forEach(id=>$(id).disabled=activeOperations>0);
 $('setup-back').disabled=!access||activeOperations>0;
 $('setup-back').title=access?'':owned('The owner is already saved. Lock the console to pause setup.','擁有人已儲存，鎖定控制台即可暫停設定。');
 $('setup-next').textContent=noWeb?owned('Continue without web verification','不驗證網頁並繼續'):owned('Verify application and continue','驗證應用程式並繼續');
 $('setup-finish').textContent=noWeb?owned('Finish without web verification','不驗證網頁並完成'):owned('Finish setup','完成設定');
 $('setup-next').hidden=access;
 $('setup-skip').hidden=!access;
 $('setup-finish').hidden=!access;
 document.querySelectorAll('[data-page]').forEach(button=>button.disabled=visible);
}
async function saveStage(stage){
 const epoch=authEpoch;
 await api('/api/setup-progress',{stage,noWebAcknowledged:noWeb});
 if(epoch!==authEpoch||!authenticated)return;
 await refresh();
 if(epoch!==authEpoch||!authenticated)return;
 focusPage(stage==='access'?'access':'workload');
 if(stage==='complete'){
  document.querySelectorAll('[data-page]').forEach(button=>button.disabled=false);
  if(noWeb)notice('Console setup completed. No web interface or HTTP health was verified.','控制台設定已完成，未有驗證網頁介面或 HTTP 健康狀態。');
  else notice('Setup completed. The application workspace is ready.','設定已完成，可以使用應用程式工作區。');
 }else $('setup-heading').focus();
}
$('setup-next').onclick=()=>action($('setup-next'),()=>saveStage('access'));
$('setup-back').onclick=()=>action($('setup-back'),()=>saveStage('workload'));
$('setup-finish').onclick=()=>action($('setup-finish'),()=>saveStage('complete'));
$('setup-skip').onclick=()=>action($('setup-skip'),async()=>{await api('/api/tunnel',{mode:'off'});await saveStage('complete');});
$('resume-setup').onclick=()=>action($('resume-setup'),()=>saveStage('workload'));

$('start-enrollment').onclick=()=>action($('start-enrollment'),async()=>{
 const epoch=authEpoch;clearEnrollment();
 await api('/api/workload-enrollment/start',{});
 if(epoch!==authEpoch||!authenticated)return;
 $('enrollment-form').hidden=false;$('workload-username').focus();
 notice('Protected enrollment is ready. Enter the new workload owner details.','受保護設定已準備好，請輸入新擁有人資料。');
});
$('enrollment-form').onsubmit=event=>{
 event.preventDefault();
 const fields={username:$('workload-username').value,password:$('workload-password').value,confirm:$('workload-confirm').value};
 clearEnrollment();
 action($('submit-enrollment'),async()=>{
  const epoch=authEpoch;
  try{
   const result=await api('/api/workload-enrollment/submit',fields);
   if(epoch!==authEpoch||!authenticated)return;
   await refresh();if(epoch!==authEpoch||!authenticated)return;
   notice(result.productiveHealthy?'Owner saved. The workload responded through verified TLS. Browser access remains unavailable.':'Owner saved. Workload startup is still pending; use Check status to verify readiness.',result.productiveHealthy?'擁有人已儲存，工作負載已透過驗證 TLS 回應。瀏覽器連線仍未開放。':'擁有人已儲存，工作負載仍在啟動；請按檢查狀態確認。');
  }finally{fields.username='';fields.password='';fields.confirm='';}
 });
};
$('cancel-enrollment').onclick=()=>action($('cancel-enrollment'),async()=>{clearEnrollment();await api('/api/workload-enrollment/cancel',{});notice('Workload setup canceled. Existing data was preserved.','已取消工作負載設定，現有資料已保留。');});
