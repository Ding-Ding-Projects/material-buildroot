"use strict";
const fs = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const fail=code=>{throw Object.assign(new Error(code),{code});};
async function candidates(){
  if(process.platform!=='win32') return [];
  const entries = [
    ['notepad','Notepad',process.env.SystemRoot && path.join(process.env.SystemRoot,'System32','notepad.exe')],
    ['vscode-user','Visual Studio Code (user)',process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA,'Programs','Microsoft VS Code','Code.exe')],
    ['vscode-machine','Visual Studio Code',process.env.ProgramFiles && path.join(process.env.ProgramFiles,'Microsoft VS Code','Code.exe')],
    ['notepad-plus','Notepad++',process.env.ProgramFiles && path.join(process.env.ProgramFiles,'Notepad++','notepad++.exe')],
  ];
  const found=[];
  for(const [id,label,executable] of entries){if(!executable)continue;const stat=await fs.lstat(executable).catch(()=>null);if(stat?.isFile()&&!stat.isSymbolicLink()) found.push({id,label,executable});}
  return found;
}
async function discoverEditors(){return (await candidates()).map(({id,label})=>({id,label}));}
async function openEditor(id,file){
  const editor=(await candidates()).find(e=>e.id===id);if(!editor)fail('EDITOR_NOT_AVAILABLE');
  await new Promise((resolve,reject)=>{
    const child=spawn(editor.executable,[file],{shell:false,detached:true,stdio:'ignore',windowsHide:false});
    child.once('error',()=>reject(Object.assign(new Error('EDITOR_LAUNCH_FAILED'),{code:'EDITOR_LAUNCH_FAILED'})));
    child.once('spawn',()=>{child.unref();resolve();});
  });
  return {launched:true,editorId:id};
}
module.exports={discoverEditors,openEditor};
