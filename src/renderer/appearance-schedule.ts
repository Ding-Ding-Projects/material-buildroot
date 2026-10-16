import {validateDocument,type AppearanceDocument} from '../shared/appearance';
import {readLogo,validDerivative,type LogoRecord} from './appearance-logo';
import type {ScheduledPreferencesSnapshot} from '../shared/scheduled-preferences';
export type AppearanceProfile={appearance:AppearanceDocument;motion:Record<string,unknown>;logo:LogoRecord|null};
const key='material-buildroot.appearance-profiles.v1';
const validId=(value:unknown):value is string=>typeof value==='string'&&/^p[a-f0-9-]{36}$/.test(value);
function profiles():Record<string,AppearanceProfile>{try{const text=localStorage.getItem(key);if(!text||text.length>2500000)return {};const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>20)return {};for(const [id,profile] of Object.entries(value) as [string,AppearanceProfile][]){if(!validId(id))return {};validateDocument(profile.appearance);if(!profile.motion||typeof profile.motion!=='object')return {};if(profile.logo&&(!Array.isArray(profile.logo.variants)||profile.logo.variants.some(v=>![32,64,128].includes(v.size)||typeof v.data!=='string'||v.data.length>175000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(v.data)||!validDerivative(v.size,v.data))))return {};}return value;}catch{return {};}}
export function listAppearanceProfiles(){return Object.keys(profiles());}
export function saveAppearanceProfile(appearance:AppearanceDocument,motion:Record<string,unknown>){const saved=profiles();if(Object.keys(saved).length>=20)throw Error('profile-limit');const id='p'+crypto.randomUUID();saved[id]={appearance:validateDocument(appearance),motion:structuredClone(motion),logo:readLogo()};const text=JSON.stringify(saved);if(text.length>2500000)throw Error('profile-size');localStorage.setItem(key,text);document.dispatchEvent(new Event('appearance-profiles-changed'));return id;}
export function removeAppearanceProfile(id:string){const saved=profiles();delete saved[id];localStorage.setItem(key,JSON.stringify(saved));document.dispatchEvent(new Event('appearance-profiles-changed'));}
export function subscribeAppearanceSchedule(consume:(profile:AppearanceProfile|null,id:string|null,unavailable:boolean)=>void){let snapshot:ScheduledPreferencesSnapshot|null=null;
 const apply=()=>{const id=snapshot?.available?snapshot.effective?.values['appearance.profile']:null;if(!id){consume(null,null,false);return;}const profile=profiles()[id];consume(profile||null,id,!profile);};
 const update=(value:ScheduledPreferencesSnapshot)=>{snapshot=value;apply();};const unsubscribe=window.studio?.onScheduledPreferences?.(update);document.addEventListener('appearance-profiles-changed',apply);
 void window.studio?.scheduledPreferences?.({action:'status'}).then(reply=>{if(reply.ok&&reply.result&&'available'in reply.result)update(reply.result as ScheduledPreferencesSnapshot);}).catch(()=>consume(null,null,true));
 return ()=>{unsubscribe?.();document.removeEventListener('appearance-profiles-changed',apply);};
}
