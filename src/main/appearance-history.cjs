'use strict';
const {createWorkspaceHistory}=require('./storage/workspace-history.cjs');
const {validateSnapshot}=require('../shared/appearance-history-contract.cjs');
function createAppearanceHistory({filePath,fonts}){const history=createWorkspaceHistory(filePath);let queue=Promise.resolve();
 async function request(value){try{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_REQUEST');
  if(value.action==='append'&&Object.keys(value).sort().join(',')==='action,snapshot'){
   const fontResult=await fonts.read();const snapshot=validateSnapshot(value.snapshot,fontResult.ok?fontResult.fonts:['Roboto','Arial','Verdana','Georgia','monospace','sans-serif','serif']);
   const revisions=history.revisions();const revision=Math.max(0,...revisions)+1;const state={revision,timestamp:new Date().toISOString(),kind:'appearance-snapshot',snapshot};history.preserve(state);return {ok:true,revision};
  }
  if(value.action==='list'&&Object.keys(value).sort().join(',')==='action,after,limit'&&Number.isSafeInteger(value.after)&&value.after>=0&&Number.isSafeInteger(value.limit)&&value.limit>=1&&value.limit<=50){const all=history.revisions().sort((a,b)=>a-b).filter(n=>n>value.after),page=all.slice(0,value.limit);return {ok:true,records:page.map(revision=>{const state=JSON.parse(history.read(revision));return {revision,timestamp:state.timestamp,elementCount:Object.keys(state.snapshot.appearance.elements).length,trackTargetCount:Object.keys(state.snapshot.motion).length};}),hasMore:all.length>page.length};}
  if(value.action==='read'&&Object.keys(value).sort().join(',')==='action,revision'&&Number.isSafeInteger(value.revision)&&value.revision>0){const state=JSON.parse(history.read(value.revision));const fontResult=await fonts.read();state.snapshot=validateSnapshot(state.snapshot,fontResult.ok?fontResult.fonts:['Roboto','Arial','Verdana','Georgia','monospace','sans-serif','serif']);if(state.revision!==value.revision)throw Error('revision');return {ok:true,revision:state.revision,snapshot:state.snapshot};}
  return {ok:false,code:'INVALID_REQUEST'};
 }catch{return {ok:false,code:'APPEARANCE_HISTORY_UNAVAILABLE'};}}
 return {request(value){const result=queue.then(()=>request(value));queue=result.then(()=>undefined,()=>undefined);return result;}};
}
module.exports={createAppearanceHistory};
