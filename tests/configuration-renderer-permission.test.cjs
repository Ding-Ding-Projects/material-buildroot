'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const {createOperationsService}=require('../src/main/operations-service.cjs');
// Execute the actual renderer methods against the real dispatcher, not a mock
// that accepts missing IPC fields. No source-controlled command is executed.
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/operations-panel.ts'),'utf8');
const methods=source.slice(source.indexOf('  private async grantConfigTrust()'),source.indexOf('  private async inspectConfig()'));
const Client=new Function(stripTypeScriptTypes('class Client {'+methods+'}\n')+'return Client;')();
test('renderer permission grant and revoke satisfy the real exact IPC schema',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'configuration-renderer-permission-'));
 let service;t.after(async()=>{await service?.dispose();fs.rmSync(directory,{recursive:true,force:true});});
 const root=path.join(directory,'project'),sourceRoot=path.join(root,'source'),output=path.join(root,'output');
 fs.mkdirSync(sourceRoot,{recursive:true});fs.mkdirSync(output);fs.writeFileSync(path.join(sourceRoot,'Makefile'),'BR2_VERSION = 2025.02.1\n');fs.writeFileSync(path.join(output,'.config'),'BR2_x86_64=y\n');
 const picks=[root,sourceRoot,output];let executions=0;
 service=createOperationsService({directory:path.join(directory,'state'),dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[picks.shift()]})},version:'0.1.0',execution:{grantProject:()=>({grantId:'fixture-grant'}),start:async()=>{executions++;throw Error('Unexpected execution');}}});
 const request=value=>service.request(JSON.stringify(value));
 const chosen=await request({action:'project.choose'});assert.equal(chosen.ok,true);
 const adopted=await request({action:'project.adopt',selectionId:chosen.result.selectionId,trust:true});assert.equal(adopted.ok,true);const workspaceId=adopted.result.workspaceId;
 const runtime=await request({action:'project.runtime',workspaceId,runtime:{kind:'wsl',distribution:'Fixture'}});assert.equal(runtime.ok,true);
 const preview=await request({action:'config.trustPreview',workspaceId,domain:'buildroot'});assert.equal(preview.ok,true);
 const client=new Client();Object.assign(client,{workspace:{workspaceId},configDomain:'buildroot',configTrustPreview:preview.result,configTrustAccepted:true,configTrustEpoch:0,configurationGeneration:0,pending:false,isoPermission:undefined});
 const replies=[],requests=[];client.run=async(action,fields)=>{const payload={action,...fields};requests.push(payload);const reply=await request(payload);replies.push(reply);return reply.ok?reply.result:undefined;};client.inspectConfig=async()=>{};
 const missing={action:'config.trustGrant',workspaceId,challengeId:preview.result.id,trusted:true};assert.equal((await request(missing)).code,'INVALID_REQUEST');
 assert.equal((await request({...missing,domain:'buildroot',extra:true})).code,'INVALID_REQUEST');
 await client.grantConfigTrust();assert.deepEqual(replies.at(-1),{ok:true,result:{domain:'buildroot',trusted:true}});assert.equal(requests.at(-1).domain,'buildroot');
 assert.equal((await request({action:'config.trustRevoke',workspaceId})).code,'INVALID_REQUEST');
 await client.revokeConfigTrust();assert.deepEqual(replies.at(-1),{ok:true,result:{revoked:true}});assert.equal(requests.at(-1).domain,'buildroot');
 assert.equal(executions,0);
});
