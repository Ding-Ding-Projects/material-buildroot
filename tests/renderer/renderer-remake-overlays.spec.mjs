import {test,expect} from '@playwright/test';

// Bounded fixture telemetry diagnoses cold module loading without extending deadlines.
const startupObservations=new WeakMap();
function observedPath(url){try{const parsed=new URL(url);return parsed.protocol==='http:'||parsed.protocol==='https:'?parsed.pathname.slice(0,240):parsed.protocol;}catch{return 'unparseable-url';}}
test.beforeEach(async({page})=>{
 const started=Date.now(),pending=new Map(),completed=[],errors=[],failed=[],responses=[],milestones=[];
 const observation={started,pending,completed,errors,failed,responses,milestones,requestCount:0,dropped:0};startupObservations.set(page,observation);
 page.on('request',request=>{observation.requestCount++;if(pending.size>=1500){observation.dropped++;return;}pending.set(request,{path:observedPath(request.url()),kind:request.resourceType(),started:Date.now()-started});});
 page.on('response',response=>{if(responses.length<200)responses.push({path:observedPath(response.url()),status:response.status(),at:Date.now()-started});});
 page.on('requestfinished',request=>{const record=pending.get(request);pending.delete(request);if(record){completed.push({...record,duration:Date.now()-started-record.started});if(completed.length>2000)completed.shift();}});
 page.on('requestfailed',request=>{const record=pending.get(request);pending.delete(request);if(failed.length<40)failed.push({path:record?.path||observedPath(request.url()),reason:request.failure()?.errorText?.slice(0,200)||'unknown',at:Date.now()-started});});
 page.on('pageerror',error=>{if(errors.length<20)errors.push({name:error.name,message:error.message.replace(/https?:\/\/[^\s)]+/g,url=>observedPath(url)).slice(0,1000),at:Date.now()-started});});
 page.on('domcontentloaded',()=>milestones.push({event:'domcontentloaded',at:Date.now()-started}));
 page.on('load',()=>milestones.push({event:'load',at:Date.now()-started}));
});
test.afterEach(async({page},testInfo)=>{
 const observation=startupObservations.get(page);if(!observation)return;
 const elapsed=Date.now()-observation.started;
 await testInfo.attach('fixture-startup-observations',{contentType:'application/json',body:Buffer.from(JSON.stringify({elapsed,status:testInfo.status,requestCount:observation.requestCount,dropped:observation.dropped,milestones:observation.milestones,pageErrors:observation.errors,failedRequests:observation.failed,responses:observation.responses,pending:[...observation.pending.values()].map(record=>({...record,age:elapsed-record.started})).sort((a,b)=>b.age-a.age).slice(0,80),slowestCompleted:observation.completed.sort((a,b)=>b.duration-a.duration).slice(0,40)},null,2))});
 startupObservations.delete(page);
});

async function open(page){
 test.setTimeout(60000);
 await page.addInitScript(()=>{
  window.__reviews=[];
  window.studio={
   sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),
   bootstrap:async()=>({language:'en',revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version:'overlay fixture',source:null,updatedAt:null}),
   request:async()=>({ok:false,code:'UNAVAILABLE'}),onEvent:()=>()=>{},windowControl:async()=>true,
   operations:async()=>({ok:false,code:'FIXTURE_UNAVAILABLE'}),
   notifications:async request=>{
    if(request.action==='list')return {ok:true,result:{records:[{id:'alpha',title:'Alpha operation',message:'Verified fixture record',timestamp:'2026-10-30T12:00:00Z',severity:'info',status:'unread'},{id:'beta',title:'Beta operation',message:'Second fixture record',timestamp:'2026-10-29T12:00:00Z',severity:'warning',status:'read'}],total:2,next:2}};
    if(request.action==='changelog')return {ok:true,result:{entries:[],retrievedAt:'2026-10-30T12:00:00Z'}};
    if(request.action==='review'){window.__reviews.push(request);return {ok:true,result:{completed:request.ids.length}};}
    return {ok:false,code:'UNAVAILABLE'};
   },onNotificationsChanged:()=>()=>{},
  };
 });
 await page.goto('/',{waitUntil:'domcontentloaded',timeout:45000});
 startupObservations.get(page)?.milestones.push({event:'navigation-resolved',at:Date.now()-startupObservations.get(page).started});
 await page.locator('command-surfaces').waitFor({state:'attached',timeout:45000});
 startupObservations.get(page)?.milestones.push({event:'command-surfaces-attached',at:Date.now()-startupObservations.get(page).started});
 await page.locator('material-buildroot').evaluate(async app=>{app.setupDone=true;await app.updateComplete;});
}

test('notification filters own independent workbenches and retain matches after date filtering',async({page})=>{
 await open(page);const centre=page.locator('notification-centre');await centre.locator('#trigger').click();
 await expect(centre.locator('.record')).toHaveCount(2);
 const search=centre.locator('settings-search');await search.getByRole('textbox',{name:'Search loaded records',exact:true}).fill('Alpha');
 await expect(centre.locator('.record')).toHaveCount(1);
 await centre.locator('review-date-range').getByRole('textbox',{name:'From date',exact:true}).fill('2026-10-30');
 await expect(centre.locator('.record')).toHaveCount(1);
 await centre.getByRole('button',{name:'Changelog',exact:true}).click();
 await expect(search.getByRole('textbox',{name:'Search loaded records',exact:true})).toHaveValue('');
 await search.getByRole('textbox',{name:'Search loaded records',exact:true}).fill('Release only');
 await centre.getByRole('button',{name:'Notifications',exact:true}).click();
 await expect(search.getByRole('textbox',{name:'Search loaded records',exact:true})).toHaveValue('Alpha');
 await expect(centre.locator('.record')).toHaveCount(1);
 await centre.locator('.record md-checkbox').click();
 await centre.getByRole('button',{name:/Mark read/}).click();
 await expect.poll(()=>page.evaluate(()=>window.__reviews[0]?.ids)).toEqual(['alpha']);
 await page.keyboard.press('Escape');await expect(centre.locator('#notification-review')).toHaveCount(0);
});

test('destructive confirmation keeps emergency cancellation separate from full proof',async({page})=>{
 await open(page);
 await page.evaluate(async()=>{
  await import('/src/renderer/destructive-confirmation.ts');
  const dialog=document.createElement('destructive-confirmation');dialog.language='en';dialog.challenge={id:'fixture',operation:'clean',destination:'/fixture/output',keys:['first','second'],expires:Date.now()+60000,rebuildRequired:true};
  document.body.append(dialog);window.__confirmation=dialog;window.__outcome='pending';void dialog.request().then(result=>window.__outcome=result);
 });
 const dialog=page.locator('destructive-confirmation');await expect(dialog.locator('.destination')).toContainText('/fixture/output');
 await expect(dialog.getByRole('button',{name:'Queue clean target',exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'Emergency exit',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__outcome)).toBeNull();
});

test('palette shows actual grouped actions without enabling a restricted target',async({page})=>{
 await open(page);await page.keyboard.press('Control+Shift+f');const surface=page.locator('command-surfaces');
 await expect(surface.locator('.summary')).toContainText('Current available actions');
 await expect(surface.locator('.group').first()).toBeVisible();
 await surface.getByRole('button',{name:'Full-window view',exact:true}).click();await expect(surface.locator('md-dialog')).toHaveClass('wide');
 await surface.getByRole('button',{name:'Card view',exact:true}).click();await expect(surface.locator('md-dialog')).not.toHaveClass('wide');
});

for(const theme of ['light','dark']){
 test(`notification surfaces inherit their owning ${theme} palette`,async({page})=>{
  await open(page);
  // Controlled shell roles test component inheritance, not native theme selection.
  const palette=theme==='dark'?{surface:'rgb(29, 32, 36)',card:'rgb(25, 28, 32)',text:'rgb(226, 226, 233)',inverse:'rgb(226, 226, 233)',inverseText:'rgb(29, 32, 36)'}:{surface:'rgb(243, 243, 250)',card:'rgb(255, 255, 255)',text:'rgb(25, 28, 32)',inverse:'rgb(47, 48, 54)',inverseText:'rgb(243, 243, 250)'};
  await page.locator('material-buildroot').evaluate((app,palette)=>{
   const shell=app.shadowRoot.querySelector('.shell');
   for(const [role,value] of Object.entries({'surface-container':palette.surface,'surface-container-low':palette.card,'on-surface':palette.text,'inverse-surface':palette.inverse,'inverse-on-surface':palette.inverseText}))shell.style.setProperty('--md-sys-color-'+role,value);
  },palette);
  const centre=page.locator('notification-centre');await centre.locator('#trigger').click();
  await expect(centre.locator('.record')).toHaveCount(2);
  await expect(centre).toHaveCSS('color',palette.text);
  await expect(centre.locator('#notification-review')).toHaveCSS('background-color',palette.surface);
  await expect(centre.locator('.record').first()).toHaveCSS('background-color',palette.surface);
  await centre.getByRole('button',{name:'Export Markdown',exact:true}).click();
  await expect(centre.locator('.feedback')).toContainText('export requested');
  await centre.getByRole('button',{name:'Close',exact:true}).click();
  await expect(centre.locator('.corner-feedback')).toHaveCSS('background-color',palette.inverse);
  await expect(centre.locator('.corner-feedback')).toHaveCSS('color',palette.inverseText);
 });
}


test('palette category and query intersect while live sliders preserve source bounds',async({page})=>{
 await open(page);
 await page.evaluate(async()=>{
  const app=document.querySelector('material-buildroot'),section=document.createElement('section');section.id='settings';
  const slider=document.createElement('md-slider');slider.min=2;slider.max=8;slider.step=2;slider.value=4;slider.setAttribute('aria-label','Fixture bounded slider');section.append(slider);app.shadowRoot.append(section);
  window.__sourceSlider=slider;window.__sliderChanges=[];slider.addEventListener('change',()=>window.__sliderChanges.push(slider.value));
  const {registerCommandActionProvider}=await import('/src/renderer/command-surfaces.ts');
  registerCommandActionProvider('overlay-fixture',()=>[{id:'navigation',label:'Fixture command',run:()=>{}}]);
 });
 await page.keyboard.press('Control+Shift+f');const surface=page.locator('command-surfaces');
 await surface.locator('settings-search').getByRole('textbox',{name:'Filter these actions',exact:true}).fill('Fixture');
 await surface.locator('md-filter-chip').filter({hasText:'Settings'}).click();
 await expect(surface.locator('[data-live-slider]')).toHaveCount(1);
 await expect(surface.locator('[data-action="registered-overlay-fixture:navigation"]')).toHaveCount(0);
 const proxy=surface.locator('[data-live-slider]');
 expect(await proxy.evaluate(el=>({min:el.min,max:el.max,step:el.step}))).toEqual({min:2,max:8,step:2});
 await proxy.evaluate(el=>{el.value=6;el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));});
 await expect.poll(()=>page.evaluate(()=>window.__sourceSlider.value)).toBe(6);
 await proxy.evaluate(el=>{el.value=7;el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));});
 expect(await page.evaluate(()=>window.__sourceSlider.value)).toBe(6);
 await surface.locator('md-filter-chip').filter({hasText:'Commands'}).click();
 await expect(surface.locator('[data-live-slider]')).toHaveCount(0);
 await expect(surface.locator('[data-action="registered-overlay-fixture:navigation"]')).toBeVisible();
});

test('confirmation key changes reset full slider authorization',async({page})=>{
 await open(page);await page.evaluate(async()=>{
  await import('/src/renderer/destructive-confirmation.ts');const dialog=document.createElement('destructive-confirmation');dialog.language='en';dialog.challenge={id:'key-reset',operation:'clean',destination:'/fixture/output',keys:['first','second'],expires:Date.now()+60000,rebuildRequired:true};document.body.append(dialog);window.__outcome='pending';void dialog.request().then(result=>window.__outcome=result);
 });
 const dialog=page.locator('destructive-confirmation');
 await dialog.locator('[data-confirmation-key="first"]').click();await dialog.locator('[data-confirmation-key="second"]').click();
 await dialog.locator('md-checkbox').click();
 await dialog.locator('md-slider').evaluate(el=>{el.value=100;el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));});
 await expect(dialog.getByRole('button',{name:'Queue clean target',exact:true})).toBeEnabled();
 await dialog.locator('[data-confirmation-key="first"]').click();
 await expect(dialog.getByRole('button',{name:'Queue clean target',exact:true})).toBeDisabled();
 expect(await dialog.locator('md-slider').evaluate(el=>el.value)).toBe(0);
 await dialog.getByRole('button',{name:'Emergency exit',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__outcome)).toBeNull();
});

test('wording controls persist each language independently and reject invalid display names',async({page})=>{
 await open(page);await page.evaluate(async()=>{
  await import('/src/renderer/language-wording-panel.ts');const panel=document.createElement('language-wording-panel');panel.language='en';document.querySelector('material-buildroot').shadowRoot.append(panel);
 });
 const panel=page.locator('language-wording-panel').last();
 await panel.locator('md-slider').first().evaluate(el=>{el.value=2;el.dispatchEvent(new Event('change',{bubbles:true,composed:true}));});
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.wording.v1')).englishHumor)).toBe(2);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.wording.v1')).cantoneseHumor)).toBe(5);
 await panel.getByRole('button',{name:'Reset English humor',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.wording.v1')).englishHumor)).toBe(5);
 await panel.getByRole('textbox',{name:'Application display name',exact:true}).fill('x'.repeat(97));
 await panel.getByRole('button',{name:'Save display name',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.wording.v1')).displayName)).toBe('');
 await expect(panel).toContainText('could not be stored');
});


async function nestedSectionFixture(page){
 await open(page);await page.evaluate(async()=>{
  await import('/src/renderer/workspace-section.ts');
  const outer=document.createElement('workspace-section'),inner=document.createElement('workspace-section');
  for(const [section,title] of [[outer,'Outer section'],[inner,'Inner section']]){const heading=document.createElement('span');heading.slot='heading';heading.textContent=title;section.append(heading);}
  const field=document.createElement('md-outlined-text-field');field.label='Nested retained field';
  const button=document.createElement('md-outlined-button');button.textContent='Nested retained action';
  inner.append(field,button);outer.append(inner);document.querySelector('material-buildroot').shadowRoot.append(outer);
  await outer.updateComplete;await inner.updateComplete;await field.updateComplete;await button.updateComplete;
  window.__nested={outer,inner,field,button};window.__nestedActions=[];
  button.addEventListener('click',()=>window.__nestedActions.push({outer:outer.open,inner:inner.open,visible:button.checkVisibility()}));
 });
}

test('palette opens nested retained sections before field focus and button activation',async({page})=>{
 await nestedSectionFixture(page);const surface=page.locator('command-surfaces');
 await page.keyboard.press('Control+Shift+f');
 await surface.locator('[data-action]').filter({hasText:'Nested retained field'}).click();
 await expect.poll(()=>page.evaluate(()=>{const {outer,inner,field}=window.__nested;return {outer:outer.open,inner:inner.open,visible:field.checkVisibility(),focused:field.matches(':focus-within')};})).toEqual({outer:true,inner:true,visible:true,focused:true});
 await page.evaluate(async()=>{window.__nested.outer.open=false;window.__nested.inner.open=false;await window.__nested.outer.updateComplete;await window.__nested.inner.updateComplete;});
 await page.keyboard.press('Control+Shift+f');
 await surface.locator('[data-action]').filter({hasText:'Nested retained action'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__nestedActions)).toEqual([{outer:true,inner:true,visible:true}]);
});

for(const restriction of ['locked','inert']){
 test(`retained-section reveal preserves ${restriction} restrictions, including stale actions`,async({page})=>{
  await nestedSectionFixture(page);await page.keyboard.press('Control+Shift+f');
  await page.evaluate(restriction=>{const {outer,inner}=window.__nested;if(restriction==='locked')outer.setAttribute('data-locked','true');else inner.shadowRoot.querySelector('#section-body').setAttribute('inert','');},restriction);
  await page.locator('command-surfaces [data-action]').filter({hasText:'Nested retained action'}).click();
  expect(await page.evaluate(()=>window.__nestedActions)).toEqual([]);
  expect(await page.evaluate(()=>({outer:window.__nested.outer.open,inner:window.__nested.inner.open}))).toEqual({outer:false,inner:false});
 });
}
