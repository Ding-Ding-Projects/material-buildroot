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
const browser=await chromium.launch({headless:true,executablePath:process.env.DOCS_CHROMIUM_PATH || undefined});
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
async function ready(){await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('*')].filter(e=>e.localName.startsWith('md-')).map(e=>customElements.whenDefined(e.localName)));await Promise.all([...document.querySelectorAll('*')].filter(e=>e.updateComplete).map(e=>e.updateComplete));await document.fonts.ready;});}
async function capture(name){const file=path.join(out,name+'.png');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:file,fullPage:true});receipt.captures.push({file:path.relative(root,file).split(path.sep).join('/'),sha256:sha(await fs.readFile(file)),route:new URL(page.url()).pathname,viewport:page.viewportSize(),theme:await page.getAttribute('html','data-theme'),language:await page.getAttribute('html','data-language')});}
try{
 const homeResponse=await page.goto(target);assert.equal(homeResponse.status(),200);await ready();
 assert.equal(sha(await homeResponse.body()),receipt.artifacts.html_sha256,'Served HTML must match the selected output');
 for(const [key,relative] of Object.entries({javascript_sha256:'site/assets/app.js',css_sha256:'site/assets/app.css'})){
  const response=await context.request.get(new URL(relative,target).href);
  assert.equal(response.status(),200);
  assert.equal(sha(await response.body()),receipt.artifacts[key],`Served ${relative} must match the selected output`);
 }
 receipt.checks.push('Served HTML, JavaScript and CSS match the exact selected build output.');
 assert.equal(await page.locator('.phase, .task-mark').count(),0,'Home must not contain the full checklist');
 assert.equal(await page.locator('.landing-home').count(),1);
 const installer=page.locator('.hero-copy .actions md-filled-button');
 assert.equal(await installer.getAttribute('href'),'https://github.com/Ding-Ding-Projects/material-buildroot/releases/download/v0.1.0/Setup.exe');
 assert.equal(await page.locator('.landing-status .capability-card').count(),2);
 const preview=page.locator('.product-preview img');
 assert.equal(await preview.getAttribute('src'),publicBase+'site/source-assets/docs/evidence/desktop-shell/projects-dark.png');
 assert.ok((await preview.getAttribute('alt'))?.trim(),'Product preview needs descriptive alternative text');
 assert.ok(await preview.evaluate(image=>image.complete&&image.naturalWidth>0),'Product preview must load');
 receipt.checks.push('Landing installer CTA names the published Windows asset without initiating a download; preview loads with alternative text and capability status is present.');
 await page.locator('.actions md-outlined-button[href="'+publicBase+'site/roadmap.html"]').click();await ready();
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
   const sizes=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth}));
   assert.ok(sizes.document<=sizes.width,`Horizontal overflow at ${width}/${language}: ${sizes.document}`);
   geometry.push({width,language,document_width:sizes.document});
  }
 }
 receipt.geometry=geometry;
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
