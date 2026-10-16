'use strict';
/** Process-local navigation inventory. Renderer labels never confer project authority. */
function createWorkspaceTabRegistry(){
  const owners=new Map();
  const validText=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
  const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  const alive=owner=>!owner.navigating&&!owner.window.isDestroyed()&&!owner.window.webContents.isDestroyed()&&owner.window.webContents.mainFrame.url===owner.url;
  function notify(){for(const owner of owners.values())if(alive(owner))try{owner.window.webContents.send('studio:workspace-tabs:changed');}catch{/* Closed windows are omitted on the next request. */}}
  function register(window,desktop,url){
    const id=`window-${window.id}`,owner={id,window,desktop,url,tabs:[],navigating:true};owners.set(id,owner);
    const clear=()=>{owner.tabs=[];notify();};
    window.webContents.on('did-start-navigation',(_e,_url,_inPlace,isMainFrame)=>{if(isMainFrame){owner.navigating=true;clear();}});
    window.webContents.on('did-finish-load',()=>{owner.navigating=false;notify();});
    window.webContents.on('render-process-gone',()=>{owner.navigating=true;clear();});
    window.once('closed',()=>{owners.delete(id);notify();});
    window.webContents.once('destroyed',()=>{owners.delete(id);notify();});
    return id;
  }
  function request(event,serialized){
    const owner=[...owners.values()].find(item=>alive(item)&&item.desktop.admitted(event));
    if(!owner)return {ok:false,code:'UNAUTHORIZED'};
    let value;try{if(typeof serialized!=='string'||Buffer.byteLength(serialized)>262144)throw Error();value=JSON.parse(serialized);}catch{return {ok:false,code:'INVALID_REQUEST'};}
    if(value?.action==='publish'){
      if(!exact(value,['action','tabs'])||!Array.isArray(value.tabs)||value.tabs.length>200)return {ok:false,code:'INVALID_REQUEST'};
      const ids=new Set();const tabs=[];
      for(const tab of value.tabs){
        if(!exact(tab,['id','label','group','pinned','workspace'])||!validText(tab.id,256)||!validText(tab.label,300)||typeof tab.group!=='string'||tab.group.length>120||/[\x00-\x1f\x7f]/.test(tab.group)||typeof tab.workspace!=='string'||tab.workspace.length>256||/[\x00-\x1f\x7f]/.test(tab.workspace)||typeof tab.pinned!=='boolean'||ids.has(tab.id))return {ok:false,code:'INVALID_REQUEST'};
        ids.add(tab.id);tabs.push({id:tab.id,label:tab.label,group:tab.group,pinned:tab.pinned,workspace:tab.workspace});
      }
      owner.tabs=tabs;notify();return {ok:true,windowId:owner.id};
    }
    if(value?.action==='list'&&exact(value,['action']))return {ok:true,currentWindowId:owner.id,windows:[...owners.values()].filter(alive).map(item=>({id:item.id,tabs:item.tabs}))};
    if(value?.action==='activate'&&exact(value,['action','windowId','tabId'])&&validText(value.windowId,64)&&validText(value.tabId,256)){
      const target=owners.get(value.windowId);if(!target||!alive(target)||!target.tabs.some(tab=>tab.id===value.tabId))return {ok:false,code:'NOT_FOUND'};
      try{target.window.webContents.send('studio:workspace-tabs:activate',{tabId:value.tabId});if(target.window.isMinimized())target.window.restore();target.window.focus();return {ok:true,requested:true};}catch{return {ok:false,code:'UNAVAILABLE'};}
    }
    return {ok:false,code:'INVALID_REQUEST'};
  }
  return {register,request};
}
module.exports={createWorkspaceTabRegistry};
