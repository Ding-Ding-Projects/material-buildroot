'use strict';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const revision=/^[0-9a-f]{40}$/;
const plain=value=>value!==null&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value,keys)=>plain(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
/** @type {Record<import('../../shared/broker-core').CoreFailureCode,import('../../shared/api').OperationFailureCode>} */
const failureCodes={INVALID_REQUEST:'REQUEST_SCHEMA',NOT_AUTHORIZED:'UNAUTHORIZED',NOT_IMPLEMENTED:'NOT_IMPLEMENTED',OPERATION_CONFLICT:'IDEMPOTENCY_CONFLICT',STALE_REVISION:'STALE_REVISION',STORAGE_UNAVAILABLE:'UNAVAILABLE'};
/** Strict runtime translation at the internal/public contract seam.
 * @param {import('../../shared/broker-core').CoreReply} reply
 * @param {string} operationId
 * @returns {import('../../shared/broker-core').LanguageOperationReply}
 */
function toOperationReply(reply,operationId){
 if(typeof operationId!=='string'||!uuid.test(operationId))return {ok:false,code:'UNAVAILABLE',message:'The operation result is unavailable.'};
 if(exact(reply,['code','language','revision','eventSequence'])&&reply.code==='OK'&&['en','zh-HK','bilingual'].includes(reply.language)&&typeof reply.revision==='string'&&revision.test(reply.revision)&&Number.isSafeInteger(reply.eventSequence)&&reply.eventSequence>0)return {ok:true,operationId,revision:reply.revision,result:{language:reply.language,eventSequence:reply.eventSequence}};
 if(exact(reply,['code'])&&Object.hasOwn(failureCodes,reply.code))return {ok:false,code:failureCodes[reply.code],message:'The operation could not be completed.'};
 return {ok:false,code:'UNAVAILABLE',message:'The operation result is unavailable.'};
}
/** The stored timestamp is the transaction timestamp, never replay observation time.
 * @param {import('../../shared/broker-core').CoreStoredEvent} event
 * @returns {import('../../shared/api').OperationEvent}
 */
function toOperationEvent(event){
 if(!exact(event,['sequence','operationId','kind','revision','timestamp'])||event.kind!=='settings.languageChanged'||typeof event.operationId!=='string'||!uuid.test(event.operationId)||typeof event.revision!=='string'||!revision.test(event.revision)||!Number.isSafeInteger(event.sequence)||event.sequence<1||typeof event.timestamp!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(event.timestamp)||!Number.isFinite(Date.parse(event.timestamp))||new Date(event.timestamp).toISOString()!==event.timestamp){const error=new Error('The stored operation event is not valid.');error.name='BrokerContractError';throw error;}
 return {version:1,operationId:event.operationId,sequence:event.sequence,timestamp:event.timestamp,state:'succeeded'};
}
module.exports={toOperationReply,toOperationEvent};
