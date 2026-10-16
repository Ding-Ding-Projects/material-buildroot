'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const zlib=require('node:zlib');

function embeddedZip(setup) {
  const fd=fs.openSync(setup,'r'),size=fs.fstatSync(fd).size;
  const read=(offset,length)=>{
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||length>1024*1024||offset+length>size) throw Error('Setup resource range is invalid.');
    const bytes=Buffer.alloc(length);
    if(fs.readSync(fd,bytes,0,length,offset)!==length) throw Error('Setup resource read is incomplete.');
    return bytes;
  };
  try {
    const dos=read(0,64);if(dos.toString('ascii',0,2)!=='MZ') throw Error('Setup is not a PE executable.');
    const pe=dos.readUInt32LE(60),header=read(pe,24);
    if(header.readUInt32LE(0)!==0x4550) throw Error('Setup PE signature is invalid.');
    const count=header.readUInt16LE(6),optionalSize=header.readUInt16LE(20);
    if(count<1||count>96||optionalSize<120||optionalSize>4096) throw Error('Setup PE section inventory is invalid.');
    const optional=read(pe+24,optionalSize),magic=optional.readUInt16LE(0),directory=magic===0x10b?96:magic===0x20b?112:-1;
    if(directory<0||directory+24>optional.length) throw Error('Setup PE optional header is invalid.');
    const sections=read(pe+24+optionalSize,count*40);
    const offset=(rva,length=1)=>{
      for(let i=0;i<count;i++) {
        const p=i*40,va=sections.readUInt32LE(p+12),raw=sections.readUInt32LE(p+16),start=sections.readUInt32LE(p+20);
        if(rva>=va&&rva-va+length<=raw&&start+rva-va+length<=size) return start+rva-va;
      }
      throw Error('Setup resource lies outside a regular PE section.');
    };
    const resourceRva=optional.readUInt32LE(directory+16),resourceBytes=optional.readUInt32LE(directory+20),base=offset(resourceRva);
    if(resourceBytes<16||base+resourceBytes>size) throw Error('Setup resource directory is absent.');
    const resources=[];
    const resourceRead=(relative,length)=>{if(relative+length>resourceBytes)throw Error('Setup resource directory escapes its bound.');return read(base+relative,length);};
    const walk=(relative,parts)=>{
      if(parts.length>3) throw Error('Setup resource directory is too deep.');
      const dir=resourceRead(relative,16),n=dir.readUInt16LE(12)+dir.readUInt16LE(14);
      if(n>128) throw Error('Setup resource directory exceeds its bound.');
      const entries=resourceRead(relative+16,n*8);
      for(let i=0;i<n;i++) {
        const k=entries.readUInt32LE(i*8),v=entries.readUInt32LE(i*8+4);
        let name=k;
        if(k>>>31){const p=k&0x7fffffff,len=resourceRead(p,2).readUInt16LE();if(len>128)throw Error('Setup resource name is oversized.');name=resourceRead(p+2,len*2).toString('utf16le');}
        if(v>>>31)walk(v&0x7fffffff,[...parts,name]);
        else{const data=resourceRead(v,16),length=data.readUInt32LE(4);resources.push({path:[...parts,name],offset:offset(data.readUInt32LE(0),length),bytes:length});}
      }
    };
    walk(0,[]);
    const matches=resources.filter(item=>item.path[0]==='DATA'&&item.path[1]===131);
    if(matches.length!==1)throw Error('Setup must contain one genuine embedded package ZIP resource.');
    const zip=matches[0],tail=read(zip.offset+Math.max(0,zip.bytes-65557),Math.min(zip.bytes,65557));
    let end=-1;
    for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}
    if(end<0||tail.readUInt16LE(end+4)||tail.readUInt16LE(end+6))throw Error('Setup embedded ZIP footer is invalid.');
    const n=tail.readUInt16LE(end+10),centralBytes=tail.readUInt32LE(end+12),centralOffset=tail.readUInt32LE(end+16);
    if(n<1||n>32||tail.readUInt16LE(end+8)!==n||centralBytes>1024*1024||centralOffset+centralBytes>zip.bytes)throw Error('Setup embedded ZIP inventory is incomplete or oversized.');
    const central=read(zip.offset+centralOffset,centralBytes),entries=[];let p=0;
    for(let i=0;i<n;i++) {
      if(p+46>central.length||central.readUInt32LE(p)!==0x02014b50)throw Error('Setup embedded ZIP record is invalid.');
      const nameLength=central.readUInt16LE(p+28),extra=central.readUInt16LE(p+30),comment=central.readUInt16LE(p+32),flags=central.readUInt16LE(p+8),method=central.readUInt16LE(p+10);
      if(p+46+nameLength+extra+comment>central.length||flags&1||![0,8].includes(method))throw Error('Setup embedded ZIP member is unsupported.');
      const name=central.toString('utf8',p+46,p+46+nameLength),bytes=central.readUInt32LE(p+24),compressed=central.readUInt32LE(p+20),localOffset=central.readUInt32LE(p+42);
      if(!/^[A-Za-z0-9_.-]+$/.test(name)||entries.some(entry=>entry.name.toLowerCase()===name.toLowerCase()))throw Error('Setup embedded ZIP has an unsafe or duplicate filename.');
      const local=read(zip.offset+localOffset,30);
      if(local.readUInt32LE(0)!==0x04034b50||local.readUInt16LE(8)!==method||local.readUInt16LE(6)!==flags||read(zip.offset+localOffset+30,local.readUInt16LE(26)).toString('utf8')!==name)throw Error('Setup embedded ZIP local record differs.');
      const data=localOffset+30+local.readUInt16LE(26)+local.readUInt16LE(28);
      if(data+compressed>centralOffset||bytes===0)throw Error('Setup embedded ZIP member escapes its data range.');
      entries.push({name,bytes,compressed,method,offset:zip.offset+data});p+=46+nameLength+extra+comment;
    }
    if(p!==central.length)throw Error('Setup embedded ZIP has trailing inventory records.');
    return {bytes:size,resourceBytes:zip.bytes,resourceOffset:zip.offset,entries};
  } finally {fs.closeSync(fd);}
}

async function digests(stream,limit,collect=false) {
  const sha256=crypto.createHash('sha256'),sha1=crypto.createHash('sha1'),chunks=[];let bytes=0;
  for await(const chunk of stream){bytes+=chunk.length;if(bytes>limit)throw Error('Embedded setup member exceeds its expected size.');sha256.update(chunk);sha1.update(chunk);if(collect)chunks.push(chunk);}
  return {bytes,sha256:sha256.digest('hex'),sha1:sha1.digest('hex'),...(collect?{content:Buffer.concat(chunks).toString('utf8')}:{})};
}

async function verifySetupPayload(setup,{packageFile,packageName,updateFile}) {
  const zip=embeddedZip(setup),full=await digests(fs.createReadStream(packageFile),fs.statSync(packageFile).size),update=await digests(fs.createReadStream(updateFile),fs.statSync(updateFile).size);
  const expected=new Map([[packageName,full],['Update.exe',update],['RELEASES',null]]),members=[];let feed;
  for(const entry of zip.entries) {
    if(!expected.has(entry.name)&&!['background.gif','setupIcon.ico'].includes(entry.name))throw Error('Setup embeds an undeclared member.');
    const identity=expected.get(entry.name),limit=identity?identity.bytes:entry.name==='RELEASES'?1024*1024:4*1024*1024;
    const input=fs.createReadStream(setup,{start:entry.offset,end:entry.offset+entry.compressed-1});
    const result=await digests(entry.method===8?input.pipe(zlib.createInflateRaw()):input,limit,entry.name==='RELEASES');
    if(result.bytes!==entry.bytes||(identity&&(result.bytes!==identity.bytes||result.sha256!==identity.sha256)))throw Error('Setup embedded payload differs from the genuine current package or updater.');
    if(entry.name==='RELEASES')feed=result.content.trim();
    expected.delete(entry.name);members.push({name:entry.name,bytes:result.bytes,sha256:result.sha256});
  }
  if(expected.size||feed!==`${full.sha1} ${packageName} ${full.bytes}`&&feed?.toLowerCase()!==`${full.sha1} ${packageName} ${full.bytes}`.toLowerCase())throw Error('Setup must embed the exact current full package, its one-record feed and genuine updater.');
  const resource=await digests(fs.createReadStream(setup,{start:zip.resourceOffset,end:zip.resourceOffset+zip.resourceBytes-1}),zip.resourceBytes);
  if(resource.bytes!==zip.resourceBytes)throw Error('Setup resource bytes are incomplete.');
  return {status:'embedded-package-verified',bytes:zip.bytes,resourceBytes:zip.resourceBytes,resourceSha256:resource.sha256,members,runtimeVerified:false};
}

function admitInvocation(record,source,helper) {
  const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  const identity=value=>{
    if(!value||!Number.isSafeInteger(value.bytes)||value.bytes<0||value.bytes>2000000000||!validHash(value.sha256))throw Error('Genuine helper identity record is invalid.');
    return {bytes:value.bytes,sha256:value.sha256};
  };
  const setup=value=>{
    const file=identity(value),resource=value.dataResource;
    if(!resource||typeof resource.present!=='boolean'||!Number.isSafeInteger(resource.bytes)||resource.bytes<0||resource.bytes>2000000000||!Number.isSafeInteger(resource.error)||resource.error<0||resource.error>0xffffffff||(resource.present?!resource.bytes||!validHash(resource.sha256):resource.bytes!==0||resource.sha256!==''))throw Error('Genuine helper resource record is invalid.');
    return {...file,dataResource:{present:resource.present,bytes:resource.bytes,sha256:resource.sha256,error:resource.error}};
  };
  if(!record||record.schemaVersion!==1||record.source!==source||record.kind!=='genuine-embedding-invocation'||record.genuineHelperSha256!==helper.genuineHelperSha256||record.proxySha256!==helper.sha256||!Number.isSafeInteger(record.childExitCode)||record.childExitCode<0||record.childExitCode>0xffffffff||record.runtimeVerified!==false)throw Error('Actual Squirrel helper invocation is missing or does not match compiled source.');
  return {schemaVersion:1,source,kind:record.kind,genuineHelperSha256:record.genuineHelperSha256,proxySha256:record.proxySha256,childExitCode:record.childExitCode,inputZip:identity(record.inputZip),before:setup(record.before),after:setup(record.after),runtimeVerified:false};
}

module.exports={embeddedZip,verifySetupPayload,admitInvocation};
