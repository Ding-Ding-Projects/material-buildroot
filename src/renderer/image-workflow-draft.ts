/** Only portable choices belong here. Host state and consent are always revalidated. */
export type ImageWorkflowDraft = {
 version:2; revision:number; step:number; mode:'easy'|'advanced'; name:string;
 target:'bios-iso'; preset:'keep'|'minimal'|'desktop'|'server'|'appliance';
 desktop:'none'|'weston'|'cage'|'xorg'; ssh:boolean; boardId:string|null; jobId:string|null; creationId?:string;
};
export const IMAGE_DRAFT_LIMIT=2048;
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(value);
export function validImageName(value:unknown):value is string {
 return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)&&!/[. ]$/.test(value)&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
}
export function newImageDraft():ImageWorkflowDraft {
 return {version:2,revision:0,step:0,mode:'easy',name:'linux-bios-image',target:'bios-iso',preset:'keep',desktop:'none',ssh:false,boardId:null,jobId:null};
}
export function readImageDraft(raw:string|null):ImageWorkflowDraft|null {
 if(!raw||raw.length>IMAGE_DRAFT_LIMIT)return null;
 if(new TextEncoder().encode(raw).byteLength>IMAGE_DRAFT_LIMIT)return null;
 try {
  const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return null;
  if(value.version===1&&Number.isInteger(value.step)&&value.step>=0&&value.step<=2){
   return {...newImageDraft(),step:value.step===0?1:4,mode:value.mode==='advanced'?'advanced':'easy',jobId:id(value.jobId)?value.jobId:null};
  }
  if(value.version!==2||!Number.isSafeInteger(value.revision)||value.revision<0||!Number.isInteger(value.step)||value.step<0||value.step>4||!['easy','advanced'].includes(value.mode)||!validImageName(value.name)||value.target!=='bios-iso'||!['keep','minimal','desktop','server','appliance'].includes(value.preset)||!['none','weston','cage','xorg'].includes(value.desktop)||typeof value.ssh!=='boolean'||!(value.boardId===null||id(value.boardId))||!(value.jobId===null||id(value.jobId)))return null;
  // Construct a fresh allowlisted object even if the untrusted record has extra fields.
  if(value.creationId!==undefined&&!id(value.creationId))return null;
  return {version:2,revision:value.revision,step:value.step,mode:value.mode,name:value.name,target:'bios-iso',preset:value.preset,desktop:value.desktop,ssh:value.ssh,boardId:value.boardId,jobId:value.jobId,...(value.creationId?{creationId:value.creationId}:{})};
 }catch{return null;}
}
export function writeImageDraft(draft:ImageWorkflowDraft):string|null {
 const parsed=readImageDraft(JSON.stringify(draft));return parsed?JSON.stringify(parsed):null;
}
export function imageExportBasename(name:string){return validImageName(name)?(name.toLowerCase().endsWith('.iso')?name:name+'.iso'):null;}

export type ImageCreationIntent={version:1;id:string;revision:number;stage:'purpose'|'source'|'workspace';name:string;mode:'easy'|'advanced';purpose:ImageWorkflowDraft['preset'];target:'bios-iso';workspaceId?:string};
export function validateImageIntent(value:unknown):ImageCreationIntent|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(v.version!==1||!id(v.id)||!Number.isSafeInteger(v.revision)||(v.revision as number)<0||typeof v.stage!=='string'||!['purpose','source','workspace'].includes(v.stage)||!validImageName(v.name)||typeof v.mode!=='string'||!['easy','advanced'].includes(v.mode)||typeof v.purpose!=='string'||!['keep','minimal','desktop','server','appliance'].includes(v.purpose)||v.target!=='bios-iso'||(v.workspaceId!==undefined&&!id(v.workspaceId)))return null;
 return {version:1,id:v.id,revision:v.revision as number,stage:v.stage as ImageCreationIntent['stage'],name:v.name,mode:v.mode as ImageCreationIntent['mode'],purpose:v.purpose as ImageCreationIntent['purpose'],target:'bios-iso',...(v.workspaceId?{workspaceId:v.workspaceId as string}:{})};
}
export function imageDraftLock(workspaceId:string){return 'material-buildroot.image-draft.'+workspaceId;}
export type ImageIntentTransfer={status:'applied'|'existing'|'conflict'|'invalid'|'unavailable';draft?:ImageWorkflowDraft};
/** All records are local choices, never grants or evidence of configuration. */
export async function transferImageIntent(workspaceId:string,input:unknown,choice:'review'|'resume'|'replace'='review',stillCurrent:()=>boolean=()=>true):Promise<ImageIntentTransfer>{
 const intent=validateImageIntent(input);
 if(!intent||!id(workspaceId)||intent.workspaceId!==workspaceId)return {status:'invalid'};
 if(!navigator.locks)return {status:'unavailable'};
 try{return await navigator.locks.request(imageDraftLock(workspaceId),()=>{
  if(!stillCurrent())return {status:'unavailable'} as ImageIntentTransfer;
  const key='iso-workflow-'+workspaceId,raw=localStorage.getItem(key),existing=readImageDraft(raw);
  if(raw!==null&&!existing)return {status:'invalid'} as ImageIntentTransfer;
  if(existing&&(existing.creationId===intent.id||choice==='resume'))return {status:'existing',draft:existing} as ImageIntentTransfer;
  if(existing&&choice!=='replace')return {status:'conflict',draft:existing} as ImageIntentTransfer;
  const next:ImageWorkflowDraft={...newImageDraft(),revision:(existing?.revision??0)+1,creationId:intent.id,name:intent.name,mode:intent.mode,preset:intent.purpose,step:existing?.jobId?4:1,jobId:existing?.jobId??null};
  const encoded=writeImageDraft(next);if(!encoded)return {status:'invalid'} as ImageIntentTransfer;
  if(existing){
   const archiveKey=key+'-recovery',previous=localStorage.getItem(archiveKey);
   if(previous&&previous.length>32*1024)return {status:'unavailable'} as ImageIntentTransfer;
   const history=previous?JSON.parse(previous):[];
   if(!Array.isArray(history)||history.length>=10||history.some(item=>!readImageDraft(JSON.stringify(item))))return {status:'unavailable'} as ImageIntentTransfer;
   localStorage.setItem(archiveKey,JSON.stringify([...history.map(item=>readImageDraft(JSON.stringify(item))),existing]));
  }
  // Archive first; a failed replacement leaves both the old draft and its recovery copy.
  if(localStorage.getItem(key)!==raw)return {status:'conflict'} as ImageIntentTransfer;
  localStorage.setItem(key,encoded);return {status:'applied',draft:next} as ImageIntentTransfer;
 });}catch{return {status:'unavailable'};}
}
