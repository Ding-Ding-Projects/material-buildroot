import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createSchedulePreferencesService} from '../../src/main/preferences/service.mjs';
const require=createRequire(import.meta.url);
const {createScheduleIPC}=require('../../src/main/preferences/schedule-ipc.cjs');
const local=(values={'appearance.theme':'dark'},extra={})=>({id:'day-rule',label:'Day rule',enabled:true,priority:0,startDate:null,endDate:null,startTime:'09:00',endTime:'17:00',days:{type:'everyday'},values,source:{type:'local'},...extra});
const document=rules=>({schemaVersion:1,revision:0,timeZone:'UTC',rules});
const panel=page=>page.locator('scheduled-preferences-panel');
const button=(page,name)=>panel(page).getByRole('button',{name,exact:true});
const field=(page,name)=>panel(page).getByRole('textbox',{name,exact:true});
const fixtures=new Set();
test.afterEach(()=>{for(const close of fixtures)close();});

test.describe('scheduled preference decision actions',()=>{
 test.use({deviceScaleFactor:1.5});
 for(const width of [1280,360])for(const kind of ['schedule-leave','source-discard','source-remove'])test(`decision actions stay inside ${kind} at ${width}x752`,async({page})=>{
  await page.setViewportSize({width:1280,height:752});await page.emulateMedia({colorScheme:'light'});
  const f=await open(page,{language:'bilingual'});
  try{
   if(kind==='schedule-leave'){
    await button(page,'Add local rule · 新增本機規則').click();
    await panel(page).evaluate(el=>void el.confirmLeave());
   }else{
    if(kind==='source-remove')await f.service.enrollmentSave({expectedRevision:null,label:'Fixture source',origin:'https://example.com',kind:'https'});
    await button(page,'Read stored sources · 讀取儲存來源').click();
    if(kind==='source-discard'){
     await field(page,'Source label · 來源標籤').fill('Unsaved source');
     await button(page,'Discard source draft · 放棄來源草稿').click();
    }else await button(page,'Remove enrollment · 移除登記 Fixture source').click();
   }
   const dialog=panel(page).locator(`#${kind}-dialog`);
   await expect(dialog.locator('dialog')).toBeVisible();
   await page.setViewportSize({width,height:752});
   await dialog.evaluate(async el=>{await Promise.all(el.shadowRoot.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
   const rectangles=await dialog.evaluate(el=>{
    const bounds=el.shadowRoot.querySelector('dialog').getBoundingClientRect();
    return [...el.querySelector('[slot="actions"]').children].map(action=>{
     const r=action.getBoundingClientRect(),textBounds=[];
     const walker=document.createTreeWalker(action,NodeFilter.SHOW_TEXT);let text;
     while(text=walker.nextNode()){if(!text.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(text);for(const fragment of range.getClientRects())if(fragment.width>0)textBounds.push({left:fragment.left-r.left,right:fragment.right-r.right,top:fragment.top-r.top,bottom:fragment.bottom-r.bottom});}
     return {label:action.textContent.trim(),left:r.left-bounds.left,right:r.right-bounds.right,top:r.top-bounds.top,bottom:r.bottom-bounds.bottom,width:r.width,height:r.height,viewportLeft:r.left,viewportRight:r.right,viewportBottom:r.bottom,textBounds};
    });
   });
   expect(rectangles).toHaveLength(kind==='schedule-leave'?3:2);
   for(const action of rectangles){
    expect(action.left,action.label).toBeGreaterThanOrEqual(-1);expect(action.right,action.label).toBeLessThanOrEqual(1);
    expect(action.top,action.label).toBeGreaterThanOrEqual(-1);expect(action.bottom,action.label).toBeLessThanOrEqual(1);
    expect(action.viewportLeft,action.label).toBeGreaterThanOrEqual(0);expect(action.viewportRight,action.label).toBeLessThanOrEqual(width);
    expect(action.viewportBottom,action.label).toBeLessThanOrEqual(752);expect(action.height,action.label).toBeGreaterThanOrEqual(48);
    expect(action.textBounds.length,action.label).toBeGreaterThan(0);
    for(const fragment of action.textBounds){expect(fragment.left,action.label).toBeGreaterThanOrEqual(-1);expect(fragment.right,action.label).toBeLessThanOrEqual(1);expect(fragment.top,action.label).toBeGreaterThanOrEqual(-1);expect(fragment.bottom,action.label).toBeLessThanOrEqual(1);}
   }
   const focused=()=>dialog.evaluate(el=>[...el.querySelector('[slot="actions"]').children].findIndex(action=>action.matches(':focus-within')));
   const visited=new Set();for(let step=0;step<rectangles.length*3+4;step++){await page.keyboard.press('Tab');const index=await focused();if(index>=0)visited.add(index);if(visited.size===rectangles.length)break;}
   expect(visited.size).toBe(rectangles.length);
   for(let step=0;step<rectangles.length+3&&await focused()!==0;step++)await page.keyboard.press('Tab');
   expect(await focused()).toBe(0);await page.keyboard.press('Enter');await expect(dialog).toHaveJSProperty('open',false);
   expect(await f.service.read()).toBeNull();expect(f.errors).toEqual([]);
  }finally{f.close();}
 });
});

test.describe('schedule panel container sizing',()=>{
 test.use({deviceScaleFactor:1.5});
 for(const width of [1200,1280,1440])test(`schedule panel fits a narrow settings column at ${width}x752`,async({page})=>{
  await page.setViewportSize({width,height:752});await page.emulateMedia({colorScheme:'light'});
  const f=await open(page,{language:'bilingual',rules:[local({'appearance.theme':'light'},{label:'Recovered native draft'})]});
  try{
   await expect(panel(page).locator('.editor')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
   const measurements=await panel(page).evaluate(el=>{
    const host=el.getBoundingClientRect();
    const elements=[...el.shadowRoot.querySelectorAll('.layout,.rules,.rule,.editor,.fields,.timeline,.status,.editor md-outlined-text-field,.editor md-outlined-select')];
    return {viewport:innerWidth,scale:devicePixelRatio,hostWidth:host.width,overflow:elements.map(node=>{
     const rect=node.getBoundingClientRect();return {selector:node.className||node.localName,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,left:rect.left-host.left,right:rect.right-host.right};
    }).filter(row=>row.scrollWidth>row.clientWidth+1||row.left< -1||row.right>1)};
   });
   // A wide viewport still places this panel in the narrower second settings column.
   expect(measurements.viewport).toBeGreaterThan(1100);expect(measurements.scale).toBe(1.5);
   expect(measurements.hostWidth).toBeGreaterThan(350);expect(measurements.hostWidth).toBeLessThan(650);
   expect(measurements.overflow).toEqual([]);
   // Material icon controls extend their touch regions into surrounding spacing.
   // Keep strict content bounds above and check scrolling at the owning main surface.
   const parentBounds=await page.locator('material-buildroot').evaluate(el=>{
    const main=el.shadowRoot.querySelector('main'),grid=el.shadowRoot.querySelector('.settings-grid');
    const outer=main.getBoundingClientRect(),inner=grid.getBoundingClientRect();
    return {clientWidth:main.clientWidth,scrollWidth:main.scrollWidth,left:inner.left-outer.left,right:inner.right-outer.right};
   });
   expect(parentBounds.scrollWidth).toBeLessThanOrEqual(parentBounds.clientWidth+1);
   expect(parentBounds.left).toBeGreaterThanOrEqual(-1);expect(parentBounds.right).toBeLessThanOrEqual(1);
   await field(page,'Rule label · 規則標籤').fill('Reviewed local rule');
   await expect(field(page,'Rule label · 規則標籤')).toHaveValue('Reviewed local rule');
   expect(f.errors).toEqual([]);
  }finally{f.close();}
 });
});

// Browser source preview with the production SQLite service and typed IPC adapter.
// Native frame admission, window input and installer behavior require separate evidence.
async function open(page,{language='en',rules,restricted=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-renderer-'));
 let now=Date.parse('2026-10-15T12:00:00Z');
 const base={language,'appearance.theme':'system'};
 const service=createSchedulePreferencesService({directory,profileId:'desktop',baseReader:async()=>({...base}),clock:()=>now,tickMs:60000});
 const ipc=createScheduleIPC({desktop:{admitted:()=>true},service,sharedModeStatus:()=>({available:true,active:restricted})});
 let stop=()=>{};
 const close=()=>{stop();ipc.close();fs.rmSync(directory,{recursive:true,force:true});fixtures.delete(close);};
 fixtures.add(close);
 await service.start();
 if(rules){await service.replace({document:document(rules),expectedRevision:null});await service.refresh();}
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__scheduleRequest',r=>ipc.request({},JSON.stringify(r)));
 await page.addInitScript(({language,restricted})=>{
  window.fixture={requests:[],windowCommands:[],restricted,scheduleListener:null,sharedListener:null};
  window.studio={
   bootstrap:async()=>({language,revision:'0'.repeat(40),projectId:'desktop-settings',capability:'fixture',storage:'ready',origin:'saved',version:'source preview',source:null,updatedAt:null}),
   request:async()=>({ok:false,code:'UNAVAILABLE'}),onEvent:()=>()=>{},
   windowControl:async command=>{window.fixture.windowCommands.push(command);return true;},
   sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:restricted,displayName:null,revision:null,credentialKind:null}}),
   onSharedMode:listener=>{window.fixture.sharedListener=listener;return()=>{};},
   scheduledPreferences:async r=>{
    const {token,...record}=r;
    window.fixture.requests.push({...record,...(token===undefined?{}:{credentialSubmitted:true})});
    if(r.action==='replace'&&window.fixture.delaySave)await new Promise(resolve=>window.fixture.releaseSave=resolve);
    if(window.fixture.failAction===r.action)throw Error('Fixture transport unavailable');
    const result=await window.__scheduleRequest(r);
    if(window.fixture.loseReplyAction===r.action)throw Error('Fixture reply unavailable after host operation');
    return result;
   },
   onScheduledPreferences:listener=>{window.fixture.scheduleListener=listener;return()=>{window.fixture.scheduleListener=null;};},
  };
 },{language,restricted});
 stop=service.subscribe(snapshot=>void page.evaluate(snapshot=>window.fixture?.scheduleListener?.(snapshot),snapshot).catch(()=>{}));
 await page.goto('/');
 await page.locator('nav').getByRole('button',{name:/^(Settings|設定|Settings · 設定)$/}).click();
 await expect(panel(page).locator('#schedule-heading')).toBeVisible();
 await expect(panel(page).locator('md-outlined-button').filter({hasText:/Add local rule|新增本機規則/})).toHaveJSProperty('disabled',false);
 return {service,base,errors,setTime:async time=>{now=Date.parse(time);await service.refresh();},close};
}

test('create a local calendar rule, save to SQLite, reload and inspect durable history',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Add local rule').click();
  await field(page,'Rule label').fill('Working hours');
  await button(page,'Save schedule').click();
  await expect(panel(page)).toContainText('Schedule saved.');
  await expect(button(page,'Save schedule')).toHaveJSProperty('disabled',true);
  expect((await f.service.read()).rules[0].label).toBe('Working hours');
  expect(f.base).toEqual({language:'en','appearance.theme':'system'});
  await button(page,'Read schedule history').click();
  await expect(panel(page).locator('#schedule-history')).toContainText('schedule.created');
  await page.reload();await page.locator('nav').getByRole('button',{name:/^(Settings|設定|Settings · 設定)$/}).click();
  await expect(field(page,'Rule label')).toHaveValue('Working hours');
  expect(f.errors).toEqual([]);
 }finally{f.close();}
});

test('live effective preferences expire to untouched base and obey shared precedence',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 const f=await open(page,{rules:[local({language:'zh-HK','appearance.theme':'dark'})]});
 try{
  await expect(page.locator('html')).toHaveAttribute('lang','zh-HK');
  await expect(page.locator('.shell')).toHaveClass(/dark/);
  await page.evaluate(()=>window.fixture.sharedListener({available:true,watching:true,configured:true,active:true,displayName:'Shared preference',revision:null,credentialKind:'password'}));
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(panel(page)).not.toContainText('Day rule');
  await expect(panel(page)).not.toContainText('day-rule');
  await expect(panel(page)).toContainText('Active scheduled rule');
  await expect(panel(page)).not.toContainText('香港');
  await f.setTime('2026-10-15T18:00:00Z');
  await expect(page.locator('.shell')).not.toHaveClass(/dark/);
  await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('.shell')).toHaveClass(/dark/);
  expect(f.base).toEqual({language:'en','appearance.theme':'system'});
 }finally{f.close();}
});

test('stale host base values with null provenance display the current base preferences',async({page})=>{
 const f=await open(page);
 try{
  const stale=f.service.status();
  await page.locator('material-buildroot').evaluate((el,stale)=>{
   el.theme='light';el.state={...el.state,language:'zh-HK'};el.applyScheduledSnapshot(stale);
  },stale);
  await expect(page.locator('html')).toHaveAttribute('lang','zh-HK');
  await expect(page.locator('.shell')).not.toHaveClass(/dark/);
  await expect(panel(page).locator('.status')).toContainText('有效主題: 淺色');
  await expect(panel(page).locator('.status')).toContainText('有效語言: 香港粵語');
 }finally{f.close();}
});

test('unsaved draft protects direct navigation, close, cancel and explicit discard',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Add local rule').click();
  await page.locator('material-buildroot').evaluate(el=>void el.go('activity'));
  await expect(panel(page).getByRole('dialog')).toBeVisible();
  await button(page,'Keep editing').click();
  await expect(page.locator('#workspace-heading')).toHaveText('Settings');
  await page.locator('.window').getByRole('button',{name:'Close application',exact:true}).click();
  await expect(panel(page).getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>window.fixture.windowCommands)).toEqual([]);
  await button(page,'Keep editing').click();
  await page.locator('nav').getByRole('button',{name:/^(Activity|活動|Activity · 活動)$/}).click();
  await button(page,'Discard schedule draft').click();
  await expect(page.locator('#workspace-heading')).toHaveText('Activity');
  expect(await f.service.read()).toBeNull();
 }finally{f.close();}
});

test('conflicting revisions retain the draft until explicit reload',async({page})=>{
 const f=await open(page,{rules:[local()]});
 try{
  await field(page,'Rule label').fill('My pending choice');
  await f.service.replace({document:document([local({'appearance.theme':'light'},{label:'Other writer'})]),expectedRevision:0});
  await f.service.refresh();
  await expect(panel(page)).toContainText('Stored revision changed');
  await expect(button(page,'Save schedule')).toHaveJSProperty('disabled',true);
  await button(page,'Read stored revision').click();
  await expect(field(page,'Rule label')).toHaveValue('My pending choice');
  await button(page,'Reload schedule').click();await button(page,'Discard schedule draft').click();
  await expect(field(page,'Rule label')).toHaveValue('Other writer');
  expect((await f.service.history()).records).toHaveLength(2);
 }finally{f.close();}
});

test('pending save cannot discard or close, and confirmed save survives status unavailability',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Add local rule').click();
  await page.locator('nav').getByRole('button',{name:/^(Activity|活動|Activity · 活動)$/}).click();
  await page.evaluate(()=>window.fixture.delaySave=true);
  await button(page,'Save and continue').click();
  await expect(button(page,'Discard schedule draft')).toHaveJSProperty('disabled',true);
  await page.evaluate(()=>{window.fixture.failAction='status';window.fixture.releaseSave();});
  await expect(page.locator('#workspace-heading')).toHaveText('Activity');
  expect((await f.service.read()).rules).toHaveLength(1);
 }finally{f.close();}
});

test('unknown save result retains draft and requires stored revision inspection',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Add local rule').click();await page.evaluate(()=>window.fixture.failAction='replace');
  await button(page,'Save schedule').click();
  await expect(panel(page)).toContainText('Schedule operation not confirmed');
  await expect(button(page,'Save schedule')).toHaveJSProperty('disabled',true);
  await page.evaluate(()=>window.fixture.failAction=null);await button(page,'Read stored revision').click();
  await expect(button(page,'Save schedule')).toHaveJSProperty('disabled',false);
  await button(page,'Save schedule').click();await expect(panel(page)).toContainText('Schedule saved.');expect((await f.service.read()).rules).toHaveLength(1);
 }finally{f.close();}
});

test('invalid calendar fields cannot reach durable storage',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Add local rule').click();await field(page,'Schedule timezone').fill('Not/A_Zone');
  await button(page,'Save schedule').click();await expect(panel(page).getByRole('alert')).toBeVisible();
  expect(await f.service.read()).toBeNull();
  expect(await page.evaluate(()=>window.fixture.requests.filter(r=>r.action==='replace'))).toEqual([]);
 }finally{f.close();}
});

test('unenrolled external rules remain unchanged and cannot be enabled in local editor',async({page})=>{
 const remote=local({'appearance.theme':'dark'},{enabled:false,source:{type:'https',url:'https://example.com/settings',refreshMs:30000,timeoutMs:500,maxResponseBytes:4096}});
 const f=await open(page,{rules:[remote]});
 try{
  await expect(panel(page).getByRole('switch',{name:'Enable rule Day rule'})).toHaveJSProperty('disabled',true);
  await button(page,'Add local rule').click();await button(page,'Save schedule').click();
  await expect(panel(page)).toContainText('Schedule saved.');
  await expect(button(page,'Save schedule')).toHaveJSProperty('disabled',true);
  expect((await f.service.read()).rules[0]).toEqual(remote);
 }finally{f.close();}
});

for(const language of ['en','zh-HK','bilingual'])test(`localized controls, keyboard add and narrow layout in ${language}`,async({page})=>{
 await page.setViewportSize({width:960,height:720});
 const f=await open(page,{language});
 try{
  const add=panel(page).getByRole('button',{name:/^Add local rule$|^新增本機規則$|^Add local rule · 新增本機規則$/});
  await add.focus();await page.keyboard.press('Enter');
  await expect(panel(page).locator('.editor')).toBeVisible();
  expect(await panel(page).evaluate(el=>[...el.shadowRoot.querySelectorAll('.layout,.fields,.editor,.status')].filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.className))).toEqual([]);
  expect(await page.evaluate(()=>['md-checkbox','md-switch','md-icon-button'].every(n=>customElements.get(n)))).toBe(true);
  expect(f.errors).toEqual([]);
 }finally{f.close();}
});

test('HTTPS enrollment saves, reads back, survives reinspection and removes with confirmation',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Read stored sources').click();
  await field(page,'Source label').fill('Public settings endpoint');
  await field(page,'HTTPS origin').fill('https://example.com');
  await panel(page).getByRole('checkbox',{name:'Allow this source for existing enabled schedules',exact:true}).click();
  await button(page,'Save source enrollment').click();
  await expect(panel(page)).toContainText('Enrollment saved and stored metadata confirmed');
  expect((await f.service.enrollmentList()).entries).toHaveLength(1);
  expect(await f.service.read()).toBeNull();
  await button(page,'Read stored sources').click();
  await expect(field(page,'Source label')).toHaveValue('Public settings endpoint');
  await button(page,'Remove enrollment Public settings endpoint').click();
  await panel(page).locator('#source-remove-dialog').getByRole('button',{name:'Keep enrollment',exact:true}).click();
  expect((await f.service.enrollmentList()).entries).toHaveLength(1);
  await button(page,'Remove enrollment Public settings endpoint').click();
  await panel(page).locator('#source-remove-dialog').getByRole('button',{name:'Remove enrollment',exact:true}).click();
  await expect(panel(page)).toContainText('Enrollment removal confirmed by readback');
  expect((await f.service.enrollmentList()).entries).toHaveLength(0);
  expect(f.errors).toEqual([]);
 }finally{f.close();}
});

test('invalid enrollment origin and missing Home Assistant credential never reach a host mutation',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Read stored sources').click();
  await field(page,'Source label').fill('Private automation');
  await field(page,'HTTPS origin').fill('https://example.com/path');
  await button(page,'Save source enrollment').click();
  await expect(panel(page)).toContainText('INVALID_SOURCE_ORIGIN');
  await field(page,'HTTPS origin').fill('https://example.com');
  await panel(page).getByRole('combobox',{name:'Source kind',exact:true}).click();
  await panel(page).locator('md-select-option[value="home-assistant"]').click();
  await panel(page).getByRole('checkbox',{name:'Allow this source for existing enabled schedules',exact:true}).click();
  await button(page,'Save source enrollment').click();
  await expect(panel(page)).toContainText('SOURCE_CREDENTIAL_REQUIRED');
  expect(await page.evaluate(()=>window.fixture.requests.filter(r=>r.action==='enrollment.save'))).toEqual([]);
  expect((await f.service.enrollmentList()).entries).toHaveLength(0);
 }finally{f.close();}
});

test('enrollment conflict retains draft and source-only discard preserves a schedule draft',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Add local rule').click();
  await field(page,'Rule label').fill('Unsaved schedule');
  await button(page,'Read stored sources').click();
  await field(page,'Source label').fill('Unsaved source');
  await field(page,'HTTPS origin').fill('https://example.com');
  await panel(page).getByRole('checkbox',{name:'Allow this source for existing enabled schedules',exact:true}).click();
  await f.service.enrollmentSave({expectedRevision:null,label:'Other writer',origin:'https://example.org',kind:'https'});
  await button(page,'Save source enrollment').click();
  await expect(panel(page)).toContainText('Stored source revision changed');
  await expect(field(page,'Source label')).toHaveValue('Unsaved source');
  await button(page,'Discard source draft').click();
  await panel(page).locator('#source-discard-dialog').getByRole('button',{name:'Discard source draft',exact:true}).click();
  await expect(field(page,'Rule label')).toHaveValue('Unsaved schedule');
  await button(page,'Read stored sources').click();
  await expect(panel(page)).toContainText('Other writer');
 }finally{f.close();}
});

test('shared restriction removes enrollment forms while preserving stored metadata',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Read stored sources').click();
  await field(page,'Source label').fill('Unsubmitted source');
  await page.evaluate(()=>window.fixture.sharedListener({available:true,watching:true,configured:true,active:true,displayName:'Shared preference',revision:null,credentialKind:'password'}));
  await expect(panel(page).getByRole('textbox',{name:'Source label',exact:true})).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Unsubmitted source');
  expect((await f.service.enrollmentList()).entries).toHaveLength(0);
 }finally{f.close();}
});

test('discard records the local draft before clearing and restoration never activates it',async({page})=>{
 const f=await open(page);
 try{
  await button(page,'Add local rule').click();
  await field(page,'Rule label').fill('Preserved working draft');
  await page.locator('nav').getByRole('button',{name:'Activity',exact:true}).click();
  await button(page,'Discard schedule draft').click();
  await expect(page.locator('#workspace-heading')).toHaveText('Activity');
  expect(await f.service.read()).toBeNull();
  await page.locator('nav').getByRole('button',{name:'Settings',exact:true}).click();
  await button(page,'Read discarded drafts').click();
  await button(page,'Restore to editor 1').click();
  await expect(field(page,'Rule label')).toHaveValue('Preserved working draft');
  expect(await f.service.read()).toBeNull();
  await button(page,'Save schedule').click();
  await expect(panel(page)).toContainText('Schedule saved.');
  expect((await f.service.read()).rules[0].label).toBe('Preserved working draft');
 }finally{f.close();}
});

test('unknown removal cannot mutate again until readback and renewed confirmation',async({page})=>{
 const f=await open(page);
 try{
  const first=await f.service.enrollmentSave({expectedRevision:null,label:'First source',origin:'https://example.com',kind:'https'});
  await f.service.enrollmentSave({expectedRevision:first.revision,label:'Second source',origin:'https://example.org',kind:'https'});
  await button(page,'Read stored sources').click();
  await button(page,'Remove enrollment First source').click();
  await page.evaluate(()=>window.fixture.loseReplyAction='enrollment.remove');
  const confirm=panel(page).locator('#source-remove-dialog md-outlined-button');
  await panel(page).locator('#source-remove-dialog').getByRole('button',{name:'Remove enrollment',exact:true}).click();
  await expect(panel(page)).toContainText('Source operation was not confirmed');
  await expect(panel(page).locator('#source-remove-dialog')).toHaveJSProperty('open',false);
  await expect(confirm).toHaveJSProperty('disabled',true);
  await panel(page).evaluate(async el=>{await el.confirmRemoveSource();await el.confirmRemoveSource();});
  const removals=()=>page.evaluate(()=>window.fixture.requests.filter(r=>r.action==='enrollment.remove'));
  expect(await removals()).toHaveLength(1);
  await page.evaluate(()=>{window.fixture.loseReplyAction=null;window.fixture.failAction='enrollment.list';});
  await button(page,'Read stored sources').click();
  await expect(panel(page)).toContainText('Source state is unconfirmed');
  await panel(page).evaluate(el=>el.confirmRemoveSource());expect(await removals()).toHaveLength(1);
  await page.evaluate(()=>window.fixture.failAction=null);await button(page,'Read stored sources').click();
  await expect(button(page,'Remove enrollment Second source')).toBeEnabled();
  await panel(page).evaluate(el=>el.confirmRemoveSource());expect(await removals()).toHaveLength(1);
  await expect(confirm).toHaveJSProperty('disabled',true);
  const revision=(await f.service.enrollmentList()).revision;
  await button(page,'Remove enrollment Second source').click();
  await panel(page).locator('#source-remove-dialog').getByRole('button',{name:'Remove enrollment',exact:true}).click();
  await expect(panel(page)).toContainText('Enrollment removal confirmed by readback');
  const requests=await removals();expect(requests).toHaveLength(2);expect(requests[1].expectedRevision).toBe(revision);
 }finally{f.close();}
});

test('mixed-document conflict preserves local edits and explicitly restores beside current external records',async({page})=>{
 const external=id=>local({'appearance.theme':'dark'},{id,label:id,enabled:false,source:{type:'https',url:`https://example.com/${id}`,refreshMs:30000,timeoutMs:500,maxResponseBytes:4096}});
 const a=local({'appearance.theme':'light'},{id:'local-a',label:'Local A'}),b=local({'appearance.theme':'dark'},{id:'local-b',label:'Local B'});
 const f=await open(page,{rules:[external('external-a'),b,external('external-b'),a]});
 try{
  await button(page,'Local B').click();await field(page,'Rule label').fill('Preserved local B');
  const desired=await panel(page).evaluate(el=>structuredClone(el.document));
  const current=await f.service.replace({document:{...document([external('external-b'),a,external('external-a'),b]),timeZone:'Asia/Hong_Kong'},expectedRevision:0});
  await f.service.refresh();await expect(panel(page)).toContainText('Stored revision changed');
  await button(page,'Reload schedule').click();
  await expect(panel(page).locator('#schedule-leave-dialog')).toContainText('history preserves all local rule edits');
  await button(page,'Discard schedule draft').click();
  await expect(field(page,'Rule label')).toHaveValue('Local A');
  const records=await f.service.draftList({after:0,limit:20});expect(records.records).toHaveLength(1);
  const stored=await f.service.draftRead({sequence:records.records[0].sequence});
  expect(stored.document).toEqual({...desired,rules:desired.rules.filter(r=>r.source.type==='local')});
  expect(await f.service.read()).toEqual(current);
  await button(page,'Read discarded drafts').click();await button(page,`Restore to editor ${stored.sequence}`).click();
  await expect(field(page,'Rule label')).toHaveValue('Preserved local B');
  const restored=await panel(page).evaluate(el=>({document:structuredClone(el.document),expectedRevision:el.expectedRevision}));
  expect(restored.expectedRevision).toBe(current.revision);
  expect(restored.document.timeZone).toBe(desired.timeZone);expect(restored.document.revision).toBe(desired.revision);
  expect(restored.document.rules.filter(r=>r.source.type!=='local')).toEqual(current.rules.filter(r=>r.source.type!=='local'));
  expect(restored.document.rules.filter(r=>r.source.type==='local')).toEqual(desired.rules.filter(r=>r.source.type==='local'));
  expect(await f.service.read()).toEqual(current);
  expect(await page.evaluate(()=>window.fixture.requests.filter(r=>r.action==='replace'))).toEqual([]);
 }finally{f.close();}
});

test('restoration rejects a local identifier collision with a current external rule',async({page})=>{
 const f=await open(page);
 try{
  const receipt=await f.service.draftDiscard({document:document([local({'appearance.theme':'light'},{id:'collision'})])});
  const current=await f.service.replace({document:document([local({'appearance.theme':'dark'},{id:'collision',enabled:false,source:{type:'https',url:'https://example.com/settings',refreshMs:30000,timeoutMs:500,maxResponseBytes:4096}})]),expectedRevision:null});
  await button(page,'Reload schedule').click();await expect(button(page,'Add local rule')).toBeEnabled();
  const before=await panel(page).evaluate(el=>structuredClone(el.document));
  await button(page,'Read discarded drafts').click();await button(page,`Restore to editor ${receipt.sequence}`).click();
  await expect(panel(page)).toContainText('a rule identifier conflicts with a current external rule');
  expect(await panel(page).evaluate(el=>structuredClone(el.document))).toEqual(before);
  expect(await f.service.read()).toEqual(current);
 }finally{f.close();}
});
