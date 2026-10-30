'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('website/app.js','utf8');
const block=source.slice(source.indexOf("const search = document.querySelector('#doc-search');"),source.indexOf('// Public visitor state'));
function fixture(index,mode='en'){
 const events=new Map();
 const element=()=>({children:[],hidden:true,value:'',textContent:'',setAttribute(){},append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},querySelectorAll(){return [];},addEventListener(name,fn){events.set(name,fn);},closest(){return null;}});
 const search=element(),results=element(),language={addEventListener(name,fn){events.set('language:'+name,fn);}};
 const document={documentElement:{dataset:{language:mode}},querySelector(selector){return selector==='#doc-search'?search:selector==='#search-results'?results:selector==='#document-index'?(index===undefined?null:{textContent:index}):null;},createElement:element,addEventListener(){}};
 vm.runInNewContext(block,{document,language});
 return {search,results,document,input(query){search.value=query;events.get('input')();},changeLanguage(mode){document.documentElement.dataset.language=mode;events.get('language:change')();}};
}
for(const [name,value] of [['missing node',undefined],['missing asset',''],['whitespace','  '],['invalid JSON','{'],['non-array','{}'],['null','null'],['invalid entry','[null]'],['missing fields','[{"title":"Guide"}]'],['wrong field type','[{"title":"Guide","text":1,"url":"./guide.html","category":"Help"}]']])test(name+' displays unavailable instead of empty results',()=>{
 const f=fixture(value);assert.equal(f.results.hidden,false);assert.match(f.search.supportingText,/search is unavailable/);f.input('guide');assert.match(f.results.children[0].textContent,/search is unavailable/);assert.doesNotMatch(f.results.children[0].textContent,/No matching/);
});
test('valid empty index stays a valid empty search',()=>{const f=fixture('[]');assert.equal(f.results.hidden,true);f.input('guide');assert.match(f.results.children[0].textContent,/No matching documents/);assert.equal(f.search.supportingText,undefined);});
test('valid records retain local matching and links',()=>{const f=fixture(JSON.stringify([{title:'Build guide',text:'WSL runtime',url:'./guide.html',category:'Help'}]));f.input('wsl');assert.match(f.results.children[0].textContent,/1 matching document/);assert.equal(f.results.children[1].children[0].href,'./guide.html');f.input('absent');assert.match(f.results.children[0].textContent,/No matching documents/);});
test('unavailable state follows English, Cantonese and bilingual changes',()=>{const f=fixture('', 'zh');assert.match(f.search.supportingText,/文件搜尋/);assert.doesNotMatch(f.search.supportingText,/Documentation search/);f.changeLanguage('both');assert.match(f.search.supportingText,/Documentation search.*文件搜尋/);f.changeLanguage('en');assert.doesNotMatch(f.search.supportingText,/文件搜尋/);});
