import {test,expect} from '@playwright/test';
const tasks=[['local','Local tool setup','Trusted local tools'],['convert','Convert a file','File converter'],['pdf','PDF operations','PDF workspace'],['queue','File/model queue','File and model queue'],['server','Server management','Minecraft Java server']];
async function open(page,language='en'){
 await page.addInitScript(language=>{window.__toolCalls=[];window.studio={bootstrap:async()=>({language,revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version:'fixture',source:null,updatedAt:null}),sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),request:async()=>({ok:false,code:'UNAVAILABLE'}),onEvent:()=>()=>{},windowControl:async()=>true,operations:async r=>{if(r.action!=='updates.state')window.__toolCalls.push(r);return {ok:false,code:'FIXTURE_UNAVAILABLE'};}};},language);
 await page.goto('/');const app=page.locator('material-buildroot');await expect(app.locator('.images-workspace')).toBeVisible();await app.evaluate(async el=>{el.setupDone=true;await el.updateComplete;});
 if((await page.viewportSize()).width<=900){await app.locator('header .menu').click();await app.locator('#navigation-dialog [data-primary="tools"]').click();}else await app.locator('nav [data-primary="tools"]').click();
 const tools=app.locator('operations-panel:not([hidden]) tools-panel');await expect(tools).toBeVisible();await page.evaluate(()=>window.__toolCalls=[]);return {app,tools};
}
async function selected(tools,id){await expect(tools).toHaveJSProperty('selectedTask','tool:'+id);await expect(tools.locator('[data-destination]:not([hidden])')).toHaveCount(1);await expect(tools.locator('[data-destination="'+id+'"]').first()).toBeVisible();}

test('searchable utility picker reaches all five mounted tasks with keyboard focus',async({page})=>{
 const {tools}=await open(page);await tools.evaluate(el=>window.__taskSections=[...el.shadowRoot.querySelectorAll('[data-destination]')]);
 for(const [index,[id,label]] of tasks.entries()){
  const select=tools.locator('#tool-task');await select.focus();await select.press('Enter');
  const picker=page.locator('searchable-picker').filter({has:page.locator('md-dialog[open]')});await picker.locator('settings-search').getByRole('textbox').fill(label);
  await expect(picker.locator('[data-option]')).toHaveCount(1);await picker.locator('[data-option="'+index+'"]').click();
  await selected(tools,id);await expect.poll(()=>tools.evaluate(el=>el.shadowRoot.activeElement?.id)).toBe('tool-heading-'+id);
  expect(await tools.evaluate(el=>[...el.shadowRoot.querySelectorAll('[data-destination]')].every((section,i)=>section===window.__taskSections[i]))).toBe(true);
 }
 expect(await page.evaluate(()=>window.__toolCalls)).toEqual([]);
});
test('New tab catalog opens each exact utility destination through the public adapter',async({page})=>{
 const {app,tools}=await open(page),tabs=app.locator('workspace-tabs');
 for(const [id,,label] of tasks){
  await tabs.locator('[data-control="new-tab"]').click();const dialog=tabs.locator('md-dialog');
  await dialog.locator('settings-search').getByRole('textbox').fill(label);await dialog.getByRole('button',{name:label,exact:true}).click();
  await expect(dialog).toBeHidden();await selected(tools,id);await expect.poll(()=>tools.evaluate(el=>el.shadowRoot.activeElement?.id)).toBe('tool-heading-'+id);
 }
 expect(await tabs.evaluate(el=>el.tabs.map(tab=>tab.destination).filter(id=>id.startsWith('tool:')))).toEqual(tasks.map(([id])=>'tool:'+id));
 expect(await page.evaluate(()=>window.__toolCalls)).toEqual([]);
});
test('hidden task controls are inert and utility drafts survive every task switch',async({page})=>{
 const {tools}=await open(page);
 await tools.evaluate(el=>el.openDestination('tool:queue'));await tools.getByRole('textbox',{name:'Ollama model name',exact:true}).fill('retained-model');
 await tools.evaluate(async el=>{el.pdfOperation='rotate';el.pages='3,1,2';el.changed();await el.updateComplete;await el.openDestination('tool:pdf');window.__retainedServer=el.shadowRoot.querySelector('minecraft-panel');});
 await expect(tools.getByRole('textbox',{name:'Pages in order (for example 3,1,2)',exact:true})).toHaveValue('3,1,2');
 await tools.evaluate(el=>el.openDestination('tool:server'));const server=tools.locator('minecraft-panel');await server.getByRole('button',{name:'Configuration',exact:true}).click();await server.getByRole('textbox',{name:'Server name',exact:true}).fill('Retained server');
 for(const [id] of tasks){await tools.evaluate((el,id)=>el.openDestination('tool:'+id),id);await selected(tools,id);await page.keyboard.press('Tab');expect(await tools.evaluate(el=>{let active=document.activeElement;while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;for(let node=active;node;node=node.parentElement||(node.getRootNode() instanceof ShadowRoot?node.getRootNode().host:null))if(node instanceof HTMLElement&&(node.hidden||node.inert))return false;return true;})).toBe(true);}
 expect(await tools.evaluate(el=>({model:el.model,pages:el.pages,serverSame:el.shadowRoot.querySelector('minecraft-panel')===window.__retainedServer}))).toEqual({model:'retained-model',pages:'3,1,2',serverSame:true});
 await expect(server.getByRole('textbox',{name:'Server name',exact:true})).toHaveValue('Retained server');
 expect(await tools.evaluate(el=>el.openDestination('tool:unknown'))).toBe(false);await selected(tools,'server');
 expect(await tools.evaluate(el=>el.openDestination('server'))).toBe(false);expect(await page.evaluate(()=>window.__toolCalls)).toEqual([]);
});
test('next action follows existing readiness without invoking operations',async({page})=>{
 const {tools}=await open(page);
 const check=async(id,action,props={})=>{await tools.evaluate(async(el,{id,props})=>{Object.assign(el,props);el.changed();await el.openDestination('tool:'+id);},{id,props});const primary=tools.locator('[data-destination="'+id+'"] md-filled-button[data-primary-action]');await expect(primary).toHaveCount(1);await expect(primary).toHaveAttribute('data-primary-action',action);};
 await check('local','Check tool availability');await check('local','Choose executable',{payloads:[{toolId:'qpdf',available:false},{toolId:'other',available:false}]});
 await check('convert','Load formats');await check('convert','Choose source',{categories:[{category:'text',formats:[{format:'txt',available:true,adapter:'fixture'}]}]});await check('convert','Choose new output',{source:{id:'fixture-read',name:'source.txt',kind:'file'}});await check('convert','Convert now',{destination:{id:'fixture-write',name:'output.txt',kind:'file'}});
 await check('pdf','Add PDF source');await check('pdf','Run PDF operation',{pdfSources:[{id:'fixture-pdf',name:'source.pdf',kind:'file'}]});await check('pdf','Choose PDF output',{pdfOperation:'merge'});
 await check('queue','Refresh queue');await check('queue','Queue model download',{model:'fixture-model'});await check('queue','Run queue',{jobs:[{id:'fixture-job',state:'queued',request:{action:'converter.convert'}}]});await check('queue','Recover interrupted jobs',{jobs:[{id:'fixture-job',state:'interrupted',request:{action:'converter.convert'}}]});
 await tools.evaluate(el=>el.openDestination('tool:server'));await expect(tools.locator('minecraft-panel md-filled-button[data-primary-action]')).toHaveAttribute('data-primary-action','Discover official versions');
 expect(await page.evaluate(()=>window.__toolCalls)).toEqual([]);
});
for(const [width,height,scale] of [[480,320,2],[960,640,1],[1440,960,1]])test.describe(`focused utilities ${width}x${height}`,()=>{
 test.use({viewport:{width,height},deviceScaleFactor:scale,colorScheme:'dark',reducedMotion:'reduce'});
 test('each selected task exposes one full-sized primary action',async({page})=>{
  const {tools}=await open(page,'bilingual');
  for(const [id] of tasks){
   await tools.evaluate((el,id)=>el.openDestination('tool:'+id),id);
   const primary=tools.locator('[data-destination="'+id+'"] md-filled-button[data-primary-action]');await expect(primary).toHaveCount(1);await primary.focus();await primary.scrollIntoViewIfNeeded();await primary.click({trial:true});
   const fit=await primary.evaluate(el=>{const box=el.getBoundingClientRect();let fits=box.height>=44;const parent=node=>node.assignedSlot||node.parentElement||(node.getRootNode() instanceof ShadowRoot?node.getRootNode().host:null);for(let node=el;node;node=parent(node)){const r=node.getBoundingClientRect(),s=getComputedStyle(node);if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(box.top<r.top-1||box.bottom>r.bottom+1))fits=false;}return fits;});expect(fit).toBe(true);
  }
  expect(await page.evaluate(()=>window.__toolCalls)).toEqual([]);
 });
});

test('retained utility selection localizes without changing task or draft',async({page})=>{
 const {tools}=await open(page);await tools.evaluate(async el=>{el.pages='5,2';await el.openDestination('tool:pdf');});
 for(const [language,label] of [['zh-HK','PDF 操作'],['bilingual','PDF operations · PDF 操作'],['en','PDF operations']]){
  await tools.evaluate((el,language)=>el.language=language,language);
  await expect(tools.locator('#tool-task')).toHaveJSProperty('displayText',label);await selected(tools,'pdf');
  expect(await tools.evaluate(el=>el.pages)).toBe('5,2');
 }
 expect(await page.evaluate(()=>window.__toolCalls)).toEqual([]);
});
