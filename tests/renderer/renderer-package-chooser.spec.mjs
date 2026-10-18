import {test,expect} from '@playwright/test';
async function open(page){
 await page.addInitScript(()=>{window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}})};});
 await page.goto('/');
 await page.locator('command-surfaces').waitFor({state:'attached'});
 await page.evaluate(async()=>{
  await import('/src/renderer/named-targets-panel.ts');
  const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');
  window.__packageRequests=[];window.__catalogSize=3263;
  window.studio={operations:async request=>{window.__packageRequests.push(request);if(request.action==='build.targets')return {ok:true,result:{targets:['all','sdk','source'],packages:Array.from({length:window.__catalogSize},(_,i)=>`package-${String(i).padStart(4,'0')}`),packageActions:['rebuild','reconfigure','dirclean','download']}};if(request.action==='jobs.project')return {ok:true,result:[]};return {ok:false,code:'FIXTURE_UNAVAILABLE'};}};
  const panel=document.createElement('named-targets-panel');panel.workspaceId='fixture-source';panel.language='en';
  const shell=document.querySelector('material-buildroot').shadowRoot.querySelector('.shell');
  for(const child of shell.children)if(child.localName!=='command-surfaces')child.style.display='none';
  shell.style.overflow='auto';shell.prepend(panel);
 });
 const panel=page.locator('named-targets-panel');await expect(panel.locator('[data-package-count]')).toContainText('3263 / 3263');return panel;
}
test('3263 source packages stay reachable with bounded options, keyboard paging and retained selection',async({page})=>{
 const panel=await open(page),select=panel.locator('[data-package-select]'),search=panel.getByRole('textbox',{name:'Search source packages',exact:true});
 await expect(select.locator('md-select-option')).toHaveCount(50);
 const next=panel.getByRole('button',{name:'Next packages',exact:true});await next.focus();await page.keyboard.press('Enter');
 await expect(panel.locator('[data-package-count]')).toContainText('51–100');
 await search.fill('package-3262');await expect(select.locator('md-select-option')).toHaveCount(1);
 await panel.getByRole('combobox',{name:'Source package',exact:true}).focus();await page.keyboard.press('ArrowDown');
 await page.locator('searchable-picker').getByRole('button',{name:'package-3262',exact:true}).click();await expect(select).toHaveJSProperty('value','package-3262');
 await expect(page.locator('searchable-picker').getByRole('dialog')).not.toBeVisible();
 await search.fill('package-0000');await expect(search).toHaveValue('package-0000');await expect(panel.locator('[data-package-count]')).toContainText('1 / 3263');
 await expect(select).toHaveJSProperty('value','package-3262');await expect(select.locator('md-select-option')).toHaveCount(2);
 await expect(panel).toContainText('The selected package is also retained below');
 await panel.getByRole('button',{name:'Select package action',exact:true}).click();await expect(panel.locator('code').first()).toHaveText('package-3262-rebuild');
 await search.fill('');await expect(select.locator('md-select-option')).toHaveCount(51);
 expect(await page.evaluate(()=>window.__packageRequests.some(r=>r.action==='build.submit'))).toBe(false);
});
test('independent regex search, empty matches and removed source packages preserve validation',async({page})=>{
 const panel=await open(page),select=panel.locator('[data-package-select]'),search=panel.getByRole('textbox',{name:'Search source packages',exact:true});
 await search.fill('^package-(0000|3262)$');await panel.getByRole('checkbox',{name:'Use regular expression',exact:true}).check();
 await expect(panel.locator('[data-package-count]')).toContainText('2 / 3263');await expect(select.locator('md-select-option')).toHaveCount(2);
 await search.fill('(');await expect(panel).toContainText('Expression invalid, unavailable or timed out');await expect(select).toHaveJSProperty('disabled',true);
 await panel.getByRole('checkbox',{name:'Use regular expression',exact:true}).uncheck();await search.fill('package-3262');
 await panel.getByRole('combobox',{name:'Source package',exact:true}).click();await page.locator('searchable-picker').getByRole('button',{name:'package-3262',exact:true}).click();await expect(select).toHaveJSProperty('value','package-3262');
 await page.evaluate(()=>window.__catalogSize=100);await panel.getByRole('button',{name:'Refresh targets',exact:true}).click();
 await expect(panel.locator('[data-package-count]')).toContainText('0 / 100');await expect(panel.getByRole('button',{name:'Select package action',exact:true})).toBeDisabled();
});
test('package guidance localizes and stays within a narrow viewport',async({page})=>{
 const panel=await open(page);await page.setViewportSize({width:320,height:900});
 for(const language of ['en','zh-HK','bilingual']){
  await panel.evaluate((element,language)=>element.language=language,language);
  await expect(panel.locator('settings-search')).toBeVisible();
  await expect(panel.locator('[data-package-count]')).toContainText(language==='en'?'Matching packages':'符合套件');
  const overflow=await panel.evaluate(element=>{const edge=element.getBoundingClientRect().right;return [...element.shadowRoot.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().right>edge+1).map(e=>({tag:e.localName,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,edge})).slice(0,8);});
  expect(overflow).toEqual([]);
  await expect(panel.locator('[data-package-select] md-icon')).toHaveCount(50);
 }
});
test('batched regex results are atomic across timeout and cancellation',async({page})=>{
 const panel=await open(page),search=panel.getByRole('textbox',{name:'Search source packages',exact:true});
 await page.evaluate(()=>{window.__workers=[];window.Worker=class {constructor(){this.requests=[];window.__workers.push(this);}postMessage(value){this.requests.push(value);}terminate(){this.terminated=true;}};});
 await search.fill('^package-');await panel.getByRole('checkbox',{name:'Use regular expression',exact:true}).check();
 await expect.poll(()=>page.evaluate(()=>window.__workers.length)).toBe(1);
 await page.evaluate(()=>{const w=window.__workers[0];w.onmessage({data:{ok:true,ids:w.requests[0].articles.map(a=>a.id)}});});
 await expect.poll(()=>page.evaluate(()=>window.__workers[0].requests.length)).toBe(2);
 await expect(panel.locator('[data-package-count]')).toContainText('0 / 3263');
 await expect(panel).toContainText('Expression invalid, unavailable or timed out');
 await page.evaluate(()=>{const w=window.__workers[0];w.onmessage({data:{ok:true,ids:['package-0000']}});});
 await expect(panel.locator('[data-package-count]')).toContainText('0 / 3263');
 await search.fill('package-3262');await expect.poll(()=>page.evaluate(()=>window.__workers.length)).toBe(2);
 await panel.getByRole('checkbox',{name:'Use regular expression',exact:true}).uncheck();
 await expect(panel.locator('[data-package-count]')).toContainText('1 / 3263');
 await page.evaluate(()=>window.__workers[1].onmessage({data:{ok:true,ids:['package-0000']} }));
 await expect(panel.locator('[data-package-select] md-select-option')).toHaveAttribute('value','package-3262');
 expect(await page.evaluate(()=>window.__workers.every(w=>w.requests.every(r=>r.articles.length<=1000)))).toBe(true);
});
