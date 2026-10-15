'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const {contained,sourceIdentity,assertIdentity,inventory,verifiedOutput,outputJournal,recoverOutput,activateOutput,verifyInstaller}=require('../scripts/build/driver.cjs');
const fixtures=[];
function fixture(){const value=fs.mkdtempSync(path.join(os.tmpdir(),'material-buildroot-build-'));fixtures.push(value);return value;}
test.after(()=>{for(const directory of fixtures)fs.rmSync(directory,{recursive:true,force:true});});

test('build paths reject traversal, absolute paths and a real junction escape',()=>{
  const root=fixture(),outside=fixture();
  for(const value of ['../escape','a/../b','a//b','a\\b','C:/escape','/escape'])assert.throws(()=>contained(root,value));
  fs.symlinkSync(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>contained(root,'linked/output'));
  assert.equal(contained(root,'nested/output'),path.join(root,'nested','output'));
});

test('source admission rejects unstaged, staged and untracked changes and source movement',()=>{
  const root=fixture();
  function git(...args){const result=cp.spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();}
  git('init','-q');git('config','user.name','Build fixture');git('config','user.email','fixture@example.invalid');
  fs.writeFileSync(path.join(root,'input.txt'),'first');git('add','.');git('commit','-qm','Create fixture');
  const before=sourceIdentity(root,'git',Buffer.from('{}'));
  fs.writeFileSync(path.join(root,'input.txt'),'second');assert.throws(()=>sourceIdentity(root,'git',Buffer.from('{}')));
  git('add','.');assert.throws(()=>sourceIdentity(root,'git',Buffer.from('{}')));
  git('commit','-qm','Change fixture');assert.throws(()=>assertIdentity(before,sourceIdentity(root,'git',Buffer.from('{}'))));
  fs.writeFileSync(path.join(root,'untracked.txt'),'new');assert.throws(()=>sourceIdentity(root,'git',Buffer.from('{}')));
});

function output(root,name,content){
  const directory=path.join(root,name);fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'index.html'),content);
  fs.writeFileSync(path.join(directory,'build-receipt.json'),JSON.stringify({schemaVersion:1,source:{commit:'a'.repeat(40),manifestSha256:'b'.repeat(64)},files:inventory(directory)}));
  return directory;
}

test('output activation verifies bytes, preserves previous generation and recovers an interrupted rename',()=>{
  const root=fixture();
  const first=output(root,'first','first');activateOutput(root,'dist',first);assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),'first');
  const second=output(root,'second','second');activateOutput(root,'dist',second);assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),'second');
  const previous=path.join(root,`dist.previous-${crypto.randomUUID()}`);fs.renameSync(path.join(root,'dist'),previous);
  fs.writeFileSync(outputJournal(root,'dist'),'{truncated journal');recoverOutput(root,'dist');assert.ok(verifiedOutput(path.join(root,'dist')));
  const tampered=output(root,'tampered','original');fs.writeFileSync(path.join(tampered,'index.html'),'changed');assert.throws(()=>activateOutput(root,'dist',tampered));
});

test('malformed output journal without a verified generation fails closed and remains available',()=>{
  const root=fixture();fs.mkdirSync(path.join(root,'.cache'));fs.writeFileSync(outputJournal(root,'dist'),'{');
  assert.throws(()=>recoverOutput(root,'dist'));assert.ok(fs.existsSync(outputJournal(root,'dist')));
});

test('installer shape and RELEASES hashes are required, not filename-only success',()=>{
  const root=fixture();assert.throws(()=>verifyInstaller(root));
  fs.writeFileSync(path.join(root,'Setup.exe'),'MZfixture');const packageBytes=Buffer.from('PKfixture');fs.writeFileSync(path.join(root,'app-1-full.nupkg'),packageBytes);
  const digest=crypto.createHash('sha1').update(packageBytes).digest('hex');fs.writeFileSync(path.join(root,'RELEASES'),`${digest} app-1-full.nupkg ${packageBytes.length}\n`);
  assert.equal(verifyInstaller(root).length,3);fs.writeFileSync(path.join(root,'app-1-full.nupkg'),'PKmodified');assert.throws(()=>verifyInstaller(root));
});

test('PowerShell 5.1 performs real portable-tree activation and recovery', {skip:process.platform!=='win32'},()=>{
  const result=cp.spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'build-toolchains.ps1'),'-Workspace',fixture()],{encoding:'utf8',windowsHide:true,timeout:60000});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);assert.match(result.stdout,/PASS: complete-tree acquisition/);
});
