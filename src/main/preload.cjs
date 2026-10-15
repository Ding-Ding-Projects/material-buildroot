'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function validEvent(value){return value!==null&&typeof value==='object'&&Object.keys(value).sort().join(',')==='operationId,sequence,state,timestamp,version'&&value.version===1&&Number.isSafeInteger(value.sequence)&&value.sequence>0&&typeof value.operationId==='string'&&uuid.test(value.operationId)&&typeof value.timestamp==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.timestamp)&&Number.isFinite(Date.parse(value.timestamp))&&new Date(value.timestamp).toISOString()===value.timestamp&&value.state==='succeeded';}
contextBridge.exposeInMainWorld('studio',Object.freeze({
 bootstrap:()=>ipcRenderer.invoke('studio:bootstrap'),
 request:request=>{let serialized;try{serialized=JSON.stringify(request);}catch{return Promise.resolve({ok:false,code:'REQUEST_SCHEMA',message:'The operation request is not valid.'});}if(typeof serialized!=='string'||serialized.length>65536)return Promise.resolve({ok:false,code:'REQUEST_TOO_LARGE',message:'The operation request is not valid.'});return ipcRenderer.invoke('studio:request',serialized);},
 windowControl:command=>['minimize','maximize-restore','close'].includes(command)?ipcRenderer.invoke('studio:window',command):Promise.resolve(false),
 onEvent:listener=>{if(typeof listener!=='function')throw new TypeError('Listener must be a function.');let active=true;const wrapped=(_event,value)=>{if(active&&validEvent(value))listener(Object.freeze({...value}));};ipcRenderer.on('studio:event',wrapped);return()=>{active=false;ipcRenderer.removeListener('studio:event',wrapped);};}
}));
