import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const requiredFontPackages = [
  { name: '@fontsource-variable/roboto', version: '5.2.9', stylesheets: ['index.css', 'wght-italic.css'] },
  { name: '@fontsource-variable/noto-sans-hk', version: '5.3.1', stylesheets: ['index.css'] }
];

// Production admission binds every declared subset to an emitted local file.
// It does not establish font selection or visual acceptance in a browser.
export async function writeFontInventory({ assets, packagesRoot, sourceCommit, snapshot }) {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const names = (await fs.readdir(assets)).sort();
  const files = [];
  for (const filename of names.filter(name => /\.woff2?$/.test(name))) {
    const bytes = await fs.readFile(path.join(assets, filename));
    files.push({ file: filename, bytes: bytes.length, sha256: hash(bytes) });
  }
  if (!files.length) throw new Error('Font production emitted no local font files.');
  const emittedHashes = new Set(files.map(file => file.sha256));
  const packages = [];
  for (const required of requiredFontPackages) {
    const packageRoot = path.join(packagesRoot, required.name);
    const info = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    if (info.name !== required.name || info.version !== required.version) throw new Error(`Font package does not match pinned version: ${required.name}`);
    const licenseFile = required.name.replace(/[^a-z0-9-]/g, '_') + '-LICENSE.txt';
    const license = await fs.readFile(path.join(packageRoot, 'LICENSE'));
    await fs.writeFile(path.join(assets, licenseFile), license);
    const declarations = [];
    for (const stylesheet of required.stylesheets) {
      const css = await fs.readFile(path.join(packageRoot, stylesheet), 'utf8');
      const sourceFiles = [...new Set([...css.matchAll(/url\((?:['"])?(\.\/files\/[a-z0-9-]+\.woff2)(?:['"])?\)/g)].map(match => match[1]))];
      if (!sourceFiles.length) throw new Error(`Font stylesheet has no admitted WOFF2 sources: ${required.name}/${stylesheet}`);
      const subsets = [];
      for (const source of sourceFiles) {
        const bytes = await fs.readFile(path.join(packageRoot, source));
        const sha256 = hash(bytes);
        if (!emittedHashes.has(sha256)) throw new Error(`Required font subset missing from produced assets: ${required.name}/${source}`);
        subsets.push({ file: source, bytes: bytes.length, sha256 });
      }
      declarations.push({ file: stylesheet, sha256: hash(Buffer.from(css)), subsets });
    }
    packages.push({ name: info.name, version: info.version, license: { file: licenseFile, sha256: hash(license) }, declarations });
  }
  const stylesheets = [];
  for (const file of names.filter(name => name.endsWith('.css'))) stylesheets.push({ file, sha256: hash(await fs.readFile(path.join(assets, file))) });
  const inventory = {
    schemaVersion: 2, sourceCommit, sourceSnapshotSha256: snapshot ?? null,
    acquisition: 'Exact lockfile-pinned packages; all subsets of each required stylesheet, normal and Roboto italic, bundled locally',
    packages, stylesheets, files, totalFontBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    coverage: 'Every declared source subset must match emitted bytes. Binary variation axes and glyph interpretation remain unverified.',
    rendering: 'Browser font selection, each weight, CJK fallback and offline rendering remain unverified.'
  };
  await fs.writeFile(path.join(assets, 'fonts-manifest.json'), JSON.stringify(inventory, null, 2) + '\n');
  return inventory;
}
