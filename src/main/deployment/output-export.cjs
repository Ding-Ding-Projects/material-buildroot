"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { hashFile } = require("./artifacts.cjs");
function fail(code) { throw new Error(code); }
/** Reject external references before an image parser sees user-provided bytes. */
function admitImageHeader(file, format, ownedVmdk) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd), b = Buffer.alloc(Math.min(4096, stat.size));
    if (!stat.isFile() || stat.size < 512 || stat.size > 16 * 1024 ** 3) fail("conversion-source-size-limit");
    fs.readSync(fd,b,0,b.length,0);
    if (format === "qcow2" && (b.length < 104 || b.readUInt32BE(4) < 2 || b.readUInt32BE(4) > 3 || b.readBigUInt64BE(8) !== 0n || b.readUInt32BE(16) !== 0 || b.readUInt32BE(32) !== 0 || b.readUInt32BE(60) !== 0 || (b.readUInt32BE(4) === 3 && (b.readBigUInt64BE(72) & ~3n) !== 0n))) fail("conversion-dependent-image-rejected");
    if (format === "vdi" && (b.length < 456 || ![1,2].includes(b.readUInt32LE(76)) || b.subarray(424,456).some(x=>x!==0))) fail("conversion-dependent-image-rejected");
    if (format === "vmdk" && !ownedVmdk) fail("vmdk-requires-owned-conversion");
  } finally { fs.closeSync(fd); }
}
function metadata(value, format) {
  let data;
  try { data = JSON.parse(value); } catch { fail("conversion-metadata-invalid"); }
  if (!data || data.format !== format || !Number.isSafeInteger(data["virtual-size"]) || data["virtual-size"] < 512 || data["virtual-size"] > 64 * 1024 ** 3 || data["backing-filename"] || data["full-backing-filename"] || data.encrypted || data.snapshots?.length || data["data-file"]) fail("conversion-metadata-not-admitted");
  return data;
}
function tarHeader(name,size) {
  if(!/^[a-z0-9.-]{1,80}$/.test(name)||!Number.isSafeInteger(size)||size<0||size>0o77777777777)fail("conversion-archive-limit");
  const b=Buffer.alloc(512);b.write(name);b.write("0000600\0",100);b.write("0000000\0",108);b.write("0000000\0",116);b.write(size.toString(8).padStart(11,"0")+"\0",124);b.write("00000000000\0",136);b.fill(32,148,156);b[156]=48;b.write("ustar\0",257);b.write("00",263);b.write(b.reduce((n,x)=>n+x,0).toString(8).padStart(6,"0")+"\0 ",148);return b;
}
async function writeOva(directory,disk,virtualBytes,output) {
  const diskBytes=fs.statSync(disk).size;
  // This is an exported disk appliance, not a claim that its guest can boot.
  const ovf=`<?xml version="1.0" encoding="UTF-8"?>\n<Envelope xmlns="http://schemas.dmtf.org/ovf/envelope/1" xmlns:ovf="http://schemas.dmtf.org/ovf/envelope/1" xmlns:rasd="http://schemas.dmtf.org/wbem/wscim/1/cim-schema/2/CIM_ResourceAllocationSettingData"><References><File ovf:id="file1" ovf:href="disk.vmdk" ovf:size="${diskBytes}"/></References><DiskSection><Info>Exported disk</Info><Disk ovf:diskId="disk1" ovf:fileRef="file1" ovf:capacity="${virtualBytes}" ovf:capacityAllocationUnits="byte" ovf:format="http://www.vmware.com/interfaces/specifications/vmdk.html#streamOptimized"/></DiskSection><VirtualSystem ovf:id="buildroot"><Info>Buildroot disk appliance; boot not verified</Info><Name>Buildroot</Name><OperatingSystemSection ovf:id="0"><Info>Operating system not specified</Info></OperatingSystemSection><VirtualHardwareSection><Info>One CPU, 1024 MiB RAM, SATA disk, no network adapter</Info><Item><rasd:Description>CPU</rasd:Description><rasd:ElementName>1 CPU</rasd:ElementName><rasd:InstanceID>1</rasd:InstanceID><rasd:ResourceType>3</rasd:ResourceType><rasd:VirtualQuantity>1</rasd:VirtualQuantity></Item><Item><rasd:AllocationUnits>byte * 2^20</rasd:AllocationUnits><rasd:ElementName>1024 MiB RAM</rasd:ElementName><rasd:InstanceID>2</rasd:InstanceID><rasd:ResourceType>4</rasd:ResourceType><rasd:VirtualQuantity>1024</rasd:VirtualQuantity></Item><Item><rasd:ElementName>SATA controller</rasd:ElementName><rasd:InstanceID>3</rasd:InstanceID><rasd:ResourceSubType>AHCI</rasd:ResourceSubType><rasd:ResourceType>20</rasd:ResourceType></Item><Item><rasd:AddressOnParent>0</rasd:AddressOnParent><rasd:ElementName>Disk</rasd:ElementName><rasd:HostResource>ovf:/disk/disk1</rasd:HostResource><rasd:InstanceID>4</rasd:InstanceID><rasd:Parent>3</rasd:Parent><rasd:ResourceType>17</rasd:ResourceType></Item></VirtualHardwareSection></VirtualSystem></Envelope>\n`;
  const descriptor=path.join(directory,"appliance.ovf"),manifest=path.join(directory,"appliance.mf");
  fs.writeFileSync(descriptor,ovf,{flag:"wx",mode:0o600});
  fs.writeFileSync(manifest,`SHA256(appliance.ovf)= ${await hashFile(descriptor)}\nSHA256(disk.vmdk)= ${await hashFile(disk)}\n`,{flag:"wx",mode:0o600});
  const fd=fs.openSync(output,"wx",0o600);let position=0;
  const write=b=>{let at=0;while(at<b.length){const n=fs.writeSync(fd,b,at,b.length-at,position);if(!n)fail("conversion-archive-write-failed");at+=n;position+=n;}};
  try {
    for(const [name,file] of [["appliance.ovf",descriptor],["appliance.mf",manifest],["disk.vmdk",disk]]) {
      const size=fs.statSync(file).size;write(tarHeader(name,size));for await(const chunk of fs.createReadStream(file))write(chunk);if(size%512)write(Buffer.alloc(512-size%512));
    }
    write(Buffer.alloc(1024));fs.fsyncSync(fd);
  } finally {fs.closeSync(fd);}
}
module.exports={admitImageHeader,metadata,writeOva};
