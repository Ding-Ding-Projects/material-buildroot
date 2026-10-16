"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const {randomUUID} = require("node:crypto");
const {fail} = require("./runtime.cjs");
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function createConversations(queueDirectory){
 const directory=queueDirectory&&path.isAbsolute(queueDirectory)?path.join(path.dirname(queueDirectory),"ollama-conversations"):null;
 let serial=Promise.resolve();
 async function prepare(){
  if(!directory)fail("CONVERSATION_STORAGE_UNAVAILABLE");
  let cursor=directory;
  while(true){try{const stat=await fs.lstat(cursor);if(!stat.isDirectory()||stat.isSymbolicLink())fail("CONVERSATION_STORAGE_UNAVAILABLE");}catch(error){if(error.code!=="ENOENT")throw error;}const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  const root=await fs.lstat(directory);if(!root.isDirectory()||root.isSymbolicLink())fail("CONVERSATION_STORAGE_UNAVAILABLE");
 }
 function file(id){if(!idPattern.test(id))fail("INVALID_REQUEST");return path.join(directory,id+".json");}
 async function read(id){
  const target=file(id),stat=await fs.lstat(target);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>1100000)fail("CONVERSATION_RECORD_INVALID");
  const handle=await fs.open(target,"r");
  try{
   const opened=await handle.stat();
   if(!opened.isFile()||opened.ino!==stat.ino||opened.dev!==stat.dev||opened.size!==stat.size)fail("CONVERSATION_RECORD_CHANGED");
   const bytes=Buffer.alloc(stat.size);let offset=0;
   while(offset<bytes.length){const r=await handle.read(bytes,offset,bytes.length-offset,offset);if(!r.bytesRead)fail("CONVERSATION_RECORD_CHANGED");offset+=r.bytesRead;}
   const after=await handle.stat();if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)fail("CONVERSATION_RECORD_CHANGED");
   const value=JSON.parse(bytes.toString("utf8"));
   if(value.id!==id||value.schemaVersion!==1||!Number.isFinite(Date.parse(value.createdAt)))fail("CONVERSATION_RECORD_INVALID");
   require("./request-contract.cjs").admit({action:"ollama.conversations.save",title:value.title,model:value.model,messages:value.messages});
   return value;
  }finally{await handle.close();}
 }
 async function execute(request){
  await prepare();
  if(request.action==="ollama.conversations.load")return {conversation:await read(request.id)};
  if(request.action==="ollama.conversations.delete"){await read(request.id);await fs.unlink(file(request.id));return {deleted:true};}
  const entries=(await fs.readdir(directory)).filter(name=>idPattern.test(name.replace(/\.json$/,""))&&name.endsWith(".json"));
  if(entries.length>100)fail("CONVERSATION_STORAGE_LIMIT");
  if(request.action==="ollama.conversations.list"){
   const items=[];for(const name of entries){const r=await read(name.slice(0,-5));items.push({id:r.id,title:r.title,model:r.model,createdAt:r.createdAt,messages:r.messages.length});}
   return {items:items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
  }
  if(entries.length>=100)fail("CONVERSATION_STORAGE_LIMIT");
  const id=randomUUID(),record={schemaVersion:1,id,title:request.title,model:request.model,messages:request.messages,createdAt:new Date().toISOString()};
  const bytes=JSON.stringify(record);if(Buffer.byteLength(bytes)>1100000)fail("CONVERSATION_STORAGE_LIMIT");
  const temporary=path.join(directory,"pending-"+id);
  try{await fs.writeFile(temporary,bytes,{flag:"wx",mode:0o600});await fs.rename(temporary,file(id));}finally{await fs.rm(temporary,{force:true});}
  return {id,saved:true};
 }
 return {dispatch(request){const next=serial.then(()=>execute(request));serial=next.catch(()=>{});return next;},dispose(){return serial;}};
}
module.exports={createConversations};

