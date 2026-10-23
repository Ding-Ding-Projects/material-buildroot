"use strict";
const {parse}=require('../security/workspace-contract.cjs');
const STAGES=new Set(['preparing','source','configuring','building','packaging']);
const TOOLS=new Set(['docker','python3','curl','tar','make','producer']);
const CODES=new Set(['BUILD_STEP_FAILED','PRODUCER_INTERNAL_FAILED','SPEC_INVALID','IO_FAILED','GUEST_ASSETS_UNAVAILABLE','ARCHIVE_FORMAT_UNSUPPORTED','ARCHIVE_INVALID','SOURCE_IDENTITY_MISMATCH','SAVED_IMAGE_IDENTITY_MISMATCH','PREPARED_BUNDLE_INVALID','CONFIG_INVALID','DOCKER_DAEMON_UNAVAILABLE','REGISTRY_AUTH_REQUIRED','REGISTRY_TLS_FAILED','REGISTRY_NETWORK_FAILED','DOCKER_PULL_FAILED','DOCKER_INSPECT_FAILED','DOCKER_SAVE_FAILED','DOCKER_LOAD_FAILED','DOCKER_COMPOSE_FAILED','DOCKER_TAG_FAILED']);
function validateFailure(value) {
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='code,exitCode,schemaVersion,stage,tool'||value.schemaVersion!==1||!STAGES.has(value.stage)||!TOOLS.has(value.tool)||!CODES.has(value.code)||(value.exitCode!==null&&(!Number.isInteger(value.exitCode)||value.exitCode < -255||value.exitCode > 255)))return null;
  return {schemaVersion:1,stage:value.stage,code:value.code,tool:value.tool,exitCode:value.exitCode};
}
function parseFailure(bytes) {
  if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>1024)return null;
  try{return validateFailure(parse(bytes.toString('utf8')));}catch{return null;}
}
module.exports={validateFailure,parseFailure};
