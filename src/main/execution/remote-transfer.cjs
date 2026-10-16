"use strict";
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {inspectCanonicalPath}=require('../security/file-grants.cjs');
const MAX=1107296256,CHUNK=1024*1024;
const fail=code=>{throw Object.assign(Error(code),{code});};
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=(bytes,start=0xffffffff)=>{for(const b of bytes)start=table[(start^b)&255]^(start>>>8);return start>>>0;};
const fingerprint=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');
function hashFile(file){const fd=fs.openSync(file,'r');const bytes=Buffer.alloc(CHUNK),h=createHash('sha256');let total=0;try{for(;;){const n=fs.readSync(fd,bytes,0,bytes.length,null);if(!n)break;total+=n;if(total>MAX)fail('REMOTE_TRANSFER_LIMIT');h.update(bytes.subarray(0,n));}return {bytes:total,sha256:h.digest('hex')};}finally{fs.closeSync(fd);}}
/** Host-authorized source roots only. Keeps an exclusive partial archive on interruption. */
function archiveProject({source,output,directory,revalidate}){
 inspectCanonicalPath(source);inspectCanonicalPath(output);revalidate();
 const file=path.join(directory,'source-'+randomUUID()+'.zip'),out=fs.openSync(file,'wx',0o600);let position=0;const central=[];let count=0;
 const write=bytes=>{let at=0;while(at<bytes.length){const n=fs.writeSync(out,bytes,at,bytes.length-at,position);if(!n)fail('REMOTE_ARCHIVE_WRITE');at+=n;position+=n;if(position>MAX)fail('REMOTE_TRANSFER_LIMIT');}};
 function member(absolute,name){
  if(++count>50000||name.length>255||name.includes('\\')||name.includes(':'))fail('REMOTE_SOURCE_LIMIT');
  inspectCanonicalPath(absolute);const before=fs.statSync(absolute);if(!before.isFile()||before.nlink!==1)fail('REMOTE_SOURCE_UNSAFE');
  const filename=Buffer.from(name),start=position,header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x808,6);header.writeUInt16LE(filename.length,26);write(header);write(filename);
  let sum=0xffffffff,length=0;const input=fs.openSync(absolute,'r'),buffer=Buffer.alloc(CHUNK);try{for(;;){const n=fs.readSync(input,buffer,0,buffer.length,null);if(!n)break;const chunk=buffer.subarray(0,n);sum=crc(chunk,sum);length+=n;write(chunk);}}finally{fs.closeSync(input);}
  inspectCanonicalPath(absolute);if(fingerprint(before)!==fingerprint(fs.statSync(absolute))||length!==before.size)fail('REMOTE_SOURCE_CHANGED');sum=(sum^0xffffffff)>>>0;
  const trailer=Buffer.alloc(16);trailer.writeUInt32LE(0x08074b50);trailer.writeUInt32LE(sum,4);trailer.writeUInt32LE(length,8);trailer.writeUInt32LE(length,12);write(trailer);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x808,8);c.writeUInt32LE(sum,16);c.writeUInt32LE(length,20);c.writeUInt32LE(length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(((0o100000|(before.mode&0o777))<<16)>>>0,38);c.writeUInt32LE(start,42);central.push(c,filename);
 }
 function walk(directory,prefix='',depth=0){if(depth>64)fail('REMOTE_SOURCE_LIMIT');for(const name of fs.readdirSync(directory).sort()){if(name==='.git'||(!prefix&&name==='.config'))continue;const absolute=path.join(directory,name),relative=prefix+name;inspectCanonicalPath(absolute);const s=fs.lstatSync(absolute);if(s.isDirectory())walk(absolute,relative+'/',depth+1);else member(absolute,relative);}}
 try{walk(source);member(path.join(output,'.config'),'.config');revalidate();const start=position;for(const value of central)write(value);const length=position-start,end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(length,12);end.writeUInt32LE(start,16);write(end);fs.fsyncSync(out);}finally{fs.closeSync(out);}
 return {file,...hashFile(file)};
}
module.exports={archiveProject,hashFile,CHUNK,MAX};
