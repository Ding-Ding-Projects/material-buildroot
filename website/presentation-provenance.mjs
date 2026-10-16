import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Describe the bytes the existing bundler actually emitted, without inferring
// character coverage, variation axes, browser selection, or rendering acceptance.
export async function writeFontInventory({ assets, packageRoot, sourceCommit, snapshot }) {
  const packageInfo = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const licenseFile = '_fontsource-variable_roboto-LICENSE.txt';
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const license = await fs.readFile(path.join(assets, licenseFile));
  const files = [];
  for (const filename of (await fs.readdir(assets)).filter(name => /\.woff2?$/.test(name)).sort()) {
    const bytes = await fs.readFile(path.join(assets, filename));
    files.push({ file: filename, bytes: bytes.length, sha256: hash(bytes) });
  }
  if (!files.length) throw new Error('Documentation font production emitted no local font files.');
  const css = await fs.readFile(path.join(assets, 'app.css'));
  const inventory = {
    schemaVersion: 1, sourceCommit, sourceSnapshotSha256: snapshot,
    package: { name: packageInfo.name, version: packageInfo.version, license: packageInfo.license },
    acquisition: 'Lockfile-pinned npm package, bundled locally by the root documentation build',
    license: { file: licenseFile, sha256: hash(license) },
    stylesheet: { file: 'app.css', sha256: hash(css) }, files,
    coverage: 'Emitted files only; complete family coverage and binary variation axes remain unverified.',
    rendering: 'Browser font selection, each weight, CJK fallback and offline rendering remain unverified.'
  };
  await fs.writeFile(path.join(assets, 'fonts-manifest.json'), JSON.stringify(inventory, null, 2) + '\n');
  return inventory;
}
