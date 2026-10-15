import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function resolveDocumentLink(source, reference) {
  const decoded = decodeURIComponent(reference);
  if (!decoded || /[\\:\u0000-\u001f\u007f]/.test(decoded) || path.posix.isAbsolute(decoded)) throw new Error('Unsafe local documentation reference.');
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source),decoded));
  if (relative === '..' || relative.startsWith('../')) throw new Error('Documentation reference escapes source.');
  return relative;
}

export function containedPath(root, relative) {
  if (typeof relative !== 'string' || !relative || /[\\:\u0000-\u001f\u007f]/.test(relative) || path.posix.isAbsolute(relative) || relative.split('/').some(part=>!part || part==='.' || part==='..')) throw new Error('Invalid documentation path.');
  const base=path.resolve(root), resolved=path.resolve(base,relative);
  const inside=path.relative(base,resolved);
  if (!inside || inside==='..' || inside.startsWith('..'+path.sep) || path.isAbsolute(inside)) throw new Error('Documentation path escapes root.');
  let cursor=resolved;
  while (true) {
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Documentation path contains a symbolic link or junction.'); }
    catch (error) { if (error.code!=='ENOENT') throw error; }
    const parent=path.dirname(cursor);
    if (parent===cursor) break;
    cursor=parent;
  }
  return resolved;
}

export function sourceSnapshot(root, files) {
  const digest=createHash('sha256');
  for (const file of files) {
    const full=containedPath(root,file);
    if (!fs.lstatSync(full).isFile()) throw new Error('Documentation source is not a regular file.');
    digest.update(file+'\0').update(fs.readFileSync(full)).update('\0');
  }
  return digest.digest('hex');
}
