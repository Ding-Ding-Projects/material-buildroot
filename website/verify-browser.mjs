import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(here);
const target=process.env.DOCS_TEST_URL || 'http://127.0.0.1:8765/material-buildroot/';
const endpoint=new URL(target);
if(!['127.0.0.1','localhost','ding-ding-projects.github.io'].includes(endpoint.hostname))throw new Error('Unexpected documentation test target');
const publicBase='/material-buildroot/';
// Keep exploratory captures outside tracked source inputs to avoid invalidating the build.
const out=path.resolve(process.env.DOCS_EVIDENCE_DIR || path.join(root,'.cache','browser-evidence'));
const outputRoot=path.resolve(process.env.DOCS_OUTPUT_ROOT || path.join(root,'docs'));
await fs.mkdir(out,{recursive:true});
const meta=JSON.parse(await fs.readFile(path.join(outputRoot,'site/build-info.json'),'utf8'));
const inventory=JSON.parse(await fs.readFile(path.join(outputRoot,'site/document-inventory.json'),'utf8'));
const roadmap=JSON.parse(await fs.readFile(path.join(outputRoot,'site/roadmap.json'),'utf8'));
const errors=[];
const proxyServer=process.env.DOCS_BROWSER_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy;
const browser=await chromium.launch({headless:true,executablePath:process.env.DOCS_CHROMIUM_PATH || undefined,...(proxyServer?{proxy:{server:proxyServer,bypass:'127.0.0.1,localhost'}}:{})});
const receipt={schema:1,scope:'Initial documentation site only; no desktop, full shared feature parity, native host or companion proof.',route:endpoint.hostname==='ding-ding-projects.github.io'?'public-github-pages':'local-headless-chromium',browser:browser.version(),built_at:meta.built_at,input_snapshot_sha256:meta.input_snapshot_sha256,base_commit:meta.base_commit,inputs_differ_from_base:meta.inputs_differ_from_base,checks:[],captures:[]};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
receipt.artifacts={html_sha256:sha(await fs.readFile(path.join(outputRoot,'index.html'))),javascript_sha256:sha(await fs.readFile(path.join(outputRoot,'site/assets/app.js'))),css_sha256:sha(await fs.readFile(path.join(outputRoot,'site/assets/app.css')))};
const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1,colorScheme:'light'});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`)});
async function chooseLanguage(value){
 if(await page.locator('#language').evaluate(e=>e.value)===value)return;
 await Promise.all([
  page.locator('#language').evaluate(e=>new Promise(resolve=>e.addEventListener('opened',()=>resolve(true),{once:true}))),
  page.locator('#language').click()
 ]);
 await Promise.all([
  page.locator('#language').evaluate(e=>new Promise(resolve=>e.addEventListener('closed',()=>resolve(true),{once:true}))),
  page.locator('md-select-option[value="'+value+'"]').click()
 ]);
}
async function chooseM3(locator,value){
 if(await locator.evaluate(element=>element.value)===value)return;
 await Promise.all([locator.evaluate(element=>new Promise(resolve=>element.addEventListener('opened',()=>resolve(true),{once:true}))),locator.click()]);
 await Promise.all([locator.evaluate(element=>new Promise(resolve=>element.addEventListener('closed',()=>resolve(true),{once:true}))),page.locator('md-select-option[value="'+value+'"]').click()]);
}
async function ready(){await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('*')].filter(e=>e.localName.startsWith('md-')).map(e=>customElements.whenDefined(e.localName)));await Promise.all([...document.querySelectorAll('*')].filter(e=>e.updateComplete).map(e=>e.updateComplete));await document.fonts.ready;});}
async function capture(name){const file=path.join(out,name+'.png');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:file,fullPage:true});receipt.captures.push({file:path.relative(root,file).split(path.sep).join('/'),sha256:sha(await fs.readFile(file)),route:new URL(page.url()).pathname,viewport:page.viewportSize(),theme:await page.getAttribute('html','data-theme'),language:await page.getAttribute('html','data-language')});}
try{
 const homeResponse=await page.goto(target);assert.equal(homeResponse.status(),200);await ready();
 assert.equal(sha(await homeResponse.body()),receipt.artifacts.html_sha256,'Served HTML must match the selected output');
 const beginner=page.locator('#beginner-guide');
 await beginner.locator('[data-choice="iso"]').click();
 await beginner.getByRole('button',{name:/^Next/}).click();
 await beginner.locator('[data-choice="docker"]').click();
 assert.match(await beginner.innerText(),/admitted image/);
 await beginner.getByRole('button',{name:/^Next/}).click();
 await beginner.locator('[data-choice="output"]').click();
 assert.match(await beginner.locator('#beginner-field-detail').innerText(),/images\/rootfs.iso9660/);
 await page.reload();await ready();
 assert.match(await beginner.locator('#beginner-position').innerText(),/Step 3 of 4/);
 assert.equal(await beginner.locator('[data-choice="output"]').getByRole('button').getAttribute('aria-pressed'),'true');
 await beginner.getByRole('button',{name:/^Next/}).click();
 assert.match(await beginner.innerText(),/Prepare an ISO image.*Docker Linux container/s);
 assert.match(await beginner.innerText(),/not yet verified/);
 await beginner.locator('[data-choice="read"]').focus();await page.keyboard.press('Enter');
 assert.match(await beginner.locator('[data-choice="read"]').innerText(),/Reading saved/);
 await chooseLanguage('zh');assert.match(await beginner.innerText(),/下一小步/);
 await chooseLanguage('both');
 await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await beginner.evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,'Beginner guidance must fit at 320px');
 await capture('beginner-bilingual-320');
 await beginner.getByRole('button',{name:/^Start this introduction again/}).click();
 assert.equal(await beginner.locator('[data-choice="learn"]').getByRole('button').getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:1440,height:1100});await page.emulateMedia({reducedMotion:'no-preference'});
 receipt.checks.push('Beginner guidance: runtime/image explanations, keyboard reading action, local reload persistence, reset, Cantonese and bilingual copy, reduced-motion 320px container. No desktop execution claimed.');
 for(const [key,relative] of Object.entries({javascript_sha256:'site/assets/app.js',css_sha256:'site/assets/app.css'})){
  const response=await context.request.get(new URL(relative,target).href);
  assert.equal(response.status(),200);
  assert.equal(sha(await response.body()),receipt.artifacts[key],`Served ${relative} must match the selected output`);
 }
 receipt.checks.push('Served HTML, JavaScript and CSS match the exact selected build output.');
 assert.equal(await page.locator('#learning-workspace').count(),1);
 for(const mode of ['en','zh','both']){
  await chooseLanguage(mode);
  for(const [selector,en,zh] of [['.learning-jump','Learning activities','學習活動'],['#walkthrough-rail','Workflow steps','工作流程步驟']]){
   assert.equal(await page.locator(selector).getAttribute('aria-label'),mode==='en'?en:mode==='zh'?zh:`${en} · ${zh}`);
   assert.doesNotMatch(await page.locator(selector).innerText(),/">/);
  }
 }
 receipt.checks.push('Learning navigation and workflow rail use plain accessible names in all three language modes without stray markup.');
 assert.equal(await page.locator('.article, .product-preview').count(),0,'The homepage is a learning workspace, not a Markdown browser or stale screenshot gallery');
 assert.match(await page.locator('main').innerText(),/package recipe|套件配方/);
 assert.match(await page.locator('main').innerText(),/never inspect your computer|不會檢查你嘅電腦/);
 assert.match(await page.locator('#walkthrough-step-title').innerText(),/Choose a source and review the consent boundary.*選擇來源並了解確認界線/);
 await page.locator('#walkthrough-complete').click();
 assert.match(await page.locator('#learning-progress-label').innerText(),/1 of 22 guide steps completed/);
 await page.locator('#walkthrough-next').click();
 assert.match(await page.locator('#walkthrough-step-title').innerText(),/Keep source, build output/);
 await page.reload();await ready();
 assert.match(await page.locator('#walkthrough-step-title').innerText(),/Keep source, build output/,'Walkthrough position persists in this browser');
 assert.match(await page.locator('#learning-progress-label').innerText(),/1 of 22 guide steps completed/);
 assert.equal(await page.locator('#recipe-output').isVisible(),true);
 assert.match(await page.locator('#recipe-code').innerText(),/SAMPLELIB_SITE_METHOD = https/);
 await page.locator('#recipe-name').locator('input').fill('<img src=x onerror=alert(1)>');
 await page.locator('#recipe-generate').click();
 assert.equal(await page.locator('#recipe-output').isHidden(),true);
 assert.match(await page.locator('#recipe-status').innerText(),/lowercase identifier/);
 await page.locator('#recipe-name').locator('input').fill('safe_pkg');
 await page.locator('#recipe-generate').click();
 assert.match(await page.locator('#recipe-code').innerText(),/SAFE_PKG_VERSION = 1.2.3/);
 assert.doesNotMatch(await page.locator('main').innerText(),/<img src=x/);
 assert.equal(await page.locator('#workflow-guides').count(),1);
 assert.deepEqual(await page.locator('.learning-jump a').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),['#source-walkthrough','#recipe-lab','#troubleshooter','#workflow-guides','#saved-references'],'Jump guide order follows the rendered activity order');
 await chooseM3(page.locator('#workflow-family'),'vocabulary');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/does not accept or inspect vocabulary files/);
 await chooseM3(page.locator('#workflow-stage'),'replace');
 assert.match(await page.locator('#workflow-stage-next').innerText(),/mappings, counts and hashes are excluded/);
 await chooseM3(page.locator('#workflow-stage'),'clear');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/suppress.*as soon as you choose Clear/);
 assert.match(await page.locator('#workflow-stage-body').innerText(),/disables further vocabulary changes until a full app reload/);
 assert.match(await page.locator('#workflow-stage-next').innerText(),/previous selection may become active again/);
 await chooseM3(page.locator('#workflow-stage'),'shared-unknown');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/Unavailable is not the same as inactive/);
 await chooseM3(page.locator('#workflow-family'),'shared');
 await chooseM3(page.locator('#workflow-stage'),'enter');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/does not prove a future exit credential check/);
 await chooseM3(page.locator('#workflow-stage'),'verified-exit');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/supports shared PIN or password verification\. Passkey verification is not available/);
 assert.match(await page.locator('#workflow-stage-next').innerText(),/confirmed state/);
 assert.match(await page.locator('#workflow-stage-next').innerText(),/use the documented manual recovery route/);
 await chooseM3(page.locator('#workflow-stage'),'recovery');
 assert.match(await page.locator('#workflow-stage-next').innerText(),/not proof of a successful exit/);
 await chooseM3(page.locator('#workflow-family'),'queue');
 await chooseM3(page.locator('#workflow-stage'),'blocked-intent');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/not evidence of a successful build/);
 await chooseM3(page.locator('#workflow-stage'),'reauthorize');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/Persisted descriptors are not fresh filesystem grants/);
 await chooseM3(page.locator('#workflow-stage'),'quarantine');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/durable quarantine/);
 await page.locator('#workflow-complete').click();
 assert.match(await page.locator('#learning-progress-label').innerText(),/2 of 22 guide steps completed/);
 await page.reload();await ready();
 assert.equal(await page.locator('#workflow-family').evaluate(element=>element.value),'queue');
 assert.equal(await page.locator('#workflow-stage').evaluate(element=>element.value),'quarantine');
 assert.match(await page.locator('#workflow-status').innerText(),/Progress is stored in this browser only/);
 await chooseM3(page.locator('#workflow-family'),'catalogue');
 await chooseM3(page.locator('#workflow-stage'),'observed');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/not an authoritative complete or simultaneous inventory/);
 await chooseM3(page.locator('#workflow-stage'),'refresh');
 assert.match(await page.locator('#workflow-stage-next').innerText(),/exhaustive=false and metadataComplete=false/);
 await chooseM3(page.locator('#workflow-stage'),'cancel');
 assert.match(await page.locator('#workflow-stage-next').innerText(),/CATALOGUE_COMMIT_IN_PROGRESS/);
 await chooseM3(page.locator('#workflow-stage'),'unknown-metadata');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/Missing exact size.*remains unknown/);
 for(const family of await page.locator('#workflow-family md-select-option').evaluateAll(options=>options.map(option=>option.value))){
  await chooseM3(page.locator('#workflow-family'),family);
  for(const stage of await page.locator('#workflow-stage md-select-option').evaluateAll(options=>options.map(option=>option.value))){
   await chooseM3(page.locator('#workflow-stage'),stage);
   const reference=await page.locator('#workflow-reference').getAttribute('href');
   assert.ok(inventory.some(article=>article.url===reference),'Every dynamic supporting link must match the selected build inventory');
   const response=await context.request.get(new URL(reference,target).href);assert.equal(response.status(),200);
  }
 }
 receipt.checks.push('Every workflow stage supporting article matches the build inventory and returns HTTP 200.');
 await chooseLanguage('zh');
 await chooseM3(page.locator('#workflow-family'),'vocabulary');
 await chooseM3(page.locator('#workflow-stage'),'clear');
 assert.match(await page.locator('#workflow-stage-title').innerText(),/清除本機詞彙/);
 assert.match(await page.locator('#workflow-stage-body').innerText(),/即時停止套用/);
 assert.match(await page.locator('#workflow-stage-next').innerText(),/之前嘅選取可能會再次啟用/);
 await chooseM3(page.locator('#workflow-family'),'shared');
 await chooseM3(page.locator('#workflow-stage'),'verified-exit');
 assert.match(await page.locator('#workflow-stage-body').innerText(),/尚未提供通行密鑰驗證/);
 assert.match(await page.locator('#workflow-stage-next').innerText(),/手動復原途徑/);
 await chooseLanguage('both');
 await page.locator('#troubleshooter-reset').click();
 await page.locator('#troubleshooter-choices md-outlined-button').last().click();
 assert.match(await page.locator('#troubleshooter-question').innerText(),/separate writable build-output directory/);
 await page.locator('#troubleshooter-choices md-outlined-button').last().click();
 assert.match(await page.locator('#troubleshooter-result').innerText(),/No system checks were made/);
 await page.goto(new URL('site/articles/docs/desktop/configuration.html',target).href);await ready();
 await page.locator('.article-bookmark').click();
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('mb-learning-workspace-v1')))).bookmarks[0].title, 'Configuration service');
 await page.goto(target);await ready();
 assert.match(await page.locator('#learning-bookmarks').innerText(),/Configuration service/);
 await page.locator('#learning-bookmarks md-outlined-button').click();
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('mb-learning-workspace-v1')))).bookmarks.length,0);
 await page.goto(new URL('site/status.html',target).href);await ready();
 assert.equal(await page.locator('md-filled-button').first().getAttribute('href'),'https://github.com/Ding-Ding-Projects/material-buildroot/releases/latest');
 assert.match(await page.locator('main').innerText(),/Native Windows\/Electron acceptance.*unverified/);
 assert.match(await page.locator('main').innerText(),/Archived v0.1.0 desktop-shell evidence/);
 await page.goto(target);await ready();
 receipt.checks.push('Interactive guides persist browser-owned progress and cover vocabulary import/replace/clear plus unavailable shared state, verified shared-preference exit/recovery, queued intent/reauthorization/runtime quarantine, and observed non-exhaustive catalogue refresh/cancel/unknown metadata in English and Cantonese. All examples are local visitor explanations with no secrets, private vocabulary payloads or desktop execution.');
 let companionSequence=1;const companionRequests=[];
 await context.route('https://192.168.1.20:8443/**',async route=>{
  const request=route.request(),url=new URL(request.url()),origin=new URL(target).origin;
  const requestBody=request.postData()?request.postDataJSON():null;
  companionRequests.push({path:url.pathname,method:request.method(),body:requestBody,headers:request.headers()});
  const cors={'access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'POST','access-control-allow-headers':'content-type,x-csrf-token','access-control-allow-private-network':'true','vary':'Origin'};
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
  const body=requestBody;let payload={};
  if(url.pathname==='/pair')payload={csrfToken:'fixture-csrf-token-not-for-storage',nextSequence:1,session:{id:'46ac4318-4a7e-4813-9d08-f2d61691bf90',origin,scopes:['workspace:read','projects:read','jobs:read'],expiresAt:Date.now()+3600000,status:'active'}};
  else if(url.pathname==='/session')payload={nextSequence:companionSequence,session:{id:'46ac4318-4a7e-4813-9d08-f2d61691bf90',origin,scopes:['workspace:read','projects:read','jobs:read'],expiresAt:Date.now()+3600000,status:'active'}};
  else if(url.pathname==='/actions'){
   companionSequence=body.sequence+1;
   const result=body.action==='workspace.read'?{ok:true,state:{plans:[{name:'Fixture plan',runtime:'wsl',target:'image',status:'draft',notes:'fixture-private-note'}],preferences:{theme:'dark'},onboardingCompleted:false}}:body.action==='projects.list'?[{id:'fixture-project',name:'Fixture project',root:'/private/host/path',authorized:true}]:[{id:'fixture-job',kind:'build',state:'running',updatedAt:new Date().toISOString(),logs:['fixture-private-log']}];
   payload={nextSequence:companionSequence,operation:{action:body.action,state:'succeeded'},result};
  } else if(url.pathname==='/disconnect')payload={revoked:true,session:{id:'46ac4318-4a7e-4813-9d08-f2d61691bf90',status:'revoked'}};
  else {await route.fulfill({status:404,headers:cors,body:'{}'});return;}
  await route.fulfill({status:200,headers:{...cors,'content-type':'application/json','set-cookie':'__Host-material-companion=fixture; Path=/; Secure; HttpOnly; SameSite=None'},body:JSON.stringify(payload)});
 });
 await page.goto(new URL('site/visitor.html',target).href);await ready();
 assert.equal(await page.locator('#visitor-workspace').count(),1);
 assert.match(await page.locator('#companion-title').innerText(),/Connect to your desktop/);
 await chooseLanguage('zh');
 assert.equal(await page.locator('#visitor-goal').evaluate(field=>field.label),'你想了解或完成啲乜？');
 await page.locator('[data-plan-prompt]').first().click();
 assert.equal(await page.locator('#visitor-goal').locator('input').inputValue(),'查看 PH09 訪客工作區工作');
 await chooseLanguage('both');
 await page.locator('#companion-endpoint').locator('input').fill('https://8.8.8.8:8443');
 await page.locator('#companion-save-endpoint').click();
 assert.match(await page.locator('#companion-message').innerText(),/private IP/);
 await page.locator('#companion-endpoint').locator('input').fill('https://192.168.1.20:8443');
 await page.locator('#companion-save-endpoint').click();
 await page.locator('#companion-challenge').locator('textarea').fill('c'.repeat(43));
 await page.locator('#companion-pair').click();
 await page.waitForFunction(()=>document.querySelector('#companion-message').textContent.includes('Paired.'),null,{timeout:10000});
 assert.equal(await page.locator('#companion-connected').isVisible(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('mb-companion-endpoint-v1')),'https://192.168.1.20:8443');
 assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>value==='fixture-csrf-token-not-for-storage')),false);
 await page.locator('[data-companion-action="workspace.read"]').click();
 await page.waitForFunction(()=>document.querySelector('#companion-data').textContent.includes('Fixture plan'));
 assert.doesNotMatch(await page.locator('#companion-data').innerText(),/fixture-private-note|raw JSON/i);
 await chooseLanguage('zh');
 assert.match(await page.locator('#companion-session-details').innerText(),/網站來源/);
 assert.match(await page.locator('#companion-data').innerText(),/已儲存計劃/);
 await chooseLanguage('both');
 await page.locator('[data-companion-action="projects.list"]').click();
 await page.waitForFunction(()=>document.querySelector('#companion-data').textContent.includes('Fixture project'));
 assert.doesNotMatch(await page.locator('#companion-data').innerText(),/\/private\/host\/path/);
 await page.locator('[data-companion-action="jobs.list"]').click();
 await page.waitForFunction(()=>document.querySelector('#companion-data').textContent.includes('build · running'));
 assert.doesNotMatch(await page.locator('#companion-data').innerText(),/fixture-private-log/);
 await page.locator('#companion-refresh').click();
 await page.waitForFunction(()=>document.querySelector('#companion-message').textContent.includes('Session status refreshed'));
 await page.locator('#companion-disconnect').click();
 await page.waitForFunction(()=>document.querySelector('#companion-message').textContent.includes('revoked this browser session'));
 assert.equal(await page.locator('#companion-connected').isHidden(),true);
 assert.ok(companionRequests.some(item=>item.path==='/pair'&&item.body?.challenge==='c'.repeat(43)));
 assert.ok(companionRequests.some(item=>item.path==='/actions'&&item.body?.args&&Object.keys(item.body.args).length===0));
 assert.ok(companionRequests.some(item=>item.path==='/disconnect'&&item.body&&Object.keys(item.body).length===0));
 receipt.checks.push('Companion protocol fixture verifies private-IP validation, manual challenge pairing, bounded read-only request shapes, memory-only CSRF state, safe workspace/project/job summaries, session refresh and server-confirmed disconnect. This fixture does not establish real TLS/LAN acceptance.');
 await page.locator('#visitor-goal').locator('input').fill('Review the visitor roadmap');
 await page.locator('#visitor-notes').locator('textarea').fill('Keep this note in the browser profile.');
 await page.locator('[data-check="read-roadmap"]').click();
 let localVisitor=await page.evaluate(()=>JSON.parse(localStorage.getItem('mb-visitor-workspace-v1')));
 assert.equal(localVisitor.goal,'Review the visitor roadmap');assert.equal(localVisitor.notes,'Keep this note in the browser profile.');assert.equal(localVisitor.checks['read-roadmap'],true);
 await page.reload();await ready();
 assert.equal(await page.locator('#visitor-goal').locator('input').inputValue(),'Review the visitor roadmap');
 assert.equal(await page.locator('#visitor-notes').locator('textarea').inputValue(),'Keep this note in the browser profile.');
 await page.locator('#visitor-import-json').locator('textarea').fill('{invalid');
 await page.locator('#visitor-import').click();
 assert.match(await page.locator('#visitor-message').innerText(),/not valid/);
 assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('mb-visitor-workspace-v1')))).goal,'Review the visitor roadmap','Invalid backup must leave current local work unchanged');
 const validBackup={version:1,goal:'Read the phase record',notes:'Restore verified content.',checks:{'read-roadmap':true,'check-evidence':false,'write-notes':true},updatedAt:null,exportedAt:new Date().toISOString()};
 await page.locator('#visitor-import-json').locator('textarea').fill(JSON.stringify(validBackup));
 await page.locator('#visitor-import').click();
 assert.match(await page.locator('#visitor-message').innerText(),/validated and imported/);
 assert.equal(await page.locator('#visitor-goal').locator('input').inputValue(),validBackup.goal);
 const [backupDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#visitor-export').click()]);
 assert.equal(backupDownload.suggestedFilename(),'material-buildroot-visitor-workspace.json');
 await page.locator('#visitor-offline').click();
 await page.waitForFunction(()=>document.querySelector('#visitor-offline-status').textContent.includes('saved for offline reading'),null,{timeout:30000});
 assert.match(await page.locator('#visitor-offline-status').innerText(),/saved for offline reading/);
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await context.setOffline(true);
 const offlineArticle=await page.goto(new URL('site/articles/docs/planning/surfaces.html',target).href);
 assert.equal(offlineArticle.status(),200,'Cached article navigation should work without a network connection');
 assert.match(await page.locator('article').innerText(),/Public documentation visitor surface/);
 await context.setOffline(false);
 receipt.checks.push('Visitor workbench persists a private plan, checklist and notes; malformed imports preserve existing data, valid backups restore state, export downloads JSON, and opt-in offline caching serves an article after network disconnect. A separate protocol fixture covers the opted-in read-only companion contract but does not establish real TLS/LAN acceptance.');
 await page.goto(target);await ready();
 await page.locator('nav[aria-label="Main navigation"] md-list-item[href="'+publicBase+'site/roadmap.html"]').click();await ready();
 assert.match(page.url(),/site\/roadmap\.html$/);
 assert.ok(await page.locator('.category-card').count()>0);
 await page.locator('.category-card md-list-item').first().click();await ready();
 const phaseIds=await page.locator('.phase-link').evaluateAll(links=>links.map(link=>link.getAttribute('href').split('/').pop().replace('.html','').toUpperCase()));
 const categoryPhases=phaseIds.map(id=>{const phase=roadmap.phases.find(p=>p.id===id);assert.ok(phase,`Unknown phase ${id}`);return phase;});
 assert.ok(categoryPhases.length>0);
 for(const status of ['planned','started','complete','all']){
  await page.locator('[data-phase-filter="'+status+'"]').click();
  const expected=status==='all'?categoryPhases:categoryPhases.filter(p=>p.status===status);
  assert.equal(await page.locator('.phase:not([hidden])').count(),expected.length,`Phase filter ${status}`);
 }
 await page.locator('.phase-link').first().click();await ready();
 const firstPhase=categoryPhases[0];
 assert.equal(new URL(page.url()).pathname,publicBase+'site/phases/'+firstPhase.id.toLowerCase()+'.html');
 assert.equal(await page.locator('.task-mark').count(),firstPhase.tasks.length);
 for(const task of firstPhase.tasks)assert.ok((await page.locator('article').innerText()).includes(task.id));
 const nextPhase=roadmap.phases[roadmap.phases.findIndex(p=>p.id===firstPhase.id)+1];
 if(nextPhase){
  await page.locator('.phase-pagination md-filled-button').click();await ready();
  assert.equal(new URL(page.url()).pathname,publicBase+'site/phases/'+nextPhase.id.toLowerCase()+'.html');
  await page.locator('.phase-pagination md-outlined-button').click();await ready();
  assert.equal(new URL(page.url()).pathname,publicBase+'site/phases/'+firstPhase.id.toLowerCase()+'.html');
 }
 receipt.checks.push('Short overview links to roadmap categories, filtered phase summaries and separate phase checklists with working previous/next navigation.');
 await page.locator('#doc-search').locator('input').fill('build');
 const searchTotal=await page.evaluate(()=>JSON.parse(document.querySelector('#document-index').textContent).filter(d=>(d.title+' '+d.text).toLowerCase().includes('build')).length);
 assert.equal(await page.locator('#search-results md-list-item').count(),Math.min(12,searchTotal));
 assert.ok((await page.locator('.search-count').innerText()).startsWith(searchTotal+' matching '));
 if(searchTotal>12)assert.match(await page.locator('.search-count').innerText(),/showing the first 12/);
 await page.locator('#doc-search').locator('input').press('ArrowDown');
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#search-results md-list-item')),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#search-results').isHidden(),true);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'doc-search');
 await page.locator('#doc-search').locator('input').fill('Kconfig');
 await page.mouse.click(1430,1090);
 assert.equal(await page.locator('#search-results').isHidden(),true);
 await page.locator('#doc-search').locator('input').focus();
 assert.equal(await page.locator('#search-results').isHidden(),false);
 assert.ok(await page.locator('#search-results md-list-item').count()>0);
 await page.locator('#search-results md-list-item').first().click();
 assert.equal(await page.locator('article').count(),1);
 assert.ok((await page.locator('article').innerText()).length>100);
 receipt.checks.push('Document search reports the full match count, caps results truthfully, supports keyboard focus and Escape/outside dismissal, and opens a complete article.');
 await page.goto(target);await ready();
 await page.locator('#theme').click();
 assert.equal(await page.getAttribute('html','data-theme'),'dark');
 await chooseLanguage('en');
 await page.reload();await ready();
 assert.equal(await page.getAttribute('html','data-theme'),'dark');
 assert.equal(await page.getAttribute('html','data-language'),'en');
 await capture('home-desktop-dark');
 receipt.checks.push('Heading language and explicit theme preferences survive reload; fresh system theme is light in this test context.');
 await chooseLanguage('both');
 await page.locator('#system-theme').click();
 assert.equal(await page.getAttribute('html','data-theme'),'light');
 await capture('home-desktop');
 const geometry=[];
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  for(const language of ['both','en','zh']){
   await chooseLanguage(language);
   const sizes=await page.evaluate(()=>{
    const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    return {width:innerWidth,document:document.documentElement.scrollWidth,family:box('#workflow-family'),situation:box('#workflow-stage'),detail:box('#workflow-guidance')};
   });
   assert.ok(sizes.document<=sizes.width,`Horizontal overflow at ${width}/${language}: ${sizes.document}`);
   assert.ok(sizes.family.left>=0&&sizes.family.right<=width+1&&sizes.situation.left>=0&&sizes.situation.right<=width+1&&sizes.detail.left>=0&&sizes.detail.right<=width+1,`Workflow controls and explanation stay within ${width}px/${language}`);
   if(width<=700){assert.ok(sizes.family.bottom+4<=sizes.situation.top+1,`Workflow selectors stack without overlap at ${width}px/${language}`);assert.ok(sizes.situation.bottom+8<=sizes.detail.top+1,`Workflow selectors do not overlap the explanation at ${width}px/${language}`);}
   else assert.ok(sizes.family.right+8<=sizes.situation.left+1,`Workflow selectors stay side-by-side without overlap at ${width}px/${language}`);
   geometry.push({width,language,document_width:sizes.document});
  }
 }
 receipt.geometry=geometry;
 const expectedStepNames=[['Choose a source and review the consent boundary','選擇來源並了解確認界線'],['Keep source, build output and artifacts distinct','分開來源、建置輸出與產物'],['Discover a runtime before choosing a build','選擇建置前先確認執行環境'],['Treat configuration as typed, reviewable input','把配置視為可審核的型別化輸入'],['Review the job and its evidence','檢視工作狀態和證據']];
 for(const width of [1440,320]){
  await page.setViewportSize({width,height:1050});await chooseLanguage('both');await ready();
  const layout=await page.evaluate(()=>{
   const rect=element=>{const value=element.getBoundingClientRect();return {left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height};};
   const rail=document.querySelector('#walkthrough-rail'),detail=document.querySelector('.walkthrough-detail');
   return {rail:rect(rail),detail:rect(detail),steps:[...rail.querySelectorAll('md-outlined-button')].map(button=>({box:rect(button),accessibleName:button.getAttribute('aria-label'),fullName:button.title,label:(()=>{const node=button.shadowRoot?.querySelector('.label');return node?{scrollWidth:node.scrollWidth,clientWidth:node.clientWidth,rect:rect(node)}:null})()})),filledLabelColor:getComputedStyle(document.querySelector('.learning-intro md-filled-button .zh')).color};
  });
  assert.equal(layout.steps.length,5);
  assert.equal(layout.filledLabelColor,'rgb(255, 255, 255)','Bilingual filled-button supporting text must retain on-primary contrast');
  for(const [index,step] of layout.steps.entries()){
   assert.ok(step.accessibleName?.includes(expectedStepNames[index][0])&&step.accessibleName.includes(expectedStepNames[index][1]),'Compact step label must expose the complete bilingual step name to assistive technology');
   assert.ok(step.box.left>=layout.rail.left-1&&step.box.right<=layout.rail.right+1,`Step ${index+1} hit target must stay inside its rail at ${width}px`);
   assert.ok(step.label&&step.label.scrollWidth<=step.label.clientWidth+1,`Step ${index+1} visible label must fit without clipping at ${width}px`);
   if(width>950)assert.ok(step.box.right+8<=layout.detail.left+1,`Step ${index+1} hit target must not overlap the explanation panel at ${width}px`);
   else assert.ok(step.box.bottom+8<=layout.detail.top+1,`Stacked step ${index+1} hit target must finish before the explanation panel at ${width}px`);
  }
 }
 receipt.checks.push('Bilingual walkthrough rail buttons fit inside their rail without overlapping the explanation panel at desktop and 320px; full names remain accessible and filled-button Cantonese labels use on-primary white.');
 await page.setViewportSize({width:320,height:1000});await chooseLanguage('both');await ready();
 const workflowImage=path.join(out,'workflow-guide-bilingual-320.png');
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.screenshot({path:workflowImage,fullPage:true});
 receipt.captures.push({file:path.relative(root,workflowImage).split(path.sep).join('/'),sha256:sha(await fs.readFile(workflowImage)),route:new URL(page.url()).pathname,viewport:page.viewportSize(),theme:await page.getAttribute('html','data-theme'),language:await page.getAttribute('html','data-language'),scope:'complete page at 320px viewport'});
 await page.locator('#workflow-family').evaluate(element=>element.shadowRoot.querySelector('md-outlined-field').focus());
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('#workflow-family').evaluate(element=>element.shadowRoot.querySelector('md-outlined-field').getAttribute('aria-expanded')),'true','Workflow selector opens from the keyboard');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#workflow-family').evaluate(element=>element.shadowRoot.querySelector('md-outlined-field').getAttribute('aria-expanded')),'false','Escape closes the workflow selector');
 await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await page.evaluate(()=>({scroll:getComputedStyle(document.documentElement).scrollBehavior,transition:getComputedStyle(document.querySelector('#workflow-guidance')).transitionDuration}));
 assert.equal(reduced.scroll,'auto');assert.match(reduced.transition,/^(0s|0ms)(,\s*(0s|0ms))*$/);
 await page.emulateMedia({reducedMotion:'no-preference'});
 receipt.checks.push('Workflow selectors open and dismiss by keyboard, and reduced-motion preferences disable smooth scrolling and transitions.');
 receipt.checks.push('The new workflow selector and explanation stay inside the viewport and never overlap at desktop and narrow bilingual widths; a 320px bilingual interaction capture is retained.');
 await page.setViewportSize({width:390,height:844});
 await chooseLanguage('both');
 await page.locator('#menu').click();
 assert.equal(await page.locator('#menu').locator('button').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('.sidebar').evaluate(e=>e.inert),false);
 assert.equal(await page.locator('.skip').evaluate(e=>e.inert),true);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'close-menu');
 for(let index=0;index<4;index++)await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'close-menu','Tab must wrap inside the navigation drawer');
 await page.keyboard.press('Shift+Tab');
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('nav[aria-label="Contributor navigation"] md-list-item')),true,'Reverse Tab reaches the current contributor item');
 await page.keyboard.press('ArrowDown');
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('nav[aria-label="Contributor navigation"] md-list-item:last-child')),true,'Contributor list supports arrow navigation');
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'close-menu','Tab wraps after the newly selected contributor item');
 await page.keyboard.press('Shift+Tab');
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('nav[aria-label="Contributor navigation"] md-list-item:last-child')),true,'Reverse Tab preserves the current contributor item');
 await page.keyboard.press('Tab');
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('brand')),true);
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('nav[aria-label="Main navigation"] md-list-item')),true);
 await page.keyboard.press('ArrowDown');
 assert.equal(await page.evaluate(()=>document.activeElement===document.querySelectorAll('nav[aria-label="Main navigation"] md-list-item')[1]),true,'Main navigation supports arrow navigation');
 await page.setViewportSize({width:320,height:568});
 await page.locator('.sidebar md-list-item').last().scrollIntoViewIfNeeded();
 assert.ok(await page.locator('.sidebar').evaluate(e=>e.scrollHeight>e.clientHeight));
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#menu').locator('button').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('.sidebar').evaluate(e=>e.inert),true);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'menu');
 assert.equal(await page.locator('.skip').evaluate(e=>e.inert),false);
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.sidebar md-list-item').first().focus();
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.activeElement.id==='menu');
 assert.equal(await page.locator('.sidebar').evaluate(e=>e.inert),true);
 await page.setViewportSize({width:390,height:844});
 await capture('home-mobile');
 receipt.checks.push('Home fits 320/390/768/1440 CSS px in each offered heading-language mode; mobile navigation traps forward/reverse Tab, retains Material arrow navigation, and Escape closes it.');
 await page.setViewportSize({width:320,height:844});
 const routes=[];
 for(const doc of inventory){
  const destination=new URL(doc.url.slice(publicBase.length),target).href;
  const response=await page.goto(destination);await ready();
  assert.equal(response.status(),200);
  assert.ok((await page.locator('article').innerText()).includes(doc.title));
  const width=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(width.document<=width.viewport,`${doc.source} article overflows at mobile width`);
  routes.push({source:doc.source,status:response.status()});
 }
 receipt.document_routes=routes;
 receipt.checks.push(`All ${routes.length} current document routes render their complete article at mobile width without page overflow.`);
 const galleryUrl=new URL('site/articles/docs/evidence/modern-workspace/README.html',target).href;
 await page.setViewportSize({width:1440,height:1000});
 assert.equal((await page.goto(galleryUrl)).status(),200);await ready();
 const gallery=page.locator('article img');
 const galleryManifest=JSON.parse(await fs.readFile(path.join(outputRoot,'site/source-assets/docs/evidence/modern-workspace/current/captures.json'),'utf8'));
 assert.equal(await gallery.count(),galleryManifest.captures.length,'Current workspace evidence gallery must show every manifest capture');
 await page.waitForFunction(()=>[...document.querySelectorAll('article img')].every(image=>image.complete&&image.naturalWidth>0),null,{timeout:30000});
 assert.ok((await gallery.evaluateAll(images=>images.every(image=>image.alt.trim().length>0))),'Each current workspace capture must have useful alternative text');
 receipt.checks.push(`All ${galleryManifest.captures.length} manifest-listed current-workspace captures load in the evidence article and have alternative text. Captures remain source-preview evidence, not Windows runtime proof.`);
 await page.setViewportSize({width:320,height:844});
 const pageInventory=JSON.parse(await fs.readFile(path.join(outputRoot,'site/page-inventory.json'),'utf8'));
 const extraRoutes=pageInventory.filter(route=>!route.startsWith('site/articles/'));
 for(const route of extraRoutes){
  const relative=route==='index.html'?'':route;
  assert.equal((await page.goto(new URL(relative,target).href)).status(),200);await ready();
  assert.equal(await page.locator('main h1').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflows phone width');
 }
 receipt.navigation_routes=extraRoutes;
 receipt.checks.push('All '+extraRoutes.length+' overview/category/phase/status routes fit 320px and use real dedicated pages.');
 await page.goto(new URL('site/library.html',target).href);await ready();
 assert.equal(await page.locator('.category-card').count(),new Set(inventory.map(doc=>doc.category)).size);
 await page.locator('.category-card md-list-item').first().click();await ready();
 assert.match(page.url(),/site\/categories\/planning\.html$/);
 assert.ok(await page.locator('.library-item').count()>0);
 await page.goto(new URL('site/roadmap.html',target).href);await ready();
 await page.setViewportSize({width:1440,height:1100});
 await capture('roadmap-categories');
 await page.goto(new URL('site/phases/ph00.html',target).href);await ready();
 await page.setViewportSize({width:1440,height:1100});
 await capture('roadmap-article');
 assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>document.querySelectorAll('button, select, input, details, summary').length),0,'Native control substitutes in authored DOM, excluding genuine Material internals');
 const registered=await page.evaluate(()=>[...new Set([...document.querySelectorAll('*')].filter(e=>e.localName.startsWith('md-')).map(e=>e.localName))].every(name=>Boolean(customElements.get(name))));
 assert.ok(registered,'Material elements must be registered components');
 receipt.checks.push('All authored interactive controls use registered Material Web components; standard document hyperlinks remain semantic links.');
 receipt.checks.push('No browser JavaScript errors or HTTP asset/route failures observed.');
 receipt.verdict='passed';receipt.checked_at=new Date().toISOString();
 await fs.writeFile(path.join(out,'browser-check.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(`PASS: ${receipt.checks.length} interaction checks, ${receipt.document_routes.length} document routes, ${receipt.geometry.length} responsive tuples and ${receipt.captures.length} genuine captures.`);
}finally{await browser.close();}
