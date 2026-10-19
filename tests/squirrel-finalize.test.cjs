'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assertInstallerTransfer,INSTALLER_TRANSFER_LIMIT,finalizeSetup}=require('../scripts/build/squirrel-finalize.cjs');
const {admitInvocation}=require('../scripts/build/squirrel-setup.cjs');
test('installer transfer ceiling retains 50 MB below the approximately 1.5 GB transport boundary',()=>{
 assert.equal(INSTALLER_TRANSFER_LIMIT,1450000000);
 for(const bytes of [1,1405716992,1419941325,INSTALLER_TRANSFER_LIMIT])assert.doesNotThrow(()=>assertInstallerTransfer(bytes));
 for(const bytes of [0,-1,1.5,NaN,Infinity,INSTALLER_TRANSFER_LIMIT+1,1500000000])assert.throws(()=>assertInstallerTransfer(bytes),/transfer budget/);
});
test('final embedding rejects missing or unbound original invocation before filesystem or native work',async()=>{
 for(const initial of [null,{}, {source:'a'.repeat(40)}])await assert.rejects(finalizeSetup({setup:'unused',trace:'unused',helperDirectory:'unused',source:'a'.repeat(40),helper:{},initial}),/invocation/);
 assert.throws(()=>admitInvocation({schemaVersion:1},'a'.repeat(40),{}),/invocation/);
});

test('changed retained input fails before creating final trace or modifying Setup',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'squirrel-input-check-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const trace=path.join(root,'trace');fs.mkdirSync(trace);fs.writeFileSync(path.join(trace,'embedding-input.zip'),'changed');const setup=path.join(root,'Setup.exe');fs.writeFileSync(setup,'preserved');
 const digest=crypto.createHash('sha256').update('x').digest('hex'),value={bytes:1,sha256:digest},resource={present:true,bytes:1,sha256:digest,error:0},helper={sha256:digest,genuineHelperSha256:digest},source='a'.repeat(40);
 const initial={schemaVersion:1,source,kind:'genuine-embedding-invocation',genuineHelperSha256:digest,proxySha256:digest,childExitCode:0,inputRetained:true,inputZip:value,before:{...value,dataResource:resource},after:{...value,dataResource:resource},runtimeVerified:false};
 await assert.rejects(finalizeSetup({setup,trace,helperDirectory:root,source,helper,initial}),/Retained embedding input differs/);
 assert.equal(fs.existsSync(path.join(trace,'final-embedding')),false);assert.equal(fs.readFileSync(setup,'utf8'),'preserved');
});

test('observer source contains its suspended child before resume and bounds termination paths',()=>{
 const fs=require('node:fs'),source=fs.readFileSync(require.resolve('../native/squirrel-writezip/invocation-proxy.cpp'),'utf8');
 function verify(text){const body=text.slice(text.indexOf('struct OwnedHelper'),text.indexOf('std::string Describe'));assert.match(body,/JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);assert.match(body,/CREATE_NO_WINDOW\|CREATE_SUSPENDED/);assert.match(body,/~OwnedHelper\(\)/);assert.match(body,/TerminateProcess\(process,ERROR_PROCESS_ABORTED\)/);assert.match(body,/if\(job\)CloseHandle\(job\)/);const assign=body.indexOf('AssignProcessToJobObject'),resume=body.indexOf('ResumeThread');assert(assign>0&&resume>assign);assert.match(body,/WaitForSingleObject\(owned.process,120000\)/);assert.match(body,/TerminateJobObject\(owned.job,reason\)/);assert.doesNotMatch(body,/INFINITE|CREATE_BREAKAWAY_FROM_JOB/);}
 verify(source);
 for(const mutation of [source.replace('JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE','0'),source.replace('|CREATE_SUSPENDED',''),source.replace('WaitForSingleObject(owned.process,120000)','WaitForSingleObject(owned.process,INFINITE)'),source.replace('TerminateProcess(process,ERROR_PROCESS_ABORTED)','NoTermination()')])assert.throws(()=>verify(mutation));
});
