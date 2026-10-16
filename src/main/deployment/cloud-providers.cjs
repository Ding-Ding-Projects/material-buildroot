"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { hashFile } = require("./artifacts.cjs");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const hmac = (key, value) => crypto.createHmac("sha256", key).update(value).digest();

// Protocol revisions: S3 2006-03-01 with SigV4, Azure 2023-11-03,
// Google Storage JSON v1, GitHub REST 2022-11-28 via the installed gh CLI.
function credentials(profile, vault) {
  let secret;
  try { secret = JSON.parse(vault.read(profile.credentialRef, `cloud_${profile.id}`)); }
  catch { fail("CLOUD_CREDENTIAL_UNAVAILABLE"); }
  if (!secret || typeof secret !== "object") fail("CLOUD_CREDENTIAL_INVALID");
  return secret;
}
function signS3(profile, secret, url, method, headers, sha256) {
  if (!/^[A-Za-z0-9]{8,128}$/.test(secret.accessKeyId || "") || typeof secret.secretAccessKey !== "string") fail("CLOUD_CREDENTIAL_INVALID");
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""), day = stamp.slice(0,8);
  headers.host = url.host; headers["x-amz-date"] = stamp; headers["x-amz-content-sha256"] = sha256;
  if (secret.sessionToken) headers["x-amz-security-token"] = secret.sessionToken;
  const names = Object.keys(headers).sort(), signed = names.join(";");
  const query = [...url.searchParams].map(([k,v]) => [encode(k),encode(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0).map(p=>p.join("=")).join("&");
  const canonical = [method,url.pathname,query,names.map(k=>`${k}:${String(headers[k]).trim()}\n`).join(""),signed,sha256].join("\n");
  const scope = `${day}/${profile.region}/s3/aws4_request`;
  const key = hmac(hmac(hmac(hmac(`AWS4${secret.secretAccessKey}`,day),profile.region),"s3"),"aws4_request");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${secret.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${hmac(key,`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${digest(canonical)}`).toString("hex")}`;
}
async function boundedText(response) {
  let bytes = 0; const parts = [];
  if (!response.body) fail("CLOUD_RESPONSE_MISSING");
  for await (const chunk of response.body) { bytes += chunk.length; if(bytes>1048576) { await response.body.cancel?.().catch(()=>{}); fail("CLOUD_RESPONSE_LIMIT"); } parts.push(chunk); }
  return Buffer.concat(parts).toString("utf8");
}
function provider(profile, secret, signal) {
  async function request(method, url, options = {}) {
    signal.throwIfAborted();
    const headers = { ...options.headers };
    if(profile.provider === "s3") signS3(profile,secret,url,method,headers,options.sha256 || digest(""));
    else { if(typeof secret.accessToken!=="string" || !secret.accessToken || /[\r\n]/.test(secret.accessToken))fail("CLOUD_CREDENTIAL_INVALID"); headers.authorization = `Bearer ${secret.accessToken}`; }
    if(profile.provider === "azure") { headers["x-ms-version"] = "2023-11-03"; headers["x-ms-date"] = new Date().toUTCString(); }
    let response;
    try { response = await fetch(url,{method,headers,body:options.body,duplex:options.body?"half":undefined,redirect:"error",signal}); }
    catch { fail(signal.aborted?"CLOUD_CANCELLED":"CLOUD_NETWORK_UNAVAILABLE"); }
    if(!response.ok) { await response.body?.cancel(); fail(response.status===409||response.status===412?"CLOUD_DESTINATION_EXISTS":response.status===401||response.status===403?"CLOUD_ACCESS_UNAVAILABLE":"CLOUD_PROVIDER_RESPONSE"); }
    return response;
  }
  const objectUrl = key => profile.provider === "s3"
    ? new URL(`/${encode(profile.bucket)}/${key.split("/").map(encode).join("/")}`,profile.endpoint)
    : profile.provider === "azure" ? new URL(`https://${profile.account}.blob.core.windows.net/${profile.container}/${key.split("/").map(encode).join("/")}`)
    : new URL(`https://storage.googleapis.com/storage/v1/b/${encode(profile.bucket)}/o/${encode(key)}`);
  return {
    async privateScope() {
      if(profile.provider === "s3") {
        const url = new URL(`/${encode(profile.bucket)}?publicAccessBlock=`,profile.endpoint);
        const text = await boundedText(await request("GET",url));
        if(!["BlockPublicAcls","IgnorePublicAcls","BlockPublicPolicy","RestrictPublicBuckets"].every(k=>new RegExp(`<${k}>true</${k}>`).test(text)))fail("CLOUD_PRIVATE_SCOPE_REQUIRED");
      } else if(profile.provider === "azure") {
        const response=await request("GET",new URL(`https://${profile.account}.blob.core.windows.net/${profile.container}?restype=container`));
        const publicAccess=response.headers.get("x-ms-blob-public-access"); await response.body?.cancel();
        if(publicAccess) fail("CLOUD_PRIVATE_SCOPE_REQUIRED");
      } else {
        const response=await request("GET",new URL(`https://storage.googleapis.com/storage/v1/b/${encode(profile.bucket)}?fields=iamConfiguration`));
        const bucket=JSON.parse(await boundedText(response));
        if(bucket.iamConfiguration?.publicAccessPrevention!=="enforced")fail("CLOUD_PRIVATE_SCOPE_REQUIRED");
      }
    },
    async put(key,file,sha256,size) {
      const url=objectUrl(key), headers={"content-type":"application/octet-stream","content-length":String(size)};
      let method="PUT";
      if(profile.provider==="gcs") { method="POST";url.pathname=`/upload/storage/v1/b/${encode(profile.bucket)}/o`;url.search=new URLSearchParams({uploadType:"media",name:key,ifGenerationMatch:"0"}).toString(); }
      else { headers["if-none-match"]="*";if(profile.provider==="azure")headers["x-ms-blob-type"]="BlockBlob";else headers["x-amz-checksum-sha256"]=Buffer.from(sha256,"hex").toString("base64"); }
      const stream=fs.createReadStream(file);
      try { const response=await request(method,url,{headers,body:stream,sha256}); await response.body?.cancel(); }
      finally { stream.destroy(); }
    },
    async readback(key,expected,size) {
      const url=objectUrl(key);if(profile.provider==="gcs")url.search="alt=media";
      const response=await request("GET",url);let bytes=0;const hash=crypto.createHash("sha256");
      if(!response.body)fail("CLOUD_READBACK_UNAVAILABLE");
      for await(const chunk of response.body) { bytes+=chunk.length;if(bytes>size)fail("CLOUD_READBACK_SIZE");hash.update(chunk); }
      if(bytes!==size||hash.digest("hex")!==expected)fail("CLOUD_READBACK_CHECKSUM");
      return {sha256:expected,size:bytes};
    },
  };
}
function runGh(executable,args,secret,signal,cwd) {
  if(!path.isAbsolute(executable)||!fs.statSync(executable).isFile())fail("CLOUD_GH_UNAVAILABLE");
  if(typeof secret.accessToken!=="string"||!secret.accessToken||/[\r\n]/.test(secret.accessToken))fail("CLOUD_CREDENTIAL_INVALID");
  return new Promise((resolve,reject)=>{
    // Never inherit ambient cloud credentials, CLI overrides, or debug logging.
    const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,USERPROFILE:process.env.USERPROFILE,HOME:process.env.HOME,TEMP:process.env.TEMP,TMP:process.env.TMP,GH_TOKEN:secret.accessToken,GH_HOST:"github.com",GH_PROMPT_DISABLED:"1",GH_NO_UPDATE_NOTIFIER:"1"};
    const child=spawn(executable,args,{cwd,env,windowsHide:true,shell:false,stdio:["ignore","pipe","ignore"],signal});
    let size=0,parts=[];
    child.stdout.on("data",chunk=>{size+=chunk.length;if(size>1048576){child.kill();return;}parts.push(chunk);});
    child.once("error",()=>reject(Object.assign(new Error("CLOUD_GH_UNAVAILABLE"),{code:"CLOUD_GH_UNAVAILABLE"})));
    child.once("close",code=>code===0&&size<=1048576?resolve(Buffer.concat(parts).toString("utf8")):reject(Object.assign(new Error("CLOUD_GH_OPERATION_FAILED"),{code:"CLOUD_GH_OPERATION_FAILED"})));
  });
}
function github(profile,secret,signal,gh,cwd) {
  const run=args=>runGh(gh,args,secret,signal,cwd);
  return {
    async privateScope(){const repo=JSON.parse(await run(["repo","view",profile.repository,"--json","isPrivate,nameWithOwner"]));if(!repo.isPrivate||repo.nameWithOwner.toLowerCase()!==profile.repository.toLowerCase())fail("CLOUD_PRIVATE_SCOPE_REQUIRED");const release=JSON.parse(await run(["release","view",profile.tag,"--repo",profile.repository,"--json","isDraft,isPrerelease,tagName"]));if(release.isDraft||release.isPrerelease||release.tagName!==profile.tag)fail("CLOUD_NORMAL_RELEASE_REQUIRED");},
    async put(key,file){if(path.basename(file)!==key)fail("CLOUD_ASSET_NAME_MISMATCH");await run(["release","upload",profile.tag,file,"--repo",profile.repository]);},
    async readback(key,expected,size){const directory=fs.mkdtempSync(path.join(cwd,"readback-"));await run(["release","download",profile.tag,"--repo",profile.repository,"--pattern",key,"--dir",directory]);const file=path.join(directory,key);if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size!==size||await hashFile(file)!==expected)fail("CLOUD_READBACK_CHECKSUM");return {sha256:expected,size};},
  };
}
module.exports={credentials,provider,github};
