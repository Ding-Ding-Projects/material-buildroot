import {createVocabularyController, type VocabularyStatus} from '../shared/personal-vocabulary.mjs';
import {createIndexedDbVocabularyCache} from '../shared/personal-vocabulary-indexeddb.mjs';
export type SchoolState = 'unknown' | 'active' | 'inactive';
type Mode = 'en' | 'zh-HK' | 'bilingual';
let school:SchoolState='unknown', clearing=false;
const listeners=new Set<()=>void>();
const controller=createVocabularyController({privateCache:createIndexedDbVocabularyCache({databaseName:'material-buildroot-private-language-v1'}),schoolMode:()=>school!=='inactive'||clearing});
const notify=()=>listeners.forEach(listener=>listener());
export const vocabulary={
 subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
 school:()=>school,
 status:():VocabularyStatus=>controller.status(),
 async setSchool(next:SchoolState){school=next;notify();if(next==='inactive'){await controller.load();notify();}},
 async import(bytes:Uint8Array){if(school!=='inactive')return;await controller.importBytes(bytes);notify();},
 async clear(){clearing=true;notify();try{await controller.clear();clearing=false;}finally{notify();}},
};
/** Call only with immutable application-authored copy. Never pass records or interpolated values. */
export function ownedCopy(en:string,zh:string,mode:Mode,kind:'ui-copy'|'accessible-name'='ui-copy'){
 return controller.formatOwnedText(mode==='en'?en:mode==='zh-HK'?zh:`${en} · ${zh}`,{kind,mode});
}
