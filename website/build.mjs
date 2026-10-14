import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import MarkdownIt from 'markdown-it';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const out = path.join(root, 'docs/site');
const base = '/material-buildroot/';
const origin = 'https://ding-ding-projects.github.io' + base;
const repository = 'https://github.com/Ding-Ding-Projects/material-buildroot';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
const read = relative => fs.readFile(path.join(root, relative), 'utf8');
const rootDocs = ['README.md','PLAN.md','DECISIONS.md','ROADMAP.md','NEXT_SESSION.md','HANDOFF.md','CLOSEOUT_PROMPT.md','AGENTS.md','docs/README.md','website/README.md'];
const sources = [...rootDocs];
for (const directory of ['docs/planning','docs/wiki','docs/evidence','design']) {
  for (const name of (await fs.readdir(path.join(root, directory)).catch(() => [])).sort()) {
    if (name.endsWith('.md')) sources.push(`${directory}/${name}`);
  }
}
const documents = [];
const bySource = new Map();
for (const source of sources) {
  const content = await read(source);
  const doc = {source, content, title: content.match(/^# (.+)$/m)?.[1] || source, url: `${base}site/articles/${source.replace(/\.md$/,'.html')}`, category: source.startsWith('design/') ? 'Design' : source.includes('/wiki/') ? 'Wiki' : source.includes('/evidence/') ? 'Evidence' : 'Planning'};
  documents.push(doc); bySource.set(source, doc);
}
const inputs = [...sources, 'website/package.json','website/package-lock.json','website/build.mjs','website/check.mjs','website/app.js','website/style.css','website/components.json'].sort();
const digest = createHash('sha256');
for (const file of inputs) digest.update(file + '\0').update(await read(file)).update('\0');
const snapshot = digest.digest('hex');
const sourceCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty = Boolean(execFileSync('git',['status','--porcelain','--',...inputs],{cwd:root,encoding:'utf8'}).trim());
const meta = {version:JSON.parse(await read('website/package.json')).version, built_at:new Date().toISOString(), base_commit:sourceCommit, input_snapshot_sha256:snapshot, inputs_differ_from_base:dirty, documents:sources, material_components:'@material/web 2.4.1', source_inputs:inputs};
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
const defaultLink = md.renderer.rules.link_open || ((tokens,i,options,env,self) => self.renderToken(tokens,i,options));
md.renderer.rules.link_open = (tokens,i,options,env,self) => {
  const token = tokens[i]; const href = token.attrGet('href');
  if (href && !/^(?:https?:|mailto:|#)/.test(href)) {
    const [file, fragment] = href.split('#');
    if (file.endsWith('.md')) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(env.source || 'README.md'),file));
      const target = bySource.get(resolved);
      token.attrSet('href', (target?.url || `${repository}/blob/main/${resolved}`) + (fragment ? '#' + fragment : ''));
    } else {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(env.source || 'README.md'),file));
      token.attrSet('href', `${repository}/blob/main/${resolved}` + (fragment ? '#' + fragment : ''));
    }
  }
  if (/^https?:/.test(token.attrGet('href') || '')) token.attrSet('rel','noreferrer');
  return defaultLink(tokens,i,options,env,self);
};
const render = (text, source='README.md', headings=[]) => md.render(text,{source,headings}).replace(/<table>/g,'<div class="table-scroll" role="region" tabindex="0" aria-label="Scrollable data table"><table>').replace(/<\/table>/g,'</table></div>').replace(/<li>(\s*(?:<p>)?<md-checkbox class="task-mark)/g,'<li class="task-item">$1');
const label = (en,zh) => `<span class="en">${en}</span><span class="zh" lang="zh-HK">${zh}</span>`;
const url = source => bySource.get(source)?.url || `${repository}/blob/main/${source}`;
const logo = `<svg viewBox="0 0 40 44" aria-hidden="true"><path d="M5 12 20 4l15 8-15 8Z" fill="#4052d6"/><path d="m5 21 15 8 15-8v9l-15 8-15-8Z" fill="#8e9bfa"/><path d="m5 12 15 8 15-8v9l-15 8-15-8Z" fill="#6677e8"/></svg>`;
const nav = [ ['Overview',base,'◈'],['Implementation phases',base+'#roadmap','≡'],['Documentation',base+'site/library.html','▤'],['Owner decisions',url('DECISIONS.md'),'◇'],['Project wiki',url('docs/wiki/Home.md'),'▧'],['Feature coverage',url('docs/planning/feature-coverage.md'),'◎'] ];
const indexJson = JSON.stringify(documents.map(d=>({title:d.title,url:d.url,category:d.category,text:d.content.replace(/[#*`|>]/g,' ')}))).replace(/</g,'\\u003c');
const provenance = `<div class="provenance"><span class="version-tag">Documentation v${esc(meta.version)}</span><span>Updated <time data-local datetime="${meta.built_at}">${meta.built_at}</time></span><span title="SHA-256 of the exact documentation and website input snapshot">Snapshot ${snapshot.slice(0,10)}</span></div>`;
function page(title,body,{active='Overview',description='Explore the Material Buildroot implementation plan, decisions and phased checklist.',toc=''}={}) {
  return `<!doctype html><html lang="en" data-language="both"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#4052d6"><title>${esc(title)} · Material Buildroot</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)} · Material Buildroot"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Material Buildroot"><link rel="icon" href="${base}site/assets/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}site/assets/app.css"><script type="module" src="${base}site/assets/app.js"></script></head><body><a class="skip" href="#main">Skip to content</a><aside class="sidebar" id="navigation"><md-icon-button id="close-menu" aria-label="Close navigation"><md-icon><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></md-icon-button><a class="brand" href="${base}">${logo}<span>Material Buildroot<small>PROJECT DOCUMENTATION</small></span></a><div class="nav-label">Explore the project</div><nav aria-label="Main navigation"><md-list>${nav.map(([name,href,symbol])=>`<md-list-item type="link" href="${href}" ${active===name?'class="active" aria-current="page"':''}><span slot="start" class="nav-symbol" aria-hidden="true">${symbol}</span><span slot="headline">${name}</span></md-list-item>`).join('')}</md-list></nav><div class="nav-label">Contribute</div><nav aria-label="Contributor navigation"><md-list><md-list-item type="link" href="${url('NEXT_SESSION.md')}"><span slot="start" class="nav-symbol" aria-hidden="true"><md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></span><span slot="headline">Next session</span></md-list-item><md-list-item type="link" href="${repository}"><span slot="start" class="nav-symbol" aria-hidden="true">⌘</span><span slot="headline">Source on GitHub</span></md-list-item></md-list></nav><div class="sidebar-foot"><span class="status-dot"></span>Planning stage<p>Built in the open.<br>One verified step at a time.</p></div></aside><div class="page"><header class="topbar"><md-icon-button id="menu" aria-controls="navigation" aria-expanded="false" aria-label="Toggle navigation"><md-icon><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></md-icon-button><div class="search-wrap"><md-outlined-text-field id="doc-search" label="Search docs" type="search" aria-label="Search documentation" autocomplete="off"></md-outlined-text-field><div id="search-results" class="search-results" role="region" aria-label="Document search results" aria-live="polite" hidden></div></div><div class="top-controls"><md-outlined-select id="language" class="language-control" label="Headings" aria-label="Heading language"><md-select-option value="both" selected><div slot="headline">EN + 粵語</div></md-select-option><md-select-option value="en"><div slot="headline">English</div></md-select-option><md-select-option value="zh"><div slot="headline">粵語</div></md-select-option></md-outlined-select><label class="theme-control"><span class="theme-label">Dark theme</span><md-switch id="theme" icons aria-label="Use dark theme"></md-switch></label></div></header><main id="main" tabindex="-1">${provenance}${toc?`<div class="article-layout">${body}${toc}</div>`:body}<footer class="foot"><div>Material Buildroot · Planning documentation<br>Desktop application and paired companion are not available yet.</div><div class="foot-links"><a href="${base}site/build-info.json">Build provenance</a><a href="${repository}">GitHub <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a><md-text-button id="system-theme">System theme</md-text-button></div></footer></main></div><script type="application/json" id="document-index">${indexJson}</script></body></html>`;
}

const roadmap = bySource.get('ROADMAP.md').content;
const phases = [...roadmap.matchAll(/^## (PH\d+) (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(match=>{
  const tasks = [...match[3].matchAll(/^- \[([ x])\] \*\*(PH\d+-T\d+(?:-\d+)?)\*\* (.+)$/gm)].map(m=>({id:m[2],done:m[1]==='x',text:m[3]}));
  const done=tasks.filter(t=>t.done).length;
  return {id:match[1],title:match[2],body:match[3],tasks,done,status:done===tasks.length?'complete':done?'started':'planned'};
});
const taskCount = phases.reduce((n,p)=>n+p.tasks.length,0); const completed=phases.reduce((n,p)=>n+p.done,0);
if (!phases.length || !taskCount) throw new Error('Roadmap has no recognized stable phases/tasks');
const diagram = `<div class="blueprint"><div class="blueprint-label">The planned source-to-image workflow</div><svg viewBox="0 0 400 270" role="img" aria-labelledby="workflow-title"><title id="workflow-title">Choose a board, configure through WSL or Docker, build, and export a virtual machine image</title><g fill="none" stroke="#8e9ed4" stroke-width="1.5"><path d="M200 68v30M200 98H93v27M200 98h107v27M93 170v28h107M307 170v28H200v25"/><circle cx="200" cy="98" r="4" fill="#6677e8"/></g><g fill="#fff" stroke="#cbd3f1"><rect x="100" y="12" width="200" height="58" rx="14"/><rect x="20" y="122" width="146" height="50" rx="12"/><rect x="234" y="122" width="146" height="50" rx="12"/><rect x="100" y="220" width="200" height="42" rx="12"/></g><g font-family="Roboto, sans-serif" text-anchor="middle"><text x="200" y="36" fill="#26376c" font-size="13" font-weight="600">Your system configuration</text><text x="200" y="54" fill="#7381a9" font-size="10">Board · packages · kernel · files</text><text x="93" y="152" fill="#4052d6" font-size="13" font-weight="600">WSL 2</text><text x="307" y="152" fill="#4052d6" font-size="13" font-weight="600">Docker</text><text x="200" y="246" fill="#26376c" font-size="12" font-weight="600">ISO · VMDK · VDI · OVA</text></g><circle cx="200" cy="198" r="17" fill="#4052d6"/><path d="m194 198 4 4 8-9" stroke="white" fill="none" stroke-width="2"/></svg><div class="blueprint-caption"><span>Architecture illustration</span><span>Implementation planned <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></span></div></div>`;
const home = `<section class="hero"><div><p class="eyebrow">Open project · Windows x64 · Buildroot</p><h1>${label('Build your Linux.<br>See every step.','打造你嘅 Linux，<br>每一步都清晰。')}</h1><p class="lead">A planned visual workspace for configuring, building and exporting Linux images. Follow the decisions, explore the design, and take the next verified step.<span class="zh" lang="zh-HK">互動式 Linux 映像工作空間嘅規劃。睇清決策、設計同逐步驗證嘅開發清單。</span></p><div class="actions"><md-filled-button href="#roadmap">${label('Explore the roadmap','睇開發路線')}</md-filled-button><md-outlined-button href="${url('PLAN.md')}">${label('Read the full plan','閱讀完整計劃')}</md-outlined-button></div><div class="platforms"><span>WSL 2 + Docker</span><span>VMware + VirtualBox</span><span>Material Design 3</span></div></div>${diagram}</section><div class="notice"><span aria-hidden="true">ⓘ</span><p><strong>Documentation is here. The application comes next.</strong> This is the planning website. Desktop builds, installers and the authenticated companion remain unimplemented. The checklist records verified work, never estimates of completion.</p></div><section id="roadmap"><div class="section-heading"><div><p class="eyebrow">THE IMPLEMENTATION PATH</p><h2>${label('One phase. One verified step.','逐個階段，逐項驗證。')}</h2><p>Each task has a stable ID. Implementers attach the required evidence before checking it off in the source roadmap.</p></div><a href="${url('ROADMAP.md')}">Read prerequisites & evidence <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a></div><div class="progress-card"><div class="progress-number">${completed}<small> / ${taskCount}</small></div><div><div class="progress-label"><strong>Checklist items verified</strong> · includes planning tasks</div><md-linear-progress class="progress-track" value="${completed/taskCount}" aria-label="${completed} of ${taskCount} checklist items verified; not percentage of product completion"></md-linear-progress></div><span class="small">${phases.length} ordered phases<br>Full scope retained</span></div><div class="filter-bar"><md-chip-set aria-label="Filter roadmap phases"><md-filter-chip data-phase-filter="all" label="All phases" selected></md-filter-chip><md-filter-chip data-phase-filter="started" label="In progress"></md-filter-chip><md-filter-chip data-phase-filter="planned" label="Not started"></md-filter-chip><md-filter-chip data-phase-filter="complete" label="Verified"></md-filter-chip></md-chip-set><md-text-button id="expand-phases">Expand phases</md-text-button></div><p id="phase-count" class="visually-hidden" aria-live="polite">${phases.length} phases shown</p><div class="phase-list">${phases.map(p=>`<section class="phase" data-status="${p.status}" id="${p.id.toLowerCase()}"><md-list class="phase-heading"><md-list-item type="button" class="phase-toggle" aria-expanded="false" aria-controls="${p.id.toLowerCase()}-body"><span slot="start" class="phase-index">${p.id.slice(2)}</span><span slot="headline" class="phase-title">${esc(p.title)}</span><span slot="supporting-text" class="phase-meta">${p.tasks.length} tasks · ${p.done} verified · ${p.id}<span class="phase-tag ${p.status}">${p.status==='complete'?'Verified':p.status==='started'?'In progress':'Planned'}</span></span><md-icon slot="end" class="chevron"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></md-list-item></md-list><div class="phase-body" id="${p.id.toLowerCase()}-body" hidden>${render(p.body,'ROADMAP.md')}</div></section>`).join('')}</div></section><section class="docs-section"><div class="section-heading"><div><p class="eyebrow">THE SOURCE OF TRUTH</p><h2>${label('Explore the documentation','探索項目文件')}</h2><p>Full planning articles, rendered here. Source links are available on every page.</p></div><a href="${base}site/library.html">All ${documents.length} documents <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a></div><div class="doc-grid">${[['PLAN.md','◇','The product plan','Workflows, interfaces and the complete delivery scope.'],['DECISIONS.md','◎','Decisions & open questions','Recorded answers, chosen defaults and pending decisions.'],['docs/wiki/Home.md','▤','Project wiki','Start here, common questions and contributor guidance.']].map(([source,icon,title,description])=>`<md-list class="doc-card"><md-list-item type="link" href="${url(source)}"><span slot="start" class="card-icon" aria-hidden="true">${icon}</span><span slot="headline">${title}</span><span slot="supporting-text">${description}</span></md-list-item></md-list>`).join('')}</div></section><section class="readiness"><div><h3>${label('Downloads','下載')}</h3><p>No installer has been published. A verified Windows installer will appear here when packaging and acceptance are complete.</p><a href="${repository}/releases">View repository releases <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a></div><div><h3>${label('Browser companion','瀏覽器伴侶')}</h3><p>Planned for Edge and Chrome with explicit pairing and authenticated LAN access. This website does not access your computer or start builds.</p><a href="${url('docs/planning/surfaces.md')}">Read the surface boundaries <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a></div></section>`;

await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(path.join(out,'assets'),{recursive:true});
await build({entryPoints:[path.join(here,'app.js')],bundle:true,minify:true,outdir:path.join(out,'assets'),entryNames:'app',assetNames:'[name]-[hash]',loader:{'.woff2':'file','.woff':'file'},target:['chrome120','edge120'],legalComments:'eof'});
await fs.writeFile(path.join(out,'assets/icon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#4052d6"/><path d="m10 16 14-7 14 7-14 7Z" fill="#fff"/><path d="m10 24 14 7 14-7v8l-14 7-14-7Z" fill="#bfc9ff"/></svg>`);
for (const [packageName,license] of [['@material/web','LICENSE'],['@fontsource-variable/roboto','LICENSE'],['lit','LICENSE']]) {
  const destination=packageName.replace(/[^a-z0-9-]/g,'_')+'-LICENSE.txt';
  await fs.copyFile(path.join(here,'node_modules',packageName,license),path.join(out,'assets',destination));
}
await fs.writeFile(path.join(root,'docs/index.html'),page('Build your Linux. See every step.',home));
await fs.writeFile(path.join(root,'docs/.nojekyll'),'');
await fs.writeFile(path.join(out,'build-info.json'),JSON.stringify(meta,null,2)+'\n');
await fs.writeFile(path.join(out,'roadmap.json'),JSON.stringify({phases:phases.map(({body,...p})=>p),task_count:taskCount,verified_count:completed,input_snapshot_sha256:snapshot},null,2)+'\n');
await fs.writeFile(path.join(out,'document-inventory.json'),JSON.stringify(documents.map(({source,title,url,category})=>({source,title,url,category})),null,2)+'\n');
for (const doc of documents) {
  const headings=[]; const rendered=render(doc.content,doc.source,headings);
  const toc=`<aside class="toc" aria-label="On this page"><strong>On this page</strong>${headings.map(h=>`<a href="#${esc(h.id)}">${esc(h.text)}</a>`).join('')}</aside>`;
  const article=`<article class="article"><div class="breadcrumb"><a href="${base}site/library.html">Documentation</a> / ${doc.category}</div><div class="article-meta"><span>Planning record · English source</span><a href="${repository}/blob/main/${doc.source}">View source <md-icon class="inline-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10" fill="none" stroke="currentColor" stroke-width="2"/></svg></md-icon></a></div>${rendered}</article>`;
  const destination=path.join(out,'articles',doc.source.replace(/\.md$/,'.html'));
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(destination,page(doc.title,article,{active:doc.source==='DECISIONS.md'?'Owner decisions':doc.source.includes('/wiki/')?'Project wiki':doc.source.includes('feature-coverage')?'Feature coverage':'Documentation',toc}));
}
const library=`<p class="eyebrow">The complete current document library</p><h1>${label('Documentation','項目文件')}</h1><p class="muted">${documents.length} current planning, design, wiki and evidence documents. Articles retain their authoritative English wording; full Cantonese article twins remain a later checklist requirement.</p>${['Planning','Design','Wiki','Evidence'].map(category=>`<section class="docs-section"><h2>${category}</h2><div class="article-list">${documents.filter(d=>d.category===category).map(d=>`<md-list class="library-item"><md-list-item type="link" href="${d.url}"><span slot="headline">${esc(d.title)}</span><span slot="supporting-text">${esc(d.source)}</span></md-list-item></md-list>`).join('')}</div></section>`).join('')}`;
await fs.writeFile(path.join(out,'library.html'),page('Documentation',library,{active:'Documentation'}));
console.log(`Built ${documents.length} documents, ${phases.length} phases and ${taskCount} tasks. Snapshot ${snapshot}.`);
