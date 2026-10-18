import {test,expect} from '@playwright/test';

const copy={
 en:{title:'Commands and workspace controls',theme:'Theme',focus:'Go to this element',find:'Find commands'},
 'zh-HK':{title:'指令同工作區控制項',theme:'主題',focus:'前往此元素',find:'尋找指令'},
 bilingual:{title:'Commands and workspace controls · 指令同工作區控制項',theme:'Theme · 主題',focus:'Go to this element · 前往此元素',find:'Find commands · 尋找指令'},
};
async function open(page,{language='en',restricted=false}={}){
 await page.addInitScript(({language,restricted})=>{
  window.studio={
   sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:restricted,active:restricted,displayName:restricted?'Shared mode':null,revision:null,credentialKind:null}}),
   bootstrap:async()=>({language,revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version:'renderer fixture',source:null,updatedAt:null}),
   request:async()=>({ok:false,code:'UNAVAILABLE'}),onEvent:()=>()=>{},windowControl:async()=>true,
   operations:async()=>({ok:false,code:'FIXTURE_UNAVAILABLE'}),
   onSharedMode:listener=>{window.__sharedListener=listener;return()=>{};},
  };
 },{language,restricted});
 await page.goto('/');
 const app=page.locator('material-buildroot'),surface=page.locator('command-surfaces');
 await expect.poll(()=>app.evaluate(el=>el.state?.language)).toBe(language);
 await expect.poll(()=>app.evaluate(el=>el.restricted)).toBe(restricted);
 await app.evaluate(async el=>{el.setupDone=true;await el.updateComplete;});
 await expect(surface).toHaveCount(1);
 return {app,surface};
}
async function palette(page,surface,language){
 await page.keyboard.press('Control+Shift+f');
 await expect(surface.getByRole('dialog')).toHaveAccessibleName(copy[language].title);
 await expect(surface.locator('[data-action="setting-theme"]')).toContainText(copy[language].theme);
 // A stale action inventory can disagree with correctly refreshed dialog chrome.
 expect(await surface.locator('[data-action="setting-theme"]').evaluate(el=>el.textContent.trim().replace(/^arrow_forward\s*/,''))).toBe(copy[language].theme);
}
async function context(app,surface,language){
 await app.locator('[data-image-action="create"]').click({button:'right'});
 await expect(surface.getByRole('dialog')).toBeVisible();
 expect(await surface.locator('[data-action="focus"]').evaluate(el=>el.textContent.trim().replace(/^arrow_forward\s*/,''))).toBe(copy[language].focus);
 expect(await surface.locator('[data-action="palette"]').evaluate(el=>el.textContent.trim().replace(/^arrow_forward\s*/,''))).toBe(copy[language].find);
}
async function close(surface){await surface.locator('md-dialog').evaluate(el=>el.close());await expect(surface.getByRole('dialog')).toBeHidden();}
for(const language of ['en','zh-HK','bilingual']){
 test(`first palette uses effective ${language} before creating its title and actions`,async({page})=>{const {surface}=await open(page,{language});await palette(page,surface,language);});
 test(`first context actions use effective ${language}`,async({page})=>{const {app,surface}=await open(page,{language});await context(app,surface,language);});
}
test('palette and context refresh language on each opening',async({page})=>{
 const {app,surface}=await open(page);
 for(const language of ['en','zh-HK','bilingual','en']){
  await app.evaluate(async(el,language)=>{el.state={...el.state,language};await el.updateComplete;},language);
  await palette(page,surface,language);await close(surface);await context(app,surface,language);await close(surface);
 }
});
test('shared restriction uses English on first opening without changing the saved language',async({page})=>{
 const {app,surface}=await open(page,{language:'zh-HK',restricted:true});
 await palette(page,surface,'en');await expect(surface.locator('[data-action="setting-language"]')).toHaveCount(0);await close(surface);
 await context(app,surface,'en');expect(await app.evaluate(el=>el.state.language)).toBe('zh-HK');
});
test('entering shared mode between openings uses current English restriction',async({page})=>{
 const {app,surface}=await open(page,{language:'zh-HK'});
 await palette(page,surface,'zh-HK');await close(surface);
 await page.evaluate(()=>window.__sharedListener({available:true,watching:true,configured:true,active:true,displayName:'Shared mode',revision:null,credentialKind:null}));
 await expect.poll(()=>app.evaluate(el=>el.effectiveLanguage)).toBe('en');
 await palette(page,surface,'en');await close(surface);await context(app,surface,'en');
 expect(await app.evaluate(el=>el.state.language)).toBe('zh-HK');
});
