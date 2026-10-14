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
const out=path.join(here,'evidence');
await fs.mkdir(out,{recursive:true});
const meta=JSON.parse(await fs.readFile(path.join(root,'docs/site/build-info.json'),'utf8'));
const inventory=JSON.parse(await fs.readFile(path.join(root,'docs/site/document-inventory.json'),'utf8'));
const errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.DOCS_CHROMIUM_PATH || undefined});
const receipt={schema:1,scope:'Initial documentation site only; no desktop, full shared feature parity, native host or companion proof.',route:endpoint.hostname==='ding-ding-projects.github.io'?'public-github-pages':'local-headless-chromium',browser:browser.version(),built_at:meta.built_at,input_snapshot_sha256:meta.input_snapshot_sha256,base_commit:meta.base_commit,inputs_differ_from_base:meta.inputs_differ_from_base,checks:[],captures:[]};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
receipt.artifacts={html_sha256:sha(await fs.readFile(path.join(root,'docs/index.html'))),javascript_sha256:sha(await fs.readFile(path.join(root,'docs/site/assets/app.js'))),css_sha256:sha(await fs.readFile(path.join(root,'docs/site/assets/app.css')))};
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
async function capture(name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true});receipt.captures.push({file:'website/evidence/'+name+'.png',sha256:sha(await fs.readFile(file)),viewport:page.viewportSize(),theme:await page.getAttribute('html','data-theme'),language:await page.getAttribute('html','data-language')});}
try{
 assert.equal((await page.goto(target)).status(),200);await ready();
 assert.equal(await page.locator('.phase').count(),11);
 await page.locator('[data-phase-filter="planned"]').click();
 assert.equal(await page.locator('.phase:not([hidden])').count(),10);
 await page.locator('[data-phase-filter="started"]').click();
 assert.equal(await page.locator('.phase:not([hidden])').count(),1);
 await page.locator('#expand-phases').click();
 assert.equal(await page.locator('.phase:not([hidden]).open').count(),1);
 assert.match(await page.locator('.phase:not([hidden])').innerText(),/PH00-T01/);
 await page.locator('[data-phase-filter="all"]').click();
 await page.locator('#expand-phases').click();
 assert.equal(await page.locator('.phase.open').count(),11);
 await page.locator('#expand-phases').click();
 receipt.checks.push('Stable roadmap IDs, phase filters and expand/collapse use the generated source checklist.');
 await page.locator('#doc-search').locator('input').fill('Kconfig');
 assert.ok(await page.locator('#search-results md-list-item').count()>0);
 await page.locator('#search-results md-list-item').first().click();
 assert.equal(await page.locator('article').count(),1);
 assert.ok((await page.locator('article').innerText()).length>100);
 receipt.checks.push('Document search finds content and opens a fully rendered article.');
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
 await page.setViewportSize({width:320,height:568});
 await page.locator('.sidebar md-list-item').last().scrollIntoViewIfNeeded();
 assert.ok(await page.locator('.sidebar').evaluate(e=>e.scrollHeight>e.clientHeight));
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#menu').locator('button').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('.sidebar').evaluate(e=>e.inert),true);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'menu');
 await page.setViewportSize({width:390,height:844});
 await capture('home-mobile');
 receipt.checks.push('Home fits 320/390/768/1440 CSS px in each offered heading-language mode; mobile navigation opens and Escape closes it.');
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
 await page.goto(new URL('site/articles/ROADMAP.html',target).href);await ready();
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
