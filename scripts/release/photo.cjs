'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const PIN=Object.freeze({filename:'hk-dish-0001-classic-har-gow.png',bytes:2406444,sha256:'c6ff2d32938f1e4c4ea685442f69227b8cd387f302ab8f8a62e8dd96c62b5ac0',width:1254,height:1254});
function run(exe,args,options={}) {
  const result=cp.spawnSync(exe,args,{windowsHide:true,timeout:30000,maxBuffer:4*1024*1024,...options});
  if(result.error||result.status!==0)throw Error('Required catalogue photo validation failed.');
  return result.stdout;
}
function decodePhoto(filename) {
  if(process.platform!=='win32')throw Error('Native Windows photo decode is required.');
  const powershell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  // Match the trusted root build entrypoint's process-only startup option.
  // Managed execution settings retain precedence; no persistent configuration is changed.
  return JSON.parse(run(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'verify-photo.ps1'),'-PhotoPath',filename],{encoding:'utf8'}));
}
function verifyPhoto(root,source,{trackedBytes,decode}={}) {
  if(!/^[a-f0-9]{40}$/.test(source))throw Error('Exact photo source is required.');
  const indexPath='assets/catalogue/index.json',relative='assets/catalogue/'+PIN.filename;
  const readTracked=trackedBytes||((file)=>run('git',['show',source+':'+file],{cwd:root}));
  for(const file of [indexPath,relative]) {
    const local=fs.readFileSync(path.join(root,file)),committed=Buffer.from(readTracked(file));
    // Git may expand JSON line endings on Windows; the PNG always requires raw byte equality.
    const equal=file===indexPath ? local.toString('utf8').replaceAll('\r\n','\n')===committed.toString('utf8').replaceAll('\r\n','\n') : local.equals(committed);
    if(!equal)throw Error('Catalogue photo must match tracked release source.');
  }
  const index=JSON.parse(fs.readFileSync(path.join(root,indexPath),'utf8'));
  if(index.schemaVersion!==1||index.dishes?.length!==1)throw Error('Required catalogue photo is unavailable.');
  const dish=index.dishes[0],branding=JSON.parse(fs.readFileSync(path.join(root,'assets/branding/release-codename.json'),'utf8'));
  if(Object.entries(PIN).some(([key,value])=>dish[key]!==value)||dish.id!==branding.id||dish.name?.en!==branding.name?.en||dish.name?.zhHant!==branding.name?.zhHant||dish.sha256!==branding.photoSha256||dish.bytes!==branding.photoBytes||dish.catalogRevision!==branding.catalogRevision||dish.photoUrl!==branding.photoUrl)throw Error('Catalogue photo pin mismatch.');
  const file=path.join(root,relative),bytes=fs.readFileSync(file);
  if(bytes.length!==PIN.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==PIN.sha256)throw Error('Catalogue photo hash mismatch.');
  const nativeDecode=decode||decodePhoto;
  const dimensions=nativeDecode(file);
  if(dimensions?.width!==PIN.width||dimensions?.height!==PIN.height)throw Error('Catalogue photo decode dimensions mismatch.');
  return {file,dish,note:`Release photo: ${dish.name.en} · ${dish.name.zhHant}, attached as ${PIN.filename}. Catalogue source: ${dish.catalogUrl}. Original image: ${dish.photoUrl}. ${dish.rights}`};
}
function stagePhoto(output,provenance,photo) {
  const photoName=path.basename(photo.file),destination=path.join(output,photoName);
  if(fs.existsSync(destination))throw Error('Duplicate release photo filename.');
  fs.copyFileSync(photo.file,destination,fs.constants.COPYFILE_EXCL);
  const bytes=fs.readFileSync(destination);
  if(bytes.length!==photo.dish.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==photo.dish.sha256)throw Error('Staged catalogue photo hash mismatch.');
  provenance.assets.push({name:photoName,bytes:photo.dish.bytes,sha256:photo.dish.sha256});
  provenance.releasePhoto={id:photo.dish.id,name:photo.dish.name,filename:photoName,catalogUrl:photo.dish.catalogUrl,photoUrl:photo.dish.photoUrl,rights:photo.dish.rights};
  fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
  const sums=fs.readdirSync(output).filter(name=>name!=='SHA256SUMS.txt').sort().map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex')+'  '+name).join('\n')+'\n';
  fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),sums);
  return fs.readdirSync(output).map(name=>path.join(output,name));
}
module.exports={verifyPhoto,stagePhoto,decodePhoto};
