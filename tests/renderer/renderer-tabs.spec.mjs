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
