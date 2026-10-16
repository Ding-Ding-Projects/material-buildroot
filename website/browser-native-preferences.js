import {mountBrowserExport} from './browser-native-exports.js';
import {browserCopy} from './browser-native-tone.js';
import {protectBrowserMutation} from './browser-native-confirmation.js';
import {mountSectionSearch,mountLocalSearch} from './browser-native-search-mount.js';
const KEY = 'mb-visitor-preferences-v1';
const initial = () => ({version:1,name:'',focus:false,lowStimulation:false,timeAwareness:false,oneThing:false,momentum:false,nextAction:'',snoozeUntil:0,narration:false,screenReader:false,voiceEn:'',voiceZh:'',rate:1,pitch:1,textScale:1});
const bools = ['focus','lowStimulation','timeAwareness','oneThing','momentum','narration','screenReader'];
function decode(value) {
  if (!value || value.version !== 1) throw new Error('Unsupported preferences');
  const result = initial();
  for (const key of bools) if (typeof value[key] === 'boolean') result[key] = value[key];
  for (const [key,limit] of [['name',80],['nextAction',180],['voiceEn',500],['voiceZh',500]]) if(typeof value[key] === 'string' && value[key].length <= limit) result[key] = value[key];
  for (const [key,min,max] of [['snoozeUntil',0,Number.MAX_SAFE_INTEGER],['rate',0.5,2],['pitch',0,2],['textScale',1,2]]) if(Number.isFinite(value[key]) && value[key] >= min && value[key] <= max) result[key] = value[key];
  return result;
}
export function mountBrowserPreferences(visitor) {
  let prefs = initial(); let storageState = 'default';
  try { const stored = localStorage.getItem(KEY); if(stored) { prefs = decode(JSON.parse(stored)); storageState = 'stored'; } } catch { storageState = 'unavailable'; }
  const mode = () => document.documentElement.dataset.language;
  const l=(en,zh)=>browserCopy(en,zh);
  const localized = []; const bindings = []; const originalTitle = document.title;
  const heading = visitor.querySelector('h1'); const originalHeading = heading?.cloneNode(true);
  const section = document.createElement('section'); section.className='visitor-card'; section.id='browser-native-preferences';
  const make = (tag,en='',zh='',parent=section) => { const element=document.createElement(tag); if(en) localized.push(()=>{ element.textContent=l(en,zh); }); parent.append(element); return element; };
  const title=make('h2','Browser workspace preferences','瀏覽器工作區偏好');title.id='browser-preferences-title'; section.setAttribute('aria-labelledby',title.id);
  make('p','These settings affect this visitor workspace only, not installed applications, shared experience restrictions or companion authentication. All attention modes and narration start off. Browser storage can be cleared by the browser or other pages on this origin.','設定只影響此訪客工作區，唔會更改已安裝程式、共用體驗限制或配對驗證。全部專注模式同旁白預設關閉。瀏覽器或同一來源其他頁面可清除本機儲存。');
  const feedback=make('p');feedback.role='status';feedback.setAttribute('aria-live','polite');
  const provenance=make('p');
  let notice=['',''];
  const report=(en,zh)=>{notice=[en,zh];feedback.textContent=l(en,zh);};
  const persist=()=>{try { localStorage.setItem(KEY,JSON.stringify(prefs));storageState='stored'; } catch {storageState='unavailable';report('Preferences remain active in memory but could not be saved. Export them before leaving.','偏好只喺記憶體生效，未能儲存。離開前請匯出。');} render();};
  const row=make('div');row.className='visitor-checks';
  const toggle=(key,en,zh,explanationEn,explanationZh)=>{
    const label=make('label','','',row);const control=make('md-switch','','',label);const caption=make('span',en,zh,label);
    localized.push(()=>control.setAttribute('aria-label',l(en,zh)));bindings.push(()=>control.selected=prefs[key]);
    control.addEventListener('change',()=>{prefs[key]=control.selected;persist();});
    const details=make('details','','',section);make('summary',en,zh,details);make('p',explanationEn,explanationZh,details);
  };
  toggle('focus','Focus','專注','Highlight the last focused visitor card. Every card remains visible and interactive. Default: off.','突出最近聚焦嘅訪客卡片，其他卡片仍然可見同可操作。預設：關閉。');
  toggle('lowStimulation','Low stimulation','減少刺激','Remove optional motion in the visitor workspace. The operating system reduced-motion preference still applies. Default: off.','移除此訪客工作區嘅非必要動畫，同時尊重作業系統減少動態效果設定。預設：關閉。');
  toggle('timeAwareness','Time awareness','時間提示','Show elapsed session and idle time near the current task. This page measures elapsed time only while open. Default: off.','喺目前工作旁顯示本次使用時間同閒置時間，只計算此頁開啟期間。預設：關閉。');
  toggle('oneThing','One thing at a time','逐項處理','Keep your chosen next action visible without hiding other tasks. The action persists in this browser. Default: off.','保持你選定嘅下一步可見，唔會隱藏其他工作。下一步會保留喺此瀏覽器。預設：關閉。');
  toggle('momentum','Momentum','繼續工作提示','After ten idle minutes, show a dismissible factual prompt. Not now suppresses it for one hour. Default: off.','閒置十分鐘後顯示可關閉嘅實際狀態提示。暫時唔需要會暫停提示一小時。預設：關閉。');
  const input=(key,en,zh,limit)=>{const control=make('md-outlined-text-field');control.id='browser-preference-'+key;control.className='visitor-field';control.maxLength=limit;localized.push(()=>control.label=l(en,zh));bindings.push(()=>control.value=prefs[key]);control.addEventListener('input',()=>{prefs[key]=control.value.slice(0,limit);persist();});return control;};
  input('nextAction','Your chosen next action','你選定嘅下一步',180);
  input('name','Workspace display name (empty uses the shipped name)','工作區顯示名稱（留空使用原有名稱）',80);
  make('p','Renaming changes this visitor page heading and title only. URLs, browser storage keys, package identity and installed application names do not change.','重新命名只會改變此訪客頁標題，網址、瀏覽器儲存鍵、套件身分同已安裝程式名稱保持不變。');
  const progress=document.createElement('aside');progress.className='visitor-card';progress.id='browser-native-attention';
  const current=make('p','','',progress);const elapsed=make('p','','',progress);const prompt=make('p','','',progress);
  const snooze=make('md-text-button','Not now: one hour','暫時唔需要：一小時',progress);
  snooze.addEventListener('click',()=>{prefs.snoozeUntil=Date.now()+60*60*1000;persist();});
  let started=performance.now(),changed=performance.now(),focusCard;
  visitor.addEventListener('input',()=>{changed=performance.now();});
  visitor.addEventListener('focusin',event=>{const card=event.target.closest('.visitor-card');if(card) {focusCard?.removeAttribute('data-browser-focus');focusCard=card;focusCard.setAttribute('data-browser-focus','true');}});
  visitor.prepend(progress);
  const style=make('style');style.textContent=`#visitor-workspace[data-browser-focus-mode=true] .visitor-card[data-browser-focus=true]{outline:3px solid var(--accent);outline-offset:3px}#visitor-workspace[data-browser-low-stimulation=true] *,#visitor-workspace[data-browser-low-stimulation=true] *::before,#visitor-workspace[data-browser-low-stimulation=true] *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}#browser-native-attention p{overflow-wrap:anywhere}@media(prefers-reduced-motion:reduce){#visitor-workspace *,#visitor-workspace *::before,#visitor-workspace *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}`;
  const updateTime=()=>{
    progress.hidden=!(prefs.timeAwareness||prefs.oneThing||prefs.momentum);
    current.hidden=!prefs.oneThing;current.textContent=prefs.nextAction || l('Choose your next action in Browser workspace preferences.','請喺瀏覽器工作區偏好選擇下一步。');
    elapsed.hidden=!prefs.timeAwareness;elapsed.textContent=l(`Session: ${Math.floor((performance.now()-started)/60000)} minutes. Since an edit: ${Math.floor((performance.now()-changed)/60000)} minutes.`,`本次使用：${Math.floor((performance.now()-started)/60000)} 分鐘。距離上次編輯：${Math.floor((performance.now()-changed)/60000)} 分鐘。`);
    const idle=prefs.momentum&&performance.now()-changed>=600000&&Date.now()>=prefs.snoozeUntil;
    prompt.hidden=snooze.hidden=!idle;prompt.textContent=l('Nothing has been edited here for ten minutes or more. Your work remains available.','呢度已有至少十分鐘冇編輯，資料仍然保留。');
  };

  make('h3','Optional local narration','可選本機旁白');
  toggle('narration','Narrate operation status','朗讀操作狀態','Read generic operation status only, never notes, selected text, credentials or companion records. Voices must be reported local by the browser. Default: off.','只朗讀一般操作狀態，唔會朗讀筆記、所選文字、憑證或配對記錄。只使用瀏覽器回報為本機嘅聲音。預設：關閉。');
  toggle('screenReader','Pause narration for a screen reader','使用螢幕閱讀器時暫停旁白','Browsers cannot reliably detect your screen reader. Enable this to suppress this page narrator while keeping polite status announcements. Default: off.','瀏覽器無法可靠偵測螢幕閱讀器。啟用後會停用此頁旁白，保留禮貌狀態通知。預設：關閉。');
  const speechStatus=make('p');let voices=[];let speakingGeneration=0;let debounce;
  const voicePickers=[];
  for(const [key,locale,en,zh] of [['voiceEn','en','English voice','英文聲音'],['voiceZh','zh','Hong Kong Cantonese voice','香港粵語聲音']]) {
    const select=make('md-outlined-select');select.style.maxWidth='100%';select.style.width='100%';
    localized.push(()=>select.label=l(en,zh));
    voicePickers.push({key,locale,select});select.addEventListener('change',()=>{prefs[key]=select.value;persist();});
  }
  const numeric=(key,en,zh,min,max,step)=>{const control=make('md-outlined-text-field');control.className='visitor-field';control.type='number';control.min=String(min);control.max=String(max);control.step=String(step);localized.push(()=>control.label=l(en,zh));bindings.push(()=>control.value=String(prefs[key]));control.addEventListener('change',()=>{const value=Number(control.value);if(!Number.isFinite(value)||value<min||value>max){report('Value is outside the displayed bounds. The previous setting remains active.','數值超出顯示範圍，之前設定保持生效。');control.value=String(prefs[key]);return;}prefs[key]=value;persist();});};
  numeric('rate','Speech rate (0.5 to 2; default 1)','語速（0.5 至 2；預設 1）',0.5,2,0.1);
  numeric('pitch','Speech pitch (0 to 2; default 1)','音高（0 至 2；預設 1）',0,2,0.1);
  const matching=locale=>voices.filter(voice=>locale==='en'?/^en(?:-|$)/i.test(voice.lang):/^(zh[-_]HK|yue(?:[-_]|$))/i.test(voice.lang));
  const selectedVoice=locale=>{const list=matching(locale);const key=locale==='en'?'voiceEn':'voiceZh';return prefs[key]?list.find(v=>v.voiceURI===prefs[key]):list[0];};
  const voiceSearches=new Map();
  const refreshVoices=()=>{
    voices=typeof speechSynthesis==='undefined'?[]:speechSynthesis.getVoices().filter(v=>v.localService);
    for(const {key,locale,select} of voicePickers){select.replaceChildren();const option=document.createElement('md-select-option');option.value='';const label=document.createElement('div');label.slot='headline';label.textContent=l('Choose automatically','自動選擇');option.append(label);select.append(option);for(const voice of matching(locale)){const option=document.createElement('md-select-option');option.value=voice.voiceURI;const label=document.createElement('div');label.slot='headline';label.textContent=`${voice.name} (${voice.lang})`;option.append(label);select.append(option);}if(prefs[key]&&!matching(locale).some(v=>v.voiceURI===prefs[key])){const option=document.createElement('md-select-option');option.value=prefs[key];const label=document.createElement('div');label.slot='headline';label.textContent=l('Previously selected voice is unavailable','之前所選聲音無法使用');option.append(label);select.append(option);}select.value=prefs[key];const search=voiceSearches.get(key);if(search)search.entries=[...select.children].map((option,index)=>({id:String(index),text:option.textContent}));}
    speechStatus.textContent=typeof speechSynthesis==='undefined'?l('Speech synthesis is unavailable in this browser.','此瀏覽器無法使用語音合成。'):l(`Effective English: ${selectedVoice('en')?.name||'unavailable'}. Effective Cantonese: ${selectedVoice('zh')?.name||'unavailable'}. Only browser-reported local voices are admitted.`,`實際英文聲音：${selectedVoice('en')?.name||'無法使用'}。實際粵語聲音：${selectedVoice('zh')?.name||'無法使用'}。只接受瀏覽器回報嘅本機聲音。`);
  };
  for(const {key,select} of voicePickers){const holder=make('div');select.before(holder);voiceSearches.set(key,mountLocalSearch(holder,'Search this voice picker','搜尋此聲音選單',[],ids=>[...select.children].forEach((option,index)=>{option.hidden=!ids.has(String(index));option.style.display=option.hidden?'none':'';})));}
  const stop=()=>{speakingGeneration++;clearTimeout(debounce);if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel();};
  const speak=(en,zh)=>{
    stop();if(!prefs.narration||prefs.screenReader||document.hidden||typeof speechSynthesis==='undefined')return;
    const generation=speakingGeneration;const tracks=mode()==='zh'?[['zh',zh]]:mode()==='both'?[['en',en],['zh',zh]]:[['en',en]];
    const next=()=>{if(generation!==speakingGeneration||!tracks.length)return;const [locale,value]=tracks.shift();const voice=selectedVoice(locale);if(!voice){next();return;}const utterance=new SpeechSynthesisUtterance(value.slice(0,600));utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=prefs.rate;utterance.pitch=prefs.pitch;utterance.onend=next;utterance.onerror=()=>{speechStatus.textContent=l('Narration failed. Visual status remains available.','旁白失敗，畫面狀態仍然可用。');};speechSynthesis.speak(utterance);};next();
  };
  const sample=make('md-outlined-button','Read a status sample','朗讀狀態示例');sample.addEventListener('click',()=>speak('This is a narration sample. No desktop operation was performed.','呢個係旁白示例，並無執行桌面操作。'));
  make('md-text-button','Stop speaking','停止朗讀').addEventListener('click',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  if(typeof speechSynthesis!=='undefined')speechSynthesis.addEventListener('voiceschanged',refreshVoices);
  // Consume only fixed generic events, never arbitrary text from stored records.
  visitor.addEventListener('browser-native-status',event=>{
    const allowed={saved:['A recovery copy was saved.','已儲存復原副本。'],restored:['The visitor plan was restored.','訪客計劃已還原。'],download:['A browser download was requested. Completion is not confirmed.','已要求瀏覽器下載，尚未確認完成。'],cleared:['Selected text was cleared.','已清除所選文字。']};
    if(!Object.hasOwn(allowed,event.detail))return;clearTimeout(debounce);debounce=setTimeout(()=>speak(...allowed[event.detail]),500);
  });
  const buttons=make('div');buttons.className='visitor-actions';
  make('md-outlined-button','Export browser preferences','匯出瀏覽器偏好',buttons).addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(prefs,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='visitor-preferences.json';section.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);report('Preference download requested; confirm it in browser downloads. Voice identifiers and the chosen name/action are included.','已要求下載偏好，請喺瀏覽器下載記錄確認。內容包括聲音識別碼同所選名稱／下一步。');});
  const resetPreferences=make('md-outlined-button','Reset browser preferences','重設瀏覽器偏好',buttons);resetPreferences.addEventListener('click',()=>{try{localStorage.removeItem(KEY);}catch{report('Stored preferences could not be removed. Settings are unchanged.','未能移除已儲存偏好，設定保持不變。');return;}prefs=initial();storageState='default';stop();render();report('Browser preferences reset to their shipped defaults. Workbench notes and recovery copies are unchanged.','瀏覽器偏好已重設為原有預設值，工作區筆記同復原副本不變。');});
  protectBrowserMutation(resetPreferences,()=>l('Reset only browser attention, narration, name and next-action preferences. Plan notes, recovery copies and companion authentication are unchanged.','只重設瀏覽器專注、旁白、名稱同下一步偏好。計劃筆記、復原副本同配對驗證保持不變。'));
  const render=()=>{
    visitor.dataset.browserFocusMode=String(prefs.focus);visitor.dataset.browserLowStimulation=String(prefs.lowStimulation);
    if(heading){if(prefs.name)heading.textContent=prefs.name;else heading.replaceChildren(...[...originalHeading.childNodes].map(n=>n.cloneNode(true)));}
    document.title=prefs.name||originalTitle;
    provenance.textContent=storageState==='stored'?l('Current values come from this browser profile.','目前數值來自此瀏覽器設定檔。'):storageState==='default'?l('Using shipped defaults: all modes off, empty custom name/action, automatic voices, rate and pitch 1.','使用原有預設值：全部模式關閉、自訂名稱／下一步留空、聲音自動選擇、語速同音高為 1。'):l('Browser storage is unavailable or invalid. Values may exist only in memory.','瀏覽器儲存無法使用或格式無效，數值可能只存在記憶體。');
    bindings.forEach(update=>update());updateTime();refreshVoices();if(!prefs.narration||prefs.screenReader)stop();
  };
  mountBrowserExport(section,()=>structuredClone(prefs),'visitor-preferences','Current nonsecret visitor presentation and narration preferences');
  visitor.querySelector('#browser-native-tools')?.before(section);if(!section.isConnected)visitor.append(section);
  const relocalize=()=>{localized.forEach(update=>update());feedback.textContent=l(...notice);render();};
  document.querySelector('#language')?.addEventListener('change',relocalize);document.addEventListener('browser-native-copy-change',relocalize);
  window.addEventListener('storage',event=>{if(event.key===KEY){try{prefs=event.newValue?decode(JSON.parse(event.newValue)):initial();storageState=event.newValue?'stored':'default';render();}catch{report('Another tab supplied invalid preferences; current values were retained.','另一分頁提供無效偏好，已保留目前數值。');}}});
  const clock=setInterval(updateTime,30000);window.addEventListener('pagehide',()=>{clearInterval(clock);stop();},{once:true});
  relocalize();
  mountSectionSearch(section, 'Search browser preferences', '搜尋瀏覽器偏好');
}





