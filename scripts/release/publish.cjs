'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {prepare}=require('./prepare.cjs');
const {verifyPhoto,stagePhotoReference}=require('./photo.cjs');
const root=path.resolve(__dirname,'../..'),gh=process.env.MATERIAL_RELEASE_GH||'gh',repository=process.env.GITHUB_REPOSITORY,source=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID,number=process.env.GITHUB_RUN_NUMBER,attempt=process.env.GITHUB_RUN_ATTEMPT;
function command(exe,args){const r=cp.spawnSync(exe,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});if(r.error||r.status!==0)throw Error(`Release command failed: ${args[0]}`);return r.stdout.trim();}
const api=route=>JSON.parse(command(gh,['api',route]));
function duration(start,end){const seconds=Math.floor((Date.parse(end)-Date.parse(start))/1000);if(!Number.isSafeInteger(seconds)||seconds<0)throw Error('Workflow timing is unavailable.');return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');}
let dishNote;
function notes(provenance,timing){return `# Material Buildroot ${provenance.version}\n\nWindows x64 desktop workspace with practical onboarding, durable project plans, package and guest canvas editors, typed configuration, source-management workflows, build queue and recovery services, local-model tools, and offline documentation. Personal vocabulary and shared-preference controls are included; scheduled language/theme host services are present, while their graphical editor remains in development.\n\nDownload Setup.exe for the unsigned Squirrel.Windows installer. RELEASES and full packages are included, with generated delta packages when available. Unknown-publisher or SmartScreen warnings may appear. Native installation/update behavior, successful WSL or Docker Buildroot execution, and guest lifecycle acceptance remain unverified. Linux source and browser checks have separate evidence; a successful packaging workflow does not complete the product roadmap.\n\nSource: ${source}\n\n${provenance.checks}\n\n${dishNote}\n\n${timing}\n`;}
function main(){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository||'')||!/^[0-9a-f]{40}$/.test(source||'')||![run,number,attempt].every(v=>/^\d+$/.test(v||'')))throw Error('Trusted workflow identity is unavailable.');
 command('git',['fetch','origin','main']);const main=command('git',['rev-parse','origin/main']);const ancestry=cp.spawnSync('git',['merge-base','--is-ancestor',main,source],{cwd:root,windowsHide:true});if(ancestry.status!==0)command('git',['merge-base','--is-ancestor',source,main]);
 const {output,provenance}=prepare(root,source),tag=`v${provenance.version}-build.${number}.${attempt}`;
 const photo=verifyPhoto(root,source,{project:repository,releaseTag:tag});dishNote=photo.note;
 const assets=stagePhotoReference(output,provenance,photo);
 const jobs=api(`repos/${repository}/actions/runs/${run}/attempts/${attempt}/jobs`);const starts=jobs.jobs.map(j=>j.started_at).filter(Boolean).sort();const started=starts[0];if(!started||!Number.isFinite(Date.parse(started)))throw Error('Workflow first-job start is unavailable.');
 const body=path.join(root,'.cache/release-notes.md');fs.mkdirSync(path.dirname(body),{recursive:true});fs.writeFileSync(body,notes(provenance,`Workflow started: ${started}\n\nWorkflow completed: publication in progress\n\nWorkflow duration: unavailable until publication completes`));
 command(gh,['release','create',tag,...assets,'--repo',repository,'--target',source,'--title',`Material Buildroot ${provenance.version} · Build ${number}.${attempt}`,'--notes-file',body]);
 const completed=new Date().toISOString();fs.writeFileSync(body,notes(provenance,`Workflow started: ${started}\n\nWorkflow completed: ${completed}\n\nWorkflow duration: ${duration(started,completed)}`));command(gh,['release','edit',tag,'--repo',repository,'--notes-file',body]);
 const release=JSON.parse(command(gh,['release','view',tag,'--repo',repository,'--json','isDraft,isPrerelease,assets,url']));if(release.isDraft||release.isPrerelease)throw Error('Release classification is invalid.');
 const uploaded=api('repos/'+repository+'/releases/tags/'+tag).assets;
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 let downloadDirectory;
 for(const file of assets){const name=path.basename(file),stat=fs.statSync(file),asset=uploaded.find(a=>a.name===name&&a.size===stat.size);if(!asset)throw Error('Release asset readback mismatch.');const expected=hash(file);if(asset.digest!==null&&asset.digest!==undefined){if(asset.digest!=='sha256:'+expected)throw Error('Uploaded asset digest mismatch.');}else{if(!downloadDirectory)downloadDirectory=fs.mkdtempSync(path.join(root,'.cache/release-readback-'));command(gh,['release','download',tag,'--repo',repository,'--pattern',name,'--dir',downloadDirectory]);if(hash(path.join(downloadDirectory,name))!==expected)throw Error('Downloaded release asset digest mismatch.');}}

 let object=api(`repos/${repository}/git/ref/tags/${tag}`).object;const seen=new Set();for(let depth=0;object.type==='tag'&&depth<5;depth++){if(seen.has(object.sha))throw Error('Tag cycle.');seen.add(object.sha);object=api(`repos/${repository}/git/tags/${object.sha}`).object;}if(object.type!=='commit'||object.sha!==source)throw Error('Release tag source mismatch.');
 console.log(`Published normal release: ${release.url}`);
}
try{main();}catch(error){console.error(error.message);process.exitCode=1;}
