import assert from 'node:assert/strict';
import { beginnerDefaults, normalizeBeginnerState, beginnerFields } from './beginner-guide.js';
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
console.log('PASS: beginner state rejects invalid and unrelated data, persists supported choices and keeps four bilingual explanations. Browser interaction and layout remain separate checks.');
