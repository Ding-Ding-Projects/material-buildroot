import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../website/build.mjs', import.meta.url), 'utf8');
const renderSource = source.slice(source.indexOf('function renderDocumentIndex('), source.indexOf('function page('));
const renderDocumentIndex = vm.runInNewContext(`(${renderSource.trim()})`);
const pageSource = source.slice(source.indexOf('function page('), source.indexOf('\nconst roadmap ='));
const page = vm.runInNewContext(`(${pageSource.trim()})`, {
  esc: value => value, origin: '/docs/', base: '/docs/', repository: '/source/',
  logo: '', nav: [], url: value => value, label: value => value, provenance: '',
});

test('shared search data preserves complete records and multiline source bytes', () => {
  const records = [
    {title: 'Article', url: '/docs/article.html', category: 'Reference', text: 'First\nSecond\r\n\nLast\n'},
    {title: '粵語', url: '/docs/second.html', category: 'Guide', text: '完整內容 😀\t\u0000'},
  ];
  const node = {textContent: ''};
  const context = {document: {getElementById: id => id === 'document-index' ? node : null}};
  const script = renderDocumentIndex(records);
  vm.runInNewContext(script, context);
  assert.deepEqual(JSON.parse(node.textContent), records);
  assert.deepEqual(Object.keys(context), ['document'], 'data stays inside the script closure');
  assert.ok(script.includes('"First",\n'), 'source lines remain independently reviewable');
  assert.ok(script.includes('"Second\\r",\n'), 'carriage returns survive readable serialization');
});

test('shared serialization escapes script boundaries and cannot execute source strings', () => {
  const text = '</script><script>globalThis.injected = true</script>\u2028\u2029"\\\n';
  const records = [{title: '<title>', url: '/docs/?x=<', category: 'Reference', text}];
  const node = {textContent: ''};
  const context = {document: {getElementById: () => node}};
  const script = renderDocumentIndex(records);
  assert.ok(!script.includes('<'));
  assert.ok(!script.includes('\u2028') && !script.includes('\u2029'));
  vm.runInNewContext(script, context);
  assert.deepEqual(JSON.parse(node.textContent), records);
  assert.equal(context.injected, undefined);
});

test('every page has one empty target and one synchronous local data script', () => {
  for (const body of ['Article body', 'Different content']) {
    const html = page('Title', body);
    const targets = [...html.matchAll(/<script type="application\/json" id="document-index">([\s\S]*?)<\/script>/g)];
    assert.equal(targets.length, 1);
    assert.equal(targets[0][1], '');
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
    const data = scripts.filter(match => match[1].includes('src="/docs/site/assets/document-index.js"'));
    const module = scripts.find(match => match[1].includes('src="/docs/site/assets/app.js"'));
    assert.equal(data.length, 1);
    assert.ok(!/\b(?:async|defer|type)\s*(?:=|\s|$)/.test(data[0][1]));
    assert.ok(module[1].includes('type="module"') && !/\basync\b/.test(module[1]));
    assert.ok(targets[0].index < data[0].index && data[0].index < html.indexOf('</body>'));
    assert.ok(!html.includes('"text":'), 'page does not repeat full search data');
  }
});

test('synchronous population precedes the unchanged module consumer', () => {
  const node = {textContent: ''};
  const context = {document: {getElementById: () => node, querySelector: () => node}};
  const records = [{title: 'Loaded', url: '/docs/loaded.html', category: 'Guide', text: 'Full article'}];
  vm.runInNewContext(renderDocumentIndex(records), context);
  const consumed = vm.runInNewContext('JSON.parse(document.querySelector("#document-index")?.textContent || "[]")', context);
  assert.deepEqual(JSON.parse(JSON.stringify(consumed)), records);
  assert.throws(() => vm.runInNewContext(renderDocumentIndex(records), {document: {getElementById: () => null}}), /target is unavailable/);
  vm.runInNewContext(renderDocumentIndex([]), context);
  assert.deepEqual(JSON.parse(node.textContent), []);
});
