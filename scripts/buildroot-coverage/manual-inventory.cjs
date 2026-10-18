'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const CATEGORIES=Object.freeze(['manual-article','manual-anchor','manual-heading','manual-topic','manual-table-row','manual-table-cell','manual-identifier','manual-include']);
const REQUIRED_ARTICLES=Object.freeze(['manual.adoc','configure.adoc','customize.adoc','adding-packages.adoc','adding-packages-generic.adoc','package-make-target.adoc','makeusers-syntax.adoc','makedev-syntax.adoc']);
const WORKFLOWS=Object.freeze({
 package:{gui:['src/renderer/package-panel.ts','src/renderer/package-discovery-panel.ts'],backend:['src/main/configuration/package-authoring.cjs','src/main/configuration/package-discovery.cjs'],help:['docs/features/packages/package-authoring.md'],owners:['PH06-T05']},
 configuration:{gui:['src/renderer/configuration-panel.ts','src/renderer/defconfig-panel.ts'],backend:['src/main/configuration/index.cjs','src/main/configuration/defconfig-workflows.cjs'],help:['docs/desktop/configuration.md','docs/desktop/kconfig-semantics.md'],owners:['PH06-T01','PH06-T02','PH06-T04']},
 runtime:{gui:['src/renderer/wsl-runtime-panel.ts','src/renderer/build-queue-panel.ts'],backend:['src/main/execution/index.cjs','src/main/jobs/scheduler.cjs'],help:['docs/desktop/execution.md','docs/desktop/package-targets.md'],owners:['PH05-T02','PH05-T03','PH05-T05','PH06-T06']},
 image:{gui:['src/renderer/image-presets-panel.ts'],backend:['src/main/configuration/image-presets.cjs','src/main/configuration/account-provisioning.cjs'],help:['docs/desktop/iso-workflow.md','docs/desktop/iso-production.md'],owners:['PH07-T01','PH07-T02','PH07-T04']},
 source:{gui:['src/renderer/source-panel.ts'],backend:['src/main/execution/source.cjs'],help:['docs/features/source-lifecycle.md'],owners:['PH05-T01','PH05-T04']},
 sdk:{gui:['src/renderer/sdk-export-panel.ts'],backend:['src/main/deployment/sdk-export.cjs'],help:['docs/features/outputs/sdk-export.md'],owners:['PH07-T06']},
 provenance:{gui:['src/renderer/build-queue-panel.ts'],backend:['src/main/deployment/reproducibility.cjs'],help:['docs/features/reproducibility.md'],owners:['PH07-T05']},
 unsupported:{gui:[],backend:[],help:[],owners:['PH01-T02-C02']}
});
function workflow(file,name=''){
 if(/makeusers|makedev|device-permission|users-tables|rootfs|post-image|board-support/.test(file)||/^(?:LIBFOO_|FOO_)?(?:USERS|DEVICES|PERMISSIONS)$/.test(name))return'image';
 if(/adding-packages|download-infra|patch-policy|customize-packages|customize-patches/.test(file))return'package';
 if(/configure|customize-configuration|customize-outside|directory-structure|configurable/.test(file))return'configuration';
 if(/toolchain/.test(file))return'sdk';
 if(/legal|reproduc/.test(file))return'provenance';
 if(/getting|migrating|development/.test(file))return'source';
 if(/common-usage|make-tips|package-make-target|rebuilding|prerequisite|quickstart|debugg|ccache|download-location/.test(file))return'runtime';
 return'unsupported';
}
function disposition(file,title,name=''){
 const route=workflow(file,name),candidate=WORKFLOWS[route];
 const explicit=/SITE_METHOD|EXTRA_DOWNLOADS|INSTALL_STAGING|SELINUX|CPE_ID|REDISTRIBUTE|USERS|DEVICES|PERMISSIONS/.test(name);
 const result={workflow:route,mapping:'provisional-topic-routing; candidate paths are not implementation evidence',
  gui:{state:explicit||route==='unsupported'?'missing':'partial',consumers:candidate.gui,operations:candidate.backend,reason:explicit?'No complete dedicated typed workflow has been admitted for this source field.':route==='unsupported'?'No product workflow is admitted for this manual topic; document applicability before implementing.':'Related workflow exists; this manual topic and its small details have not received independent acceptance.'},
  easyMode:{state:'missing',question:`What would you like to do with ${title.replace(/[`+]/g,'')}?`,discover:route==='package'?'Discover current recipe, infrastructure and source-supported values; preserve unsupported fields.':route==='configuration'?'Discover current source/configuration, type, visibility, choices, defaults and dependency reasons.':route==='runtime'?'Discover selected runtime, prerequisites, target availability, current results and resource limits.':route==='image'?'Discover architecture, firmware, image and account/permission constraints from the selected source.':'Review applicability and the existing project state before recommending an action.',prefill:'Use current discovered values or the selected source default; show uncertainty and never silently overwrite existing state.',control:'Use a labeled icon dropdown only for actually discovered choices; structured rows for fields/tables, browse controls for paths and explicit review for effects.',recommendedDefault:'Source-specific current/effective default only; no universal recommendation has been verified.',validation:'Explain constraints, hidden prerequisites, architecture limits and requested/effective differences before executing an admitted operation.'},
  help:{state:'missing',relatedArticles:candidate.help,needed:'A plain-language explanation for this exact topic: purpose, default, examples, dependencies, safety/permission effects, failure/recovery and interactions. Related articles do not prove this explanation exists.'},
  runtime:'unverified',roadmap:candidate.owners};
 const field=title.trim().toLowerCase();
 const account={username:['Which service account should own this work?','Discover current account tables and package accounts; explain name collisions before choosing a new name.'],uid:['Should Buildroot choose an unused user number?','Offer automatic or an explicitly validated source-supported ID; explain collisions and the selected source sentinel.'],gid:['Should Buildroot choose an unused group number?','Discover existing groups and validate the selected source automatic-ID rule.'],password:['How should this account authenticate?','Use a protected credential control with explicit source-supported locking/hashing choices; never prefill or expose a stored secret.'],home:['Where should this account keep its files?','Offer a source-relative target path field; explain no-home choices, ownership and missing-directory behavior.'],shell:['Which login shell, if any, should this account use?','Discover shells actually included in the image; explain a non-login service-account choice.'],groups:['Which extra groups does the account need?','Discover existing group names; use a searchable multi-select with collision and availability checks.']};
 if(account[field]&&/makeusers|users-tables/.test(file)){result.easyMode.question=account[field][0];result.easyMode.discover=account[field][1];result.gui.state='missing';result.gui.reason='No independently admitted typed workflow for this exact manual table field.';}
 return result;
}
function inventory(source,{applicationRoot=path.resolve(__dirname,'../..')}={}){
 const files=new Map(),entries=[],seen=new Map();
 const read=(root,file,registry=files)=>{const full=path.join(root,file),s=fs.lstatSync(full);if(!s.isFile()||s.isSymbolicLink())throw Error(`Unsafe source: ${file}`);const bytes=fs.readFileSync(full);registry.set(file,{path:file,sha256:hash(bytes),bytes:bytes.length});return bytes.toString('utf8');};
 const make=read(source,'Makefile'),version=make.match(/^export BR2_VERSION\s*:?=\s*(\S+)/m)?.[1];if(!version)throw Error('Missing Buildroot version');
 const references=new Map();
 for(const file of ['Makefile',...fs.readdirSync(path.join(source,'package')).filter(name=>/^pkg-.*\.mk$/.test(name)).sort().map(name=>'package/'+name)]){
  const text=read(source,file);text.split(/\r?\n/).forEach((line,index)=>{for(const match of line.matchAll(/\b[A-Z][A-Z0-9_]{2,}\b|[)}]_([A-Z][A-Z0-9_]+)/g)){const key=match[1]||match[0];if(!references.has(key))references.set(key,[]);references.get(key).push({path:file,line:index+1});}});
 }
 const articleNames=fs.readdirSync(path.join(source,'docs/manual')).filter(name=>name.endsWith('.adoc')).sort();
 const add=(category,file,line,name,title,detail={})=>{const base=`${category}:${file}:${name}`,ordinal=seen.get(base)||0;seen.set(base,ordinal+1);const id=ordinal?`${base}:definition:${ordinal+1}`:base;entries.push({id,category,title,source:{path:file,line,sha256:files.get(file).sha256},detail,...disposition(file,title,name)});};
 for(const article of articleNames){
  const file='docs/manual/'+article,text=read(source,file),lines=text.split(/\r?\n/),title=lines.find(line=>/^=+\s+/.test(line))?.replace(/^=+\s+/,'')||article;
  add('manual-article',file,1,article,title,{contentSha256:hash(Buffer.from(text)),discovery:'Every .adoc file in the selected manual directory, including articles not reachable from the root include graph.'});
  let heading=title;
  const identifiers=new Map();
  lines.forEach((line,index)=>{
   if(/^\s*\/\//.test(line))return;
   for(const anchor of line.matchAll(/\[\[([^,\]]+)(?:,[^\]]*)?\]\]|^\s*\[#([^\]]+)\]/g)){const name=anchor[1]||anchor[2];add('manual-anchor',file,index+1,name,name,{anchor:name,heading,discovery:'Explicit AsciiDoc anchor candidate; no HTML renderer was executed.'});}
   const headingMatch=line.match(/^(=+)\s+(.+)$/);if(headingMatch){heading=headingMatch[2];add('manual-heading',file,index+1,heading,heading,{level:headingMatch[1].length,implicitAnchor:'unverified; AsciiDoc automatic ID generation is not emulated'});}
   const include=line.match(/^\s*include::([^[]+)\[(.*)\]/);if(include)add('manual-include',file,index+1,include[1],include[1],{target:include[1],attributes:include[2],available:articleNames.includes(include[1]),dynamic:/[{}]/.test(include[1]),discovery:'Lexical include only; no macro, command or conditional evaluation.'});
   if(/^\s*(?:\*+|\.+|\d+\.)\s+\S/.test(line)||/^(?:NOTE|WARNING|IMPORTANT|TIP|CAUTION):/.test(line))add('manual-topic',file,index+1,hash(line.trim()).slice(0,16),line.trim(),{heading,excerpt:line,discovery:'List/admonition topic candidate; multiline detail remains in the bound source article.'});
   if(/^\|/.test(line)&&!/^\|[=\-]/.test(line)){const rowKey=hash(line.trim()).slice(0,16),cells=line.split('|').slice(1);add('manual-table-row',file,index+1,rowKey,line.trim(),{heading,cells,discovery:'Lexical AsciiDoc table row; cell spanning and multiline tables are not rendered.'});cells.forEach((cell,cellIndex)=>{if(cell.trim())add('manual-table-cell',file,index+1,`${rowKey}:${cellIndex+1}`,cell.trim(),{heading,rowKey,column:cellIndex+1,discovery:'Lexical table cell candidate, including small named fields; rendered cell spans and field semantics remain unverified.'});});}
   for(const match of line.matchAll(/\b[A-Z][A-Z0-9_]{2,}\b/g)){const name=match[0];if(!identifiers.has(name))identifiers.set(name,[]);identifiers.get(name).push({line:index+1,excerpt:line});}
  });
  for(const [name,locations]of identifiers){const suffix=name.replace(/^(?:HOST_)?(?:FOO|LIBFOO)_/,'');const matches=[...(references.get(name)||[]),...(name===suffix?[]:references.get(suffix)||[])];add('manual-identifier',file,locations[0].line,name,name,{locations,sourceReferences:matches,discovery:'Uppercase identifier candidate, not proof of a configurable field; includes acronyms and examples requiring applicability review.'});}
 }
 entries.sort((a,b)=>a.id.localeCompare(b.id));
 const appFiles=new Map();for(const file of [...new Set(Object.values(WORKFLOWS).flatMap(value=>[...value.gui,...value.backend,...value.help]))].sort())read(applicationRoot,file,appFiles);
 const result={schemaVersion:1,producer:{path:'scripts/buildroot-coverage/manual-inventory.cjs',sha256:hash(Buffer.from(fs.readFileSync(__filename,'utf8').replace(/\r\n/g,'\n'))),normalization:'CRLF-to-LF for producer only; selected source hashes retain exact bytes'},source:{version,files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path))},application:{files:[...appFiles.values()]},scope:{state:'partial',meaning:'Complete lexical enumeration for the declared manual file set and patterns, not complete semantic understanding or runtime acceptance.',boundaries:['One selected Buildroot version; no all-version claim.','No AsciiDoc macro, command, conditional or automatic-anchor evaluation.','Paragraphs and multiline syntax are bound by whole-article hashes; topic extraction is deliberately lexical.','Source package/make references are lexical, not executable availability.','Every GUI/Easy-mode/help mapping is provisional and independently unfinished.','No source link traversal, native runtime call, build or arbitrary source execution.']},categories:CATEGORIES,requiredArticles:REQUIRED_ARTICLES,entries};
 const omissions=[];for(const category of CATEGORIES){const selected=entries.find(entry=>entry.category===category);if(!selected)throw Error(`Expected lexical category unavailable: ${category}`);const missing={...result,entries:entries.filter(entry=>entry.id!==selected.id)};try{validate(missing,result);}catch{omissions.push({category,id:selected.id,state:'rejected'});continue;}throw Error(`Omission accepted: ${category}`);}validate(result,result);result.completenessProof={omissions,restored:'passed',scope:'One selected actual detail per handwritten category; fixture tests additionally remove every fixture detail.'};return result;
}
function validate(actual,expected){
 for(const category of CATEGORIES)if(!actual.entries.some(e=>e.category===category))throw Error(`Missing category: ${category}`);
 for(const article of REQUIRED_ARTICLES)if(!actual.entries.some(e=>e.category==='manual-article'&&e.source.path==='docs/manual/'+article))throw Error(`Missing required article: ${article}`);
 const ids=new Set(actual.entries.map(e=>e.id));if(ids.size!==actual.entries.length)throw Error('Duplicate identity');for(const entry of expected.entries)if(!ids.has(entry.id))throw Error(`Missing source detail: ${entry.id}`);
 if(!require('node:util').isDeepStrictEqual(actual,expected))throw Error('Source binding, semantic detail or provisional disposition changed');return true;
}
function storeOrCheck(expected,directory,check=false){
 const metadata=Object.fromEntries(Object.entries(expected).filter(([key])=>key!=='entries')),shards=[];
 for(let offset=0;offset<expected.entries.length;offset+=100){const name=`details-${String(offset/100).padStart(3,'0')}.json`,text=JSON.stringify(expected.entries.slice(offset,offset+100),null,2)+'\n';shards.push({path:name,entries:Math.min(100,expected.entries.length-offset),sha256:hash(Buffer.from(text))});if(!check){fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,name),text);}}
 const index={...metadata,shards};
 if(check){const saved=JSON.parse(fs.readFileSync(path.join(directory,'index.json'),'utf8')),actual={...Object.fromEntries(Object.entries(saved).filter(([key])=>key!=='shards')),entries:[]};for(const shard of saved.shards){if(!/^details-\d{3}\.json$/.test(shard.path))throw Error('Unsafe shard path');const text=fs.readFileSync(path.join(directory,shard.path),'utf8').replace(/\r\n/g,'\n');if(hash(Buffer.from(text))!==shard.sha256)throw Error('Changed shard');actual.entries.push(...JSON.parse(text));}validate(actual,expected);if(JSON.stringify(saved)!==JSON.stringify(index))throw Error('Shard inventory mismatch');}
 else fs.writeFileSync(path.join(directory,'index.json'),JSON.stringify(index,null,2)+'\n');
 return index;
}
module.exports={inventory,validate,storeOrCheck,CATEGORIES,REQUIRED_ARTICLES};
if(require.main===module){const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1],source=arg('--source'),output=arg('--output');if(!args.includes('--source')||!args.includes('--output'))throw Error('Use --source <root> --output <inventory-directory> [--check]');const expected=inventory(source);storeOrCheck(expected,output,args.includes('--check'));console.log(`Buildroot ${expected.source.version}: ${expected.entries.length} manual/source details across ${expected.source.files.length} bound files; lexical coverage only.`);}
