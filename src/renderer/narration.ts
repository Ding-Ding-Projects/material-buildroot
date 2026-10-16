export interface NarrationPreferences { enabled:boolean; language:'en'|'zh-HK'|'both'; englishVoice:string; cantoneseVoice:string; rate:number; pitch:number }
export const narrationDefaults=():NarrationPreferences=>({enabled:false,language:'both',englishVoice:'',cantoneseVoice:'',rate:1,pitch:1});
export class LocalNarrator {
 private synth=typeof speechSynthesis==='undefined'?null:speechSynthesis;
 private queue:Array<{en:string;zh:string;category:string}>=[];
 private generation=0;private speaking=false;private last=new Map<string,number>();
 private holdUntil=0;private holdTimer?:ReturnType<typeof setTimeout>;
 private userPaused=false;
 preferences=narrationDefaults(); voices:SpeechSynthesisVoice[]=[];
 private refresh=()=>{this.voices=this.synth?.getVoices()??[];this.changed();};
 constructor(private changed:()=>void){this.refresh();this.synth?.addEventListener('voiceschanged',this.refresh);}
 /** Yield without reading or speaking the live region's potentially sensitive content. */
 hold(milliseconds=3000){this.synth?.pause();this.holdUntil=Date.now()+milliseconds;clearTimeout(this.holdTimer);this.holdTimer=setTimeout(()=>{if(!this.userPaused){this.synth?.resume();this.next();}},milliseconds);}
 get available(){return !!this.synth;}
 forLanguage(language:'en'|'zh-HK'){return this.voices.filter(v=>language==='en'?/^en(?:-|$)/i.test(v.lang):/^(?:zh[-_]HK|yue(?:[-_].*)?)$/i.test(v.lang));}
 selected(language:'en'|'zh-HK'){const voices=this.forLanguage(language),id=language==='en'?this.preferences.englishVoice:this.preferences.cantoneseVoice;return voices.find(v=>v.voiceURI===id)??voices.find(v=>v.localService)??voices[0];}
 configure(preferences:NarrationPreferences){this.preferences={...preferences};this.stop();}
 say(en:string,zh:string,category='sample'){
  if(!this.preferences.enabled||!this.synth)return;
  const now=Date.now();if(category!=='error'&&now-(this.last.get(category)??0)<10000)return;
  this.last.set(category,now);this.queue=this.queue.filter(x=>x.category!==category);if(this.queue.length>=8)this.queue.shift();
  this.queue.push({en:en.slice(0,600),zh:zh.slice(0,600),category});this.next();
 }
 private next(){if(this.speaking||this.userPaused||!this.synth||!this.preferences.enabled||Date.now()<this.holdUntil)return;const item=this.queue.shift();if(!item)return;const epoch=this.generation;
  const tracks=this.preferences.language==='both'?['en','zh-HK'] as const:[this.preferences.language] as const;let index=0;this.speaking=true;
  const advance=()=>{if(epoch!==this.generation)return;const language=tracks[index++];if(!language){this.speaking=false;this.next();return;}const voice=this.selected(language);if(!voice||(!voice.localService&&!navigator.onLine)){advance();return;}
   const utterance=new SpeechSynthesisUtterance(language==='en'?item.en:item.zh);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=this.preferences.rate;utterance.pitch=this.preferences.pitch;utterance.onend=advance;utterance.onerror=advance;this.synth!.speak(utterance);
  };advance();
 }
 pause(){this.userPaused=true;this.synth?.pause();} resume(){this.userPaused=false;if(Date.now()>=this.holdUntil){this.synth?.resume();this.next();}}
 stop(){this.generation++;this.queue=[];this.speaking=false;this.userPaused=false;this.holdUntil=0;clearTimeout(this.holdTimer);this.synth?.cancel();this.synth?.resume();}
 dispose(){this.stop();clearTimeout(this.holdTimer);this.synth?.removeEventListener('voiceschanged',this.refresh);}
}
