// Source naming declares the article language; UI preferences never translate it.
export function articleLanguage(source) {
  if (typeof source !== 'string' || !source.endsWith('.md')) throw new Error('Article source must be a Markdown path');
  return source.endsWith('.zh-HK.md') ? 'zh-HK' : 'en';
}

export function articleSourceLabel(source) {
  const language = articleLanguage(source);
  const english = language === 'zh-HK' ? 'Project record · Cantonese source' : 'Project record · English source';
  const cantonese = language === 'zh-HK' ? '項目記錄 · 粵語原文' : '項目記錄 · 英文原文';
  return `<span class="article-source-language" data-source-language="${language}"><span class="en" lang="en">${english}</span><span class="zh" lang="zh-HK">${cantonese}</span></span>`;
}

export function articleBody(source, rendered) {
  return `<div class="article-body" lang="${articleLanguage(source)}">${rendered}</div>`;
}

export function verifyArticleLanguage(source, html) {
  if (!html.includes(articleSourceLabel(source))) throw new Error(`${source}: missing or incorrect source-language metadata`);
  if (!html.includes(`<div class="article-body" lang="${articleLanguage(source)}">`)) throw new Error(`${source}: missing or incorrect article language`);
}
