'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validate, hash} = require('../scripts/evidence/validate-ledger.cjs');
const root = path.resolve(__dirname, '..');
const baseline = JSON.parse(fs.readFileSync(path.join(root,'docs/planning/feature-evidence.json'),'utf8'));
const copy = () => structuredClone(baseline);
test('admission ledger is valid without pretending product completion', () => {
  assert.deepEqual(validate(baseline), []);
  assert.equal(baseline.identities.length,105);
  assert.equal(baseline.identities.flatMap(r => Object.values(r.surfaces)).filter(s => s.state==='complete').length,0);
});
test('missing identity fails and restoration passes', () => {
  const ledger=copy(); ledger.identities.pop();
  assert(validate(ledger).some(e=>e.startsWith('Missing identity:')));
  assert.deepEqual(validate(baseline),[]);
});
test('duplicate identity fails even with unchanged count', () => {
  const ledger=copy(); ledger.identities[104]=structuredClone(ledger.identities[0]);
  assert(validate(ledger).some(e=>e.startsWith('Duplicate identity:')));
  assert(validate(ledger).some(e=>e.startsWith('Missing identity:')));
});
test('required surface cannot disappear or become an applicability waiver', () => {
  const ledger=copy(); delete ledger.identities[0].surfaces.C;
  assert(validate(ledger).some(e=>e.includes('missing surface')));
  const other=copy(); other.identities[0].surfaces.A.state='not-applicable';
  assert(validate(other).some(e=>e.includes('cannot be waived')));
});
test('completion fails with absent proof', () => {
  const ledger=copy(); ledger.identities[0].surfaces.A.state='complete';
  assert(validate(ledger).some(e=>e.includes('absent or stale proof')));
});
function completeFixture() {
  const ledger=copy(), record=ledger.identities[0], entry=record.surfaces.A;
  record.reconciliation='reviewed'; entry.state='complete'; entry.sourceRevision='a'.repeat(40); entry.builtHash='b'.repeat(64);
  const file={path:'tests/evidence-ledger.test.cjs',sha256:hash(fs.readFileSync(__filename))};
  for(const key of ['implementationConsumers','articles','localizedCopy','focusedTests','negativeTests']) entry[key]=[file];
  entry.persistence={state:'not-applicable',reason:'Synthetic validator fixture only'};
  for(const kind of ['source','runtime','capture','parity']) entry.proof[kind]={status:'verified',sourceRevision:entry.sourceRevision,builtHash:entry.builtHash,files:[file]};
  return ledger;
}
test('validator contract fixture turns red for stale source/build binding, green after restoration', () => {
  const ledger=completeFixture(); assert.deepEqual(validate(ledger),[]);
  const entry=ledger.identities[0].surfaces.A;
  entry.proof.runtime.sourceRevision='c'.repeat(40);
  assert(validate(ledger).some(e=>e.includes('/runtime: absent or stale')));
  entry.proof.runtime.sourceRevision=entry.sourceRevision;
  entry.proof.capture.builtHash='d'.repeat(64);
  assert(validate(ledger).some(e=>e.includes('/capture: absent or stale')));
  entry.proof.capture.builtHash=entry.builtHash;
  assert.deepEqual(validate(ledger),[]);
});
test('proof content hash, missing file and stale catalogue each fail', () => {
  const ledger=completeFixture();
  ledger.identities[0].surfaces.A.proof.runtime.files=[{path:'tests/evidence-ledger.test.cjs',sha256:'0'.repeat(64)}];
  assert(validate(ledger).some(e=>e.includes('stale file hash')));
  ledger.identities[0].surfaces.A.proof.runtime.files=[{path:'missing-proof.json',sha256:'0'.repeat(64)}];
  assert(validate(ledger).some(e=>e.includes('missing file')));
  ledger.catalogueSha256='0'.repeat(64);
  assert(validate(ledger).some(e=>e==='Stale catalogue hash'));
});
test('surface keyset rejects extras, arrays and inherited maps', () => {
  const ledger=copy(); ledger.identities[0].surfaces.EXTRA={state:'complete'};
  assert(validate(ledger).some(e=>e.includes('exactly A/D/C/R')));
  const array=copy(); array.identities[0].surfaces=Object.assign([],array.identities[0].surfaces);
  assert(validate(array).some(e=>e.includes('plain object')));
  const inherited=copy(); inherited.identities[0].surfaces=Object.create(inherited.identities[0].surfaces);
  assert(validate(inherited).some(e=>e.includes('plain object')));
  assert.deepEqual(validate(baseline),[]);
});
test('proof rejects traversal, absolute paths and directories', () => {
  for(const candidate of ['../outside-proof.txt',path.resolve(__filename),'tests']) {
    const ledger=completeFixture();
    ledger.identities[0].surfaces.A.proof.runtime.files=[{path:candidate,sha256:'0'.repeat(64)}];
    const errors=validate(ledger);
    assert(errors.some(e=>e.includes('path escapes repository') || e.includes('not a regular file')),candidate);
  }
  assert.deepEqual(validate(completeFixture()),[]);
});
test('realpath containment rejects an internal directory link to external proof', () => {
  const os=require('node:os');
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'material-buildroot-ledger-'));
  const isolated=path.join(fixture,'repository'), external=path.join(fixture,'external');
  try {
    fs.mkdirSync(path.join(isolated,'docs/planning'),{recursive:true});
    fs.mkdirSync(path.join(isolated,'tests'),{recursive:true});
    fs.mkdirSync(external);
    fs.copyFileSync(path.join(root,'docs/planning/feature-coverage.md'),path.join(isolated,'docs/planning/feature-coverage.md'));
    fs.copyFileSync(__filename,path.join(isolated,'tests/evidence-ledger.test.cjs'));
    fs.writeFileSync(path.join(external,'proof.txt'),'external fixture proof');
    fs.symlinkSync(external,path.join(isolated,'linked-proof'),process.platform==='win32'?'junction':'dir');
    const ledger=completeFixture();
    assert.deepEqual(validate(ledger,{root:isolated}),[]);
    ledger.identities[0].surfaces.A.proof.runtime.files=[{path:'linked-proof/proof.txt',sha256:hash(fs.readFileSync(path.join(external,'proof.txt')))}];
    assert(validate(ledger,{root:isolated}).some(e=>e.includes('resolved path escapes repository')));
    ledger.identities[0].surfaces.A.proof.runtime.files=[{path:'tests/evidence-ledger.test.cjs',sha256:hash(fs.readFileSync(__filename))}];
    assert.deepEqual(validate(ledger,{root:isolated}),[]);
  } finally {
    // Only remove this test's freshly allocated temporary directory.
    const resolved=path.resolve(fixture), parent=path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved),parent);
    assert(path.basename(resolved).startsWith('material-buildroot-ledger-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
test('planned contract rows cannot disappear or exceed the bounded schema', () => {
  const missing=copy(); delete missing.identities[0].subrequirements;
  assert(validate(missing).some(e=>e.includes('planned subrequirements')));
  const oversized=copy(); oversized.identities[0].subrequirements[0].text='x'.repeat(6001);
  assert(validate(oversized).some(e=>e.includes('invalid planned subrequirement')));
  const binding=copy(); binding.identities[0].surfaces.A.plannedAdmission.requirementIds.pop();
  assert(validate(binding).some(e=>e.includes('planned requirement bindings')));
  assert.deepEqual(validate(baseline),[]);
});
test('planned consumers, locales, state, tests and runtime retain separate identities', () => {
  for(const field of ['consumer','articles','copy','persistence','tests','runtime']) {
    const ledger=copy(); delete ledger.identities[0].surfaces.A.plannedAdmission[field];
    assert(validate(ledger).some(e=>e.includes('planned')),field);
  }
  const ledger=copy(); ledger.identities[0].surfaces.D.plannedAdmission.runtime.builtHash='b'.repeat(64);
  assert(validate(ledger).some(e=>e.includes('falsely proven planned runtime')));
  assert.deepEqual(validate(baseline),[]);
});
test('deleting a subrequirement and every surface binding fails independent inventory comparison', () => {
  const ledger=copy(), record=ledger.identities[0];
  const removed=record.subrequirements.pop();
  for(const entry of Object.values(record.surfaces))entry.plannedAdmission.requirementIds=entry.plannedAdmission.requirementIds.filter(id=>id!==removed.id);
  assert(validate(ledger).some(e=>e.includes('independent expected inventory')));
  const edited=copy(); edited.identities[0].subrequirements[0].text+=' changed';
  assert(validate(edited).some(e=>e.includes('independent expected inventory')));
  assert.deepEqual(validate(baseline),[]);
});
test('every planned file destination rejects nonstrings, empty, absolute, traversal and control paths', () => {
  const setters=[
    (p,v)=>p.consumer.path=v,
    (p,v)=>p.consumer.requestContract=v,
    (p,v)=>p.articles[0].path=v,
    (p,v)=>p.copy[0].path=v,
    (p,v)=>p.tests[0].path=v,
    (p,v)=>p.runtime.capture.path=v,
    (p,v)=>p.persistence.store=v
  ];
  const invalid=[4,{},null,'',' ','/absolute/file','C:\\absolute\\file','C:relative-drive','../escape','nested/../escape','safe\u0000bad','safe\npath','a//b'];
  for(const set of setters)for(const value of invalid){
    const ledger=copy();set(ledger.identities[0].surfaces.A.plannedAdmission,value);
    assert(validate(ledger).some(e=>e.includes('invalid bounded relative planned path')),JSON.stringify(value));
  }
  for(const value of invalid){
    const ledger=copy(); ledger.identities[0].surfaces.D.plannedAdmission.persistence.store=value;
    assert(validate(ledger).some(e=>e.includes('invalid bounded planned store reference')));
  }
  assert.deepEqual(validate(baseline),[]);
});
test('operation, authority, behavior and tuple fields are bounded strings', () => {
  for(const field of ['operation','authority','behavior'])for(const value of [7,{},null,'','\u0000','x'.repeat(4097)]){
    const ledger=copy();ledger.identities[0].surfaces.A.plannedAdmission.consumer[field]=value;
    assert(validate(ledger).some(e=>e.includes('invalid bounded planned string')),field);
  }
  for(const value of [7,{},null,'','\n','x'.repeat(513)]){
    const ledger=copy();ledger.identities[0].surfaces.A.plannedAdmission.runtime.tupleIdTemplate=value;
    assert(validate(ledger).some(e=>e.includes('invalid bounded planned string')));
  }
});
test('null malformed admission rows report findings without crashing', () => {
  const mutations=[
    l=>l.identities[0]=null,
    l=>l.identities[0].subrequirements[0]=null,
    l=>l.identities[0].surfaces=null,
    l=>l.identities[0].surfaces.A=null,
    l=>l.identities[0].surfaces.A.plannedAdmission=null,
    l=>l.identities[0].surfaces.A.plannedAdmission.articles[0]=null,
    l=>l.identities[0].surfaces.A.plannedAdmission.copy[0]=null,
    l=>l.identities[0].surfaces.A.plannedAdmission.tests[0]=null,
    l=>l.identities[0].surfaces.A.proof=7
  ];
  assert(validate(null).length>0);
  for(const mutate of mutations){const ledger=copy();mutate(ledger);assert(validate(ledger).length>0);}
  assert.deepEqual(validate(baseline),[]);
});
test('desktop viewport and display scales are exact admitted logical axes', () => {
  const ledger=copy();ledger.identities[0].surfaces.A.plannedAdmission.runtime.viewports=['normal-1280x800'];
  assert(validate(ledger).some(e=>e.includes('desktop viewport axes')));
  const scale=copy();scale.identities[0].surfaces.A.plannedAdmission.runtime.scales=[100,150];
  assert(validate(scale).some(e=>e.includes('display-scale axes')));
  assert.deepEqual(validate(baseline),[]);
});
