'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function panel(result){const source=fs.readFileSync('src/renderer/project-workflow-panel.ts','utf8').replace(/^import[^;]+;\r?\n/gm,'').replace('export class ProjectWorkflowPanel','class ProjectWorkflowPanel');const html=()=>null;const context={LitElement:class{},html,css:html,nothing:null,workspaceStyles:null,customElements:{define(){}},window:{studio:{operations:async()=>({ok:true,result})}}};vm.createContext(context);vm.runInContext(stripTypeScriptTypes(source,{mode:'strip'})+'\nglobalThis.Panel=ProjectWorkflowPanel;',context);return new context.Panel();}
test('project bridge narrows list and object responses without accepting malformed results',async()=>{
 for(const value of [undefined,null,false,'text',42]){await assert.rejects(panel(value).request('project.options'),/INVALID_RESULT/);await assert.rejects(panel(value).request('project.list'),/INVALID_RESULT/);}
 const list=[{id:'selected'}];assert.equal(await panel(list).request('project.list'),list);await assert.rejects(panel(list).request('project.options'),/INVALID_RESULT/);
 const options={runtime:{kind:'wsl'}};assert.equal(await panel(options).request('project.options'),options);await assert.rejects(panel(options).request('project.list'),/INVALID_RESULT/);
});
test('source response validation preserves unsuccessful and cancelled outcomes',async()=>{await assert.rejects(panel({ok:false,code:'SOURCE_CHANGED'}).request('source'),/SOURCE_CHANGED/);await assert.rejects(panel({ok:false,code:42}).request('source'),/SOURCE_UNAVAILABLE/);await assert.rejects(panel({ok:true,cancelled:true}).request('source'),/CANCELLED/);const result={ok:true,workspaceId:'selected'};assert.equal(await panel(result).request('source'),result);});
