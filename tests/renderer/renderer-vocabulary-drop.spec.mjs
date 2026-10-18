import {test,expect} from '@playwright/test';
let pageErrors=[];
test.beforeEach(async({page})=>{pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));});
test.afterEach(async()=>{expect(pageErrors).toEqual([]);});
// Source-browser fixture only. Native drop delivery and screen-reader speech need
// separate packaged application acceptance with a neutral synthetic file.
async function open(page,{mode='inactive',language='en'}={}){
 await page.addInitScript(({mode,language})=>{
  localStorage.setItem('material-buildroot.wording.v1',JSON.stringify({schemaVersion:1,englishHumor:1,cantoneseHumor:1,displayName:''}));
  window.__dropSounds=[];
  let listener;const snapshot=()=>({available:mode!=='unknown',watching:true,configured:true,active:mode==='unknown'?null:mode==='active',displayName:'Classroom',revision:'fixture',credentialKind:'pin'});
  window.__mode=next=>{mode=next;listener?.(snapshot());};
  window.studio={vocabularyDropSound:async request=>{window.__dropSounds.push(request);if(window.__rejectSound)throw Error('fixture audio unavailable');return {ok:true};},bootstrap:async()=>({language,revision:'0'.repeat(40),projectId:'desktop-settings',capability:'fixture',storage:'ready',origin:'default',version:'fixture',source:null,updatedAt:null}),request:async()=>({ok:false,code:'UNAVAILABLE'}),windowControl:async()=>true,onEvent:()=>()=>{},sharedMode:async()=>({ok:true,result:snapshot()}),onSharedMode:callback=>{listener=callback;return()=>listener=undefined;}};
 },{mode,language});await page.goto('/');
 await expect(page.locator('personal-vocabulary-drop')).toHaveCount(1);
 await page.locator('nav[aria-label]').first().getByRole('button',{name:/^Settings|^設定/}).click();
 return page.locator('personal-vocabulary-panel');
}
const valid=JSON.stringify({schemaVersion:1,entries:{Settings:'Preferences','private vocabulary':'Local labels applied'}});
async function drop(page,text,{name='neutral-fixture.json',count=1}={}){
 return page.evaluate(({text,name,count})=>{
  const data=new DataTransfer();for(let i=0;i<count;i++)data.items.add(new File([text],name,{type:name.endsWith('.json')?'application/json':'text/plain'}));
  const root=document.querySelector('material-buildroot').shadowRoot;const modal=root.querySelector('md-dialog[open]');const target=modal?.querySelector('[slot=content]')??root.querySelector('#workspace-heading');
  const event=new DragEvent('drop',{bubbles:true,composed:true,cancelable:true,dataTransfer:data});target.dispatchEvent(event);return event.defaultPrevented;
 },{text,name,count});
}
for(const sample of [
 {name:'absent',language:'en',entries:{},expected:'Personal wording applied'},
 {name:'empty',language:'zh-HK',entries:{'private vocabulary':''},expected:'已套用個人用語'},
 {name:'ordinary whitespace',language:'bilingual',entries:{'private vocabulary':' \t\r\n '},expected:'Personal wording applied · 已套用個人用語'},
 {name:'nonblank with surrounding whitespace',language:'en',entries:{'private vocabulary':' \tLocal labels applied\r\n '},expected:' \tLocal labels applied\r\n '},
 {name:'non-whitespace invisible character',language:'en',entries:{'private vocabulary':'\u200b'},expected:'\u200b'},
])test(`heading presentation preserves mapping: ${sample.name}`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page,{language:sample.language});
 await drop(page,JSON.stringify({schemaVersion:1,entries:sample.entries}));
 const feedback=page.locator('personal-vocabulary-feedback');const status=feedback.locator('[role=status]');
 // Exact text comparison intentionally preserves whitespace, unlike toHaveText.
 await expect.poll(()=>status.textContent()).toBe(sample.expected);
 await expect(status).toHaveAttribute('aria-live','polite');await expect(feedback.locator('md-filled-card')).toBeVisible();
 const stored=await page.evaluate(async()=>{
  const request=indexedDB.open('material-buildroot-private-language-v1');
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=reject;});
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('private-cache','readonly'),read=tx.objectStore('private-cache').get('selection');read.onsuccess=()=>resolve(JSON.parse(new TextDecoder().decode(read.result)).entries);read.onerror=reject;});}finally{db.close();}
 });
 expect(stored).toEqual(sample.entries);
 expect(await page.evaluate(async()=>{const {ownedCopy}=await import('/src/renderer/owned-copy.ts');return ownedCopy('private vocabulary','unused','en');})).toBe(sample.entries['private vocabulary']??'private vocabulary');
 await expect(feedback).toHaveCount(0,{timeout:4500});
});
test('a window drop applies, privately announces, permits input, persists and clears',async({page})=>{
 const p=await open(page);const requests=[];page.on('request',r=>requests.push(r.url()));
 const search=page.locator('.settings-grid > settings-search').getByRole('textbox',{name:'Search settings',exact:true});await search.focus();
 expect(await drop(page,valid)).toBe(true);
 const overlay=page.locator('personal-vocabulary-feedback');
 await expect(page.locator('#workspace-heading')).toHaveText('Preferences');
 await expect(overlay.locator('[role=status]')).toHaveText('Local labels applied');
 await expect(overlay.locator('md-filled-card')).toBeVisible();
 await expect(overlay.locator('[role=status]')).toHaveAttribute('aria-live','polite');
 await expect(search).toBeFocused();await search.fill('appearance');await expect(search).toHaveValue('appearance');await search.fill('');
 expect(requests).toEqual([]);await expect(overlay).not.toContainText('neutral-fixture');
 await expect(overlay.locator('md-filled-card')).toHaveCount(0,{timeout:5000});
 await page.reload();await page.locator('nav[aria-label]').first().getByRole('button',{name:/^Preferences/}).click();
 await expect(page.locator('#workspace-heading')).toHaveText('Preferences');await expect(overlay.locator('md-filled-card')).toHaveCount(0);
 await p.getByRole('button',{name:'Clear local vocabulary',exact:true}).click();await expect(page.locator('#workspace-heading')).toHaveText('Settings');
});
test('invalid, oversized, non-JSON and multiple-file drops preserve the previous selection',async({page})=>{
 const p=await open(page);await drop(page,valid);await expect(p).toContainText('Local vocabulary loaded');
 for(const [text,options] of [['{}',{}],[' '.repeat(256*1024+1),{}],[valid,{name:'neutral-fixture.txt'}],[valid,{count:2}]]){
  await drop(page,text,options);await expect(page.locator('personal-vocabulary-feedback [role=status]')).toContainText('Existing wording was not changed');
  await expect(page.locator('#workspace-heading')).toHaveText('Preferences');await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toHaveCount(0);
 }
 await page.reload();await page.locator('nav[aria-label]').first().getByRole('button',{name:/^Preferences/}).click();await expect(p).toContainText('Local vocabulary loaded');
});
test('Settings success uses the same neutral reduced-motion celebration',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const p=await open(page);
 const chooser=page.waitForEvent('filechooser');await p.getByRole('button',{name:'Import local vocabulary',exact:true}).click();
 await (await chooser).setFiles({name:'neutral-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,entries:{Settings:'Preferences'}}))});
 const overlay=page.locator('personal-vocabulary-feedback');await expect(overlay.locator('[role=status]')).toHaveText('Personal wording applied');
 await expect(overlay.locator('md-filled-card')).toHaveClass('hold');
 expect(await overlay.locator('.text').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await expect(overlay.locator('md-filled-card')).toHaveCount(0,{timeout:4500});
});
for(const mode of ['active','unknown'])test(`restricted ${mode} suppresses drops and private announcements`,async({page})=>{
 await open(page,{mode});expect(await drop(page,valid)).toBe(true);await expect(page.locator('personal-vocabulary-feedback')).toHaveCount(0);
 await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toHaveCount(0);await page.evaluate(()=>window.__mode('inactive'));
 await expect(page.locator('personal-vocabulary-panel')).toContainText('No local vocabulary selected');
});
test('a shared-mode change during file reading invalidates the queued import',async({page})=>{
 await open(page);await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){const file=this;return new Promise(resolve=>{window.__releaseRead=()=>resolve(original.call(file));});};});
 await drop(page,valid);await expect.poll(()=>page.evaluate(()=>typeof window.__releaseRead)).toBe('function');
 await page.evaluate(()=>{window.__mode('active');window.__releaseRead();});await expect(page.locator('personal-vocabulary-feedback')).toHaveCount(0);
 await page.evaluate(()=>window.__mode('inactive'));await expect(page.locator('personal-vocabulary-panel')).toContainText('No local vocabulary selected');
});
test('a live restriction or clear removes an active celebration',async({page})=>{
 const p=await open(page);await drop(page,valid);await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toBeVisible();
 await page.evaluate(()=>window.__mode('active'));await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toHaveCount(0);await expect(page.locator('personal-vocabulary-feedback')).toHaveCount(0);
 await page.evaluate(()=>window.__mode('inactive'));await expect(p).toContainText('Local vocabulary loaded');
 await drop(page,valid);await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toBeVisible();await p.getByRole('button',{name:'Clear local vocabulary',exact:true}).click();await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toHaveCount(0);
});

async function openSetupModal(page){
 await page.locator('nav[aria-label]').first().getByRole('button',{name:'Resume setup',exact:true}).click();
 const dialog=page.locator('#setup-dialog');await expect(dialog).toHaveJSProperty('open',true);
 await dialog.getByRole('button',{name:'Next',exact:true}).click();
 const input=dialog.getByRole('textbox',{name:'Plan name',exact:true});await input.focus();return {dialog,input};
}
async function assertModalFeedback(page,dialog,text){
 const feedback=dialog.locator('[slot=content] personal-vocabulary-feedback');
 await expect(feedback.locator('[role=status]')).toHaveText(text);
 await expect(feedback.locator('[role=status]')).toHaveAttribute('aria-live','polite');
 expect(await feedback.evaluate(el=>({topLayer:el.matches(':popover-open'),modal:el.closest('md-dialog')?.shadowRoot.querySelector('dialog')?.matches(':modal'),hidden:el.closest('[aria-hidden=true]')!==null}))).toEqual({topLayer:true,modal:true,hidden:false});
 await expect(feedback.locator('md-filled-card')).toBeVisible();
 // Require the actual registered library primitive, not a renamed custom div.
 expect(await feedback.locator('md-filled-card').evaluate(el=>({name:el.constructor.name,elevation:!!el.shadowRoot.querySelector('md-elevation'),background:!!el.shadowRoot.querySelector('.background'),outline:!!el.shadowRoot.querySelector('.outline')}))).toEqual({name:'MdFilledCard',elevation:true,background:true,outline:true});
 expect(await feedback.locator('md-filled-card').evaluate(card=>{
  const r=card.getBoundingClientRect();let hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  while(hit?.shadowRoot?.elementFromPoint){const next=hit.shadowRoot.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(!next||next===hit)break;hit=next;}
  for(let node=hit;node;node=node.parentNode instanceof ShadowRoot?node.parentNode.host:node.parentNode)if(node===card)return true;
  return false;
 })).toBe(true);
 return feedback;
}
for(const outcome of ['applied','invalid','unavailable'])test(`modal ${outcome} feedback is visible and inside the accessible modal boundary`,async({page})=>{
 await open(page);const {dialog,input}=await openSetupModal(page);
 if(outcome==='unavailable')await page.evaluate(()=>{File.prototype.arrayBuffer=()=>Promise.reject(new DOMException('Fixture read unavailable','NotReadableError'));});
 await drop(page,outcome==='invalid'?'{}':valid);
 const text=outcome==='applied'?'Local labels applied':outcome==='invalid'?'Choose one valid vocabulary JSON file, no larger than 256 KiB. Existing wording was not changed.':'The local file or storage could not confirm the change. Reload and review the saved wording before retrying.';
 await assertModalFeedback(page,dialog,text);await expect(input).toBeFocused();await input.fill('Still editing');await expect(input).toHaveValue('Still editing');
 await expect(dialog).toHaveJSProperty('open',true);await expect(page.locator('personal-vocabulary-feedback')).toHaveCount(0,{timeout:5000});await expect(input).toBeFocused();
});
test('modal mode suppression immediately clears the portal and accessible private heading',async({page})=>{
 await open(page);const {dialog,input}=await openSetupModal(page);await drop(page,valid);await assertModalFeedback(page,dialog,'Local labels applied');
 const retained=await page.locator('personal-vocabulary-feedback').elementHandle();
 await page.evaluate(()=>window.__mode('active'));await expect(page.locator('personal-vocabulary-feedback')).toHaveCount(0);
 expect(await retained.evaluate(el=>({connected:el.isConnected,text:el.shadowRoot.querySelector('.announcement')?.textContent??'',label:el.shadowRoot.querySelector('md-filled-card')?.getAttribute('aria-label')??null}))).toEqual({connected:false,text:'',label:null});
 await expect(input).toBeFocused();await expect(dialog).toHaveJSProperty('open',true);await retained.dispose();
});
test('maximum heading stays complete and can be keyboard-scrolled without trapping the modal',async({page})=>{
 await page.setViewportSize({width:960,height:600});await page.emulateMedia({reducedMotion:'reduce'});await open(page);const {dialog,input}=await openSetupModal(page);
 const headline=('L\n').repeat(500);expect([...headline]).toHaveLength(1000);
 await drop(page,JSON.stringify({schemaVersion:1,entries:{'private vocabulary':headline}}));
 const feedback=await assertModalFeedback(page,dialog,headline);const card=feedback.locator('md-filled-card');
 await expect(feedback.locator('.text')).toHaveText(headline);await expect(input).toBeFocused();
 expect(await card.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth&&el.scrollHeight>el.clientHeight;})).toBe(true);
 await card.focus();await page.keyboard.press('PageDown');await expect.poll(()=>card.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await input.focus();await input.fill('No focus trap');await expect(input).toHaveValue('No focus trap');await expect(dialog).toHaveJSProperty('open',true);
});


test('drop sound follows persisted outcome once and never replayed on restore',async({page})=>{
 const panel=await open(page);await drop(page,valid);
 await expect.poll(()=>page.evaluate(()=>window.__dropSounds)).toEqual([{kind:'applied'}]);
 await expect(panel).toContainText('Local vocabulary loaded');
 await page.reload();await expect(page.locator('personal-vocabulary-drop')).toHaveCount(1);
 expect(await page.evaluate(()=>window.__dropSounds)).toEqual([]);
});

test('each invalid drop sounds once and preserves the existing wording',async({page})=>{
 await open(page);await drop(page,valid);await expect.poll(()=>page.evaluate(()=>window.__dropSounds.length)).toBe(1);
 for(const [text,options] of [['{}',{}],[valid,{name:'not-json.txt'}],['x'.repeat(256*1024+1),{}],[valid,{count:2}]])await drop(page,text,options);
 await expect.poll(()=>page.evaluate(()=>window.__dropSounds)).toEqual([{kind:'applied'},...Array.from({length:4},()=>({kind:'invalid'}))]);
 await expect(page.locator('#workspace-heading')).toHaveText('Preferences');
});

test('rapid serialized drops emit one sound per outcome even when playback rejects',async({page})=>{
 await open(page);await page.evaluate(()=>window.__rejectSound=true);
 await drop(page,valid);await drop(page,'{}');await drop(page,valid);
 await expect.poll(()=>page.evaluate(()=>window.__dropSounds)).toEqual([{kind:'applied'},{kind:'invalid'},{kind:'applied'}]);
 await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toBeVisible();
 await expect(page.locator('#workspace-heading')).toHaveText('Preferences');
});

test('restricted and unavailable outcomes never sound, and Settings import is silent',async({page})=>{
 const panel=await open(page,{mode:'active'});await drop(page,valid);expect(await page.evaluate(()=>window.__dropSounds)).toEqual([]);
 await page.evaluate(()=>window.__mode('inactive'));await expect(panel).toContainText('No local vocabulary selected');
 await page.evaluate(()=>{File.prototype.arrayBuffer=async()=>{throw Error('fixture read unavailable');};});
 await drop(page,valid);await expect(page.locator('personal-vocabulary-feedback[data-outcome=unavailable]')).toBeVisible();
 expect(await page.evaluate(()=>window.__dropSounds)).toEqual([]);
 await page.reload();await page.evaluate(()=>window.__mode('inactive'));await page.locator('nav[aria-label]').first().getByRole('button',{name:/^Settings/}).click();
 const chooser=page.waitForEvent('filechooser');await panel.getByRole('button',{name:'Import local vocabulary',exact:true}).click();
 await (await chooser).setFiles({name:'neutral.json',mimeType:'application/json',buffer:Buffer.from(valid)});
 await expect(panel).toContainText('Local vocabulary loaded');expect(await page.evaluate(()=>window.__dropSounds)).toEqual([]);
});

test('a pending drop stays silent before validation and when restriction interrupts it',async({page})=>{
 await open(page);await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){return new Promise(resolve=>{window.__releaseSoundRead=async()=>resolve(await original.call(this));});};});
 await drop(page,valid);await expect.poll(()=>page.evaluate(()=>typeof window.__releaseSoundRead)).toBe('function');
 expect(await page.evaluate(()=>window.__dropSounds)).toEqual([]);
 await page.evaluate(()=>{window.__mode('active');window.__releaseSoundRead();});
 await expect(page.locator('personal-vocabulary-feedback')).toHaveCount(0);expect(await page.evaluate(()=>window.__dropSounds)).toEqual([]);
});


test('native playback is ordered without blocking imports and clear discards queued audio',async({page})=>{
 const panel=await open(page);
 await page.evaluate(()=>{window.studio.vocabularyDropSound=request=>{window.__dropSounds.push(request);return new Promise(resolve=>window.__releaseNativeSound=resolve);};});
 await drop(page,valid);await expect.poll(()=>page.evaluate(()=>window.__dropSounds.length)).toBe(1);
 await drop(page,'{}');await expect(page.locator('personal-vocabulary-feedback[data-outcome=invalid]')).toBeVisible();
 await drop(page,valid);await expect(page.locator('personal-vocabulary-feedback[data-outcome=applied]')).toBeVisible();
 expect(await page.evaluate(()=>window.__dropSounds)).toEqual([{kind:'applied'}]);
 await page.evaluate(()=>window.__releaseNativeSound({ok:true,status:'requested'}));
 await expect.poll(()=>page.evaluate(()=>window.__dropSounds)).toEqual([{kind:'applied'},{kind:'invalid'}]);
 await panel.getByRole('button',{name:'Clear local vocabulary',exact:true}).click();
 await expect(panel).toContainText('No local vocabulary selected');
 await page.evaluate(()=>window.__releaseNativeSound({ok:true,status:'requested'}));
 await page.evaluate(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
 expect(await page.evaluate(()=>window.__dropSounds)).toEqual([{kind:'applied'},{kind:'invalid'}]);
 await expect(page.locator('#workspace-heading')).toHaveText('Settings');
});
