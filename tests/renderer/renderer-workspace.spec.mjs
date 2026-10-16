import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createWorkspaceService}=require('../../src/main/workspace-service.cjs');
const bootstrap={language:'en',revision:'0'.repeat(40),projectId:'desktop-settings',capability:'fixture',storage:'ready',origin:'default',version:'source preview',source:null,updatedAt:null};
// Real local storage behind a browser fixture; this is not Windows/native IPC proof.
async function open(page,{language='en',completed=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-browser-'));
 const filePath=path.join(directory,'workspace.json');const service=createWorkspaceService({filePath});
 if(completed)service.mutate({expectedRevision:0,action:'onboarding.complete'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__workspaceGet',()=>service.get());
 await page.exposeFunction('__workspaceMutate',request=>service.mutate(request));
 await page.exposeFunction('__workspaceExport',()=>service.exportDocument());
 await page.addInitScript(state=>{window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),bootstrap:async()=>state,request:async()=>({ok:false,code:'UNAVAILABLE'}),windowControl:async()=>true,onEvent:()=>()=>{},workspaceGet:()=>window.__workspaceGet(),workspaceMutate:request=>window.__workspaceMutate(request),workspaceExport:()=>window.__workspaceExport()};},{...bootstrap,language});
 await page.goto('/');await expect(page.locator('.toolbar')).toContainText(/Saved on this device|已儲存喺呢部電腦/);
 return {service,errors,close:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
async function newPlan(page,name='Appliance image'){
 await page.locator('.toolbar').getByRole('button',{name:'New plan',exact:true}).click();
 const dialog=page.locator('#new-plan-dialog');await dialog.getByRole('textbox',{name:'Plan name'}).fill(name);
 await dialog.getByRole('button',{name:'Create plan',exact:true}).click();await expect(dialog).toHaveJSProperty('open',false);
 await expect(page.locator('.editor')).toContainText('Plan details');
 await expect(page.locator('.editor').getByRole('textbox',{name:'Plan name'})).toBeEditable();
}
async function nav(page,name){await page.locator('nav').getByRole('button',{name:new RegExp('^'+name+'(?:,|$)')}).click();}
test('first-run wizard creates a real saved plan and resumes after reload',async({page},testInfo)=>{
 const f=await open(page);try{
  await page.getByRole('button',{name:'Start setup',exact:true}).click();const dialog=page.locator('#setup-dialog');
  await dialog.getByRole('button',{name:'Next',exact:true}).click();await dialog.getByRole('textbox',{name:'Plan name'}).fill('Guided image');
  await expect(dialog.getByRole('textbox',{name:'Plan name'})).toHaveValue('Guided image');
  await expect.poll(()=>dialog.locator('md-outlined-text-field').filter({has:page.getByRole('textbox',{name:'Plan name'})}).locator('md-outlined-field .content').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:testInfo.outputPath('onboarding.png'),fullPage:true});
  await dialog.getByRole('button',{name:'Create plan',exact:true}).click();await expect(dialog).toContainText('Step 3 / 3');
  expect(f.service.get().state.plans[0].name).toBe('Guided image');
  {const state=f.service.get().state;expect(state.plans).toHaveLength(1);expect(state.onboarding).toMatchObject({step:2,planId:state.plans[0].id});expect(state.activity.map(a=>a.action).slice(-2)).toEqual(['onboarding.update','onboarding.createPlan']);}
  await page.reload();await page.locator('nav').getByRole('button',{name:'Resume setup',exact:true}).click();
  await expect(dialog).toContainText('Step 3 / 3');await dialog.getByRole('button',{name:'Open workspace',exact:true}).click();
  await expect.poll(()=>f.service.get().state.onboardingCompleted).toBe(true);expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('pending edits require an explicit decision and saved plans survive restart',async({page})=>{
 const f=await open(page,{completed:true});try{await newPlan(page);const notes=page.locator('.editor').getByRole('textbox',{name:'Notes'});await notes.fill('Keep the source and output separate.');
  await nav(page,'Activity');const dialog=page.locator('#leave-dialog');await expect(dialog).toHaveJSProperty('open',true);await dialog.getByRole('button',{name:'Stay',exact:true}).click();await expect(dialog).toHaveJSProperty('open',false);
  await page.locator('.editor').getByRole('button',{name:'Apply changes',exact:true}).click();await expect(page.locator('.editor')).toContainText('Saved locally');
  await page.reload();await expect(page.locator('.editor').getByRole('textbox',{name:'Notes'})).toHaveValue('Keep the source and output separate.');expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('stale revision preserves draft, refreshes storage, and explicit retry succeeds',async({page})=>{
 const f=await open(page,{completed:true});try{await newPlan(page);await page.locator('.editor').getByRole('textbox',{name:'Notes'}).fill('Retain this draft');
  f.service.mutate({expectedRevision:f.service.get().state.revision,action:'preferences.update',preferences:{theme:'dark'}});
  await page.locator('.editor').getByRole('button',{name:'Apply changes',exact:true}).click();await expect(page.locator('main > .notice')).toContainText('changed elsewhere');await expect(page.locator('.editor').getByRole('textbox',{name:'Notes'})).toHaveValue('Retain this draft');
  await page.locator('.editor').getByRole('button',{name:'Apply changes',exact:true}).click();await expect.poll(()=>f.service.get().state.plans[0].notes).toBe('Retain this draft');
 }finally{f.close();}
});
test('unknown workspace result disables further mutation while keeping the draft',async({page})=>{
 const f=await open(page,{completed:true});try{await newPlan(page);await page.locator('.editor').getByRole('textbox',{name:'Notes'}).fill('Unconfirmed draft');await page.evaluate(()=>window.studio.workspaceMutate=()=>Promise.reject(Error('fixture disconnect')));
  await page.locator('.editor').getByRole('button',{name:'Apply changes',exact:true}).click();await expect(page.locator('main > .notice')).toContainText('outcome is unknown');await expect(page.locator('.editor').getByRole('button',{name:'Apply changes',exact:true})).toBeDisabled();await expect(page.locator('.editor').getByRole('textbox',{name:'Notes'})).toHaveValue('Unconfirmed draft');
 }finally{f.close();}
});
test('export downloads a validated document containing only the applied plan',async({page})=>{
 const f=await open(page,{completed:true});try{await newPlan(page);const pending=page.waitForEvent('download');await page.locator('.toolbar').getByRole('button',{name:'Export plans',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toBe('material-buildroot-plans.json');const text=fs.readFileSync(await download.path(),'utf8'),document=JSON.parse(text);expect(document.format).toBe('material-buildroot-workspace-export');expect(document.plans[0].name).toBe('Appliance image');expect(document.activity).toBeUndefined();expect(document.capability).toBeUndefined();
 }finally{f.close();}
});
for(const language of ['en','zh-HK','bilingual'])for(const colorScheme of ['light','dark'])for(const size of [{width:960,height:640},{width:1440,height:960}])test(`workspace capture ${language} ${colorScheme} ${size.width}`,async({page},testInfo)=>{
 await page.setViewportSize(size);await page.emulateMedia({colorScheme});const f=await open(page,{language,completed:true});try{
  f.service.mutate({expectedRevision:f.service.get().state.revision,action:'plan.create',plan:{name:'Appliance image',runtime:'docker',target:'image',status:'draft',notes:'Use a separate output directory. Review runtime availability before starting.'}});
  await page.reload();await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.editor')).toBeVisible();
  await expect(page.locator('#plan-runtime')).toHaveJSProperty('displayText','Docker');
  for(const select of await page.locator('.editor md-outlined-select').all()){
    expect(await select.evaluate(el=>el.displayText)).toBeTruthy();
    await expect.poll(()=>select.locator('md-outlined-field .content').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  }
  const overflow=await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth+1);expect(overflow).toBe(false);
  await page.screenshot({path:testInfo.outputPath('workspace.png'),fullPage:true});expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('Material import buttons open hidden native pickers and preserve validation',async({page})=>{
 const f=await open(page,{completed:true});try{
  await nav(page,'Settings');
  const workspace=page.locator('#workspace-import-file');await expect(workspace).toBeHidden();
  const choose=async(button,file)=>{const pending=page.waitForEvent('filechooser');await button.click();await (await pending).setFiles(file);};
  const file=text=>({name:'import.json',mimeType:'application/json',buffer:Buffer.from(text)});
  const button=page.getByRole('button',{name:'Import workspace JSON (maximum 1 MiB)',exact:true});
  await expect(page.locator('md-outlined-button').filter({hasText:'Import workspace JSON'}).locator('md-icon')).toBeVisible();
  await choose(button,file('{}'));await expect(page.locator('main > .notice')).toContainText('Invalid workspace export');
  await choose(button,{name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(1024*1024+1)});await expect(page.locator('main > .notice')).toContainText('no larger than 1 MiB');
  await choose(button,file(JSON.stringify({format:'material-buildroot-workspace-export',version:1,plans:[]})));await expect(page.locator('#import-dialog')).toHaveJSProperty('open',true);
  await page.locator('#import-dialog').getByRole('button',{name:'Close',exact:true}).click();
  await choose(button,[]);await expect(page.locator('#import-dialog')).toHaveJSProperty('open',false);
  await page.evaluate(()=>{const workbench=document.createElement('regex-workbench');workbench.language='en';workbench.style.cssText='position:fixed;inset:0;z-index:1000;overflow:auto;background:white';document.body.append(workbench);});
  const regex=page.locator('body > regex-workbench');await expect(regex.locator('input[type=file]')).toBeHidden();
  const importButton=regex.getByRole('button',{name:'Import snippet JSON, maximum 1 MiB',exact:true});
  await expect(regex.locator('md-outlined-button').filter({hasText:'Import snippet JSON'}).locator('md-icon')).toBeVisible();
  await choose(importButton,file(JSON.stringify({version:1,snippets:[{name:'Imported sample',pattern:'foo',flags:'i',sample:'FOO',replacement:'bar'}]})));await expect(regex).toContainText('Session snippets replaced');await expect(regex.getByRole('button',{name:'Imported sample',exact:true})).toBeVisible();
  await choose(importButton,file('{}'));await expect(regex).toContainText('Invalid or oversized snippet file');await expect(regex.getByRole('button',{name:'Imported sample',exact:true})).toBeVisible();
  await choose(importButton,[]);await expect(regex.getByRole('button',{name:'Imported sample',exact:true})).toBeVisible();
  for(const input of await page.locator('input[type=file]').all())await expect(input).toBeHidden();expect(f.errors).toEqual([]);
 }finally{f.close();}
});
