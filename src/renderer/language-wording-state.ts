export type WordingPreferences={schemaVersion:1;englishHumor:number;cantoneseHumor:number;displayName:string};
export const wordingDefaults=():WordingPreferences=>({schemaVersion:1,englishHumor:5,cantoneseHumor:5,displayName:''});
const key='material-buildroot.wording.v1';
const listeners=new Set<()=>void>();
function valid(value:unknown):value is WordingPreferences{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const p=value as WordingPreferences;
 return Object.keys(p).sort().join(',')==='cantoneseHumor,displayName,englishHumor,schemaVersion'&&p.schemaVersion===1&&[p.englishHumor,p.cantoneseHumor].every(n=>Number.isInteger(n)&&n>=1&&n<=5)&&typeof p.displayName==='string'&&[...p.displayName].length<=96&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(p.displayName)&&(!p.displayName||p.displayName.trim()===p.displayName);
}
let preferences=wordingDefaults();
let unavailable=false;
function load(){try{const raw=localStorage.getItem(key);if(raw===null){preferences=wordingDefaults();unavailable=false;return;}if(raw.length>1024)throw Error();const next:unknown=JSON.parse(raw);if(!valid(next))throw Error();preferences=next;unavailable=false;}catch{preferences=wordingDefaults();unavailable=true;}}
load();
export const wording={
 get:()=>({...preferences}),unavailable:()=>unavailable,
 subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
 save(change:Partial<Omit<WordingPreferences,'schemaVersion'>>){const next={...preferences,...change};if(!valid(next))return false;try{localStorage.setItem(key,JSON.stringify(next));preferences=next;unavailable=false;listeners.forEach(fn=>fn());return true;}catch{unavailable=true;listeners.forEach(fn=>fn());return false;}},
 productName:()=>preferences.displayName||'Material Buildroot',
};
window.addEventListener('storage',event=>{if(event.key===key||event.key===null){load();listeners.forEach(fn=>fn());}});
