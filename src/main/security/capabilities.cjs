'use strict';
const {randomBytes}=require('node:crypto');
const ACTIONS=new Set(['settings.setLanguage','projects.create','builds.preview','builds.submit','jobs.cancel']);
const identity=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
/** Trusted host API only. These grants are deliberately lost on restart. */
function createCapabilityRegistry({now=()=>Math.floor(performance.now()),maxGrants=4096}={}){
  if(typeof now!=='function'||!Number.isInteger(maxGrants)||maxGrants<1||maxGrants>4096)throw new Error('Invalid capability configuration.');
  const grants=new Map();
  function clock(){const value=now();if(!Number.isSafeInteger(value)||value<0)throw new Error('Clock is unavailable.');return value;}
  return Object.freeze({
    grant({principal,namespace,action,ttlMs=300000}){
      if(!identity(principal)||!identity(namespace)||!ACTIONS.has(action)||!Number.isInteger(ttlMs)||ttlMs<1||ttlMs>3600000)throw new Error('Invalid capability grant.');
      const time=clock();for(const[key,value]of grants)if(value.expires<=time)grants.delete(key);
      if(grants.size>=maxGrants)throw new Error('Capability capacity is unavailable.');
      if(!Number.isSafeInteger(time+ttlMs))throw new Error('Clock is unavailable.');
      const handle=randomBytes(32).toString('base64url');grants.set(handle,{principal,namespace,action,expires:time+ttlMs});return handle;
    },
    authorize(handle,{principal,namespace,action}){
      if(!identity(principal)||!identity(namespace)||!ACTIONS.has(action)||typeof handle!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(handle))return false;
      const value=grants.get(handle);if(!value)return false;
      if(value.expires<=clock()){grants.delete(handle);return false;}
      return value.principal===principal&&value.namespace===namespace&&value.action===action;
    },
    revoke(handle){return grants.delete(handle);},
    clear(){grants.clear();}
  });
}
module.exports={createCapabilityRegistry,identity};
