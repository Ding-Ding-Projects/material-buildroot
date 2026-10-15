import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createWorkspaceService}=require('../../src/main/workspace-service.cjs');
const oldRevision='1'.repeat(40),newRevision='2'.repeat(40);
// Native source operations are a typed fixture. Shell storage uses the actual local service.
async function open(page,{language='en',theme='light'}={}) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'source-renderer-'));
 const service=createWorkspaceService({filePath:path.join(directory,'workspace.json')});
 service.mutate({expectedRevision:0,action:'onboarding.complete'});
 service.mutate({expectedRevision:service.get().state.revision,action:'preferences.update',preferences:{theme}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.exposeFunction('__workspaceGet',()=>service.get());
 await page.exposeFunction('__workspaceMutate',request=>service.mutate(request));
 await page.exposeFunction('__workspaceExport',()=>service.exportDocument());
 await page.addInitScript(({language,oldRevision,newRevision})=>{
  let revision=oldRevision;
  window.__sourceRequests=[];
  window.studio={sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),
   bootstrap:async()=>({language,revision:'0'.repeat(40),projectId:'desktop-settings',capability:'fixture',storage:'ready',origin:'default',version:'source preview',source:null,updatedAt:null}),
   request:async()=>({ok:false,code:'UNAVAILABLE'}),windowControl:async()=>true,onEvent:()=>()=>{},
   workspaceGet:()=>window.__workspaceGet(),workspaceMutate:request=>window.__workspaceMutate(request),workspaceExport:()=>window.__workspaceExport(),
   operations:async outer=>{
    if(outer.action!=='source')return {ok:false,code:'FIXTURE_UNAVAILABLE'};
    const r=outer.request;window.__sourceRequests.push(r);
    if(window.__delaySource){await new Promise(resolve=>window.__releaseSource=resolve);window.__delaySource=false;}
    let result={ok:true};
    if(r.action==='source.choose')result={...result,selectionId:'selection-1',name:'Projects'};
    if(r.action==='source.clone')result={...result,workspaceId:'cloned-project',revision,branch:'main',dirty:false};
    if(r.action==='source.status'||r.action==='source.ref')result={...result,revision,branch:'main',dirty:window.__dirtySource||false,changes:window.__dirtySource?' M Config.in':'',...(r.action==='source.ref'?{fetchedRevision:newRevision}:{})};
    if(r.action.endsWith('.preview'))result={...result,previewId:'preview-1',kind:r.action==='source.rollback.preview'?'rollback':'upgrade',fromRevision:revision,toRevision:r.action==='source.rollback.preview'?oldRevision:newRevision,dirty:window.__dirtySource||false,diff:' Config.in | 4 ++--\n 1 file changed, 2 insertions(+), 2 deletions(-)',outputCompatibility:'unknown',outputPreserved:true};
    if(r.action.endsWith('.apply')){revision=r.action==='source.rollback.apply'?oldRevision:newRevision;result={...result,revision,branch:null,dirty:false,changes:'',rollbackId:'rollback-1',rollbackRevision:r.expectedRevision,outputCompatibility:'unknown',outputPreserved:true};}
    return {ok:true,result};
   }
  };
 },{language,oldRevision,newRevision});
 await page.goto('/');await expect(page.locator('.toolbar')).toContainText(/Project operations|專案操作/);
 await page.locator('nav').getByRole('button',{name:/^Project operations|^專案操作/}).click();
 await page.locator('operations-panel').evaluate(panel=>panel.workspace={workspaceId:'project-1',name:'Appliance source'});
 await page.getByRole('tab',{name:language==='en'?'Source':'Source · 來源',exact:true}).click();
 return {errors,close:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
const panel=page=>page.locator('source-panel');
const button=(page,name)=>panel(page).getByRole('button',{name,exact:true});
async function preview(page){await button(page,'Refresh source status').click();await button(page,'Fetch reference').click();await expect(panel(page).getByRole('textbox',{name:'Exact target revision',exact:true})).toHaveValue(newRevision);await button(page,'Review source changes').click();}

test('source fetch preview apply and rollback require exact reviewed revisions and consent',async({page})=>{
 const f=await open(page);try {
  await preview(page);await expect(button(page,'Apply reviewed source update')).toBeDisabled();
  await panel(page).getByRole('checkbox',{name:'I reviewed these revisions and accept changing the source working tree.',exact:true}).check();
  await button(page,'Apply reviewed source update').click();await expect(panel(page)).toContainText('Source revision applied');
  await button(page,'Review rollback').click();await panel(page).getByRole('checkbox',{name:'I reviewed these revisions and accept changing the source working tree.',exact:true}).check();await button(page,'Apply reviewed rollback').click();
  const requests=await page.evaluate(()=>window.__sourceRequests);
  expect(requests.find(r=>r.action==='source.upgrade.apply')).toMatchObject({workspaceId:'project-1',previewId:'preview-1',expectedRevision:oldRevision,consent:true});
  expect(requests.find(r=>r.action==='source.rollback.apply')).toMatchObject({workspaceId:'project-1',expectedRevision:newRevision,consent:true});expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('workspace change discards a pending preview and prevents applying it to another project',async({page})=>{
 const f=await open(page);try {
  await button(page,'Fetch reference').click();await page.evaluate(()=>window.__delaySource=true);await button(page,'Review source changes').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__releaseSource)).toBe('function');
  await page.locator('operations-panel').evaluate(host=>host.workspace={workspaceId:'project-2',name:'Other source'});
  await page.evaluate(()=>window.__releaseSource());await expect(panel(page)).toContainText('The active project changed');
  await expect(button(page,'Apply reviewed source update')).toHaveCount(0);await expect(panel(page).getByRole('textbox',{name:'Exact target revision',exact:true})).toHaveValue('');expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('clone requires trust and adopts its returned workspace; dirty previews cannot apply',async({page})=>{
 const f=await open(page);try {
  await button(page,'Choose parent folder').click();await expect(button(page,'Clone and adopt source')).toBeDisabled();
  await panel(page).getByRole('checkbox',{name:'I trust this source. Its build scripts may execute with my selected runtime permissions.',exact:true}).check();await button(page,'Clone and adopt source').click();
  await expect(page.locator('operations-panel')).toHaveJSProperty('workspace',{workspaceId:'cloned-project',name:'buildroot'});
  await page.evaluate(()=>window.__dirtySource=true);await preview(page);await expect(panel(page)).toContainText('Local changes block this operation');await expect(button(page,'Apply reviewed source update')).toBeDisabled();expect(f.errors).toEqual([]);
 }finally{f.close();}
});
for(const width of [960,1440])for(const theme of ['light','dark'])test(`source full shell capture bilingual ${theme} ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:960});await page.emulateMedia({reducedMotion:'reduce'});const f=await open(page,{language:'bilingual',theme});try {
  await button(page,'Refresh source status · 重新整理來源狀態').click();await button(page,'Fetch reference · 取得參照').click();await button(page,'Review source changes · 審核來源變更').click();
  await page.evaluate(()=>document.fonts.ready);
  for(const field of await panel(page).locator('md-outlined-text-field').all())await expect.poll(()=>field.locator('md-outlined-field .content').evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
  expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
  await page.locator('main').evaluate(el=>el.scrollTop=0);await panel(page).evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:testInfo.outputPath(`source-shell-${theme}-${width}.png`)});
  await panel(page).getByRole('region',{name:'Source change summary · 來源變更摘要',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath(`source-review-${theme}-${width}.png`)});expect(f.errors).toEqual([]);
 }finally{f.close();}
});
