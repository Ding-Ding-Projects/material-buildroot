import {test,expect} from '@playwright/test';
test.setTimeout(60000);

// Component fixture with asynchronous owner decisions. Native acceptance is separate.
async function fixture(page,{deny=false,pinned=false,survivor=false}={}){
 await page.goto('/');
 await page.evaluate(async({deny,pinned,survivor})=>{
  await customElements.whenDefined('workspace-tabs');
  const tabs=document.createElement('workspace-tabs');tabs.id='tab-fixture';tabs.language='en';
  tabs.destinations=[{id:'alpha',en:'Alpha',zh:'甲',icon:'folder_open'},{id:'beta',en:'Beta',zh:'乙',icon:'folder_open'},{id:'gamma',en:'Other',zh:'其他',icon:'folder_open'}];
  document.querySelector('material-buildroot')?.remove();localStorage.removeItem('material-buildroot.workspace-tabs.v1');document.body.append(tabs);
  for(const id of ['alpha','beta',...(survivor?['gamma']:[])])tabs.acknowledge(id,tabs.destinations.find(x=>x.id===id).en);
  if(pinned)tabs.tabs=tabs.tabs.map(t=>t.destination==='beta'?{...t,pinned:true}:t);
  tabs.active=tabs.tabs[0].id;window.tabVotes=0;window.tabNavigations=[];
  tabs.addEventListener('workspace-close',async event=>{window.tabVotes++;await Promise.resolve();if(!deny)event.detail.complete();});
  tabs.addEventListener('workspace-destination',async event=>{window.tabNavigations.push(event.detail.destination);await Promise.resolve();tabs.acknowledge(event.detail.destination,tabs.destinations.find(x=>x.id===event.detail.destination).en);});
 },{deny,pinned,survivor});
 const tabs=page.locator('#tab-fixture');
 await tabs.locator('[data-control="tab-list"]').click();
 await tabs.locator('settings-search').first().getByRole('textbox').fill('a');
 await tabs.locator('[data-experience-id="workspace-close-matching"]').click();
 await expect(tabs.getByRole('button',{name:'Confirm close previewed tabs',exact:true})).toBeVisible();
 await tabs.getByRole('button',{name:'Confirm close previewed tabs',exact:true}).click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 return tabs;
}

test('batch closure removes the active first tab and its successor without recreating either',async({page})=>{
 const tabs=await fixture(page);
 expect(await tabs.evaluate(t=>t.tabs.map(x=>x.destination))).toEqual([]);
 expect(await page.evaluate(()=>window.tabVotes)).toBe(1);
 expect(await page.evaluate(()=>window.tabNavigations)).toEqual([]);
});
test('batch closure preserves pinned tabs and selects the survivor once',async({page})=>{
 const tabs=await fixture(page,{pinned:true});
 expect(await tabs.evaluate(t=>t.tabs.map(x=>x.destination))).toEqual(['beta']);
 expect(await page.evaluate(()=>window.tabVotes)).toBe(1);
 expect(await page.evaluate(()=>window.tabNavigations)).toEqual(['beta']);
});
test('rejected batch closure preserves every selected tab and active identity',async({page})=>{
 const tabs=await fixture(page,{deny:true});
 expect(await tabs.evaluate(t=>({destinations:t.tabs.map(x=>x.destination),active:t.active}))).toEqual({destinations:['alpha','beta'],active:'utility::alpha'});
 expect(await page.evaluate(()=>window.tabVotes)).toBe(1);
 expect(await page.evaluate(()=>window.tabNavigations)).toEqual([]);
});
test('batch closure navigates only to the unselected survivor',async({page})=>{
 const tabs=await fixture(page,{survivor:true});
 expect(await tabs.evaluate(t=>t.tabs.map(x=>x.destination))).toEqual(['gamma']);
 expect(await page.evaluate(()=>window.tabNavigations)).toEqual(['gamma']);
});

async function dialogFixture(page){
 await page.goto('/');
 await page.evaluate(async()=>{
  await customElements.whenDefined('workspace-tabs');
  document.querySelector('material-buildroot')?.remove();
  localStorage.removeItem('material-buildroot.workspace-tabs.v1');
  const tabs=document.createElement('workspace-tabs');tabs.id='dialog-fixture';tabs.language='en';document.body.append(tabs);
  await tabs.updateComplete;
  const dialog=tabs.shadowRoot.querySelector('md-dialog');dialog.quick=true;
  window.dialogEvents=[];
  for(const name of ['open','opened','close','closed'])dialog.addEventListener(name,()=>window.dialogEvents.push(name));
 });
 const tabs=page.locator('#dialog-fixture');
 await tabs.locator('[data-control="new-tab"]').click();
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents.at(-1))).toBe('opened');
 return tabs;
}

test('dialog retains its content until closed and restores the opener once',async({page})=>{
 const tabs=await dialogFixture(page);
 await tabs.evaluate(async tabs=>{
  const dialog=tabs.shadowRoot.querySelector('md-dialog');
  const animate=dialog.animateDialog.bind(dialog);
  dialog.animateDialog=async animation=>{await new Promise(resolve=>window.releaseDialogClose=resolve);return animate(animation);};
  const opener=tabs.shadowRoot.querySelector('[data-control="new-tab"]');
  window.openerFocusCalls=0;const focus=opener.focus.bind(opener);opener.focus=(...args)=>{window.openerFocusCalls++;focus(...args);};
  tabs.close();tabs.close();await tabs.updateComplete;
 });
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents.at(-1))).toBe('close');
 expect(await tabs.evaluate(t=>t.dialog)).toBe('catalog');
 expect(await page.evaluate(()=>window.openerFocusCalls)).toBe(0);
 await page.evaluate(()=>window.releaseDialogClose());
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents.at(-1))).toBe('closed');
 await expect.poll(()=>tabs.evaluate(t=>t.dialog)).toBe('');
 expect(await page.evaluate(()=>window.openerFocusCalls)).toBe(1);
});

test('dialog serializes rapid close and reopen requests and keeps only the latest mode',async({page})=>{
 const tabs=await dialogFixture(page);
 await tabs.evaluate(async tabs=>{
  const dialog=tabs.shadowRoot.querySelector('md-dialog');const animate=dialog.animateDialog.bind(dialog);let held=false;
  dialog.animateDialog=async animation=>{if(!held){held=true;await new Promise(resolve=>window.releaseDialogClose=resolve);}return animate(animation);};
  tabs.close();tabs.show('manage');tabs.show('catalog');
 });
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents.at(-1))).toBe('close');
 expect(await page.evaluate(()=>window.dialogEvents)).toEqual(['open','opened','close']);
 expect(await tabs.evaluate(t=>t.dialog)).toBe('catalog');
 await page.evaluate(()=>window.releaseDialogClose());
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents)).toEqual(['open','opened','close','closed','open','opened']);
 expect(await tabs.evaluate(t=>t.dialog)).toBe('catalog');
});

test('dialog close invalidates an open request waiting for rendering',async({page})=>{
 const tabs=await dialogFixture(page);
 await tabs.evaluate(async tabs=>{await tabs.close();});
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents.at(-1))).toBe('closed');
 await tabs.evaluate(async tabs=>{window.dialogEvents=[];tabs.show('manage');tabs.close();await tabs.updateComplete;});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 expect(await page.evaluate(()=>window.dialogEvents)).toEqual([]);
 expect(await tabs.evaluate(t=>({mode:t.dialog,open:t.shadowRoot.querySelector('md-dialog').open}))).toEqual({mode:'',open:false});
});

test('Escape closes through the same lifecycle and returns focus',async({page})=>{
 const tabs=await dialogFixture(page);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents)).toEqual(['open','opened','close','closed']);
 await expect.poll(()=>tabs.evaluate(t=>t.dialog)).toBe('');
 expect(await tabs.evaluate(t=>t.shadowRoot.activeElement===t.shadowRoot.querySelector('[data-control="new-tab"]'))).toBe(true);
});

test('close waits for a real opening animation before starting the closing animation',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const tabs=await dialogFixture(page);
 await tabs.evaluate(async tabs=>{
  await tabs.close();window.dialogEvents=[];
  const dialog=tabs.shadowRoot.querySelector('md-dialog');dialog.quick=false;
  dialog.addEventListener('open',()=>tabs.close(),{once:true});
  tabs.show('manage');
 });
 await expect.poll(()=>page.evaluate(()=>window.dialogEvents)).toEqual(['open','opened','close','closed']);
 expect(await tabs.evaluate(t=>({mode:t.dialog,open:t.shadowRoot.querySelector('md-dialog').open}))).toEqual({mode:'',open:false});
 expect(errors).toEqual([]);
});

test('disconnect invalidates a pending open continuation',async({page})=>{
 const tabs=await dialogFixture(page);
 await tabs.evaluate(async tabs=>{
  await tabs.close();window.dialogEvents=[];window.detachedTabs=tabs;
  tabs.show('manage');tabs.parentNode.removeChild(tabs);
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 expect(await page.evaluate(()=>window.dialogEvents)).toEqual([]);
 expect(await page.evaluate(()=>window.detachedTabs.shadowRoot.querySelector('md-dialog').open)).toBe(false);
});
