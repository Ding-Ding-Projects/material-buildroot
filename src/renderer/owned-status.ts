type Localize=(english:string,translated:string)=>string;
type StatusValue=string|string[];
const values=new WeakMap<object,Map<string,{original:StatusValue;english:StatusValue}>>();
/** Capture only pure application-owned status expressions. Provider data is interpolated unchanged. */
export function captureOwnedStatus<T extends StatusValue>(owner:object,field:string,localize:Localize,render:(l:Localize)=>T):T{
 const original=render(localize),english=render((text)=>text);
 let fields=values.get(owner);if(!fields){fields=new Map();values.set(owner,fields);}fields.set(field,{original,english});return original;
}
/** Explicit status field boundary; never used for records, logs, article HTML or arbitrary DOM text. */
export function displayOwnedStatus<T extends StatusValue>(owner:object,field:string,value:T,language:string):T{
 const saved=values.get(owner)?.get(field);return language==='en'&&saved?.original===value?saved.english as T:value;
}
