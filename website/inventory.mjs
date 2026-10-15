import fs from 'node:fs/promises';
import path from 'node:path';
import { containedPath } from './source-boundary.mjs';
export const rootDocuments = ['README.md','PLAN.md','DECISIONS.md','ROADMAP.md','NEXT_SESSION.md','HANDOFF.md','CLOSEOUT_PROMPT.md','AGENTS.md','website/README.md'];
export async function documentSources(root) {
  const sources = [...rootDocuments];
  async function walk(relative) {
    for (const entry of (await fs.readdir(containedPath(root,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const child = `${relative}/${entry.name}`;
      if (child === 'docs/site') continue;
      if (entry.isSymbolicLink()) throw new Error(`Documentation input must not be a link: ${child}`);
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile() && entry.name.endsWith('.md')) sources.push(child);
    }
  }
  await walk('docs'); await walk('design');
  return [...new Set(sources)].sort();
}
export function categoryFor(source) {
  if (source.startsWith('design/')) return 'Design';
  if (!source.startsWith('docs/') || source === 'docs/README.md') return 'Planning';
  const name = source.split('/')[1];
  return name.charAt(0).toUpperCase()+name.slice(1);
}
