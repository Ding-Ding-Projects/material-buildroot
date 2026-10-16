'use strict';
const path=require('node:path');
const {execFile}=require('node:child_process');
const families=['Roboto','Arial','Verdana','Georgia','monospace','sans-serif','serif'];
function createAppearanceFonts(){let pending;
 const read=()=>pending??=new Promise(resolve=>{
  if(process.platform!=='win32'){resolve({ok:false,code:'PLATFORM_UNAVAILABLE'});return;}
  const script='[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Drawing; $collection = New-Object System.Drawing.Text.InstalledFontCollection; try { @($collection.Families | ForEach-Object { $_.Name } | Sort-Object -Unique) | ConvertTo-Json -Compress } finally { $collection.Dispose() }';
  execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{shell:false,windowsHide:true,timeout:15000,maxBuffer:1024*1024,encoding:'utf8'},(error,stdout)=>{
   if(error){pending=undefined;resolve({ok:false,code:'FONT_ENUMERATION_UNAVAILABLE'});return;}
   try{const result=JSON.parse(stdout);if(!Array.isArray(result)||result.length>4096)throw Error('bounds');const fonts=[...new Set([...families,...result.filter(v=>typeof v==='string'&&/^[\p{L}\p{N} ._-]{1,128}$/u.test(v))])];resolve({ok:true,fonts,variableAxesAvailable:false});}catch{pending=undefined;resolve({ok:false,code:'FONT_ENUMERATION_UNAVAILABLE'});}
  });
 });return {read};
}
module.exports={createAppearanceFonts};
