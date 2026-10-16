/** Bounded presentation schema. No imported selector, CSS declaration or executable value is accepted. */
export type AppearanceState='normal'|'hover'|'focus'|'pressed'|'selected'|'disabled'|'dragged'|'validation'|'loading'|'success'|'warning'|'error';
export type Values=Record<string,string>;
export type AppearanceRecord={states:Partial<Record<AppearanceState,Values>>};
export type AppearanceDocument={version:1;elements:Record<string,AppearanceRecord>;rainbowSpeed:number;reducedMotion:boolean;presets:Record<string,Values>};
export type Property={id:string;en:string;zh:string;section:'type'|'color'|'geometry'|'motion';css:string;kind:'number'|'choice'|'color';min?:number;max?:number;unit?:string;choices?:string[];fallback?:string};
const number=(id:string,en:string,zh:string,section:Property['section'],css:string,min:number,max:number,unit='px'):Property=>({id,en,zh,section,css,kind:'number',min,max,unit});
const choice=(id:string,en:string,zh:string,section:Property['section'],css:string,choices:string[]):Property=>({id,en,zh,section,css,kind:'choice',choices});
export const properties:Property[]=[
 choice('family','Font family','字體','type','font-family',['Roboto','Arial','Verdana','Georgia','monospace','sans-serif','serif']),
 number('size','Font size','字體大小','type','font-size',12,64),number('weight','Font weight','字重','type','font-weight',100,900,''),
 choice('style','Font style','字款','type','font-style',['normal','italic','oblique']),
 choice('decoration','Text decoration','文字裝飾','type','text-decoration-line',['none','underline','line-through','overline','underline line-through']),
 choice('decorationStyle','Decoration style','裝飾線款式','type','text-decoration-style',['solid','double','dotted','dashed','wavy']),
 choice('case','Capitalization','大小寫','type','text-transform',['none','uppercase','lowercase','capitalize']),
 choice('caps','Small capitals','小型大寫','type','font-variant-caps',['normal','small-caps','all-small-caps']),
 choice('align','Text alignment','文字對齊','type','text-align',['start','center','end','justify']),choice('direction','Text direction','文字方向','type','direction',['ltr','rtl']),
 number('axisWeight','Variable weight axis','可變字重軸','type','--appearance-axis-weight',100,900,''),number('axisWidth','Variable width axis','可變寬度軸','type','--appearance-axis-width',50,200,''),number('axisSlant','Variable slant axis','可變傾斜軸','type','--appearance-axis-slant',-30,30,''),number('axisOptical','Optical size axis','光學大小軸','type','--appearance-axis-optical',8,144,''),
 number('shadowX','Text shadow horizontal','文字陰影水平','type','--appearance-shadow-x',-24,24),number('shadowY','Text shadow vertical','文字陰影垂直','type','--appearance-shadow-y',-24,24),number('shadowBlur','Text shadow blur','文字陰影模糊','type','--appearance-shadow-blur',0,32),
 number('baseline','Baseline offset','基線位移','type','vertical-align',-24,24),number('outline','Text outline','文字描邊','type','-webkit-text-stroke-width',0,3),
 choice('script','Superscript / subscript','上標／下標','type','vertical-align',['baseline','super','sub','middle']),
 number('letters','Character spacing','字距','type','letter-spacing',-2,12),number('words','Word spacing','詞距','type','word-spacing',-4,24),number('line','Line height','行距','type','line-height',1,3,''),
 ...[['foreground','Text color','文字顏色','color'],['background','Background','背景','background-color'],['borderColor','Border color','邊框顏色','border-color'],['decorationColor','Decoration color','裝飾線顏色','text-decoration-color'],['outlineColor','Text outline color','文字描邊顏色','-webkit-text-stroke-color'],['tokenPrimary','Primary accent','主要強調色','--md-sys-color-primary'],['tokenOnPrimary','On primary','主要色上文字','--md-sys-color-on-primary'],['tokenSurface','Surface role','表面色','--md-sys-color-surface'],['tokenOnSurface','On surface','表面上文字','--md-sys-color-on-surface'],['tokenOutline','Outline role','輪廓色','--md-sys-color-outline']].map(([id,en,zh,css])=>({id,en,zh,css,section:'color',kind:'color'} as Property)),
 number('padding','Padding','內距','geometry','padding',0,48),number('gap','Gap','間距','geometry','gap',0,48),number('radius','Corner radius','圓角','geometry','border-radius',0,64),number('border','Border width','邊框粗細','geometry','border-width',0,8),
 choice('borderStyle','Border style','邊框款式','geometry','border-style',['none','solid','dashed','dotted','double']),
 number('opacity','Opacity','不透明度','geometry','opacity',.6,1,''),number('rotate','Rotation','旋轉','geometry','rotate',-15,15,'deg'),number('scale','Scale','縮放','geometry','scale',.8,1.2,''),number('translateX','Horizontal translation','水平位移','geometry','translate',-24,24),
 number('width','Maximum width','最大寬度','geometry','max-width',240,1600),number('minHeight','Minimum height','最小高度','geometry','min-height',44,600),
 number('duration','Transition duration','過渡時間','motion','transition-duration',0,2000,'ms'),number('delay','Transition delay','過渡延遲','motion','transition-delay',0,2000,'ms'),
 choice('easing','Transition easing','過渡緩動','motion','transition-timing-function',['linear','ease','ease-in','ease-out','ease-in-out','steps(4, end)']),
 choice('transition','Transition property','過渡屬性','motion','transition-property',['none','color','background-color','border-color','border-radius','letter-spacing'])
];
export const states:AppearanceState[]=['normal','hover','focus','pressed','selected','disabled','dragged','validation','loading','success','warning','error'];
export const defaultDocument=():AppearanceDocument=>({version:1,elements:{},rainbowSpeed:3,reducedMotion:false,presets:{}});
export function validValue(property:Property,value:unknown):value is string{
 if(typeof value!=='string'||value.length>128)return false;
 if(property.kind==='color')return /^#[\da-f]{6}([\da-f]{2})?$/i.test(value)||(property.id==='background'&&value==='rainbow');
 if(property.id==='family')return /^[\p{L}\p{N} ._-]{1,128}$/u.test(value);
 if(property.kind==='choice')return !!property.choices?.includes(value);
 return value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=property.min!&&Number(value)<=property.max!;
}
export function validateValues(value:unknown):Values{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid-values');
 const result:Values={};for(const [key,v] of Object.entries(value)){const p=properties.find(p=>p.id===key);if(!p||!validValue(p,v))throw Error('unsupported-property');result[key]=v;}return result;
}
export function validateDocument(value:unknown):AppearanceDocument{
 const v=value as AppearanceDocument;if(!v||v.version!==1||!v.elements||Array.isArray(v.elements)||!v.presets||Array.isArray(v.presets)||typeof v.reducedMotion!=='boolean'||!Number.isInteger(v.rainbowSpeed)||v.rainbowSpeed<1||v.rainbowSpeed>10)throw Error('invalid-document');
 if(Object.keys(v).some(k=>!['version','elements','presets','rainbowSpeed','reducedMotion'].includes(k))||Object.keys(v.elements).length>1000||Object.keys(v.presets).length>30)throw Error('document-bounds');
 const result=defaultDocument();result.rainbowSpeed=v.rainbowSpeed;result.reducedMotion=v.reducedMotion;
 for(const [key,record] of Object.entries(v.elements)){if(!/^e[a-f0-9]{16}$/.test(key)||!record||Object.keys(record).some(k=>k!=='states')||!record.states)throw Error('invalid-target');const out:AppearanceRecord={states:{}};for(const [state,values] of Object.entries(record.states)){if(!states.includes(state as AppearanceState))throw Error('invalid-state');out.states[state as AppearanceState]=validateValues(values);}result.elements[key]=out;}
 for(const [name,values] of Object.entries(v.presets)){if(!/^[\p{L}\p{N} _.-]{1,48}$/u.test(name)||['__proto__','constructor','prototype'].includes(name))throw Error('invalid-preset');result.presets[name]=validateValues(values);}return result;
}
export const rainbowSeconds=(level:number)=>Math.max(2,24-2*level);
export function declarations(values:Values):string{
 const extra:string[]=[];if(['shadowX','shadowY','shadowBlur'].some(key=>key in values))extra.push('text-shadow:var(--appearance-shadow-x,0px) var(--appearance-shadow-y,0px) var(--appearance-shadow-blur,0px) currentColor!important');
 const axes=[['axisWeight','wght'],['axisWidth','wdth'],['axisSlant','slnt'],['axisOptical','opsz']].filter(([key])=>key in values).map(([key,tag])=>`"${tag}" ${Number(values[key])}`).join(',');if(axes)extra.push('font-variation-settings:'+axes+'!important');
 return properties.filter(p=>p.id in values&&validValue(p,values[p.id])).map(p=>{
  const v=values[p.id];if(v==='rainbow')return 'background-color:#6750a4;animation:appearance-rainbow var(--appearance-rainbow-duration,18s) linear infinite';
  const cssValue=p.kind==='number'?`${Number(v)}${p.unit}`:p.id==='family'?`"${v}","Microsoft JhengHei",sans-serif`:v;
  let rule=`${p.css}:${cssValue}!important`;
  if(p.id==='family')rule+=';--md-ref-typeface-plain:'+cssValue+';--md-ref-typeface-brand:'+cssValue;
  if(p.id==='foreground')for(const token of ['--md-sys-color-on-surface','--md-outlined-button-label-text-color','--md-text-button-label-text-color','--md-filled-button-label-text-color','--md-outlined-text-field-input-text-color'])rule+=`;${token}:${cssValue}`;
  if(p.id==='size')rule+=`;--md-outlined-button-label-text-size:${cssValue};--md-text-button-label-text-size:${cssValue};--md-outlined-text-field-input-text-size:${cssValue}`;
  return rule;
 }).concat(extra).join(';');
}
export const stateSelectors:Record<AppearanceState,string>={normal:'',hover:':hover',focus:':focus-within',pressed:':active',selected:':is([selected],[aria-selected="true"],[checked])',disabled:':is([disabled],[aria-disabled="true"])',dragged:'[data-dragging="true"]',validation:':is([aria-invalid="true"],[invalid],[error],[data-state="validation"])',loading:':is([aria-busy="true"],[data-state="loading"])',success:'[data-state="success"]',warning:'[data-state="warning"]',error:'[data-state="error"]'};
export const rainbowCss='@keyframes appearance-rainbow{0%,100%{background-color:#bd3357}16%{background-color:#b86b00}33%{background-color:#548200}50%{background-color:#008480}66%{background-color:#4e62be}83%{background-color:#a442ab}}';
export function contrast(a:string,b:string){const luminance=(hex:string)=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function hsvToHex(h:number,s:number,v:number,a=1){const f=(n:number)=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return '#'+[f(5),f(3),f(1),a].map(x=>Math.round(Math.max(0,Math.min(1,x))*255).toString(16).padStart(2,'0')).join('');}
export function hexToHsv(hex:string){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;return {h:(h*60+360)%360,s:max===0?0:d/max,v:max,a:hex.length===9?parseInt(hex.slice(7),16)/255:1};}
/** CSS color parsing is restricted to color grammar; never consumed as a declaration or URL. */
export function translateColor(input:string):string|null{
 const value=input.trim();if(value.length>180||/[;{}\\"'\n]/.test(value)||/url|var|currentcolor|inherit|initial/i.test(value))return null;
 const hsv=/^hs[ vb]+\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
 if(hsv){const [h,s,v,a]=[Number(hsv[1]),Number(hsv[2]),Number(hsv[3]),hsv[4]?Number(hsv[4]):1];return h<=360&&s<=100&&v<=100&&a<=1?hsvToHex(h,s/100,v/100,a):null;}
 const cmyk=/^cmyk\(\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
 if(cmyk){const [c,m,y,k,a]=[...cmyk.slice(1,5).map(x=>Number(x)/100),cmyk[5]?Number(cmyk[5]):1];if([c,m,y,k,a].some(x=>x<0||x>1))return null;return '#'+[(1-c)*(1-k),(1-m)*(1-k),(1-y)*(1-k),a].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');}
 if(!/^(#[a-f\d]{3,8}|[a-z]{1,24}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([\d\s.%+\-/a-z,]+\))$/i.test(value)||!CSS.supports('color',value))return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;context.fillStyle=value;context.fillRect(0,0,1,1);return '#'+Array.from(context.getImageData(0,0,1,1).data).map(v=>v.toString(16).padStart(2,'0')).join('');
}
/** Readouts use D65 sRGB; CIELAB is chromatically adapted to D50. */
export function colorRepresentations(hex:string):Record<string,string>{
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),{h,s,v,a}=hexToHsv(hex),min=Math.min(r,g,b),max=Math.max(r,g,b),light=(min+max)/2,hslS=max===min?0:(max-min)/(1-Math.abs(2*light-1));
 const [lr,lg,lb]=[r,g,b].map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 const x=.4360747*lr+.3850649*lg+.1430804*lb,y=.2225045*lr+.7168786*lg+.0606169*lb,z=.0139322*lr+.0971045*lg+.7141733*lb;
 const f=(t:number)=>t>216/24389?Math.cbrt(t):(24389/27*t+16)/116;
 const fx=f(x/.96422),fy=f(y),fz=f(z/.82521),L=116*fy-16,A=500*(fx-fy),B=200*(fy-fz);
 const l=Math.cbrt(.4122214708*lr+.5363325363*lg+.0514459929*lb),m=Math.cbrt(.2119034982*lr+.6806995451*lg+.1073969566*lb),ss=Math.cbrt(.0883024619*lr+.2817188376*lg+.6299787005*lb);
 const ol=.2104542553*l+.793617785*m-.0040720468*ss,oa=1.9779984951*l-2.428592205*m+.4505937099*ss,ob=.0259040371*l+.7827717662*m-.808675766*ss;
 const n=(value:number)=>Number(value.toFixed(4)),hue=(a:number,b:number)=>n((Math.atan2(b,a)*180/Math.PI+360)%360),k=1-max;
 const named:Record<string,string>={'#000000':'black','#ffffff':'white','#ff0000':'red','#008000':'green','#0000ff':'blue','#663399':'rebeccapurple'};
 return {HEX:hex,RGB:`rgb(${n(r*255)} ${n(g*255)} ${n(b*255)} / ${n(a)})`,HSL:`hsl(${n(h)} ${n(hslS*100)}% ${n(light*100)}% / ${n(a)})`,HSV:`hsv(${n(h)}, ${n(s*100)}%, ${n(v*100)}%, ${n(a)})`,HWB:`hwb(${n(h)} ${n(min*100)}% ${n((1-max)*100)}% / ${n(a)})`,Lab:`lab(${n(L)} ${n(A)} ${n(B)} / ${n(a)})`,LCH:`lch(${n(L)} ${n(Math.hypot(A,B))} ${hue(A,B)} / ${n(a)})`,OKLab:`oklab(${n(ol)} ${n(oa)} ${n(ob)} / ${n(a)})`,OKLCH:`oklch(${n(ol)} ${n(Math.hypot(oa,ob))} ${hue(oa,ob)} / ${n(a)})`,CMYK:`cmyk(${n(k===1?0:(1-r-k)/(1-k)*100)}%, ${n(k===1?0:(1-g-k)/(1-k)*100)}%, ${n(k===1?0:(1-b-k)/(1-k)*100)}%, ${n(k*100)}%, ${n(a)})`,...(a===1&&named[hex.slice(0,7).toLowerCase()]?{name:named[hex.slice(0,7).toLowerCase()]}:{})};
}
export type AppearancePermissionCheck=(targetKey:string,state:string,properties:readonly string[])=>boolean;
const permissionChecks=new Set<AppearancePermissionCheck>();
export function registerAppearancePermissionCheck(check:AppearancePermissionCheck){permissionChecks.add(check);return ()=>{permissionChecks.delete(check);};}
export function appearancePermissionsAllowed(targetKey:string,state:string,keys:readonly string[]){for(const check of permissionChecks){try{if(!check(targetKey,state,keys))return false;}catch{return false;}}return true;}
export function appearanceExperienceId(targetKey:string,state:string,property:string){return `appearance:${targetKey}:${state}:${property}`;}

