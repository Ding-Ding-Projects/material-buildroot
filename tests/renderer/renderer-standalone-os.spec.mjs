import {test,expect} from '@playwright/test';
async function open(page){
 test.setTimeout(60000);await page.goto('/');
 await page.evaluate(async()=>{
  await import('/src/renderer/standalone-os-wizard.ts');localStorage.removeItem('standalone-os-draft-v1');window.__requests=[];
  window.studio={operations:async request=>{window.__requests.push(request);let result;
   switch(request.action){
    case 'runtime.wsl':result={distributions:[{name:'TestLinux',version:2}]};break;
    case 'appliance.choose':result={id:'selection-1',name:'Selected input',kind:request.kind};break;
    case 'appliance.preview':result={previewId:'preview-1',summary:'Validated Linux x86-64 plan'};break;
    case 'appliance.build':result={id:'job-1',state:'running',sequence:1,logs:['Build started']};break;
    case 'appliance.state':result={id:'job-1',state:'succeeded',sequence:2,logs:['Build finished']};break;
    case 'appliance.verify':result={id:'job-1',state:'succeeded',sequence:3,logs:['Build finished'],verification:{state:'verified',bootVerified:true}};break;
    case 'appliance.cancel':result={id:'job-1',state:'cancelling',sequence:2,logs:['Cancellation requested']};break;
    case 'appliance.export':result={name:'standalone-os.iso',sha256:'a'.repeat(64),bytes:4096};break;
    default:return {ok:false,code:'UNAVAILABLE'};
   }return {ok:true,result};}};
  const el=document.createElement('standalone-os-wizard');el.language='en';document.body.style.overflow='auto';document.body.replaceChildren(el);
 });
 return page.locator('standalone-os-wizard');
}
async function source(panel){
 await panel.getByRole('textbox',{name:'Container image reference',exact:true}).fill('example/application:1');
 await panel.getByRole('button',{name:'Find WSL 2 distributions',exact:true}).click();
 // Match the existing renderer fixtures: test the registered control's change contract.
 await panel.evaluate(el=>{const select=[...el.shadowRoot.querySelectorAll('md-outlined-select')].find(s=>s.label==='Build distribution');select.value='TestLinux';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await panel.getByRole('button',{name:'Next',exact:true}).click();
}
async function review(panel){await source(panel);await panel.getByRole('button',{name:'Next',exact:true}).click();await panel.getByRole('button',{name:'Next',exact:true}).click();}

test('real operation sequence requires preview and consent; export waits for terminal success',async({page})=>{
 const panel=await open(page);await review(panel);
 await expect(panel.getByRole('button',{name:'Build standalone OS',exact:true})).toHaveCount(0);
 await panel.getByRole('button',{name:'Validate and preview build',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Build standalone OS',exact:true})).toBeDisabled();
 await panel.getByRole('checkbox',{name:'Approve this build preview',exact:true}).check();
 await panel.getByRole('button',{name:'Build standalone OS',exact:true}).click();
 await expect(panel).toContainText('running');await expect(panel.getByRole('button',{name:'Export ISO to Downloads',exact:true})).toHaveCount(0);
 await panel.getByRole('button',{name:'Refresh build and log',exact:true}).click();
 await expect(panel).toContainText('Guest boot and network access remain unverified');
 await panel.getByRole('button',{name:'Verify guest boot',exact:true}).click();await expect(panel).toContainText('The verification service confirmed guest boot.');
 await panel.getByRole('button',{name:'Export ISO to Downloads',exact:true}).click();await expect(panel).toContainText('standalone-os.iso');
 const requests=await page.evaluate(()=>window.__requests);expect(requests.find(r=>r.action==='appliance.build')).toEqual({action:'appliance.build',previewId:'preview-1',consent:true});
 expect(requests.find(r=>r.action==='appliance.preview').spec).toMatchObject({mode:'kiosk',persistence:true,tunnel:{mode:'off'}});
});

test('private JSON requires native validation and is not persisted in safe draft',async({page})=>{
 const panel=await open(page);await source(panel);await panel.getByRole('button',{name:'Next',exact:true}).click();
 await panel.getByRole('checkbox',{name:'Include personal wording JSON',exact:true}).check();
 await expect(panel).toContainText('Private output');await expect(panel.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Choose personal wording JSON',exact:true}).click();
 await panel.getByRole('button',{name:'Next',exact:true}).click();await panel.getByRole('button',{name:'Validate and preview build',exact:true}).click();
 expect(await page.evaluate(()=>window.__requests.find(r=>r.action==='appliance.preview').spec.wordingFileId)).toBe('selection-1');
 const draft=await page.evaluate(()=>localStorage.getItem('standalone-os-draft-v1'));expect(draft).not.toContain('selection-1');expect(draft).not.toContain('Selected input');
 await panel.getByRole('button',{name:'Back',exact:true}).click();await panel.getByRole('checkbox',{name:'Include personal wording JSON',exact:true}).uncheck();await panel.getByRole('button',{name:'Next',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Build standalone OS',exact:true})).toHaveCount(0);
});

test('cancel is pending and saved jobs restore as unverified',async({page})=>{
 const panel=await open(page);await review(panel);await panel.getByRole('button',{name:'Validate and preview build',exact:true}).click();await panel.getByRole('checkbox',{name:'Approve this build preview',exact:true}).check();await panel.getByRole('button',{name:'Build standalone OS',exact:true}).click();
 await panel.getByRole('button',{name:'Cancel build',exact:true}).click();await expect(panel).toContainText('cancelling');await expect(panel.getByRole('button',{name:'Back',exact:true})).toBeDisabled();
 await page.evaluate(()=>{const el=document.createElement('standalone-os-wizard');el.language='en';document.body.style.overflow='auto';document.body.replaceChildren(el);});
 await expect(panel).toContainText('unverified');await expect(panel.getByRole('button',{name:'Export ISO to Downloads',exact:true})).toHaveCount(0);
 await panel.getByRole('button',{name:'Refresh build and log',exact:true}).click();await expect(panel).toContainText('succeeded');
});

test('late preview after disconnection is discarded',async({page})=>{
 const panel=await open(page);await review(panel);
 await page.evaluate(()=>{window.studio.operations=async()=>new Promise(resolve=>window.__resolve=resolve);});
 await panel.getByRole('button',{name:'Validate and preview build',exact:true}).click();
 await page.evaluate(()=>{const old=document.querySelector('standalone-os-wizard');old.remove();window.__resolve({ok:true,result:{previewId:'stale',summary:'stale'}});document.body.append(old);});
 await expect(panel.getByRole('button',{name:'Build standalone OS',exact:true})).toHaveCount(0);
});




test('actual application Images action opens standalone OS without project adoption',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),bootstrap:async()=>({language:'en',revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version:'fixture',source:null,updatedAt:null}),request:async()=>({ok:false,code:'UNAVAILABLE'}),onEvent:()=>()=>{},windowControl:async()=>true,operations:async request=>request.action==='project.list'?{ok:true,result:[]}:{ok:false,code:'FIXTURE_UNAVAILABLE'}};});
 await page.goto('/');const app=page.locator('material-buildroot');await expect(app.locator('#workspace-heading')).toHaveText('Images');await app.evaluate(async el=>{el.setupDone=true;await el.updateComplete;});
 await app.getByRole('button',{name:'Create standalone OS',exact:true}).click();
 await expect(app.getByRole('heading',{name:'Create a standalone OS',exact:true})).toBeVisible();
 await expect(app.getByRole('button',{name:'Find WSL 2 distributions',exact:true})).toBeVisible();
 await app.getByRole('button',{name:'Back to Images',exact:true}).click();
 await expect(app.getByRole('button',{name:'Create image project',exact:true})).toBeVisible();
 expect(await app.evaluate(el=>el.projectSessions.length)).toBe(0);
});

test('prepared complete bundle retains its bundle capability in the OS spec',async({page})=>{
 const panel=await open(page);
 await panel.evaluate(el=>{el.draft.distribution='TestLinux';el.shadowRoot.querySelector('standalone-source-prepare').dispatchEvent(new CustomEvent('source-prepared',{bubbles:true,composed:true,detail:{completeWorkload:true,bundleId:'bundle-1',archive:{id:'archive-1',name:'prepared.tar'},image:'local/prepared:1',endpoints:{productiveUrl:'https://127.0.0.1:8443/',setupOrigin:'https://127.0.0.1:8444/',tunnelSetupAllowed:false}}}));});
 await panel.getByRole('button',{name:'Next',exact:true}).click();await panel.getByRole('button',{name:'Next',exact:true}).click();await panel.getByRole('button',{name:'Next',exact:true}).click();await panel.getByRole('button',{name:'Validate and preview build',exact:true}).click();
 expect(await page.evaluate(()=>window.__requests.find(r=>r.action==='appliance.preview').spec.source)).toEqual({kind:'prepared',bundleId:'bundle-1'});
 expect(await page.evaluate(()=>window.__requests.find(r=>r.action==='appliance.preview').spec.kioskUrl)).toBe('https://127.0.0.1:8443/');
 expect(await page.evaluate(()=>localStorage.getItem('standalone-os-draft-v1'))).not.toContain('bundle-1');
});


test('failed build displays validated cause metadata without raw output',async({page})=>{
 const panel=await open(page);await review(panel);await panel.getByRole('button',{name:'Validate and preview build',exact:true}).click();await panel.getByRole('checkbox',{name:'Approve this build preview',exact:true}).check();await panel.getByRole('button',{name:'Build standalone OS',exact:true}).click();
 await page.evaluate(()=>{window.studio.operations=async()=>({ok:true,result:{id:'job-1',state:'failed',sequence:3,logs:[],code:'APPLIANCE_BUILD_FAILED',diagnosticStatus:'available',diagnostic:{schemaVersion:1,stage:'preparing',code:'DOCKER_DAEMON_UNAVAILABLE',tool:'docker',exitCode:1,rawOutput:'must-not-display'}}});});
 await panel.getByRole('button',{name:'Refresh build and log',exact:true}).click();const details=panel.getByRole('region',{name:'Build failure details',exact:true});await expect(details).toContainText('container engine is unavailable');await expect(details).toContainText('Preparation');await expect(details).toContainText('DOCKER_DAEMON_UNAVAILABLE');await expect(details).toContainText('docker');await expect(details).toContainText('1');await expect(panel).not.toContainText('must-not-display');
});

test('invalid or unavailable build diagnostics never invent a cause',async({page})=>{
 const panel=await open(page);await panel.evaluate(el=>{el.job={id:'job-1',state:'failed',sequence:1,logs:[],diagnosticStatus:'invalid'};el.draft.step=4;el.revision++;});await expect(panel).toContainText('specific cause is not verified');await expect(panel.getByRole('region',{name:'Build failure details',exact:true})).toHaveCount(0);
 await panel.evaluate(el=>{el.job.diagnosticStatus='unavailable';el.revision++;});await expect(panel).toContainText('cause has not been established');
});

test('missing prepared endpoint does not select an undefined or setup-only source',async({page})=>{
 const panel=await open(page);await panel.evaluate(el=>{el.shadowRoot.querySelector('standalone-source-prepare').dispatchEvent(new CustomEvent('source-prepared',{bubbles:true,composed:true,detail:{completeWorkload:true,bundleId:'bundle-1',archive:{id:'archive-1',name:'prepared.tar'},image:'local/prepared:1',endpoints:{setupOrigin:'https://127.0.0.1:8444/'}}}));});await expect(panel).toContainText('no valid reviewed application endpoint');expect(await panel.evaluate(el=>el.draft.sourceKind)).toBe('registry');
});


test('saved image identity diagnostic explains pre-compilation stop without source-drift advice',async({page})=>{
 const panel=await open(page);await panel.evaluate(el=>{el.job={id:'job-identity',state:'failed',sequence:1,logs:[],diagnosticStatus:'available',diagnostic:{schemaVersion:1,stage:'source',code:'SAVED_IMAGE_IDENTITY_MISMATCH',tool:'docker',exitCode:null}};el.draft.step=4;el.revision++;});
 const details=panel.getByRole('region',{name:'Build failure details',exact:true});
 await expect(details).toContainText('The saved archive could not be bound to the selected image identity. The build stopped before compilation.');
 await expect(details).toContainText('SAVED_IMAGE_IDENTITY_MISMATCH');await expect(details).toContainText('Not reported');
 await expect(details).not.toContainText('source identity changed');await expect(details).not.toContainText('fresh preview');
 await page.evaluate(async()=>{const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');});
 await panel.evaluate(el=>el.language='zh-HK');await expect(panel.getByRole('region',{name:'建置失敗詳情',exact:true})).toContainText('建置已喺編譯前停止');
});
