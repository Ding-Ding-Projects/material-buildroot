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
module.exports = {symlinkSync, symlink};
