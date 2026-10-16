'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Junctions exercise real directory reparse-point boundaries without requiring
// Windows symbolic-link privileges. File links retain their actual capability.
function linkType(target, destination, type) {
  if (process.platform !== 'win32') return type;
  try {
    const resolved = path.resolve(path.dirname(destination), target);
    if (fs.statSync(resolved).isDirectory()) return 'junction';
  } catch {}
  return type;
}
function symlinkSync(target, destination, type) {
  return fs.symlinkSync(target, destination, linkType(target, destination, type));
}
function symlink(target, destination, type) {
  return fs.promises.symlink(target, destination, linkType(target, destination, type));
}
async function fileLinkCase(t, name, body) {
  return t.test(name, async linkTest => {
    try { await body(); }
    catch (error) {
      if (process.platform === 'win32' && error.code === 'EPERM' && error.syscall === 'symlink') {
        linkTest.skip('Real file symbolic-link privilege is unavailable; this file-link case remains unverified.');
        return;
      }
      throw error;
    }
  });
}
module.exports = {symlinkSync, symlink, fileLinkCase};
