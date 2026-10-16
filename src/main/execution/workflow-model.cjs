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
      {name:'Collect bounded safe outputs',id:'collect',if:'${{ always() }}','continue-on-error':true,env:{OPERATION:'${{ inputs.operation }}'},shell:'bash',run:"set -euo pipefail\npython3 - <<'PY'\nimport hashlib, json, os, pathlib, re, stat, tempfile\nlimit=1024*1024*1024\nstage=pathlib.Path(tempfile.mkdtemp(prefix='buildroot-evidence-',dir=os.environ['RUNNER_TEMP']))\nimages=stage/'images'\nimages.mkdir()\nfiles=[]\ntotal=0\noutput_fd=os.open('output',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)\nsource_fd=os.open('images',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=output_fd)\ntry:\n    with os.scandir(source_fd) as entries:\n        for item in entries:\n            if len(files)>=1000:\n                raise RuntimeError('Complete output collection rejected: more than 1000 entries')\n            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._+-]{0,199}',item.name):\n                raise RuntimeError('Complete output collection rejected: unsupported output filename')\n            info=os.stat(item.name,dir_fd=source_fd,follow_symlinks=False)\n            if not stat.S_ISREG(info.st_mode):\n                raise RuntimeError('Complete output collection rejected: symlink, directory or special output requires a separate transport')\n            if total+info.st_size>limit:\n                raise RuntimeError('Complete output collection rejected: image bytes exceed 1 GiB')\n            fd=os.open(item.name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=source_fd)\n            digest=hashlib.sha256()\n            length=0\n            with os.fdopen(fd,'rb') as source, (images/item.name).open('xb') as destination:\n                before=os.fstat(source.fileno())\n                if (before.st_dev,before.st_ino,before.st_size)!=(info.st_dev,info.st_ino,info.st_size):\n                    raise RuntimeError('Complete output collection rejected: output changed before read')\n                while True:\n                    chunk=source.read(65536)\n                    if not chunk:\n                        break\n                    length+=len(chunk)\n                    if total+length>limit or length>info.st_size:\n                        raise RuntimeError('Complete output collection rejected: output grew beyond bounds')\n                    digest.update(chunk)\n                    destination.write(chunk)\n                after=os.fstat(source.fileno())\n                if length!=info.st_size or (before.st_size,before.st_mtime_ns,before.st_ctime_ns)!=(after.st_size,after.st_mtime_ns,after.st_ctime_ns):\n                    raise RuntimeError('Complete output collection rejected: output changed during read')\n            files.append({'path':'images/'+item.name,'length':length,'sha256':digest.hexdigest()})\n            total+=length\nfinally:\n    os.close(source_fd)\n    os.close(output_fd)\nif not files:\n    raise RuntimeError('Complete output collection unavailable: no image files')\nmanifest={'schemaVersion':1,'operationId':os.environ['OPERATION'],'workflowRevision':os.environ['GITHUB_SHA'],'sourceRevision':os.environ['SOURCE_REVISION'],'files':files}\nmetadata=json.dumps(manifest).encode('utf-8')\nif len(metadata)>1024*1024:\n    raise RuntimeError('Complete output collection rejected: manifest exceeds 1 MiB')\n(stage/'manifest.json').write_bytes(metadata)\nwith open(os.environ['GITHUB_OUTPUT'],'a',encoding='utf-8') as output:\n    output.write('path='+str(stage)+'\\n')\n    output.write('ready=true\\n')\nPY"},
      {name:'Upload complete safe outputs',if:"${{ always() && steps.collect.outputs.ready == 'true' }}",'continue-on-error':true,uses:`actions/upload-artifact@${UPLOAD}`,with:{name:'buildroot-output',path:'${{ steps.collect.outputs.path }}','if-no-files-found':'error','retention-days':7,'include-hidden-files':false,'compression-level':0}}
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
