import {narrationDefaults,type NarrationPreferences} from './narration';
export const attentionKeys=['focus','lowStimulation','timeAwareness','oneThing','momentum'] as const;
export type AttentionKey=typeof attentionKeys[number];
export interface AttentionPreferences {schemaVersion:1;modes:Record<AttentionKey,boolean>;nextAction:string;snoozeUntil:number;narration:NarrationPreferences}
const key='material-buildroot.attention.v1';
export const defaultAttention=():AttentionPreferences=>({schemaVersion:1,modes:{focus:false,lowStimulation:false,timeAwareness:false,oneThing:false,momentum:false},nextAction:'',snoozeUntil:0,narration:narrationDefaults()});
export function readAttention():AttentionPreferences {try{const raw=localStorage.getItem(key);if(!raw||raw.length>10000)return defaultAttention();const value=JSON.parse(raw);if(value.schemaVersion!==1||attentionKeys.some(k=>typeof value.modes?.[k]!=='boolean')||typeof value.nextAction!=='string'||value.nextAction.length>240||!Number.isFinite(value.snoozeUntil)||typeof value.narration?.enabled!=='boolean'||!['en','zh-HK','both'].includes(value.narration.language)||!['englishVoice','cantoneseVoice'].every(k=>typeof value.narration[k]==='string'&&value.narration[k].length<=1024)||!Number.isFinite(value.narration.rate)||value.narration.rate<0.1||value.narration.rate>10||!Number.isFinite(value.narration.pitch)||value.narration.pitch<0||value.narration.pitch>2)return defaultAttention();return value;}catch{return defaultAttention();}}
export function saveAttention(value:AttentionPreferences){localStorage.setItem(key,JSON.stringify(value));}

export function portableAttention(value:AttentionPreferences){return {schemaVersion:1 as const,modes:{...value.modes},narration:{enabled:value.narration.enabled,language:value.narration.language,rate:value.narration.rate,pitch:value.narration.pitch}};}
/** Deliberately excludes arbitrary next-action text, voice identities and snooze timestamps. */
export function restorePortableAttention(value:unknown,current:AttentionPreferences):AttentionPreferences{
 const v=value as ReturnType<typeof portableAttention>;
 const keys=(item:unknown,expected:string)=>!!item&&typeof item==='object'&&!Array.isArray(item)&&Object.keys(item).sort().join(',')===expected;
 if(!keys(v,'modes,narration,schemaVersion')||v.schemaVersion!==1||!keys(v.modes,'focus,lowStimulation,momentum,oneThing,timeAwareness')||attentionKeys.some(k=>typeof v.modes[k]!=='boolean')||!keys(v.narration,'enabled,language,pitch,rate')||typeof v.narration.enabled!=='boolean'||!['en','zh-HK','both'].includes(v.narration.language)||!Number.isFinite(v.narration.rate)||v.narration.rate<.1||v.narration.rate>10||!Number.isFinite(v.narration.pitch)||v.narration.pitch<0||v.narration.pitch>2)throw Error('INVALID_PREFERENCES');
 return {...current,modes:{...v.modes},narration:{...current.narration,...v.narration}};
}
