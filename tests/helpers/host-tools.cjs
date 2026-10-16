'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

function hostTool(name) {
  const override = process.env[`TEST_${name.toUpperCase()}_EXECUTABLE`];
  const candidates = override ? [override] : [];
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    for (const file of process.platform === 'win32' ? [`${name}.exe`, name] : [name]) candidates.push(path.join(directory, file));
  }
  if (process.platform === 'win32') {
    if (name === 'openssl') candidates.push(path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git/usr/bin/openssl.exe'));
    if (name === 'python3') candidates.push(path.join(path.dirname(process.execPath), '../../python/python.exe'));
  }
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate) || !fs.existsSync(candidate)) continue;
    const resolved = fs.realpathSync(candidate);
    const check = cp.spawnSync(resolved, [name === 'openssl' ? 'version' : '--version'], {encoding:'utf8', windowsHide:true});
    if (check.status === 0 && (name === 'openssl' ? /^OpenSSL / : /^Python 3\./).test(check.stdout || check.stderr || '')) return resolved;
  }
  throw new Error(`Required test executable unavailable: ${name}; provide TEST_${name.toUpperCase()}_EXECUTABLE with an absolute path.`);
}
module.exports = {hostTool};
