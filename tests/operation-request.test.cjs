'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseOperationRequest,RequestValidationError,MAX_BYTES}=require('../src/main/security/operation-request.cjs');
function request(action='settings.setLanguage',args={language:'bilingual'}){return {version:1,operationId:'12345678-1234-4234-8234-123456789abc',projectId:'project-one',expectedRevision:'a'.repeat(40),capability:'A'.repeat(32),action,arguments:args};}
function rejected(input,code){assert.throws(()=>parseOperationRequest(input),error=>error instanceof RequestValidationError&&error.code===code);}
test('all five admitted actions parse without coercion and retain frozen data',()=>{
  const cases=[request(),request('projects.create',{runtime:'ssh-windows-wsl',destinationCapability:'B'.repeat(32),name:'Desktop guest'}),request('builds.preview',{configurationRevision:'b'.repeat(40),target:'image'}),request('builds.submit',{previewId:'preview-request-01',previewSha256:'c'.repeat(64)}),request('jobs.cancel',{jobId:'owned-job-0000010',expectedSequence:4})];
  for(const value of cases){const result=parseOperationRequest(JSON.stringify(value));assert.deepEqual(result.request,value);assert.ok(Object.isFrozen(result.request));assert.ok(Object.isFrozen(result.request.arguments));assert.match(result.digest,/^[a-f0-9]{64}$/);}
});
test('semantically identical ordering and whitespace share the normalized digest',()=>{
  const value=request(),reversed=Object.fromEntries(Object.entries(value).reverse());assert.equal(parseOperationRequest(JSON.stringify(value)).digest,parseOperationRequest(JSON.stringify(reversed,null,2)).digest);
  assert.notEqual(parseOperationRequest(JSON.stringify(value)).digest,parseOperationRequest(JSON.stringify(request('settings.setLanguage',{language:'en'}))).digest);
});
test('duplicate decoded properties and unsafe object keys fail before object construction',()=>{
  const valid=JSON.stringify(request());rejected(valid.replace('"version":1','"version":1,"version":1'),'REQUEST_DUPLICATE_KEY');
  rejected(valid.replace('"language":"bilingual"','"language":"bilingual","lang\\u0075age":"en"'),'REQUEST_DUPLICATE_KEY');
  for(const key of ['__proto__','prototype','constructor'])rejected(valid.replace('"arguments":{',`"arguments":{"${key}":{},`),'REQUEST_UNSAFE_KEY');assert.equal({}.polluted,undefined);
});
test('strict JSON rejects comments, commas, malformed input and extra root values',()=>{
  const valid=JSON.stringify(request());for(const text of ['',valid+' {}','/*comment*/'+valid,valid.slice(0,-1)+',}',valid.slice(0,-1),'{"version":01}','{"value":NaN}'])rejected(text,'REQUEST_SYNTAX');
});
test('UTF-8 limits, malformed byte sequences and unpaired surrogates are rejected',()=>{
  rejected(' '.repeat(MAX_BYTES+1),'REQUEST_TOO_LARGE');rejected('粵'.repeat(Math.floor(MAX_BYTES/3)+1),'REQUEST_TOO_LARGE');rejected(Buffer.from([0xc0,0xaf]),'REQUEST_ENCODING');rejected('\ud800','REQUEST_ENCODING');rejected('{"name":"\\ud800"}','REQUEST_ENCODING');rejected({action:'settings.setLanguage'},'REQUEST_TYPE');assert.equal(parseOperationRequest(Buffer.from(JSON.stringify(request()))).request.version,1);
});
test('deep, large-member and nonfinite or unsafe numeric requests are bounded',()=>{
  rejected('['.repeat(9)+'0'+']'.repeat(9),'REQUEST_DEPTH');rejected('['+Array(2100).fill('0').join(',')+']','REQUEST_COMPLEXITY');for(const value of ['1e999','9007199254740992','0.5'])rejected('{"value":'+value+'}','REQUEST_NUMBER');
});
test('numeric lexemes cannot round fractions or underflow into accepted sequence integers',()=>{
  const valid=JSON.stringify(request('jobs.cancel',{jobId:'owned-job-0000010',expectedSequence:1}));
  for(const value of ['1.00000000000000001','9007199254740991.1','1e-999','-1e-999','1.0','1e3','-0'])rejected(valid.replace('"expectedSequence":1',`"expectedSequence":${value}`),'REQUEST_NUMBER');
  for(const value of ['0','1','9007199254740991'])assert.equal(parseOperationRequest(valid.replace('"expectedSequence":1',`"expectedSequence":${value}`)).request.arguments.expectedSequence,Number(value));
});
test('schema rejects unknown actions, fields, versions, raw paths and mismatched arguments',()=>{
  for(const mutate of [v=>v.action='shell.exec',v=>v.version='1',v=>v.version=2,v=>v.extra=true,v=>v.arguments.extra=true,v=>v.arguments.language='english',v=>v.capability='C:/private/workspace',v=>v.projectId='../escape',v=>v.expectedRevision='main',v=>v.operationId='not-an-id',v=>v.arguments={target:'image'}]){const value=request();mutate(value);rejected(JSON.stringify(value),'REQUEST_SCHEMA');}
  rejected(JSON.stringify(request('projects.create',{runtime:'wsl',destinationCapability:'B'.repeat(32),name:'  '})),'REQUEST_SCHEMA');rejected(JSON.stringify(request('jobs.cancel',{jobId:'owned-job-0000010',expectedSequence:-1})),'REQUEST_SCHEMA');
});
test('diagnostics expose only stable codes and generic text',()=>{
  try{parseOperationRequest('{"private-value-not-for-diagnostics":');assert.fail('Expected rejection');}catch(error){assert.equal(error.message,'The operation request is not valid.');assert.ok(!JSON.stringify(error).includes('private-value-not-for-diagnostics'));}
});
