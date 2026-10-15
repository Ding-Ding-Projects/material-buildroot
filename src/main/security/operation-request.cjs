'use strict';
const {TextDecoder}=require('node:util');
const {createHash}=require('node:crypto');
const {visit}=require('jsonc-parser');
const Ajv2020=require('ajv/dist/2020');
const schema=require('../../shared/operation-request.schema.json');
const MAX_BYTES=65536, MAX_DEPTH=8, MAX_VALUES=2048;
const forbiddenKeys=new Set(['__proto__','prototype','constructor']);
const validate=new Ajv2020({strict:true,strictRequired:false,allErrors:false,coerceTypes:false,useDefaults:false,removeAdditional:false,ownProperties:true}).compile(schema);

class RequestValidationError extends Error {
  constructor(code){super('The operation request is not valid.');this.name='RequestValidationError';this.code=code;}
}
function reject(code){throw new RequestValidationError(code);}
function decode(input){
  if(typeof input==='string'){
    if(input.length>MAX_BYTES||Buffer.byteLength(input,'utf8')>MAX_BYTES)reject('REQUEST_TOO_LARGE');
    if(!input.isWellFormed())reject('REQUEST_ENCODING');
    return input;
  }
  if(!(input instanceof Uint8Array))reject('REQUEST_TYPE');
  if(input.byteLength>MAX_BYTES)reject('REQUEST_TOO_LARGE');
  try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(input);}
  catch{reject('REQUEST_ENCODING');}
}
function inspectJson(text){
  const containers=[];let values=0;
  function enter(container){if(++values>MAX_VALUES)reject('REQUEST_COMPLEXITY');containers.push(container);if(containers.length>MAX_DEPTH)reject('REQUEST_DEPTH');}
  visit(text,{
    onObjectBegin(){enter(new Set());},onArrayBegin(){enter(null);},onObjectEnd(){containers.pop();},onArrayEnd(){containers.pop();},
    onObjectProperty(key){
      const properties=containers.at(-1);
      if(!(properties instanceof Set))reject('REQUEST_SYNTAX');
      if(!key.isWellFormed())reject('REQUEST_ENCODING');
      if(forbiddenKeys.has(key))reject('REQUEST_UNSAFE_KEY');
      if(properties.has(key))reject('REQUEST_DUPLICATE_KEY');
      properties.add(key);if(++values>MAX_VALUES)reject('REQUEST_COMPLEXITY');
    },
    onLiteralValue(value,offset,length){
      if(++values>MAX_VALUES)reject('REQUEST_COMPLEXITY');
      if(typeof value==='number'&&(!/^(?:0|-?[1-9][0-9]*)$/.test(text.slice(offset,offset+length))||!Number.isSafeInteger(value)))reject('REQUEST_NUMBER');
      if(typeof value==='string'&&!value.isWellFormed())reject('REQUEST_ENCODING');
    },
    onError(){reject('REQUEST_SYNTAX');},
  },{disallowComments:true,allowTrailingComma:false,allowEmptyContent:false});
}
function canonicalJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
/** Parse untrusted serialized input. This grants no filesystem or execution authority. */
function parseOperationRequest(input){
  const text=decode(input);inspectJson(text);let request;
  try{request=JSON.parse(text);}catch{reject('REQUEST_SYNTAX');}
  if(!validate(request))reject('REQUEST_SCHEMA');
  const digest=createHash('sha256').update(canonicalJson(request),'utf8').digest('hex');
  return Object.freeze({request:freeze(request),digest});
}
module.exports={parseOperationRequest,RequestValidationError,MAX_BYTES,MAX_DEPTH,MAX_VALUES};
