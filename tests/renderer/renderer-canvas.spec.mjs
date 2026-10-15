import {test,expect} from '@playwright/test';
import {open} from './desktop-fixture.mjs';
async function fixture(page,options={}){
 const f=await open(page,options);
 await page.evaluate(()=>{
  const previous=window.studio.operations;let layout=null,revision=0;
  const guest={id:'managed-fixture',provider:'virtualbox',revision:1,state:'stopped',hardware:{memoryMiB:2048,cpus:2,firmware:'bios',network:'nat'},networks:[{slot:1,mode:'nat'}],storage:[]};
  window.__canvasRequests=[];
  window.studio.operations=async r=>{
   window.__canvasRequests.push(r);
   if(r.action==='external.choose')return {ok:true,result:{externalTreeId:'external-fixture',name:'Appliance extensions'}};
   if(r.action==='package.preview'){
    if(window.__delayPackage)await new Promise(resolve=>window.__releasePackage=resolve);
    return {ok:true,result:{revision:'a'.repeat(64),previewHash:'b'.repeat(64),files:[{path:'package/hello/Config.in',before:null,after:'config BR2_PACKAGE_HELLO\n\tbool "hello"\n\thelp\n\t  GNU Hello greeting.\n',mode:420},{path:'Config.in',before:'menu "Extensions"\nendmenu\n',after:'menu "Extensions"\nendmenu\nsource "$BR2_EXTERNAL_APPLIANCE_PATH/package/hello/Config.in"\n',mode:420}],warnings:['Fixture preview. Actual Buildroot validation is not established.']}};
   }
   if(r.action==='package.apply'){if(window.__failApply)throw Error('fixture disconnected');return {ok:true,result:{applied:true}};}
   if(r.action==='canvas.read')return {ok:true,result:{revision,layout}};
   if(r.action==='canvas.write'){if(window.__layoutConflict)return {ok:false,code:'REVISION_CONFLICT'};layout=r.layout;return {ok:true,result:{revision:++revision,layout}};}
   if(r.action==='guest.list')return {ok:true,result:[guest]};
   if(r.action==='artifacts.list')return {ok:true,result:[{path:'images/installer.iso',kind:'file'}]};
   if(r.action==='guest.networks')return {ok:true,result:{bridged:['Ethernet'],hostonly:['Host-only adapter']}};
   if(r.action==='guest.preview')return {ok:true,result:{previewId:'topology-preview',id:guest.id,revision:guest.revision,hardware:r.request.hardware,networks:r.request.networks,storage:r.request.storage,expiresAt:Date.now()+300000,warning:'Fixture topology preview; no native change yet.'}};
   if(r.action==='guest.edit')return {ok:true,result:{...guest,revision:2}};
   return previous(r);
  };
 });
 return f;
}
const packagePanel=page=>page.locator('package-panel');
async function packageDraft(page){
 await page.getByRole('tab',{name:'Package authoring',exact:true}).click();const p=packagePanel(page);
 await p.getByRole('button',{name:'Choose prepared external tree',exact:true}).click();await p.locator('summary').filter({hasText:'Start from example metadata'}).click();await p.getByRole('button',{name:'Use GNU Hello example',exact:true}).click();await p.locator('summary').filter({hasText:'Start from example metadata'}).click();
 await p.getByRole('tab',{name:'Dependencies',exact:true}).click();await p.getByRole('textbox',{name:'Package dependency',exact:true}).fill('zlib');await p.getByRole('button',{name:'Add package dependency',exact:true}).click();
 await p.getByRole('tab',{name:'Hashes',exact:true}).click();await p.getByRole('textbox',{name:'Verified digest 1',exact:true}).fill('1'.repeat(64));await p.getByRole('textbox',{name:'Verified digest 2',exact:true}).fill('2'.repeat(64));
 return p;
}
test('package canvas edits real dependencies and preview apply is consent and hash bound',async({page})=>{
 const f=await fixture(page);try{const p=await packageDraft(page);const canvas=p.locator('diagram-workbench');
 await canvas.getByRole('button',{name:'zlib, Build dependency',exact:true}).click();await canvas.getByRole('button',{name:'Remove selected dependency',exact:true}).click();await expect(p.locator('md-input-chip')).toHaveCount(0);
 await p.getByRole('button',{name:'Preview generated files',exact:true}).click();await expect(p.getByRole('button',{name:'Apply reviewed package files',exact:true})).toBeDisabled();
 await p.getByRole('checkbox',{name:'I reviewed the generated files and approve writing them to the selected external tree.',exact:true}).check();await p.getByRole('button',{name:'Apply reviewed package files',exact:true}).click();
 await expect(p).toContainText('Reviewed files applied');const request=await page.evaluate(()=>window.__canvasRequests.find(r=>r.action==='package.apply'));expect(request.revision).toBe('a'.repeat(64));expect(request.previewHash).toBe('b'.repeat(64));expect(request.model.dependencies).toEqual([]);expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('package hash edit invalidates preview and unknown apply outcome requires fresh review',async({page})=>{
 const f=await fixture(page);try{const p=await packageDraft(page);await p.getByRole('button',{name:'Preview generated files',exact:true}).click();await p.getByRole('tab',{name:'Hashes',exact:true}).click();await p.getByRole('textbox',{name:'Verified digest 1',exact:true}).fill('3'.repeat(64));await expect(p.getByRole('button',{name:'Apply reviewed package files',exact:true})).toHaveCount(0);
 await p.getByRole('button',{name:'Preview generated files',exact:true}).click();await p.getByRole('checkbox',{name:'I reviewed the generated files and approve writing them to the selected external tree.',exact:true}).check();await page.evaluate(()=>window.__failApply=true);await p.getByRole('button',{name:'Apply reviewed package files',exact:true}).click();await expect(p).toContainText('write outcome is unconfirmed');await expect(p.getByRole('button',{name:'Apply reviewed package files',exact:true})).toHaveCount(0);expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('canvas keyboard layout history and persistence conflict leave semantic model untouched',async({page})=>{
 const f=await fixture(page);try{const p=await packageDraft(page),c=p.locator('diagram-workbench'),node=c.locator('md-outlined-button.node').filter({hasText:'hello'});const before=await node.getAttribute('style');await node.focus();await node.press('ArrowRight');await expect.poll(()=>node.getAttribute('style')).not.toBe(before);await c.getByRole('button',{name:'Undo layout',exact:true}).click();await expect.poll(()=>node.getAttribute('style')).toBe(before);await c.getByRole('button',{name:'Redo layout',exact:true}).click();await c.getByRole('button',{name:'Load saved layout',exact:true}).click();await page.evaluate(()=>window.__layoutConflict=true);await c.getByRole('button',{name:'Save diagram layout',exact:true}).click();await expect(c).toContainText('REVISION_CONFLICT');await expect(c.getByRole('button',{name:'Save diagram layout',exact:true})).toBeDisabled();expect(f.errors).toEqual([]);
 }finally{f.close();}
});
test('guest topology inspector previews exact NIC change and applies reviewed revision',async({page})=>{
 const f=await fixture(page);try{await page.getByRole('tab',{name:'Virtual machines',exact:true}).click();const g=page.locator('guest-topology');await g.getByRole('button',{name:'Refresh guests',exact:true}).click();await g.getByRole('combobox',{name:'Guest record',exact:true}).click();await g.getByRole('option',{name:'managed-fixture',exact:true}).click();await g.getByRole('button',{name:'NIC 1, nat',exact:true}).click();await g.getByRole('combobox',{name:'NIC 1 mode',exact:true}).click();await g.getByRole('option',{name:'none',exact:true}).click();await g.getByRole('button',{name:'Preview topology changes',exact:true}).click();await g.getByRole('checkbox',{name:'Approve reviewed guest topology',exact:true}).check();await g.getByRole('button',{name:'Apply reviewed topology',exact:true}).click();const req=await page.evaluate(()=>window.__canvasRequests.find(r=>r.action==='guest.edit'));expect(req.request).toEqual({id:'managed-fixture',expectedRevision:1,previewId:'topology-preview'});expect(f.errors).toEqual([]);
 }finally{f.close();}
});
for(const width of [960,1440])for(const theme of ['light','dark'])test(`desktop canvas capture ${theme} ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:960});await page.emulateMedia({reducedMotion:'reduce'});const f=await fixture(page,{theme});try{const p=await packageDraft(page);await p.getByRole('tab',{name:'Dependencies',exact:true}).click();await p.locator('diagram-workbench').getByRole('button',{name:'Fit diagram',exact:true}).click();await p.locator(".package-inspector").evaluate(el=>el.scrollTop=0);await p.evaluate(el=>{let current=el;while(current){if(current instanceof HTMLElement&&current.scrollHeight>current.clientHeight)current.scrollTop=0;current=current.parentElement||current.getRootNode().host;}});await page.evaluate(()=>document.fonts.ready);expect(await page.locator('main').evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);const diagram=p.locator('diagram-workbench');const iconBounds=await diagram.locator('md-icon svg').first().boundingBox();expect(iconBounds.width).toBeGreaterThanOrEqual(20);const footer=await diagram.locator('.hint').boundingBox(),dock=await page.locator('.dock').boundingBox();if(dock)expect(footer.y+footer.height).toBeLessThanOrEqual(dock.y);await page.screenshot({path:testInfo.outputPath(`package-canvas-${theme}-${width}.png`)});
 await page.getByRole('tab',{name:'Virtual machines',exact:true}).click();await page.locator('guest-topology').getByRole('button',{name:'Network',exact:true}).click();await page.locator('guest-topology diagram-workbench').getByRole('button',{name:'Fit diagram',exact:true}).click();await page.screenshot({path:testInfo.outputPath(`guest-canvas-${theme}-${width}.png`)});expect(f.errors).toEqual([]);
 }finally{f.close();}
});
