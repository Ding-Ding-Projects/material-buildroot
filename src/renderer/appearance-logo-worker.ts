/** Isolated, bounded single-frame raster decoder. No network or external references. */
self.onmessage=async(event:MessageEvent)=>{
 let bitmap:ImageBitmap|undefined;
 try{
  const {bytes,fit,x,y,zoom,background}=event.data as {bytes:ArrayBuffer;fit:string;x:number;y:number;zoom:number;background:string};
  if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<32||bytes.byteLength>2*1024*1024||!['contain','cover'].includes(fit)||![x,y,zoom].every(Number.isFinite)||x<0||x>1||y<0||y>1||zoom<1||zoom>4||!/^#[a-f\d]{8}$/i.test(background))throw Error('input');
  const data=new Uint8Array(bytes),view=new DataView(bytes);let width=0,height=0,type='';
  if(data.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])){
   type='image/png';if(String.fromCharCode(...data.slice(12,16))!=='IHDR')throw Error('png');width=view.getUint32(16);height=view.getUint32(20);
   for(let offset=8;offset+12<=data.length;){const length=view.getUint32(offset);if(length>data.length-offset-12)throw Error('png');const name=String.fromCharCode(...data.slice(offset+4,offset+8));if(name==='acTL')throw Error('animated');offset+=length+12;}
  }else if(data[0]===255&&data[1]===216&&data[2]===255){
   type='image/jpeg';let offset=2;
   while(offset+4<data.length){if(data[offset]!==255)throw Error('jpeg');let marker=data[++offset];while(marker===255)marker=data[++offset];offset++;if(marker===217||marker===218)break;if(marker===216||marker>=208&&marker<=215)continue;const length=view.getUint16(offset);if(length<2||offset+length>data.length)throw Error('jpeg');if([192,193,194].includes(marker)){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}offset+=length;}
  }else throw Error('format');
  if(width<1||height<1||width>4096||height>4096||width*height>4000000)throw Error('dimensions');
  bitmap=await createImageBitmap(new Blob([bytes],{type}),{imageOrientation:'from-image'});
  if(bitmap.width*bitmap.height>4000000)throw Error('decoded-dimensions');
  const variants:{size:number;bytes:ArrayBuffer}[]=[];
  for(const size of [32,64,128]){
   const canvas=new OffscreenCanvas(size,size),context=canvas.getContext('2d');if(!context)throw Error('canvas');context.fillStyle=background;context.fillRect(0,0,size,size);
   const scale=(fit==='cover'?Math.max(size/bitmap.width,size/bitmap.height):Math.min(size/bitmap.width,size/bitmap.height))*zoom;
   const w=bitmap.width*scale,h=bitmap.height*scale;context.drawImage(bitmap,(size-w)*x,(size-h)*y,w,h);
   const output=await canvas.convertToBlob({type:'image/png'});if(output.size>128000)throw Error('output');const outputBytes=await output.arrayBuffer(),signature=new Uint8Array(outputBytes);
   if(!signature.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]))throw Error('signature');
   const roundtrip=await createImageBitmap(output);if(roundtrip.width!==size||roundtrip.height!==size){roundtrip.close();throw Error('roundtrip');}roundtrip.close();variants.push({size,bytes:outputBytes});
  }
  self.postMessage({ok:true,variants});
 }catch{self.postMessage({ok:false});}finally{bitmap?.close();}
};
export {};
