import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
const repo=process.env.RENDERER_REPO_ROOT||fileURLToPath(new URL('../../',import.meta.url));
const {test,expect}=await import(pathToFileURL(path.join(repo,'node_modules/@playwright/test/index.mjs')).href);

// Source-preview browser fixture only: this does not verify Windows or native IPC.
const initial={language:'en',revision:'0'.repeat(40),projectId:'desktop-settings',capability:'fixture-capability',storage:'ready',origin:'default',version:'fixture',source:null,updatedAt:null};
async function open(page,{bootstrap=initial,missing=false}={}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(({bootstrap,missing})=>{
  window.fixture={requests:[],bootstrapCalls:0,windowCommands:[],pendingBoot:[],pendingRequests:[],windowResult:true};
  if(missing)return;
  window.studio={bootstrap:()=>{window.fixture.bootstrapCalls++;if(window.fixture.bootstrapCalls===1&&bootstrap)return Promise.resolve(bootstrap);return new Promise((resolve,reject)=>window.fixture.pendingBoot.push({resolve,reject}));},request:request=>{window.fixture.requests.push(request);return new Promise((resolve,reject)=>window.fixture.pendingRequests.push({resolve,reject}));},onEvent:()=>()=>{},windowControl:command=>{window.fixture.windowCommands.push(command);return window.fixture.windowResult==='reject'?Promise.reject(new Error('fixture refusal')):Promise.resolve(window.fixture.windowResult);}};
 },{bootstrap,missing});
 await page.goto('/');await page.locator('material-buildroot').waitFor();
 return errors;
}
async function settings(page){await page.locator('nav md-text-button').filter({hasText:'Settings'}).click();await expect(page.locator('#workspace-heading')).toHaveText('Settings');}
const language=page=>page.locator('#language-select');
const save=page=>page.locator('md-filled-button').filter({hasText:/Save language|Saving/});
async function choose(page,value){await language(page).click();await page.locator(`md-select-option[value="${value}"]`).click();}
async function reply(page,value){await page.evaluate(value=>window.fixture.pendingRequests.shift().resolve(value),value);}
async function bootReply(page,value){await page.evaluate(value=>window.fixture.pendingBoot.shift().resolve(value),value);}
const failure=code=>({ok:false,code,message:'Fixture request failed.'});
const success=(revision='1'.repeat(40))=>({ok:true,operationId:'fixture',revision,result:{language:'zh-HK'}});

test('deferred bootstrap distinguishes loading and ready, and synchronizes document language',async({page})=>{
 const errors=await open(page,{bootstrap:null});await expect(page.locator('.shell > .status[role="status"]')).toContainText(/loading|connecting/i);
 await page.locator('nav md-text-button').filter({hasText:'Settings'}).click();await expect(save(page)).toHaveJSProperty('disabled',true);
 await bootReply(page,initial);await expect(save(page)).toHaveJSProperty('disabled',false);await expect(page.locator('html')).toHaveAttribute('lang','en');expect(errors).toEqual([]);
});
test('missing desktop bridge disables window controls without unhandled errors',async({page})=>{
 const errors=await open(page,{missing:true});await expect(page.locator('.shell > .status[role="status"]')).toContainText(/unavailable/i);const controls=page.locator('.window').getByRole('button');await expect(controls).toHaveCount(3);for(const name of ['Minimize · 最小化','Maximize or restore · 最大化或還原','Close application · 關閉應用程式'])await expect(page.locator('.window').getByRole('button',{name,exact:true})).toBeDisabled();expect(errors).toEqual([]);
});
test('successful save uses actual Material controls and updates language after reply',async({page})=>{
 const errors=await open(page);await settings(page);await choose(page,'zh-HK');await save(page).click();await expect(language(page)).toHaveJSProperty('disabled',true);await expect(save(page)).toHaveJSProperty('disabled',true);await expect(page.locator('.shell > .status[role="status"]')).toContainText(/Saving language/);await expect(page.getByRole('group',{name:'Language actions'})).toHaveAccessibleDescription('Saving language…');expect(await page.evaluate(()=>window.fixture.requests[0].arguments.language)).toBe('zh-HK');await expect(page.locator('html')).toHaveAttribute('lang','en');await reply(page,success());await expect(page.locator('html')).toHaveAttribute('lang','zh-HK');await expect(page.locator('.shell > .status[role="status"]')).toContainText(/已儲存/);await expect(page.locator('#confirmed-language')).toContainText('香港粵語');await expect(page.locator('#confirmed-language')).toContainText('已儲存喺呢部電腦');expect(errors).toEqual([]);
});
test('expired authority retries exactly once with the same operation identity',async({page})=>{
 await open(page);await settings(page);await choose(page,'zh-HK');await save(page).click();await reply(page,failure('UNAUTHORIZED'));await expect.poll(()=>page.evaluate(()=>window.fixture.pendingBoot.length)).toBe(1);await bootReply(page,{...initial,capability:'fresh-fixture'});await expect.poll(()=>page.evaluate(()=>window.fixture.requests.length)).toBe(2);
 const requests=await page.evaluate(()=>window.fixture.requests);expect(requests[1]).toEqual({...requests[0],capability:'fresh-fixture'});await reply(page,failure('UNAUTHORIZED'));await expect(save(page)).toHaveJSProperty('disabled',false);expect(await page.evaluate(()=>window.fixture.bootstrapCalls)).toBe(2);
});
test('stale revision refresh preserves draft and synchronizes current saved language',async({page})=>{
 await open(page);await settings(page);await choose(page,'bilingual');await save(page).click();await reply(page,failure('STALE_REVISION'));await expect.poll(()=>page.evaluate(()=>window.fixture.pendingBoot.length)).toBe(1);await bootReply(page,{...initial,language:'zh-HK',revision:'2'.repeat(40)});await expect(page.locator('html')).toHaveAttribute('lang','zh-HK');await expect(language(page)).toHaveJSProperty('value','bilingual');await expect(page.locator('.shell > .status[role="status"]')).toContainText(/檢視|review/i);expect(await page.evaluate(()=>window.fixture.requests.length)).toBe(1);
});
test('expired authority with changed revision never silently retries',async({page})=>{
 await open(page);await settings(page);await choose(page,'bilingual');await save(page).click();await reply(page,failure('UNAUTHORIZED'));await expect.poll(()=>page.evaluate(()=>window.fixture.pendingBoot.length)).toBe(1);await bootReply(page,{...initial,language:'zh-HK',revision:'2'.repeat(40)});await expect(page.locator('html')).toHaveAttribute('lang','zh-HK');await expect(language(page)).toHaveJSProperty('value','bilingual');await expect(page.locator('.shell > .status[role="status"]')).toContainText(/檢視|review/i);expect(await page.evaluate(()=>window.fixture.requests.length)).toBe(1);
});
test('unknown transaction outcome blocks further saves for this session',async({page})=>{
 const errors=await open(page);await settings(page);await choose(page,'zh-HK');await save(page).click();await page.evaluate(()=>window.fixture.pendingRequests.shift().reject(new Error('Fixture transport lost')));await expect(page.locator('.shell > .status[role="status"]')).toContainText(/restart/i);await expect(save(page)).toHaveJSProperty('disabled',true);await expect(page.getByRole('button',{name:'Discard choice'})).toBeDisabled();await expect(page.locator('#confirmed-language')).toContainText('Last confirmed language: English');await page.locator('nav md-text-button').filter({hasText:'Project plans'}).click();await settings(page);await expect(save(page)).toHaveJSProperty('disabled',true);expect(await page.evaluate(()=>window.fixture.requests.length)).toBe(1);expect(errors).toEqual([]);
});
test('window-command rejection and false result are announced without unhandled errors',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>window.fixture.windowResult='reject');await page.locator('.window').getByRole('button',{name:'Minimize',exact:true}).click();await expect(page.locator('.shell > .status[role="status"]')).toContainText(/window|desktop/i);await page.evaluate(()=>window.fixture.windowResult=false);await page.locator('.window').getByRole('button',{name:'Maximize or restore',exact:true}).click();await expect(page.locator('.shell > .status[role="status"]')).toContainText(/window|desktop/i);expect(errors).toEqual([]);
});
test('unavailable storage disables saving and preserves the selected draft',async({page})=>{
 await open(page);await settings(page);await choose(page,'bilingual');await save(page).click();await reply(page,failure('UNAUTHORIZED'));await expect.poll(()=>page.evaluate(()=>window.fixture.pendingBoot.length)).toBe(1);await bootReply(page,{...initial,storage:'unavailable',origin:'unavailable',capability:''});await expect(save(page)).toHaveJSProperty('disabled',true);await expect(language(page)).toHaveJSProperty('value','bilingual');await expect(page.locator('.shell > .status[role="status"]')).toContainText(/storage|unavailable/i);await expect(page.locator('#confirmed-language')).toHaveCount(0);expect(await page.evaluate(()=>window.fixture.requests.length)).toBe(1);
});
test('system theme follows media changes, explicit mode overrides them',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});await open(page);await settings(page);await expect(page.locator('.shell')).not.toHaveClass(/dark/);await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('.shell')).toHaveClass(/dark/);await page.getByRole('combobox',{name:'Theme for this session',exact:true}).click();await page.locator('md-select-option[value="light"]').click();await expect(page.locator('.shell')).not.toHaveClass(/dark/);await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('.shell')).not.toHaveClass(/dark/);
});

for(const rejection of ['STALE_REVISION','UNAUTHORIZED'])test(`failed refresh after ${rejection} blocks retry with accurate recovery guidance`,async({page})=>{
 const errors=await open(page);await settings(page);await choose(page,'bilingual');await save(page).click();await reply(page,failure(rejection));await expect.poll(()=>page.evaluate(()=>window.fixture.pendingBoot.length)).toBe(1);await page.evaluate(()=>window.fixture.pendingBoot.shift().reject(new Error('Fixture refresh unavailable')));await expect(save(page)).toHaveJSProperty('disabled',true);await expect(page.locator('.shell > .status[role="status"]')).toContainText(/restart/i);await expect(page.locator('.shell > .status[role="status"]')).not.toContainText(/Save outcome unavailable/i);await expect(page.getByRole('button',{name:'Discard choice'})).toBeDisabled();await expect(language(page)).toHaveJSProperty('value','bilingual');expect(await page.evaluate(()=>window.fixture.requests.length)).toBe(1);expect(errors).toEqual([]);
});
test('navigation focuses destination heading, marks current route and retains draft',async({page})=>{
 await open(page);await settings(page);await expect(page.locator('#workspace-heading')).toBeFocused();await expect(page.locator('nav md-text-button').filter({hasText:/Settings|設定/}).filter({hasNotText:/Setup|開始設定/})).toHaveClass(/selected/);expect(await page.locator('nav md-text-button').evaluateAll(els=>getComputedStyle(els.find(el=>el.classList.contains('selected'))).backgroundColor!==getComputedStyle(els.find(el=>!el.classList.contains('selected'))).backgroundColor)).toBe(true);await choose(page,'bilingual');await page.locator('nav md-text-button').first().click();await expect(page.locator('#workspace-heading')).toBeFocused();await expect(page.locator('nav md-text-button').first()).toHaveClass(/selected/);await settings(page);await expect(language(page)).toHaveJSProperty('value','bilingual');
});
for(const languageMode of ['en','zh-HK','bilingual'])for(const theme of ['light','dark'])for(const viewport of [{width:960,height:640},{width:1440,height:960}])test(`source-preview layout ${languageMode} ${theme} ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
 await page.setViewportSize(viewport);await page.emulateMedia({colorScheme:theme});const errors=await open(page,{bootstrap:{...initial,language:languageMode}});await page.locator('nav md-text-button').filter({hasText:/Settings|設定/}).filter({hasNotText:/Setup|開始設定/}).click();await expect(page.locator('#workspace-heading')).toBeFocused();await expect(page.locator('nav md-text-button').filter({hasText:/Settings|設定/}).filter({hasNotText:/Setup|開始設定/})).toHaveClass(/selected/);await expect(language(page)).toHaveJSProperty('disabled',false);
 const displayedLanguage=languageMode==='en'?'English':languageMode==='zh-HK'?'香港粵語':'English + 香港粵語';
 await expect(language(page)).toHaveJSProperty('displayText',displayedLanguage);
 await expect(language(page).locator('#label')).toHaveText(displayedLanguage);
 await expect.poll(()=>language(page).locator('md-outlined-field .content').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>['md-filled-button','md-outlined-button','md-text-button','md-outlined-select','md-select-option','md-dialog'].every(name=>!!customElements.get(name)))).toBe(true);
 const overflow=await page.evaluate(()=>{const root=document.querySelector('material-buildroot').shadowRoot;return [...root.querySelectorAll('.shell,header,main,.panel')].map(el=>({element:el.className||el.tagName,width:el.clientWidth,scroll:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(r=>r.scroll>r.width+1||r.left< -1||r.right>innerWidth+1);});expect(overflow).toEqual([]);
 const cdp=await page.context().newCDPSession(page);const {nodes}=await cdp.send('Accessibility.getFullAXTree');const controls=nodes.filter(n=>!n.ignored&&['button','combobox','listbox'].includes(n.role?.value));expect(controls.length).toBeGreaterThanOrEqual(8);expect(controls.some(n=>/current workspace|目前工作區/.test(n.name?.value||''))).toBe(true);const actionGroup=nodes.find(n=>!n.ignored&&n.role?.value==='group'&&/Language actions|語言操作/.test(n.name?.value||''));expect(actionGroup?.description?.value).toBe(await page.locator('#save-feedback').innerText());expect(controls.filter(n=>!n.name?.value?.trim()).map(n=>({role:n.role?.value,name:n.name?.value}))).toEqual([]);await cdp.detach();expect(errors).toEqual([]);
 await page.screenshot({path:testInfo.outputPath('source-preview.png'),fullPage:true});
});

for(const origin of ['default','saved'])test(`confirmed bilingual preference distinguishes ${origin} provenance`,async({page})=>{
 await open(page,{bootstrap:{...initial,language:'bilingual',origin}});
 await page.locator('nav md-text-button').filter({hasText:/Settings|設定/}).filter({hasNotText:/Setup|開始設定/}).click();
 await expect(page.locator('#confirmed-language')).toContainText('English + 香港粵語');
 await expect(page.locator('#confirmed-language')).toContainText(origin==='default'?'Application default':'Saved on this device');
 await expect(page.getByRole('button',{name:/Discard choice/})).toBeDisabled();
});
test('discard restores the confirmed draft locally and returns keyboard focus',async({page})=>{
 await open(page);await settings(page);await choose(page,'zh-HK');
 await expect(page.locator('#confirmed-language')).toContainText('Last confirmed language: English');
 const discard=page.getByRole('button',{name:'Discard choice'});
 await discard.focus();await page.keyboard.press('Enter');
 await expect(language(page)).toHaveJSProperty('value','en');
 await expect(language(page).locator('md-outlined-field')).toBeFocused();
 await expect(discard).toBeDisabled();
 await expect(page.locator('.shell > .status[role="status"]')).toContainText('Pending choice reset');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 expect(await page.evaluate(()=>({requests:window.fixture.requests.length,bootstraps:window.fixture.bootstrapCalls}))).toEqual({requests:0,bootstraps:1});
});
test('discard after a conflict uses the refreshed value without another mutation',async({page})=>{
 await open(page);await settings(page);await choose(page,'bilingual');await save(page).click();
 await reply(page,failure('STALE_REVISION'));
 await expect.poll(()=>page.evaluate(()=>window.fixture.pendingBoot.length)).toBe(1);
 await bootReply(page,{...initial,language:'zh-HK',origin:'saved',revision:'2'.repeat(40)});
 await expect(language(page)).toHaveJSProperty('value','bilingual');
 await expect(page.locator('#confirmed-language')).toContainText('香港粵語');
 await page.getByRole('button',{name:'放棄選擇',exact:true}).click();
 await expect(language(page)).toHaveJSProperty('value','zh-HK');
 await expect(page.locator('html')).toHaveAttribute('lang','zh-HK');
 await expect(page.getByRole('button',{name:'放棄選擇',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>({requests:window.fixture.requests.length,bootstraps:window.fixture.bootstrapCalls}))).toEqual({requests:1,bootstraps:2});
});
