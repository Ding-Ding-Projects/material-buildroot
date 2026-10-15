'use strict';
const fs=require('node:fs');const os=require('node:os');const net=require('node:net');const {createCompanionServer}=require('./companion-server.cjs');
const READ_SCOPES=['workspace:read','projects:read','jobs:read'];
const ALL_SCOPES=[...READ_SCOPES,'jobs:cancel','builds:submit'];
function fail(code){const error=new Error('Companion configuration could not be completed.');error.code=code;throw error;}
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail('INVALID_REQUEST');for(const key of Reflect.ownKeys(value))if(!keys.includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))fail('INVALID_REQUEST');}
function privateAddress(value){if(net.isIP(value)!==4)return value==='::1';const [a,b]=value.split('.').map(Number);return a===127||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);}
/** Invoke only from authorized desktop IPC. Browser callers never configure listeners or TLS. */
function createCompanionController({dialog,parentWindow,onAction,networkInterfaces=os.networkInterfaces,allowedScopes=READ_SCOPES,now=Date.now}){
 if(!dialog||typeof dialog.showOpenDialog!=='function'||typeof dialog.showMessageBox!=='function'||typeof onAction!=='function'||typeof networkInterfaces!=='function'||!Array.isArray(allowedScopes)||allowedScopes.some(scope=>!ALL_SCOPES.includes(scope))||new Set(allowedScopes).size!==allowedScopes.length)throw new TypeError('Trusted native companion configuration is required.');
 const permitted=[...allowedScopes];let server=null,configuring=false;
 function bindings(){const values=new Set(['127.0.0.1','::1']);for(const list of Object.values(networkInterfaces()))for(const item of list||[])if(item&&typeof item.address==='string'&&privateAddress(item.address))values.add(item.address);return [...values];}
 function status(){return {configured:server!==null,allowedScopes:[...permitted],availableBindings:bindings(),...server?server.state():{enabled:false,binding:null,sessions:[],operations:[]}};}
 async function pick(title){const result=await dialog.showOpenDialog(parentWindow,{title,properties:['openFile','dontAddToRecent']});if(result.canceled||!Array.isArray(result.filePaths)||result.filePaths.length!==1)fail('CANCELLED');const selected=result.filePaths[0];if(typeof selected!=='string'||fs.realpathSync.native(selected)!==selected)fail('UNSAFE_TLS_FILE');const info=fs.lstatSync(selected);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size<1||info.size>65536)fail('INVALID_TLS_FILE');const descriptor=fs.openSync(selected,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));try{const opened=fs.fstatSync(descriptor);if(opened.dev!==info.dev||opened.ino!==info.ino||opened.size!==info.size)fail('TLS_FILE_CHANGED');const bytes=fs.readFileSync(descriptor);if(bytes.length!==info.size)fail('TLS_FILE_CHANGED');return bytes;}finally{fs.closeSync(descriptor);}}
 async function request(action,args={}){try{switch(action){
  case 'companion.status':exact(args,[]);return status();
  case 'companion.configure':{exact(args,[]);if(configuring)fail('CONFIGURATION_BUSY');if(server?.state().enabled)fail('STOP_REQUIRED');configuring=true;try{const cert=await pick('Select the companion HTTPS certificate');const key=await pick('Select the matching companion HTTPS private key');const {createSecureContext}=require('node:tls');createSecureContext({cert,key,minVersion:'TLSv1.2'});const candidate=createCompanionServer({tls:{cert,key},now,onAction,confirmPairing:async review=>{const result=await dialog.showMessageBox(parentWindow,{type:'warning',title:'Approve browser companion',message:`Allow this browser origin to connect?\n${review.origin}`,detail:`Approved permissions:\n${review.scopes.join('\n')}\n\nOnly approve a browser you intended to pair. Existing project authorization is still required for operations.`,buttons:['Cancel','Approve pairing'],defaultId:0,cancelId:0,noLink:true});return result.response===1;}});if(server)await server.stop();server=candidate;return status();}finally{configuring=false;}}
  case 'companion.start':exact(args,['host','port']);if(configuring)fail('CONFIGURATION_BUSY');if(!server)fail('TLS_NOT_CONFIGURED');if(!bindings().includes(args.host))fail('BINDING_NOT_LOCAL');await server.start(args);return status();
  case 'companion.stop':exact(args,[]);if(server)await server.stop();return status();
  case 'companion.createPairing':exact(args,['origin','scopes']);if(!server)fail('TLS_NOT_CONFIGURED');if(!Array.isArray(args.scopes)||args.scopes.some(scope=>!permitted.includes(scope)))fail('SCOPE_NOT_ENABLED');return server.createPairing(args);
  case 'companion.revoke':exact(args,['sessionId']);if(!server)fail('TLS_NOT_CONFIGURED');return {revoked:server.revoke(args.sessionId)};
  default:fail('INVALID_ACTION');
 }}catch(error){if(error.message==='Companion configuration could not be completed.'||error.message==='Companion request could not be completed.')throw error;fail('CONFIGURATION_UNAVAILABLE');}}
 return Object.freeze({request});
}
module.exports={createCompanionController};
