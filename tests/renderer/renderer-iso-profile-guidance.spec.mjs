import {test,expect} from '@playwright/test';
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
