import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {createSqliteScheduleDiscardStore,SCHEDULE_DRAFT_LIMITS} from '../src/main/preferences/schedule-store.mjs';
import {createSchedulePreferencesService} from '../src/main/preferences/service.mjs';
const registry={language:v=>['en','zh-HK','bilingual'].includes(v),'appearance.theme':v=>['system','light','dark'].includes(v)};
const document=()=>({schemaVersion:1,revision:73,timeZone:'UTC',rules:[{id:'draft',label:'Unsaved local rule',enabled:true,priority:0,startDate:null,endDate:null,startTime:'00:00',endTime:'00:00',days:{type:'everyday'},values:{language:'zh-HK'},source:{type:'local'}}]});
function fixture(t,extra={}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-discards-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const create=(options={})=>createSqliteScheduleDiscardStore({directory,profileId:'desktop',registry,clock:()=>123456,...extra,...options});
  return {directory,create};
}
test('discard records survive restart with original draft revisions and bounded metadata-only pages',async t=>{
  const f=fixture(t);let store=f.create();
  const a=await store.append({document:document()}),b=await store.append({document:document()});
  assert.deepEqual(a,{sequence:1,discardedAt:123456});assert.equal(b.sequence,2);
  const first=await store.list({after:0,limit:1});
  assert.deepEqual(first,{records:[a],next:1,hasMore:true});
  assert.equal(JSON.stringify(first).includes('Unsaved local rule'),false);
  store.close();store=f.create();
  assert.deepEqual(await store.read({sequence:1}),{...a,document:document()});
  const restored=await store.read({sequence:1});restored.document.rules[0].label='changed caller copy';
  assert.equal((await store.read({sequence:1})).document.rules[0].label,'Unsaved local rule');
  assert.equal(await store.read({sequence:999}),null);
  assert.deepEqual((await store.list({after:1,limit:1})).records,[b]);store.close();
});
test('a genuinely terminated discard writer recovers its owned journal without publishing the interrupted draft',async t=>{
  const f=fixture(t),initial=f.create(),first=await initial.append({document:document()});
  initial.close();
  const database=path.join(f.directory,'schedule-discard-history-desktop','scheduled-settings.sqlite');
  const before=fs.readFileSync(database);
  const interrupted={...document(),revision:74,rules:Array.from({length:256},(_,n)=>({...document().rules[0],id:'interrupted-'+n,label:'Interrupted '+n+' '+'.'.repeat(128)}))};
  const payload=JSON.stringify(interrupted);
  // Exceed the adapter's 64 KiB cache so SQLite must spill uncommitted pages.
  assert.ok(Buffer.byteLength(payload)>65536);
  const writerDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'discard-writer-'));
  t.after(()=>fs.rmSync(writerDirectory,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  fs.writeFileSync(path.join(writerDirectory,'draft.json'),payload);
  const writer=path.join(writerDirectory,'writer.mjs');
  fs.writeFileSync(writer,`import fs from 'node:fs';import {createSqliteScheduleDiscardStore} from ${JSON.stringify(new URL('../src/main/preferences/schedule-store.mjs',import.meta.url).href)};const registry={language:v=>['en','zh-HK','bilingual'].includes(v),'appearance.theme':v=>['system','light','dark'].includes(v)};const store=createSqliteScheduleDiscardStore({directory:${JSON.stringify(f.directory)},profileId:'desktop',registry,afterWrite(){fs.writeSync(1,'DISCARD_TRANSACTION_READY\\n');process.kill(process.pid,'SIGKILL');}});await store.append({document:JSON.parse(fs.readFileSync(${JSON.stringify(path.join(writerDirectory,'draft.json'))},'utf8'))});`);
  let terminated;
  try { execFileSync(process.execPath,[writer],{encoding:'utf8',stdio:'pipe',timeout:30000}); }
  catch(error) { terminated=error; }
  assert.ok(terminated,'The writer must actually terminate before commit.');
  assert.ok(String(terminated.stdout).includes('DISCARD_TRANSACTION_READY'),'The real writer must reach the post-insert transaction hook.');
  assert.ok(terminated.signal==='SIGKILL'||(process.platform==='win32'&&terminated.status===1));
  assert.equal(fs.existsSync(database+'-journal'),true);
  assert.notDeepEqual(fs.readFileSync(database),before,'Uncommitted pages must actually reach the database before recovery.');
  const recovered=f.create();
  assert.deepEqual((await recovered.list()).records,[first]);
  assert.deepEqual((await recovered.read({sequence:first.sequence})).document,document());
  assert.equal(await recovered.read({sequence:2}),null);
  assert.equal((await recovered.append({document:document()})).sequence,2);
  recovered.close();
});
test('only valid local schedule documents enter discard storage and authority is checked at commit',async t=>{
  const f=fixture(t),store=f.create();
  for(const candidate of [{...document(),token:'fixture-secret'}, {...document(),enrollments:[]}, {...document(),revision:-1}, {...document(),rules:[{...document().rules[0],source:{type:'https',url:'https://example.invalid',refreshMs:30000,timeoutMs:500,maxResponseBytes:4096}}]}])
    await assert.rejects(store.append({document:candidate}),{code:'INVALID_SCHEDULE_DRAFT'});
  await assert.rejects(store.append({document:document(),authorize:()=>false}),{code:'UNAUTHORIZED'});
  assert.equal((await store.list()).records.length,0);store.close();
  let admitted=true;const revoked=f.create({afterWrite(){admitted=false;}});
  await assert.rejects(revoked.append({document:document(),authorize:()=>admitted}),{code:'UNAUTHORIZED'});revoked.close();
  const reopened=f.create();assert.equal((await reopened.list()).records.length,0);reopened.close();
});
test('capacity refuses the next append without eviction and malformed pages do not read drafts',async t=>{
  const f=fixture(t),store=f.create();
  for(let n=0;n<SCHEDULE_DRAFT_LIMITS.records;n++)await store.append({document:document()});
  await assert.rejects(store.append({document:document()}),{code:'SCHEDULE_DRAFT_LIMIT'});
  assert.equal((await store.read({sequence:1})).sequence,1);
  assert.equal((await store.read({sequence:64})).sequence,64);
  for(const page of [{after:-1,limit:1},{after:0,limit:21},{after:0,limit:0}])await assert.rejects(store.list(page),{code:'INVALID_HISTORY_PAGE'});
  await assert.rejects(store.read({sequence:0}),{code:'INVALID_HISTORY_PAGE'});store.close();
});
test('oversized stored rows are bounded and foreign sidecars remain preserved',async t=>{
  const f=fixture(t),store=f.create();await store.append({document:document()});store.close();
  const file=path.join(f.directory,'schedule-discard-history-desktop','scheduled-settings.sqlite');
  const db=new DatabaseSync(file);db.prepare('UPDATE discarded_drafts SET document=?').run(Buffer.alloc(262145,32));db.close();
  const corrupt=f.create();await assert.rejects(corrupt.read({sequence:1}),{code:'SCHEDULE_STORAGE_INVALID'});corrupt.close();
  fs.writeFileSync(file+'-wal','foreign');assert.throws(()=>f.create());assert.equal(fs.readFileSync(file+'-wal','utf8'),'foreign');
});
test('discard restore returns editor data and never saves, evaluates or activates the draft',async t=>{
  const f=fixture(t),service=createSchedulePreferencesService({directory:f.directory,profileId:'desktop',baseReader:()=>({language:'en','appearance.theme':'system'}),tickMs:60000});
  t.after(()=>service.close());await service.start();
  const before=service.status();const receipt=await service.draftDiscard({document:document()});
  assert.equal((await service.draftRead({sequence:receipt.sequence})).document.revision,73);
  assert.equal(await service.read(),null);assert.equal((await service.history()).records.length,0);
  assert.deepEqual(service.status().effective,before.effective);
  // Saving a restored draft remains a separate revision-checked existing operation.
  const saved=await service.replace({document:document(),expectedRevision:null});assert.equal(saved.revision,0);
  await assert.rejects(service.replace({document:document(),expectedRevision:null}),{code:'STALE_REVISION'});
});
test('unavailable discard history is lazy and does not prevent active schedule reads',async t=>{
  const f=fixture(t),directory=path.join(f.directory,'schedule-discard-history-desktop');
  fs.mkdirSync(directory);fs.writeFileSync(path.join(directory,'scheduled-settings.sqlite'),'foreign bytes');
  const service=createSchedulePreferencesService({directory:f.directory,profileId:'desktop',baseReader:()=>({language:'en','appearance.theme':'system'}),tickMs:60000});
  t.after(()=>service.close());await service.start();
  assert.equal(await service.read(),null);
  await assert.rejects(service.draftList());
  assert.equal(await service.read(),null);
  assert.equal(fs.readFileSync(path.join(directory,'scheduled-settings.sqlite'),'utf8'),'foreign bytes');
});
