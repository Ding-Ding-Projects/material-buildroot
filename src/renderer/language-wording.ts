import {LitElement} from 'lit';
import {ownedCopy,vocabulary} from './owned-copy';
import {wording} from './language-wording-state';
import {toneResources} from './language-wording-resources';
import {neutralCantonese} from './language-wording-neutral';
const updateDisplayTitle=()=>{document.title=wording.productName();};
updateDisplayTitle();wording.subscribe(updateDisplayTitle);
// Every connected component repaints immediately without traversing or rewriting records.
LitElement.addInitializer(host=>{
 let unsubscribe:(()=>void)|undefined,unvocabulary:(()=>void)|undefined;
 host.addController({hostConnected(){unsubscribe=wording.subscribe(()=>host.requestUpdate());unvocabulary=vocabulary.subscribe(()=>host.requestUpdate());},hostDisconnected(){unsubscribe?.();unvocabulary?.();}});
});
/** authored is set only at literal-copy call sites, never for records or interpolated values. */
export function localizedCopy(en:string,zh:string,language:string,authored=false,kind:'ui-copy'|'accessible-name'='ui-copy'){
 const restricted=vocabulary.school()!=='inactive';
 const mode=restricted?'en':language==='en'||language==='zh-HK'?language:'bilingual';
 if(!authored)return mode==='en'?en:mode==='zh-HK'?zh:`${en} · ${zh}`;
 const p=wording.get();
 const baseCantonese=neutralCantonese.get(zh)??zh;
 // Short labels remain concise; sentence tone never replaces the factual sentence.
 const sentence=/[.!?。！？]$/u.test(en.trim())&&/[。！？.!?]$/u.test(zh.trim());
 const style=sentence&&!restricted;
 const english=en+(style?' '+toneResources.en[p.englishHumor-1].trim():'');
 const cantonese=baseCantonese+(style?toneResources['zh-HK'][p.cantoneseHumor-1]:'');
 return ownedCopy(english.trimEnd(),cantonese,mode,kind);
}
