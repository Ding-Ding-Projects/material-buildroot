import {test,expect} from '@playwright/test';
async function open(page,{supported=true,complete=false}={}){
 test.setTimeout(60000);await page.goto('/');
 await page.evaluate(async({supported,complete})=>{
  await import('/src/renderer/standalone-source-prepare.ts');localStorage.removeItem('standalone-os-preparation-job-v1');window.__prepareCalls=[];window.__prepared=[];
  window.studio={operations:async request=>{window.__prepareCalls.push(request);let result;
   switch(request.action){
    case 'appliance.prepare.choose':result={id:'source-1',name:'Selected source',kind:'directory'};break;
    case 'appliance.prepare.preview':result={previewId:'preview-1',source:{repository:'fixture-owner/workload-host',revision:'a'.repeat(40),untrackedOmitted:true},adapter:supported?'job-2027-fork':'unsupported',supported,entrypoint:'build.bat',arguments:['--platform','linux/amd64','--silent'],completeWorkload:complete,limitations:complete?[]:['DATABASE_AND_SETUP_SERVICES_REQUIRED'],code:supported?undefined:'APPLIANCE_ADAPTER_UNAVAILABLE'};break;
    case 'appliance.prepare.build':result={id:'prepare-1',state:'running',sequence:1,logs:['Phase: source'],completeWorkload:complete};break;
    case 'appliance.prepare.state':result={id:'prepare-1',state:'succeeded',sequence:2,logs:['Phase: complete'],completeWorkload:complete};break;
    case 'appliance.prepare.result':result={...(complete?{bundleId:'bundle-1',requiresOwnerSetup:true}:{}),archive:{id:'archive-1',name:'prepared.tar',kind:'file'},image:'local/prepared:1',sourceRevision:'a'.repeat(40),imageId:'sha256:'+'b'.repeat(64),completeWorkload:complete,limitations:complete?[]:['DATABASE_AND_SETUP_SERVICES_REQUIRED']};break;
    case 'appliance.prepare.cancel':result={id:'prepare-1',state:'cancelling',sequence:2,logs:['Cancellation requested'],completeWorkload:false};break;
    default:return {ok:false,code:'UNAVAILABLE'};
   }return {ok:true,result};}};
  const el=document.createElement('standalone-source-prepare');el.language='en';el.distribution='TestLinux';el.addEventListener('source-prepared',event=>window.__prepared.push(event.detail));document.body.style.overflow='auto';document.body.replaceChildren(el);
 },{supported,complete});return page.locator('standalone-source-prepare');
}
async function preview(panel){await panel.getByRole('button',{name:'Choose source folder',exact:true}).click();await panel.getByRole('button',{name:'Inspect source preparation',exact:true}).click();}
async function build(panel){await preview(panel);await panel.getByRole('checkbox',{name:'Allow execution of this pinned source snapshot',exact:true}).check();await panel.getByRole('button',{name:'Prepare container image',exact:true}).click();}

test('source preparation requires immutable preview consent and does not transfer incomplete workload',async({page})=>{
 const panel=await open(page);await preview(panel);await expect(panel.getByRole('button',{name:'Prepare container image',exact:true})).toBeDisabled();await expect(panel).toContainText('Untracked files are excluded');
 await panel.getByRole('checkbox',{name:'Allow execution of this pinned source snapshot',exact:true}).check();await panel.getByRole('button',{name:'Prepare container image',exact:true}).click();
 await expect(panel).toContainText('running');await expect(panel.getByRole('button',{name:'Choose source folder',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Refresh preparation and log',exact:true}).click();await panel.getByRole('button',{name:'Check prepared image result',exact:true}).click();
 await expect(panel).toContainText('complete workload is unavailable');await expect(panel.getByRole('button',{name:'Use prepared image in OS',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>window.__prepared)).toEqual([]);
 expect(await page.evaluate(()=>window.__prepareCalls.find(r=>r.action==='appliance.prepare.build'))).toEqual({action:'appliance.prepare.build',previewId:'preview-1',consent:true});
 expect(await page.evaluate(()=>localStorage.getItem('standalone-os-preparation-job-v1'))).toBe('prepare-1');
});

test('unsupported adapter cannot build and runtime change invalidates preview',async({page})=>{
 let panel=await open(page,{supported:false});await preview(panel);await expect(panel).toContainText('This source adapter is unavailable');await expect(panel.getByRole('button',{name:'Prepare container image',exact:true})).toHaveCount(0);
 panel=await open(page);await preview(panel);await panel.getByRole('checkbox',{name:'Allow execution of this pinned source snapshot',exact:true}).check();await panel.evaluate(el=>el.distribution='DifferentLinux');await expect(panel.getByRole('button',{name:'Prepare container image',exact:true})).toHaveCount(0);
});

test('only a verified complete result transfers and cancellation stays pending',async({page})=>{
 let panel=await open(page,{complete:true});await build(panel);await panel.getByRole('button',{name:'Refresh preparation and log',exact:true}).click();await panel.getByRole('button',{name:'Check prepared image result',exact:true}).click();await panel.getByRole('button',{name:'Use prepared image in OS',exact:true}).click();expect(await page.evaluate(()=>window.__prepared[0].archive.id)).toBe('archive-1');
 panel=await open(page);await build(panel);await panel.getByRole('button',{name:'Cancel source preparation',exact:true}).click();await expect(panel).toContainText('cancelling');await expect(panel.getByRole('button',{name:'Choose source folder',exact:true})).toBeDisabled();
});


test('an explicit stale-source rejection releases the draft for a new review',async({page})=>{
 const panel=await open(page);await preview(panel);
 await page.evaluate(()=>{const original=window.studio.operations;window.studio.operations=request=>request.action==='appliance.prepare.build'?Promise.resolve({ok:false,code:'APPLIANCE_INPUT_CHANGED'}):original(request);});
 await panel.getByRole('checkbox',{name:'Allow execution of this pinned source snapshot',exact:true}).check();await panel.getByRole('button',{name:'Prepare container image',exact:true}).click();
 await expect(panel).toContainText('APPLIANCE_INPUT_CHANGED');await expect(panel.getByRole('button',{name:'Choose source folder',exact:true})).toBeEnabled();
 await expect(panel.getByRole('button',{name:'Prepare container image',exact:true})).toHaveCount(0);
});

test('Home Assistant core requires a native frontend selection and a new paired preview',async({page})=>{
 const panel=await open(page);await page.evaluate(()=>{const original=window.studio.operations;window.studio.operations=async request=>{
  if(request.action==='appliance.prepare.preview'){window.__prepareCalls.push(request);return {ok:true,result:{previewId:'paired-preview',source:{repository:'fixture-owner/service-core',revision:'a'.repeat(40),untrackedOmitted:true,...(request.frontendSourceId?{frontendRepository:'fixture-owner/service-frontend',frontendRevision:'b'.repeat(40)}:{})},supported:!!request.frontendSourceId,needsFrontendSource:!request.frontendSourceId,adapter:'home-assistant',entrypoint:'build.bat',arguments:[],completeWorkload:true,limitations:['OWNER_SETUP_REQUIRED']}};}
  if(request.action==='appliance.prepare.choose'&&request.kind==='frontend'){window.__prepareCalls.push(request);return {ok:true,result:{id:'frontend-1',name:'Frontend source',kind:'directory'}};}
  return original(request);
 };});
 await preview(panel);await expect(panel.getByRole('button',{name:'Prepare container image',exact:true})).toHaveCount(0);
 await panel.getByRole('button',{name:'Choose matching frontend source',exact:true}).click();await panel.getByRole('button',{name:'Inspect source preparation',exact:true}).click();
 await expect(panel).toContainText('fixture-owner/service-frontend');await expect(panel.getByRole('button',{name:'Prepare container image',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>window.__prepareCalls.filter(r=>r.action==='appliance.prepare.preview').at(-1).frontendSourceId)).toBe('frontend-1');
});

test('WSL setup displays safe stage diagnostics without raw command output',async({page})=>{
 test.setTimeout(60000);await page.goto('/');await page.evaluate(async()=>{await import('/src/renderer/wsl-runtime-panel.ts');window.studio={operations:async()=>({ok:true,result:{state:'prerequisite-install-incomplete',setupDiagnostics:{steps:[{stage:'package-install',processState:'failed',exitCode:100,reason:'PACKAGE_INSTALL_FAILED',packages:['example-package'],rawOutput:'must-not-render'}]}}})};const el=document.createElement('wsl-runtime-panel');el.language='en';el.selected='TestLinux';document.body.replaceChildren(el);});
 const panel=page.locator('wsl-runtime-panel');await panel.getByRole('button',{name:'Install prerequisites',exact:true}).click();await expect(panel.getByRole('region',{name:'Setup diagnostics'})).toContainText('PACKAGE_INSTALL_FAILED');await expect(panel).toContainText('100');await expect(panel).toContainText('example-package');await expect(panel).not.toContainText('must-not-render');
});
