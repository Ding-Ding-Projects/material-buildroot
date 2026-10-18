import {test,expect} from '@playwright/test';
// Browser-only operation fixtures. Real Buildroot production and boot need separate evidence.
async function open(page,{effective=true,applicable=true,easy=false}={}){
 test.setTimeout(60000);
 await page.goto('/',{timeout:45000,waitUntil:'domcontentloaded'});
 await page.evaluate(async({effective,applicable,easy})=>{
  await import('/src/renderer/image-presets-panel.ts');
  window.__isoRequests=[];
  window.studio={operations:async request=>{
   window.__isoRequests.push(request);
   let result;
   switch(request.action){
    case 'imagePreset.catalog':result={revision:'rev-1',desktops:[]};break;
    case 'imagePreset.isoPlan':result={revision:'rev-1',profile:'x86_64-bios-grub2-initrd',applicable,requirements:[{symbol:'BR2_TARGET_ROOTFS_ISO9660',selectable:applicable,reason:applicable?null:'unavailable'}]};break;
    case 'imagePreset.isoApply':result={effective,revision:'rev-2',profile:'x86_64-bios-grub2-initrd',output:'images/rootfs.iso9660'};break;
    case 'project.options':result={runtime:{kind:'wsl',distribution:'Fixture'}};break;
    case 'imagePreset.isoBuild':result={id:'job-1',sequence:1,state:'queued'};break;
    case 'jobs.list':result=[{id:'job-1',sequence:2,state:'succeeded'}];break;
    case 'jobs.page':result={records:[{value:{text:'Build completed'}}],hasMore:false};break;
    case 'artifacts.inspect':result={size:65536,sha256:'a'.repeat(64),iso:{descriptorValid:true,withinImage:true,elTorito:{validationChecksumValid:true,bootEntryValid:true,platformId:0},bootVerified:false}};break;
    default:return {ok:false,code:'FIXTURE_UNAVAILABLE'};
   }
   return {ok:true,result};
  }};
  const panel=document.createElement('image-presets-panel');panel.workspaceId='workspace-1';panel.language='en';panel.isoMode=easy?'easy':'advanced';document.body.replaceChildren(panel);
 },{effective,applicable,easy});
 return page.getByRole('region',{name:'BIOS ISO workflow',exact:true});
}
async function configure(panel){
 await panel.getByRole('button',{name:'Check ISO prerequisites',exact:true}).click();
 await panel.getByRole('checkbox',{name:'Apply the listed ISO configuration requests',exact:true}).check();
 await panel.getByRole('button',{name:'Configure BIOS ISO',exact:true}).click();
}
test('ISO workflow separates configuration, actual job and structural inspection',async({page})=>{
 const panel=await open(page);
 await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeDisabled();
 await configure(panel);
 await panel.getByRole('button',{name:'Build ISO image',exact:true}).click();
 await expect(panel).toContainText('queued');
 await expect(panel.getByRole('button',{name:'Inspect ISO output',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Refresh ISO job and log',exact:true}).click();
 await expect(panel).toContainText('succeeded');await expect(panel).toContainText('Build completed');
 await panel.getByRole('button',{name:'Inspect ISO output',exact:true}).click();
 await expect(panel).toContainText('passed structural checks');await expect(panel).toContainText('boot execution remains unverified');
 const requests=await page.evaluate(()=>window.__isoRequests);
 expect(requests.find(r=>r.action==='imagePreset.isoApply')).toEqual({action:'imagePreset.isoApply',workspaceId:'workspace-1',revision:'rev-1'});
 expect(requests.find(r=>r.action==='imagePreset.isoBuild')).toEqual({action:'imagePreset.isoBuild',workspaceId:'workspace-1',revision:'rev-2',profile:'x86_64-bios-grub2-initrd',runtime:{kind:'wsl',distribution:'Fixture'},jobs:2});
 expect(requests.find(r=>r.action==='artifacts.inspect').path).toBe('images/rootfs.iso9660');
});
test('unavailable requirements and incomplete reconciliation cannot start builds',async({page})=>{
 let panel=await open(page,{applicable:false});await panel.getByRole('button',{name:'Check ISO prerequisites',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Configure BIOS ISO',exact:true})).toBeDisabled();
 panel=await open(page,{effective:false});await configure(panel);
 await expect(panel).toContainText('configuration is incomplete');await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeDisabled();
});
test('changing workspace discards late planning replies',async({page})=>{
 const panel=await open(page);
 await page.evaluate(()=>{const original=window.studio.operations;window.studio.operations=async request=>{if(request.action==='imagePreset.isoPlan')await new Promise(resolve=>window.__releaseIso=resolve);return original(request);};});
 await panel.getByRole('button',{name:'Check ISO prerequisites',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof window.__releaseIso)).toBe('function');
 await page.evaluate(async()=>{const el=document.querySelector('image-presets-panel');el.workspaceId='workspace-2';await el.updateComplete;window.__releaseIso();});
 await expect(panel.getByRole('button',{name:'Check ISO prerequisites',exact:true})).toBeEnabled();
 await expect(panel.getByRole('button',{name:'Configure BIOS ISO',exact:true})).toHaveCount(0);
});

test('Easy guide restores step position without restoring success',async({page})=>{
 const panel=await open(page,{easy:true});
 await expect(panel).toContainText('What would you like to make?');
 await expect(panel.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await configure(panel);
 await panel.getByRole('button',{name:'Next',exact:true}).click();
 await expect(panel.getByRole('heading',{name:'Make the image file',exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iso-workflow-workspace-1')).step)).toBe(1);
 await page.evaluate(async()=>{const old=document.querySelector('image-presets-panel');const next=document.createElement('image-presets-panel');next.workspaceId='workspace-1';next.language='en';old.replaceWith(next);await next.updateComplete;});
 await expect(panel).toContainText('Saved progress restored');
 await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Back',exact:true}).click();
 await expect(panel.getByRole('heading',{name:'What would you like to make?',exact:true})).toBeVisible();
});

test('external configuration generation invalidates build readiness',async({page})=>{const panel=await open(page);await configure(panel);await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeEnabled();await page.evaluate(()=>document.querySelector('image-presets-panel').configurationGeneration++);await expect(panel.getByRole('button',{name:'Build ISO image',exact:true})).toBeDisabled();await expect(panel).toContainText('Configuration changed.');});
