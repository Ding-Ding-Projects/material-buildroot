import { indexedSources, admittedSource } from './source-boundary.mjs';
export const rootDocuments = ['README.md','PLAN.md','DECISIONS.md','ROADMAP.md','NEXT_SESSION.md','HANDOFF.md','CLOSEOUT_PROMPT.md','AGENTS.md','website/README.md'];
export async function documentSources(root, index=indexedSources(root)) {
  const sources=[...rootDocuments, ...[...index].filter(source => /^(?:docs|design)\//.test(source) && !source.startsWith('docs/site/') && source.endsWith('.md'))];
  const unique=[...new Set(sources)].sort();
  for (const source of unique) admittedSource(root,source,index);
  return unique;
}
export function categoryFor(source) {
  if (source.startsWith('design/')) return 'Design';
  if (!source.startsWith('docs/') || source === 'docs/README.md') return 'Planning';
  const name = source.split('/')[1];
  return name.charAt(0).toUpperCase()+name.slice(1);
}
