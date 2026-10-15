'use strict';
// This checks currency of an optional maintainer-local source, never conversation usage.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
(async () => {
  const base = path.join(os.homedir(),'.agents','skills','agent-global-memory','scripts');
  const dictionary = path.join(base,'vocabulary-dictionary.json');
  const method = path.join(base,'private-emission-guard.mjs');
  if (!fs.existsSync(dictionary)) { console.log('Private source absent; maintainer currency check skipped.'); return; }
  if (!fs.existsSync(method)) throw new Error('Private source is present but its currency method is unavailable.');
  const {vocabularySemanticProjection} = await import(pathToFileURL(method).href);
  const projection = vocabularySemanticProjection(JSON.parse(fs.readFileSync(dictionary,'utf8')));
  const digest = crypto.createHash('sha256').update('material-buildroot-currency-v1\n').update(typeof projection === 'string' ? projection : JSON.stringify(projection)).digest();
  const lock = path.join(os.homedir(),'.agents','vocabulary-locks','material-buildroot.lock');
  if (process.argv.includes('--refresh')) {
    fs.mkdirSync(path.dirname(lock),{recursive:true});
    fs.writeFileSync(lock,digest.toString('hex')+'\n',{mode:0o600});
    console.log('Maintainer currency lock refreshed outside the repository.');
    return;
  }
  const expected = fs.existsSync(lock) ? fs.readFileSync(lock,'utf8').trim() : '';
  if (!/^[a-f0-9]{64}$/.test(expected) || !crypto.timingSafeEqual(digest,Buffer.from(expected,'hex'))) throw new Error('Maintainer currency lock is missing or stale. Re-read the private source before explicitly refreshing the lock.');
  console.log('Maintainer source currency verified; conversation usage is not proven.');
})().catch(error => {console.error(error.message);process.exitCode=1;});
