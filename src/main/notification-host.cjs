"use strict";
const path = require('node:path');
const {createNotificationStore} = require('./jobs/notifications.cjs');
const {renderMarkdown} = require('./documentation/service.cjs');
const releases = require('./documentation/releases.json');
/** The renderer may review host records, never manufacture notifications or release facts. */
function createNotificationHost({directory,admitted,openExternal,changed=()=>{}}) {
  const store=createNotificationStore({directory});
  const links=new Map();
  const changelog=releases.entries.map(entry=>{
    const rendered=renderMarkdown(entry.body||'No release notes were recorded.',{source:'release-notes.md',documents:[],assets:[]});
    for(const link of rendered.links) links.set(`${entry.tag}:${link.id}`,link.url);
    return {...entry,html:rendered.html,unavailableResources:rendered.issues.length};
  });
  const notify=(title,message,severity='info')=>{try{store.notify({title,message,severity});changed();}catch{/* Reporting must not change the operation result. */}};
  const view=()=>{
    const records=[],reviews=new Map();
    let next=0,more=true;
    while(more){const page=store.page({after:next,limit:100});next=page.next;more=page.hasMore;for(const item of page.records){if(item.kind==='notification')records.push(item);else if(item.kind==='review')reviews.set(item.notificationId,item.status);}}
    return records.map(({context,...record})=>({...record,status:reviews.get(record.id)||'unread'})).reverse();
  };
  return {notify,async request(event,serialized){
    if(!admitted(event))return {ok:false,code:'UNAUTHORIZED'};
    try {
      if(typeof serialized!=='string'||serialized.length>16384)throw Error();
      const r=JSON.parse(serialized);
      if(!r||Array.isArray(r)||Object.getPrototypeOf(r)!==Object.prototype)throw Error();
      const keys=Object.keys(r).sort().join(',');
      if(r.action==='list'&&keys==='action,offset'&&Number.isSafeInteger(r.offset)&&r.offset>=0){
        const all=view();return {ok:true,result:{records:all.slice(r.offset,r.offset+100),total:all.length,next:Math.min(all.length,r.offset+100)}};
      }
      if(r.action==='review'&&keys==='action,ids,status'&&Array.isArray(r.ids)&&r.ids.length>0&&r.ids.length<=100&&new Set(r.ids).size===r.ids.length&&r.ids.every(id=>typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id))&&['read','unread','dismissed','resolved'].includes(r.status)){
        const known=new Set(view().map(x=>x.id));if(r.ids.some(id=>!known.has(id)))throw Error();
        let completed=0;try{for(const id of r.ids){store.review({notificationId:id,status:r.status});completed++;}}finally{changed();}
        return {ok:true,result:{completed}};
      }
      if(r.action==='changelog'&&keys==='action')return {ok:true,result:{entries:changelog,retrievedAt:releases.retrievedAt}};
      if(r.action==='open'&&keys==='action,id,tag'&&typeof r.tag==='string'&&typeof r.id==='string'){
        const entry=changelog.find(x=>x.tag===r.tag);if(!entry)throw Error();
        const url=r.id==='source'?`https://github.com/Ding-Ding-Projects/material-buildroot/commit/${entry.source}`:r.id==='release'?entry.url:links.get(`${r.tag}:${r.id}`);
        if(!url||!url.startsWith('https://'))throw Error();await openExternal(url);return {ok:true,result:{opened:true}};
      }
      return {ok:false,code:'INVALID_REQUEST'};
    } catch{return {ok:false,code:'NOTIFICATION_UNAVAILABLE'};}
  }};
}
module.exports={createNotificationHost};
