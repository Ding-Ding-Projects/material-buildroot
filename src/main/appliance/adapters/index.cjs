'use strict';

/** Origins are local metadata. Compatibility comes from pinned source shape. */
function repositoryFromOrigin(origin) {
  if(typeof origin!=='string'||origin.length>512||/[\x00-\x20\x7f]/.test(origin))return null;
  const match=/^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]{1,100}?)(?:\.git)?$/.exec(origin);
  if(!match||['.','..'].includes(match[2]))return null;
  return match[1]+'/'+match[2];
}
function projectName(text) {
  if(typeof text!=='string'||text.length>131072)return null;
  const section=/(?:^|\n)\[project\]([^]*?)(?=\n\[|$)/.exec(text);
  return section&&/(?:^|\n)name\s*=\s*["']([^"']+)["']/.exec(section[1])?.[1]||null;
}
function adapterForSource(origin, shape) {
  if(!repositoryFromOrigin(origin)||!shape||!(shape.paths instanceof Set))return null;
  const has=(...names)=>names.every(name=>shape.paths.has(name));
  const backend=projectName(shape.backendProject);
  const rootProject=projectName(shape.rootProject);
  let packageName;try{packageName=JSON.parse(shape.packageJson||'null')?.name;}catch{return null;}
  const matches=[];
  if(backend==='job-2027-backend'&&has('backend/src/job_backend/main.py','frontend/package.json','frontend/package-lock.json')) {
    if(has('build.bat','scripts/hosting.py'))matches.push({adapter:'job-2027-fork',role:'primary'});
    else if(!shape.paths.has('build.bat')&&!shape.paths.has('scripts/hosting.py'))matches.push({adapter:'job-2027-upstream',role:'primary'});
  }
  if(rootProject==='homeassistant'&&has('homeassistant/__init__.py','homeassistant/components/frontend/manifest.json','homeassistant/package_constraints.txt','requirements.txt'))matches.push({adapter:'home-assistant-material',role:'core'});
  // One repository carrying both: Core under core/, the Material frontend under frontend/, versions in versions.json.
  if(projectName(shape.coreProject)==='homeassistant'&&has('versions.json','core/Dockerfile','core/requirements.txt','core/requirements_all.txt','core/homeassistant/__init__.py','core/homeassistant/package_constraints.txt','core/homeassistant/components/frontend/manifest.json','frontend/package.json','frontend/pnpm-lock.yaml','frontend/pyproject.toml','frontend/gulpfile.js'))matches.push({adapter:'home-assistant-material',role:'repository'});
  if((rootProject==='home-assistant-frontend'||packageName==='home-assistant-frontend')&&has('pyproject.toml','package.json','yarn.lock','script/build_frontend','.yarn/releases/yarn-4.18.0.cjs')&&/^version\s*=\s*"([0-9.]+)"/m.test(shape.rootProject||''))matches.push({adapter:'home-assistant-material',role:'frontend'});
  return matches.length===1?{...matches[0],shapeTrusted:false,requiresExecutionConsent:true}:null;
}
function sourceRequirements(adapter,role) {
  if(adapter==='home-assistant-material'&&role==='repository')return {primary:'repository',companion:null,mode:'core-container',limitations:['NO_SUPERVISOR_OR_HAOS']};
  if(adapter==='home-assistant-material')return {primary:'core',companion:'frontend',mode:'core-container',limitations:['NO_SUPERVISOR_OR_HAOS','CUSTOM_FRONTEND_RUNTIME_COMPATIBILITY_REQUIRES_VERIFICATION']};
  if(['job-2027-fork','job-2027-upstream'].includes(adapter))return {primary:'primary',companion:null,mode:'api-frontend-postgres',limitations:['SCRAPING_WORKER_DISABLED','PAID_AI_NOT_CONFIGURED','FRESH_DATA_ONLY']};
  throw Object.assign(new Error('APPLIANCE_ADAPTER_UNAVAILABLE'),{code:'APPLIANCE_ADAPTER_UNAVAILABLE'});
}
module.exports={repositoryFromOrigin,adapterForSource,sourceRequirements};
