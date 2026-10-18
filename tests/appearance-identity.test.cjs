'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/appearance-panel.ts'),'utf8');
const implementation=stripTypeScriptTypes(source.slice(source.indexOf('function parent('),source.indexOf('function attach('))).replace('export function','function');
let reads=0;
class Element {
 constructor(name,attrs={}){this.localName=name;this.attrs={...attrs};this.nodes=[];this.parentElement=null;this.root=null;}
 get children(){reads++;return this.nodes;}
 get id(){return this.attrs.id||'';}
 getAttribute(key){return Object.hasOwn(this.attrs,key)?this.attrs[key]:null;}
 matches(){return ['tr','li'].includes(this.localName)||['row','listitem'].includes(this.attrs.role)||Object.hasOwn(this.attrs,'data-record');}
 getRootNode(){return this.parentElement?this.parentElement.getRootNode():this.root||this;}
 add(child){child.parentElement=this;child.root=null;this.nodes.push(child);return child;}
}
class ShadowRoot {constructor(host){this.host=host;this.nodes=[];}add(child){child.parentElement=null;child.root=this;this.nodes.push(child);return child;}}
class WorkspaceTabs extends Element {constructor(){super('workspace-tabs');}}
const parent=el=>el.parentElement||(el.getRootNode() instanceof ShadowRoot?el.getRootNode().host:null);
function hash(parts){let a=2166136261,b=5381;for(const char of JSON.stringify(parts)){a=Math.imul(a^char.charCodeAt(0),16777619);b=Math.imul(b,33)^char.charCodeAt(0);}return 'e'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
// Frozen pre-optimization algorithm is an independent compatibility oracle.
function legacy(target,root){
 const suffix=[];
 for(let el=target;el&&el!==root;el=parent(el)){
  const key=el.getAttribute('data-appearance-key');
  if(el.getAttribute('data-appearance-owner')==='workspace-tabs'&&key&&/^[a-zA-Z0-9:._-]{1,320}$/.test(key)&&/^(?:tab:(?:workspace|utility):|group:)/.test(key)){
   let owner=el;while(owner&&!(owner instanceof WorkspaceTabs))owner=parent(owner);
   if(owner){let scope=owner;while(scope&&scope!==root)scope=parent(scope);if(scope===root)return {key:hash(['owned-presentation-v1','workspace-tabs',key,...suffix]),durable:true};}
  }
  const explicit=el.getAttribute('data-appearance-key')||el.getAttribute('data-id')||el.id;
  const siblings=el.parentElement?Array.from(el.parentElement.children).filter(s=>s.localName===el.localName):[];
  suffix.unshift(el.localName+':'+(explicit?'key:'+explicit:'position:'+siblings.indexOf(el))+':'+(el.getAttribute('type')||''));
 }
 const chain=[];let durable=true;
 for(let el=target;el&&el!==root;el=parent(el)){
  const explicit=el.getAttribute('data-appearance-key')||el.getAttribute('data-id')||el.id;
  if(!explicit&&el.matches('tr,li,[role=row],[role=listitem],[data-record]'))durable=false;
  const siblings=el.parentElement?Array.from(el.parentElement.children).filter(s=>s.localName===el.localName):[];
  chain.unshift(el.localName+':'+(explicit?'key:'+explicit:'position:'+siblings.indexOf(el))+':'+(el.getAttribute('type')||''));
 }
 chain.unshift(root?.route||'global');let a=2166136261,b=5381;for(const char of chain.join('/')){a=Math.imul(a^char.charCodeAt(0),16777619);b=Math.imul(b,33)^char.charCodeAt(0);}return {key:'e'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0'),durable};
}
function fixture(){const root=new Element('material-buildroot');root.route='operations';const shadow=new ShadowRoot(root);const create=new Function('app','customElements','ShadowRoot',implementation+';return createAppearanceIdentityLookup;')(()=>root,{get:name=>name==='workspace-tabs'?WorkspaceTabs:undefined},ShadowRoot);return {root,shadow,create};}
function compare(f,targets){const identify=f.create();for(const target of targets)assert.deepEqual(identify(target),legacy(target,f.root),target.localName+' '+JSON.stringify(target.attrs));}
test('appearance identities preserve mixed siblings, keys, record durability and shadow ancestry',()=>{
 const f=fixture(),section=f.shadow.add(new Element('section')),targets=[f.root,section];
 for(const [tag,attrs] of [['span',{}],['button',{}],['span',{}],['input',{type:'number'}],['li',{}],['li',{id:'kept'}],['div',{'data-record':''}],['div',{'data-id':'record'}],['div',{'data-appearance-key':'own',id:'ignored'}]]){const node=section.add(new Element(tag,attrs));targets.push(node,node.add(new Element('span')));}
 const host=section.add(new Element('custom-panel')),shadow=new ShadowRoot(host);targets.push(host,shadow.add(new Element('div')),shadow.add(new Element('span')));
 compare(f,targets);
});
test('workspace-owned identities preserve validation, nested roots and stable reordered tab identity',()=>{
 const f=fixture(),tabs=f.shadow.add(new WorkspaceTabs()),shadow=new ShadowRoot(tabs),container=shadow.add(new Element('div'));
 const a=container.add(new Element('button',{'data-appearance-owner':'workspace-tabs','data-appearance-key':'tab:workspace:a'}));
 const b=container.add(new Element('button',{'data-appearance-owner':'workspace-tabs','data-appearance-key':'tab:utility:b'}));
 const child=a.add(new Element('span')),inner=new ShadowRoot(child).add(new Element('b'));
 const invalid=container.add(new Element('button',{'data-appearance-owner':'workspace-tabs','data-appearance-key':'not-a-tab'}));
 const spoof=f.shadow.add(new Element('button',{'data-appearance-owner':'workspace-tabs','data-appearance-key':'tab:workspace:a'}));
 const outside=new WorkspaceTabs(),detached=outside.add(new Element('button',{'data-appearance-owner':'workspace-tabs','data-appearance-key':'tab:workspace:a'}));
 const targets=[a,b,child,inner,invalid,spoof,detached];compare(f,targets);const before=f.create()(inner);
 container.nodes.reverse();compare(f,targets);assert.deepEqual(f.create()(inner),before);
});
test('new discovery passes invalidate sibling, key, type, route and reparented ancestry caches',()=>{
 const f=fixture(),a=f.shadow.add(new Element('section')),b=f.shadow.add(new Element('article')),first=a.add(new Element('input')),second=a.add(new Element('input'));const targets=[a,b,first,second];
 const original=f.create()(second);a.nodes.reverse();compare(f,targets);assert.notDeepEqual(f.create()(second),original);
 second.attrs.id='fixed';second.attrs.type='number';compare(f,targets);
 a.nodes=a.nodes.filter(x=>x!==second);b.add(second);compare(f,targets);
 const before=f.create()(second);f.root.route='settings';compare(f,targets);assert.notDeepEqual(f.create()(second),before);
});
test('a 3263-package discovery indexes each sibling container once and retains every old key',()=>{
 const f=fixture(),select=f.shadow.add(new Element('md-outlined-select')),targets=[];
 for(let i=0;i<3263;i++){const option=select.add(new Element('md-select-option',{value:'package-'+i}));targets.push(option,option.add(new Element('div',{slot:'headline'})));}
 const expected=targets.map(target=>legacy(target,f.root));reads=0;const identify=f.create(),actual=targets.map(identify),indexedReads=reads;
 assert.deepEqual(actual,expected);assert.equal(indexedReads,3264,'one index for the option container and one for each headline container');
});
