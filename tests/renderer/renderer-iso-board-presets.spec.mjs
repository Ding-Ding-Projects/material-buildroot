import {test,expect} from '@playwright/test';
const replaceLabel='Replace this output configuration with the selected PC preset';
async function open(page){
 await page.addInitScript(()=>{localStorage.setItem('material-buildroot.wording.v1',JSON.stringify({schemaVersion:1,englishHumor:1,cantoneseHumor:1,displayName:''}));window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}})};});
 await page.goto('/');await page.locator('command-surfaces').waitFor({state:'attached'});
 await page.evaluate(async()=>{
  await import('/src/renderer/operations-panel.ts');const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');
  window.__boardCalls=[];window.__boardTrusted=true;window.__boardApplied=false;window.__boardEffective=true;
  const entry=(id,name,origin='buildroot',order=0)=>({id,name,origin,order,root:origin==='buildroot'?'/fixture/source':'/fixture/external',sha256:'a'.repeat(64)});
  window.__boardEntries=[entry('pc-id','pc_x86_64_bios_defconfig'),entry('qemu-id','qemu_x86_64_defconfig'),entry('efi-id','pc_x86_64_efi_defconfig'),entry('external-id','pc_x86_64_bios_defconfig','external',1)];
  window.studio.operations=async request=>{
   window.__boardCalls.push(request);
   if(request.action==='project.options')return {ok:true,result:{runtime:{kind:'wsl',distribution:'Fixture'}}};
   if(request.action==='defconfig.catalog'){if(window.__delayBoards)await new Promise(r=>window.__releaseBoards=r);return window.__boardCatalogError?{ok:false,code:window.__boardCatalogError}:{ok:true,result:{revision:'boards-revision',sourceRoot:'/fixture/source',outputRoot:'/fixture/output',externalTrees:['/fixture/external'],entries:window.__boardEntries}};}
   if(request.action==='defconfig.apply'){
    if(window.__delayBoardApply)await new Promise(r=>window.__releaseBoardApply=r);
    if(window.__boardApplyError)return {ok:false,code:window.__boardApplyError};
    if(Object.keys(request).sort().join(',')!=='action,id,revision,workspaceId')return {ok:false,code:'INVALID_REQUEST'};
    window.__boardApplied=true;window.__boardTrusted=false;return {ok:true,result:{revision:'after-board',values:{BR2_x86_64:'y',BR2_LINUX_KERNEL:window.__boardEffective?'y':'n'},undoDepth:1}};
   }
   if(request.action==='imagePreset.catalog')return window.__boardTrusted?{ok:true,result:{revision:'config-revision',desktops:[]}}:{ok:false,code:'KCONFIG_SOURCE_TRUST_CHANGED'};
   if(request.action==='imagePreset.isoPlan')return {ok:true,result:{revision:'config-revision',profile:'x86_64-bios-grub2-initrd',applicable:window.__boardApplied,requirements:[]}};
   if(request.action==='config.trustPreview')return {ok:true,result:{id:'trust-id',domain:'buildroot',discoveryOnly:false,sourceRoot:'/fixture/source',outputRoot:'/fixture/output',runtime:{kind:'wsl',distribution:'Fixture'},sourceRevision:'source',configRevision:'config',externalRoots:[]}};
   if(request.action==='config.trustGrant'){if(request.domain!=='buildroot')return {ok:false,code:'INVALID_REQUEST'};window.__boardTrusted=true;return {ok:true,result:{domain:'buildroot',trusted:true}};}
   return {ok:false,code:'FIXTURE_UNAVAILABLE'};
  };
  const p=document.createElement('operations-panel');p.workspace={workspaceId:'board-workspace',name:'Board fixture'};p.language='en';p.tab='config';
  const shell=document.querySelector('material-buildroot').shadowRoot.querySelector('.shell');for(const child of shell.children)if(child.localName!=='command-surfaces')child.style.display='none';shell.style.overflow='auto';shell.prepend(p);window.__boardPanel=p;
 });
 const p=page.locator('operations-panel').filter({has:page.locator('image-presets-panel')}).first(),iso=p.locator('image-presets-panel'),board=iso.getByRole('region',{name:'Choose a PC starting point',exact:true});
 await expect.poll(()=>page.evaluate(()=>!window.__boardPanel.pending&&!window.__boardPanel.shadowRoot.querySelector('image-presets-panel')?.isoBusy)).toBe(true);
 return {p,iso,board,discover:()=>board.getByRole('button',{name:'Find source PC presets',exact:true}).click()};
}
async function apply(board){await board.getByRole('checkbox',{name:replaceLabel,exact:true}).check();await board.getByRole('button',{name:'Apply this PC starting point',exact:true}).click();}
test('actual source identities are prefilled, replacement is explicit and changed scope needs fresh permission',async({page})=>{
 const {p,iso,board,discover}=await open(page);await discover();const select=board.locator('md-outlined-select');
 await expect(select).toHaveJSProperty('value','pc-id');await expect(select.locator('md-select-option')).toHaveCount(2);await expect(select.locator('md-icon')).toHaveCount(2);
 await expect(board).toContainText('/fixture/output');await expect(board.getByRole('button',{name:'Apply this PC starting point',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__boardCalls.some(r=>r.action==='defconfig.apply'))).toBe(false);
 await apply(board);await expect(board).toContainText('returned effective configuration enables x86-64 and Linux');
 const calls=await page.evaluate(()=>window.__boardCalls);expect(calls.find(r=>r.action==='defconfig.apply')).toEqual({action:'defconfig.apply',workspaceId:'board-workspace',revision:'boards-revision',id:'pc-id'});
 expect(calls.some(r=>['imagePreset.isoApply','imagePreset.isoBuild','build.submit','config.trustGrant'].includes(r.action))).toBe(false);
 await expect(iso.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await iso.getByRole('button',{name:'Check ISO prerequisites',exact:true}).click();await expect(iso).toContainText('ISO compatibility is not confirmed');
 await iso.getByRole('button',{name:'Review source execution permission',exact:true}).click();
 await p.getByRole('checkbox',{name:'Allow execution of this exact source revision in this runtime for configuration inspection and reconciliation.',exact:true}).check();await p.getByRole('button',{name:'Allow this scope',exact:true}).click();
 await expect(iso.getByRole('button',{name:'Configure BIOS ISO',exact:true})).toBeVisible();await expect(iso.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
});
test('QEMU is a distinct discovered choice and selection or refresh clears consent',async({page})=>{
 const {board,discover}=await open(page);await discover();await board.getByRole('checkbox',{name:replaceLabel,exact:true}).check();
 await board.getByRole('combobox',{name:'Discovered PC starting point',exact:true}).focus();await page.keyboard.press('ArrowDown');
 await page.locator('searchable-picker').getByRole('button',{name:/QEMU x86-64 sample/}).click();await expect(page.locator('searchable-picker').getByRole('dialog')).not.toBeVisible();
 await expect(board.getByRole('checkbox',{name:replaceLabel,exact:true})).not.toBeChecked();await expect(board.locator('md-outlined-select')).toHaveJSProperty('value','qemu-id');
 await apply(board);expect((await page.evaluate(()=>window.__boardCalls.find(r=>r.action==='defconfig.apply'))).id).toBe('qemu-id');
 await discover();await board.getByRole('checkbox',{name:replaceLabel,exact:true}).check();await discover();await expect(board.getByRole('checkbox',{name:replaceLabel,exact:true})).not.toBeChecked();
});
test('absent names and external overrides do not invent a starter',async({page})=>{
 const {iso,board,discover}=await open(page);await page.evaluate(()=>window.__boardEntries=window.__boardEntries.filter(e=>e.origin==='external'||e.name.includes('_efi_')));await discover();
 await expect(board).toContainText('does not list either supported starting-point name');await expect(board.getByRole('button',{name:'Apply this PC starting point',exact:true})).toHaveCount(0);
 await iso.getByRole('combobox',{name:'Configuration mode',exact:true}).click();await page.locator('searchable-picker').getByRole('button',{name:'Advanced: manual configuration',exact:true}).click();await expect(page.locator('searchable-picker').getByRole('dialog')).not.toBeVisible();
 await expect(iso.locator('xpath=..').getByRole('button',{name:'Read selected source capabilities',exact:true})).toBeVisible();
});
for(const code of ['KCONFIG_SOURCE_TRUST_REQUIRED','DEFCONFIG_CATALOG_CHANGED','RECONCILIATION_FAILED'])test(`starter ${code} keeps the outcome incomplete and requires a new review`,async({page})=>{
 const {iso,board,discover}=await open(page);await discover();await page.evaluate(code=>window.__boardApplyError=code,code);await apply(board);
 await expect(iso).toContainText(code);await expect(board.locator('md-outlined-select')).toHaveCount(0);await expect(iso.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__boardCalls.filter(r=>r.action==='defconfig.apply').length)).toBe(1);await expect(board).not.toContainText('Preset applied;');
});
test('missing effective kernel value is not ISO readiness',async({page})=>{
 const {iso,board,discover}=await open(page);await discover();await page.evaluate(()=>window.__boardEffective=false);await apply(board);await expect(board).toContainText('without the required x86-64 and Linux values');await expect(iso.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
});
test('source generation invalidates an approved catalogue and late responses',async({page})=>{
 const {p,board,discover}=await open(page);await discover();await board.getByRole('checkbox',{name:replaceLabel,exact:true}).check();await p.evaluate(element=>element.configurationGeneration++);await expect(board.locator('md-outlined-select')).toHaveCount(0);
 await page.evaluate(()=>window.__delayBoards=true);await discover();await expect.poll(()=>page.evaluate(()=>typeof window.__releaseBoards)).toBe('function');
 await p.evaluate(async element=>{element.workspace={workspaceId:'new-board-workspace',name:'New'};await element.updateComplete;window.__releaseBoards();});await expect.poll(()=>p.locator('image-presets-panel').evaluate(element=>element.isoBusy)).toBe(false);await expect(board.locator('md-outlined-select')).toHaveCount(0);
});
test('late preset application cannot overwrite a newer guide context',async({page})=>{
 const {p,iso,board,discover}=await open(page);await discover();await page.evaluate(()=>window.__delayBoardApply=true);await apply(board);await expect.poll(()=>page.evaluate(()=>typeof window.__releaseBoardApply)).toBe('function');
 await p.evaluate(async element=>{element.configurationGeneration++;await element.updateComplete;window.__releaseBoardApply();});await expect.poll(()=>iso.evaluate(element=>element.isoBusy)).toBe(false);await expect(board).not.toContainText('Preset applied;');await expect(iso.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
});
test('catalogue unavailability, narrow localized controls and contextual help remain truthful',async({page},testInfo)=>{
 const {p,iso,board,discover}=await open(page);await page.evaluate(()=>window.__boardCatalogError='KCONFIG_RUNTIME_UNAVAILABLE');await discover();await expect(iso).toContainText('A usable project runtime is required');await expect(board.locator('md-outlined-select')).toHaveCount(0);
 await page.evaluate(()=>window.__boardCatalogError=null);await discover();await page.setViewportSize({width:800,height:900});
 for(const language of ['zh-HK','bilingual','en']){await p.evaluate((element,language)=>element.language=language,language);await expect(iso.locator('md-select-option[value=pc-id]')).toContainText(language==='en'?'BIOS PC sample':'BIOS 電腦範例');expect(await iso.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);}
 await iso.evaluate(element=>element.addEventListener('open-documentation',event=>{window.__boardHelp=event.detail.title;event.stopPropagation();}));await board.locator('summary').click();await board.getByRole('button',{name:'Read the field guide',exact:true}).click();expect(await page.evaluate(()=>window.__boardHelp)).toBe('Easy ISO board presets');
 await page.screenshot({path:testInfo.outputPath('board-presets-fixture.png'),fullPage:true});
});
