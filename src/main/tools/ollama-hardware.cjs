"use strict";
const path = require('node:path');
const {spawn} = require('node:child_process');
function observeAdapters({signal}={}) {
 const unknown=reason=>({state:'unknown',source:'windows-cim-video-controller',reason,adapters:[]});
 if(process.platform!=='win32')return Promise.resolve(unknown('ADAPTER_INVENTORY_PLATFORM_UNSUPPORTED'));
 if(signal?.aborted)return Promise.resolve(unknown('CANCELLED'));
 const systemRoot=process.env.SystemRoot;
 if(!systemRoot||!path.win32.isAbsolute(systemRoot))return Promise.resolve(unknown('SYSTEM_DIRECTORY_UNAVAILABLE'));
 // Neither the command nor its script accepts renderer-supplied arguments.
 const executable=path.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 const script=path.join(__dirname,'ollama-hardware.ps1');
 return new Promise(resolve=>{
  let settled=false,bytes=0,output='',child,timer;
  const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);resolve(result);};
  const stop=reason=>{child?.kill();finish(unknown(reason));};
  const cancel=()=>stop('CANCELLED');
  try{child=spawn(executable,['-NoLogo','-NoProfile','-NonInteractive','-File',script],{windowsHide:true,shell:false,stdio:['ignore','pipe','ignore']});}catch{return finish(unknown('ADAPTER_INVENTORY_UNAVAILABLE'));}
  timer=setTimeout(()=>stop('ADAPTER_INVENTORY_TIMEOUT'),4000);
  signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)cancel();
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>32768)return stop('ADAPTER_INVENTORY_LIMIT');output+=chunk.toString('utf8');});
  child.on('error',()=>finish(unknown('ADAPTER_INVENTORY_UNAVAILABLE')));
  child.on('close',code=>{
   if(settled)return;
   if(code!==0)return finish(unknown('ADAPTER_INVENTORY_UNAVAILABLE'));
   try{
    const raw=JSON.parse(output.replace(/^\uFEFF/,''));
    if(!Array.isArray(raw.adapters)||raw.adapters.length>16)throw Error();
    const text=value=>{if(typeof value!=='string'||value.length>256||/[\x00-\x1f]/.test(value))throw Error();return value||null;};
    const adapters=raw.adapters.map(a=>{
     const ram=a.reportedAdapterRamBytes;
     if(ram!==null&&(!Number.isInteger(ram)||ram<0||ram>4294967295))throw Error();
     return {name:text(a.name),vendor:text(a.vendor),driverVersion:text(a.driverVersion),reportedAdapterRamBytes:ram,usableVramBytes:null,backendSupported:null};
    });
    finish({state:'observed',source:'windows-cim-video-controller',observedAt:new Date().toISOString(),adapters,reason:'ADAPTER_RAM_UINT32_NOT_USABLE_VRAM'});
   }catch{finish(unknown('ADAPTER_INVENTORY_INVALID'));}
  });
 });
}
module.exports={observeAdapters};
