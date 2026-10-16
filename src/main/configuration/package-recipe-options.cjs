"use strict";
const fail = (code) => { throw Object.assign(new Error(code), {code}); };
const stages = ["PRE_CONFIGURE", "POST_CONFIGURE", "PRE_BUILD", "POST_BUILD", "POST_INSTALL_TARGET"];
function relative(value) {
  if(typeof value !== "string" || value.length > 1024 || !/^[A-Za-z0-9_.+/-]+$/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('-'))) fail("INVALID_RECIPE_PATH");
  return value;
}
function items(value) { if(!Array.isArray(value) || value.length > 64) fail("INVALID_RECIPE_LIST"); return value; }
function validateOptions(model) {
  for(const patch of items(model.patches || [])) {
    if(typeof patch !== 'string' || !/^https:\/\/[A-Za-z0-9._~:/%+=-]+$/.test(patch) || patch.length > 4096) fail('INVALID_PATCH_URL');
    const url = new URL(patch); if(!url.hostname || url.username || url.password) fail('INVALID_PATCH_URL');
  }
  for(const option of items(model.buildOptions || [])) if(typeof option !== 'string' || !/^[A-Za-z0-9_./:+,=@%-]{1,512}$/.test(option)) fail('INVALID_BUILD_OPTION');
  if((model.buildOptions || []).length && !['autotools','cmake','meson'].includes(model.buildSystem)) fail('UNSUPPORTED_BUILD_OPTIONS');
  const destinations = new Set();
  for(const overlay of items(model.overlays || [])) {
    if(!overlay || Object.keys(overlay).some(k=>!['source','destination','mode'].includes(k))) fail('INVALID_OVERLAY');
    relative(overlay.source); relative(overlay.destination);
    if(!/^[0-7]{3}$/.test(overlay.mode)) fail('INVALID_OVERLAY_MODE');
    if(destinations.has(overlay.destination)) fail('DUPLICATE_OVERLAY_DESTINATION'); destinations.add(overlay.destination);
  }
  for(const hook of items(model.hooks || [])) {
    if(!hook || Object.keys(hook).some(k=>!['stage','operation','source','destination','mode'].includes(k)) || !stages.includes(hook.stage) || !['copy','mkdir'].includes(hook.operation)) fail('INVALID_PACKAGE_HOOK');
    relative(hook.destination); if(hook.operation === 'copy') relative(hook.source);
    if(!/^[0-7]{3}$/.test(hook.mode)) fail('INVALID_HOOK_MODE');
  }
}
function renderOptions(model, prefix, externalName) {
  validateOptions(model);
  const lines = [];
  if(model.patches?.length) lines.push(`${prefix}_PATCH = ${model.patches.join(' ')}`);
  if(model.buildOptions?.length) lines.push(`${prefix}_CONF_OPTS = ${model.buildOptions.join(' ')}`);
  for(const [i,hook] of (model.hooks || []).entries()) {
    const name = `${prefix}_EDITOR_HOOK_${i + 1}`;
    const target = hook.stage === 'POST_INSTALL_TARGET' ? '$(TARGET_DIR)' : '$(@D)';
    lines.push('',`define ${name}`,hook.operation === 'mkdir' ? `\t$(INSTALL) -d -m ${hook.mode} ${target}/${hook.destination}` : `\t$(INSTALL) -D -m ${hook.mode} $(@D)/${hook.source} ${target}/${hook.destination}`,'endef',`${prefix}_${hook.stage}_HOOKS += ${name}`);
  }
  if(model.overlays?.length) {
    const name = `${prefix}_EDITOR_OVERLAYS`;
    lines.push('',`define ${name}`,...model.overlays.map(o=>`\t$(INSTALL) -D -m ${o.mode} $(BR2_EXTERNAL_${externalName}_PATH)/${o.source} $(TARGET_DIR)/${o.destination}`),'endef',`${prefix}_POST_INSTALL_TARGET_HOOKS += ${name}`);
  }
  return lines;
}
module.exports = {validateOptions,renderOptions,stages};
