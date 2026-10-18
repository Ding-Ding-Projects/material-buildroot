import {test,expect} from '@playwright/test';
const consent='Allow execution of this exact source revision in this runtime for configuration inspection and reconciliation.';
async function open(page){
 await page.addInitScript(()=>{localStorage.setItem('material-buildroot.wording.v1',JSON.stringify({schemaVersion:1,englishHumor:1,cantoneseHumor:1,displayName:''}));window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}})};});
 await page.goto('/');await page.locator('command-surfaces').waitFor({state:'attached'});
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
  const p=document.createElement('operations-panel');p.workspace={workspaceId:'iso-workspace',name:'ISO fixture'};p.language='en';p.tab='config';p.presentation='guided';p.style.cssText='display:block;position:fixed;inset:0;height:100vh;min-width:0;width:100vw;z-index:10;background:var(--md-sys-color-surface)';
  const shell=document.querySelector('material-buildroot').shadowRoot.querySelector('.shell');for(const child of shell.children)if(child.localName!=='command-surfaces')child.style.display='none';shell.style.overflow='auto';shell.prepend(p);window.__permissionPanel=p;window.__destinations=[];p.addEventListener('operation-destination-changed',e=>window.__destinations.push(e.detail.destination));
 });
 const p=page.locator('operations-panel').filter({has:page.locator('image-presets-panel')}).first(),iso=p.locator('image-presets-panel');
 await expect.poll(()=>page.evaluate(()=>!window.__permissionPanel.pending&&!window.__permissionPanel.shadowRoot.querySelector('image-presets-panel')?.isoBusy)).toBe(true);
 return {p,iso,review:async()=>{
  const action=iso.getByRole('button',{name:'Review source execution permission',exact:true});
  if(!await action.isVisible())await iso.getByRole('button',{name:'Next',exact:true}).click();
  await action.click();
 }};
}
async function approve(p){await p.getByRole('checkbox',{name:consent,exact:true}).check();await p.getByRole('button',{name:'Allow this scope',exact:true}).click();}
const isoChecks=page=>page.evaluate(()=>window.__permissionCalls.filter(r=>r.action==='imagePreset.catalog').length);

test('guided presentation reclaims the explorer and dock space and labels the active region',async({page})=>{
 const {p}=await open(page);
 for(const width of [1440,960]){
  await page.setViewportSize({width,height:width===960?640:960});
  await expect(p.locator('.explorer')).toBeHidden();await expect(p.locator('.dock')).toBeHidden();await expect(p.locator('.operations > md-tabs')).toBeHidden();
  const geometry=await p.evaluate(el=>{const root=el.shadowRoot,host=el.getBoundingClientRect(),editor=root.querySelector('.editor-frame').getBoundingClientRect(),region=root.querySelector('#operation-content-config');return {left:editor.left-host.left,width:editor.width/host.width,height:region.getBoundingClientRect().height,overflow:region.scrollWidth-region.clientWidth,label:region.getAttribute('aria-labelledby'),heading:root.querySelector('#operation-heading').textContent};});
  expect(geometry.left).toBeLessThan(2);expect(geometry.width).toBeGreaterThan(.98);expect(geometry.height).toBeGreaterThan(400);expect(geometry.overflow).toBeLessThanOrEqual(1);expect(geometry.label).toBe('operation-heading');expect(geometry.heading).toBe('Configuration');
 }
});
test('configuration sections show one real surface and retain image identity through all destinations',async({page})=>{
 const {p,iso}=await open(page);
 await page.evaluate(()=>window.__retainedIso=window.__permissionPanel.shadowRoot.querySelector('image-presets-panel'));
 await expect(iso).toBeVisible();await expect(p.locator('account-provisioning-panel')).toBeHidden();await expect(p.locator('defconfig-panel')).toBeHidden();
 await p.getByRole('button',{name:'Accounts',exact:true}).click();await expect(p.locator('account-provisioning-panel')).toBeVisible();await expect(iso).toBeHidden();
 await p.getByRole('button',{name:'Image guide',exact:true}).last().click();
 for(const destination of ['source','runtime','builds','artifacts','guests','assistant','regex','tools','companion','authenticator','updates','documentation','package','config']){
  await p.evaluate(async(el,destination)=>{el.tab=destination;await el.updateComplete;},destination);
  expect(await page.evaluate(()=>window.__permissionPanel.shadowRoot.querySelector('image-presets-panel')===window.__retainedIso)).toBe(true);
 }
 await expect(iso).toBeVisible();expect(await page.evaluate(()=>window.__destinations.at(-1))).toBe('config');
});
test('workflow navigation accepts only the owning workspace and fixed destinations',async({page})=>{
 const {p}=await open(page);
 for(const detail of [{workspaceId:'other-workspace',destination:'runtime'},{workspaceId:'iso-workspace',destination:'shell'},{destination:'source'},null]){
  await p.evaluate((el,detail)=>el.dispatchEvent(new CustomEvent('guided-workflow-navigate',{bubbles:true,composed:true,detail})),detail);
  expect(await p.evaluate(el=>el.tab)).toBe('config');
 }
 await p.evaluate(el=>el.dispatchEvent(new CustomEvent('guided-workflow-navigate',{bubbles:true,composed:true,detail:{workspaceId:'iso-workspace',destination:'source'}})));
 await expect(p.locator('source-panel')).toBeVisible();expect(await page.evaluate(()=>window.__destinations.at(-1))).toBe('source');
 expect(await page.evaluate(()=>window.__permissionCalls.some(r=>['build.submit','config.trustGrant','config.apply'].includes(r.action)))).toBe(false);
});
test('public project entry selects create and open without discarding the typed draft',async({page})=>{
 const {p}=await open(page);await p.evaluate(el=>el.openProjectWorkflow('create'));
 const workflow=p.locator('project-workflow-panel');
 const draft=workflow.getByRole('textbox',{name:'New source folder name',exact:true});await draft.fill('retained-draft');
 await p.evaluate(el=>el.openProjectWorkflow('open'));await expect(draft).toHaveCount(0);
 await p.evaluate(el=>el.openProjectWorkflow('create'));await expect(draft).toHaveValue('retained-draft');
 expect(await page.evaluate(()=>window.__permissionCalls.some(r=>['project.adopt','source'].includes(r.action)))).toBe(false);
});
test('guided permission review returns visible focus to the same image child and expires on navigation',async({page})=>{
 const {p,iso,review}=await open(page);await page.evaluate(()=>window.__retainedIso=window.__permissionPanel.shadowRoot.querySelector('image-presets-panel'));
 await review();await expect(p.locator('#source-execution-permission')).toBeVisible();await expect(iso).toBeHidden();
 await p.getByRole('button',{name:'Return to ISO guide',exact:true}).click();await expect(iso).toBeVisible();
 expect(await page.evaluate(()=>window.__permissionPanel.shadowRoot.querySelector('image-presets-panel')===window.__retainedIso)).toBe(true);
 await review();await p.getByRole('checkbox',{name:consent,exact:true}).check();await p.getByRole('button',{name:'Accounts',exact:true}).click();
 await p.getByRole('button',{name:'Configuration',exact:true}).click();await expect(p.locator('#source-execution-permission')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__permissionCalls.some(r=>r.action==='config.trustGrant'))).toBe(false);
});
test('builds retains the project queue, recovery and output while admission is collapsed',async({page})=>{
 const {p}=await open(page);await p.evaluate(el=>el.tab='builds');
 await expect(p.locator('.build-admission')).not.toHaveAttribute('open');await expect(p.locator('build-queue-panel')).toBeVisible();
 await expect(p.getByRole('button',{name:'Inspect queue',exact:true})).toBeVisible();await expect(p.getByRole('button',{name:'Refresh project queue',exact:true})).toBeVisible();
 await p.locator('.build-admission summary').click();await expect(p.getByRole('button',{name:'Start build',exact:true})).toBeVisible();
});
test('legacy remains the default with its existing navigation',async({page})=>{
 const {p}=await open(page);await p.evaluate(el=>el.presentation='legacy');
 await expect(p.locator('.explorer')).toBeVisible();await expect(p.locator('.operations > md-tabs')).toBeVisible();await expect(p.locator('.dock')).toBeVisible();
 expect(await page.evaluate(()=>document.createElement('operations-panel').presentation)).toBe('legacy');
});

test('late grant after a configuration section change never resumes the hidden image guide',async({page})=>{
 const {p,review}=await open(page);await review();const before=await isoChecks(page);await page.evaluate(()=>window.__delayGrant=true);await approve(p);
 await expect.poll(()=>page.evaluate(()=>typeof window.__releaseGrant)).toBe('function');
 await p.getByRole('button',{name:'Accounts',exact:true}).click();await page.evaluate(()=>window.__releaseGrant());
 await expect.poll(()=>page.evaluate(()=>window.__permissionPanel.pending)).toBe(false);
 expect(await isoChecks(page)).toBe(before);await expect(p.locator('account-provisioning-panel')).toBeVisible();await expect(p.locator('#source-execution-permission')).toHaveCount(0);
});
test('localized navigation wraps within the minimum workspace and keeps configuration usable',async({page})=>{
 const {p}=await open(page);await page.setViewportSize({width:960,height:640});
 for(const language of ['en','zh-HK','bilingual']){
  await p.evaluate(async(el,language)=>{el.language=language;await el.updateComplete;},language);
  const geometry=await p.evaluate(el=>{const root=el.shadowRoot;return [...root.querySelectorAll('.guided-navigation,.guided-subnavigation,#operation-content-config')].map(e=>({width:e.clientWidth,overflow:e.scrollWidth-e.clientWidth,height:e.getBoundingClientRect().height}));});
  expect(geometry.every(e=>e.width>0&&e.overflow<=1)).toBe(true);expect(await p.locator('#operation-content-config').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(350);
 }
});
test('tool categories route to the existing mounted controls',async({page})=>{
 const {p}=await open(page);await p.evaluate(el=>el.tab='tools');
 for(const destination of ['guests','assistant','regex','companion','authenticator','tools']){
  await p.locator('.guided-navigation md-outlined-select').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},destination);
  await expect(p.locator('#operation-content-'+destination)).toBeVisible();
  await expect(p.locator('#operation-content-'+destination)).toHaveAttribute('aria-labelledby','operation-heading');
 }
});

test('image navigation opens the requested configuration or execution section and moves focus',async({page})=>{
 const {p}=await open(page);
 for(const destination of ['config','runtime','source','artifacts']){
  await p.evaluate(el=>el.tab='config');
  await p.evaluate((el,destination)=>el.dispatchEvent(new CustomEvent('guided-workflow-navigate',{bubbles:true,composed:true,detail:{workspaceId:'iso-workspace',destination}})),destination);
  await expect.poll(()=>p.evaluate(el=>el.shadowRoot.activeElement?.id)).toBe('operation-heading');
  if(destination==='config'){await expect(p.locator('image-presets-panel')).toBeHidden();await expect(p.getByRole('button',{name:'Inspect configuration',exact:true})).toBeVisible();}
  if(destination==='runtime'){await expect(p.locator('wsl-runtime-panel')).toBeVisible();await expect(p.locator('project-workflow-panel')).toBeHidden();}
  await expect(p.locator('#operation-content-'+destination)).toBeVisible();
 }
});
test('navigation focus is discarded when the workspace changes before rendering',async({page})=>{
 const {p}=await open(page);
 await p.evaluate(async el=>{
  el.dispatchEvent(new CustomEvent('guided-workflow-navigate',{bubbles:true,composed:true,detail:{workspaceId:'iso-workspace',destination:'runtime'}}));
  el.workspace={workspaceId:'replacement',name:'Replacement'};
  await el.updateComplete;
 });
 expect(await p.evaluate(el=>el.shadowRoot.activeElement?.id)).not.toBe('operation-heading');
});
