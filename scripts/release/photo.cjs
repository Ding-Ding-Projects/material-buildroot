'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const SOURCE='Ding-Ding-Projects/dim-sum-photos';
const LIMITS=Object.freeze({milliseconds:45000,requests:60,pages:20,dishes:5000,assets:10000});
function run(exe,args,options={}) {
  const result=cp.spawnSync(exe,args,{windowsHide:true,timeout:10000,maxBuffer:16*1024*1024,...options});
  if(result.error||result.status!==0)throw Error('Public naming metadata unavailable.');
  return result.stdout;
}
function verifyPhoto(root,source,{trackedBytes,sourcePaths,api,clock=Date.now,project=process.env.GITHUB_REPOSITORY,releaseTag}={}) {
  // Unsafe local source is a publication error, independent of optional naming.
  if(!/^[a-f0-9]{40}$/.test(source))throw Error('Exact photo reference source is required.');
  const relative='assets/branding/release-codename.json',local=fs.readFileSync(path.join(root,relative));
  const committed=trackedBytes?trackedBytes(relative):run('git',['show',source+':'+relative],{cwd:root});
  if(local.toString('utf8').replaceAll('\r\n','\n')!==Buffer.from(committed).toString('utf8').replaceAll('\r\n','\n'))throw Error('Photo reference must match tracked release source.');
  const tracked=sourcePaths?sourcePaths():run('git',['ls-tree','-r','--name-only',source,'--','assets/catalogue'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  if(tracked.length||fs.existsSync(path.join(root,'assets/catalogue/index.json'))||fs.existsSync(path.join(root,'assets/catalogue/hk-dish-0001-classic-har-gow.png')))throw Error('Copied consumer photo catalogue must be removed.');
  const versionOnly=reason=>({reference:{state:'version-only',reason},note:`Release code name unavailable: ${reason}. This release uses its version alone; no dish is reused and no photo is copied or attached.`});
  let reason='public catalogue or complete release history unavailable';
  try {
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(project||'')||typeof releaseTag!=='string'||!releaseTag)throw Error();
    const deadline=clock()+LIMITS.milliseconds;let requests=0;
    const budget=()=>{if(clock()>=deadline)throw Error('Optional naming budget exhausted.');};
    const read=(route,raw=false)=>{
      const remaining=deadline-clock();if(remaining<=0||++requests>LIMITS.requests)throw Error();
      const result=api?api(route,raw):JSON.parse(run(process.env.MATERIAL_RELEASE_GH||'gh',['api',route,...(raw?['-H','Accept: application/vnd.github.raw+json']:[])],{encoding:'utf8',timeout:Math.min(5000,remaining)}));
      budget();return result;
    };
    const pages=route=>{
      const rows=[],ids=new Set();
      for(let page=1;page<=LIMITS.pages;page++) {
        const batch=read(`${route}${route.includes('?')?'&':'?'}per_page=100&page=${page}`);
        if(!Array.isArray(batch)||batch.length>100)throw Error();
        for(const row of batch){budget();if(!Number.isSafeInteger(row.id)||ids.has(row.id))throw Error();ids.add(row.id);rows.push(row);}
        if(batch.length<100)return rows;
      }
      throw Error(); // An incomplete inventory cannot prove a name is unused.
    };
    const repository=read('repos/'+SOURCE);if(repository.private!==false||repository.full_name!==SOURCE)throw Error();
    const revision=read(`repos/${SOURCE}/commits/main`).sha;if(!/^[0-9a-f]{40}$/.test(revision||''))throw Error();
    const catalogUrl=`https://raw.githubusercontent.com/${SOURCE}/${revision}/catalog/index.json`;
    const catalog=read(`repos/${SOURCE}/contents/catalog/index.json?ref=${revision}`,true);
    if(!Array.isArray(catalog.dishes)||!catalog.dishes.length||catalog.dishes.length>LIMITS.dishes)throw Error();
    const dishes=[],dishIds=new Set();
    for(const dish of catalog.dishes){
      budget();
      const filename=dish.image?.path?.split('/').pop();
      if(!/^[a-z0-9-]+$/.test(dish.id||'')||dishIds.has(dish.id)||!filename||!/^[a-z0-9-]+\.png$/.test(filename)||!['en','zhHant'].every(key=>typeof dish.name?.[key]==='string'&&dish.name[key].length>0&&dish.name[key].length<=160&&!/[\x00-\x1f\x7f]/.test(dish.name[key])))throw Error();
      dishIds.add(dish.id);dishes.push({id:dish.id,name:{en:dish.name.en,zhHant:dish.name.zhHant},filename});
    }
    const published=new Map();
    for(const release of pages(`repos/${SOURCE}/releases`)) {
      budget();
      if(release.draft!==false||release.prerelease!==false||!/^catalog-v1(?:-part-\d+)?$/.test(release.tag_name||''))continue;
      for(const asset of pages(`repos/${SOURCE}/releases/${release.id}/assets`)){
        budget();
        if(published.size>=LIMITS.assets)throw Error();
        const expected=`https://github.com/${SOURCE}/releases/download/${release.tag_name}/${asset.name}`;
        if(asset.state==='uploaded'&&Number.isSafeInteger(asset.size)&&asset.size>0&&/^sha256:[a-f0-9]{64}$/.test(asset.digest||'')&&asset.browser_download_url===expected){
          if(published.has(asset.name))throw Error();published.set(asset.name,asset);
        }
      }
    }
    const history=pages(`repos/${project}/releases`),used=new Set();
    for(const release of history){
      budget();
      if(typeof release.tag_name!=='string'||typeof release.name!=='string'||typeof release.body!=='string')throw Error();
      // Historical text is data only. Conservative literal mentions reserve a name;
      // no statement in a historical body can instruct selection or release actions.
      const text=release.name+'\n'+release.body;
      for(const dish of dishes){budget();if(text.includes(dish.id)||text.includes(dish.filename)||text.includes(dish.name.en)||text.includes(dish.name.zhHant))used.add(dish.id);}
    }
    const dish=dishes.find(row=>{budget();return !used.has(row.id)&&published.has(row.filename);});
    budget();
    if(!dish)return versionOnly('no unused published dish is available');
    const asset=published.get(dish.filename),reference={state:'selected',id:dish.id,name:dish.name,filename:dish.filename,catalogRevision:revision,catalogUrl,photoUrl:asset.browser_download_url,bytes:asset.size,sha256:asset.digest.slice(7),project,releaseTag,historyCount:history.length};
    const result={reference,note:`Code name: ${dish.name.en} · ${dish.name.zhHant} (${dish.id}). [Original public photo](${reference.photoUrl}). [Catalogue source](${catalogUrl}).\n\nPhoto mapping: ${JSON.stringify(reference)}\n\nThe image remains in its owning public catalogue release and is not copied or attached to this consumer release.`};
    budget();return result;
  } catch { return versionOnly(reason); }
}
function stagePhotoReference(output,provenance,photo) {
  const names=fs.readdirSync(output);
  if(names.some(name=>/^hk-dish-/i.test(name)||/\.(?:png|jpe?g|webp|gif|7z|zip)$/i.test(name)))throw Error('Consumer release must not attach copied food photos or archives.');
  provenance.publicPhotoReference=photo.reference;
  fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
  const sums=fs.readdirSync(output).filter(name=>name!=='SHA256SUMS.txt').sort().map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex')+'  '+name).join('\n')+'\n';
  fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),sums);
  return fs.readdirSync(output).map(name=>path.join(output,name));
}
module.exports={verifyPhoto,stagePhotoReference,LIMITS};
