import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { documentSources } from './inventory.mjs';
import { containedPath, sourceSnapshot, indexedSources, admittedSource } from './source-boundary.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputIndex=process.argv.indexOf('--output');
const docs=outputIndex<0 ? path.join(root,'docs') : path.resolve(process.argv[outputIndex+1]);
const base='/material-buildroot/';
const failures=[];
const sourceIndex=indexedSources(root);
const meta=JSON.parse(await fs.readFile(path.join(docs,'site/build-info.json'),'utf8'));
const inventory=JSON.parse(await fs.readFile(path.join(docs,'site/document-inventory.json'),'utf8'));
const expectedDocuments=await documentSources(root,sourceIndex);
if(JSON.stringify(inventory.map(doc=>doc.source).sort())!==JSON.stringify(expectedDocuments))failures.push('Documentation inventory omits or duplicates current articles.');
const assets=JSON.parse(await fs.readFile(path.join(docs,'site/asset-inventory.json'),'utf8'));
for(const source of assets) {
 const original=await fs.readFile(admittedSource(root,source,sourceIndex));
 const copied=await fs.readFile(containedPath(docs,'site/source-assets/'+source));
 if(!original.equals(copied)) failures.push(`${source}: local asset differs from source.`);
}
const roadmap=JSON.parse(await fs.readFile(path.join(docs,'site/roadmap.json'),'utf8'));
if(sourceSnapshot(root,meta.source_inputs,sourceIndex)!==meta.input_snapshot_sha256)failures.push('Website source snapshot is stale; rebuild after documentation changes.');
if(!/^[a-f0-9]{40}$/.test(meta.base_commit)||!Number.isFinite(Date.parse(meta.built_at)))failures.push('Invalid build provenance.');
const tasks=roadmap.phases.flatMap(p=>p.tasks);
if(new Set(tasks.map(t=>t.id)).size!==tasks.length)failures.push('Duplicate task IDs.');
if(tasks.length!==roadmap.task_count || tasks.filter(t=>t.done).length!==roadmap.verified_count)failures.push('Roadmap counts disagree.');
const htmlFiles=JSON.parse(await fs.readFile(path.join(docs,'site/page-inventory.json'),'utf8'));
for(const doc of inventory)if(!htmlFiles.includes(doc.url.slice(base.length)))failures.push(`${doc.source}: document route missing from page inventory.`);
for(const phase of roadmap.phases)if(!htmlFiles.includes('site/phases/'+phase.id.toLowerCase()+'.html'))failures.push(`${phase.id}: dedicated phase page missing.`);
const htmlByFile=new Map();
for(const file of htmlFiles)htmlByFile.set(file,await fs.readFile(path.join(docs,file),'utf8'));
let checkedLinks=0;
for(const [file,html] of htmlByFile){
  if (/<(?:button|select|input|details|summary)\b/i.test(html)) failures.push(`${file}: native interactive control substitutes are not allowed; use the admitted Material component.`);
  for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
    const link=match[1].replace(/&amp;/g,'&');
    if(/^(?:https?:|mailto:|data:)/.test(link))continue;
    const [pathname,fragment]=link.split('#');
    let target=pathname?pathname.startsWith(base)?pathname.slice(base.length):path.posix.normalize(path.posix.join(path.posix.dirname(file),pathname)):file;
    if(!target||target.endsWith('/'))target+='index.html';
    if(pathname.startsWith('/')&&!pathname.startsWith(base)){failures.push(`${file}: link outside site base ${link}`);continue;}
    try{await fs.access(path.join(docs,target));}catch{failures.push(`${file}: missing ${target}`);continue;}
    if(fragment && target.endsWith('.html')){
      const targetHTML=htmlByFile.get(target)??await fs.readFile(path.join(docs,target),'utf8');
      if(!targetHTML.includes(`id="${decodeURIComponent(fragment)}"`))failures.push(`${file}: missing fragment ${target}#${fragment}`);
    }
    checkedLinks++;
  }
}
const featureContent=await fs.readFile(admittedSource(root,'docs/planning/feature-coverage.md',sourceIndex),'utf8');
const identities=[...featureContent.matchAll(/^\| ([a-z][a-z0-9-]+) \|/gm)].map(m=>m[1]);
if(identities.length!==105||new Set(identities).size!==105)failures.push('Feature inventory no longer has 105 unique identities; reconcile the phase map.');
const sourceRoadmap=await fs.readFile(admittedSource(root,'ROADMAP.md',sourceIndex),'utf8');
const phaseMap=sourceRoadmap.split('## Primary-phase map for all 105 catalogue identities')[1]?.split('## Current checkpoint')[0]||'';
const mapped=[...phaseMap.matchAll(/`([a-z][a-z0-9-]+)`/g)].map(m=>m[1]).filter(id=>identities.includes(id));
if(mapped.length!==105||new Set(mapped).size!==105)failures.push('Roadmap must map each of the 105 feature identities exactly once.');
if(process.argv.includes('--with-browser')){
  const receipt=JSON.parse(await fs.readFile(admittedSource(root,'website/evidence/browser-check.json',sourceIndex),'utf8'));
  if(receipt.verdict!=='passed'||receipt.input_snapshot_sha256!==meta.input_snapshot_sha256)failures.push('Browser receipt is missing, failed or bound to another source snapshot.');
  for(const [key,file] of Object.entries({html_sha256:'docs/index.html',javascript_sha256:'docs/site/assets/app.js',css_sha256:'docs/site/assets/app.css'})){
    const hash=createHash('sha256').update(await fs.readFile(path.join(docs,file.replace(/^docs\//,'')))).digest('hex');
    if(receipt.artifacts[key]!==hash)failures.push(`${file}: browser evidence artifact hash mismatch.`);
  }
  for(const capture of receipt.captures){
    if(!/^website\/evidence\/[a-z-]+\.png$/.test(capture.file)){failures.push('Unexpected capture location.');continue;}
    const hash=createHash('sha256').update(await fs.readFile(admittedSource(root,capture.file,sourceIndex))).digest('hex');
    if(capture.sha256!==hash)failures.push(`${capture.file}: capture hash mismatch.`);
  }
}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`PASS: ${htmlFiles.length} HTML pages, ${checkedLinks} internal links/assets/fragments, ${tasks.length} unique tasks, ${identities.length} feature identities and current snapshot provenance.`);
