import {test,expect} from '@playwright/test';

// Renderer-only typed bridge fixture. No native runtime, picker or build executes.
async function open(page,{language='en',restricted=false}={}){
  await page.addInitScript(({language,restricted})=>{
    window.__requests=[];
    window.studio={
      sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:restricted,active:restricted,displayName:restricted?'Shared mode':null,revision:null,credentialKind:null}}),
      bootstrap:async()=>({language,revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version:'renderer fixture',source:null,updatedAt:null}),
      request:async()=>({ok:false,code:'UNAVAILABLE'}),onEvent:()=>()=>{},windowControl:async()=>true,
      operations:async request=>{window.__requests.push(request);const app=document.querySelector('material-buildroot');if(request.action==='project.list')return {ok:true,result:(app?.projectSessions??[]).map(p=>({id:p.workspaceId,name:p.name,authorized:true}))};if(request.action==='project.open'){const p=app?.projectSessions.find(p=>p.workspaceId===request.workspaceId);if(p)return {ok:true,result:{workspaceId:p.workspaceId,name:p.name}};}return {ok:false,code:'FIXTURE_UNAVAILABLE'};},
    };
  },{language,restricted});
  await page.goto('/');
  const app=page.locator('material-buildroot');
  await expect(app.locator('#workspace-heading')).toHaveText(language==='en'?'Images':language==='zh-HK'?'映像':'Images · 映像');
  await app.evaluate(async app=>{app.setupDone=true;await app.updateComplete;});
  return app;
}
const nav=(app,id)=>app.locator('nav [data-primary="'+id+'"]');

test('five primary destinations do not manufacture utility tabs',async({page})=>{
  const app=await open(page);
  await expect(app.locator('nav [data-primary]')).toHaveCount(5);
  expect(await app.locator('workspace-tabs').evaluate(t=>t.edge)).toBe('top');
  for(const [id,title] of [['builds','Builds'],['tools','Tools'],['help','Help'],['settings','Settings'],['images','Images']]){
    await nav(app,id).click();
    await expect(app.locator('#workspace-heading')).toHaveText(title);
    await expect(nav(app,id).locator('button')).toHaveAccessibleName(title+', current workspace');
  }
  expect(await app.locator('workspace-tabs').evaluate(t=>t.tabs.length)).toBe(0);
});

test('Images overview and resume retain the exact project host and inner draft',async({page})=>{
  const app=await open(page);
  await app.evaluate(async app=>{
    await app.adoptedProject(new CustomEvent('workspace-adopted',{detail:{workspaceId:'fixture-project',name:'Existing image project'}}));
    const panel=app.shadowRoot.querySelector('[data-project-id="fixture-project"]');
    panel.tab='config';panel.changes={BR2_TEST:{type:'string',value:'pending'}};await panel.updateComplete;
    window.__retainedPanel=panel;window.__retainedEditor=panel.shadowRoot.querySelector('image-presets-panel');
    app.operationChanged(new CustomEvent('operation-destination-changed',{detail:{destination:'config'}}));
  });
  await nav(app,'images').click();
  await expect(app.locator('.project-list').getByText('Existing image project',{exact:true})).toBeVisible();
  await app.locator('[data-resume-project="fixture-project"]').click();
  expect(await app.evaluate(app=>{
    const panel=app.shadowRoot.querySelector('[data-project-id="fixture-project"]');
    return panel===window.__retainedPanel&&panel.tab==='config'&&panel.shadowRoot.querySelector('image-presets-panel')===window.__retainedEditor&&panel.changes.BR2_TEST.value==='pending';
  })).toBe(true);
  expect(await app.locator('workspace-tabs').evaluate(t=>t.tabs.filter(tab=>tab.destination==='project:fixture-project').length)).toBe(1);
});

test('create and open use the public workflow adapter without claiming a build',async({page})=>{
  const app=await open(page);
  await app.evaluate(app=>{window.__projectActions=[];app.shadowRoot.querySelector('[data-project-id=""]').openProjectWorkflow=async mode=>window.__projectActions.push(mode);});
  await app.locator('[data-image-action="create"]').click();
  await app.locator('guided-image-creation').getByRole('button',{name:'Next: source and runtime',exact:true}).click();
  await nav(app,'images').click();
  await app.locator('[data-image-action="open"]').click();
  expect(await page.evaluate(()=>window.__projectActions)).toEqual(['create','open']);
  expect(await page.evaluate(()=>window.__requests.some(r=>r.action==='build.enqueue'))).toBe(false);
  await expect(app.locator('.project-context')).toHaveCount(0);
});

test('hidden host events cannot change active project navigation',async({page})=>{
  const app=await open(page);
  await nav(app,'builds').click();
  await app.evaluate(async app=>{
    app.projectSessions=[{workspaceId:'hidden-project',name:'Hidden project'}];await app.updateComplete;
    const hidden=app.shadowRoot.querySelector('[data-project-id="hidden-project"]');
    hidden.dispatchEvent(new CustomEvent('operation-destination-changed',{bubbles:true,composed:true,detail:{destination:'documentation'}}));
  });
  await expect(app.locator('#workspace-heading')).toHaveText('Builds');
  await app.locator('operations-panel:not([hidden])').evaluate(panel=>panel.dispatchEvent(new CustomEvent('operation-destination-changed',{bubbles:true,composed:true,detail:{destination:'unexpected'}})));
  await expect(app.locator('#workspace-heading')).toHaveText('Builds');
});

test('settings categories retain their panels and scheduled leave veto',async({page})=>{
  const app=await open(page);
  await nav(app,'settings').click();
  await expect(app.getByRole('heading',{name:'Appearance',exact:true})).toBeVisible();
  await app.evaluate(app=>{window.__schedulePanel=app.shadowRoot.querySelector('scheduled-preferences-panel');window.__schedulePanel.confirmLeave=async()=>false;});
  await nav(app,'images').click();
  await expect(app.locator('#workspace-heading')).toHaveText('Settings');
  await app.evaluate(app=>{window.__schedulePanel.confirmLeave=async()=>true;});
  await nav(app,'images').click();await nav(app,'settings').click();
  expect(await app.evaluate(app=>app.shadowRoot.querySelector('scheduled-preferences-panel')===window.__schedulePanel)).toBe(true);
  await app.locator('.settings-categories').getByRole('button',{name:'Language',exact:true}).click();
  await expect(app.getByRole('heading',{name:'Language',exact:true})).toBeVisible();
  await expect(app.getByRole('heading',{name:'Appearance',exact:true})).toBeHidden();
});

test('destination catalog preserves compatibility identifiers',async({page})=>{
  const app=await open(page);
  const ids=await app.locator('workspace-tabs').evaluate(t=>t.destinations.map(d=>d.id));
  for(const id of ['images','open-project','projects','activity','settings','about','operation:runtime','operation:source','operation:config','operation:package','operation:builds','operation:artifacts','operation:guests','operation:tools','operation:assistant','operation:regex','operation:authenticator','operation:companion','operation:updates','operation:documentation','tool:local','tool:convert','tool:pdf','tool:queue','tool:server','setting:schedules','wording:upload','setup','new-plan','export-plans','attention'])expect(ids).toContain(id);
});

test('attention opens without a permanent utility row and Escape restores focus',async({page})=>{
  const app=await open(page);
  const button=app.locator('header').getByRole('button',{name:'Attention and narration',exact:true});
  await expect(app.locator('guided-shell-attention .settings')).toHaveCount(0);
  await button.click();await expect(app.locator('guided-shell-attention .guided-attention.is-open')).toBeVisible();
  await page.keyboard.press('Escape');await expect(app.locator('guided-shell-attention .settings')).toHaveCount(0);
  expect(await button.evaluate(button=>button.getRootNode().activeElement===button)).toBe(true);
});

test('closed attention settings preserve enabled feedback and snooze',async({page})=>{
  const app=await open(page),attention=app.locator('guided-shell-attention');
  await page.evaluate(()=>{window.studio.attentionHistory=async()=>({ok:true});});
  await attention.evaluate(async panel=>{
    panel.preferences={...panel.preferences,modes:{...panel.preferences.modes,timeAwareness:true,oneThing:true,momentum:true},nextAction:'Review the selected configuration',snoozeUntil:0};
    panel.lastActivity=Date.now()-21*60000;panel.now=Date.now();await panel.updateComplete;
  });
  await expect(attention.locator('.settings')).toHaveCount(0);
  await expect(attention.locator('.attention-feedback')).toContainText('Session minutes');
  await expect(attention.locator('.attention-feedback')).toContainText('Review the selected configuration');
  await expect(attention.locator('.attention-feedback [role="status"]')).toBeVisible();
  await attention.getByRole('button',{name:'Not now, for one hour',exact:true}).click();
  expect(await attention.evaluate(panel=>panel.preferences.snoozeUntil>Date.now()+3500000)).toBe(true);
  await expect(attention.getByRole('button',{name:'Not now, for one hour',exact:true})).toHaveCount(0);
});

test('startup presentation remains visible with attention settings closed',async({page})=>{
  const app=await open(page),attention=app.locator('guided-shell-attention');
  await app.evaluate(async app=>{
    window.__surpriseCalls=0;
    window.studio.dimSum=async request=>{if(request.action==='surprise')window.__surpriseCalls++;return {ok:true,dish:{id:'fixture',en:'Fixture dish',zh:'測試點心',photo:'fixture',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}};};
    app.state={...app.state,origin:'saved'};app.setupDone=true;await app.updateComplete;
  });
  await expect(attention.locator('.settings')).toHaveCount(0);
  await expect(attention.locator('guided-shell-dim-sum .surprise')).toBeVisible();
  expect(await page.evaluate(()=>window.__surpriseCalls)).toBe(1);
  await expect(attention.locator('guided-shell-dim-sum').getByRole('button',{name:'Dim sum catalogue',exact:true})).toBeHidden();
  await attention.evaluate(panel=>panel.restricted=true);
  await expect(attention.locator('guided-shell-dim-sum .surprise')).toHaveCount(0);
});

test('New tab catalog attention action returns focus to the visible header',async({page})=>{
  const app=await open(page),tabs=app.locator('workspace-tabs');
  await tabs.locator('[data-control="new-tab"]').click();
  await tabs.getByRole('button',{name:'Attention and narration',exact:true}).click();
  await expect(app.locator('guided-shell-attention .guided-attention.is-open')).toBeVisible();
  await expect(tabs.locator('md-dialog[open]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(app.locator('guided-shell-attention .settings')).toHaveCount(0);
  expect(await app.locator('#attention-button').evaluate(button=>button.getRootNode().activeElement===button)).toBe(true);
});

test('closing attention cancels a deferred catalogue photo without creating a surprise',async({page})=>{
  const app=await open(page),attention=app.locator('guided-shell-attention'),catalogue=attention.locator('guided-shell-dim-sum');
  await page.evaluate(()=>{
    const dish={id:'fixture',en:'Fixture dish',zh:'測試點心',photo:'fixture',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='};
    window.studio.dimSum=async request=>request.action==='catalog'?{ok:true,dishes:[dish]}:new Promise(resolve=>window.__resolvePhoto=()=>resolve({ok:true,dish}));
  });
  await app.locator('#attention-button').click();
  await catalogue.getByRole('button',{name:'Dim sum catalogue',exact:true}).click();
  await catalogue.getByRole('button',{name:'Fixture dish',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__resolvePhoto)).toBe('function');
  await page.keyboard.press('Escape');
  await expect(attention.locator('.settings')).toHaveCount(0);
  await page.evaluate(()=>window.__resolvePhoto());
  await expect.poll(()=>catalogue.evaluate(panel=>panel.busy)).toBe(false);
  expect(await catalogue.evaluate(panel=>panel.selected)).toBeNull();
  await expect(catalogue.locator('.surprise')).toHaveCount(0);
});

test('attention respects Escape already consumed by a nested control',async({page})=>{
  const app=await open(page),attention=app.locator('guided-shell-attention');
  await app.locator('#attention-button').click();
  await attention.evaluate(panel=>{
    const control=panel.shadowRoot.querySelector('.settings md-outlined-text-field');
    control.addEventListener('keydown',event=>event.preventDefault(),{once:true});
    control.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true,cancelable:true}));
  });
  await expect(attention.locator('.guided-attention.is-open')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(attention.locator('.settings')).toHaveCount(0);
});

for(const pendingAction of ['catalog','photo'])test('restriction cancellation permits retry after pending '+pendingAction,async({page})=>{
  const app=await open(page),attention=app.locator('guided-shell-attention'),catalogue=attention.locator('guided-shell-dim-sum');
  await page.evaluate(pendingAction=>{
    const oldDish={id:'old',en:'Old dish',zh:'舊點心',photo:'fixture'};
    const freshDish={id:'fresh',en:'Fresh dish',zh:'新點心',photo:'fixture'};
    let deferredOld=false;
    window.studio.dimSum=async request=>{
      if(request.action===pendingAction&&!deferredOld){deferredOld=true;return new Promise(resolve=>window.__resolveOldCatalogue=()=>resolve({ok:true,dishes:[oldDish],dish:oldDish}));}
      if(request.action==='catalog'&&deferredOld)return new Promise(resolve=>window.__resolveFreshCatalogue=()=>resolve({ok:true,dishes:[freshDish]}));
      return {ok:true,dishes:[oldDish],dish:oldDish};
    };
  },pendingAction);
  await app.locator('#attention-button').click();
  await catalogue.getByRole('button',{name:'Dim sum catalogue',exact:true}).click();
  if(pendingAction==='photo')await catalogue.getByRole('button',{name:'Old dish',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__resolveOldCatalogue)).toBe('function');
  await attention.evaluate(async panel=>{panel.restricted=true;await panel.updateComplete;});
  await expect.poll(()=>catalogue.evaluate(panel=>panel.busy)).toBe(false);
  await expect(catalogue.getByRole('button',{name:'Dim sum catalogue',exact:true})).toHaveCount(0);
  await attention.evaluate(async panel=>{panel.restricted=false;await panel.updateComplete;});
  await catalogue.getByRole('button',{name:'Dim sum catalogue',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__resolveFreshCatalogue)).toBe('function');
  await page.evaluate(async()=>{window.__resolveOldCatalogue();await new Promise(requestAnimationFrame);});
  expect(await catalogue.evaluate(panel=>({busy:panel.busy,selected:panel.selected,dishes:panel.dishes}))).toEqual({busy:true,selected:null,dishes:[]});
  await page.evaluate(()=>window.__resolveFreshCatalogue());
  await expect(catalogue.getByRole('button',{name:'Fresh dish',exact:true})).toBeVisible();
  expect(await catalogue.evaluate(panel=>panel.busy)).toBe(false);
});

test('filtered settings jump reveals the intended personal wording panel',async({page})=>{
  const app=await open(page);await nav(app,'settings').click();
  await app.locator('.settings-page settings-search').getByRole('textbox').fill('Theme');
  await expect(app.locator('.settings-categories').getByRole('button')).toHaveCount(1);
  await app.evaluate(app=>app.workspaceDestination(new CustomEvent('workspace-destination',{detail:{destination:'wording:upload'}})));
  await expect(app.locator('personal-vocabulary-panel')).toBeVisible();
  await expect(app.locator('.settings-categories').getByRole('button',{name:'Personal vocabulary, selected',exact:true})).toBeVisible();
});

test('compact density persists while retaining comfortable targets',async({page})=>{
  const app=await open(page);await nav(app,'settings').click();
  await app.locator('[data-density="compact"]').click();
  await expect(app.locator('.shell')).toHaveClass(/compact/);
  expect(await app.locator('[data-density="compact"]').evaluate(button=>button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.reload();await expect(app.locator('.shell')).toHaveClass(/compact/);
  await nav(app,'settings').click();await app.locator('[data-density="comfortable"]').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('material-buildroot.guided-shell.v1')))).toEqual({version:1,density:'comfortable'});
});

test('density write failure preserves prior value and reports failure',async({page})=>{
  const app=await open(page);await nav(app,'settings').click();
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='material-buildroot.guided-shell.v1')throw new DOMException('Denied','SecurityError');return set.call(this,key,value);};});
  await app.locator('[data-density="compact"]').click();
  await expect(app.locator('.shell')).toHaveClass(/comfortable/);
  await expect(app.getByText(/^Density was not saved\. The previous spacing remains in use\./)).toBeVisible();
});

test('invalid density type falls back without accepting coerced array values',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('material-buildroot.guided-shell.v1',JSON.stringify({version:1,density:['compact']})));
  const app=await open(page);await nav(app,'settings').click();
  await expect(app.locator('.shell')).toHaveClass(/comfortable/);
  await expect(app.getByText(/^Saved density could not be read\./)).toBeVisible();
});

test('runtime context reports saved host data rather than editable inputs',async({page})=>{
  const app=await open(page);
  await app.evaluate(async app=>{
    const operations=window.studio.operations;
    window.studio.operations=async request=>request.action==='project.options'?{ok:true,result:{runtime:{kind:'wsl',distribution:'Saved distribution'}}}:operations(request);
    await app.adoptedProject(new CustomEvent('workspace-adopted',{detail:{workspaceId:'fixture-project',name:'Image project'}}));
    const panel=app.shadowRoot.querySelector('[data-project-id="fixture-project"]');await panel.updateComplete;
    panel.runtimeKind='docker';panel.image='unsaved-image';app.requestUpdate();
  });
  await expect(app.locator('.project-context')).toContainText('WSL 2 · Saved distribution');
  await expect(app.locator('.project-context')).not.toContainText('unsaved-image');
});

test('pending plan decision leaves navigation unchanged until explicitly resolved',async({page})=>{
  const app=await open(page);
  await app.evaluate(async app=>{
    app.plans=[{id:'plan-1',name:'Original',runtime:'wsl',target:'image',status:'draft',notes:'',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}];
    app.selectedId='plan-1';app.edit={...app.plans[0],name:'Pending'};app.route='projects';await app.updateComplete;
  });
  await nav(app,'builds').click();
  await expect(app.locator('#workspace-heading')).toHaveText('Project plans');
  await expect(app.locator('#leave-dialog')).toBeVisible();
  await app.locator('#leave-dialog').getByRole('button',{name:'Stay',exact:true}).click();
  expect(await app.evaluate(app=>app.edit.name)).toBe('Pending');
});

test('outputs and updates retain compatible primary grouping',async({page})=>{
  const app=await open(page);
  for(const [destination,title] of [['operation:artifacts','Images'],['operation:updates','Settings']]){
    await app.evaluate((app,destination)=>app.workspaceDestination(new CustomEvent('workspace-destination',{detail:{destination}})),destination);
    await expect(app.locator('#workspace-heading')).toHaveText(title);
    expect(await app.locator('operations-panel:not([hidden])').evaluate(panel=>panel.tab)).toBe(destination.slice(10));
  }
});

for(const language of ['en','zh-HK','bilingual'])test('Images has no horizontal overflow at narrow renderer widths: '+language,async({page})=>{
  const app=await open(page,{language});
  for(const width of [960,640,320]){
    await page.setViewportSize({width,height:800});
    expect(await app.evaluate(app=>{
      const main=app.shadowRoot.querySelector('main'),images=app.shadowRoot.querySelector('.images-workspace');
      return {main:main.scrollWidth<=main.clientWidth+1,images:images.scrollWidth<=images.clientWidth+1,body:document.body.scrollWidth<=innerWidth+1};
    })).toEqual({main:true,images:true,body:true});
    await expect(app.locator('[data-image-action="create"]')).toBeVisible();
  }
});
