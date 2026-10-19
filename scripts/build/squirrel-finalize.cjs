'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const {admitInvocation}=require('./squirrel-setup.cjs');
const INSTALLER_TRANSFER_LIMIT=1450000000;

function assertInstallerTransfer(bytes){
  if(!Number.isSafeInteger(bytes)||bytes<1||bytes>INSTALLER_TRANSFER_LIMIT)throw Error('Installer asset exceeds the supported 1.45 GB transfer budget; original output is retained and no release is permitted.');
}
function unlinked(file){
  for(let current=path.resolve(file);;current=path.dirname(current)){
    if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Final embedding path contains a symbolic link or junction.');
    if(current===path.dirname(current))break;
  }
}
async function identity(file){
  unlinked(file);
  const handle=await fs.promises.open(file,'r');
  try{
    const before=await handle.stat();
    if(!before.isFile()||before.nlink!==1||before.size<1||before.size>2000000000)throw Error('Final embedding file exceeds its identity bounds.');
    const hash=crypto.createHash('sha256');let bytes=0;
    for await(const chunk of handle.createReadStream({autoClose:false})){bytes+=chunk.length;if(bytes>before.size)throw Error('Final embedding input changed while hashing.');hash.update(chunk);}
    const after=await handle.stat();
    if(bytes!==before.size||['dev','ino','size','mtimeMs','ctimeMs'].some(key=>before[key]!==after[key]))throw Error('Final embedding input changed while hashing.');
    return {bytes,sha256:hash.digest('hex')};
  }finally{await handle.close();}
}
function same(left,right){return left.bytes===right.bytes&&left.sha256===right.sha256;}

/** Restore the exact genuine input after the package tool's final resource edit. */
async function finalizeSetup({setup,trace,helperDirectory,source,helper,initial,onObserved}){
  const admitted=admitInvocation(initial,source,helper);
  if(admitted.childExitCode!==0||admitted.inputRetained!==true||!admitted.after.dataResource.present||!same(admitted.inputZip,admitted.after.dataResource))throw Error('Initial genuine embedding did not retain its exact input.');
  const input=path.join(trace,'embedding-input.zip');
  if(!same(await identity(input),admitted.inputZip))throw Error('Retained embedding input differs from the original invocation.');
  const executable=path.join(helperDirectory,'WriteZipToSetup.exe'),genuine=path.join(helperDirectory,'WriteZipToSetup.Genuine.exe');
  if((await identity(executable)).sha256!==helper.sha256||(await identity(genuine)).sha256!==helper.genuineHelperSha256)throw Error('Final embedding helper differs from its compiled identity.');
  await identity(setup);
  const finalTrace=path.join(trace,'final-embedding');unlinked(finalTrace);
  fs.mkdirSync(finalTrace);unlinked(finalTrace);
  const child=cp.spawnSync(executable,[setup,input],{windowsHide:true,shell:false,timeout:180000,maxBuffer:65536,encoding:'utf8',env:{...process.env,MATERIAL_BUILD_SQUIRREL_TRACE:finalTrace,MATERIAL_BUILD_SOURCE_SHA:source,MATERIAL_BUILD_SQUIRREL_INPUT_MODE:'reuse'}});
  if(child.error)throw Error(`Final genuine embedding could not start (${child.error.code||'UNAVAILABLE'}); retained input remains in place.`);
  const report=path.join(finalTrace,'setup-helper-invocation.json');unlinked(report);
  if(fs.statSync(report).size>65536)throw Error('Final invocation evidence exceeds its bound.');
  const final=admitInvocation(JSON.parse(fs.readFileSync(report,'utf8')),source,helper);
  if(onObserved)onObserved(final);
  if(child.status!==0)throw Error(`Final genuine embedding exited with code ${child.status??'unavailable'}; exact invocation evidence retained.`);
  if(final.childExitCode!==0||final.inputRetained!==false||!same(final.inputZip,admitted.inputZip)||!final.after.dataResource.present||!same(final.after.dataResource,admitted.inputZip)||!same(await identity(setup),final.after))throw Error('Final genuine embedding did not preserve the exact original input.');
  return final;
}
module.exports={finalizeSetup,identity,assertInstallerTransfer,INSTALLER_TRANSFER_LIMIT};
