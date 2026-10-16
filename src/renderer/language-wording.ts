import {LitElement} from 'lit';
import {vocabulary} from './owned-copy';
import {wording} from './language-wording-state';
import {toneResources} from './language-wording-resources';
const updateDisplayTitle=()=>{document.title=wording.productName();};
updateDisplayTitle();wording.subscribe(updateDisplayTitle);
// Every connected component repaints immediately without traversing or rewriting records.
LitElement.addInitializer(host=>{
 let unsubscribe:(()=>void)|undefined;
 host.addController({hostConnected(){unsubscribe=wording.subscribe(()=>host.requestUpdate());},hostDisconnected(){unsubscribe?.();}});
});
export function localizedCopy(en:string,zh:string,language:string){
 const mode=vocabulary.school()!=='inactive'?'en':language==='en'||language==='zh-HK'?language:'bilingual';
 const p=wording.get();
 // Sentence punctuation is an authored-copy boundary. Short labels remain concise.
 const sentence=/[.!?。！？]$/u.test(en.trim())&&/[。！？.!?]$/u.test(zh.trim());
 const style=sentence&&vocabulary.school()==='inactive';
 const english=en+(style?' '+toneResources.en[p.englishHumor-1].trim():'');
 const cantonese=zh+(style?toneResources['zh-HK'][p.cantoneseHumor-1]:'');
 // Generic localization callers may contain external values. Vocabulary remains
 // confined to the separately declared immutable ownedCopy boundary.
 return mode==='en'?english.trimEnd():mode==='zh-HK'?cantonese:`${english.trimEnd()} · ${cantonese}`;
}
