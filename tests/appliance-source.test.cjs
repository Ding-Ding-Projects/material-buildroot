"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspectComposeInput}=require('../src/main/appliance/compose-input.cjs');
const {createWslRuntime}=require('../src/main/execution/wsl-runtime.cjs');
test('Compose admission reads only one self-contained manifest and retains explicit literal configuration',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-compose-test-'));
 try{
  for(const folder of ['.git','node_modules','.hosting','data']){fs.mkdirSync(path.join(root,folder));fs.writeFileSync(path.join(root,folder,'excluded.txt'),'never include this local state');}
  fs.writeFileSync(path.join(root,'.env'),'LOCAL_CONFIGURATION=excluded');
  fs.writeFileSync(path.join(root,'compose.yaml'),'services:\n  web:\n    image: nginx:alpine\n    environment:\n      APP_MODE: production\n');
  const admitted=inspectComposeInput(root);assert.equal(admitted.name,'compose.yaml');assert.deepEqual(admitted.services[0].environment,{APP_MODE:'production'});assert.equal(admitted.bytes.toString().includes('excluded'),false);
  for(const fragment of ['    build: .\n','    env_file: .env\n','    extends: other.yaml\n','    volumes:\n      - ./.hosting:/data\n']){fs.writeFileSync(path.join(root,'compose.yaml'),'services:\n  web:\n    image: nginx:alpine\n'+fragment);assert.throws(()=>inspectComposeInput(root),{code:'APPLIANCE_COMPOSE_PREPARATION_REQUIRED'});}
  fs.writeFileSync(path.join(root,'compose.yaml'),'services:\n  web:\n    image: "${IMAGE}"\n');assert.throws(()=>inspectComposeInput(root),{code:'APPLIANCE_COMPOSE_PREPARATION_REQUIRED'});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
function runtimeFixture(managed){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-wsl-test-')),calls=[];
 if(managed)fs.writeFileSync(path.join(directory,'wsl-managed.json'),JSON.stringify([{name:'ManagedUbuntu',location:path.join(directory,'owned'),state:'ready'}]));
 const runtime=createWslRuntime({directory,platform:'win32',dialog:{showMessageBox:async()=>({response:1})},run:async args=>{calls.push(args);if(args[0]==='--list')return {state:'succeeded',stdout:'ManagedUbuntu Running 2\n'};if(args.some(value=>typeof value==='string'&&value.includes('printf \'USER=')))return {state:'succeeded',stdout:'USER=materialbuilder\nHOME=/home/materialbuilder\nOS=ubuntu\nFREE=100000000\n'};return {state:'succeeded',stdout:''};}});
 return {runtime,calls,directory};
}
test('appliance prerequisites configure Docker only in an app-managed distribution',async()=>{
 const f=runtimeFixture(true);try{const result=await f.runtime.perform('appliancePrerequisites','ManagedUbuntu');assert.equal(result.state,'ready');const install=f.calls.find(args=>args.includes('docker.io'));assert.ok(install);assert.ok(install.includes('docker-compose-v2'));assert.ok(install.includes('docker-buildx'));assert.ok(install.includes('libssl-dev'));assert.ok(f.calls.some(args=>args.some(value=>typeof value==='string'&&value.includes('usermod -aG docker materialbuilder'))));assert.equal(f.calls.some(args=>args.includes('--set-default-user')),false);}finally{fs.rmSync(f.directory,{recursive:true,force:true});}
 const external=runtimeFixture(false);try{const result=await external.runtime.perform('appliancePrerequisites','ManagedUbuntu');assert.equal(result.state,'managed-appliance-distribution-required');assert.equal(external.calls.some(args=>args.includes('--user')),false);}finally{fs.rmSync(external.directory,{recursive:true,force:true});}
});
test('managed package setup retains safe termination evidence with a larger bounded output budget',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'appliance-wsl-diagnostic-')),calls=[];fs.writeFileSync(path.join(directory,'wsl-managed.json'),JSON.stringify([{name:'ManagedUbuntu',location:path.join(directory,'owned'),state:'ready'}]));
 const runtime=createWslRuntime({directory,platform:'win32',dialog:{showMessageBox:async()=>({response:1})},run:async(args,options)=>{calls.push({args,options});if(args[0]==='--list')return {state:'succeeded',stdout:'ManagedUbuntu Running 2\n'};if(args.some(value=>typeof value==='string'&&value.includes("printf 'USER=")))return {state:'succeeded',stdout:'USER=materialbuilder\nHOME=/home/materialbuilder\nOS=ubuntu\nFREE=100000000\n'};if(args.includes('docker.io'))return {state:'output-limit',code:137,stdout:'sensitive output must not appear',stderr:'private apt output'};return {state:'succeeded',code:0,stdout:''};}});
 try {const result=await runtime.perform('appliancePrerequisites','ManagedUbuntu');assert.equal(result.state,'prerequisite-install-incomplete');const install=calls.find(row=>row.args.includes('docker.io'));assert.equal(install.options.maxBytes,16*1024*1024);assert.equal(install.options.maxCapturedCharacters,8192);const recover=calls.findIndex(row=>row.args.some(value=>typeof value==='string'&&value.includes('dpkg --configure -a')));assert.ok(recover>=0&&recover<calls.indexOf(install));assert.deepEqual(result.setupDiagnostics.steps.at(-1),{stage:'install-packages',processState:'output-limit',exitCode:137,reason:'OUTPUT_LIMIT'});assert.equal(JSON.stringify(result).includes('sensitive output'),false);assert.equal(fs.readFileSync(path.join(directory,'wsl-managed.json'),'utf8').includes('private apt output'),false);assert.equal((await runtime.perform('inspect','ManagedUbuntu')).setupDiagnostics.steps.at(-1).reason,'OUTPUT_LIMIT');}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
