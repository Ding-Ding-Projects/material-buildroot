import assert from 'node:assert/strict';
import { articleLanguage, articleSourceLabel, articleBody, verifyArticleLanguage } from './article-language.mjs';

for (const [source, language, text] of [
  ['docs/wiki/Home.zh-HK.md', 'zh-HK', '<h1>專案 wiki</h1><p>來源內容。</p>'],
  ['docs/wiki/Home.md', 'en', '<h1>Project wiki</h1><p>Source content.</p>']
]) {
  assert.equal(articleLanguage(source), language);
  const html = articleSourceLabel(source) + articleBody(source, text);
  verifyArticleLanguage(source, html);
  assert.ok(html.includes(text), 'Source content must remain exact');
  assert.ok(html.includes('lang="en"') && html.includes('lang="zh-HK"'), 'Both UI labels declare their own language');
  const other = source.endsWith('.zh-HK.md') ? 'docs/wiki/Home.md' : 'docs/wiki/Home.zh-HK.md';
  assert.throws(() => verifyArticleLanguage(source, articleSourceLabel(other) + articleBody(source, text)), /metadata/);
  assert.throws(() => verifyArticleLanguage(source, html.replace(`class="article-body" lang="${language}"`, 'class="article-body"')), /article language/);
  assert.throws(() => verifyArticleLanguage(source, articleSourceLabel(source) + articleBody(other, text)), /article language/);
  assert.throws(() => verifyArticleLanguage(source, articleBody(source, text)), /metadata/);
}
assert.equal(articleLanguage('docs/zh-HK-context.md'), 'en', 'Only the exact article suffix declares Cantonese');
for (const source of [null, '', 'docs/Home.html']) assert.throws(() => articleLanguage(source), /Markdown path/);
console.log('PASS: source-derived English/Cantonese labels and body languages; wrong/missing labels and languages rejected; source contents unchanged.');
