'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {verifiedOutput,verifyInstaller}=require('../build/driver.cjs');
function prepare(root,source){
 if(!/^[a-f0-9]{40}$/.test(source))throw Error('Exact release source is required.');
 const input=path.join(root,'release/installer');if(!verifiedOutput(input))throw Error('Installer receipt or output integrity is unavailable.');
 const receipt=JSON.parse(fs.readFileSync(path.join(input,'build-receipt.json'),'utf8'));
 if(!receipt.installer||receipt.source.commit!==source||receipt.target!=='desktop')throw Error('Installer source does not match release source.');
 const inventory=verifyInstaller(input),chosen=inventory.filter(file=>/(^|\/)(Setup\.exe|RELEASES|[A-Za-z0-9_.-]+-(full|delta)\.nupkg)$/i.test(file.path));
 const names=new Set();for(const file of chosen){const name=path.basename(file.path);if(names.has(name))throw Error('Duplicate release asset filename.');names.add(name);}
 const output=path.join(root,'release/publish');if(fs.existsSync(output))throw Error('Publication staging already exists; preserve it and choose a fresh build checkout.');fs.mkdirSync(output,{recursive:true});
 for(const file of chosen)fs.copyFileSync(path.join(input,file.path),path.join(output,path.basename(file.path)));
 const provenance={schemaVersion:1,version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,source,tree:receipt.source.tree,manifestSha256:receipt.source.manifestSha256,packageLockSha256:receipt.packageLockSha256,producedAt:receipt.producedAt,platform:'windows-x64',installer:'Squirrel.Windows',signed:false,runtimeVerified:false,checks:'This workflow builds and packages only. No tests, lint, type checking, installation or update verification ran.',assets:chosen.map(file=>({name:path.basename(file.path),bytes:file.bytes,sha256:file.sha256}))};
 fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
 const sums=fs.readdirSync(output).sort().map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex')+'  '+name).join('\n')+'\n';fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),sums);return {output,provenance};
}
module.exports={prepare};
if(require.main===module){const result=prepare(path.resolve(__dirname,'../..'),process.argv[2]);console.log(`Prepared ${result.provenance.assets.length} installer assets and safe provenance.`);}
