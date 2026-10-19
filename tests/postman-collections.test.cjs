'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const https=require('node:https');
const {execFileSync}=require('node:child_process');
const {createCompanionServer,ACTION_SCOPES}=require('../src/main/security/companion-server.cjs');
const {CATEGORY,MASTER,category,master}=require('../scripts/api/generate-postman.cjs');
const {actionContracts}=require('../src/main/security/companion-consumers.cjs');
const SCOPES=Object.fromEntries(Object.entries(actionContracts).map(([action,definition])=>[action,definition.scope]));
const ORIGIN='https://companion.example';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
let fixture;
test.before(()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'postman-tls-'));try{execFileSync(require('./helpers/host-tools.cjs').hostTool('openssl'),['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost','-keyout',path.join(directory,'key.pem'),'-out',path.join(directory,'cert.pem')],{stdio:'ignore'});fixture={key:fs.readFileSync(path.join(directory,'key.pem')),cert:fs.readFileSync(path.join(directory,'cert.pem'))};}finally{fs.rmSync(directory,{recursive:true,force:true});}});

test('committed collections match the generator output',()=>{
 assert.deepEqual(read(CATEGORY),category());
 assert.deepEqual(read(MASTER),master());
 assert.deepEqual(read(MASTER).item[0].item,read(CATEGORY).item,'master folder mirrors the category collection');
});

test('collections cover every companion route and typed action exactly once',()=>{
 const items=read(CATEGORY).item;
 const routes=new Set(items.map(item=>item.request.url.path[0]));
 assert.deepEqual([...routes].sort(),['actions','disconnect','pair','session']);
 const actions=items.filter(item=>item.request.url.path[0]==='actions').map(item=>JSON.parse(item.request.body.raw.replace(/{{sequence}}/g,'1')).action);
 assert.deepEqual(actions.sort(),Object.keys(SCOPES).sort().sort());
 for(const item of items){
  assert.equal(item.request.method,'POST');
  assert.ok(item.request.header.some(header=>header.key==='Origin'&&header.value==='{{origin}}'),`${item.name} sends Origin`);
  assert.equal(item.request.header.some(header=>header.key==='X-CSRF-Token'),item.name!=='Pair browser',`${item.name} CSRF header`);
 }
});

test('collections carry placeholders only and no credential material',()=>{
 for(const file of [CATEGORY,MASTER]){
  const text=fs.readFileSync(file,'utf8');
  const values=Object.fromEntries(read(file).variable.map(item=>[item.key,item.value]));
  assert.equal(values.challenge,'');
  assert.equal(values.csrfToken,'');
  assert.doesNotMatch(text,/BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)/);
  assert.doesNotMatch(text,/__Host-material-companion=/);
  assert.doesNotMatch(text,/"[A-Za-z0-9_-]{43}"/,'no complete session-token-shaped literal values');
 }
});

function send(port,route,raw,headers){return new Promise((resolve,reject)=>{const req=https.request({hostname:'127.0.0.1',servername:'localhost',port,path:route,method:'POST',ca:fixture.cert,headers:{...headers,'content-length':Buffer.byteLength(raw)},agent:false},res=>{let text='';res.on('data',chunk=>{text+=chunk;});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:text?JSON.parse(text):null}));});req.on('error',reject);req.end(raw);});}

test('trusted contract registration permits the existing mixed-case action only and rejects malformed identities',()=>{
 for(const action of ['product.unreviewedRunner','product.selectRunner;exec','Product.selectRunner'])assert.throws(()=>createCompanionServer({tls:fixture,confirmPairing:async()=>true,onAction:async()=>({}),actionContracts:{[action]:{scope:'forge:write',validate(){}}}}),/Invalid trusted action contract/);
});

test('every collection request is admitted by a real loopback HTTPS companion in order',async t=>{
 const calls=[];
 const service=createCompanionServer({tls:fixture,actionContracts,confirmPairing:async()=>true,onAction:async request=>{calls.push(request.action);return {ok:true};}});
 const binding=await service.start({host:'127.0.0.1',port:0});
 t.after(()=>service.stop());
 const scopes=[...new Set(Object.values(SCOPES))];
 const vars={...Object.fromEntries(read(CATEGORY).variable.map(item=>[item.key,item.value])),origin:ORIGIN,baseUrl:`https://${binding.authority}`,pluginProjectId:'FixtureProject',editorId:'fixture-editor',loaderVersion:'paper',challenge:service.createPairing({origin:ORIGIN,scopes,browser:'edge',deviceName:'Fixture browser'}).challenge};
 let cookie;
 const substitute=text=>text.replace(/{{\$guid}}/g,()=>require('node:crypto').randomUUID()).replace(/{{(\w+)}}/g,(match,key)=>{assert.ok(key in vars,`unknown variable ${key}`);return String(vars[key]);});
 for(const item of read(CATEGORY).item){
  const headers=Object.fromEntries(item.request.header.map(header=>[header.key.toLowerCase(),substitute(header.value)]));
  if(cookie)headers.cookie=cookie;
  const raw=substitute(item.request.body.raw);
  JSON.parse(raw);
  const reply=await send(binding.port,`/${item.request.url.path[0]}`,raw,headers);
  assert.equal(reply.status,200,`${item.name}: ${JSON.stringify(reply.body)}`);
  if(item.name==='Pair browser'){vars.csrfToken=reply.body.csrfToken;cookie=String(reply.headers['set-cookie']).split(';')[0];}
  if(reply.body.nextSequence)vars.sequence=reply.body.nextSequence;
 }
 assert.deepEqual(calls,Object.keys(SCOPES).sort());
 assert.equal(service.state().sessions[0].status,'revoked');
});
