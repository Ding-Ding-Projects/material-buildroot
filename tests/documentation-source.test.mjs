import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRoadmap } from '../website/roadmap.mjs';
import { resolveDocumentLink, containedPath, sourceSnapshot } from '../website/source-boundary.mjs';
const parent=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.cache/documentation-tests');
fs.mkdirSync(parent,{recursive:true});
const fixture=fs.mkdtempSync(path.join(parent,'documentation-'));

test('documentation links reject decoded Windows escapes and controls',()=>{
  for (const reference of ['%5c..%5csecret.png','C%3a/secret.png','%00.png','%0a.png','../../secret.png','/secret.png']) assert.throws(()=>resolveDocumentLink('docs/README.md',reference));
  assert.equal(resolveDocumentLink('docs/desktop/README.md','../evidence/capture.png'),'docs/evidence/capture.png');
  for (const relative of ['../secret.png','C:/secret.png','docs\\secret.png','docs/../secret.png']) assert.throws(()=>containedPath(fixture,relative));
});

test('documentation source and destination reject linked ancestors',()=>{
  const source=path.join(fixture,'source'), outside=path.join(fixture,'outside');
  fs.mkdirSync(source); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside,'image.png'),Buffer.from([0,255,1]));
  fs.symlinkSync(outside,path.join(source,'linked'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>containedPath(source,'linked/image.png'),/symbolic link or junction/);
  assert.throws(()=>containedPath(source,'linked/new/image.png'),/symbolic link or junction/);
});

test('asset-only binary byte changes invalidate the documentation snapshot',()=>{
  const source=path.join(fixture,'snapshot');fs.mkdirSync(source);
  fs.writeFileSync(path.join(source,'article.md'),'![Capture](capture.png)');
  const image=path.join(source,'capture.png');fs.writeFileSync(image,Buffer.from([0,255,254,1]));
  const inputs=['article.md','capture.png'];const before=sourceSnapshot(source,inputs);
  fs.writeFileSync(image,Buffer.from([0,255,253,1]));
  assert.notEqual(sourceSnapshot(source,inputs),before);
});


test('real roadmap LF and CRLF variants preserve phases and tasks while byte snapshots differ',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const actual=fs.readFileSync(path.join(root,'ROADMAP.md'),'utf8');
  const lf=actual.replace(/\r\n?/g,'\n'), crlf=lf.replace(/\n/g,'\r\n');
  const expected=parseRoadmap(lf);
  assert.equal(expected.length,11);
  assert.ok(expected.find(phase=>phase.id==='PH02').tasks.some(task=>task.id==='PH02-T02'));
  assert.deepEqual(parseRoadmap(crlf),expected);
  assert.deepEqual(parseRoadmap(actual),expected);
  const source=path.join(fixture,'roadmap');fs.mkdirSync(source);
  const file=path.join(source,'ROADMAP.md');fs.writeFileSync(file,lf);
  const before=sourceSnapshot(source,['ROADMAP.md']);fs.writeFileSync(file,crlf);
  assert.notEqual(sourceSnapshot(source,['ROADMAP.md']),before);
});
