'use strict';
// Generates the companion category collection and the master collection from one definition.
// Usage: node scripts/api/generate-postman.cjs [--check]
const fs=require('node:fs');
const path=require('node:path');
const {ACTION_SCOPES}=require('../../src/main/security/companion-server.cjs');
const root=path.resolve(__dirname,'..','..');
const CATEGORY=path.join(root,'docs','security','postman','companion.postman_collection.json');
const MASTER=path.join(root,'docs','postman','material-buildroot.postman_collection.json');
const SCHEMA='https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
const EXAMPLE_UUID='00000000-0000-4000-8000-000000000000';
const ACTION_ARGS={
 'workspace.read':{},
 'projects.list':{},
 'jobs.list':{},
 'jobs.get':{jobId:'{{jobId}}'},
 'jobs.cancel':{jobId:'{{jobId}}',expectedSequence:0},
 'builds.submit':{workspaceId:'{{workspaceId}}',runtime:'wsl',target:'all',jobs:4}
};
const json=value=>JSON.stringify(value,null,2);
function post(name,route,body,{csrf=true,description}){
 const header=[{key:'Origin',value:'{{origin}}'},{key:'Content-Type',value:'application/json'}];
 if(csrf)header.push({key:'X-CSRF-Token',value:'{{csrfToken}}'});
 return {name,request:{method:'POST',header,body:{mode:'raw',raw:json(body).replace(/"({{sequence}})"/g,'$1'),options:{raw:{language:'json'}}},url:{raw:`{{baseUrl}}${route}`,host:['{{baseUrl}}'],path:[route.slice(1)]},description}};
}
function actionItem(action){
 const scope=ACTION_SCOPES[action];
 const mutation=!scope.endsWith(':read');
 return post(`Action ${action}`,'/actions',{action,args:ACTION_ARGS[action],sequence:'{{sequence}}',nonce:'{{$guid}}'},{description:`Requires scope \`${scope}\`. Set \`sequence\` to the \`nextSequence\` value from the previous reply. \`{{$guid}}\` creates a fresh UUID nonce for every send.${mutation?' This is a mutation scope: it is disabled by default and must be explicitly enabled by the desktop host. Never resend an accepted mutation after a lost reply; first reconcile actual job state with jobs.list or jobs.get.':''}`});
}
function items(){
 return [
  post('Pair browser','/pair',{challenge:'{{challenge}}',clientNonce:'{{$guid}}'},{csrf:false,description:'Copy the single-use challenge shown by the desktop into the `challenge` variable, then send. The desktop shows a native review dialog; enrollment succeeds only after that review is approved. The reply contains `csrfToken`; copy it into the current (unshared) value of `csrfToken`. The session cookie is stored by the client cookie jar and is never placed in this collection.'}),
  post('Read session','/session',{},{description:'Returns the current session metadata and `nextSequence`. It does not report build or connection success.'}),
  ...Object.keys(ACTION_SCOPES).map(actionItem),
  post('Disconnect','/disconnect',{},{description:'Revokes only the current session and clears its cookie. Revoked or expired sessions return HTTP 401.'})
 ];
}
const variables=[
 {key:'baseUrl',value:'https://127.0.0.1:0',description:'Exact authority reported by the desktop after the companion starts. Replace the port.'},
 {key:'origin',value:'https://companion.example',description:'The exact HTTPS origin approved when the pairing challenge was created.'},
 {key:'challenge',value:'',description:'Single-use pairing challenge from the desktop. Keep it out of shared copies.'},
 {key:'csrfToken',value:'',description:'CSRF token from the pair reply. Keep it out of shared copies.'},
 {key:'sequence',value:'1',description:'Next accepted action sequence.'},
 {key:'jobId',value:EXAMPLE_UUID,description:'Placeholder job UUID.'},
 {key:'workspaceId',value:EXAMPLE_UUID,description:'Placeholder workspace UUID.'}
];
const prerequisites='Prerequisites: start the opt-in companion from the desktop with your own TLS certificate and key, trust that certificate in the client, and create a pairing challenge for the exact origin you will send. Requests must carry the exact Host authority and Origin, or they are rejected. This collection contains placeholders only; it holds no certificates, cookies, challenges, CSRF tokens or session identifiers. See docs/security/companion.md.';
function category(){
 return {info:{name:'Material Buildroot - HTTPS companion',description:`Category collection for the opt-in authenticated HTTPS companion.\n\n${prerequisites}`,schema:SCHEMA},variable:variables,item:items()};
}
function master(){
 return {info:{name:'Material Buildroot - all HTTP APIs',description:`Master collection for every HTTP API the product exposes. The HTTPS companion is the only HTTP surface; desktop IPC boundaries are not HTTP and are documented in docs/security/README.md.\n\n${prerequisites}`,schema:SCHEMA},variable:variables,item:[{name:'Security / HTTPS companion',description:'Mirrors docs/security/postman/companion.postman_collection.json.',item:items()}]};
}
const outputs=[[CATEGORY,json(category())+'\n'],[MASTER,json(master())+'\n']];
if(require.main===module){
 const check=process.argv.includes('--check');let stale=false;
 for(const [file,text]of outputs){
  if(check){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==text){console.error(`stale: ${path.relative(root,file)}`);stale=true;}}
  else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);console.log(`wrote ${path.relative(root,file)}`);}
 }
 process.exitCode=stale?1:0;
}
module.exports={CATEGORY,MASTER,category,master,ACTION_ARGS};
