import {test,expect} from '@playwright/test';
// Browser fixtures prove presentation and dispatch, never native execution.
async function mount(page,tag){
  await page.route('http://127.0.0.1:5197/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh"></body></html>'}));
  await page.goto('/');
  await page.evaluate(async tag=>{
    window.__requests=[];
    window.studio={operations:async request=>{window.__requests.push(request);return {ok:false,code:'FIXTURE_UNAVAILABLE'};}};
    await import('/src/renderer/operations-panel.ts');
    const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');
    const panel=document.createElement(tag);panel.language='en';panel.style.cssText='display:block;height:100vh';document.body.append(panel);await panel.updateComplete;
  },tag);
  return page.locator(tag);
}
test('categorized tools filter independently and keep admitted conversion drafts',async({page})=>{
  const panel=await mount(page,'tools-panel');
  await panel.evaluate(p=>{p.source={id:'grant-fixture',name:'source.txt',kind:'file'};p.destination={id:'output-fixture',name:'output.txt',kind:'file'};p.revision++;});
  await expect(panel.locator('.conversion-stages')).toContainText('source.txt');
  const search=panel.locator('.tools-search-bar settings-search');
  await search.getByLabel('Search tools',{exact:true}).fill('PDF');
  await expect(panel.locator('.workspace-destination')).toHaveCount(1);
  await panel.locator('.workspace-destination').click();
  await expect(panel.locator('#tool-heading-pdf')).toBeVisible();
  await search.getByLabel('Search tools',{exact:true}).fill('Convert');
  await panel.locator('.workspace-destination').click();
  await expect(panel.locator('.conversion-stages')).toContainText('source.txt');
  expect(await page.evaluate(()=>window.__requests.some(r=>r.action==='file.choose'||r.action==='file.release'))).toBe(false);
  await search.getByRole('button',{name:'Open full regex workbench',exact:true}).click();
  await expect(search.locator('regex-workbench')).toBeVisible();
});
test('guided build output supports keyboard sizing and actual-record filtering',async({page})=>{
  const panel=await mount(page,'operations-panel');
  await panel.evaluate(p=>{p.presentation='guided';p.tab='builds';p.selectedJob='fixture-job';p.logs=[{value:{text:'compiler ready'}},{value:{text:'linker ready'}}];});
  const separator=panel.getByRole('separator',{name:'Resize jobs dock',exact:true});
  await expect(separator).toBeVisible();await separator.focus();await page.keyboard.press('Home');await expect(separator).toHaveAttribute('aria-valuenow','280');
  await page.keyboard.press('End');await expect(separator).toHaveAttribute('aria-valuenow','560');
  const search=panel.locator('.dock-filter settings-search');await search.getByLabel('Filter recorded output',{exact:true}).fill('compiler');
  await expect(panel.locator('.dock-log')).toContainText('compiler ready');await expect(panel.locator('.dock-log')).not.toContainText('linker ready');
  await expect(panel.locator('.runtime-summary')).toContainText('Adopt a project');
  expect(await page.evaluate(()=>window.__requests.some(r=>['build.submit','jobs.pump'].includes(r.action)))).toBe(false);
});
test('offline reader retains topic filtering, heading navigation and history',async({page})=>{
  const panel=await mount(page,'documentation-panel');
  await page.evaluate(()=>{
    const articles=[{id:'doc-'+ 'a'.repeat(64),title:'Prepare an image',category:'Workflow',language:'en',summary:'Review inputs'},{id:'doc-'+ 'b'.repeat(64),title:'Recover a build',category:'Workflow',language:'en',summary:'Review interruption'}];
    const navigation={categories:[{name:'Workflow',articles}],headings:[]};
    window.__articleLanguages=[];
    window.studio.operations=async request=>{
      if(request.action==='documentation.read')window.__articleLanguages.push(request.language);
      if(request.action==='documentation.list')return {ok:true,result:{articles,navigation,issues:[],complete:true}};
      if(request.action==='documentation.searchText')return {ok:true,result:{entries:articles.map(a=>({id:a.id,text:a.title,truncated:false}))}};
      if(request.action==='documentation.read'){const article=articles.find(a=>a.id===request.id);return {ok:true,result:{article,html:'<h1>'+article.title+'</h1><h2 id="review">Review</h2><p>Read the actual project state.</p>',navigation:{...navigation,headings:[{id:'review',text:'Review',level:2}]},issues:[],complete:true}};}
      return {ok:false,code:'FIXTURE_UNAVAILABLE'};
    };
  });
  await panel.evaluate(p=>p.active=true);
  const search=panel.locator('.help-search settings-search');await search.getByLabel('Search help offline',{exact:true}).fill('Recover');
  await expect(panel.locator('.topic')).toHaveCount(1);await panel.locator('.topic').click();
  await expect(panel.locator('.article-copy h1')).toHaveText('Recover a build');
  await panel.getByRole('button',{name:'English + 廣東話',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__articleLanguages.at(-1))).toBe('bilingual');
  await panel.getByRole('button',{name:'廣東話',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__articleLanguages.at(-1))).toBe('zh-HK');
  await panel.locator('.reader-outline').getByRole('button',{name:'Review',exact:true}).click();
  await expect(panel.locator('#review')).toBeFocused();
  await panel.getByRole('button',{name:'Back in documentation',exact:true}).click();
  await expect(panel.locator('.article-copy h1')).toHaveText('Recover a build');
  await panel.getByRole('button',{name:'Topics',exact:true}).click();await expect(panel.locator('#help-topics')).toBeHidden();
});

test('enabling output follow returns to the tail without new records',async({page})=>{
  const panel=await mount(page,'operations-panel');
  await panel.evaluate(async p=>{p.presentation='guided';p.tab='builds';p.selectedJob='fixture-job';p.logs=Array.from({length:150},(_,i)=>({value:{text:'Recorded line '+i}}));await p.updateComplete;});
  const log=panel.locator('.dock-log');
  await expect.poll(()=>log.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
  await panel.getByRole('switch',{name:'Follow loaded output',exact:true}).click();
  await log.evaluate(e=>e.scrollTop=0);
  await panel.evaluate(async p=>{p.requestUpdate();await p.updateComplete;});
  await expect.poll(()=>log.evaluate(e=>e.scrollTop)).toBe(0);
  await panel.getByRole('switch',{name:'Follow loaded output',exact:true}).click();
  await expect.poll(()=>log.evaluate(e=>Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop))).toBeLessThan(2);
});
for(const tag of ['operations-panel','tools-panel'])test(tag+' inherits extended roles in both colour modes',async({page})=>{
  const panel=await mount(page,tag);
  const roles=['tertiary','tertiary-container','on-tertiary-container','error-container','on-error-container','surface-container-highest'];
  const palettes=[['#326b5b','#b6f0dc','#002117','#ffdad6','#410002','#e2e2e9'],['#9bd4bf','#185142','#b6f0dc','#93000a','#ffdad6','#34343b']];
  for(const values of palettes){
    await page.evaluate(({roles,values})=>roles.forEach((role,i)=>document.body.style.setProperty('--md-sys-color-'+role,values[i])),{roles,values});
    await expect.poll(()=>panel.evaluate((p,roles)=>roles.map(role=>getComputedStyle(p).getPropertyValue('--md-sys-color-'+role).trim().toLowerCase()),roles)).toEqual(values);
  }
});

test('short measured owners keep build controls and dock output reachable',async({page})=>{
  const panel=await mount(page,'operations-panel');
  await panel.evaluate(async p=>{p.style.height='320px';p.presentation='guided';p.tab='builds';p.selectedJob='fixture-job';p.logs=Array.from({length:150},(_,i)=>({value:{text:'Recorded line '+i}}));await p.updateComplete;});
  const owner=panel.locator('.editor-frame'),log=panel.locator('.dock-log');
  await expect(owner).toHaveAttribute('data-short-owner','true');
  await expect.poll(()=>owner.evaluate(e=>e.clientHeight<=320&&e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto')).toBe(true);
  const configure=panel.locator('.build-admission').getByRole('button',{name:'Configure a new build',exact:true});await configure.scrollIntoViewIfNeeded();
  await expect.poll(()=>configure.evaluate(e=>{const r=e.getBoundingClientRect(),o=e.getRootNode().querySelector('.editor-frame').getBoundingClientRect();return r.top>=o.top&&r.bottom<=o.bottom;})).toBe(true);
  const separator=panel.getByRole('separator',{name:'Resize jobs dock',exact:true});await separator.scrollIntoViewIfNeeded();await separator.focus();await page.keyboard.press('End');
  await expect(separator).toHaveAttribute('aria-valuenow','560');
  await log.scrollIntoViewIfNeeded();
  await expect.poll(()=>log.evaluate(e=>{const r=e.getBoundingClientRect(),o=e.getRootNode().querySelector('.editor-frame').getBoundingClientRect();return r.bottom>o.top&&r.top<o.bottom&&e.scrollHeight>e.clientHeight;})).toBe(true);
  await log.evaluate(e=>e.scrollTop=0);await expect.poll(()=>log.evaluate(e=>e.scrollTop)).toBe(0);
  await log.evaluate(e=>e.scrollTop=e.scrollHeight);await expect.poll(()=>log.evaluate(e=>Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop))).toBeLessThan(2);
  // A later real measurement restores the normal split without changing the preference.
  await panel.evaluate(p=>p.style.height='900px');await expect(owner).toHaveAttribute('data-short-owner','false');
  await expect(separator).toHaveAttribute('aria-valuenow','560');
});

for(const ownerHeight of [640,320])test(`dock filter content does not overlap output in a ${ownerHeight}px owner`,async({page})=>{
  await page.setViewportSize({width:960,height:640});
  const panel=await mount(page,'operations-panel');
  await panel.evaluate(async(p,height)=>{p.style.height=height+'px';p.language='zh-HK';p.presentation='guided';p.tab='builds';p.selectedJob='fixture-job';p.logs=Array.from({length:100},(_,i)=>({value:{text:'Recorded output '+i}}));p.dockHeight=280;await p.updateComplete;},ownerHeight);
  const search=panel.locator('.dock-filter settings-search'),dock=panel.locator('.dock'),output=panel.locator('.dock-content');
  for(const expanded of [false,true]){
    await search.evaluate(async(p,open)=>{p.open=open;await p.updateComplete;},expanded);
    // Measure real child boxes: an outer panel's reachability alone misses flex overlap.
    await expect.poll(()=>panel.evaluate(p=>{
      const root=p.shadowRoot,filter=root.querySelector('.dock-filter'),search=filter.querySelector('settings-search'),output=root.querySelector('.dock-content');
      const bottom=filter.getBoundingClientRect().bottom,top=output.getBoundingClientRect().top;
      const controls=[...Array.from(search.shadowRoot.children).filter(e=>e.matches('label,p')),filter.querySelector('label')].filter(Boolean);
      return controls.length>=3&&controls.every(e=>e.getBoundingClientRect().bottom<=bottom+1)&&bottom<=top+1&&getComputedStyle(filter).flexShrink==='0'&&output.clientHeight>=100;
    })).toBe(true);
    await output.scrollIntoViewIfNeeded();
    await expect.poll(()=>dock.evaluate(e=>{const output=e.querySelector('.dock-content').getBoundingClientRect(),bounds=e.getBoundingClientRect();return output.bottom>bounds.top&&output.top<bounds.bottom&&getComputedStyle(e).overflowY==='auto';})).toBe(true);
  }
});

test('tools search and selected task remain reachable when navigation is collapsed',async({page})=>{
  const panel=await mount(page,'tools-panel');
  await panel.locator('.tools-search-bar').getByRole('button',{name:'Tools',exact:true}).click();
  await expect(panel.locator('#tools-drawer')).toBeHidden();
  await expect(panel.locator('.tools-search-bar settings-search')).toBeVisible();
  await expect(panel.locator('#tool-heading-convert')).toBeVisible();
  await panel.locator('.tools-search-bar').getByRole('button',{name:'Tools',exact:true}).click();
  await expect(panel.locator('#tools-drawer')).toBeVisible();
});
