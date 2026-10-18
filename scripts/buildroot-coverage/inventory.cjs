'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const CATEGORIES = Object.freeze(['filesystem-option','bootloader-option','package-field','package-infrastructure','make-target','parser-capability']);
const PARSER_CAPABILITIES = Object.freeze(['menus','comments','choices','symbol-types','effective-values','assignability','help','dependencies','visibility','ranges','defaults','source-locations','select-imply','requested-values','complete-source-enumeration']);
const REFERENCES = Object.freeze({
  configuration:['src/renderer/configuration-panel.ts','src/main/configuration/index.cjs','scripts/configuration/inspect.py'],
  package:['src/renderer/package-panel.ts','src/renderer/package-discovery-panel.ts','src/main/configuration/package-authoring.cjs','src/main/configuration/package-discovery.cjs'],
  target:['src/renderer/build-queue-panel.ts','src/main/build/target-actions.cjs','src/main/execution/index.cjs']
});
function read(root, relative, files) {
  const file = path.join(root, relative), stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe or unavailable source file: ${relative}`);
  const bytes = fs.readFileSync(file); files.set(relative,{path:relative,sha256:hash(bytes),bytes:bytes.length});
  return bytes.toString('utf8');
}
function walk(root, relative) {
  return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry => {
    const item = `${relative}/${entry.name}`;
    if(entry.isSymbolicLink()) return [];
    return entry.isDirectory()?walk(root,item):entry.isFile()?[item]:[];
  }).sort();
}
function disposition(category, name, details={}) {
  const configuration=category.endsWith('-option');
  const consumers=configuration?REFERENCES.configuration:category.startsWith('package-')?REFERENCES.package:category==='make-target'?REFERENCES.target:['scripts/configuration/inspect.py'];
  const special = name.startsWith('BR2_TARGET_ROOTFS_ISO9660');
  const result = {
    gui:{state:'partial',consumers,reason:configuration?'Generic source-backed configuration controls exist; independent option interaction and output acceptance are unverified.':category.startsWith('package-')?'Typed package editing and safe unsupported-source discovery exist; this individual source topic has not been admitted.':category==='make-target'?'A validated fixed target catalog exists; source rule discovery does not establish this target is admitted or executable.':'Parser output exposes some semantics; this capability needs independent admission.'},
    easyMode:{state:'missing',discovery:configuration?'Discover type, choices, visibility, ranges, dependencies and current effective value from the admitted Kconfig graph.':category.startsWith('package-')?'Discover current recipe and supported infrastructure without rewriting unknown fields.':'Discover admitted availability and prerequisites from the selected source and runtime.',control:details.type==='bool'?'Labeled switch with prerequisite explanation':details.type==='string'?'Prefilled validated field with browse or discovered-choice dropdown where applicable':'Source-derived labeled selection with official icon when available',question:details.prompt?`Do you want to configure ${details.prompt}?`:`What should ${name} do for this project?`,recommendedDefault:'Use the selected source default or current effective value; never infer a universal default.',prefill:details.defaults||[],icon:'unverified; use an available official icon with a text label, never an unexplained icon-only choice',validation:'Reconcile with the selected native configuration or admitted operation; show requested/effective differences and preserve the previous configuration on failure.'},
    help:{state:'partial',sourceHelp:details.help||null,needed:special?'Explain BIOS versus EFI, bootloader modules and CD root, initrd versus direct read-only root, hybrid restrictions, generated output and separate boot verification.':'Explain purpose, default, architecture/dependency restrictions, hidden choices, interactions, failure recovery and the exact output or state changed.',consumer:configuration?'src/renderer/configuration-panel.ts':category.startsWith('package-')?'src/renderer/package-panel.ts':'src/renderer/build-queue-panel.ts'},
    runtime:{state:'unverified',reason:'No per-detail runtime receipt is attached by this source inventory.'},
    roadmap:configuration?['PH06-T01','PH06-T02',special?'PH07-T02':'PH06-T07']:category.startsWith('package-')?['PH06-T05']:category==='make-target'?['PH06-T06','PH05-T06']:['PH06-T01','PH01-T05']
  };
  const typedFields=new Set(['VERSION','SOURCE','SITE','LICENSE','LICENSE_FILES','DEPENDENCIES','PATCH','CONF_OPTS']);
  if(category==='package-field'){
    result.gui.state=typedFields.has(name)?'partial':'missing';
    result.gui.reason=typedFields.has(name)?'Related typed authoring field exists; exact upstream variable round-trip and infrastructure-specific semantics need admission.':'No dedicated typed authoring field admitted for this documented variable; safe discovery may preserve it for manual editing.';
  }
  if(category==='package-infrastructure'){
    result.gui.state=['generic','autotools','cmake','meson','cargo','golang','python'].includes(name)?'partial':'missing';
    result.gui.reason=result.gui.state==='partial'?'Infrastructure has a typed selection; complete options and actual generated-package build remain unverified.':'No dedicated typed infrastructure choice exists in the current authoring model.';
  }
  if(category==='make-target'){
    const admitted=['all','sdk','clean','olddefconfig','linux-olddefconfig','busybox-oldconfig','uboot-olddefconfig','savedefconfig','legal-info','source','show-info','graph-depends'];
    result.gui.state=admitted.includes(name)?'partial':'unverified';
    result.gui.reason=admitted.includes(name)?'Named execution target is admitted; per-source availability, Easy-mode guidance and actual outcome need independent proof.':'Not found in the fixed named execution list; generated package actions and source conditionals require separate admission.';
  }
  const easy={
    BR2_TARGET_ROOTFS_ISO9660:['How should this computer start your image?','Discover selected architecture, Linux kernel and GRUB2/ISOLINUX prerequisites; offer only eligible choices with a plain explanation.'],
    BR2_TARGET_ROOTFS_ISO9660_BOOT_MENU:['Which boot menu should people see?','Prefill the source default for the selected bootloader, provide a file picker and explain kernel/initrd placeholders.'],
    BR2_TARGET_ROOTFS_ISO9660_INITRD:['Should the running root filesystem live in memory?','Prefill the effective source default; explain memory use, writable RAM and the alternative read-only optical root.'],
    BR2_TARGET_ROOTFS_ISO9660_TRANSPARENT_COMPRESSION:['Should files on the optical image be compressed?','Only offer when neither external initrd nor integrated initramfs is selected; explain required kernel support.'],
    BR2_TARGET_ROOTFS_ISO9660_HYBRID:['Should the same image also start from a USB drive?','Offer only for the source-supported ISOLINUX path; do not promise EFI or USB boot without runtime proof.'],
    SITE_METHOD:['Where should the package source come from?','Discover supported download methods from the selected source; offer a labeled method dropdown and validate its matching location and revision.'],
    INSTALL_STAGING:['Does another package need headers or libraries from this package?','Explain staging versus the final target and show the required installation steps.'],
    USERS:['Which service account does this package need?','Discover existing account tables; offer a structured account editor and validate identity collisions without exposing credentials.'],
    DEVICES:['Does this package need device nodes?','Use a structured table with source-supported device type, major/minor and ownership validation.'],
    PERMISSIONS:['Who should own and access these installed paths?','Discover package paths and users; offer permissions controls and explain unsafe permission combinations.']
  };
  if(easy[name]){result.easyMode.question=easy[name][0];result.easyMode.discovery=easy[name][1];}
  return result;
}
function inventory(root,{sourceRevision=null,applicationRoot=path.resolve(__dirname,'../..')}={}) {
  const files=new Map(), entries=[];
  const makefile=read(root,'Makefile',files), version=makefile.match(/^export BR2_VERSION\s*:?=\s*(\S+)/m)?.[1];
  if(!version) throw new Error('Buildroot source version unavailable');
  for(const [directory,category] of [['fs','filesystem-option'],['boot','bootloader-option']]) {
    // Keep the index itself bound even when an include names no symbols.
    read(root,`${directory}/Config.in`,files);
    for(const file of walk(root,directory).filter(file=>/\/Config\.in(?:\.[^/]*)?$/.test(file))) {
      const text=read(root,file,files), lines=text.split(/\r?\n/);
      for(let index=0;index<lines.length;index++) {
        const match=lines[index].match(/^(?:menuconfig|config)\s+(\w+)/); if(!match)continue;
        let end=index+1;while(end<lines.length&&!/^(?:config|menuconfig|choice|endchoice|menu|endmenu|if|endif|comment|source)\b/.test(lines[end]))end++;
        const block=lines.slice(index,end).join('\n');
        const details={type:block.match(/^\s+(bool|tristate|string|hex|int)\b/m)?.[1]||'unknown',prompt:block.match(/^\s+(?:bool|tristate|string|hex|int|prompt)\s+"([^"]*)"/m)?.[1]||null,defaults:[...block.matchAll(/^\s+default\s+(.+)$/gm)].map(m=>m[1]),dependencies:[...block.matchAll(/^\s+depends on\s+(.+)$/gm)].map(m=>m[1]),selects:[...block.matchAll(/^\s+(?:select|imply)\s+(.+)$/gm)].map(m=>m[1]),help:block.match(/^\s+help\s*\n([\s\S]*)/m)?.[1]?.trim()||null,raw:block};
        const baseId=`${category}:${file}:${match[1]}`, occurrence=entries.filter(entry=>entry.id===baseId||entry.id.startsWith(baseId+':definition:')).length;
        entries.push({id:occurrence?`${baseId}:definition:${occurrence+1}`:baseId,category,name:match[1],source:{path:file,line:index+1,sha256:files.get(file).sha256},details,...disposition(category,match[1],details)});
      }
    }
  }
  const manuals=walk(root,'docs/manual').filter(file=>/\/adding-packages-[^/]+\.adoc$/.test(file));
  const fields=new Map();
  for(const file of manuals) {
    const text=read(root,file,files), lines=text.split(/\r?\n/);
    const infrastructure=file.slice('docs/manual/adding-packages-'.length,-5);
    if(/\$\(eval\s+\$\([^)]+-package\)/.test(text)||['generic','autotools','cmake','meson','cargo','golang','python'].includes(infrastructure)) {
      entries.push({id:`package-infrastructure:${infrastructure}`,category:'package-infrastructure',name:infrastructure,source:{path:file,line:1,sha256:files.get(file).sha256},details:{discovery:'Documentation topic, not proof of an executable infrastructure or complete GUI support.'},...disposition('package-infrastructure',infrastructure)});
    }
    lines.forEach((line,index)=>{for(const match of line.matchAll(/\b(?:HOST_)?(?:LIBFOO|FOO)_([A-Z][A-Z0-9_]*)\b/g)) {
      const name=match[1], locations=fields.get(name)||[];
      locations.push({path:file,line:index+1,sha256:files.get(file).sha256,excerpt:line.trim()});fields.set(name,locations);
    }});
  }
  for(const [name,locations] of fields)entries.push({id:`package-field:${name}`,category:'package-field',name,source:locations[0],details:{locations,discovery:'Documented FOO/LIBFOO variable examples; dynamic variables and other example prefixes are not exhaustively parsed.'},...disposition('package-field',name)});
  const makefiles=['Makefile',...walk(root,'support').filter(file=>/\/(?:[^/]+\.mk|Makefile)$/.test(file)),...walk(root,'fs').filter(file=>file.endsWith('.mk')),...walk(root,'package').filter(file=>/^package\/pkg-[^/]+\.mk$/.test(file))];
  for(const file of makefiles) {
    const text=read(root,file,files);text.split(/\r?\n/).forEach((line,index)=>{
      if(!/^[A-Za-z0-9_.%$({/-][^=]*:(?!=)/.test(line)||line.trimStart().startsWith('#'))return;
      const lhs=line.slice(0,line.indexOf(':')).trim();if(lhs.includes('='))return;
      for(const name of lhs.split(/\s+/).filter(Boolean)) {const baseId=`make-target:${file}:${name}`,occurrence=entries.filter(entry=>entry.id===baseId||entry.id.startsWith(baseId+':definition:')).length;entries.push({id:occurrence?`${baseId}:definition:${occurrence+1}`:baseId,category:'make-target',name,source:{path:file,line:index+1,sha256:files.get(file).sha256},details:{rule:line,discovery:'Lexical rule candidate; make expansion, conditional availability, generated and included rules require native admission.'},...disposition('make-target',name)});}
    });
  }
  for(const name of PARSER_CAPABILITIES) {
    const partial=['source-locations','select-imply','requested-values','complete-source-enumeration'].includes(name);
    entries.push({id:`parser-capability:${name}`,category:'parser-capability',name,source:{path:'scripts/configuration/inspect.py',line:1,owner:'application'},details:{state:partial?'missing':'partial',reason:partial?'Not emitted as an exhaustive independently admitted parser field.':'Emitted by the current adapter; source-wide parity and per-consumer behavior remain unverified.'},...disposition('parser-capability',name)});
  }
  entries.sort((a,b)=>a.id.localeCompare(b.id));
  const sourceFiles=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path));
  const applicationFiles=new Map();
  for(const file of [...new Set([...Object.values(REFERENCES).flat(),'src/main/configuration/package-recipe-options.cjs','src/main/deployment/conversion-exports.cjs'])].sort())read(applicationRoot,file,applicationFiles);
  return {schemaVersion:1,source:{version,revision:sourceRevision,contentSha256:hash(JSON.stringify(sourceFiles)),files:sourceFiles},applicationConsumers:{contentSha256:hash(JSON.stringify([...applicationFiles.values()])),files:[...applicationFiles.values()]},scope:{state:'partial',boundaries:['One selected source version only; no all-version compatibility claim.','Filesystem and bootloader Config.in lexical declarations; not a complete Kconfig evaluation or reachable include graph.','Package documentation examples and infrastructure topics, not every Make variable.','Selected lexical make rules, not every expanded target.','No symlinks are followed; native Windows source-transfer limitations remain unresolved.','GUI references name current candidate consumers, not per-detail delivery proof.','No runtime, output boot, accessibility or Easy-mode acceptance is implied.']},categories:CATEGORIES,entries};
}
function validate(manifest,expected,{applicationRoot}={}) {
  if(manifest.schemaVersion!==1||manifest.source.contentSha256!==expected.source.contentSha256)throw new Error('Source binding mismatch');
  const ids=new Set();for(const entry of manifest.entries){if(ids.has(entry.id))throw new Error('Duplicate detail');ids.add(entry.id);if(!['partial','missing','unverified','supported'].includes(entry.gui?.state)||!entry.easyMode?.question||!entry.help?.needed||entry.runtime?.state!=='unverified')throw new Error(`Incomplete disposition: ${entry.id}`);if(applicationRoot)for(const file of entry.gui.consumers)if(!fs.existsSync(path.join(applicationRoot,file)))throw new Error(`Missing consumer: ${file}`);}
  for(const category of CATEGORIES)if(!manifest.entries.some(entry=>entry.category===category))throw new Error(`Missing category: ${category}`);
  for(const entry of expected.entries)if(!ids.has(entry.id))throw new Error(`Missing source detail: ${entry.id}`);
  if(manifest.entries.length!==expected.entries.length)throw new Error('Unexpected detail');
  // Do not permit an edited status or stripped source semantics to pass by retaining the ID.
  if(JSON.stringify(manifest)!==JSON.stringify(expected))throw new Error('Inventory differs from source-derived dispositions');
  return true;
}
module.exports={inventory,validate,CATEGORIES,PARSER_CAPABILITIES};
if(require.main===module){
  const args=process.argv.slice(2), option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  const root=option('--source'),output=option('--output');if(!root||!output)throw new Error('Use --source <Buildroot root> --output <JSON> [--source-revision <revision>] [--check]');
  const expected=inventory(path.resolve(root),{sourceRevision:option('--source-revision')||null});
  if(args.includes('--check'))validate(JSON.parse(fs.readFileSync(output,'utf8')),expected,{applicationRoot:path.resolve(__dirname,'../..')});
  else{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(expected,null,2)+'\n');}
  console.log(`Buildroot ${expected.source.version}: ${expected.entries.length} source details, ${expected.source.files.length} bound files; partial inventory, runtime unverified.`);
}
