import {test,expect} from '@playwright/test';

// Full renderer journey with typed host responses. Native selection and execution never run.
async function open(page,{projects=[],saved=null,language='en',version='0.1.1',updatedAt='2026-10-18T12:00:00Z'}={}){
 await page.addInitScript(({projects,saved,language,version,updatedAt})=>{
  window.__calls=[];window.__projects=projects;window.__adoptId='project-1';window.__catalogueUnavailable=false;window.__cancelPicker=false;
  if(saved&&!localStorage.getItem('iso-workflow-project-1'))localStorage.setItem('iso-workflow-project-1',JSON.stringify(saved));
  const register=()=>{const id=window.__adoptId;window.__projects=[...window.__projects.filter(p=>p.id!==id),{id,name:'Chosen project',authorized:true}];return {workspaceId:id,name:'Chosen project'};};
  window.studio={
   bootstrap:async()=>({language,revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version,source:null,updatedAt}),
   sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),
   onEvent:()=>()=>{},request:async()=>({ok:false,code:'UNAVAILABLE'}),windowControl:async()=>true,
   operations:async r=>{window.__calls.push(r);
    if(r.action==='project.list')return window.__catalogueUnavailable?{ok:false,code:'UNAVAILABLE'}:{ok:true,result:window.__projects};
    if(r.action==='project.open'){const project=window.__projects.find(p=>p.id===r.workspaceId);return project?.authorized?{ok:true,result:{workspaceId:project.id,name:project.name}}:{ok:false,code:'PROJECT_NOT_ADOPTED'};}
    if(r.action==='project.options')return {ok:true,result:{runtime:null}};
    if(r.action==='project.choose')return window.__cancelPicker?{ok:false,code:'CANCELLED'}:{ok:true,result:{selectionId:'selected-folders',name:'Selected source',source:'fixture/source',output:'fixture/output'}};
    if(r.action==='project.adopt')return {ok:true,result:register()};
    if(r.action==='source'&&r.request.action==='source.choose')return window.__cancelPicker?{ok:false,code:'CANCELLED'}:{ok:true,result:{ok:true,selectionId:'selected-parent',name:'Selected parent'}};
    if(r.action==='source'&&r.request.action==='source.clone')return {ok:true,result:{ok:true,...register()}};
    if(r.action==='imagePreset.catalog')return {ok:true,result:{revision:'catalog-1',presets:[],desktops:[]}};
    if(r.action==='imagePreset.isoPlan')return {ok:false,code:'KCONFIG_SOURCE_TRUST_REQUIRED'};
    return {ok:false,code:'FIXTURE_UNAVAILABLE'};
   }
  };
 },{projects,saved,language,version,updatedAt});
 await page.goto('/');const app=page.locator('material-buildroot');
 await expect(app.locator('.images-workspace')).toBeVisible();
 await app.evaluate(async app=>{app.setupDone=true;await app.updateComplete;});
 return app;
}
async function begin(page,options){const app=await open(page,options);await app.locator('[data-image-action="create"]').click();return {app,creation:app.locator('guided-image-creation')};}
async function next(creation){await creation.getByRole('button',{name:'Next: source and runtime',exact:true}).click();}
async function clone(app){const project=app.locator('operations-panel:not([hidden]) project-workflow-panel');await project.getByRole('button',{name:'Choose destination parent',exact:true}).click();await project.getByRole('checkbox').check();await project.getByRole('button',{name:'Clone and create project',exact:true}).click();}
const existingDraft={version:2,revision:3,step:4,mode:'easy',name:'existing-image',target:'bios-iso',preset:'server',desktop:'none',ssh:true,boardId:null,jobId:'existing-job'};

test('Create starts with visible Purpose and target before any native picker',async({page})=>{
 await page.setViewportSize({width:960,height:640});const {app,creation}=await begin(page);
 await expect(creation.getByRole('heading',{name:'Purpose and target',exact:true})).toBeVisible();
 await expect(creation.getByRole('textbox',{name:'Image name',exact:true})).toBeVisible();
 const button=creation.getByRole('button',{name:'Next: source and runtime',exact:true});
 const bounds=await button.boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(608);
 expect(await page.evaluate(()=>window.__calls.some(r=>r.action==='project.choose'||r.action==='source'))).toBe(false);
 await expect(app.locator('operations-panel:not([hidden])')).toHaveCount(0);
});

test('cancel and restart preserve the same pre-project intent and source stage',async({page})=>{
 const {app,creation}=await begin(page);await creation.getByRole('textbox',{name:'Image name',exact:true}).fill('rescue-disc');
 await creation.locator('md-outlined-select').nth(1).evaluate(select=>{select.value='server';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await next(creation);await page.evaluate(()=>window.__cancelPicker=true);
 await app.locator('operations-panel:not([hidden]) project-workflow-panel').getByRole('button',{name:'Choose destination parent',exact:true}).click();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')));
 expect(before).toMatchObject({name:'rescue-disc',purpose:'server',stage:'source'});
 expect(Object.keys(before).sort()).toEqual(['id','mode','name','purpose','revision','stage','target','version']);
 await creation.getByRole('button',{name:'Return to Images',exact:true}).click();await page.reload();
 await app.locator('[data-image-action="resume-draft"]').click();
 await expect(creation.getByRole('heading',{name:'Source and runtime',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).id)).toBe(before.id);
});

test('invalid pre-project name is explicitly unsaved and Return retains the last valid choice',async({page})=>{
 const {app,creation}=await begin(page);const name=creation.getByRole('textbox',{name:'Image name',exact:true});
 await name.fill('retained-name');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).name)).toBe('retained-name');
 const before=await page.evaluate(()=>localStorage.getItem('material-buildroot.image-creation.v1'));
 await name.fill('../invalid-name');
 await expect(creation.locator('.name-save-warning')).toContainText('This name is not saved. The last valid name is retained');
 await expect(creation.getByRole('button',{name:'Next: source and runtime',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>localStorage.getItem('material-buildroot.image-creation.v1'))).toBe(before);
 await creation.getByRole('button',{name:'Return to Images',exact:true}).click();await page.reload();
 await app.locator('[data-image-action="resume-draft"]').click();
 await expect(name).toHaveValue('retained-name');await expect(creation.locator('.name-save-warning')).toHaveCount(0);
});

test('adoption transfers intent and automatically continues the same guide at Source',async({page})=>{
 const {app,creation}=await begin(page);await creation.getByRole('textbox',{name:'Image name',exact:true}).fill('appliance-image');
 await next(creation);await clone(app);
 const guide=app.locator('operations-panel:not([hidden]) image-presets-panel');
 await expect(guide.getByRole('heading',{name:/^Where will it be built\?/})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).stage)).toBe('workspace');
 const records=await page.evaluate(()=>({intent:JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')),draft:JSON.parse(localStorage.getItem('iso-workflow-project-1'))}));
 expect(records.draft).toMatchObject({creationId:records.intent.id,name:'appliance-image',step:1,jobId:null});
 expect(records.intent.workspaceId).toBe('project-1');
 expect(await page.evaluate(()=>window.__calls.some(r=>r.action==='imagePreset.isoBuild'||r.action==='config.trustGrant'))).toBe(false);
});

test('existing project draft requires explicit replacement, archives choices and retains job identity',async({page})=>{
 const {app,creation}=await begin(page,{saved:existingDraft});await next(creation);await clone(app);
 const guide=app.locator('operations-panel:not([hidden]) image-presets-panel');
 await expect(guide.getByRole('button',{name:'Resume existing draft',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-project-1')))).toEqual(existingDraft);
 await guide.getByRole('button',{name:'Replace choices and keep recovery copy',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).stage)).toBe('workspace');
 const records=await page.evaluate(()=>({draft:JSON.parse(localStorage.getItem('iso-workflow-project-1')),history:JSON.parse(localStorage.getItem('iso-workflow-project-1-recovery'))}));
 expect(records.draft).toMatchObject({name:'linux-bios-image',jobId:'existing-job',step:4});expect(records.history).toEqual([existingDraft]);
});

test('Resume existing choices never overwrites the project draft or saved job',async({page})=>{
 const {app,creation}=await begin(page,{saved:existingDraft});await next(creation);await clone(app);
 const guide=app.locator('operations-panel:not([hidden]) image-presets-panel');await guide.getByRole('button',{name:'Resume existing draft',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).stage)).toBe('workspace');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-project-1')))).toEqual(existingDraft);
});

test('Images reads host catalogue after restart and opens through current host authority',async({page})=>{
 const app=await open(page,{projects:[{id:'project-1',name:'Saved project',authorized:true}]});
 await expect(app.locator('.project-list')).toContainText('Saved project');
 await app.locator('[data-resume-project="project-1"]').click();
 await app.locator('nav [data-primary="images"]').click();
 await expect(app.locator('.project-list li')).toHaveCount(1);
 await page.reload();await expect(app.locator('.project-list')).toContainText('Saved project');await app.locator('[data-resume-project="project-1"]').click();
 expect(await page.evaluate(()=>window.__calls.filter(r=>r.action==='project.open').map(r=>r.workspaceId))).toEqual(['project-1']);
});

test('renewal uses native picker workflow and rejects a different host project identity',async({page})=>{
 const app=await open(page,{projects:[{id:'project-1',name:'Saved project',authorized:false}]});
 await app.locator('[data-resume-project="project-1"]').click();
 expect(await page.evaluate(()=>window.__calls.some(r=>r.action==='project.choose'))).toBe(false);
 const project=app.locator('operations-panel:not([hidden]) project-workflow-panel');
 await project.getByRole('button',{name:'Choose existing project folders',exact:true}).click();await project.getByRole('checkbox').check();await page.evaluate(()=>window.__adoptId='wrong-project');
 await project.getByRole('button',{name:'Adopt selected project',exact:true}).click();
 await expect(project).toContainText('PROJECT_IDENTITY_MISMATCH');
 expect(await app.evaluate(app=>app.projectSessions)).toEqual([]);
 await page.evaluate(()=>window.__adoptId='project-1');await project.getByRole('button',{name:'Adopt selected project',exact:true}).click();
 await expect.poll(()=>app.evaluate(app=>app.activeProject)).toBe('project-1');
});

test('catalogue failure is distinct from empty and Retry reads current host records',async({page})=>{
 const app=await open(page);await page.evaluate(()=>window.__catalogueUnavailable=true);await app.locator('nav [data-primary="images"]').click();
 await expect(app.getByRole('button',{name:'Retry project catalogue',exact:true})).toBeVisible();
 await expect(app.getByText(/^No saved projects\./)).toHaveCount(0);
 await page.evaluate(()=>{window.__catalogueUnavailable=false;window.__projects=[{id:'project-1',name:'Recovered project',authorized:false}];});
 await app.getByRole('button',{name:'Retry project catalogue',exact:true}).click();await expect(app.locator('.project-list')).toContainText('Recovered project');
});

test('idempotent transfer preserves later edits and unknown existing records',async({page})=>{
 await open(page);
 const result=await page.evaluate(async()=>{
  const {transferImageIntent}=await import('/src/renderer/image-workflow-draft.ts');
  const intent={version:1,id:'intent-1',revision:1,stage:'source',name:'original',mode:'easy',purpose:'minimal',target:'bios-iso',workspaceId:'adapter-project'};
  const first=await transferImageIntent('adapter-project',intent);
  const edited={...first.draft,name:'later-edit',revision:2};localStorage.setItem('iso-workflow-adapter-project',JSON.stringify(edited));
  const repeat=await transferImageIntent('adapter-project',intent);
  localStorage.setItem('iso-workflow-unknown-project','not-json');
  const invalid=await transferImageIntent('unknown-project',{...intent,workspaceId:'unknown-project'},'replace');
  return {first:first.status,repeat,invalid:invalid.status,raw:localStorage.getItem('iso-workflow-unknown-project')};
 });
 expect(result.first).toBe('applied');expect(result.repeat).toMatchObject({status:'existing',draft:{name:'later-edit'}});expect(result.invalid).toBe('invalid');expect(result.raw).toBe('not-json');
});

test('front screen displays host version and bound update time, including unavailable metadata',async({page})=>{
 const app=await open(page);await expect(app.locator('.front-provenance')).toContainText('0.1.1');await expect(app.locator('.front-provenance')).toContainText('2026');
 expect(await app.locator('.front-provenance').innerText()).toMatch(/GMT|UTC/);
 await app.evaluate(app=>{app.state={...app.state,version:'renderer verification fixture',updatedAt:null};});
 await expect(app.locator('.front-provenance')).toContainText('renderer verification fixture');await expect(app.locator('.front-provenance')).toContainText('Unavailable');
});

test('a late project-open response cannot replace later navigation',async({page})=>{
 const app=await open(page,{projects:[{id:'project-1',name:'Saved project',authorized:true}]});
 await page.evaluate(()=>{const operations=window.studio.operations;window.studio.operations=r=>r.action==='project.open'?new Promise(resolve=>window.__resolveOpen=()=>resolve({ok:true,result:{workspaceId:'project-1',name:'Saved project'}})):operations(r);});
 await app.locator('[data-resume-project="project-1"]').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.__resolveOpen)).toBe('function');
 await app.locator('nav [data-primary="settings"]').click();
 await app.evaluate(app=>{app.snapshotName='Unsubmitted backup label';});
 await page.evaluate(async()=>{window.__resolveOpen();await new Promise(requestAnimationFrame);});
 expect(await app.evaluate(app=>({route:app.route,active:app.activeProject,draft:app.snapshotName}))).toEqual({route:'settings',active:'',draft:'Unsubmitted backup label'});
});

test('delayed adoption stays available without leaving a later screen or binding the intent',async({page})=>{
 const {app,creation}=await begin(page);await next(creation);
 await page.evaluate(()=>{const operations=window.studio.operations;window.studio.operations=r=>r.action==='source'&&r.request.action==='source.clone'?new Promise(resolve=>window.__resolveClone=async()=>resolve(await operations(r))):operations(r);});
 await clone(app);await expect.poll(()=>page.evaluate(()=>typeof window.__resolveClone)).toBe('function');
 await app.locator('nav [data-primary="settings"]').click();await page.evaluate(async()=>{await window.__resolveClone();await new Promise(requestAnimationFrame);});
 await expect.poll(()=>app.evaluate(app=>app.projectSessions.length)).toBe(1);
 expect(await app.evaluate(app=>({route:app.route,active:app.activeProject}))).toEqual({route:'settings',active:''});
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).workspaceId)).toBeUndefined();
});

test('an old adoption never binds a newer image intent',async({page})=>{
 const {app,creation}=await begin(page);await next(creation);
 await page.evaluate(()=>{const operations=window.studio.operations;window.studio.operations=r=>r.action==='source'&&r.request.action==='source.clone'?new Promise(resolve=>window.__resolveClone=async()=>resolve(await operations(r))):operations(r);});
 await clone(app);await expect.poll(()=>page.evaluate(()=>typeof window.__resolveClone)).toBe('function');
 const previousId=await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).id);
 await creation.getByRole('button',{name:'Return to Images',exact:true}).click();await app.locator('[data-image-action="create"]').click();await app.getByRole('button',{name:'Create another and keep previous',exact:true}).click();
 const nextId=await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).id);expect(nextId).not.toBe(previousId);
 await page.evaluate(async()=>{await window.__resolveClone();await new Promise(requestAnimationFrame);});
 await expect.poll(()=>app.evaluate(app=>app.projectSessions.length)).toBe(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')))).toMatchObject({id:nextId,stage:'purpose'});
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).workspaceId)).toBeUndefined();
 await expect(creation.getByRole('heading',{name:'Purpose and target',exact:true})).toBeVisible();
});

for(const [primary,tab] of [['help','documentation'],['tools','tools']])test('adoption continuation respects '+primary+' selected while intent persistence waits',async({page})=>{
 const {app,creation}=await begin(page);await next(creation);
 await expect(app.locator('operations-panel:not([hidden]) project-workflow-panel').getByRole('button',{name:'Choose destination parent',exact:true})).toBeVisible();
 await page.evaluate(()=>{window.__creationLock=navigator.locks.request('material-buildroot.image-creation.v1',async()=>{window.__creationLockEntered=true;await new Promise(resolve=>window.__releaseCreationLock=resolve);});});
 await expect.poll(()=>page.evaluate(()=>window.__creationLockEntered)).toBe(true);
 await clone(app);
 await expect.poll(()=>page.evaluate(async()=>(await navigator.locks.query()).pending.some(lock=>lock.name==='material-buildroot.image-creation.v1'))).toBe(true);
 await app.locator('nav [data-primary="'+primary+'"]').click();
 await page.evaluate(async()=>{window.__releaseCreationLock();await window.__creationLock;await document.querySelector('material-buildroot').creationWrites;await new Promise(requestAnimationFrame);});
 await expect.poll(()=>app.evaluate(app=>app.activeOperations()?.tab)).toBe(tab);
 expect(await app.evaluate(app=>app.projectSessions.map(project=>project.workspaceId))).toEqual(['project-1']);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')))).toMatchObject({workspaceId:'project-1',stage:'source'});
 expect(await page.evaluate(()=>localStorage.getItem('iso-workflow-project-1'))).toBeNull();
});

for(const [choice,heading] of [['Source','Source'],['Configuration','Configuration'],['Accounts','Accounts'],['Saved configurations','Saved configurations']])test('advanced disclosure restores visible heading focus after '+choice,async({page})=>{
 const app=await open(page,{projects:[{id:'project-1',name:'Saved project',authorized:true}]});await app.locator('[data-resume-project="project-1"]').click();
 const operations=app.locator('operations-panel:not([hidden])');await operations.evaluate(panel=>panel.openImageGuide());
 const disclosure=operations.locator('.advanced-project-tools');await disclosure.locator('summary').focus();await page.keyboard.press('Enter');
 await disclosure.getByRole('button',{name:choice,exact:true}).focus();await page.keyboard.press('Enter');
 const target=operations.locator('#operation-heading');
 await expect.poll(()=>target.evaluate(element=>element.checkVisibility()&&element.getRootNode().activeElement===element)).toBe(true);
 await expect(target).toHaveText(heading);
 await expect(disclosure).toHaveCount(0);
});

test('transfer waits for local saves and archives the latest choices under a held lock',async({page})=>{
 await open(page);
 await page.evaluate(async()=>{
  const intent={version:1,id:'locked-intent',revision:1,stage:'source',name:'incoming-image',mode:'easy',purpose:'minimal',target:'bios-iso',workspaceId:'locked-project'};
  localStorage.setItem('iso-workflow-locked-project',JSON.stringify({version:2,revision:1,step:0,mode:'easy',name:'old-image',target:'bios-iso',preset:'keep',desktop:'none',ssh:false,boardId:null,jobId:null}));
  const panel=document.createElement('image-presets-panel');panel.id='locked-image';panel.workspaceId='locked-project';panel.creationIntent=intent;panel.language='en';document.body.append(panel);await panel.updateComplete;
  window.__heldLock=navigator.locks.request('material-buildroot.image-draft.locked-project',async()=>{window.__lockEntered=true;await new Promise(resolve=>window.__releaseDraftLock=resolve);});
  window.__incomingIntent=intent;
 });
 await expect.poll(()=>page.evaluate(()=>window.__lockEntered)).toBe(true);
 const panel=page.locator('#locked-image');await panel.getByRole('textbox',{name:'Image name',exact:true}).fill('latest-local-choice');
 await panel.evaluate(panel=>{window.__transfer=panel.receiveCreationIntent(window.__incomingIntent,'replace');});
 await expect(panel.getByRole('textbox',{name:'Image name',exact:true})).toBeDisabled();
 await panel.evaluate(panel=>panel.isoAction('build'));
 expect(await page.evaluate(()=>window.__calls.some(r=>r.action==='imagePreset.isoBuild'))).toBe(false);
 await page.evaluate(async()=>{window.__releaseDraftLock();await window.__heldLock;window.__transferResult=await window.__transfer;});
 expect(await page.evaluate(()=>window.__transferResult.status)).toBe('applied');
 const records=await page.evaluate(()=>({archive:JSON.parse(localStorage.getItem('iso-workflow-locked-project-recovery')),current:JSON.parse(localStorage.getItem('iso-workflow-locked-project'))}));
 expect(records.archive[0].name).toBe('latest-local-choice');expect(records.current.name).toBe('incoming-image');
});

test('guided project purpose keeps name, purpose and Next above the minimum-size fold',async({page})=>{
 await page.setViewportSize({width:960,height:640});const app=await open(page,{projects:[{id:'project-1',name:'Saved project',authorized:true}]});
 await app.locator('[data-resume-project="project-1"]').click();
 await app.evaluate(app=>app.workspaceDestination(new CustomEvent('workspace-destination',{detail:{destination:'operation:config'}})));
 const guide=app.locator('operations-panel:not([hidden]) image-presets-panel');
 await expect(guide.getByRole('textbox',{name:'Image name',exact:true})).toBeVisible();
 const next=guide.getByRole('button',{name:'Next',exact:true});await expect(next).toBeVisible();
 await page.screenshot({path:'.cache/guided-creation-purpose-960.png'});
 const bounds=await next.boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(608);
});

test('Create another preserves the previous intent and starts a different stable ID',async({page})=>{
 const {app,creation}=await begin(page);await creation.getByRole('textbox',{name:'Image name',exact:true}).fill('first-draft');await next(creation);
 const previous=await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')));
 await creation.getByRole('button',{name:'Return to Images',exact:true}).click();
 await app.locator('[data-image-action="create"]').click();
 await app.getByRole('button',{name:'Create another and keep previous',exact:true}).click();
 await expect(creation.getByRole('heading',{name:'Purpose and target',exact:true})).toBeVisible();
 const records=await page.evaluate(()=>({current:JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')),history:JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1.recovery'))}));
 expect(records.current.id).not.toBe(previous.id);expect(records.history).toEqual([previous]);
});

test('safe image name prefills an untouched project form without overwriting typed project choices',async({page})=>{
 const {app,creation}=await begin(page);await creation.getByRole('textbox',{name:'Image name',exact:true}).fill('suggested-source');await next(creation);
 const field=app.locator('operations-panel:not([hidden]) project-workflow-panel').getByRole('textbox',{name:'New source folder name',exact:true});
 await expect(field).toHaveValue('suggested-source');await field.fill('person-chosen-folder');
 await creation.getByRole('button',{name:'Back to purpose',exact:true}).click();await creation.getByRole('textbox',{name:'Image name',exact:true}).fill('different-image');await next(creation);
 await expect(field).toHaveValue('person-chosen-folder');
});

test('an unsaved transfer can return to editing without losing the durable intent',async({page})=>{
 const {app,creation}=await begin(page);await next(creation);await clone(app);
 const guide=app.locator('operations-panel:not([hidden]) image-presets-panel');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')).stage)).toBe('workspace');
 const before=await page.evaluate(()=>localStorage.getItem('material-buildroot.image-creation.v1'));
 await guide.evaluate(async panel=>{panel.isoStep=0;panel.imageName='';await panel.saveIso();await panel.receiveCreationIntent({...JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')),id:'another-intent',stage:'source'});});
 await guide.getByRole('button',{name:'Keep editing existing draft',exact:true}).click();
 await guide.getByRole('textbox',{name:'Image name',exact:true}).fill('corrected-name');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-project-1')).name)).toBe('corrected-name');
 expect(await page.evaluate(()=>localStorage.getItem('material-buildroot.image-creation.v1'))).toBe(before);
});

test('replacement storage failure preserves both original draft and recovery copy',async({page})=>{
 await open(page,{saved:existingDraft});
 const result=await page.evaluate(async()=>{
  const {transferImageIntent}=await import('/src/renderer/image-workflow-draft.ts');
  const before=localStorage.getItem('iso-workflow-project-1'),set=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key==='iso-workflow-project-1')throw new DOMException('Full','QuotaExceededError');return set.call(this,key,value);};
  const result=await transferImageIntent('project-1',{version:1,id:'new-intent',revision:1,stage:'source',name:'new-image',mode:'easy',purpose:'minimal',target:'bios-iso',workspaceId:'project-1'},'replace');
  return {result,before,after:localStorage.getItem('iso-workflow-project-1'),history:JSON.parse(localStorage.getItem('iso-workflow-project-1-recovery'))};
 });
 expect(result.result.status).toBe('unavailable');expect(result.after).toBe(result.before);expect(result.history).toEqual([existingDraft]);
});

test('shared shell navigation styles never resize or hide a nested pager',async({page})=>{
 const app=await open(page);
 await page.evaluate(async()=>{
  const {workspaceStyles}=await import('/src/renderer/workspace-styles.ts');
  const host=document.createElement('div');host.id='nested-nav-fixture';host.style.cssText='position:fixed;bottom:50px;left:16px;width:calc(100vw - 32px);height:64px;z-index:100';
  const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');style.textContent=workspaceStyles.cssText+'.pager{display:flex;gap:8px}.pager button{min-height:44px}';shadow.append(style);
  const nav=document.createElement('nav');nav.className='pager';nav.innerHTML='<button>Previous</button><button>Next</button>';shadow.append(nav);document.body.append(host);
 });
 for(const width of [960,480]){
  await page.setViewportSize({width,height:800});
  const geometry=await page.locator('#nested-nav-fixture').evaluate(host=>{const nav=host.shadowRoot.querySelector('nav'),style=getComputedStyle(nav);return {display:style.display,direction:style.flexDirection,width:nav.getBoundingClientRect().width};});
  expect(geometry.display).toBe('flex');expect(geometry.direction).toBe('row');expect(geometry.width).toBe(width-32);
  await expect(app.locator('nav [data-primary]')).toHaveCount(5);
  for(const button of await app.locator('nav [data-primary]').all())await expect(button).toBeVisible();
 }
});


test('Purpose selects localize their selected text through Settings without changing the draft',async({page})=>{
 const {app,creation}=await begin(page);
 await page.evaluate(()=>{
  window.__languageRequests=[];
  window.studio.request=async request=>{
   if(request.action!=='settings.setLanguage')return {ok:false,code:'FIXTURE_UNAVAILABLE'};
   window.__languageRequests.push(request.arguments.language);
   return {ok:true,revision:String(window.__languageRequests.length).repeat(40)};
  };
 });
 const mode=creation.locator('md-outlined-select').nth(0),purpose=creation.locator('md-outlined-select').nth(1);
 const choose=async(select,index)=>{
  await select.click();
  const picker=page.locator('searchable-picker').filter({has:page.locator('md-dialog[open]')});
  await expect(picker.getByRole('dialog')).toBeVisible();
  await picker.locator('[data-option="'+index+'"]').click();
  await expect(picker.getByRole('dialog')).toBeHidden();
 };
 await creation.getByRole('textbox',{name:'Image name',exact:true}).fill('retained-server-image');
 await choose(mode,1);await choose(purpose,3);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.image-creation.v1')))).toMatchObject({name:'retained-server-image',mode:'advanced',purpose:'server',stage:'purpose'});
 const saved=await page.evaluate(()=>localStorage.getItem('material-buildroot.image-creation.v1'));
 await creation.evaluate(el=>{window.__purposeHost=el;window.__purposeSelects=[...el.shadowRoot.querySelectorAll('md-outlined-select')];window.__purposeChanges=0;el.addEventListener('creation-change',()=>window.__purposeChanges++);});
 const labels={
  en:{mode:'Configuration mode',modeValue:'Advanced',purpose:'Intended purpose (unverified)',purposeValue:'Small server'},
  'zh-HK':{mode:'設定模式',modeValue:'進階',purpose:'預定用途（未核實）',purposeValue:'小型伺服器'},
  bilingual:{mode:'Configuration mode · 設定模式',modeValue:'Advanced · 進階',purpose:'Intended purpose (unverified) · 預定用途（未核實）',purposeValue:'Small server · 小型伺服器'},
 };
 const check=async language=>{
  await expect(creation).toHaveJSProperty('language',language);
  for(const [select,key] of [[mode,'mode'],[purpose,'purpose']]){
   await expect(select).toHaveJSProperty('label',labels[language][key]);
   await expect(select).toHaveJSProperty('displayText',labels[language][key+'Value']);
   await expect(select.locator('div#label')).toHaveText(labels[language][key+'Value']);
   expect(await select.evaluate(el=>el.displayText===el.querySelector('md-select-option[value="'+el.value+'"] [slot="headline"]').textContent.trim())).toBe(true);
  }
  expect(await creation.evaluate(el=>el===window.__purposeHost&&[...el.shadowRoot.querySelectorAll('md-outlined-select')].every((select,i)=>select===window.__purposeSelects[i]))).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('material-buildroot.image-creation.v1'))).toBe(saved);
  expect(await page.evaluate(()=>window.__purposeChanges)).toBe(0);
 };
 await check('en');
 for(const [language,index] of [['zh-HK',1],['bilingual',2],['en',0]]){
  await app.locator('nav [data-primary="settings"]').click();
  await app.locator('.settings-categories md-outlined-button').first().click();
  await choose(app.locator('#language-select'),index);
  await app.locator('#language-select').locator('..').locator('md-filled-button').first().click();
  await expect.poll(()=>app.evaluate(el=>el.effectiveLanguage)).toBe(language);
  await app.locator('nav [data-primary="images"]').click();
  await app.locator('[data-image-action="resume-draft"]').click();
  await expect(creation).toBeVisible();await check(language);
 }
 expect(await page.evaluate(()=>window.__languageRequests)).toEqual(['zh-HK','bilingual','en']);
 expect(await page.evaluate(()=>window.__calls.some(r=>['project.choose','source','project.adopt','imagePreset.isoBuild','config.trustGrant'].includes(r.action)))).toBe(false);
});
