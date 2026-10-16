"use strict";
const crypto = require('node:crypto');
const YAML = require('yaml');
const CHECKOUT = '11bd71901bbe5b1630ceea73d27597364c9af683';
const UPLOAD = 'ea165f8d65b6e75b540449e92b4886f43607fa02';
const TARGETS = Object.freeze(['all','source','legal-info','sdk']);
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw Error('WORKFLOW_FIELDS');
}
function normalizeModel(value) {
  exact(value,['sourceRepository','sourceRevision','defconfig','target','parallelism']);
  if (typeof value.sourceRepository !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value.sourceRepository)) throw Error('WORKFLOW_SOURCE');
  if (typeof value.sourceRevision !== 'string' || !/^[a-f0-9]{40}$/.test(value.sourceRevision)) throw Error('WORKFLOW_REVISION');
  if (typeof value.defconfig !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_+-]{0,119}_defconfig$/.test(value.defconfig)) throw Error('WORKFLOW_DEFCONFIG');
  if (!TARGETS.includes(value.target) || !Number.isInteger(value.parallelism) || value.parallelism < 1 || value.parallelism > 8) throw Error('WORKFLOW_BUILD_OPTIONS');
  return {sourceRepository:value.sourceRepository,sourceRevision:value.sourceRevision,defconfig:value.defconfig,target:value.target,parallelism:value.parallelism};
}
function runnerLabels(runner) {
  if (runner?.kind === 'hosted' && JSON.stringify(runner.labels) === '["ubuntu-24.04"]') return ['ubuntu-24.04'];
  if (runner?.kind !== 'self-hosted' || !Array.isArray(runner.labels) || runner.labels.length > 8 || !['self-hosted','Linux','X64'].every(x=>runner.labels.includes(x)) || runner.labels.some(x=>typeof x !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(x))) throw Error('WORKFLOW_RUNNER');
  return [...runner.labels];
}
function document(model,runner) {
  const m=normalizeModel(model);
  return {
    name:'Material Buildroot managed execution',
    on:{workflow_dispatch:{inputs:{operation:{description:'Application-owned operation UUID',required:true,type:'string'}}}},
    permissions:{contents:'read'},
    'run-name':'material-buildroot-${{ inputs.operation }}',
    env:{SOURCE_REPOSITORY:m.sourceRepository,SOURCE_REVISION:m.sourceRevision,DEFCONFIG:m.defconfig,BUILD_TARGET:m.target,PARALLELISM:String(m.parallelism)},
    jobs:{build:{'runs-on':runnerLabels(runner),'timeout-minutes':360,steps:[
      {name:'Validate execution identity',env:{OPERATION:'${{ inputs.operation }}'},shell:'bash',run:'set -euo pipefail\ntest "$(id -u)" -ne 0\n[[ "$OPERATION" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]'},
      {name:'Prepare Buildroot dependencies',shell:'bash',run:'set -euo pipefail\ntest "$(id -u)" -ne 0\ncommand -v apt-get >/dev/null\nsudo -n apt-get update\nsudo -n apt-get install -y --no-install-recommends build-essential bash bc binutils bzip2 cpio file findutils gawk git gzip libncurses-dev make patch perl python3 rsync sed tar unzip wget xz-utils'},
      {name:'Checkout immutable source',uses:`actions/checkout@${CHECKOUT}`,with:{repository:m.sourceRepository,ref:m.sourceRevision,path:'source','persist-credentials':false,submodules:false,token:'${{ secrets.BUILDROOT_SOURCE_TOKEN || github.token }}'}},
      {name:'Build immutable configuration',shell:'bash',run:'set -euo pipefail\ntest "$(id -u)" -ne 0\ntest "$(git -C source rev-parse HEAD)" = "$SOURCE_REVISION"\nmake -C source O="$GITHUB_WORKSPACE/output" "$DEFCONFIG"\nmake -C source O="$GITHUB_WORKSPACE/output" -j"$PARALLELISM" "$BUILD_TARGET"'},
      {name:'Collect bounded safe outputs',if:'${{ always() }}','continue-on-error':true,env:{OPERATION:'${{ inputs.operation }}'},shell:'bash',run:"set -euo pipefail\npython3 - <<'PY'\nimport hashlib, json, os, pathlib, stat\nroot=pathlib.Path('evidence')\nroot.mkdir(exist_ok=True)\nimages=root/'images'\nimages.mkdir(exist_ok=True)\nfiles=[]\ntotal=0\nsource=pathlib.Path('output/images')\nif source.is_dir() and not source.is_symlink():\n    for item in sorted(source.iterdir()):\n        info=item.lstat()\n        if not stat.S_ISREG(info.st_mode):\n            continue\n        if len(files)>=1000 or total+info.st_size>32*1024*1024:\n            raise RuntimeError('Output collection exceeds the 32 MiB / 1000 file limit')\n        fd=os.open(item, os.O_RDONLY|os.O_NOFOLLOW)\n        with os.fdopen(fd,'rb') as handle:\n            data=handle.read(32*1024*1024+1)\n        if len(data)!=info.st_size:\n            raise RuntimeError('Output changed during collection')\n        destination=images/item.name\n        with destination.open('xb') as handle:\n            handle.write(data)\n        files.append({'path':'images/'+item.name,'length':len(data),'sha256':hashlib.sha256(data).hexdigest()})\n        total+=len(data)\nmanifest={'schemaVersion':1,'operationId':os.environ['OPERATION'],'workflowRevision':os.environ['GITHUB_SHA'],'sourceRevision':os.environ['SOURCE_REVISION'],'files':files}\n(root/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')\nPY"},
      {name:'Upload safe outputs',if:'${{ always() }}','continue-on-error':true,uses:`actions/upload-artifact@${UPLOAD}`,with:{name:'buildroot-output',path:'evidence/','if-no-files-found':'warn','retention-days':7,'include-hidden-files':false}}
    ]}}
  };
}
function stable(value) { return Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')}}`:JSON.stringify(value); }
function generate(model,runner) { return YAML.stringify(document(model,runner),{version:'1.2',lineWidth:0}); }
function parseExpert(text,runner) {
  if(typeof text!=='string'||Buffer.byteLength(text)>65536) throw Error('WORKFLOW_SIZE');
  let parsed;
  try {
    const docs=YAML.parseAllDocuments(text,{version:'1.2',schema:'core',uniqueKeys:true,strict:true,customTags:[]});
    if(docs.length!==1||docs[0].errors.length||docs[0].warnings.length)throw Error();
    let count=0;
    function bounded(node,depth=0){
      if(depth>20||++count>2000||YAML.isAlias(node)||node?.tag||node?.anchor)throw Error();
      if(YAML.isMap(node)){for(const pair of node.items){if(!YAML.isScalar(pair.key)||typeof pair.key.value!=='string'||['__proto__','prototype','constructor','<<'].includes(pair.key.value))throw Error();bounded(pair.value,depth+1);}}
      else if(YAML.isSeq(node)){for(const item of node.items)bounded(item,depth+1);}
    }
    bounded(docs[0].contents);
    parsed=docs[0].toJS({maxAliasCount:0});
  } catch { throw Error('WORKFLOW_EXPERT_SYNTAX'); }
  const env=parsed?.env;
  const model=normalizeModel({sourceRepository:env?.SOURCE_REPOSITORY,sourceRevision:env?.SOURCE_REVISION,defconfig:env?.DEFCONFIG,target:env?.BUILD_TARGET,parallelism:Number(env?.PARALLELISM)});
  if(stable(parsed)!==stable(document(model,runner)))throw Error('WORKFLOW_UNADMITTED_ACTION');
  return model;
}
function sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}
module.exports={normalizeModel,runnerLabels,generate,parseExpert,sha256,TARGETS};
