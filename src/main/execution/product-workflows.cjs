"use strict";
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const YAML=require('yaml');
function normalizeModel(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join('|')!=='sourceRepository|sourceRevision|target')throw Error('PRODUCT_WORKFLOW_FIELDS');
 if(typeof v.sourceRepository!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(v.sourceRepository))throw Error('PRODUCT_WORKFLOW_SOURCE');
 if(typeof v.sourceRevision!=='string'||!/^[a-f0-9]{40}$/.test(v.sourceRevision)||!['build','installer'].includes(v.target))throw Error('PRODUCT_WORKFLOW_OPTIONS');
 return {sourceRepository:v.sourceRepository,sourceRevision:v.sourceRevision,target:v.target};
}
function runnerLabels(r){
 if(r?.kind==='hosted'&&JSON.stringify(r.labels)==='["windows-2022"]')return [...r.labels];
 if(r?.kind!=='self-hosted'||!Array.isArray(r.labels)||r.labels.length>8||!['self-hosted','Windows','X64'].every(x=>r.labels.includes(x))||r.labels.some(x=>typeof x!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(x)))throw Error('PRODUCT_WORKFLOW_RUNNER');
 return [...r.labels];
}
function document(model,runner){const m=normalizeModel(model);return {
 name:'Material Buildroot product production',on:{workflow_dispatch:{}},permissions:{contents:'read'},
 env:{SOURCE_REPOSITORY:m.sourceRepository,SOURCE_REVISION:m.sourceRevision,PRODUCT_TARGET:m.target},
 jobs:{product:{'runs-on':runnerLabels(runner),'timeout-minutes':120,steps:[
 {name:'Checkout immutable product source',uses:'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',with:{repository:m.sourceRepository,ref:m.sourceRevision,path:'source','persist-credentials':false,submodules:false}},
 {name:'Confirm source and entrypoints',shell:'pwsh',run:'$ErrorActionPreference = "Stop"\nif ((git -C source rev-parse HEAD) -ne $env:SOURCE_REVISION) { throw "Source revision changed" }\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\nif (!(Test-Path -LiteralPath "source/build.bat") -or !(Test-Path -LiteralPath "source/build-installer.bat")) { throw "Product entrypoints unavailable" }'},
 {name:m.target==='installer'?'Produce unsigned Squirrel installer':'Build product',shell:'cmd','working-directory':'source',run:m.target==='installer'?'call build-installer.bat /s':'call build.bat /s'}
 ]}}};}
function stable(value) { return Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')}}`:JSON.stringify(value); }
function generate(model,runner) { return YAML.stringify(document(model,runner),{version:'1.2',lineWidth:0}); }
function parseExpert(text,runner) {
  if(typeof text!=='string'||Buffer.byteLength(text)>65536) throw Error('WORKFLOW_SIZE');
  let parsed;
  try {
    const docs=YAML.parseAllDocuments(text,{version:'1.2',schema:'core',uniqueKeys:true,strict:true,customTags:[]});
    if(docs.length!==1||docs[0].errors.length||docs[0].warnings.length)throw Error();
    let count=0;
    function bounded(node,depth=0){
      if(depth>20||++count>2000||YAML.isAlias(node)||node?.tag||node?.anchor)throw Error();
      if(YAML.isMap(node)){for(const pair of node.items){if(!YAML.isScalar(pair.key)||typeof pair.key.value!=='string'||['__proto__','prototype','constructor','<<'].includes(pair.key.value))throw Error();bounded(pair.value,depth+1);}}
      else if(YAML.isSeq(node)){for(const item of node.items)bounded(item,depth+1);}
    }
    bounded(docs[0].contents);
    parsed=docs[0].toJS({maxAliasCount:0});
  } catch { throw Error('WORKFLOW_EXPERT_SYNTAX'); }
  const env=parsed?.env;
  const model=normalizeModel({sourceRepository:env?.SOURCE_REPOSITORY,sourceRevision:env?.SOURCE_REVISION,target:env?.PRODUCT_TARGET});
  if(stable(parsed)!==stable(document(model,runner)))throw Error('WORKFLOW_UNADMITTED_ACTION');
  return model;
}
function sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}

function createProductWorkflows({setup,dialog,parentWindow}){
 const previews=new Map();const identity=s=>JSON.stringify(s);
 async function preview({selectionId,model,text}){
 const selection=setup.selected(selectionId);
 if(selection.sourcePrivate)throw Error('PRIVATE_PRODUCT_EXECUTION_REQUIRES_ENCRYPTED_BUILDER');
 const m=text===null?normalizeModel(model):parseExpert(text,selection.runner);
 if(m.sourceRepository!==selection.sourceRepository)throw Error('PRODUCT_SOURCE_MISMATCH');
 await setup.sourceCommit(selectionId,m.sourceRevision);
 const repo=await setup.call(selectionId,{suffix:''});
 if(typeof repo.default_branch!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_./-]{0,199}$/.test(repo.default_branch)||repo.default_branch.includes('..'))throw Error('PRODUCT_DESTINATION_REF');
 const head=await setup.call(selectionId,{suffix:'/commits/'+encodeURIComponent(repo.default_branch)});
 if(!/^[a-f0-9]{40}$/.test(head.sha||''))throw Error('PRODUCT_DESTINATION_REVISION');
 const yaml=generate(m,selection.runner),digest=sha256(yaml),workflow='product-'+digest.slice(0,24)+'.yml';
 const tree=await setup.call(selectionId,{suffix:'/git/trees/'+head.sha+'?recursive=1'});
 if(!Array.isArray(tree.tree)||tree.truncated||tree.tree.some(e=>e.path==='.github/workflows/'+workflow))throw Error('PRODUCT_DESTINATION_OCCUPIED_OR_UNVERIFIED');
 for(const [id,p] of previews)if(p.expiresAt<Date.now())previews.delete(id);
 if(previews.size>=20)throw Error('PRODUCT_PREVIEW_LIMIT');
 const result={previewId:crypto.randomUUID(),selectionId,repository:selection.repository,workflow,workflowRef:repo.default_branch,baseRevision:head.sha,sourceRevision:m.sourceRevision,sha256:digest,yaml,model:m,runner:selection.runner,expiresAt:Date.now()+300000};
 previews.set(result.previewId,{...result,identity:identity(selection)});return structuredClone(result);
 }
 function admitted(r){const p=previews.get(r.previewId);if(!p||p.expiresAt<Date.now()||p.sha256!==r.sha256||r.consent!==true||identity(setup.selected(p.selectionId))!==p.identity)throw Error('PRODUCT_CONFIRMATION_REQUIRED');return p;}
 async function publish(r){const p=admitted(r);const head=await setup.call(p.selectionId,{suffix:'/commits/'+encodeURIComponent(p.workflowRef)});if(head.sha!==p.baseRevision)throw Error('PRODUCT_DESTINATION_CHANGED');await setup.sourceCommit(p.selectionId,p.sourceRevision);previews.delete(p.previewId);
 const result=await setup.call(p.selectionId,{method:'PUT',suffix:'/contents/.github/workflows/'+p.workflow,body:{message:'Add confirmed product production workflow',content:Buffer.from(p.yaml).toString('base64'),branch:p.workflowRef}});
 if(!/^[a-f0-9]{40}$/.test(result?.commit?.sha||''))throw Error('PRODUCT_WRITE_UNVERIFIED');
 const saved=await setup.call(p.selectionId,{suffix:'/contents/.github/workflows/'+p.workflow+'?ref='+result.commit.sha});
 if(saved?.encoding!=='base64'||typeof saved.content!=='string'||saved.content.length>100000||Buffer.from(saved.content,'base64').toString('utf8')!==p.yaml)throw Error('PRODUCT_WRITE_UNVERIFIED');
 return {workflowRevision:result.commit.sha,repository:p.repository,workflow:p.workflow};}
 let exporting=false;
 async function exportYaml(r){const p=admitted(r);if(exporting||!dialog?.showSaveDialog)throw Error('PRODUCT_EXPORT_UNAVAILABLE');exporting=true;try{const options={title:'Export product workflow',defaultPath:p.workflow,filters:[{name:'YAML workflow',extensions:['yml']}]};const parent=parentWindow;const chosen=parent?await dialog.showSaveDialog(parent,options):await dialog.showSaveDialog(options);if(chosen.canceled||!chosen.filePath)return {cancelled:true};admitted(r);await fs.writeFile(chosen.filePath,p.yaml,{encoding:'utf8',flag:'wx'});return {exported:true,sha256:p.sha256};}finally{exporting=false;}}
 return {preview,publish,exportYaml};
}
module.exports={createProductWorkflows,normalizeModel,generate,parseExpert,runnerLabels};
