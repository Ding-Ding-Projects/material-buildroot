import {localizedCopy} from './language-wording';
type Localize=(english:string,translated:string)=>string;
type StatusValue=string|string[];
type Span={en:string;zh:string};
type Saved={original:StatusValue;templates:StatusValue;prefix:string;spans:Span[]};
const values=new WeakMap<object,Map<string,Saved>>();
/** Capture pure authored status expressions; interpolated provider values are frozen verbatim. */
export function captureOwnedStatus<T extends StatusValue>(owner:object,field:string,localize:Localize,render:(l:Localize)=>T):T{
 const original=render(localize),spans:Span[]=[],prefix='\u0000'+crypto.randomUUID()+':';
 const templates=render((en,zh)=>{const index=spans.push({en,zh})-1;return prefix+index+'\u0000';});
 let fields=values.get(owner);if(!fields){fields=new Map();values.set(owner,fields);}
 fields.set(field,{original,templates,prefix,spans});return original;
}
/** Apply private wording only when displaying the declared authored spans, never to external values. */
export function displayOwnedStatus<T extends StatusValue>(owner:object,field:string,value:T,language:string):T{
 const saved=values.get(owner)?.get(field);if(!saved||saved.original!==value)return value;
 const format=(text:string)=>{
  let at=0,result='';
  while(at<text.length){const start=text.indexOf(saved.prefix,at);if(start<0)return result+text.slice(at);
   result+=text.slice(at,start);const end=text.indexOf('\u0000',start+saved.prefix.length);
   if(end<0)return result+text.slice(start);
   const id=text.slice(start+saved.prefix.length,end),span=/^\d+$/.test(id)?saved.spans[Number(id)]:undefined;
   result+=span?localizedCopy(span.en,span.zh,language,true):text.slice(start,end+1);at=end+1;
  }return result;
 };
 return (Array.isArray(saved.templates)?saved.templates.map(format):format(saved.templates)) as T;
}
