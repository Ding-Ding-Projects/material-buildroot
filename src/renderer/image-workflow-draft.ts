/** Only portable choices belong here. Host state and consent are always revalidated. */
export type ImageWorkflowDraft = {
 version:2; revision:number; step:number; mode:'easy'|'advanced'; name:string;
 target:'bios-iso'; preset:'keep'|'minimal'|'desktop'|'server'|'appliance';
 desktop:'none'|'weston'|'cage'|'xorg'; ssh:boolean; boardId:string|null; jobId:string|null;
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
  return {version:2,revision:value.revision,step:value.step,mode:value.mode,name:value.name,target:'bios-iso',preset:value.preset,desktop:value.desktop,ssh:value.ssh,boardId:value.boardId,jobId:value.jobId};
 }catch{return null;}
}
export function writeImageDraft(draft:ImageWorkflowDraft):string|null {
 const parsed=readImageDraft(JSON.stringify(draft));return parsed?JSON.stringify(parsed):null;
}
export function imageExportBasename(name:string){return validImageName(name)?(name.toLowerCase().endsWith('.iso')?name:name+'.iso'):null;}
