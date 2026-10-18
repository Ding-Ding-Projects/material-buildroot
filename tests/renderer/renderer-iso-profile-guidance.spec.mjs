import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
async function relations(panel,kind='profile'){
 const button=panel.locator(`#iso-${kind}-info`).getByRole('button');
 await expect.poll(()=>button.evaluate((element,kind)=>{const root=element.getRootNode().host.getRootNode();return {controls:element.ariaControlsElements?.length===1&&element.ariaControlsElements[0]===root.querySelector(`#iso-${kind}-guide`),description:element.ariaDescribedByElements?.length===1&&element.ariaDescribedByElements[0]===root.querySelector(`#iso-${kind}-tooltip`)};},kind)).toEqual({controls:true,description:true});
}
async function open(page){
 await page.addInitScript(()=>localStorage.setItem('material-buildroot.wording.v1',JSON.stringify({schemaVersion:1,englishHumor:1,cantoneseHumor:1,displayName:''})));
 await page.goto('/');
 await page.evaluate(async()=>{
  await import('/src/renderer/image-presets-panel.ts');const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');
  window.__profileRequests=[];
  window.studio={operations:async request=>{window.__profileRequests.push(request);if(request.action==='project.options')return {ok:true,result:{runtime:{kind:'wsl',distribution:'Fixture'}}};if(request.action==='imagePreset.catalog')return {ok:true,result:{revision:'fixture',desktops:[]}};if(request.action==='imagePreset.isoPlan')return {ok:true,result:{revision:'fixture',profile:'x86_64-bios-grub2-initrd',applicable:true,requirements:[]}};return {ok:false,code:'FIXTURE_UNAVAILABLE'};}};
  const panel=document.createElement('image-presets-panel');panel.workspaceId='profile-fixture';panel.language='en';document.body.replaceChildren(panel);document.body.style.overflow='auto';document.documentElement.style.overflow='auto';await panel.updateComplete;
 });
 const panel=page.locator('image-presets-panel').first();await expect.poll(()=>panel.evaluate(element=>element.isoBusy)).toBe(false);return panel;
}
test('profile control owns a keyboard-operable info entry and optional source explanation',async({page})=>{
 const panel=await open(page),info=panel.getByRole('button',{name:'Explain detected image profile',exact:true});
 await relations(panel);
 await expect(info).toBeVisible();await expect(panel.locator('#iso-profile-info')).toHaveAttribute('aria-controls','iso-profile-guide');await expect(panel.locator('#iso-profile-info')).toHaveAttribute('data-guidance-target','iso-profile-control');await expect(info).toHaveAttribute('aria-expanded','false');
 const bounds=await info.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
 await info.focus();await expect(panel.getByRole('tooltip')).toBeVisible();const count=await page.evaluate(()=>window.__profileRequests.length);
 await page.keyboard.press('Enter');await expect(info).toHaveAttribute('aria-expanded','true');await expect(panel.locator('#iso-profile-guide-heading')).toBeFocused();
 await expect(panel.locator('#iso-profile-guide')).toContainText('loaded into memory');await expect(panel.locator('#iso-profile-control')).toHaveJSProperty('value','bios-iso');
 expect(await page.evaluate(()=>window.__profileRequests.length)).toBe(count);
});
test('worked profile example changes only synthetic feedback and resets on close',async({page})=>{
 const panel=await open(page),stored=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]))));await panel.getByRole('button',{name:'Explain detected image profile',exact:true}).click();const guide=panel.locator('#iso-profile-guide'),count=await page.evaluate(()=>window.__profileRequests.length);
 await guide.getByRole('button',{name:'Read-only disc example',exact:true}).click();await guide.getByRole('button',{name:'Try example',exact:true}).click();await expect(guide.getByRole('status')).toContainText('read-only');
 await expect(panel.locator('#iso-profile-control')).toHaveJSProperty('value','bios-iso');await expect(panel.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await guide.getByRole('button',{name:'Reset example',exact:true}).click();await expect(guide.getByRole('button',{name:'RAM copy example',exact:true})).toHaveAttribute('aria-pressed','true');await expect(guide.getByRole('status')).toBeEmpty();
 await guide.getByRole('button',{name:'RAM copy example',exact:true}).click();await expect(guide.getByRole('button',{name:'RAM copy example',exact:true})).toHaveAttribute('aria-pressed','true');
 await guide.getByRole('button',{name:'Try example',exact:true}).click();await expect(guide.getByRole('status')).toContainText('does not update the ISO file');
 await guide.getByRole('button',{name:'Close profile guide',exact:true}).click();await expect(panel.getByRole('button',{name:'Explain detected image profile',exact:true})).toBeFocused();await expect(guide).toBeHidden();
 await panel.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await expect(panel.locator('#iso-profile-guide').getByRole('status')).toBeEmpty();
 expect(await page.evaluate(()=>window.__profileRequests.length)).toBe(count);
 expect(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]))))).toBe(stored);
});
test('profile guide Escape returns focus and independent instances never share examples',async({page})=>{
 const first=await open(page);await page.evaluate(async()=>{const second=document.createElement('image-presets-panel');second.workspaceId='second-fixture';second.language='en';document.body.append(second);await second.updateComplete;});const second=page.locator('image-presets-panel').nth(1);
 await first.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await first.locator('#iso-profile-guide').getByRole('button',{name:'Read-only disc example',exact:true}).click();
 await second.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await expect(second.locator('#iso-profile-guide').getByRole('button',{name:'RAM copy example',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');await expect(second.locator('#iso-profile-guide')).toBeHidden();await expect(second.getByRole('button',{name:'Explain detected image profile',exact:true})).toBeFocused();await expect(first.locator('#iso-profile-guide').getByRole('button',{name:'Read-only disc example',exact:true})).toHaveAttribute('aria-pressed','true');
 await second.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await second.locator('#iso-profile-guide').getByRole('button',{name:'Read-only disc example',exact:true}).click();
 await second.evaluate(async element=>{element.remove();document.body.append(element);await element.updateComplete;});await expect(second.locator('#iso-profile-guide')).toBeHidden();
 await second.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await expect(second.locator('#iso-profile-guide').getByRole('button',{name:'RAM copy example',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('localized profile guidance fits narrow layout at both wording extremes',async({page},testInfo)=>{
 const panel=await open(page);await panel.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await page.setViewportSize({width:480,height:900});
 for(const level of [1,5])for(const language of ['en','zh-HK','bilingual']){
  await page.evaluate(async({level,language})=>{const {wording}=await import('/src/renderer/language-wording-state.ts');wording.save({englishHumor:level,cantoneseHumor:level});const p=document.querySelector('image-presets-panel');p.language=language;await p.updateComplete;},{level,language});
  await expect(panel.locator('#iso-profile-info').getByRole('button')).toHaveAccessibleName(language==='en'?'Explain detected image profile':language==='zh-HK'?'說明已偵測映像組合':'Explain detected image profile · 說明已偵測映像組合');
  expect(await panel.locator('#iso-profile-guide').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
 }
 const guide=panel.locator('#iso-profile-guide');
 await page.setViewportSize({width:480,height:Math.ceil(await guide.evaluate(element=>element.getBoundingClientRect().height))+200});
 await guide.scrollIntoViewIfNeeded();await guide.screenshot({path:testInfo.outputPath('profile-guidance-fixture.png')});
});

test('native profile relationships reject removed and wrong targets and rebind after rendering',async({page})=>{
 expect(JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).dependencies['@material/web']).toBe('2.5.0');
 const panel=await open(page);await relations(panel);
 for(const property of ['ariaControlsElements','ariaDescribedByElements'])for(const wrong of [false,true]){
  const button=panel.locator('#iso-profile-info').getByRole('button');await button.focus();await expect(button).toBeFocused();
  expect(await button.evaluate((element,{property,wrong})=>{const root=element.getRootNode().host.getRootNode();const expected=root.querySelector(property==='ariaControlsElements'?'#iso-profile-guide':'#iso-profile-tooltip');element[property]=wrong?[root.querySelector('#iso-profile-control')]:[];return element[property]?.length===1&&element[property][0]===expected;},{property,wrong})).toBe(false);
  await panel.evaluate(async element=>{element.requestUpdate();await element.updateComplete;});await relations(panel);
 }
 await panel.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await relations(panel);
 await panel.getByRole('button',{name:'Close profile guide',exact:true}).click();await relations(panel);
 await panel.getByRole('button',{name:'Explain detected image profile',exact:true}).click();await relations(panel);
 await panel.evaluate(async element=>{const button=element.shadowRoot.querySelector('#iso-profile-info').shadowRoot.querySelector('button');element.remove();if(button.ariaControlsElements!==null||button.ariaDescribedByElements!==null)throw Error('Detached relationships retained');document.body.append(element);await element.updateComplete;});await relations(panel);
 await page.evaluate(async()=>{const second=document.createElement('image-presets-panel');second.workspaceId='other';document.body.append(second);await second.updateComplete;});await relations(page.locator('image-presets-panel').nth(1));await relations(panel);
});

test('saved runtime has its own optional keyboard explanation without side effects',async({page})=>{
 const panel=await open(page),button=panel.getByRole('button',{name:'Explain saved execution runtime',exact:true});
 await expect(button).toBeVisible();
 const before=await page.evaluate(()=>({calls:window.__profileRequests.length,storage:JSON.stringify({...localStorage})}));
 await button.focus();await page.keyboard.press('Enter');await expect(panel.locator('#iso-runtime-guide-heading')).toBeFocused();
 await expect(panel.locator('#iso-runtime-guide')).toContainText('Fixture');
 await panel.getByRole('button',{name:'Try two-job example',exact:true}).click();await expect(panel.locator('#iso-runtime-guide').getByRole('status')).toContainText('2 running, 2 waiting');
 await page.keyboard.press('Escape');await expect(button).toBeFocused();await expect(panel.locator('#iso-runtime-guide')).toBeHidden();
 expect(await page.evaluate(()=>({calls:window.__profileRequests.length,storage:JSON.stringify({...localStorage})}))).toEqual(before);
});

test('runtime guide binds independent native references across close reconnect and workspace changes',async({page})=>{
 const panel=await open(page),button=panel.locator('#iso-runtime-info').getByRole('button');await relations(panel,'runtime');await relations(panel);
 await expect(panel.locator('#iso-runtime-info')).not.toHaveAttribute('role');await expect(panel.locator('#iso-runtime-info')).not.toHaveAttribute('tabindex');
 const bounds=await button.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
 expect(await panel.evaluate(element=>{const root=element.shadowRoot;return Boolean(root.querySelector('#iso-runtime-info').compareDocumentPosition(root.querySelector('#iso-runtime-control'))&Node.DOCUMENT_POSITION_FOLLOWING);})).toBe(true);
 await button.click();await panel.getByRole('button',{name:'Try two-job example',exact:true}).click();await panel.getByRole('button',{name:'Reset runtime example',exact:true}).click();await expect(panel.locator('#iso-runtime-guide').getByRole('status')).toBeEmpty();
 await panel.getByRole('button',{name:'Try two-job example',exact:true}).click();await panel.getByRole('button',{name:'Close runtime guide',exact:true}).click();await expect(button).toBeFocused();await relations(panel,'runtime');await button.click();await expect(panel.locator('#iso-runtime-guide').getByRole('status')).toBeEmpty();
 await page.evaluate(async()=>{const second=document.createElement('image-presets-panel');second.workspaceId='second-runtime';second.language='en';document.body.append(second);await second.updateComplete;});const second=page.locator('image-presets-panel').nth(1);await relations(second,'runtime');await relations(panel,'runtime');
 for(const property of ['ariaControlsElements','ariaDescribedByElements'])for(const wrong of [false,true]){
  expect(await button.evaluate((element,{property,wrong})=>{const root=element.getRootNode().host.getRootNode();const expected=root.querySelector(property==='ariaControlsElements'?'#iso-runtime-guide':'#iso-runtime-tooltip');element[property]=wrong?[root.querySelector('#iso-profile-guide')]:[];return element[property]?.length===1&&element[property][0]===expected;},{property,wrong})).toBe(false);
  await panel.evaluate(async element=>{element.requestUpdate();await element.updateComplete;});await relations(panel,'runtime');await relations(panel);
 }
 await panel.evaluate(async element=>{const button=element.shadowRoot.querySelector('#iso-runtime-info').shadowRoot.querySelector('button');element.remove();if(button.ariaControlsElements!==null||button.ariaDescribedByElements!==null)throw Error('Detached runtime references retained');document.body.prepend(element);await element.updateComplete;});await expect(panel.locator('#iso-runtime-guide')).toBeHidden();await relations(panel,'runtime');await button.click();await expect(panel.locator('#iso-runtime-guide').getByRole('status')).toBeEmpty();
 await page.evaluate(async()=>{const prior=window.studio.operations;window.studio.operations=request=>request.action==='project.options'?new Promise(resolve=>{window.__resolveRuntime=resolve;}):prior(request);const element=document.querySelector('image-presets-panel');element.workspaceId='changed-runtime';await element.updateComplete;});await expect(panel.locator('#iso-runtime-guide')).toBeHidden();await button.click();await expect(panel.locator('[data-runtime-reference]')).toHaveText('Runtime identity is unknown.');await relations(panel,'runtime');
 await page.evaluate(()=>window.__resolveRuntime({ok:true,result:{runtime:{kind:'docker',image:'example.invalid/build@sha256:'+'a'.repeat(64),uid:1000,gid:1000}}}));await expect(panel.locator('[data-runtime-reference]')).toHaveText('Docker: example.invalid/build@sha256:'+'a'.repeat(64));await expect(panel.locator('#iso-runtime-guide')).toContainText('not proof of access or readiness');
});

test('runtime guidance keeps unknown access honest and opens the admitted localized article',async({page},testInfo)=>{
 const panel=await open(page);await panel.getByRole('button',{name:'Explain saved execution runtime',exact:true}).click();
 for(const runtime of [undefined,{kind:'unknown'},{kind:'wsl',distribution:''},{kind:'docker',image:''}]){
  await panel.evaluate(async(element,runtime)=>{element.isoRuntime=runtime;element.requestUpdate();await element.updateComplete;},runtime);await expect(panel.locator('[data-runtime-reference]')).toHaveText('Runtime identity is unknown.');
 }
 await panel.evaluate(element=>element.addEventListener('open-documentation',event=>window.__runtimeArticle=event.detail.title));await panel.getByRole('button',{name:'Read runtime guide',exact:true}).click();expect(await page.evaluate(()=>window.__runtimeArticle)).toBe('ISO runtime and resources');
 await page.setViewportSize({width:480,height:900});
 for(const language of ['en','zh-HK','bilingual']){
  await panel.evaluate(async(element,language)=>{element.language=language;await element.updateComplete;},language);
  await expect(panel.locator('#iso-runtime-info').getByRole('button')).toHaveAccessibleName(language==='en'?'Explain saved execution runtime':language==='zh-HK'?'說明已儲存執行環境':'Explain saved execution runtime · 說明已儲存執行環境');await relations(panel,'runtime');
  expect(await panel.locator('#iso-runtime-guide').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
 }
 const guide=panel.locator('#iso-runtime-guide');await page.setViewportSize({width:480,height:Math.ceil(await guide.evaluate(element=>element.getBoundingClientRect().height))+200});await guide.screenshot({path:testInfo.outputPath('runtime-guidance-fixture.png')});
});
