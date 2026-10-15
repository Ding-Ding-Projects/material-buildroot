'use strict';
const {createHash}=require('node:crypto');
const {parseOperationRequest}=require('./security/operation-request.cjs');
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';}
/** The caller context, registry and store are trusted host objects, not request JSON.
 * @param {{capabilities:import('../shared/broker-core').CapabilityAuthority,store:import('../shared/broker-core').CoreSettingsStore}} configuration
 * @returns {import('../shared/broker-core').BrokerCore}
 */
function createBroker({capabilities,store}){
  const authorized=(context,namespace,handle,action)=>capabilities.authorize(handle,{principal:context?.principal,namespace,action});
  return Object.freeze({
    execute(serialized,context){
      let request;try{request=parseOperationRequest(serialized).request;}catch{return {code:'INVALID_REQUEST'};}
      try{
        if(!authorized(context,request.projectId,request.capability,request.action))return {code:'NOT_AUTHORIZED'};
        if(request.action!=='settings.setLanguage')return {code:'NOT_IMPLEMENTED'};
        const {capability,...semantic}=request;
        const digest=createHash('sha256').update(canonical(semantic)).digest('hex');
        return store.setLanguage({principal:context.principal,namespace:request.projectId,operationId:request.operationId,digest,expectedRevision:request.expectedRevision,language:request.arguments.language,authorize:()=>authorized(context,request.projectId,request.capability,request.action)});
      }catch{return {code:'STORAGE_UNAVAILABLE'};}
    },
    readSettings(context,namespace,handle){try{if(!authorized(context,namespace,handle,'settings.setLanguage'))return {code:'NOT_AUTHORIZED'};return {code:'OK',...store.read(context.principal,namespace)};}catch{return {code:'STORAGE_UNAVAILABLE'};}},
    readEvents(context,namespace,handle,afterSequence=0){try{if(!authorized(context,namespace,handle,'settings.setLanguage'))return {code:'NOT_AUTHORIZED'};return {code:'OK',...store.events(context.principal,namespace,afterSequence)};}catch{return {code:'STORAGE_UNAVAILABLE'};}}
  });
}
module.exports={createBroker};
