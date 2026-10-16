"use strict";
const path = require('node:path');
const {createExperiencePolicyService} = require('./security/experience-policy.cjs');
const {parse} = require('./security/workspace-contract.cjs');
const {createVault} = require('./security/vault.cjs');
const fields={status:[],enroll:['targetId','policy','credentials','confirmation','duration','disclosureAccepted'],unlock:['targetId','credentials'],relock:['targetId'],leave:['targetId'],remove:['targetId'],challenge:['targetId'],hit:['nonce','cell'],answer:['nonce','answer'],ticket:['targetId','category','description','severity'],advanceTicket:['ticketId'],deleteTickets:['ids'],openRecovery:[]};
function createExperienceIPC({desktop,directory,safeStorage,openFolder,schoolMode=()=>true}) {
  const protectedVault=createVault({safeStorage,directory:path.join(directory,'experience-credentials')}).forOwner('experience-policies',['read','write','remove']);
  let service;
  try { service=createExperiencePolicyService({directory,vault:{write:(_owner,value)=>protectedVault.write(JSON.stringify(value)),read:reference=>JSON.parse(protectedVault.read(reference))},openFolder}); } catch {}
  let queue=Promise.resolve();
  const state=()=>({locks:service.list(),tickets:service.tickets(),recovery:service.recovery(),available:protectedVault.availability().available});
  return {request(event,serialized){
    if(!desktop.admitted(event))return Promise.resolve({ok:false,code:'UNAUTHORIZED'});
    let input;
    try {
      if(typeof serialized!=='string'||Buffer.byteLength(serialized)>16384)throw Error();
      input=parse(serialized);
      if(!input||!Object.hasOwn(fields,input.action)||Object.keys(input).sort().join(',')!==['action',...fields[input.action]].sort().join(','))throw Error();
      if('targetId' in input&&(typeof input.targetId!=='string'||!/^element:[A-Za-z0-9_.:/#-]{1,220}$/.test(input.targetId)))throw Error();
      for(const key of ['nonce','ticketId'])if(key in input&&(typeof input[key]!=='string'||!/^[0-9a-f-]{36}$/.test(input[key])))throw Error();
      if('cell' in input&&(!Number.isInteger(input.cell)||input.cell<0||input.cell>8))throw Error();
      if('credentials' in input)for(const object of [input.credentials,...(input.confirmation?[input.confirmation]:[])]){
        if(!object||Array.isArray(object)||Object.keys(object).some(k=>!['pin','password','totp','code'].includes(k)||typeof object[k]!=='string'||object[k].length>1024))throw Error();
      }
    }catch{return Promise.resolve({ok:false,code:'INVALID_REQUEST'});}
    const run=async()=>{
      if(!desktop.admitted(event))return {ok:false,code:'UNAUTHORIZED'};
      if(!service)return {ok:false,code:'STORAGE_UNAVAILABLE'};
      try{
        let result;
        const {action,targetId}=input;
        if(action==='status')result=state();
        else if(action==='enroll'){
          if(!protectedVault.availability().available)return {ok:false,code:'VAULT_UNAVAILABLE'};
          if(service.isLocked(targetId))return {ok:false,code:'UNLOCK_REQUIRED'};
          const {action,...enrollment}=input;result=await service.enroll(enrollment);
        }else if(action==='unlock')result=await service.unlock(targetId,input.credentials);
        else if(action==='relock'){service.relock(targetId);result=state();}
        else if(action==='leave'){service.leaveSurface(targetId);result=state();}
        else if(action==='remove'){service.requireUnlocked(targetId);service.remove(targetId);result=state();}
        else if(action==='challenge')result=service.challenge(targetId,{schoolMode:schoolMode()!==false});
        else if(action==='hit')result={accepted:service.hit(input.nonce,input.cell)};
        else if(action==='answer')result=service.answer(input.nonce,input.answer);
        else if(action==='ticket')result=service.createTicket(input);
        else if(action==='advanceTicket')result=service.advanceTicket(input.ticketId);
        else if(action==='deleteTickets'){service.deleteTickets(input.ids);result=state();}
        else if(action==='openRecovery')result=await service.openRecoveryFolder();
        if(!desktop.admitted(event))return {ok:false,code:'UNAUTHORIZED'};
        return {ok:true,result};
      }catch{return {ok:false,code:'OPERATION_UNAVAILABLE'};}
    };
    const result=queue.then(run,run);queue=result.then(()=>undefined,()=>undefined);return result;
  }};
}
module.exports={createExperienceIPC};
