'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const {createKconfigAdapter}=require('../src/main/configuration/kconfig-adapter.cjs');const {createConfigurationService}=require('../src/main/configuration/index.cjs');
test('vendored Kconfiglib reads real types menus choices dependencies ranges help and config',async t=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'kconfig-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const sourceRoot=path.join(root,'source'),outputRoot=path.join(root,'output');await fs.mkdir(sourceRoot);await fs.mkdir(outputRoot);await fs.writeFile(path.join(sourceRoot,'Config.in'),`mainmenu "Fixture"
menu "Options"
config BR2_ENABLE
 bool "Enable"
 default y
 help
   Enable fixture options.
config BR2_COUNT
 int "Count"
 range 1 8
 default 3
 depends on BR2_ENABLE
config BR2_TEXT
 string "Text"
 default "default"
choice
 prompt "Mode"
 default BR2_MODE_A
config BR2_MODE_A
 bool "Mode A"
config BR2_MODE_B
 bool "Mode B"
endchoice
endmenu
`);await fs.writeFile(path.join(outputRoot,'.config'),'BR2_ENABLE=y\nBR2_COUNT=6\nBR2_TEXT="loaded"\nBR2_MODE_B=y\n');const semanticAdapter=createKconfigAdapter({pythonExecutable:require('./helpers/host-tools.cjs').hostTool('python3'),admitted:true});const service=createConfigurationService({resolveWorkspace:async()=>({granted:true,sourceRoot,outputRoot}),executor:async()=>({ok:true}),semanticAdapter});const result=await service.inspect({workspaceId:'fixture'});assert.equal(result.semantics.available,true,JSON.stringify(result.semantics));const flat=[];function visit(n){flat.push(n);for(const c of n.children)visit(c);}visit(result.semantics.tree);const count=flat.find(x=>x.symbol==='BR2_COUNT');assert.equal(count.type,'int');assert.equal(count.value,'6');assert.equal(count.ranges[0].max,'8');assert.match(count.dependency,/BR2_ENABLE/);assert.equal(flat.find(x=>x.symbol==='BR2_TEXT').value,'loaded');assert.match(flat.find(x=>x.symbol==='BR2_ENABLE').help,/Enable fixture/);assert.equal(flat.find(x=>x.kind==='choice').selection,'BR2_MODE_B');assert.ok(flat.some(x=>x.kind==='menu'&&x.prompt==='Options'));});
test('Python admission is mandatory',()=>{assert.throws(()=>createKconfigAdapter({pythonExecutable:require('./helpers/host-tools.cjs').hostTool('python3')}),{code:'PYTHON_NOT_ADMITTED'});});
test('Kconfig helper rejects ungranted includes and shell expansion',async t=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'kconfig-security-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const sourceRoot=path.join(root,'source'),outputRoot=path.join(root,'output');await fs.mkdir(sourceRoot);await fs.mkdir(outputRoot);const outside=path.join(root,'Outside');await fs.writeFile(outside,'config OUTSIDE\n bool "Outside"\n');const adapter=createKconfigAdapter({pythonExecutable:require('./helpers/host-tools.cjs').hostTool('python3'),admitted:true});await fs.writeFile(path.join(sourceRoot,'Config.in'),`source "${outside}"\n`);await assert.rejects(adapter({sourceRoot,outputRoot}),{code:'KCONFIG_HELPER_FAILED'});await fs.writeFile(path.join(sourceRoot,'Config.in'),'mainmenu "$(shell,echo forbidden)"\n');await assert.rejects(adapter({sourceRoot,outputRoot}),{code:'KCONFIG_HELPER_FAILED'});});
test('available Kconfig schema rejects invented symbols and mismatched types before execution',async t=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'kconfig-schema-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const sourceRoot=path.join(root,'source'),outputRoot=path.join(root,'output');await fs.mkdir(sourceRoot);await fs.mkdir(outputRoot);await fs.writeFile(path.join(sourceRoot,'Config.in'),'config BR2_FLAG\n bool "Flag"\n');await fs.writeFile(path.join(outputRoot,'.config'),'BR2_FLAG=y\n');let calls=0;const service=createConfigurationService({resolveWorkspace:async()=>({granted:true,sourceRoot,outputRoot}),semanticAdapter:createKconfigAdapter({pythonExecutable:require('./helpers/host-tools.cjs').hostTool('python3'),admitted:true}),executor:async()=>{calls++;return {ok:true};}});const {revision}=await service.inspect({workspaceId:'fixture'});await assert.rejects(service.apply({workspaceId:'fixture',revision,changes:{BR2_INVENTED:{type:'bool',value:true}}}),{code:'UNKNOWN_SYMBOL'});await assert.rejects(service.apply({workspaceId:'fixture',revision,changes:{BR2_FLAG:{type:'string',value:'bad'}}}),{code:'SYMBOL_TYPE_MISMATCH'});assert.equal(calls,0);});

test("helper resolution uses physical unpacked archive directory and exact path components", async (t) => {
  const { resolveConfigurationScripts } = require("../src/main/configuration/kconfig-adapter.cjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kconfig-packaging-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  async function helperAt(base) {
    const scripts = path.join(base, "scripts", "configuration");
    await fs.mkdir(scripts, { recursive: true });
    const helper = path.join(scripts, "inspect.py");
    await fs.writeFile(helper, "# physical fixture\n");
    return helper;
  }
  const checkout = path.join(root, "checkout");
  assert.equal((await resolveConfigurationScripts(checkout).catch((error) => error)).code, "KCONFIG_HELPER_UNAVAILABLE");
  const checkoutHelper = await helperAt(checkout);
  assert.equal((await resolveConfigurationScripts(checkout)).helper, checkoutHelper);
  const archive = path.join(root, "resources", "app.asar");
  const physical = path.join(root, "resources", "app.asar.unpacked");
  const physicalHelper = await helperAt(physical);
  assert.equal((await resolveConfigurationScripts(archive)).helper, physicalHelper);
  const similarlyNamed = path.join(root, "app.asar.backup");
  const similarHelper = await helperAt(similarlyNamed);
  assert.equal((await resolveConfigurationScripts(similarlyNamed)).helper, similarHelper);
  await fs.rm(physicalHelper);
  await assert.rejects(resolveConfigurationScripts(archive), { code: "KCONFIG_HELPER_UNAVAILABLE" });
});
