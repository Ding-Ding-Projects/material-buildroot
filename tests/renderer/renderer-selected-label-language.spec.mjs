import {test,expect} from '@playwright/test';

// Retained real components with inert host replies. These fixtures never execute a host operation.
async function mount(page,tag,props={},keepApp=false){
 await page.addInitScript(()=>{window.__hostRequests=[];window.studio={
  bootstrap:async()=>({language:'en',revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version:'fixture',source:null,updatedAt:null}),
  sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),
  request:async()=>({ok:false,code:'FIXTURE_UNAVAILABLE'}),onEvent:()=>()=>{},windowControl:async()=>true,
  operations:async r=>{window.__hostRequests.push(r);return {ok:false,code:'FIXTURE_UNAVAILABLE'};},
 };});
 await page.goto('/');await page.locator('command-surfaces').waitFor({state:'attached'});
 await page.evaluate(async({tag,props,keepApp})=>{
  const {vocabulary}=await import('/src/renderer/owned-copy.ts');await vocabulary.setSchool('inactive');
  if(!keepApp)document.querySelector('material-buildroot').remove();
  if(tag!=='material-buildroot')await import('/src/renderer/'+tag+'.ts');
  const host=keepApp?document.querySelector('material-buildroot'):document.createElement(tag);
  if(!keepApp)document.body.append(host);
  await host.updateComplete;await new Promise(requestAnimationFrame);
  Object.assign(host,props);host.language='en';host.requestUpdate();await host.updateComplete;
  window.__selectHost=host;window.__selectionChanges=0;
 },{tag,props,keepApp});
 return page;
}
async function retainAndCheck(page,labels,expectedValues){
 const count=await page.evaluate(async({labels,expectedValues})=>{
  const host=window.__selectHost;await host.updateComplete;await new Promise(requestAnimationFrame);
  const tracked=[...host.shadowRoot.querySelectorAll('md-outlined-select')].filter(el=>labels.includes(el.label));
  await Promise.all(tracked.map(el=>el.updateComplete));
  // Establish the retained selection after asynchronous catalog options settle.
  // Supported property assignment emits no change event and performs no host work.
  tracked.forEach((el,index)=>el.value=expectedValues[index]);
  await Promise.all(tracked.map(el=>el.updateComplete));await new Promise(requestAnimationFrame);
  window.__selectRefs=tracked;window.__selectValues=tracked.map(el=>el.value);
  window.__selectedStorage=JSON.stringify(Object.entries(localStorage).sort());
  for(const el of tracked)el.addEventListener('change',()=>window.__selectionChanges++);
  return tracked.length;
 },{labels,expectedValues});
 expect(count).toBe(expectedValues.length);
 expect(await page.evaluate(()=>window.__selectValues)).toEqual(expectedValues);
 for(const language of ['en','zh-HK','bilingual','en']){
  await page.evaluate(async language=>{
   const host=window.__selectHost;
   if(host.localName==='material-buildroot')host.state={...host.state,language};else host.language=language;
   host.requestUpdate();await host.updateComplete;await Promise.all(window.__selectRefs.map(el=>el.updateComplete));await new Promise(requestAnimationFrame);
  },language);
  const rows=await page.evaluate(()=>window.__selectRefs.map(el=>{
   const option=[...el.querySelectorAll('md-select-option')].find(option=>option.value===el.value);
   return {connected:el.isConnected,value:el.value,display:el.displayText.trim(),headline:option?.querySelector('[slot="headline"]')?.textContent.trim()??'',rendered:el.shadowRoot.querySelector('div#label')?.textContent.trim()??''};
  }));
  expect(rows.map(row=>row.value)).toEqual(expectedValues);
  for(const row of rows){expect(row.connected).toBe(true);expect(row.display).toBe(row.headline);expect(row.rendered).toBe(row.headline);}
  expect(await page.evaluate(()=>window.__selectionChanges)).toBe(0);
  expect(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()))).toBe(await page.evaluate(()=>window.__selectedStorage));
 }
}

test('narration retains both, automatic voice and unavailable saved voice',async({page})=>{
 await mount(page,'attention-mode-panel',{restricted:false,opened:true});
 await page.evaluate(async()=>{const host=window.__selectHost;host.narrator?.dispose();host.narrator={forLanguage:()=>[],selected:()=>undefined,configure(){},dispose(){},hold(){},available:true};host.preferences={...host.preferences,narration:{...host.preferences.narration,language:'both',englishVoice:'',cantoneseVoice:'missing-voice-id'}};host.requestUpdate();await host.updateComplete;});
 await retainAndCheck(page,['Narration language','English voice','Cantonese voice'],['both','','missing-voice-id']);
});
test('installed voice names and language tags remain exact',async({page})=>{
 await mount(page,'attention-mode-panel',{restricted:false,opened:true});
 await page.evaluate(async()=>{const host=window.__selectHost;host.narrator?.dispose();const voice={voiceURI:'fixture-voice',name:'Exact voice 甲',lang:'en-CA',localService:true};host.narrator={forLanguage:language=>language==='en'?[voice]:[],selected:()=>voice,configure(){},dispose(){},hold(){},available:true};host.preferences={...host.preferences,narration:{...host.preferences.narration,language:'en',englishVoice:voice.voiceURI,cantoneseVoice:''}};host.requestUpdate();await host.updateComplete;});
 await retainAndCheck(page,['Narration language','English voice','Cantonese voice'],['en','fixture-voice','']);
 expect(await page.evaluate(()=>window.__selectRefs[1].displayText)).toBe('Exact voice 甲 (en-CA)');
});
for(const runner of ['hosted','17'])test('execution destination and selected runner localize: '+runner,async({page})=>{
 await mount(page,'execution-setup-panel',{mode:'dedicated',runner,product:runner==='hosted',inventory:{state:'available',selfHosted:[{id:17,name:'Fixture runner 甲',status:'online',busy:true,compatible:true}]}});
 await retainAndCheck(page,['Execution destination','Explicit runner choice'],['dedicated',runner]);
});
test('support category and draft are retained',async({page})=>{
 await mount(page,'experience-policy-panel',{category:'authenticator',ticketDescription:'Retained fixture text'});
 await retainAndCheck(page,['Category'],['authenticator']);expect(await page.evaluate(()=>window.__selectHost.ticketDescription)).toBe('Retained fixture text');
});
test('unlock duration retains its exact preference without enrollment',async({page})=>{
 await mount(page,'experience-policy-panel',{targetId:'fixture-control',duration:'surface'});
 await retainAndCheck(page,['Unlock duration'],['surface']);
});
test('flashing route labels localize without preview or execution',async({page})=>{
 await mount(page,'flashing-panel',{route:'iso-guest',destinationId:'virtualbox'});
 await retainAndCheck(page,['Route'],['iso-guest']);
 expect(await page.evaluate(()=>window.__hostRequests.some(r=>r.action.startsWith('flashing.')))).toBe(false);
});
for(const compactJourney of [false,true])test('image selections retain missing runtime and custom display stack: compact '+compactJourney,async({page})=>{
 await mount(page,'image-presets-panel',{compactJourney,isoMode:'easy',isoStep:2,preset:'desktop',desktop:'unavailable-stack',isoRuntime:null,isoPlan:null,catalog:{presets:[],desktops:[]},isoBoards:{entries:[{id:'board-id',name:'pc_x86_64_bios_defconfig',origin:'buildroot',order:0,root:'fixture-source'}],outputRoot:'fixture-output'},isoBoardId:'board-id'});
 await retainAndCheck(page,['Configuration mode','Image purpose','Detected image profile','Saved execution runtime','Discovered PC starting point','Display stack'],['easy','desktop','','','board-id','desktop','unavailable-stack']);
 expect(await page.evaluate(()=>({preset:window.__selectHost.preset,desktop:window.__selectHost.desktop}))).toEqual({preset:'desktop',desktop:'unavailable-stack'});
});
test('advanced image selections retain runtime and source display identity',async({page})=>{
 await mount(page,'image-presets-panel',{isoMode:'advanced',preset:'desktop',desktop:'fixture-stack',isoRuntime:{kind:'wsl',distribution:'Exact runtime 甲'},isoPlan:{applicable:true,requirements:[],profile:'fixture-profile'},catalog:{presets:[],desktops:[{id:'fixture-stack',label:'Exact source stack 甲',selectable:true}]}});
 await retainAndCheck(page,['Configuration mode','Image purpose','Detected image profile','Saved execution runtime','Display stack'],['advanced','desktop','bios-iso','saved','fixture-stack']);
});
for(const group of ['', 'fixture-group'])test('tab edge and group label remain current: '+(group||'no group'),async({page})=>{
 await mount(page,'workspace-tabs',{edge:'bottom',dialog:'manage',destinations:[{id:'about',en:'About',zh:'關於',icon:'info'}],tabs:[{id:'fixture-tab',destination:'about',name:'Exact tab 甲',pinned:false,group,owner:''}],groups:[{id:'fixture-group',name:'Exact group 甲',collapsed:false}]});
 await retainAndCheck(page,['Tab edge','Group'],['bottom',group]);
});
for(const managed of [true,false])test('distribution preserves technical identity with localized status: '+managed,async({page})=>{
 await mount(page,'wsl-runtime-panel',{selected:'Fixture-Ubuntu',distributions:[{name:'Fixture-Ubuntu',version:2,managed}]});
 await retainAndCheck(page,['WSL 2 distribution'],['Fixture-Ubuntu']);
});
test('export scope retains selection without exporting',async({page})=>{
 await mount(page,'material-buildroot',{route:'settings',settingsVisited:true,settingsCategory:'backups',workspaceMode:'durable',exportScope:'history',setupDone:true},true);
 await retainAndCheck(page,['Include'],['history']);
});
