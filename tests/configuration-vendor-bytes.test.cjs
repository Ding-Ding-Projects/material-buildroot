'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
test('vendored Kconfig bytes retain provenance and disable checkout text conversion', () => {
  const directory = 'scripts/configuration/vendor';
  const receipt = JSON.parse(fs.readFileSync(path.join(root, directory, 'provenance.json'), 'utf8'));
  assert.deepEqual(Object.keys(receipt.files).sort(), ['LICENSE.txt', 'kconfiglib.py']);
  for (const [name, expected] of Object.entries(receipt.files)) {
    const relative = `${directory}/${name}`;
    const bytes = fs.readFileSync(path.join(root, relative));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, relative);
    const attribute = execFileSync('git', ['check-attr', '-z', 'text', '--', relative], {cwd:root, encoding:'utf8', windowsHide:true}).split('\0');
    assert.deepEqual(attribute, [relative, 'text', 'unset', '']);
  }
});
