import {test,expect} from '@playwright/test';

// Browser fixtures exercise the renderer contract, not native image production or boot.
async function open(page,{saved=null,mode='easy'}={}){
 await page.addInitScript(()=>localStorage.setItem('material-buildroot.wording.v1',JSON.stringify({schemaVersion:1,englishHumor:1,cantoneseHumor:1,displayName:''})));
 await page.goto('/');
 await page.evaluate(async({saved,mode})=>{
  await import('/src/renderer/image-presets-panel.ts');
  const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');
  localStorage.removeItem('iso-workflow-guided-a');if(saved)localStorage.setItem('iso-workflow-guided-a',JSON.stringify(saved));
  window.calls=[];window.routes=[];window.currentJobState='queued';
  const available={symbol:'BR2_PACKAGE_BUSYBOX',selectable:true};
  window.studio={operations:async request=>{
   window.calls.push(request);
   switch(request.action){
    case 'project.options':return {ok:true,result:{runtime:{kind:'wsl',distribution:'Private-runtime-reference'}}};
    case 'imagePreset.catalog':return {ok:true,result:{revision:'revision-1',presets:['minimal','desktop','server'].map(id=>({id,requirements:[available]})),desktops:[{id:'weston',label:'Weston',selectable:false,reason:'DEPENDENCIES_NOT_SATISFIED'},{id:'cage',label:'Cage',selectable:true}]}};
    case 'imagePreset.isoPlan':return {ok:true,result:{revision:'revision-1',profile:'x86_64-bios-grub2-initrd',applicable:true,requirements:[available]}};
    case 'imagePreset.plan':return {ok:true,result:{applicable:true,requirements:[available]}};
    case 'imagePreset.apply':return {ok:true,result:{revision:'revision-2',requestedSymbols:[available.symbol],values:{[available.symbol]:'y'}}};
    case 'imagePreset.isoApply':return {ok:true,result:{effective:true,revision:'revision-3',profile:'x86_64-bios-grub2-initrd'}};
    case 'imagePreset.isoBuild':return {ok:true,result:{id:'job-guided',state:'queued',sequence:1}};
    case 'jobs.project':return {ok:true,result:request.workspaceId==='guided-a'?[{id:'job-guided',state:window.currentJobState,sequence:2}]:[]};
    case 'jobs.projectPage':return {ok:true,result:{records:[{value:{text:'Fixture log'}}]}};
    case 'jobs.projectCancel':return {ok:true,result:{id:request.id,state:'cancelling',sequence:3}};
    case 'artifacts.inspect':return {ok:true,result:{size:12,sha256:'a'.repeat(64),iso:{descriptorValid:false}}};
    default:return {ok:false,code:'FIXTURE_UNAVAILABLE'};
   }
  }};
  const panel=document.createElement('image-presets-panel');panel.workspaceId='guided-a';panel.language='en';panel.isoMode=mode;
  panel.addEventListener('guided-workflow-navigate',event=>window.routes.push({detail:event.detail,bubbles:event.bubbles,composed:event.composed}));
  document.body.replaceChildren(panel);await panel.updateComplete;
 },{saved,mode});
 const panel=page.locator('image-presets-panel');
 await expect.poll(()=>panel.evaluate(el=>!el.isoBusy)).toBe(true);
 return panel;
}
async function choose(panel,label,value){await panel.evaluate((el,{label,value})=>{const select=[...el.shadowRoot.querySelectorAll('md-outlined-select')].find(s=>s.label===label&&!s.closest('[hidden]'));select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));},{label,value});}
async function next(panel){await panel.getByRole('button',{name:'Next',exact:true}).click();}
async function configure(panel){await panel.getByRole('checkbox',{name:'Apply the listed ISO configuration requests',exact:true}).check();await panel.getByRole('button',{name:'Configure BIOS ISO',exact:true}).click();}

test('five stages preserve metadata and separate configuration, build and result',async({page})=>{
 const panel=await open(page);
 await expect(panel).toContainText('1 / 5');
 await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('rescue-disc');
 await next(panel);await expect(panel.getByRole('heading',{name:'Where will it be built?',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Set up runtime',exact:true}).click();
 expect(await page.evaluate(()=>window.routes)).toEqual([{detail:{destination:'runtime',workspaceId:'guided-a'},bubbles:true,composed:true}]);
 await next(panel);await expect(panel.getByRole('heading',{name:'Choose image contents',exact:true})).toBeVisible();
 await next(panel);await expect(panel.getByRole('heading',{name:'Review your image',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.calls.some(r=>r.action.endsWith('Apply')||r.action.endsWith('.apply')||r.action==='imagePreset.isoBuild'))).toBe(false);
 await configure(panel);await next(panel);
 await expect(panel).toContainText('rescue-disc.iso');
 await panel.getByRole('button',{name:'Build ISO image',exact:true}).click();
 expect(await page.evaluate(()=>window.calls.find(r=>r.action==='imagePreset.isoBuild'))).toEqual({action:'imagePreset.isoBuild',workspaceId:'guided-a',revision:'revision-3',profile:'x86_64-bios-grub2-initrd',runtime:{kind:'wsl',distribution:'Private-runtime-reference'},jobs:2});
 await panel.getByRole('button',{name:'Cancel ISO build',exact:true}).click();await expect(panel).toContainText('cancelling');
 await page.evaluate(()=>window.currentJobState='succeeded');await panel.getByRole('button',{name:'Refresh ISO job and log',exact:true}).click();
 await panel.getByRole('button',{name:'Inspect ISO output',exact:true}).click();
 await expect(panel).toContainText('has not passed BIOS ISO structural checks');await expect(panel).toContainText('boot execution remains unverified');
 expect(await page.evaluate(()=>window.calls.find(r=>r.action==='artifacts.inspect').path)).toBe('images/rootfs.iso9660');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-guided-a')));
 expect(stored).toMatchObject({version:2,name:'rescue-disc',step:4,preset:'keep',jobId:'job-guided'});
 expect(Object.keys(stored).sort()).toEqual(['boardId','desktop','jobId','mode','name','preset','revision','ssh','step','target','version']);
 expect(JSON.stringify(stored)).not.toContain('Private-runtime-reference');
});

test('Easy and Advanced share choices, retain unavailable custom values and never apply implicitly',async({page})=>{
 const panel=await open(page);await choose(panel,'Image purpose','desktop');
 expect(await panel.evaluate(el=>el.desktop)).toBe('cage');
 await choose(panel,'Configuration mode','advanced');
 await expect(panel.locator('md-outlined-select[label="Display stack"]')).toHaveJSProperty('value','cage');
 await expect(panel.locator('md-select-option[value="appliance"]').first()).toHaveJSProperty('disabled',true);
 await panel.getByRole('button',{name:'Preview configuration requests',exact:true}).click();
 expect(await page.evaluate(()=>window.calls.find(r=>r.action==='imagePreset.plan'))).toMatchObject({preset:'desktop',desktop:'cage'});
 await choose(panel,'Configuration mode','easy');expect(await panel.evaluate(el=>[el.preset,el.desktop])).toEqual(['desktop','cage']);
 expect(await page.evaluate(()=>window.calls.some(r=>r.action==='imagePreset.apply'))).toBe(false);
 await panel.evaluate(el=>{el.desktop='weston';el.catalog=undefined;el.revision++;});await choose(panel,'Configuration mode','advanced');
 await expect(panel).toContainText('Custom or unverified choice retained');expect(await panel.evaluate(el=>el.desktop)).toBe('weston');
});

test('names reject paths and reserved names without changing producer requests',async({page})=>{
 const panel=await open(page);const field=panel.getByRole('textbox',{name:'Image name',exact:true});
 for(const name of ['../private','C:\\private','CON','nul.iso','trailing.']){await field.fill(name);await expect(panel.getByRole('button',{name:'Next',exact:true})).toBeDisabled();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-guided-a'))?.name)).not.toBe(name);}
 await field.fill('valid-name');await panel.getByRole('button',{name:'Clear image name',exact:true}).click();await expect(field).toHaveValue('');await expect(field).toBeFocused();await expect(panel.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
});

test('legacy progress retains only an unverified job and uses project-scoped refresh/cancel',async({page})=>{
 const panel=await open(page,{saved:{version:1,step:2,mode:'easy',jobId:'job-guided',isoApproved:true,effective:true,runtime:{kind:'wsl',distribution:'unsafe'}}});
 await expect(panel).toContainText('5 / 5');await expect(panel).toContainText('unverified');
 await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeDisabled();await expect(panel.getByRole('button',{name:'Cancel ISO build',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Back',exact:true}).click();await panel.getByRole('button',{name:'Return to current build',exact:true}).click();
 await panel.getByRole('button',{name:'Refresh ISO job and log',exact:true}).click();await panel.getByRole('button',{name:'Cancel ISO build',exact:true}).click();
 expect(await page.evaluate(()=>window.calls.filter(r=>r.action.startsWith('jobs.')))).toEqual([{action:'jobs.project',workspaceId:'guided-a'},{action:'jobs.projectPage',workspaceId:'guided-a',id:'job-guided',after:0,limit:50},{action:'jobs.projectCancel',workspaceId:'guided-a',id:'job-guided',sequence:2}]);
});

test('foreign restored job cannot be read, cancelled or replaced',async({page})=>{
 const panel=await open(page,{saved:{version:1,step:2,jobId:'other-project-job'}});
 await panel.getByRole('button',{name:'Refresh ISO job and log',exact:true}).click();await expect(panel).toContainText('JOB_UNAVAILABLE');
 await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeDisabled();await expect(panel.getByRole('button',{name:'Cancel ISO build',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.calls.some(r=>r.action==='jobs.projectPage'||r.action==='jobs.projectCancel'))).toBe(false);
});

test('storage conflict requires an explicit choice and never restores readiness',async({page})=>{
 const panel=await open(page);await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('local-name');
 await page.evaluate(()=>{const key='iso-workflow-guided-a',draft=JSON.parse(localStorage.getItem(key));draft.name='other-name';draft.revision++;const value=JSON.stringify(draft);localStorage.setItem(key,value);window.dispatchEvent(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));});
 await expect(panel.getByRole('alert')).toContainText('another window');await expect(panel.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Load saved draft',exact:true}).click();await expect(panel.getByRole('textbox',{name:'Image name',exact:true})).toHaveValue('other-name');
 expect(await panel.evaluate(el=>[el.isoApproved,el.approved,el.isoOutcome])).toEqual([false,false,undefined]);
});

test('bounded parser strips payloads and rejects malformed records',async({page})=>{
 await open(page);const result=await page.evaluate(async()=>{const m=await import('/src/renderer/image-workflow-draft.ts');const draft=m.newImageDraft();return {oversize:m.readImageDraft(' '.repeat(2049)),invalid:m.readImageDraft(JSON.stringify({...draft,name:'../bad'})),unknown:m.readImageDraft(JSON.stringify({...draft,version:3})),safe:m.readImageDraft(JSON.stringify({...draft,approved:true,runtime:{path:'/private'}})),legacy:m.readImageDraft(JSON.stringify({version:1,step:0,jobId:'legacy-job'}))};});
 expect(result.oversize).toBeNull();expect(result.invalid).toBeNull();expect(result.unknown).toBeNull();expect(result.safe).not.toHaveProperty('runtime');expect(result.safe).not.toHaveProperty('approved');expect(result.legacy).toMatchObject({step:1,jobId:'legacy-job',version:2});
});

test('an accepted late build survives a draft conflict without restoring readiness',async({page})=>{
 const panel=await open(page,{mode:'advanced'});await configure(panel);
 await page.evaluate(()=>{const previous=window.studio.operations;window.studio.operations=async request=>{if(request.action==='imagePreset.isoBuild')await new Promise(resolve=>window.releaseBuild=resolve);return previous(request);};});
 await panel.getByRole('button',{name:'Build ISO image',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof window.releaseBuild)).toBe('function');
 await page.evaluate(()=>{const key='iso-workflow-guided-a',draft=JSON.parse(localStorage.getItem(key));draft.name='other-window';draft.revision++;const value=JSON.stringify(draft);localStorage.setItem(key,value);window.dispatchEvent(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));window.releaseBuild();});
 await expect.poll(()=>panel.evaluate(el=>el.isoJob?.id)).toBe('job-guided');
 await panel.getByRole('button',{name:'Load saved draft',exact:true}).click();
 await expect(panel).toContainText('unverified');await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Refresh ISO job and log',exact:true}).click();await panel.getByRole('button',{name:'Cancel ISO build',exact:true}).click();
 expect(await page.evaluate(()=>window.calls.filter(r=>r.action==='imagePreset.isoBuild'))).toHaveLength(1);
 expect(await page.evaluate(()=>window.calls.find(r=>r.action==='jobs.projectCancel'))).toMatchObject({workspaceId:'guided-a',id:'job-guided',sequence:2});
});

for(const version of [1,2])test(`version ${version} earlier-stage job resumes at accessible recovery controls`,async({page})=>{
 const saved=version===1?{version:1,step:0,mode:'easy',jobId:'job-guided'}:{version:2,revision:1,step:2,mode:'easy',name:'saved-image',target:'bios-iso',preset:'keep',desktop:'none',ssh:false,boardId:null,jobId:'job-guided'};
 const panel=await open(page,{saved});await expect(panel).toContainText('5 / 5');
 await expect(panel.getByRole('button',{name:'Refresh ISO job and log',exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Cancel ISO build',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Refresh ISO job and log',exact:true}).click();await expect(panel.getByRole('button',{name:'Cancel ISO build',exact:true})).toBeEnabled();
});

test('storage failure leaves visible unsaved state and never replaces the last valid record',async({page})=>{
 const panel=await open(page);await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('saved-name');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iso-workflow-guided-a')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
 await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('unsaved-name');await expect(panel).toContainText('Current draft changes are not saved');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-guided-a')).name)).toBe('saved-name');
 await expect(panel).not.toContainText('Draft saved on this device');
});

test('configuration-generation change rejects a late package preview',async({page})=>{
 const panel=await open(page,{mode:'advanced'});await choose(panel,'Image purpose','server');
 await page.evaluate(()=>{const previous=window.studio.operations;window.studio.operations=async request=>{if(request.action==='imagePreset.plan')await new Promise(resolve=>window.releasePreset=resolve);return previous(request);};});
 await panel.getByRole('button',{name:'Preview configuration requests',exact:true}).click();await expect.poll(()=>page.evaluate(()=>typeof window.releasePreset)).toBe('function');
 await panel.evaluate(async el=>{el.configurationGeneration++;await el.updateComplete;});await page.evaluate(()=>window.releasePreset());
 await expect.poll(()=>panel.evaluate(el=>el.busy)).toBe(false);expect(await panel.evaluate(el=>[el.preview,el.approved,el.isoOutcome])).toEqual([undefined,false,undefined]);
 await expect(panel.getByRole('button',{name:'Apply preset',exact:true})).toHaveCount(0);
});

test('workspace drafts remain separate and a name edit preserves a tracked job',async({page})=>{
 const panel=await open(page);await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('workspace-a');
 await panel.evaluate(async el=>{el.workspaceId='guided-b';await el.updateComplete;});await expect.poll(()=>panel.evaluate(el=>el.isoBusy)).toBe(false);
 await expect(panel.getByRole('textbox',{name:'Image name',exact:true})).toHaveValue('linux-bios-image');await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('workspace-b');
 await panel.evaluate(async el=>{el.workspaceId='guided-a';await el.updateComplete;});await expect.poll(()=>panel.evaluate(el=>el.isoBusy)).toBe(false);await expect(panel.getByRole('textbox',{name:'Image name',exact:true})).toHaveValue('workspace-a');
 await panel.evaluate(el=>{el.isoJob={id:'job-guided',state:'running',sequence:2};el.revision++;});await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('renamed-draft');
 expect(await panel.evaluate(el=>el.isoJob)).toEqual({id:'job-guided',state:'running',sequence:2});
});

test('clearing storage elsewhere raises a conflict without deleting the local draft',async({page})=>{
 const panel=await open(page);await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('local-draft');
 await page.evaluate(()=>{localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null,newValue:null,storageArea:localStorage}));});
 await expect(panel.getByRole('alert')).toContainText('another window');await expect(panel.getByRole('textbox',{name:'Image name',exact:true})).toHaveValue('local-draft');
 await panel.getByRole('button',{name:'Keep this draft',exact:true}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-guided-a')).name)).toBe('local-draft');
 expect(await panel.evaluate(el=>[el.isoOutcome,el.isoApproved])).toEqual([undefined,false]);
});
