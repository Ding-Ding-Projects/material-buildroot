import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{createDocumentationService}=require('../../src/main/documentation/service.cjs');
const directory=path.resolve(process.env.DOCUMENTATION_FIXTURE_DIRECTORY||'dist/documentation');
const available=fs.existsSync(path.join(directory,'index.json'));
test.skip(!available,'Requires an actual built documentation bundle; no generated-count substitute is used.');
async function physicalReader(page){
 const service=createDocumentationService({directory}),index=service.list(),calls=[];
 const manifestBytes=fs.readFileSync(path.join(directory,'index.json'));
 const manifest=JSON.parse(manifestBytes);
 await page.exposeFunction('__physicalDocumentation',request=>{
  const started=performance.now();let result;
  if(request.action==='documentation.list')result=service.list();
  else if(request.action==='documentation.searchText')result=service.searchText();
  else if(request.action==='documentation.read')result=service.read({id:request.id,...(request.language?{language:request.language}:{})});
  else return {ok:false,code:'FIXTURE_UNAVAILABLE'};
  calls.push({action:request.action,durationMs:performance.now()-started,bytes:Buffer.byteLength(JSON.stringify(result))});return {ok:true,result};
 });
 await page.addInitScript(()=>{window.studio={bootstrap:async()=>({language:'bilingual',revision:'0'.repeat(40),projectId:'settings',capability:'fixture',storage:'ready',origin:'default',version:'fixture',source:null,updatedAt:null}),sharedMode:async()=>({ok:true,result:{available:true,watching:true,configured:false,active:false,displayName:null,revision:null,credentialKind:null}}),request:async()=>({ok:false,code:'FIXTURE_UNAVAILABLE'}),onEvent:()=>()=>{},windowControl:async()=>true,operations:request=>window.__physicalDocumentation(request)};});
 page.on('pageerror',error=>console.log('Renderer exception: '+error.message));
 await page.goto('/');const app=page.locator('material-buildroot');await expect(app.locator('.images-workspace')).toBeVisible({timeout:45000});await app.evaluate(async el=>{el.setupDone=true;await el.updateComplete;});
 await page.evaluate(()=>{
  window.__helpWorkload={started:performance.now(),last:performance.now(),ticks:0,maxGap:0,longTasks:[]};
  window.__helpHeartbeat=setInterval(()=>{const now=performance.now(),m=window.__helpWorkload;m.maxGap=Math.max(m.maxGap,now-m.last);m.last=now;m.ticks++;},50);
  if(PerformanceObserver.supportedEntryTypes.includes('longtask')){window.__helpObserver=new PerformanceObserver(list=>window.__helpWorkload.longTasks.push(...list.getEntries().map(e=>e.duration)));window.__helpObserver.observe({type:'longtask'});}
 });
 await app.locator('header .menu').click();await app.locator('#navigation-dialog [data-primary="help"]').click();
 const reader=app.locator('operations-panel:not([hidden]) documentation-panel');
 await expect.poll(()=>reader.evaluate(el=>el.index?.articles.length),{timeout:60000}).toBe(index.articles.length);
 await expect.poll(()=>reader.evaluate(el=>!el.loading&&el.bodyState!=='loading'),{timeout:60000}).toBe(true);
 await reader.evaluate(async el=>{await el.updateComplete;await Promise.all([...el.shadowRoot.querySelectorAll('md-text-button,md-icon-button,md-outlined-text-field')].map(control=>control.updateComplete));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
 return {app,reader,index,service,calls,manifest,manifestSha256:createHash('sha256').update(manifestBytes).digest('hex')};
}

test.use({viewport:{width:480,height:320},deviceScaleFactor:2,colorScheme:'dark',reducedMotion:'reduce'});
test('physical bundle initial Help workload is bounded and body text stays lazy',async({page},testInfo)=>{
 test.setTimeout(90000);const fixture=await physicalReader(page);
 const browser=await fixture.reader.evaluate(el=>{
  let elements=0;const visit=root=>{for(const node of root.querySelectorAll('*')){elements++;if(node.shadowRoot)visit(node.shadowRoot);}};visit(el.shadowRoot);
  const m=window.__helpWorkload;clearInterval(window.__helpHeartbeat);window.__helpObserver?.disconnect();
  return {articles:el.index.articles.length,topicButtons:el.shadowRoot.querySelectorAll('.topic').length,homeCards:el.shadowRoot.querySelectorAll('.task').length,materialControls:el.shadowRoot.querySelectorAll('md-text-button,md-icon-button,md-outlined-button,md-filled-button,md-outlined-text-field').length,shadowElements:elements,elapsedMs:performance.now()-m.started,heartbeatTicks:m.ticks,maxHeartbeatGapMs:m.maxGap,longTasks:m.longTasks,bodyState:el.bodyState};
 });
 const result={manifestSha256:fixture.manifestSha256,manifestDocuments:fixture.manifest.documents.length,serviceEntries:fixture.index.articles.length,calls:fixture.calls,browser};
 await testInfo.attach('physical-help-workload',{body:JSON.stringify(result),contentType:'application/json'});
 console.log(JSON.stringify(result));
 expect(browser.articles).toBe(fixture.index.articles.length);expect(browser.topicButtons).toBeLessThanOrEqual(24);expect(browser.homeCards).toBeLessThanOrEqual(8);
 expect(fixture.calls.filter(c=>c.action==='documentation.searchText')).toHaveLength(0);
});


test('physical bundle pagination exposes every admitted article and reference page',async({page})=>{
 test.setTimeout(90000);const f=await physicalReader(page),reader=f.reader,seen=[];
 for(let step=0;step<50;step++){
  const ids=await reader.locator('.topic').evaluateAll(elements=>elements.map(el=>el.dataset.articleId));expect(ids.length).toBeLessThanOrEqual(24);seen.push(...ids);
  const next=reader.locator('[data-article-page="next"]');if(await next.evaluate(el=>el.disabled))break;await next.click();
 }
 expect(seen).toEqual(f.index.articles.map(article=>article.id));expect(new Set(seen).size).toBe(f.index.articles.length);
 expect(f.calls.filter(call=>call.action==='documentation.searchText')).toHaveLength(0);
 const category=f.index.navigation.categories.find(item=>item.name==='Source references');expect(category).toBeTruthy();
 await reader.locator('#documentation-category').click();const picker=page.locator('searchable-picker').filter({has:page.locator('md-dialog[open]')});await picker.locator('settings-search').getByRole('textbox').fill(category.name);await picker.locator('[data-option]').click();
 expect(await reader.evaluate(el=>el.articlePage)).toBe(0);
 const references=[];for(let step=0;step<50;step++){references.push(...await reader.locator('.topic').evaluateAll(elements=>elements.map(el=>el.dataset.articleId)));const next=reader.locator('[data-article-page="next"]');if(await next.evaluate(el=>el.disabled))break;await next.click();}
 expect(references).toEqual(f.index.articles.filter(article=>article.category===category.name).map(article=>article.id));
 const reference=f.index.articles.find(article=>article.category===category.name&&/\[2\//.test(article.title));expect(reference).toBeTruthy();
 await reader.evaluate((el,id)=>el.openArticle(id),reference.id);await expect(reader.locator('.article')).toContainText(reference.title);expect(await reader.evaluate(el=>el.document.article.id)).toBe(reference.id);
 const before=await reader.evaluate(el=>({history:el.history,cursor:el.cursor,category:el.category,page:el.articlePage}));
 await f.app.locator('header .menu').click();await f.app.locator('#navigation-dialog [data-primary="images"]').click();await f.app.locator('header .menu').click();await f.app.locator('#navigation-dialog [data-primary="help"]').click();
 expect(await reader.evaluate(el=>({history:el.history,cursor:el.cursor,category:el.category,page:el.articlePage}))).toEqual(before);
 expect(f.calls.filter(call=>call.action==='documentation.searchText')).toHaveLength(0);
});

test('physical body search loads once on demand and clearing restores the complete index',async({page})=>{
 test.setTimeout(90000);const f=await physicalReader(page),reader=f.reader;
 const bodies=f.service.searchText(),metadata=f.index.articles.map(article=>[article.title,article.category,article.summary].join(' ').toLowerCase());
 let phrase='';for(const entry of bodies.entries){const words=entry.text.split(/\s+/);for(let i=60;i<Math.min(words.length-7,200);i+=7){const candidate=words.slice(i,i+7).join(' ');if(candidate.length>35&&candidate.length<120&&!metadata.some(text=>text.includes(candidate.toLowerCase()))){phrase=candidate;break;}}if(phrase)break;}
 expect(phrase).not.toBe('');expect(f.calls.filter(call=>call.action==='documentation.searchText')).toHaveLength(0);
 const search=reader.locator('.search > md-outlined-text-field').getByRole('textbox');await search.fill(phrase);
 await expect.poll(()=>reader.evaluate(el=>el.bodyState),{timeout:15000}).toBe('ready');
 const bodyMap=new Map(bodies.entries.map(entry=>[entry.id,entry.text]));const expected=f.index.articles.filter(article=>[article.title,article.category,article.summary,bodyMap.get(article.id)||''].join(' ').slice(0,70000).toLowerCase().includes(phrase.toLowerCase())).map(article=>article.id);
 expect(await reader.evaluate(el=>[...el.matchedIds])).toEqual(expected);expect(expected.length).toBeGreaterThan(0);expect(f.calls.filter(call=>call.action==='documentation.searchText')).toHaveLength(1);
 await search.fill('');await expect(reader.locator('.topic')).toHaveCount(Math.min(24,f.index.articles.length));expect(await reader.evaluate(el=>el.matchedIds===undefined)).toBe(true);
 await search.fill(f.index.articles.at(-1).title);expect(f.calls.filter(call=>call.action==='documentation.searchText')).toHaveLength(1);
 const before=await reader.evaluate(el=>({query:el.query,pattern:el.pattern,flags:el.flags,page:el.articlePage}));
 await f.app.locator('header .menu').click();await f.app.locator('#navigation-dialog [data-primary="images"]').click();await f.app.locator('header .menu').click();await f.app.locator('#navigation-dialog [data-primary="help"]').click();
 expect(await reader.evaluate(el=>({query:el.query,pattern:el.pattern,flags:el.flags,page:el.articlePage}))).toEqual(before);
});
