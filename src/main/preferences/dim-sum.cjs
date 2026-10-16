"use strict";
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const SOURCE='https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const RELEASE='https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases/tags/';
const prefix='https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/';
async function bounded(url,limit,photo=false){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{let response=await fetch(url,{signal:controller.signal,redirect:'manual',headers:{'User-Agent':'Material-Buildroot','Accept':photo?'image/png':'application/json'}});
  if(photo&&response.status>=300&&response.status<400){const next=new URL(response.headers.get('location'));if(next.protocol!=='https:'||next.hostname!=='release-assets.githubusercontent.com'||next.username||next.password)throw Error('SOURCE_UNAVAILABLE');response=await fetch(next,{signal:controller.signal,redirect:'error'});}
  if(!response.ok||Number(response.headers.get('content-length')||0)>limit)throw Error('SOURCE_UNAVAILABLE');
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('SOURCE_TOO_LARGE');chunks.push(Buffer.from(chunk));}
  return {bytes:Buffer.concat(chunks),revision:response.headers.get('etag')||null};
 }finally{clearTimeout(timer);}
}
function createDimSum({directory,allowed}){
 let catalog=null,inFlight=null,lastAttempt=0,drawn=false;const photos=new Map();
 async function load(){if(catalog)return catalog;if(inFlight)return inFlight;if(Date.now()-lastAttempt<60000)throw Error('RETRY_LATER');lastAttempt=Date.now();
  inFlight=(async()=>{const response=await bounded(SOURCE,16*1024*1024),value=JSON.parse(response.bytes.toString('utf8'));if(!Array.isArray(value.dishes)||value.dishes.length>5000)throw Error('INVALID_CATALOG');
   const dishes=value.dishes.filter(x=>/^hk-dish-\d{4}$/.test(x.id)&&typeof x.name?.en==='string'&&x.name.en.length<=160&&typeof x.name?.zhHant==='string'&&x.name.zhHant.length<=160&&/^images\/[a-z0-9-]+\.png$/.test(x.image?.path));
   const assets=new Map();for(let volume=1;volume<=5;volume++){const tag=volume===1?'catalog-v1':`catalog-v1-part-${String(volume).padStart(3,'0')}`;try{const r=JSON.parse((await bounded(RELEASE+tag,2*1024*1024)).bytes.toString('utf8'));if(r.draft||r.prerelease||r.tag_name!==tag||!Array.isArray(r.assets))continue;for(const a of r.assets){if(/^[a-z0-9-]+\.png$/.test(a.name)&&a.size>0&&a.size<=10*1024*1024&&a.browser_download_url===prefix+tag+'/'+a.name)assets.set(a.name,a.browser_download_url);}}catch{/* An unavailable published volume is not replaced with invented artwork. */}}
   catalog={source:SOURCE,revision:response.revision||crypto.createHash('sha256').update(response.bytes).digest('hex'),dishes:dishes.map(x=>({id:x.id,en:x.name.en,zh:x.name.zhHant,photo:assets.get(path.basename(x.image.path))||null}))};return catalog;
  })().finally(()=>inFlight=null);return inFlight;
 }
 async function photo(dish){if(!dish.photo)throw Error('PHOTO_UNAVAILABLE');if(photos.has(dish.id))return photos.get(dish.id);const filename=path.join(directory,dish.id+'.png');
  try{const info=await fs.lstat(directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('UNSAFE_CACHE');const stat=await fs.lstat(filename);if(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=10*1024*1024){const bytes=await fs.readFile(filename);if(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'data:image/png;base64,'+bytes.toString('base64');}}catch(error){if(error.message==='UNSAFE_CACHE')throw error;}
  const {bytes}=await bounded(dish.photo,10*1024*1024,true);if(!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('INVALID_PHOTO');
  try{await fs.mkdir(directory,{recursive:true});const info=await fs.lstat(directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('UNSAFE_CACHE');await fs.writeFile(filename,bytes,{flag:'wx'});await fs.writeFile(filename+'.source.json',JSON.stringify({source:SOURCE,revision:catalog.revision,photo: dish.photo}),{flag:'wx'});}catch{/* Cache inability does not turn a downloaded public photo into a claimed offline asset. */}
  const result='data:image/png;base64,'+bytes.toString('base64');if(photos.size>=3)photos.delete(photos.keys().next().value);photos.set(dish.id,result);return result;
 }
 return {async request(value){if(!allowed())return {ok:false,code:'UNAVAILABLE'};if(!value||!['catalog','photo','surprise'].includes(value.action)||Object.keys(value).some(k=>!['action','id'].includes(k)))return {ok:false,code:'INVALID_REQUEST'};
  try{if(value.action==='surprise'){if(drawn)return {ok:true,dish:null};drawn=true;if(crypto.randomInt(10)!==0)return {ok:true,dish:null};}
   const data=await load();if(!allowed())return {ok:false,code:'UNAVAILABLE'};if(value.action==='catalog')return {ok:true,...data};
   const available=data.dishes.filter(d=>d.photo),dish=value.action==='surprise'?available[crypto.randomInt(Math.max(1,available.length))]:data.dishes.find(d=>d.id===value.id);if(!dish)return {ok:false,code:'PHOTO_UNAVAILABLE'};
   const image=await photo(dish);return allowed()?{ok:true,dish:{...dish,image},source:data.source,revision:data.revision}:{ok:false,code:'UNAVAILABLE'};
  }catch{return {ok:false,code:'CATALOG_UNAVAILABLE'};}
 }};
}
module.exports={createDimSum};
