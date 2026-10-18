import {validateImageIntent,type ImageCreationIntent} from './image-workflow-draft';
export const creationKey='material-buildroot.image-creation.v1';
export function readCreationRecord():{draft:ImageCreationIntent|null;raw:string|null;available:boolean}{
 try{const raw=localStorage.getItem(creationKey);if(raw===null)return {draft:null,raw,available:true};
  if(raw.length>2048||new TextEncoder().encode(raw).byteLength>2048)return {draft:null,raw,available:false};
  const draft=validateImageIntent(JSON.parse(raw));return {draft,raw,available:!!draft};
 }catch{return {draft:null,raw:null,available:false};}
}
export async function saveCreationRecord(input:unknown,expected:string|null):Promise<ReturnType<typeof readCreationRecord>>{
 const draft=validateImageIntent(input);if(!draft||!navigator.locks)return {...readCreationRecord(),available:false};
 try{return await navigator.locks.request(creationKey,()=>{
  if(localStorage.getItem(creationKey)!==expected)return {...readCreationRecord(),available:false};
  const raw=JSON.stringify(draft);localStorage.setItem(creationKey,raw);return {draft,raw,available:true};
 });}catch{return {...readCreationRecord(),available:false};}
}
export function newCreationIntent():ImageCreationIntent{return {version:1,id:crypto.randomUUID(),revision:0,stage:'purpose',name:'linux-bios-image',mode:'easy',purpose:'keep',target:'bios-iso'};}
export async function beginAnotherCreation(expected:string|null):Promise<ReturnType<typeof readCreationRecord>>{
 if(!navigator.locks)return {...readCreationRecord(),available:false};
 try{return await navigator.locks.request(creationKey,()=>{
  const current=readCreationRecord();if(!current.available||current.raw!==expected)return {...current,available:false};
  if(current.draft){
   const key=creationKey+'.recovery',raw=localStorage.getItem(key);
   if(raw&&raw.length>32*1024)return {...current,available:false};
   const history=raw?JSON.parse(raw):[];
   if(!Array.isArray(history)||history.length>=10||history.some(item=>!validateImageIntent(item)))return {...current,available:false};
   localStorage.setItem(key,JSON.stringify([...history.map(validateImageIntent),current.draft]));
  }
  const draft=newCreationIntent(),raw=JSON.stringify(draft);localStorage.setItem(creationKey,raw);return {draft,raw,available:true};
 });}catch{return {...readCreationRecord(),available:false};}
}
