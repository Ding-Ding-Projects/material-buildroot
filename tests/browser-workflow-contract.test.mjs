import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../website/app.js', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const host = fs.readFileSync(new URL('../src/main/operations-service.cjs', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function bounded(text, start, end) {
  const from=text.indexOf(start), to=text.indexOf(end,from);
  assert.ok(from>=0 && to>from, 'Exact production section must exist');
  return text.slice(from,to);
}
class Element {
  children=[]; ownText='';
  set textContent(value){this.ownText=String(value);this.children=[];}
  get textContent(){return this.ownText+this.children.map(child=>child.textContent).join(' ');}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];this.ownText='';}
}
function renderer(language='en') {
  const region=new Element();
  const context=vm.createContext({document:{createElement:()=>new Element()},visitor:{querySelector:()=>region},copy:(en,zh)=>language==='zh'?zh:language==='both'?`${en} · ${zh}`:en,companionError:()=> 'Request unavailable',lastCompanionResult:null});
  vm.runInContext(bounded(source,'  function renderCompanionData(',"  language?.addEventListener('change', () => {"),context);
  return {region,context,render:(action,result,error='')=>context.renderCompanionData(action,result,error)};
}
const now='2026-10-16T12:00:00.000Z';
const plan={id:'plan-1',name:'Sample plan',runtime:'wsl',target:'sdk',status:'draft',updatedAt:now,notes:'PRIVATE-NOTES'};
const job={id:'job-1',kind:'build',state:'completed',sequence:2,createdAt:now,updatedAt:now,logCount:3,itemCount:1,ownerId:'owner',logs:'PRIVATE-LOGS'};
function hostResult(action) {
  const body=bounded(host,'            const summarizeJob =','\n          },\n        })');
  return new Function('request','workspaceRead','projectStore','projects','jobs','owner','reject',body)(
    {action,args:{}},()=>({ok:true,state:{revision:3,onboardingCompleted:true,plans:[plan],preferences:{theme:'PRIVATE-PREFERENCE'}}}),
    {list:()=>[{id:'project-1',name:'Sample project',root:'PRIVATE-PATH'}]},new Map([['project-1',{}]]),{list:()=>[job]},'owner',()=>{throw Error('rejected');});
}
for(const [action,label] of [['workspace.read','Sample plan'],['projects.list','Sample project'],['jobs.list','build · completed']]) {
  test(`${action} renders the actual host privacy projection`,()=>{
    const {render,region}=renderer();render(action,hostResult(action));
    assert.ok(region.textContent.includes(label),region.textContent);
    assert.doesNotMatch(region.textContent,/PRIVATE-|Theme preference|did not match/);
  });
}
test('empty host lists and all language modes preserve honest summaries',()=>{
  for(const language of ['en','zh','both'])for(const [action,result] of [['workspace.read',{revision:0,onboardingCompleted:false,plans:[]}],['projects.list',{projects:[]}],['jobs.list',{jobs:[]}]]){
    const {render,region}=renderer(language);render(action,result);
    assert.match(region.textContent,/0/);assert.doesNotMatch(region.textContent,/did not match|不符/);
  }
});
test('malformed results show no partial records or raw private values',()=>{
  for(const [action,result] of [['workspace.read',{state:{plans:[plan],preferences:{theme:'PRIVATE-PREFERENCE'}}}],['workspace.read',{revision:0,onboardingCompleted:'yes',plans:[plan]}],['projects.list',{projects:[{id:'1',name:'PRIVATE-RECORD',authorized:true},null]}],['jobs.list',{jobs:[{...job,sequence:-1}]}],['projects.list',{projects:Array(1001).fill({id:'1',name:'PRIVATE-RECORD',authorized:true})}]]){
    const {render,region,context}=renderer();assert.doesNotThrow(()=>render(action,result));
    assert.doesNotMatch(region.textContent,/PRIVATE-/);assert.match(region.textContent,/did not match|unavailable/);
    assert.equal(context.lastCompanionResult.result,null);
  }
});
test('action replies retain sequence recovery and never automatically retry',async()=>{
  for(const outcome of ['valid','malformed','lost']){
    const {context,region}=renderer();let listener,requests=0;
    const button={dataset:{companionAction:'workspace.read'},addEventListener:(_name,callback)=>listener=callback};
    context.visitor.querySelectorAll=()=>[button];
    Object.assign(context,{companion:{session:{scopes:['workspace:read']},nextSequence:1,csrfToken:'fixture'},actionScope:{'workspace.read':'workspace:read'},companionMessage:new Element(),makeUUID:()=> 'fixture',companionFetch:async()=>{requests++;if(outcome==='lost')throw Error('lost');return {response:{ok:true},payload:{nextSequence:2,operation:{action:'workspace.read',state:'succeeded'},result:outcome==='valid'?hostResult('workspace.read'):{state:{preferences:{theme:'PRIVATE-PREFERENCE'}}}}};}});
    vm.runInContext(bounded(source,"  visitor.querySelectorAll('[data-companion-action]').forEach(button=>button.addEventListener('click',async()=>{",'\n  function renderCompanionData('),context);
    await listener();assert.equal(requests,1);assert.equal(button.disabled,false);
    if(outcome==='valid'){assert.match(context.companionMessage.textContent,/returned a read-only result/);assert.match(region.textContent,/Sample plan/);}
    else {assert.doesNotMatch(context.companionMessage.textContent,/returned a read-only result/);assert.doesNotMatch(region.textContent,/PRIVATE-/);assert.equal(context.lastCompanionResult.result,null);}
    if(outcome==='lost'){assert.equal(context.companion.sequenceUnknown,true);await listener();assert.equal(requests,1);assert.match(context.companionMessage.textContent,/Refresh the session sequence/);}
    else assert.equal(context.companion.nextSequence,2);
  }
});
test('a language rerender cannot restore records after a malformed or lost reply',async()=>{
  for(const outcome of ['malformed','lost']){
    const {context,region}=renderer();let actionListener,languageListener,requests=0;
    const button={dataset:{companionAction:'workspace.read'},addEventListener:(_name,callback)=>actionListener=callback};
    context.visitor.querySelectorAll=()=>[button];
    Object.assign(context,{
      companion:{session:{scopes:['workspace:read']},nextSequence:1,csrfToken:'fixture'},
      actionScope:{'workspace.read':'workspace:read'},companionMessage:new Element(),makeUUID:()=> 'fixture',
      language:{addEventListener:(_name,callback)=>languageListener=callback},showCompanionSession:()=>{},
      companionFetch:async()=>{
        requests++;
        if(requests===2&&outcome==='lost')throw Error('lost');
        return {response:{ok:true},payload:{nextSequence:requests+1,operation:{action:'workspace.read',state:'succeeded'},
          result:requests===1?hostResult('workspace.read'):{state:{plans:[plan],preferences:{theme:'PRIVATE-PREFERENCE'}}}}};
      },
    });
    vm.runInContext(bounded(source,"  visitor.querySelectorAll('[data-companion-action]').forEach(button=>button.addEventListener('click',async()=>{",'\n  function renderCompanionData('),context);
    vm.runInContext(bounded(source,"  language?.addEventListener('change', () => {\n    if(companion)",'\n}\n\nlet phaseFilter'),context);
    await actionListener();assert.match(region.textContent,/Sample plan/);
    await actionListener();assert.equal(requests,2);assert.equal(context.lastCompanionResult.result,null);
    assert.doesNotMatch(region.textContent,/Sample plan|PRIVATE-/);
    context.copy=(en,zh)=>zh;context.companionError=()=> '未能使用要求';
    languageListener();
    assert.equal(requests,2);assert.equal(context.lastCompanionResult.result,null);
    assert.doesNotMatch(region.textContent,/Sample plan|PRIVATE-/);
    assert.match(region.textContent,/未能使用要求/);
  }
});
test('dynamic supporting links match generated article routes for every guide stage',()=>{
  const guides=vm.runInNewContext(bounded(source,'const taskGuides =','// The field guide')+'\ntaskGuides;');
  const stages=Object.values(guides).flatMap(group=>group.stages);assert.ok(stages.length>=10);
  const assignment=source.split('\n').find(line=>line.includes("const reference=learning.querySelector('#workflow-reference')"));
  assert.ok(assignment);
  const builder=fs.readFileSync(new URL('../website/build.mjs',import.meta.url),'utf8');
  const docLine=builder.split(/\r?\n/).find(line=>line.startsWith('  const doc = {source, content,'));assert.ok(docLine);
  for(const current of stages){
    const reference={};vm.runInNewContext(assignment,{learning:{querySelector:()=>reference},current,copy:en=>en});
    const generated=vm.runInNewContext(docLine+'\ndoc.url;',{source:current.url,content:'',base:'/material-buildroot/',categoryFor:()=> 'fixture'});
    assert.equal(reference.href,generated);
    assert.ok(fs.existsSync(new URL('../'+current.url,import.meta.url)));
  }
});
