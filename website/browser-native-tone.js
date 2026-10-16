import {mountBrowserExport} from './browser-native-exports.js';
import '@material/web/slider/slider.js';
const KEY='mb-visitor-tone-v1';
const defaults=()=>({version:1,en:5,zh:5,dialogEmoji:true});
let current=defaults();let stored=false;
try{const raw=localStorage.getItem(KEY);if(raw){const value=JSON.parse(raw);if(value.version!==1||![value.en,value.zh].every(n=>Number.isInteger(n)&&n>=1&&n<=5)||typeof value.dialogEmoji!=='boolean')throw Error('bounds');current={version:1,en:value.en,zh:value.zh,dialogEmoji:value.dialogEmoji};stored=true;}}catch{}
const endings={en:['','One step at a time.','No guesswork needed.','The controls can handle the paperwork.','The button can do its own paperwork.'],zh:['','逐步處理就得。','唔使靠估。','等控制項處理啲手續。','按鈕做返自己嗰份功課。']};
export function browserCopy(en,zh,language=document.documentElement.dataset.language,authored=true){
 const sentences=authored&&/[.!?]$/.test(en.trim())&&/[。！？.!?]$/.test(zh.trim());
 const english=en+(sentences&&current.en>1?' '+endings.en[current.en-1]:''),cantonese=zh+(sentences&&current.zh>1?endings.zh[current.zh-1]:'');
 return language==='en'?english:language==='zh'||language==='zh-HK'?cantonese:`${english} · ${cantonese}`;
}
export const browserDialogEmoji=()=>current.dialogEmoji;
export function mountBrowserTone(visitor){
 const root=document.createElement('section');root.className='visitor-card';root.id='browser-native-tone';const label=(en,zh)=>browserCopy(en,zh,undefined,false);
 const title=document.createElement('h2');title.id='browser-tone-title';root.setAttribute('aria-labelledby',title.id);const explanation=document.createElement('p');const status=document.createElement('p');status.role='status';status.setAttribute('aria-live','polite');const example=document.createElement('p');root.append(title,explanation);
 const controls={};for(const key of ['en','zh']){const container=document.createElement('label');const caption=document.createElement('span');const slider=document.createElement('md-slider');slider.min=1;slider.max=5;slider.step=1;slider.labeled=true;slider.value=current[key];slider.style.width='100%';container.append(caption,slider);root.append(container);controls[key]={caption,slider};slider.addEventListener('change',()=>save({...current,[key]:Number(slider.value)}));}
 const emojiLabel=document.createElement('label');const emoji=document.createElement('md-switch');const emojiText=document.createElement('span');emojiLabel.append(emoji,emojiText);root.append(emojiLabel,example,status);
 const reset=document.createElement('md-text-button');root.append(reset);reset.addEventListener('click',()=>save(defaults()));emoji.addEventListener('change',()=>save({...current,dialogEmoji:emoji.selected}));
 function render(){title.textContent=label('Browser wording style','瀏覽器措辭風格');explanation.textContent=label('English and Cantonese have independent levels 1 to 5, both defaulting to 5. Level 1 is serious. Higher levels append light authored wording without changing facts. These controls currently cover the browser-native modules, not every existing article or legacy guide.','英文同粵語各自有 1 至 5 級，兩者預設為 5。第 1 級嚴肅，其餘級別加入輕鬆措辭，但唔改變事實。目前覆蓋瀏覽器原生模組，唔包括全部現有文章或舊指南。');for(const key of ['en','zh']){const text=key==='en'?label('English humor level','英文幽默程度'):label('Cantonese humor level','粵語幽默程度');controls[key].caption.textContent=text;controls[key].slider.setAttribute('aria-label',text);controls[key].slider.value=current[key];}emojiText.textContent=label('Show decorative emoji in confirmation dialogs','確認對話框顯示裝飾表情圖示');emoji.setAttribute('aria-label',emojiText.textContent);emoji.selected=current.dialogEmoji;reset.textContent=label('Reset wording style to 5 / 5','重設措辭風格為 5／5');example.textContent=browserCopy('The selected text remains on this device.','所選文字仍然留喺此裝置。');status.textContent=stored?label('Current values are stored in this browser.','目前數值已儲存喺此瀏覽器。'):label('Using defaults or memory-only values; durable storage is not confirmed.','使用預設或只留喺記憶體嘅數值，未確認持久儲存。');}
 function save(next){if(![next.en,next.zh].every(n=>Number.isInteger(n)&&n>=1&&n<=5))return;current=next;try{localStorage.setItem(KEY,JSON.stringify(current));stored=true;}catch{stored=false;}render();document.dispatchEvent(new Event('browser-native-copy-change'));}
 mountBrowserExport(root,()=>({...current}),'visitor-wording-style','Current language humor levels and dialog decoration preference');
 visitor.append(root);render();document.querySelector('#language')?.addEventListener('change',render);window.addEventListener('storage',event=>{if(event.key!==KEY)return;try{const value=event.newValue?JSON.parse(event.newValue):defaults();if(value.version!==1||![value.en,value.zh].every(n=>Number.isInteger(n)&&n>=1&&n<=5)||typeof value.dialogEmoji!=='boolean')return;current=value;stored=!!event.newValue;render();document.dispatchEvent(new Event('browser-native-copy-change'));}catch{stored=false;render();}});
}

