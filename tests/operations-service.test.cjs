'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {createOperationsService}=require('../src/main/operations-service.cjs');
function fixture(t,{cancelled=false,hold=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'operations-'));const root=path.join(directory,'project'),source=path.join(root,'source'),output=path.join(root,'output');fs.mkdirSync(source,{recursive:true});fs.mkdirSync(output);const picks=[root,source,output];const calls=[];
 let finish;const completion=hold?new Promise(resolve=>{finish=()=>resolve({state:'succeeded',code:0});}):Promise.resolve({state:'succeeded',code:0});
 const execution={discover:async()=>({docker:{available:false},wsl:{distributions:[]}}),grantProject:input=>{calls.push(input);return {grantId:'host-only-grant'};},start:async(input,log)=>{calls.push(input);log?.({stream:'stdout',text:'actual adapter reply'});return {completion,cancel:async()=>({state:'cancelled'})};}};
 const service=createOperationsService({directory:path.join(directory,'state'),dialog:{showOpenDialog:async()=>({canceled:cancelled,filePaths:cancelled?[]:[picks.shift()]})},parentWindow:null,version:'0.1.0',source:null,execution});
 t.after(()=>{service.dispose();fs.rmSync(directory,{recursive:true,force:true});});return {request:r=>service.request(JSON.stringify(r)),calls,service,root,source,output,finish};
}
test('operations reject arbitrary actions, fields, paths and source execution without consent',async t=>{
 const f=fixture(t);for(const request of [{action:'execute',command:'anything'},{action:'runtime.discover',path:'/tmp'},{action:'project.adopt',selectionId:'forged',trust:true},{action:'tools',request:{action:'forge.publish'}}])assert.equal((await f.request(request)).ok,false);
 const chosen=await f.request({action:'project.choose'});assert.equal(chosen.ok,true);assert.equal((await f.request({action:'project.adopt',selectionId:chosen.result.selectionId,trust:false})).code,'SOURCE_CONSENT_REQUIRED');assert.equal(f.calls.length,0);
 const adopted=await f.request({action:'project.adopt',selectionId:chosen.result.selectionId,trust:true});assert.equal(adopted.ok,true);assert.equal(f.calls.length,1);assert.equal((await f.request({action:'project.adopt',selectionId:chosen.result.selectionId,trust:true})).ok,false);
 const forged=await f.request({action:'build.submit',workspaceId:adopted.result.workspaceId,target:'all;id',runtime:{kind:'wsl',distribution:'Ubuntu'},jobs:1});assert.equal(forged.code,'INVALID_TARGET');
});
test('admitted project routes build output into owned durable job records',async t=>{
 const f=fixture(t),selection=await f.request({action:'project.choose'}),adopted=await f.request({action:'project.adopt',selectionId:selection.result.selectionId,trust:true});
 const result=await f.request({action:'build.submit',workspaceId:adopted.result.workspaceId,target:'all',runtime:{kind:'wsl',distribution:'Ubuntu'},jobs:1});assert.equal(result.ok,true);
 let list;for(let i=0;i<20;i++){list=await f.request({action:'jobs.list'});if(list.result[0].state==='succeeded')break;await new Promise(r=>setTimeout(r,5));}
 assert.equal(list.result[0].state,'succeeded');const page=await f.request({action:'jobs.page',id:result.result.id,after:0,limit:50});assert.equal(page.result.records[0].value.text,'actual adapter reply');assert.equal(f.calls[1].grantId,'host-only-grant');
});
test('cancelled native picker creates no executable project',async t=>{const f=fixture(t,{cancelled:true});assert.equal((await f.request({action:'project.choose'})).code,'CANCELLED');assert.equal(f.calls.length,0);});
test('running build blocks configuration before any file mutation',async t=>{
 const f=fixture(t,{hold:true}),selection=await f.request({action:'project.choose'}),adopted=await f.request({action:'project.adopt',selectionId:selection.result.selectionId,trust:true});
 const file=path.join(f.output,'.config');fs.writeFileSync(file,'BR2_TEST=y\n');
 await f.request({action:'build.submit',workspaceId:adopted.result.workspaceId,target:'all',runtime:{kind:'wsl',distribution:'Ubuntu'},jobs:1});
 const result=await f.request({action:'config.apply',workspaceId:adopted.result.workspaceId,revision:'0'.repeat(64),changes:{BR2_TEST:{type:'bool',value:false}}});
 assert.equal(result.code,'PROJECT_BUSY');assert.equal(fs.readFileSync(file,'utf8'),'BR2_TEST=y\n');f.finish();
 for(let i=0;i<20;i++){if((await f.request({action:'jobs.list'})).result[0].state==='succeeded')break;await new Promise(r=>setTimeout(r,5));}
});
test('adopted directory identity is checked again before configuration reads',async t=>{
 const f=fixture(t),selection=await f.request({action:'project.choose'}),adopted=await f.request({action:'project.adopt',selectionId:selection.result.selectionId,trust:true});fs.renameSync(f.source,f.source+'-previous');fs.mkdirSync(f.source);
 assert.equal((await f.request({action:'config.inspect',workspaceId:adopted.result.workspaceId})).code,'PROJECT_PATH_CHANGED');
});
