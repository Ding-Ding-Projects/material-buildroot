'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {validate, hash} = require('../scripts/evidence/admit-implementation.cjs');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'implementation-admission-'));
  for (const p of ['src/consumer.cjs','tests/consumer.test.cjs','docs/contract.md','docs/receipt.txt']) {fs.mkdirSync(path.dirname(path.join(root,p)), {recursive:true}); fs.writeFileSync(path.join(root,p), p);}
  const binding = p => ({path:p,sha256:hash(fs.readFileSync(path.join(root,p)))});
  const ledger = {schemaVersion:1,phases:Array.from({length:11},(_,i)=>({id:`PH${String(i).padStart(2,'0')}`,contract:'Typed requests produce validated results',authority:'Main process validates requests',persistence:'Versioned durable store',acceptanceGap:'Native acceptance remains unverified',accepted:false,state:'authored',sourceRevision:'a'.repeat(40),consumers:[binding('src/consumer.cjs')],tests:[binding('tests/consumer.test.cjs')],documents:[binding('docs/contract.md')],receipts:[]}))};
  return {root,ledger,binding,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
function check(name, mutate, pattern) {test(name,()=>{const f=fixture();try{mutate(f.ledger.phases[0],f); const errors=validate(f.ledger,{root:f.root}); if(pattern) assert.match(errors.join('\n'),pattern); else assert.deepEqual(errors,[]);}finally{f.cleanup();}});}
check('authored bindings validate without runtime claims',()=>{});
check('native deferral records preserve missing acceptance',r=>{r.state='native-deferred';r.deferredReason='Windows testing deferred by owner';});
check('missing concrete consumers fail',r=>{r.consumers=[];},/missing consumers/);
check('missing focused tests fail',r=>{r.tests=[];},/missing tests/);
check('missing documentation fails',r=>{r.documents=[];},/missing documents/);
check('stale source hashes fail',(r,f)=>{fs.writeFileSync(path.join(f.root,r.consumers[0].path),'changed');},/stale hash/);
check('missing implementation files fail',r=>{r.consumers[0].path='src/imaginary.cjs';},/missing file/);
check('traversal fails',r=>{r.consumers[0].path='../outside';},/invalid repository path/);
check('outside symlink fails',(r,f)=>{fs.symlinkSync(os.tmpdir(),path.join(f.root,'src/outside'));r.consumers[0].path='src/outside';},/outside repository/);
check('tested claims require receipts',r=>{r.state='tested';},/requires receipts/);
check('source-bound passing receipt validates',(r,f)=>{r.state='tested';r.receipts=[{sourceRevision:r.sourceRevision,builtHash:f.binding('docs/receipt.txt').sha256,buildArtifact:f.binding('docs/receipt.txt'),exitCode:0,command:'node --test tests/consumer.test.cjs',environment:'Linux test fixture',recordedAt:'2026-10-15T00:00:00Z',output:f.binding('docs/receipt.txt'),bindings:[...r.consumers,...r.tests]}];});
check('receipt cannot omit current source bindings',(r,f)=>{r.state='tested';r.receipts=[{sourceRevision:r.sourceRevision,builtHash:f.binding('docs/receipt.txt').sha256,buildArtifact:f.binding('docs/receipt.txt'),exitCode:0,command:'node --test',environment:'fixture',recordedAt:'2026-10-15T00:00:00Z',output:f.binding('docs/receipt.txt'),bindings:[...r.tests]}];},/missing current source/);
check('registry cannot silently accept phases',r=>{r.accepted=true;},/acceptance is outside/);
check('deferred state requires explicit reason',r=>{r.state='native-deferred';},/requires a reason/);

check('malformed receipt bindings fail without throwing',(r,f)=>{r.state='tested';r.receipts=[{sourceRevision:r.sourceRevision,builtHash:f.binding('docs/receipt.txt').sha256,buildArtifact:f.binding('docs/receipt.txt'),exitCode:0,command:'node --test',environment:'fixture',recordedAt:'2026-10-15T00:00:00Z',output:f.binding('docs/receipt.txt'),bindings:'invalid'}];},/lacks source bindings/);
