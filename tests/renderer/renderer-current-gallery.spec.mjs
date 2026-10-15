import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {open} from './desktop-fixture.mjs';
const require=createRequire(import.meta.url),{createDocumentationService}=require('../../src/main/documentation/service.cjs');
const invocationTime=new Date().toISOString();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// Deliberate capture command only. Native-operation fixtures never establish host execution.
test('current full shell gallery with real bundled documentation and capture clock receipts',async({page},testInfo)=>{
 test.skip(process.env.CAPTURE_CURRENT!=='1','Run after the renderer checkpoint with CAPTURE_CURRENT=1.');test.setTimeout(180000);
 const context=page.context();
 const root=path.resolve('.'),sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const sourceDirty=Boolean(execFileSync('git',['status','--porcelain','--','src/renderer','tests/renderer','src/main/documentation','src/main/workspace-service.cjs','src/main/storage/workspace-store.cjs','src/main/security/workspace-contract.cjs','package.json','package-lock.json','index.html'],{encoding:'utf8'}).trim());if(process.env.CAPTURE_REVIEW!=='1')expect(sourceDirty).toBe(false);
 const sourceFiles={};function hashTree(relative){for(const item of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const next=relative+'/'+item.name;if(item.isDirectory())hashTree(next);else sourceFiles[next]=digest(fs.readFileSync(path.join(root,next)));}}
 hashTree('src/renderer');hashTree('src/main/documentation');hashTree('tests/renderer');
 const boundFiles=['package.json','package-lock.json','index.html','src/main/workspace-service.cjs','src/main/storage/workspace-store.cjs','src/main/security/workspace-contract.cjs'];for(const relative of boundFiles)sourceFiles[relative]=digest(fs.readFileSync(path.join(root,relative)));
 const directory=path.resolve(process.env.DOCUMENTATION_CAPTURE_BUNDLE||'.cache/offline-docs-build/documentation');const manifest=JSON.parse(fs.readFileSync(path.join(directory,'index.json'),'utf8'));
 const documentation=createDocumentationService({directory});const inventory=documentation.list();expect(inventory.articles.length).toBeGreaterThan(20);
 const selected=inventory.articles.find(a=>a.title==='Productive desktop workspace')||inventory.articles[0];
 const captures=[];const output=testInfo.outputPath('current');fs.mkdirSync(output,{recursive:true});
 const receipt={format:'material-buildroot-current-renderer-captures',version:1,invocationTime,sourceRevision,sourceDirty,preliminary:process.env.CAPTURE_REVIEW==='1',sourceFiles,documentation:{indexSha256:digest(fs.readFileSync(path.join(directory,'index.json'))),sourceSnapshot:manifest.sourceSnapshot,articleCount:inventory.articles.length,complete:inventory.complete},captures};
 // Every article and image is read from the verified host-owned bundle; no toy article corpus.
 for(const {language,theme,width} of [{language:'en',theme:'light',width:1440},{language:'bilingual',theme:'dark',width:960}]){
 await page.exposeFunction('__readBundledDocumentation',request=>{try{return {ok:true,result:request.action==='documentation.list'?documentation.list():documentation.read({id:request.id})};}catch(error){return {ok:false,code:error.code||'UNAVAILABLE'};}});
 await page.route('**/documentation/assets/*',async route=>{const file='assets/'+new URL(route.request().url()).pathname.split('/').at(-1);const asset=manifest.assets.find(a=>a.file===file);if(!asset)return route.abort();const body=fs.readFileSync(path.join(directory,asset.file));expect(digest(body)).toBe(asset.sha256);await route.fulfill({body,contentType:asset.mime});});

  await page.setViewportSize({width,height:960});await page.emulateMedia({reducedMotion:'reduce',colorScheme:theme});
  // Reuse a fresh page per tuple so workspace bridges retain isolated actual local storage.
  const target=page;
  const f=await open(target,{language,theme});
  try{
   await target.evaluate(()=>{const previous=window.studio.operations;window.studio.operations=async r=>{
    if(r.action==='documentation.list'||r.action==='documentation.read')return window.__readBundledDocumentation(r);
    if(r.action==='documentation.open')return {ok:false,code:'CAPTURE_EXTERNAL_NAVIGATION_DISABLED'};
    if(r.action==='jobs.list')return {ok:true,result:[]};
    if(r.action==='external.choose')return {ok:true,result:{externalTreeId:'fixture-external',name:'Fixture extensions'}};
    if(r.action==='canvas.read')return {ok:true,result:{revision:0,layout:null}};
    if(r.action==='payload.list')return {ok:true,result:[]};
    if(r.action==='tools'&&r.request.action==='converter.catalog')return {ok:true,result:{categories:[{category:'text',formats:[{format:'txt',adapter:'native',available:true},{format:'json',adapter:'native',available:true}]}]}};
    if(r.action==='tools'&&r.request.action==='queue.page')return {ok:true,result:{items:[],next:null}};
    if(r.action==='tools'&&r.request.action==='ollama.managed.status')return {ok:true,result:{phase:'idle',version:null,platformSupported:false,installed:false,running:false,owned:false,code:'FIXTURE_NO_NATIVE_RUNTIME',payload:{available:false,downloadBytes:null,publisherVerification:'unverified',nativeRuntimeVerified:false}}};
    if(r.action==='companion')return {ok:true,result:{configured:false,enabled:false,allowedScopes:['workspace:read','projects:read','jobs:read'],availableBindings:['127.0.0.1'],binding:null,sessions:[]}};
    if(r.action==='config.inspect')return {ok:true,result:{revision:'fixture-config-revision',semantics:{available:false,reason:'Fixture static declarations only; no Kconfig runtime executed.'},entries:[{symbol:'BR2_PACKAGE_BUSYBOX',type:'bool',value:true,prompt:'BusyBox utilities',menu:'Target packages / Shell and utilities',visibility:2,assignable:[0,2],help:'Fixture source declaration for renderer review.',dependency:'BR2_USE_MMU'},{symbol:'BR2_TARGET_GENERIC_HOSTNAME',type:'string',value:'appliance',prompt:'System hostname',menu:'System configuration',visibility:2,help:'Fixture system configuration value.'}],choices:[],warnings:[]}};
    return previous(r);
   };const panel=document.querySelector('material-buildroot').shadowRoot.querySelector('operations-panel');panel.workspace={workspaceId:'project-1',name:'Fixture project'};});
   const panel=target.locator('operations-panel');
   const button=(scope,name)=>scope.getByRole('button',{name:new RegExp('^'+name)}).first();
   async function tab(id){await panel.evaluate((p,id)=>p.tab=id,id);await panel.evaluate(p=>p.updateComplete);await target.evaluate(()=>document.fonts.ready);}
   async function capture(state,boundary){await target.evaluate(()=>document.fonts.ready);await target.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const animations=new Set();function walk(root){for(const el of root.querySelectorAll('*')){for(const animation of el.getAnimations())if(animation.effect?.getTiming().iterations!==Infinity)animations.add(animation);if(el.shadowRoot)walk(el.shadowRoot);}}walk(document);await Promise.all([...animations].map(animation=>animation.finished.catch(()=>{})));});const name=`${state}-${language}-${theme}-${width}.png`,startedAt=new Date().toISOString();await target.screenshot({path:path.join(output,name)});captures.push({file:name,state,language,theme,viewport:{width,height:960},displayScale:1,reducedMotion:true,captureStartedAt:startedAt,captureCompletedAt:new Date().toISOString(),sha256:digest(fs.readFileSync(path.join(output,name))),boundary});fs.writeFileSync(path.join(output,'captures.json'),JSON.stringify({...receipt,completedAt:new Date().toISOString()},null,2)+'\n');}
   await tab('runtime');await capture('runtime','Real renderer; native runtime discovery not invoked; fixture adopted project.');
   await tab('source');await button(target.locator('source-panel'),'Refresh source status').click();await target.locator('source-panel').evaluate(el=>{let current=el;while(current){current.scrollTop=0;current=current.parentElement||current.getRootNode().host;}});await capture('source','Real renderer with typed source status fixture; no native checkout proof.');
   await tab('package');const pkg=target.locator('package-panel');await button(pkg,'Choose prepared external tree').click();await pkg.locator('summary').filter({hasText:'Start from example metadata'}).click();await button(pkg,'Use GNU Hello example').click();await pkg.locator('summary').filter({hasText:'Start from example metadata'}).click();await pkg.getByRole('tab',{name:/^Dependencies/}).click();await pkg.getByRole('textbox',{name:/^Package dependency/}).fill('zlib');await button(pkg,'Add package dependency').click();await button(pkg.locator('diagram-workbench'),'Fit diagram').click();await pkg.evaluate(el=>el.scrollTop=0);await capture('package-canvas','Actual editable package draft and dependency canvas; typed folder grant fixture, no host file writes.');
   await tab('guests');const guest=target.locator('guest-topology');await button(guest,'Network').click();await button(guest.locator('diagram-workbench'),'Fit diagram').click();await capture('guest-canvas','Actual new guest draft and topology editor; no fabricated managed guest or native boot.');
   await tab('config');await button(panel,'Inspect configuration').click();await capture('configuration','Real configuration controls using explicitly fixture source declarations; no native Kconfig execution in this capture.');
   await tab('builds');await button(panel.locator('.dock'),'Refresh jobs').click();await capture('jobs','Actual build controls and empty job/output dock; no invented job data or logs, no build executed.');
   await tab('tools');await button(target.locator('tools-panel'),'Load formats').click();await capture('tools','Real tool forms with typed format-catalogue fixture; no conversion execution.');
   await tab('companion');await button(target.locator('companion-panel'),'Refresh companion').click();await capture('companion','Real companion controls with disabled typed listener fixture; no TLS listener or pairing performed.');
   await tab('assistant');await button(target.locator('managed-ollama-panel'),'Refresh managed runtime').click();await capture('assistant','Real local assistant controls; explicitly unavailable native runtime fixture; no model installed or running.');
   await tab('documentation');await expect(target.locator('documentation-panel .topics')).toContainText(selected.title);await target.locator('documentation-panel .topics').getByRole('button',{name:selected.title,exact:true}).click();await expect(target.locator('documentation-panel .article')).toContainText(selected.title);await capture('offline-help','Real createDocumentationService, verified bundled article inventory and host-rendered article; native Electron bridge replaced by direct Node bridge.');
   await target.locator('nav[aria-label]').first().getByRole('button',{name:/^Settings/}).click();await capture('settings','Actual workspace preferences and local workspace-service storage; language host-save backend remains fixture.');
   await target.locator('nav[aria-label]').first().getByRole('button',{name:/^Resume setup/}).click();await expect(target.locator('#setup-dialog')).toBeVisible();if(width===960){await button(target.locator('#setup-dialog'),'Next').click();await target.locator('#setup-dialog').getByRole('textbox',{name:/^Plan name/}).fill('Appliance plan');}await target.locator('#setup-dialog').evaluate(el=>{const content=el.querySelector('[slot=content]');if(content)content.scrollTop=0;const scroller=el.shadowRoot?.querySelector('.scroller');if(scroller)scroller.scrollTop=0;});await capture('onboarding','Actual resumable setup dialog backed by local workspace-service storage; native setup actions not invoked.');
   expect(f.errors).toEqual([]);
  }finally{f.close();}
  // Exposed workspace functions cannot be rebound; use a new page for the next tuple.
  if(width===1440){await page.close();page=await context.newPage();}
 }
 expect(captures).toHaveLength(24);for(const [relative,sha256] of Object.entries(sourceFiles))expect(digest(fs.readFileSync(path.join(root,relative)))).toBe(sha256);expect(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()).toBe(sourceRevision);
});
