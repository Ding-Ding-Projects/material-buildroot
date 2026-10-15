'use strict';
const {parseOperationRequest}=require('./operation-request.cjs');
const {toOperationReply,toOperationEvent}=require('./broker-contract.cjs');
function createDesktopSession({webContents,url,capabilities,broker,metadata,storageReady}) {
 const context={principal:'desktop-owner'},namespace='desktop-settings';let handle=null,lastSequence=0;
 const admitted=event=>event?.sender===webContents&&!webContents.isDestroyed()&&event.senderFrame===webContents.mainFrame&&event.senderFrame?.url===url;
 const revoke=()=>{if(handle)capabilities.revoke(handle);handle=null;lastSequence=0;};
 const unavailable=()=>({ok:false,code:'UNAVAILABLE',message:'The desktop operation is unavailable.'});
 return {
  revoke,admitted,
  bootstrap(event){if(!admitted(event))throw new Error('Document is not admitted.');revoke();if(storageReady)handle=capabilities.grant({principal:context.principal,namespace,action:'settings.setLanguage',ttlMs:3600000});const saved=handle?broker.readSettings(context,namespace,handle):null;return {...metadata,language:saved?.code==='OK'?saved.language:'bilingual',revision:saved?.revision||'0'.repeat(40),projectId:namespace,capability:handle||'',storage:saved?.code==='OK'?'ready':'unavailable',origin:saved?.code==='OK'?(saved.revision==='0'.repeat(40)?'default':'saved'):'unavailable'};},
  request(event,serialized){if(!admitted(event)||!handle)return unavailable();let request;try{request=parseOperationRequest(serialized).request;}catch(error){return {ok:false,code:error.code||'REQUEST_SCHEMA',message:'The operation request is not valid.'};}if(request.projectId!==namespace||request.capability!==handle)return {ok:false,code:'UNAUTHORIZED',message:'The operation is not authorized.'};const result=toOperationReply(broker.execute(serialized,context),request.operationId);if(result.ok&&result.result.eventSequence>lastSequence){const sequence=result.result.eventSequence;const rows=broker.readEvents(context,namespace,handle,sequence-1);if(rows.code==='OK'){const row=rows.events.find(item=>item.sequence===sequence&&item.operationId===request.operationId);if(row){try{webContents.send('studio:event',toOperationEvent(row));lastSequence=row.sequence;}catch{/* The durable reply remains authoritative when notification delivery is unavailable. */}}}}return result;},
  windowControl(event,command,window){if(!admitted(event)||!['minimize','maximize-restore','close'].includes(command))return false;if(command==='minimize')window.minimize();else if(command==='maximize-restore'){if(window.isMaximized())window.unmaximize();else window.maximize();}else window.close();return true;}
 };
}
module.exports={createDesktopSession};
