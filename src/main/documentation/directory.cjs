'use strict';
const path = require('node:path');

// Only host runtime state selects this root. Never accept a renderer path.
function documentationDirectory({ isPackaged, appPath, resourcesPath }) {
  const root = isPackaged ? resourcesPath : appPath;
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new TypeError('An absolute host documentation root is required.');
  return path.join(root, isPackaged ? 'documentation' : 'dist/documentation');
}

module.exports = { documentationDirectory };
