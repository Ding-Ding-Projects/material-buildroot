import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';
import { build } from 'esbuild';
import { documentSources, categoryFor } from './inventory.mjs';
import { parseRoadmap } from './roadmap.mjs';
import { resolveDocumentLink, containedPath, sourceSnapshot, indexedSources, admittedSource } from './source-boundary.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const outputArgument = process.argv.indexOf('--output');
if (outputArgument < 0 || !process.argv[outputArgument+1]) throw new Error('Use build.bat --target documentation to select an isolated output.');
const outputRoot = path.resolve(process.argv[outputArgument+1]);
const allowedRoot = path.join(root,'.cache','builds') + path.sep;
if (!outputRoot.startsWith(allowedRoot) || path.basename(outputRoot) !== 'output') throw new Error('Documentation production requires a root-driver staging output.');
const out = containedPath(outputRoot, 'site');
const base = '/material-buildroot/';
const origin = 'https://ding-ding-projects.github.io' + base;
const repository = 'https://github.com/Ding-Ding-Projects/material-buildroot';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
const sourceIndex = indexedSources(root);
const read = relative => fs.readFile(admittedSource(root, relative, sourceIndex), 'utf8');
const sources = await documentSources(root,sourceIndex);
const documents = [];
const bySource = new Map();
for (const source of sources) {
  const content = await read(source);
  const doc = {source, content, title: content.match(/^# (.+)$/m)?.[1] || source, url: `${base}site/articles/${source.replace(/\.md$/,'.html')}`, category: categoryFor(source)};
  documents.push(doc); bySource.set(source, doc);
}
const md = new MarkdownIt({html:false,linkify:true,typographer:false});
md.core.ruler.push('heading_and_tasks', state => {
  const used = new Map();
  for (let i=0;i<state.tokens.length;i++) {
    const token = state.tokens[i];
    if (token.type === 'heading_open') {
      const label = state.tokens[i+1].content;
      const original = slug(label); const count = used.get(original) || 0; used.set(original,count+1);
      token.attrSet('id', original + (count ? `-${count}` : ''));
      if (token.tag === 'h2') state.env.headings?.push({text:label,id:token.attrGet('id')});
    }
    if (token.type === 'inline' && token.children?.[0]?.type === 'text' && /^\[[ x]\] /.test(token.children[0].content)) {
      const first = token.children[0]; const done = first.content.startsWith('[x]'); first.content = first.content.slice(4);
      const mark = new state.Token('html_inline','',0);
      mark.content = `<md-checkbox class="task-mark" ${done?'checked':''} disabled aria-label="${done?'Verified':'Not completed'}"></md-checkbox>`;
      token.children.unshift(mark);
    }
  }
});
const localAssets = new Set();
function localUrl(href, source) {
  if (/^(?:https?:|mailto:|data:|#)/i.test(href)) return href;
  const [file,fragment] = href.split('#');
  const resolved = resolveDocumentLink(source || 'README.md',file);
  containedPath(root,resolved);
  const suffix = fragment ? '#'+fragment : '';
  if (resolved.endsWith('.md')) {
    const target = bySource.get(resolved);
    if (!target) throw new Error(`Documentation article is missing: ${source} -> ${resolved}`);
    return target.url+suffix;
  }
  if (/\.(?:png|jpe?g|webp|gif|svg|json|pdf|txt)$/i.test(resolved)) {
    admittedSource(root,resolved,sourceIndex);
    localAssets.add(resolved);
    return `${base}site/source-assets/${resolved}${suffix}`;
  }
  return `${repository}/blob/main/${resolved}${suffix}`;
}
const defaultLink = md.renderer.rules.link_open || ((tokens,i,options,env,self) => self.renderToken(tokens,i,options));
md.renderer.rules.link_open = (tokens,i,options,env,self) => {
  const token=tokens[i], href=token.attrGet('href');
  if (href) token.attrSet('href',localUrl(href,env.source));
  if (/^https?:/.test(token.attrGet('href') || '')) token.attrSet('rel','noreferrer');
  return defaultLink(tokens,i,options,env,self);
};
const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens,i,options,env,self) => {
  const token=tokens[i], src=token.attrGet('src');
  if (src) token.attrSet('src',localUrl(src,env.source));
  return defaultImage(tokens,i,options,env,self);
};
const render = (text, source='README.md', headings=[]) => md.render(text,{source,headings}).replace(/<table>/g,'<div class="table-scroll" role="region" tabindex="0" aria-label="Scrollable data table"><table>').replace(/<\/table>/g,'</table></div>').replace(/<li>(\s*(?:<p>)?<md-checkbox class="task-mark)/g,'<li class="task-item">$1');
// Render once to discover every linked asset before computing source provenance.
for (const doc of documents) render(doc.content,doc.source);
const desktopPreviewUrl = localUrl('docs/evidence/desktop-shell/projects-dark.png','README.md');
const inputs = [...sources, ...localAssets, 'assets/branding/icon.ico','assets/branding/icon.png', 'website/package.json','website/package-lock.json','website/build.mjs','website/check.mjs','website/inventory.mjs','website/source-boundary.mjs','website/roadmap.mjs','website/app.js','website/style.css','website/components.json'].sort();
const snapshot = sourceSnapshot(root,inputs,sourceIndex);
const sourceCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty = Boolean(execFileSync('git',['status','--porcelain','--',...inputs],{cwd:root,encoding:'utf8'}).trim());
const meta = {version:JSON.parse(await read('website/package.json')).version, built_at:new Date().toISOString(), base_commit:sourceCommit, input_snapshot_sha256:snapshot, inputs_differ_from_base:dirty, documents:sources, material_components:'@material/web 2.4.1', source_inputs:inputs};
const label = (en,zh) => `<span class="en">${en}</span><span class="zh" lang="zh-HK">${zh}</span>`;
const url = source => bySource.get(source)?.url || `${repository}/blob/main/${source}`;
const logo = `<svg viewBox="0 0 40 44" aria-hidden="true"><path d="M5 12 20 4l15 8-15 8Z" fill="#4052d6"/><path d="m5 21 15 8 15-8v9l-15 8-15-8Z" fill="#8e9bfa"/><path d="m5 12 15 8 15-8v9l-15 8-15-8Z" fill="#6677e8"/></svg>`;
const nav = [ ['Overview',base,'◈'],['Roadmap',base+'site/roadmap.html','≡'],['Documentation',base+'site/library.html','▤'],['Planning',base+'site/categories/planning.html','◇'],['Design',base+'site/categories/design.html','▧'],['Wiki',base+'site/categories/wiki.html','◎'],['Evidence',base+'site/categories/evidence.html','✓'],['Downloads & status',base+'site/status.html','↓'] ];

const provenance = `<div class="provenance"><span class="version-tag">Documentation v${esc(meta.version)}</span><span>Updated <time data-local datetime="${meta.built_at}">${meta.built_at}</time></span><span title="SHA-256 of the exact documentation and website input snapshot">Snapshot ${snapshot.slice(0,10)}</span></div>`;
function page(title,body,{active='Overview',description='Explore the Material Buildroot implementation plan, decisions and phased checklist.',toc=''}={}) {
  return `<!doctype html><html lang="en" data-language="both"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#4052d6"><title>${esc(title)} · Material Buildroot</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)} · Material Buildroot"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Material Buildroot"><link rel="icon" href="${base}site/assets/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}site/assets/app.css"><script type="module" src="${base}site/assets/app.js"></script></head><body><a class="skip" href="#main">Skip to content</a><aside class="sidebar" id="navigation"><md-icon-button id="close-menu" aria-label="Close navigation"><md-icon><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></md-icon-button><a class="brand" href="${base}">${logo}<span>Material Buildroot<small>PROJECT DOCUMENTATION</small></span></a><div class="nav-label">Explore the project</div><nav aria-label="Main navigation"><md-list>${nav.map(([name,href,symbol])=>`<md-list-item type="link" href="${href}" ${active===name?'class="active" aria-current="page"':''}><span slot="start" class="nav-symbol" aria-hidden="true">${symbol}</span><span slot="headline">${name}</span></md-list-item>`).join('')}</md-list></nav><div class="nav-label">Contribute</div><nav aria-label="Contributor navigation"><md-list><md-list-item type="link" href="${url('NEXT_SESSION.md')}"><span slot="start" class="nav-symbol" aria-hidden="true"><md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></span><span slot="headline">Next session</span></md-list-item><md-list-item type="link" href="${repository}"><span slot="start" class="nav-symbol" aria-hidden="true">⌘</span><span slot="headline">Source on GitHub</span></md-list-item></md-list></nav><div class="sidebar-foot"><span class="status-dot"></span>Implementation in progress<p>Built in the open.<br>One verified step at a time.</p></div></aside><div class="page"><header class="topbar"><md-icon-button id="menu" aria-controls="navigation" aria-expanded="false" aria-label="Toggle navigation"><md-icon><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></md-icon-button><div class="search-wrap"><md-outlined-text-field id="doc-search" label="Search docs" type="search" aria-label="Search documentation" autocomplete="off"></md-outlined-text-field><div id="search-results" class="search-results" role="region" aria-label="Document search results" aria-live="polite" hidden></div></div><div class="top-controls"><md-outlined-select id="language" class="language-control" label="Headings" aria-label="Heading language"><md-select-option value="both" selected><div slot="headline">EN + 粵語</div></md-select-option><md-select-option value="en"><div slot="headline">English</div></md-select-option><md-select-option value="zh"><div slot="headline">粵語</div></md-select-option></md-outlined-select><label class="theme-control"><span class="theme-label">Dark theme</span><md-switch id="theme" icons aria-label="Use dark theme"></md-switch></label></div></header><main id="main" tabindex="-1">${provenance}${toc?`<div class="article-layout">${body}${toc}</div>`:body}<footer class="foot"><div>Material Buildroot · Project documentation<br>Desktop implementation is in progress; release and companion acceptance remain separate.</div><div class="foot-links"><a href="${base}site/build-info.json">Build provenance</a><a href="${repository}">GitHub <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a><md-text-button id="system-theme">System theme</md-text-button></div></footer></main></div><script type="application/json" id="document-index">${indexJson}</script></body></html>`;
}

const roadmap = bySource.get('ROADMAP.md').content;
const phases = parseRoadmap(roadmap);
const indexJson = JSON.stringify([...phases.map(p=>({title:p.id+' '+p.title,url:base+'site/phases/'+p.id.toLowerCase()+'.html',category:'Roadmap phase',text:p.body})),...documents.map(d=>({title:d.title,url:d.url,category:d.category,text:d.content.replace(/[#*`|>]/g,' ')}))]).replace(/</g,'\\u003c');
const taskCount = phases.reduce((n,p)=>n+p.tasks.length,0); const completed=phases.reduce((n,p)=>n+p.done,0);
if (!phases.length || !taskCount) throw new Error('Roadmap has no recognized stable phases/tasks');
const desktopPreview = `<figure class="product-preview"><div class="preview-meta">${label('Inside the desktop shell','桌面介面實況')}</div><a class="preview-link" href="${desktopPreviewUrl}"><img src="${desktopPreviewUrl}" width="1440" height="960" alt="Material Buildroot desktop shell in bilingual dark mode, showing an empty project workspace and an Open Settings button"></a><figcaption class="preview-caption"><span>${label('Genuine packaged-app capture · source 3f5d2cd','已封裝應用程式嘅真實畫面 · 來源 3f5d2cd')}</span><a href="${url('docs/evidence/desktop-shell/README.md')}">${label('Capture details & limits','畫面記錄同限制')}</a></figcaption></figure>`;
const groups = [
  {id:'foundations',title:'Planning & foundations',description:'Agree on contracts, establish the secure core, and build the shared interface.',phases:['PH00','PH01','PH02','PH03','PH04']},
  {id:'buildroot',title:'Buildroot workflows',description:'Manage sources, configure and build systems, then create images and virtual machines.',phases:['PH05','PH06','PH07']},
  {id:'tools',title:'Built-in tools',description:'Complete conversion, local assistance, server management and publication workflows.',phases:['PH08']},
  {id:'delivery',title:'Website, companion & release',description:'Complete browser surfaces, package the application, and verify delivery.',phases:['PH09','PH10']}
];
const categories = [
  {id:'planning',title:'Planning',description:'Scope, decisions, architecture, runtime research and contributor handoffs.'},
  {id:'design',title:'Design',description:'Workspaces, screen states, genuine Material controls and acceptance requirements.'},
  {id:'wiki',title:'Wiki',description:'A starting guide and answers to common project questions.'},
  {id:'evidence',title:'Evidence',description:'Actual verification records, publication limits and retained proof.'}
];
for (const title of [...new Set(documents.map(doc=>doc.category))].sort()) {
  if (!categories.some(category=>category.title===title)) categories.push({id:title.toLowerCase(),title,description:`Current ${title.toLowerCase()} articles and verification boundaries.`});
}
const cardText = (english,cantonese) => cantonese ? label(esc(english),esc(cantonese)) : esc(english);
const cards = (items,extraClass='') => `<div class="category-grid ${extraClass}">${items.map(item=>`<md-list class="category-card"><md-list-item type="link" href="${item.href}"><span slot="overline">${cardText(item.meta || '',item.metaZh)}</span><span slot="headline">${cardText(item.title,item.titleZh)}</span><span slot="supporting-text">${cardText(item.description,item.descriptionZh)}</span><md-icon slot="end" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></md-list-item></md-list>`).join('')}</div>`;
const progress = `<div class="progress-card"><div class="progress-number">${completed}<small> / ${taskCount}</small></div><div><div class="progress-label"><strong>Checklist items verified</strong> · includes planning tasks</div><md-linear-progress class="progress-track" value="${completed/taskCount}" aria-label="${completed} of ${taskCount} checklist items verified; not percentage of product completion"></md-linear-progress></div><span class="small">${phases.length} ordered phases<br>Full scope retained</span></div>`;
const home = `<div class="landing-home"><section class="hero landing-hero"><div class="hero-copy"><p class="eyebrow">Material Buildroot · Windows x64</p><p class="release-badge">${label('Version 0.1.0 · Early desktop release','版本 0.1.0 · 早期桌面版本')}</p><h1>${label('A clearer workspace<br>for embedded Linux.','嵌入式 Linux，<br>工作空間更清晰。')}</h1><p class="lead">${label('A Windows desktop project for working with Buildroot. Try the early desktop shell today and follow the plan for configuring, building and exporting Linux systems.','專為 Buildroot 而設嘅 Windows 桌面項目。試用早期桌面介面，了解配置、建置同匯出 Linux 系統嘅開發計劃。')}</p><div class="actions"><md-filled-button href="${repository}/releases/download/v0.1.0/Setup.exe">${label('Download v0.1.0 · Windows x64','下載 v0.1.0 · Windows x64')}</md-filled-button><md-outlined-button href="${base}site/roadmap.html">${label('Explore the roadmap','睇開發路線')}</md-outlined-button></div><p class="release-note">${label('Unsigned installer. Windows may show a publisher or SmartScreen warning.','安裝程式未經簽署，Windows 可能會顯示發行者或 SmartScreen 警告。')} <a href="${base}site/status.html">${label('Release details','版本詳情')}</a></p></div>${desktopPreview}</section><section class="landing-status" aria-labelledby="scope-heading"><p class="eyebrow">${label('WHERE THE PROJECT STANDS','項目進度')}</p><h2 id="scope-heading">${label('A working shell. A visible plan.','桌面介面已推出，開發方向睇得見。')}</h2><div class="capability-grid"><article class="capability-card"><h3>${label('Available in v0.1.0','v0.1.0 已有功能')}</h3><p>${label('Open the empty project workspace, save English, Hong Kong Cantonese or bilingual language preferences, inspect build provenance and control the desktop window. Appearance choices last for the current session.','開啟空白專案工作區、儲存英文、香港粵語或雙語偏好、查看建置來源，同埋控制桌面視窗。外觀選擇只適用於今次使用。')}</p><a href="${url('docs/desktop/host-and-preferences.md')}">${label('Explore the desktop shell','了解桌面介面')}</a></article><article class="capability-card"><h3>${label('Still in development','仍在開發中')}</h3><p>${label('Project creation, Buildroot execution through WSL 2 or Docker, virtual-machine workflows and automatic updates are not implemented. Follow each phase and its verification requirements in the roadmap.','建立專案、透過 WSL 2 或 Docker 執行 Buildroot、虛擬機流程同自動更新尚未實作。開發路線列出各階段同驗證要求。')}</p><a href="${base}site/roadmap.html">${label('See planned workflows','查看規劃中嘅流程')}</a></article></div><p class="site-boundary">${label('This website provides documentation, downloads and project status. It cannot access your computer or start builds.','呢個網站提供文件、下載同項目狀態，唔會存取你嘅電腦或啟動建置。')}</p></section><section class="landing-section"><p class="eyebrow">${label('CHOOSE YOUR STARTING POINT','由呢度開始')}</p><h2>${label('Try it. Understand it. Help build it.','試用、了解，一齊完善。')}</h2>${cards([{href:base+'site/library.html',meta:documents.length+' ARTICLES',metaZh:documents.length+' 篇文章',title:'Read the documentation',titleZh:'閱讀項目文件',description:'Browse desktop guides, architecture, build instructions and the complete source wiki.',descriptionZh:'瀏覽桌面指南、架構、建置說明同完整來源 Wiki。'},{href:base+'site/categories/evidence.html',meta:'VERIFICATION RECORDS',metaZh:'驗證記錄',title:'See what has been verified',titleZh:'查看已驗證嘅成果',description:'Inspect genuine captures and recorded checks, with their source versions and limits.',descriptionZh:'查看真實畫面同檢查記錄，以及對應來源版本同限制。'},{href:url('NEXT_SESSION.md'),meta:'FOR CONTRIBUTORS',metaZh:'參與開發',title:'Find your next contribution',titleZh:'搵下一項貢獻',description:'Read the handoff and choose an eligible task from '+phases.length+' phases and '+taskCount+' tracked items.',descriptionZh:'閱讀交接記錄，喺 '+phases.length+' 個階段同 '+taskCount+' 項工作中揀合適任務。'}],'landing-grid')}</section></div>`;
const roadmapHome = `<p class="eyebrow">IMPLEMENTATION ROADMAP</p><h1>${label('Choose a work category.','揀一個工作分類。')}</h1><p class="page-intro">Each phase has its own page with prerequisites, stable task IDs and completion evidence. Work through eligible tasks one at a time.</p>${progress}${cards(groups.map(group=>({href:base+'site/roadmap/'+group.id+'.html',meta:group.phases.length+(group.phases.length===1?' PHASE':' PHASES'),title:group.title,description:group.description})))}<div class="record-link"><md-text-button href="${url('ROADMAP.md')}">Full source roadmap and execution rules</md-text-button></div>`;
const libraryHome = `<p class="eyebrow">DOCUMENTATION LIBRARY</p><h1>${label('Find your topic.','搵你需要嘅主題。')}</h1><p class="page-intro">${documents.length} current articles, organized into ${categories.length} sections. Articles retain their authoritative English wording; complete Cantonese twins remain a later requirement.</p>${cards(categories.map(category=>({href:base+'site/categories/'+category.id+'.html',meta:documents.filter(d=>d.category===category.title).length+' '+(documents.filter(d=>d.category===category.title).length===1?'ARTICLE':'ARTICLES'),title:category.title,description:category.description})))}`;
const statusBody = `<p class="eyebrow">PROJECT AVAILABILITY</p><h1>${label('Downloads & status','下載同項目狀態')}</h1><div class="status-sections"><section><h2>Available now</h2><p>Version 0.1.0 · Classic Har Gow · 蝦餃 is a published early desktop milestone. Its five release assets were verified by size and SHA-256.</p><md-filled-button href="https://github.com/Ding-Ding-Projects/material-buildroot/releases/download/v0.1.0/Setup.exe">Download Setup.exe · 下載安裝程式</md-filled-button><md-outlined-button href="https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0">Release notes and checksums</md-outlined-button><p><a href="https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/hk-dish-0001-classic-har-gow.png">Classic Har Gow · 蝦餃 public photo</a></p></section><section><h2>Windows application</h2><p>The genuine unsigned Squirrel.Windows installer may trigger unknown-publisher or SmartScreen warnings. The shell saves language preferences; project creation, Buildroot execution and automatic updates are not implemented. Bounded installed launch was observed; complete installer and update acceptance remain open.</p><md-outlined-button href="${repository}/releases">Repository releases</md-outlined-button></section><section><h2>Browser companion</h2><p>Planned for Edge and Chrome with explicit pairing and authenticated LAN access. This static website cannot access your computer or start builds.</p><md-text-button href="${url('docs/planning/surfaces.md')}">Read the capability boundaries</md-text-button></section><section><h2>Verification & publication</h2><p>Local website proof and live hosting proof are recorded separately. Review the evidence for actual outcomes and any remaining access limits.</p><md-text-button href="${base}site/categories/evidence.html">View evidence records</md-text-button></section></div>`;

await fs.mkdir(outputRoot,{recursive:true});
if ((await fs.readdir(outputRoot)).length) throw new Error('Documentation staging output must be empty.');
await fs.mkdir(path.join(out,'assets'),{recursive:true});
await fs.copyFile(admittedSource(root,'assets/branding/icon.ico',sourceIndex),path.join(out,'assets/icon.ico'));
await fs.copyFile(admittedSource(root,'assets/branding/icon.png',sourceIndex),path.join(out,'assets/icon.png'));
await build({entryPoints:[path.join(here,'app.js')],bundle:true,minify:true,outdir:path.join(out,'assets'),entryNames:'app',assetNames:'[name]-[hash]',loader:{'.woff2':'file','.woff':'file'},target:['chrome120','edge120'],legalComments:'eof'});
await fs.writeFile(path.join(out,'assets/icon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#4052d6"/><path d="m10 16 14-7 14 7-14 7Z" fill="#fff"/><path d="m10 24 14 7 14-7v8l-14 7-14-7Z" fill="#bfc9ff"/></svg>`);
for (const [packageName,license] of [['@material/web','LICENSE'],['@fontsource-variable/roboto','LICENSE'],['lit','LICENSE']]) {
  const destination=packageName.replace(/[^a-z0-9-]/g,'_')+'-LICENSE.txt';
  await fs.copyFile(path.join(here,'node_modules',packageName,license),path.join(out,'assets',destination));
}
await fs.writeFile(path.join(outputRoot,'index.html'),page('A clearer workspace for embedded Linux',home,{description:'Download the early Material Buildroot desktop shell for Windows x64, explore its verified features and follow the Buildroot workflow roadmap.'}));
await fs.writeFile(path.join(outputRoot,'.nojekyll'),'');
await fs.writeFile(path.join(out,'build-info.json'),JSON.stringify(meta,null,2)+'\n');
await fs.writeFile(path.join(out,'roadmap.json'),JSON.stringify({phases:phases.map(({body,...p})=>p),task_count:taskCount,verified_count:completed,input_snapshot_sha256:snapshot},null,2)+'\n');
await fs.writeFile(path.join(out,'document-inventory.json'),JSON.stringify(documents.map(({source,title,url,category})=>({source,title,url,category})),null,2)+'\n');
for (const doc of documents) {
  const headings=[]; const rendered=render(doc.content,doc.source,headings);
  const toc=`<aside class="toc" aria-label="On this page"><strong>On this page</strong>${headings.map(h=>`<a href="#${esc(h.id)}">${esc(h.text)}</a>`).join('')}</aside>`;
  const article=`<article class="article"><div class="breadcrumb"><a href="${base}site/library.html">Documentation</a> / <a href="${base}site/categories/${doc.category.toLowerCase()}.html">${doc.category}</a></div><div class="article-meta"><span>Project record · English source</span><a href="${repository}/blob/main/${doc.source}">View source <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a></div>${rendered}</article>`;
  const destination=path.join(out,'articles',doc.source.replace(/\.md$/,'.html'));
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(destination,page(doc.title,article,{active:doc.category,toc}));
}
await fs.writeFile(path.join(out,'library.html'),page('Documentation categories',libraryHome,{active:'Documentation'}));
await fs.writeFile(path.join(out,'roadmap.html'),page('Implementation roadmap',roadmapHome,{active:'Roadmap'}));
await fs.writeFile(path.join(out,'status.html'),page('Downloads and status',statusBody,{active:'Downloads & status'}));
await fs.mkdir(path.join(out,'categories'),{recursive:true});
await fs.mkdir(path.join(out,'roadmap'),{recursive:true});
await fs.mkdir(path.join(out,'phases'),{recursive:true});
for (const category of categories) {
  const entries=documents.filter(d=>d.category===category.title);
  const body=`<div class="breadcrumb"><a href="${base}site/library.html">Documentation</a> / ${category.title}</div><p class="eyebrow">${entries.length} ${entries.length===1?'ARTICLE':'ARTICLES'}</p><h1>${esc(category.title)}</h1><p class="page-intro">${esc(category.description)}</p><div class="article-list">${entries.map(d=>`<md-list class="library-item"><md-list-item type="link" href="${d.url}"><span slot="headline">${esc(d.title)}</span><span slot="supporting-text">${esc(d.source)}</span></md-list-item></md-list>`).join('')}</div>`;
  await fs.writeFile(path.join(out,'categories',category.id+'.html'),page(category.title,body,{active:category.title}));
}
for(const group of groups){
  const entries=phases.filter(p=>group.phases.includes(p.id));
  const body=`<div class="breadcrumb"><a href="${base}site/roadmap.html">Roadmap</a> / ${esc(group.title)}</div><p class="eyebrow">${entries.length} ${entries.length===1?'PHASE':'PHASES'}</p><h1>${esc(group.title)}</h1><p class="page-intro">${esc(group.description)} Open a phase for its individual task checklist.</p><div class="filter-bar"><md-chip-set aria-label="Filter phases in this category"><md-filter-chip data-phase-filter="all" label="All phases" selected></md-filter-chip><md-filter-chip data-phase-filter="started" label="In progress"></md-filter-chip><md-filter-chip data-phase-filter="planned" label="Not started"></md-filter-chip><md-filter-chip data-phase-filter="complete" label="Verified"></md-filter-chip></md-chip-set></div><p id="phase-count" class="small" aria-live="polite">${entries.length} phases shown</p><div class="phase-list">${entries.map(p=>`<md-list class="phase" data-status="${p.status}"><md-list-item type="link" class="phase-link" href="${base}site/phases/${p.id.toLowerCase()}.html"><span slot="start" class="phase-index">${p.id.slice(2)}</span><span slot="headline" class="phase-title">${esc(p.title)}</span><span slot="supporting-text" class="phase-meta">${p.id} · ${p.tasks.length} tasks · ${p.done} verified</span><md-icon slot="end"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></md-list-item></md-list>`).join('')}</div>`;
  await fs.writeFile(path.join(out,'roadmap',group.id+'.html'),page(group.title,body,{active:'Roadmap'}));
}
for(let index=0;index<phases.length;index++){
  const phase=phases[index];const group=groups.find(g=>g.phases.includes(phase.id));
  const headings=[];
  const body=`<article class="article phase-article"><div class="breadcrumb"><a href="${base}site/roadmap.html">Roadmap</a> / <a href="${base}site/roadmap/${group.id}.html">${esc(group.title)}</a> / ${phase.id}</div><p class="eyebrow">${phase.id} · ${phase.done} OF ${phase.tasks.length} TASKS VERIFIED</p><h1>${esc(phase.title)}</h1><div class="notice"><p>Check a task only after its required evidence passes. Completion is recorded in the source roadmap. This page covers one phase.</p></div>${render(phase.body,'ROADMAP.md',headings)}<div class="phase-pagination">${index?`<md-outlined-button href="${base}site/phases/${phases[index-1].id.toLowerCase()}.html">Previous: ${phases[index-1].id}</md-outlined-button>`:''}${index<phases.length-1?`<md-filled-button href="${base}site/phases/${phases[index+1].id.toLowerCase()}.html">Next: ${phases[index+1].id}</md-filled-button>`:''}</div><md-text-button href="${url('ROADMAP.md')}">Full source roadmap and execution rules</md-text-button></article>`;
  await fs.writeFile(path.join(out,'phases',phase.id.toLowerCase()+'.html'),page(`${phase.id} ${phase.title}`,body,{active:'Roadmap'}));
}
const pages=['index.html','site/library.html','site/roadmap.html','site/status.html',...categories.map(c=>'site/categories/'+c.id+'.html'),...groups.map(g=>'site/roadmap/'+g.id+'.html'),...phases.map(p=>'site/phases/'+p.id.toLowerCase()+'.html'),...documents.map(d=>d.url.slice(base.length))];
await fs.writeFile(path.join(out,'page-inventory.json'),JSON.stringify(pages,null,2)+'\n');
console.log(`Built ${pages.length} pages: ${documents.length} documents, ${phases.length} phase pages, four roadmap categories and ${categories.length} documentation categories. Snapshot ${snapshot}.`);

for (const source of [...localAssets].sort()) {
  const sourcePath=admittedSource(root,source,sourceIndex);
  if (!(await fs.lstat(sourcePath)).isFile()) throw new Error(`Referenced asset is not a regular file: ${source}`);
  const destination=containedPath(outputRoot,'site/source-assets/'+source);
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.copyFile(admittedSource(root,source,sourceIndex),containedPath(outputRoot,'site/source-assets/'+source));
}
await fs.writeFile(path.join(out,'asset-inventory.json'),JSON.stringify([...localAssets].sort(),null,2)+'\n');
