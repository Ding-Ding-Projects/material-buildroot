import {test,expect} from '@playwright/test';
const consent='Allow execution of this exact source revision in this runtime for configuration inspection and reconciliation.';
async function open(page){
 test.setTimeout(60000);
 await page.addInitScript(()=>{localStorage.setItem('material-buildroot.wording.v1',JSON.stringify({schemaVersion:1,englishHumor:1,cantoneseHumor:1,displayName:''}));window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}})};});
 await page.goto('/',{waitUntil:'domcontentloaded',timeout:45000});await page.locator('command-surfaces').waitFor({state:'attached',timeout:45000});
 await page.evaluate(async()=>{
  await import('/src/renderer/operations-panel.ts');const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');
  window.__permissionCalls=[];window.__grantResult='success';window.__trusted=false;
  const preview={id:'fixture-challenge',domain:'buildroot',requestedDomain:'buildroot',discoveryOnly:false,sourceRoot:'/fixture/source',outputRoot:'/fixture/output',sourceRevision:'source-1',configRevision:'config-1',runtime:{kind:'wsl',distribution:'Fixture'},externalRoots:[]};
  window.studio.operations=async request=>{
   window.__permissionCalls.push(request);
   if(request.action==='project.options')return {ok:true,result:{runtime:{kind:'wsl',distribution:'Fixture'}}};
   if(request.action==='config.trustPreview'){if(window.__delayPreview)await new Promise(r=>window.__releasePreview=r);return window.__previewUnavailable?{ok:false,code:'KCONFIG_RUNTIME_UNAVAILABLE'}:{ok:true,result:{...preview}};}
   if(request.action==='config.trustGrant'){
    if(window.__delayGrant)await new Promise(r=>window.__releaseGrant=r);
    if(window.__grantResult==='unavailable')throw Error('Fixture unavailable');
    if(window.__grantResult==='expired')return {ok:false,code:'KCONFIG_SOURCE_TRUST_REQUIRED'};
    if(window.__grantResult==='denied')return {ok:true,result:{domain:'buildroot',trusted:false}};
    window.__trusted=true;return {ok:true,result:{domain:'buildroot',trusted:true}};
   }
   if(request.action==='imagePreset.catalog')return window.__trusted?{ok:true,result:{revision:'revision-1',desktops:[]}}:{ok:false,code:'KCONFIG_SEMANTICS_UNAVAILABLE'};
   if(request.action==='imagePreset.isoPlan')return {ok:true,result:{revision:'revision-1',profile:'x86_64-bios-grub2-initrd',applicable:true,requirements:[]}};
   if(request.action==='config.trustRevoke'){window.__trusted=false;return {ok:true,result:{revoked:true}};}
   return {ok:false,code:'FIXTURE_UNAVAILABLE'};
  };
  const p=document.createElement('operations-panel');p.workspace={workspaceId:'iso-workspace',name:'ISO fixture'};p.language='en';p.tab='config';
  const shell=document.querySelector('material-buildroot').shadowRoot.querySelector('.shell');for(const child of shell.children)if(child.localName!=='command-surfaces')child.style.display='none';shell.style.overflow='auto';shell.prepend(p);window.__permissionPanel=p;
 });
 const p=page.locator('operations-panel').filter({has:page.locator('image-presets-panel')}).first(),iso=p.locator('image-presets-panel');
 await expect.poll(()=>page.evaluate(()=>!window.__permissionPanel.pending&&!window.__permissionPanel.shadowRoot.querySelector('image-presets-panel')?.isoBusy)).toBe(true);
 await iso.getByRole('button',{name:'Next',exact:true}).click();
 return {p,iso,review:()=>iso.getByRole('button',{name:'Review source execution permission',exact:true}).click()};
}
async function approve(p){await p.getByRole('checkbox',{name:consent,exact:true}).check();await p.getByRole('button',{name:'Allow this scope',exact:true}).click();}
const isoChecks=page=>page.evaluate(()=>window.__permissionCalls.filter(r=>r.action==='imagePreset.catalog').length);
test('Easy ISO reviews explicit scope, focuses consent and returns once without restoring build success',async({page})=>{
 const {p,iso,review}=await open(page);await iso.getByRole('button',{name:'Check ISO prerequisites',exact:true}).click();
 await expect(iso).toContainText('ISO compatibility is not confirmed');await review();
 const section=p.locator('#source-execution-permission');await expect(section).toBeFocused();
 await expect(p.getByRole('button',{name:'Allow this scope',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__permissionCalls.some(r=>r.action==='config.trustGrant'))).toBe(false);
 const before=await isoChecks(page);await approve(p);
 await expect.poll(()=>isoChecks(page)).toBe(before+1);
 await expect(p.getByRole('button',{name:'Return to ISO guide',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>window.__permissionPanel.shadowRoot.querySelector('image-presets-panel').isoStep)).toBe(1);
 await expect(iso.getByRole('button',{name:'Build ISO image',exact:true,includeHidden:true})).toBeDisabled();
 await iso.getByRole('button',{name:'Next',exact:true}).click();
 await iso.getByRole('button',{name:'Next',exact:true}).click();
 await expect(iso.getByRole('button',{name:'Configure BIOS ISO',exact:true})).toBeVisible();
 await expect(iso.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__permissionPanel.shadowRoot.querySelector('image-presets-panel').isoStep)).toBe(3);
 await p.getByRole('button',{name:'Return to ISO guide',exact:true}).click();expect(await isoChecks(page)).toBe(before+1);
 expect(await page.evaluate(()=>window.__permissionCalls.some(r=>['imagePreset.isoApply','imagePreset.isoBuild','build.submit'].includes(r.action)))).toBe(false);
 expect(await page.evaluate(()=>localStorage.getItem('iso-workflow-iso-workspace'))).not.toContain('fixture-challenge');
});
for(const result of ['expired','denied','unavailable'])test(`ISO permission ${result} never rechecks or enables success`,async({page})=>{
 const {p,iso,review}=await open(page);await review();const before=await isoChecks(page);await page.evaluate(value=>window.__grantResult=value,result);await approve(p);
 await expect(p).toContainText('Permission was not confirmed');await expect(p.getByRole('button',{name:'Review current scope again',exact:true})).toBeVisible();
 expect(await isoChecks(page)).toBe(before);await expect(iso.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__permissionCalls.filter(r=>r.action==='config.trustGrant').length)).toBe(1);
});
test('unavailable review has an actionable return path and grants nothing',async({page})=>{
 const {p,review}=await open(page);await page.evaluate(()=>window.__previewUnavailable=true);await review();
 await expect(p).toContainText('Check project runtime access');await expect(p.getByRole('button',{name:'Return to ISO guide',exact:true})).toBeVisible();
 await expect(p.getByRole('checkbox',{name:consent,exact:true})).toHaveCount(0);expect(await page.evaluate(()=>window.__permissionCalls.some(r=>r.action==='config.trustGrant'))).toBe(false);
});
test('generic source permission does not implicitly run an ISO check',async({page})=>{
 const {p}=await open(page);await p.getByRole('button',{name:'Review source execution permission',exact:true}).last().click();const before=await isoChecks(page);await approve(p);
 await expect.poll(()=>page.evaluate(()=>window.__permissionCalls.some(r=>r.action==='config.inspect'))).toBe(true);
 expect(await isoChecks(page)).toBe(before);await expect(p.getByRole('button',{name:'Return to ISO guide',exact:true})).toHaveCount(0);
});
for(const change of ['workspace','configuration','domain','tab','disconnect'])test(`late ISO grant after ${change} cannot resume the old guide`,async({page})=>{
 const {p,review}=await open(page);await review();const before=await isoChecks(page);await page.evaluate(()=>window.__delayGrant=true);await approve(p);
 await expect.poll(()=>page.evaluate(()=>typeof window.__releaseGrant)).toBe('function');
 await page.evaluate(async change=>{const p=window.__permissionPanel;if(change==='workspace')p.workspace={workspaceId:'other-workspace',name:'Other'};if(change==='configuration')p.configurationGeneration++;if(change==='domain')p.configDomain='linux';if(change==='tab')p.tab='runtime';if(change==='disconnect')p.remove();await p.updateComplete;window.__releaseGrant();},change);
 await expect.poll(()=>page.evaluate(()=>window.__permissionPanel.pending)).toBe(false);
 expect(await isoChecks(page)).toBe(before);expect(await page.evaluate(()=>window.__permissionCalls.some(r=>r.action==='imagePreset.isoPlan'))).toBe(false);
});
test('late permission preview is discarded after source configuration changes',async({page})=>{
 const {p,review}=await open(page);await page.evaluate(()=>window.__delayPreview=true);await review();await expect.poll(()=>page.evaluate(()=>typeof window.__releasePreview)).toBe('function');
 await page.evaluate(async()=>{window.__permissionPanel.configurationGeneration++;await window.__permissionPanel.updateComplete;window.__releasePreview();});
 await expect.poll(()=>page.evaluate(()=>window.__permissionPanel.pending)).toBe(false);await expect(p.locator('#source-execution-permission')).toHaveCount(0);
});
test('permission guidance and consent localize at a narrow desktop size',async({page})=>{
 const {p,iso,review}=await open(page);await page.setViewportSize({width:800,height:900});await iso.getByRole('button',{name:'Check ISO prerequisites',exact:true}).click();await review();
 for(const language of ['zh-HK','bilingual','en']){
  await p.evaluate((element,language)=>element.language=language,language);
  await expect(iso).toContainText(language==='en'?'ISO compatibility is not confirmed':'ISO 相容性未確認');
  const section=p.locator('#source-execution-permission');
  await expect(section.getByRole('checkbox')).toHaveAccessibleName(language==='en'?consent:language==='zh-HK'?'批准在此執行環境執行此確切來源修訂，用作檢視同協調設定。':`${consent} · 批准在此執行環境執行此確切來源修訂，用作檢視同協調設定。`);
  expect(await section.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
 }
 await page.evaluate(()=>window.__grantResult='denied');await approve(p);await p.evaluate(element=>element.language='zh-HK');await expect(p).toContainText('未能確認權限');
});
