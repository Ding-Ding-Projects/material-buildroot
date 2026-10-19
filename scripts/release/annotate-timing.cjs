'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const BEGIN='<!-- workflow-timing:begin -->',END='<!-- workflow-timing:end -->';
const sha=/^[a-f0-9]{40}$/;
function timestamp(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Exact UTC timing unavailable.');return new Date(value).toISOString();}
function assertOriginal(run,jobs,repository){
 if(run.repository?.full_name!==repository||run.head_repository?.full_name!==repository||run.path!=='.github/workflows/release.yml'||!['push','workflow_dispatch'].includes(run.event)||run.status!=='completed'||run.conclusion!=='success'||!sha.test(run.head_sha||'')||![run.id,run.run_number,run.run_attempt].every(x=>Number.isSafeInteger(x)&&x>0))throw Error('Original release workflow identity is invalid.');
 if(!Array.isArray(jobs)||!jobs.length||jobs.some(j=>j.run_id!==run.id||j.head_sha!==run.head_sha||j.status!=='completed'||j.conclusion!=='success'))throw Error('Original jobs are not completely successful.');
}
function measure(run,jobs,repository){
 assertOriginal(run,jobs,repository);
 const starts=jobs.map(j=>timestamp(j.started_at)),ends=jobs.map(j=>timestamp(j.completed_at));
 const publication=jobs.flatMap(j=>(j.steps||[]).filter(s=>s.name==='Publish exact-source normal release'));
 if(publication.length!==1||publication[0].status!=='completed'||publication[0].conclusion!=='success')throw Error('Final publication step unavailable.');
 const started=starts.sort()[0],originalJobsCompleted=ends.sort().at(-1),publicationCompleted=timestamp(publication[0].completed_at),completed=publicationCompleted;
 if(Date.parse(originalJobsCompleted)<Date.parse(publicationCompleted)||Date.parse(publicationCompleted)<Date.parse(started)||jobs.some(j=>Date.parse(j.completed_at)<Date.parse(j.started_at)))throw Error('Original timing order invalid.');
 const seconds=Math.floor((Date.parse(completed)-Date.parse(started))/1000),duration=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(x=>String(x).padStart(2,'0')).join(':');
 return {started,completed,publicationCompleted,originalJobsCompleted,duration,runId:run.id,attempt:run.run_attempt,source:run.head_sha};
}
function block(t){return `${BEGIN}\nWorkflow started: ${t.started}\n\nWorkflow completed: ${t.completed}\n\nWorkflow duration: ${t.duration}\n\nOriginal workflow terminal jobs completed: ${t.originalJobsCompleted}\n\nTiming source: original release workflow ${t.runId}, attempt ${t.attempt}, source ${t.source}. Completion is the final release-publication step completion, after all asset/tag readbacks in that step. Duration ends exactly there. The separately labelled terminal-jobs completion additionally records final output collection; it is not substituted into the duration.\n\nTiming annotation and its readback are performed by a separate completion workflow; the times above do not claim that annotation workflow has completed. Annotation success requires exact release-note readback and its own terminal successful run.\n${END}`;}
function replace(body,t){if(typeof body!=='string'||body.length>500000)throw Error('Release body unavailable.');const a=body.indexOf(BEGIN),b=body.indexOf(END);if(a<0||b<a||body.indexOf(BEGIN,a+BEGIN.length)!==-1||body.indexOf(END,b+END.length)!==-1)throw Error('Unique owned timing block missing.');return body.slice(0,a)+block(t)+body.slice(b+END.length);}
function annotate({repository,event,api,edit}){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository||'')||event.action!=='completed'||event.repository?.full_name!==repository)throw Error('Completion event invalid.');
 const triggering=event.workflow_run;if(!triggering||!Number.isSafeInteger(triggering.id)||!Number.isSafeInteger(triggering.run_attempt))throw Error('Completion identity missing.');
 const run=api(`repos/${repository}/actions/runs/${triggering.id}/attempts/${triggering.run_attempt}`);
 if(run.id!==triggering.id||run.run_attempt!==triggering.run_attempt||run.head_sha!==triggering.head_sha)throw Error('Attempt readback mismatch.');
 const jobs=[],seen=new Set();let complete=false,total;
 for(let page=1;page<=20;page++){const value=api(`repos/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100&page=${page}`);if(!Number.isSafeInteger(value.total_count)||!Array.isArray(value.jobs)||value.jobs.length>100||total!==undefined&&total!==value.total_count)throw Error('Job inventory invalid.');total=value.total_count;for(const job of value.jobs){if(!Number.isSafeInteger(job.id)||seen.has(job.id))throw Error('Duplicate job inventory.');seen.add(job.id);jobs.push(job);}if(value.jobs.length<100){complete=true;break;}}
 if(!complete||jobs.length!==total)throw Error('Complete job inventory unavailable.');
 assertOriginal(run,jobs,repository);
 const publication=jobs.flatMap(job=>(job.steps||[]).filter(step=>step.name==='Publish exact-source normal release'));
 if(publication.length!==1||publication[0].status!=='completed')throw Error('Final publication step unavailable.');
 if(publication[0].conclusion==='skipped'){
  const eligibility=jobs.flatMap(job=>(job.steps||[]).filter(step=>step.name==='Determine exact-source publication eligibility'));
  if(eligibility.length!==1||eligibility[0].status!=='completed'||eligibility[0].conclusion!=='success')throw Error('Successful publication eligibility step unavailable.');
  return {state:'skipped',reason:'no-publication',runId:run.id,attempt:run.run_attempt,source:run.head_sha,annotation:'not-applicable-no-publication'};
 }
 const timing=measure(run,jobs,repository);
 // Read package metadata as JSON only. Never execute triggering-branch code.
 const pkg=api(`repos/${repository}/contents/package.json?ref=${run.head_sha}`,true);
 if(typeof pkg.version!=='string'||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version))throw Error('Source version invalid.');
 const tag=`v${pkg.version}-build.${run.run_number}.${run.run_attempt}`;
 const release=api(`repos/${repository}/releases/tags/${tag}`);
 if(release.draft!==false||release.prerelease!==false||release.tag_name!==tag||!release.body?.includes(`Source: ${run.head_sha}`)||!release.body.includes(`Original workflow: ${run.id}, attempt ${run.run_attempt}`))throw Error('Release source identity mismatch.');
 let object=api(`repos/${repository}/git/ref/tags/${tag}`).object;const tags=new Set();for(let i=0;object?.type==='tag'&&i<5;i++){if(!sha.test(object.sha)||tags.has(object.sha))throw Error('Tag chain invalid.');tags.add(object.sha);object=api(`repos/${repository}/git/tags/${object.sha}`).object;}if(object?.type!=='commit'||object.sha!==run.head_sha)throw Error('Exact release tag mismatch.');
 const assetIdentity=JSON.stringify(release.assets?.map(a=>({id:a.id,name:a.name,size:a.size,digest:a.digest})));if(!Array.isArray(release.assets)||!release.assets.some(a=>a.name==='Setup.exe'&&a.size>0))throw Error('Published installer missing.');
 const body=replace(release.body,timing);if(body!==release.body)edit(tag,body);
 const after=api(`repos/${repository}/releases/tags/${tag}`);if(after.id!==release.id||after.tag_name!==tag||after.draft!==false||after.prerelease!==false||after.body!==body||JSON.stringify(after.assets?.map(a=>({id:a.id,name:a.name,size:a.size,digest:a.digest})))!==assetIdentity)throw Error('Timing annotation readback mismatch.');
 return {tag,timing,annotation:'release-note-readback-verified; annotation workflow terminal result still separate'};
}
function main(){const repository=process.env.GITHUB_REPOSITORY,gh=process.env.MATERIAL_RELEASE_GH||'gh';let requests=0;const deadline=Date.now()+60000;function command(args){if(++requests>50||Date.now()>=deadline)throw Error('Timing annotation bound exceeded.');const r=cp.spawnSync(gh,args,{encoding:'utf8',windowsHide:true,timeout:Math.min(10000,deadline-Date.now()),maxBuffer:8*1024*1024});if(r.error||r.status!==0)throw Error('Timing annotation command failed.');return r.stdout;}const api=(route,raw=false)=>JSON.parse(command(['api',route,...(raw?['-H','Accept: application/vnd.github.raw+json']:[])]));const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));const directory=process.env.RUNNER_TEMP;if(!directory)throw Error('Owned temporary directory unavailable.');const result=annotate({repository,event,api,edit:(tag,body)=>{const file=path.join(directory,'release-timing-notes.md');fs.writeFileSync(file,body);command(['release','edit',tag,'--repo',repository,'--notes-file',file]);}});const evidence=path.join(directory,'release-timing-evidence');fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'annotation.json'),JSON.stringify(result,null,2)+'\n');if(result.state==='skipped')console.log(`Timing annotation skipped: no publication for workflow ${result.runId}, attempt ${result.attempt}; evidence retained.`);else console.log(`Timing annotation readback verified for ${result.tag}; annotation workflow completion remains separate.`);}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={measure,replace,annotate,BEGIN,END};
