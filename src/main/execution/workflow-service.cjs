"use strict";
const crypto=require('node:crypto');
const modelAPI=require('./workflow-model.cjs');
function createWorkflowService({setup}) {
  const previews=new Map(),admissions=new Map();
  const identity=s=>JSON.stringify({sourceRepository:s.sourceRepository,repository:s.repository,mode:s.mode,account:s.account,runner:s.runner});
  async function preview({selectionId,model,text}) {
    const selected=setup.selected(selectionId);
    if(!selected.runner)throw Error('WORKFLOW_RUNNER_REQUIRED');
    const admitted=text===null?modelAPI.normalizeModel(model):modelAPI.parseExpert(text,selected.runner);
    if(admitted.sourceRepository!==selected.sourceRepository)throw Error('WORKFLOW_SOURCE_MISMATCH');
    const source=await setup.sourceCommit(selectionId,admitted.sourceRevision);
    if(source.sha!==admitted.sourceRevision)throw Error('WORKFLOW_SOURCE_CHANGED');
    const repo=await setup.call(selectionId,{method:'GET',suffix:''});
    if(typeof repo.default_branch!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_./-]{0,199}$/.test(repo.default_branch)||repo.default_branch.includes('..'))throw Error('WORKFLOW_DESTINATION_REF');
    const head=await setup.call(selectionId,{method:'GET',suffix:`/commits/${encodeURIComponent(repo.default_branch)}`});
    if(!/^[a-f0-9]{40}$/.test(head.sha||''))throw Error('WORKFLOW_DESTINATION_REVISION');
    const yaml=modelAPI.generate(admitted,selected.runner),sha256=modelAPI.sha256(yaml);
    const workflow=`material-buildroot-${sha256.slice(0,24)}.yml`;
    // A directory listing distinguishes an occupied destination from transport/authentication failures.
    const tree=await setup.call(selectionId,{method:'GET',suffix:`/git/trees/${head.sha}?recursive=1`});
    if(!Array.isArray(tree.tree)||tree.truncated)throw Error('WORKFLOW_DESTINATION_INVENTORY');
    if(tree.tree.some(entry=>entry.path===`.github/workflows/${workflow}`))throw Error('WORKFLOW_DESTINATION_EXISTS');
    const previewId=crypto.randomUUID();
    for(const [id,p] of previews)if(p.expiresAt<Date.now())previews.delete(id);
    if(previews.size>=20)throw Error('WORKFLOW_PREVIEW_LIMIT');
    const result={previewId,selectionId,repository:selected.repository,sourceRepository:admitted.sourceRepository,sourceRevision:admitted.sourceRevision,workflow,workflowRef:repo.default_branch,baseRevision:head.sha,sha256,yaml,model:admitted,runner:selected.runner,expiresAt:Date.now()+300000};
    previews.set(previewId,{...structuredClone(result),identity:identity(selected)});
    return result;
  }
  async function publish({previewId,sha256,consent}) {
    const p=previews.get(previewId);
    if(!p||p.expiresAt<Date.now()||p.sha256!==sha256||consent!==true)throw Error('WORKFLOW_CONFIRMATION_REQUIRED');
    if(identity(setup.selected(p.selectionId))!==p.identity)throw Error('WORKFLOW_SELECTION_CHANGED');
    const head=await setup.call(p.selectionId,{method:'GET',suffix:`/commits/${encodeURIComponent(p.workflowRef)}`});
    if(head.sha!==p.baseRevision)throw Error('WORKFLOW_DESTINATION_CHANGED');
    const source=await setup.sourceCommit(p.selectionId,p.sourceRevision);
    if(source.sha!==p.sourceRevision)throw Error('WORKFLOW_SOURCE_CHANGED');
    // Consume before the write. An uncertain response cannot accidentally retry a mutation.
    previews.delete(previewId);
    const response=await setup.call(p.selectionId,{method:'PUT',suffix:`/contents/.github/workflows/${p.workflow}`,body:{message:'Add explicitly confirmed Buildroot execution workflow',content:Buffer.from(p.yaml).toString('base64'),branch:p.workflowRef}});
    if(!/^[a-f0-9]{40}$/.test(response?.commit?.sha||''))throw Error('WORKFLOW_PUBLICATION_UNVERIFIED');
    const workflowRevision=response.commit.sha;
    const saved=await setup.call(p.selectionId,{method:'GET',suffix:`/contents/.github/workflows/${p.workflow}?ref=${workflowRevision}`});
    if(saved?.encoding!=='base64'||typeof saved.content!=='string'||saved.content.length>100000||Buffer.from(saved.content,'base64').toString('utf8')!==p.yaml)throw Error('WORKFLOW_PUBLICATION_UNVERIFIED');
    const record={selectionId:p.selectionId,repository:p.repository,workflow:p.workflow,workflowRef:p.workflowRef,workflowRevision,sourceRevision:p.sourceRevision,sourceRepository:p.sourceRepository,target:p.model.target,defconfig:p.model.defconfig,parallelism:p.model.parallelism,sha256:p.sha256};
    admissions.set(p.selectionId,{record,identity:p.identity});
    return structuredClone(record);
  }
  function admission({selectionId}) {
    const value=admissions.get(selectionId);
    if(!value||identity(setup.selected(selectionId))!==value.identity)throw Error('WORKFLOW_ADMISSION_REQUIRED');
    return structuredClone(value.record);
  }
  return {preview,publish,admission};
}
module.exports={createWorkflowService};
