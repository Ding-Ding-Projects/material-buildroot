'use strict';
const {createWorkspaceHistory}=require('../storage/workspace-history.cjs');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
function validate(value){
 if(!exact(value,'modes,narration,schemaVersion')||value.schemaVersion!==1||!exact(value.modes,'focus,lowStimulation,momentum,oneThing,timeAwareness')||Object.values(value.modes).some(v=>typeof v!=='boolean')||!exact(value.narration,'enabled,language,pitch,rate')||typeof value.narration.enabled!=='boolean'||!['en','zh-HK','both'].includes(value.narration.language)||!Number.isFinite(value.narration.rate)||value.narration.rate<0.1||value.narration.rate>10||!Number.isFinite(value.narration.pitch)||value.narration.pitch<0||value.narration.pitch>2)throw Error('INVALID_REQUEST');
 return JSON.parse(JSON.stringify(value));
}
function createAttentionHistory({filePath}){const history=createWorkspaceHistory(filePath);let queue=Promise.resolve();
 async function request(value){try{
  if(exact(value,'action,snapshot')&&value.action==='append'){const snapshot=validate(value.snapshot);const revisions=history.revisions();const revision=Math.max(0,...revisions)+1;history.preserve({revision,timestamp:new Date().toISOString(),kind:'attention-snapshot',snapshot});return {ok:true,revision};}
  if(exact(value,'action,after,limit')&&value.action==='list'&&Number.isSafeInteger(value.after)&&value.after>=0&&Number.isSafeInteger(value.limit)&&value.limit>=1&&value.limit<=50){const all=history.revisions().sort((a,b)=>a-b).filter(n=>n>value.after),page=all.slice(0,value.limit);return {ok:true,records:page.map(revision=>{const state=JSON.parse(history.read(revision));return {revision,timestamp:state.timestamp};}),hasMore:all.length>page.length};}
  if(exact(value,'action,revision')&&value.action==='read'&&Number.isSafeInteger(value.revision)&&value.revision>0){const state=JSON.parse(history.read(value.revision));if(state.revision!==value.revision)throw Error('INVALID_REVISION');return {ok:true,revision:state.revision,snapshot:validate(state.snapshot)};}
  return {ok:false,code:'INVALID_REQUEST'};
 }catch{return {ok:false,code:'ATTENTION_HISTORY_UNAVAILABLE'};}}
 return {request(value){const result=queue.then(()=>request(value));queue=result.then(()=>undefined,()=>undefined);return result;}};
}
module.exports={createAttentionHistory};
