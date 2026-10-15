import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createWorkspaceService}=require('../../src/main/workspace-service.cjs');
const oldRevision='1'.repeat(40),newRevision='2'.repeat(40);
// Native source operations are a typed fixture. Shell storage uses the actual local service.
export async function open(page,{language='en',theme='light'}={}) {
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
  window.studio={
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
