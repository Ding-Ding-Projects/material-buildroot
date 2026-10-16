import {createVocabularyController, VOCABULARY_LIMITS, type VocabularyStatus} from '../shared/personal-vocabulary.mjs';
import {createIndexedDbVocabularyCache} from '../shared/personal-vocabulary-indexeddb.mjs';
export type SchoolState = 'unknown' | 'active' | 'inactive';
type Mode = 'en' | 'zh-HK' | 'bilingual';
export type VocabularyOutcome = {state:'applied';headline:string|null}|{state:'invalid'|'unavailable'|'suppressed'};
let school:SchoolState='unknown', clearing=false, generation=0;
let queue:Promise<unknown>=Promise.resolve();
const listeners=new Set<()=>void>();
// This private in-process channel is not a DOM event, history record or diagnostic.
const outcomes=new Set<(outcome:VocabularyOutcome)=>void>();
const controller=createVocabularyController({privateCache:createIndexedDbVocabularyCache({databaseName:'material-buildroot-private-language-v1'}),schoolMode:()=>school!=='inactive'||clearing});
const notify=()=>listeners.forEach(listener=>listener());
const emit=(outcome:VocabularyOutcome)=>outcomes.forEach(listener=>listener(outcome));
const allowed=()=>school==='inactive'&&!clearing;
const serialize=<T>(task:()=>Promise<T>):Promise<T>=>{const result=queue.then(task);queue=result.catch(()=>{});return result;};
async function applyBytes(bytes:Uint8Array,version:number):Promise<VocabularyOutcome>{
 if(!allowed()||version!==generation)return {state:'suppressed'};
 const result=await controller.importBytes(bytes);
 notify();
 if(!allowed()||version!==generation)return {state:'suppressed'};
 // Invalid input returns a status rather than throwing. An older valid selection
 // can remain active, so active alone is never evidence that this import worked.
 const outcome:VocabularyOutcome=result.state==='loaded'&&result.active
  ?{state:'applied',headline:controller.appliedHeadline()}:{state:'invalid'};
 emit(outcome);return outcome;
}
export const vocabulary={
 subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
 subscribeOutcome(listener:(outcome:VocabularyOutcome)=>void){outcomes.add(listener);return ()=>{outcomes.delete(listener);};},
 school:()=>school,
 available:allowed,
 status:():VocabularyStatus=>controller.status(),
 setSchool(next:SchoolState){
  const version=++generation;
  // Suppression is synchronous even while an already-started cache transaction settles.
  school=next;notify();
  return serialize(async()=>{if(next==='inactive'&&version===generation){await controller.load();notify();}});
 },
 import(bytes:Uint8Array){
  const version=generation;
  const snapshot=bytes.byteLength>VOCABULARY_LIMITS.bytes?new Uint8Array(VOCABULARY_LIMITS.bytes+1):new Uint8Array(bytes);
  return serialize(()=>applyBytes(snapshot,version));
 },
 importFile(file:File|null):Promise<VocabularyOutcome>{
  const version=generation;
  if(!allowed())return Promise.resolve({state:'suppressed'});
  // File objects and their metadata are used only in this closure and never cached.
  return serialize(async():Promise<VocabularyOutcome>=>{
   if(!allowed()||version!==generation)return {state:'suppressed'};
   if(!file||!file.name.toLowerCase().endsWith('.json')||file.size>VOCABULARY_LIMITS.bytes){
    return applyBytes(new Uint8Array(VOCABULARY_LIMITS.bytes+1),version);
   }
   try{
    const bytes=new Uint8Array(await file.arrayBuffer());
    return await applyBytes(bytes,version);
   }catch{
    if(!allowed()||version!==generation)return {state:'suppressed'};
    const outcome:VocabularyOutcome={state:'unavailable'};emit(outcome);return outcome;
   }
  });
 },
 clear(){
  clearing=true;++generation;notify();
  return serialize(async()=>{try{await controller.clear();clearing=false;}finally{notify();}});
 },
};
/** Call only with immutable application-authored copy. Never pass records or interpolated values. */
export function ownedCopy(en:string,zh:string,mode:Mode,kind:'ui-copy'|'accessible-name'='ui-copy'){
 return controller.formatOwnedText(mode==='en'?en:mode==='zh-HK'?zh:`${en} · ${zh}`,{kind,mode});
}
