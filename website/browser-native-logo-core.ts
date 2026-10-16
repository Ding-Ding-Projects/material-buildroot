import {browserWorkerURL} from './browser-native-worker-url.js';
export type LogoOptions={fit:'contain'|'cover';x:number;y:number;zoom:number;background:string};
export type LogoRecord={version:1;variants:{size:number;data:string}[]};
const key='mb-visitor-logo-v1';
export function validDerivative(size:number,data:string){try{const encoded=data.slice('data:image/png;base64,'.length);const header=atob(encoded.slice(0,44));if(header.length<24)return false;const bytes=Uint8Array.from(header,c=>c.charCodeAt(0));const view=new DataView(bytes.buffer);return String.fromCharCode(...bytes.slice(12,16))==='IHDR'&&view.getUint32(16)===size&&view.getUint32(20)===size;}catch{return false;}}
export async function convertLogo(file:File,options:LogoOptions):Promise<LogoRecord>{
 if(file.size>2097152||file.size<32)throw Error('bounds');
 const bytes=await file.arrayBuffer();return new Promise((resolve,reject)=>{
  const worker=new Worker(browserWorkerURL('browser-native-logo-worker'),{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(Error('timeout'));},5000);
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('decoder'));};
  worker.onmessage=event=>{clearTimeout(timer);worker.terminate();if(!event.data.ok){reject(Error('conversion'));return;}
   const variants=(event.data.variants as {size:number;bytes:ArrayBuffer}[]).map(v=>{const bytes=new Uint8Array(v.bytes);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return {size:v.size,data:'data:image/png;base64,'+btoa(binary)};});
   resolve({version:1,variants});};worker.postMessage({bytes,...options},[bytes]);
 });
}
export function readLogo():LogoRecord|null{try{const raw=localStorage.getItem(key);if(!raw||raw.length>550000)return null;const value=JSON.parse(raw) as LogoRecord;if(value.version!==1||value.variants.length!==3||value.variants.some((v,i)=>v.size!==[32,64,128][i]||v.data.length>175000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(v.data)||!validDerivative(v.size,v.data)))return null;return value;}catch{return null;}}
export function saveLogo(logo:LogoRecord|null){if(logo)localStorage.setItem(key,JSON.stringify(logo));else localStorage.removeItem(key);applyLogo(logo);}
export function applyLogo(logo:LogoRecord|null=readLogo()){
 const brand=document.querySelector('#visitor-workspace > h1');if(!brand)return;
 let image=brand.querySelector<HTMLImageElement>('img[data-custom-logo]');if(!logo){image?.remove();return;}
 if(!image){image=document.createElement('img');image.dataset.customLogo='true';image.alt='';image.width=image.height=32;image.style.objectFit='contain';image.style.float='inline-start';image.style.marginInlineEnd='8px';brand.prepend(image);}
 image.src=logo.variants[0].data;image.srcset=logo.variants.map(v=>`${v.data} ${v.size/32}x`).join(',');
}



