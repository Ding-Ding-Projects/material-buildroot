import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createVocabularyController, parseVocabularyBytes} from '../scripts/appliance/guest/static/vocabulary.mjs';
const encode = text => new TextEncoder().encode(text);

test('guest parser has line-ending-normalized parity with the shared parser', async () => {
 const normalize = text => text.replace(/\r\n/g, '\n');
 assert.equal(normalize(await readFile(new URL('../scripts/appliance/guest/static/vocabulary.mjs', import.meta.url), 'utf8')), normalize(await readFile(new URL('../src/shared/personal-vocabulary.mjs', import.meta.url), 'utf8')));
});

test('guest local cache validates, preserves previous import and clears', async () => {
 let saved = null;
 const controller = createVocabularyController({privateCache:{read:()=>saved,replace:bytes=>{saved=bytes;},clear:()=>{saved=null;}}});
 assert.equal((await controller.load()).active, false);
 await controller.importBytes(encode('{"schemaVersion":1,"entries":{"Application":"Workspace"}}'));
 assert.equal(controller.formatOwnedText('Application', {kind:'ui-copy',mode:'en'}), 'Workspace');
 const previous=saved;
 for (const invalid of ['{"schemaVersion":1,"schemaVersion":1,"entries":{}}', '{"schemaVersion":2,"entries":{}}', '{"schemaVersion":1,"entries":{"constructor":"no"}}', '{"schemaVersion":1,"entries":{"x":[]}}']) {
  assert.throws(()=>parseVocabularyBytes(encode(invalid)));
  assert.equal((await controller.importBytes(encode(invalid))).state,'invalid');
  assert.deepEqual(saved,previous);
 }
 await controller.clear();
 assert.equal(saved,null);
 assert.equal(controller.formatOwnedText('Application',{kind:'ui-copy',mode:'en'}),'Application');
});
