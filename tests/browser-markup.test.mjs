import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const builder=fs.readFileSync(new URL('../website/build.mjs',import.meta.url),'utf8').replace(/\r\n?/g,'\n');
const app=fs.readFileSync(new URL('../website/app.js',import.meta.url),'utf8').replace(/\r\n?/g,'\n');
const builtPath=process.env.MATERIAL_BROWSER_MARKUP_INPUT;
const definitions=builder.split('\n').filter(line=>/^const (esc|label|ariaLabel) = /.test(line)).join('\n');
const targets=[['learning-jump','Learning activities','學習活動'],['walkthrough-rail','Workflow steps','工作流程步驟']];
function tagFor(target) {
  if(builtPath){
    const built=fs.readFileSync(builtPath,'utf8');
    const marker=target==='learning-jump'?'<nav class="learning-jump"':'<div class="walkthrough-rail"';
    const from=built.indexOf(marker);assert.ok(from>=0);
    return built.slice(from,built.indexOf('>',from)+1);
  }
  // Evaluate only the exact production opening tag, never reconstruct a page.
  const line=builder.split('\n').find(line=>line.includes(`class="${target}"`));assert.ok(line);
  const marker=target==='learning-jump'?'<nav class="learning-jump"':'<div class="walkthrough-rail"';
  const from=line.indexOf(marker);
  const end=line.indexOf(target==='learning-jump'?'><a':'></div>',from);
  assert.ok(end>from);
  return vm.runInNewContext(definitions+'\n`'+line.slice(from,end+1)+'`;');
}
for(const [target,en,zh] of targets)test(`${target} has escaped text attributes, never nested markup`,()=>{
  const tag=tagFor(target);
  assert.doesNotMatch(tag,/aria-label="<|<span|<\/span/);
  assert.ok(tag.includes(`aria-label="${en} · ${zh}"`),tag);
  assert.ok(tag.includes(`data-aria-en="${en}"`),tag);
  assert.ok(tag.includes(`data-aria-zh="${zh}"`),tag);
});
test('attribute helper escapes quotes, angle brackets and ampersands',()=>{
  const output=vm.runInNewContext(definitions+'\nariaLabel(\'A "quote" <tag> & value\',\'乙\');');
  assert.match(output,/&quot;quote&quot; &lt;tag&gt; &amp; value/);
  assert.doesNotMatch(output,/<tag>|="A "quote"/);
});
test('existing language control updates both accessible names on load and change',()=>{
  let listener;const saved=[];
  const nodes=targets.map(([,en,zh])=>({dataset:{ariaEn:en,ariaZh:zh},setAttribute(name,value){this[name]=value;}}));
  const control={value:'',addEventListener(name,callback){assert.equal(name,'change');listener=callback;}};
  const from=app.indexOf("const language = document.querySelector('#language');"),to=app.indexOf('const taskGuides =',from);
  assert.ok(from>=0&&to>from);
  const context={document:{querySelector:()=>control,querySelectorAll:selector=>{assert.equal(selector,'[data-aria-en][data-aria-zh]');return nodes;},documentElement:{dataset:{}}},read:()=> 'both',save:(...args)=>saved.push(args)};
  vm.runInNewContext(app.slice(from,to),context);
  for(const mode of ['both','en','zh','both']){
    if(mode!==control.value){control.value=mode;listener();}
    targets.forEach(([,en,zh],index)=>assert.equal(nodes[index]['aria-label'],mode==='en'?en:mode==='zh'?zh:`${en} · ${zh}`));
  }
  assert.deepEqual(saved.at(-1),['mb-docs-language','both']);
});
