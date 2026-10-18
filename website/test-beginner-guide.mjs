import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { beginnerDefaults, normalizeBeginnerState, beginnerFields, beginnerArticleSources, beginnerArticleUrl, verifyBeginnerDestinations } from './beginner-guide.js';
for (const bad of [null, {}, { version: 2 }, { version: 1, step: -1, goal: '__proto__', runtime: 'native', field: '<script>', read: 'true' }]) {
  assert.deepEqual(normalizeBeginnerState(bad), beginnerDefaults());
}
const selected = { version: 1, step: 3, goal: 'iso', runtime: 'docker', field: 'output', read: true };
assert.deepEqual(normalizeBeginnerState(JSON.parse(JSON.stringify(selected))), selected);
assert.deepEqual(normalizeBeginnerState({ ...selected, step: 1.5 }), { ...selected, step: 0 });
assert.deepEqual(normalizeBeginnerState({ ...selected, step: 4 }), { ...selected, step: 0 });
assert.deepEqual(normalizeBeginnerState({ ...selected, secret: 'must not persist', complete: true }), selected);
assert.deepEqual(beginnerFields.map(field => field.id), ['profile', 'resources', 'output', 'validation']);
for (const field of beginnerFields) {
  for (const property of ['title', 'body', 'example']) assert.ok(field[property].length === 2 && field[property].every(value => typeof value === 'string' && value.length > 0));
  assert.match(field.article, /^[a-z-]+\.md$/);
}
const expected = ['desktop/iso-fields/runtime-and-resources.md','desktop/iso-fields/profile-and-firmware.md','desktop/iso-fields/output-and-validation.md','desktop/modern-workspace.md','desktop/iso-workflow.md','desktop/iso-fields/configuration-and-recovery.md'];
assert.deepEqual([...beginnerArticleSources()].sort(), [...expected].sort(), 'Every runtime, field and final goal destination must remain inventoried');
const inventory = expected.map(article => ({ source: `docs/${article}`, url: `/material-buildroot/site/articles/docs/${article.slice(0,-3)}.html` }));
assert.equal(verifyBeginnerDestinations(inventory), 6);
for (const item of inventory) assert.equal(beginnerArticleUrl(item.source.slice(5)), item.url);
for (let index = 0; index < inventory.length; index++) {
  assert.throws(() => verifyBeginnerDestinations(inventory.filter((_, i) => i !== index)), /absent or mismatched/);
  assert.throws(() => verifyBeginnerDestinations(inventory.map((item, i) => i === index ? {...item, url: item.url.replace(/\.html$/, '.md')} : item)), /absent or mismatched/);
}
const inventoryArgument = process.argv.indexOf('--inventory');
if (inventoryArgument >= 0) {
  assert.ok(process.argv[inventoryArgument + 1], '--inventory needs a production document-inventory.json path');
  assert.equal(verifyBeginnerDestinations(JSON.parse(await fs.readFile(process.argv[inventoryArgument + 1], 'utf8'))), 6);
  console.log('PASS: all six dynamic beginner destinations match the supplied production inventory.');
}
console.log('PASS: beginner state and bilingual inventory; six destinations resolve to HTML; missing and Markdown-route mutations rejected. Browser interaction and production inventory remain separate checks unless --inventory is supplied.');
