"use strict";
const fs = require("node:fs/promises");
const { constants: fileFlags } = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { setTimeout: pause } = require("node:timers/promises");
const { fail } = require("./runtime.cjs");
const ORIGIN = "https://ollama.com";
const START = ORIGIN + "/library?sort=alphabetical";
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const TAG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/gi, entity => {
    const name = entity.slice(1, -1).toLowerCase();
    if (name.startsWith("#")) {
      const point = parseInt(name.slice(name[1] === "x" ? 2 : 1), name[1] === "x" ? 16 : 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : "�";
    }
    return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " }[name];
  });
}
const plain = value => decode(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
function htmlTokens(html) {
  const anchors = [];
  let cursor = 0, anchor = null, title = null, closed = false, templates = 0;
  while (cursor < html.length) {
    const begin = html.indexOf("<", cursor);
    if (anchor && templates === 0) {
      const text = html.slice(cursor, begin < 0 ? html.length : begin);
      anchor.text.push(text);
      if(anchor.monoDepth)anchor.mono.push(text);
    }
    if (begin < 0) break;
    if (html.startsWith("<!--", begin)) {
      const end = html.indexOf("-->", begin + 4);
      if (end < 0) fail("CATALOGUE_HTML_INCOMPLETE");
      cursor = end + 3;
      continue;
    }
    const head = /^<(\/)?([A-Za-z][A-Za-z0-9:-]*)/.exec(html.slice(begin));
    if (!head) {
      if (/^<!doctype\b/i.test(html.slice(begin))) {
        const end = html.indexOf(">", begin + 2);
        if (end < 0) fail("CATALOGUE_HTML_INCOMPLETE");
        cursor = end + 1;
      } else if (/^<[!?]/.test(html.slice(begin))) fail("CATALOGUE_HTML_UNSUPPORTED");
      else cursor = begin + 1;
      continue;
    }
    const closing = !!head[1], name = head[2].toLowerCase();
    const attributes = Object.create(null);
    let position = begin + head[0].length, ended = false;
    while (position < html.length) {
      while (/\s/.test(html[position] || "") && position < html.length) position++;
      if (html[position] === ">") { position++; ended = true; break; }
      if (html[position] === "/" && html[position + 1] === ">") { position += 2; ended = true; break; }
      if (closing) fail("CATALOGUE_HTML_UNSUPPORTED");
      const key = /^[^\s=\/>"'<`]+/.exec(html.slice(position));
      if (!key) fail("CATALOGUE_HTML_UNSUPPORTED");
      position += key[0].length;
      while (/\s/.test(html[position] || "") && position < html.length) position++;
      let value = "";
      if (html[position] === "=") {
        position++;
        while (/\s/.test(html[position] || "") && position < html.length) position++;
        if (html[position] === '"' || html[position] === "'") {
          const quote = html[position++], end = html.indexOf(quote, position);
          if (end < 0) fail("CATALOGUE_HTML_INCOMPLETE");
          value = html.slice(position, end); position = end + 1;
        } else {
          const unquoted = /^[^\s>"'<=`]+/.exec(html.slice(position));
          if (!unquoted) fail("CATALOGUE_HTML_UNSUPPORTED");
          value = unquoted[0]; position += value.length;
        }
      }
      const normalized = key[0].toLowerCase();
      if (Object.hasOwn(attributes, normalized)) fail("CATALOGUE_HTML_DUPLICATE_ATTRIBUTE");
      attributes[normalized] = decode(value);
    }
    if (!ended) fail("CATALOGUE_HTML_INCOMPLETE");
    cursor = position;
    if (name === "template") {
      templates += closing ? -1 : 1;
      if (templates < 0) fail("CATALOGUE_HTML_INCOMPLETE");
      continue;
    }
    if (!closing && ["script", "style", "textarea", "title", "iframe", "xmp", "noembed", "noframes", "noscript"].includes(name)) {
      const terminator = new RegExp("</" + name + "\\s*>", "ig");
      terminator.lastIndex = cursor;
      const end = terminator.exec(html);
      if (!end) fail("CATALOGUE_HTML_INCOMPLETE");
      if (name === "title" && templates === 0) {
        if (title !== null) fail("CATALOGUE_SOURCE_SHAPE_CHANGED");
        title = decode(html.slice(cursor, end.index)).replace(/\s+/g, " ").trim();
      }
      cursor = terminator.lastIndex;
      continue;
    }
    if (name === "plaintext") fail("CATALOGUE_HTML_UNSUPPORTED");
    if (templates) continue;
    if (!closing && /(?:revealed|intersect)/i.test(attributes["hx-trigger"] || "")) fail("CATALOGUE_DYNAMIC_PAGINATION_UNSUPPORTED");
    if(anchor&&name==="span") {
      if(!closing){
        if(anchor.monoDepth)anchor.monoDepth++;
        else if((attributes.class||"").split(/\s+/).includes("font-mono")){anchor.monoDepth=1;anchor.mono=[];}
      }else if(anchor.monoDepth&&!--anchor.monoDepth){
        const digest=plain(anchor.mono.join(" "));
        if(/^[a-f0-9]{12,64}$/.test(digest))anchor.digestDisplay=digest;
      }
    }
    if (name === "a") {
      if (!closing) {
        if (anchor) fail("CATALOGUE_HTML_NESTED_ANCHOR");
        anchor = { attributes, text: [], mono: [], monoDepth: 0, digestDisplay: null };
      } else if (anchor) {
        anchors.push({ attributes: anchor.attributes, inner: anchor.text.join(" "), digestDisplay: anchor.digestDisplay });
        anchor = null;
      }
    }
    if (closing && name === "html") closed = true;
  }
  if (!closed || templates || anchor) fail("CATALOGUE_HTML_INCOMPLETE");
  return { anchors, title };
}
function pageUrl(value, base = START) {
  let url;
  try { url = new URL(value, base); } catch { fail("CATALOGUE_SOURCE_URL_REJECTED"); }
  if (url.origin !== ORIGIN || url.username || url.password || url.hash || !/^\/library(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/tags)?$/.test(url.pathname)) fail("CATALOGUE_SOURCE_URL_REJECTED");
  for (const [key, item] of url.searchParams) {
    if (key === "sort" && item === "alphabetical") continue;
    if (["page", "p"].includes(key) && /^[1-9][0-9]{0,5}$/.test(item)) continue;
    if (key === "cursor" && /^[A-Za-z0-9_-]{1,256}$/.test(item)) continue;
    fail("CATALOGUE_PAGINATION_UNSUPPORTED");
  }
  return url.href;
}
function parsePage(html, source, family = null) {
  if (typeof html !== "string" || Buffer.byteLength(html, "utf8") > 8 * 1024 * 1024) fail("CATALOGUE_HTML_INCOMPLETE");
  const tokens = htmlTokens(html);
  if (!tokens.title || (family ? !tokens.title.includes(family) || !/^Tags\b/.test(tokens.title) : tokens.title.toLowerCase() !== "library")) fail("CATALOGUE_SOURCE_SHAPE_CHANGED");
  const families = new Set(), variants = new Map(), next = new Set();
  for (const link of tokens.anchors) {
    const href = link.attributes.href;
    if (!href) continue;
    let url;
    try { url = new URL(href, source); } catch { continue; }
    const rel = link.attributes.rel || "";
    const pagination = /\bnext\b/i.test(rel) || [...url.searchParams.keys()].some(key => ["page", "p", "cursor"].includes(key));
    if (pagination) {
      const admitted = pageUrl(href, source);
      if (new URL(admitted).pathname !== new URL(source).pathname) fail("CATALOGUE_PAGINATION_SCOPE_CHANGED");
      if (/\bnext\b/i.test(rel) || !/\b(prev|previous)\b/i.test(rel) && !/^(previous|prev|back)$/i.test(plain(link.inner))) next.add(admitted);
      continue;
    }
    if (url.origin !== ORIGIN || url.search || url.hash) continue;
    if(!family&&url.pathname.startsWith("/library/")&&!url.pathname.slice(9).includes("/")&&!url.pathname.includes(":" )&&!FAMILY.test(url.pathname.slice(9)))fail("CATALOGUE_FAMILY_SHAPE_UNSUPPORTED");
    if(family&&url.pathname.startsWith("/library/"+family+":" )&&!TAG.test(url.pathname.split(":").slice(1).join(":")))fail("CATALOGUE_TAG_SHAPE_UNSUPPORTED");
    const name = url.pathname.match(/^\/library\/([A-Za-z0-9][A-Za-z0-9._-]{0,99})$/);
    if (!family && name) families.add(name[1]);
    const variant = url.pathname.match(/^\/library\/([A-Za-z0-9][A-Za-z0-9._-]{0,99}):([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/);
    if (!family || !variant || variant[1] !== family) continue;
    const text = plain(link.inner).replace(family + ":" + variant[2], "");
    const item = { model: family + ":" + variant[2], family, tag: variant[2], sourceUrl: url.href, sizeDisplay: text.match(/\b\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB)\b/)?.[0] || null, contextDisplay: text.match(/\b(\d+(?:\.\d+)?[KM]?)\s+context window\b/i)?.[1] || null, inputDisplay: text.match(/\b((?:Text|Image|Audio|Video)(?:\s*[,/]\s*(?:Text|Image|Audio|Video))*)\s+input\b/i)?.[1] || null, digestDisplay: link.digestDisplay, sizeBytes: null, contextTokens: null, capabilities: null, quantization: null, license: null, fit: "Unknown" };
    if (!variants.has(item.model) || item.sizeDisplay || item.contextDisplay) variants.set(item.model, item);
  }
  if (family ? !variants.size : !families.size) fail("CATALOGUE_SOURCE_EMPTY_OR_CHANGED");
  return { families: [...families], variants: [...variants.values()], next: [...next] };
}
function validateSnapshot(snapshot) {
  if(!snapshot||!Array.isArray(snapshot.families)||!snapshot.families.length||snapshot.families.length>5000||!snapshot.families.every(name=>typeof name==="string"&&FAMILY.test(name))||!Array.isArray(snapshot.variants)||!snapshot.variants.length||snapshot.variants.length>100000||!Array.isArray(snapshot.sources)||!snapshot.sources.length||snapshot.sources.length>10000||snapshot.completeness?.exhaustive!==false||snapshot.completeness?.traversal!=="complete-observed-official-source"||!Number.isFinite(Date.parse(snapshot.startedAt))||!Number.isFinite(Date.parse(snapshot.completedAt))||Date.parse(snapshot.completedAt)>Date.now()+300000)fail("CATALOGUE_CACHE_INVALID");
  const families=new Set(snapshot.families),seen=new Set();
  for(const item of snapshot.variants){
    if(!item||!FAMILY.test(item.family)||!TAG.test(item.tag)||!families.has(item.family)||item.model!==item.family+":"+item.tag||seen.has(item.model)||item.sourceUrl!==ORIGIN+"/library/"+item.model||item.sizeBytes!==null||item.contextTokens!==null||item.capabilities!==null||item.quantization!==null||item.license!==null||item.fit!=="Unknown")fail("CATALOGUE_CACHE_INVALID");
    seen.add(item.model);
    for(const key of ["sizeDisplay","contextDisplay","inputDisplay","digestDisplay"])if(item[key]!==null&&(typeof item[key]!=="string"||item[key].length>256||/[\x00-\x1f]/.test(item[key])))fail("CATALOGUE_CACHE_INVALID");
  }
  for(const source of snapshot.sources){if(!source||pageUrl(source.url)!==source.url||!/^[a-f0-9]{64}$/.test(source.sha256)||!Number.isSafeInteger(source.bytes)||source.bytes<1||source.bytes>8*1024*1024||!Number.isFinite(Date.parse(source.observedAt)))fail("CATALOGUE_CACHE_INVALID");}
}
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
function sameFile(before, after) {
  return ["dev","ino","size","mtimeNs","ctimeNs"].every(key=>before[key]===after[key]);
}
async function readCacheBytes(directory, file) {
  const root = await fs.lstat(directory, {bigint:true});
  if(!root.isDirectory()||root.isSymbolicLink())fail("CATALOGUE_STORAGE_UNAVAILABLE");
  const before = await fs.lstat(file, {bigint:true});
  if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size>BigInt(CACHE_MAX_BYTES))fail("CATALOGUE_CACHE_INVALID");
  let handle;
  try {
    handle=await fs.open(file,fileFlags.O_RDONLY|(fileFlags.O_NOFOLLOW||0)|(fileFlags.O_NONBLOCK||0));
    const opened=await handle.stat({bigint:true});
    if(!opened.isFile()||opened.nlink!==1n||!sameFile(before,opened))fail("CATALOGUE_CACHE_CHANGED");
    const length=Number(opened.size),chunks=[];
    let position=0;
    while(position<length){
      const chunk=Buffer.alloc(Math.min(65536,length-position));
      const result=await handle.read(chunk,0,chunk.length,position);
      if(!result.bytesRead)fail("CATALOGUE_CACHE_CHANGED");
      position+=result.bytesRead;chunks.push(chunk.subarray(0,result.bytesRead));
    }
    const extra=await handle.read(Buffer.alloc(1),0,1,position);
    const after=await handle.stat({bigint:true});
    const named=await fs.lstat(file,{bigint:true});
    const rootAfter=await fs.lstat(directory,{bigint:true});
    if(extra.bytesRead||!sameFile(opened,after)||!sameFile(after,named)||named.isSymbolicLink()||named.nlink!==1n||rootAfter.isSymbolicLink()||root.dev!==rootAfter.dev||root.ino!==rootAfter.ino)fail("CATALOGUE_CACHE_CHANGED");
    return Buffer.concat(chunks,length);
  }catch(error){if(["ENOENT","ELOOP"].includes(error.code))fail("CATALOGUE_CACHE_CHANGED");throw error;}
  finally{await handle?.close();}
}
function createOllamaCatalogue(options = {}) {
  const directory = options.directory;
  if (!directory || !path.isAbsolute(directory)) fail("CATALOGUE_STORAGE_UNAVAILABLE");
  const file = path.join(directory, "official-catalogue.json");
  const limits = { pages: 10000, bytes: 256 * 1024 * 1024, body: 8 * 1024 * 1024, models: 5000, variants: 100000, durationMs: 600000, ...options.limits };
  const fetchImpl = options.fetchImpl || fetch;
  let active = null, disposed = false, lastAttempt = null;
  async function read() {
    try {
      const bytes = await readCacheBytes(directory,file);
      const record = JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
      if (record.format !== "material-buildroot-official-ollama-catalogue" || record.version !== 1 || !record.snapshot || record.revision !== sha(Buffer.from(JSON.stringify(record.snapshot))) || !Array.isArray(record.snapshot.variants) || !Array.isArray(record.snapshot.sources) || record.snapshot.variants.length > limits.variants || !Number.isFinite(Date.parse(record.snapshot.completedAt))) fail("CATALOGUE_CACHE_INVALID");
      validateSnapshot(record.snapshot);
      return record;
    } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  async function commit(snapshot, signal) {
    const record = { format: "material-buildroot-official-ollama-catalogue", version: 1, revision: sha(Buffer.from(JSON.stringify(snapshot))), snapshot };
    const bytes = JSON.stringify(record);
    if (Buffer.byteLength(bytes) > 64 * 1024 * 1024) fail("CATALOGUE_CACHE_LIMIT");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const root = await fs.lstat(directory);
    if (!root.isDirectory() || root.isSymbolicLink()) fail("CATALOGUE_STORAGE_UNAVAILABLE");
    const temporary = path.join(directory, ".catalogue-" + randomUUID());
    let handle;
    try { handle = await fs.open(temporary, "wx", 0o600); await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null; if(signal?.aborted)fail("CANCELLED"); if(active)active.phase="publishing"; await fs.rename(temporary, file); }
    finally { await handle?.close(); await fs.rm(temporary, { force: true }); }
    return record;
  }
  function describe(record) {
    const ageMs = record ? Math.max(0, Date.now() - Date.parse(record.snapshot.completedAt)) : null;
    return { sourceAvailability: lastAttempt?.code === "CATALOGUE_NETWORK_UNAVAILABLE" ? "offline-or-unreachable" : lastAttempt?.state === "completed" ? "online-at-last-refresh" : "unknown", available: !!record, refreshing: !!active, refreshPhase: active?.phase || null, revision: record?.revision || null, lastSuccessfulRefresh: record?.snapshot.completedAt || null, ageMs, stale: !record || ageMs > 86400000, completeness: record?.snapshot.completeness || null, counts: record ? { models: record.snapshot.families.length, variants: record.snapshot.variants.length, pages: record.snapshot.sources.length } : null, lastAttempt: lastAttempt ? {...lastAttempt} : null };
  }
  async function status(){return describe(await read());}
  async function refresh(context = {}) {
    if (disposed) fail("SERVICE_DISPOSED");
    if (active) fail("CATALOGUE_REFRESH_BUSY");
    const controller = new AbortController();
    const abort = () => {if(active?.controller===controller&&active.phase==="publishing")return;controller.abort();};
    if (context.signal?.aborted) controller.abort();
    context.signal?.addEventListener("abort", abort, { once: true });
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(limits.durationMs)]);
    const operation = { controller, promise: null, phase: "fetching" };
    active = operation;
    operation.promise = (async () => {
      const startedAt = new Date().toISOString(), families = new Set(), variants = new Map(), sources = [], visited = new Set();
      let bytes = 0, count = 0;
      lastAttempt = { startedAt, state: "refreshing", pages: 0, bytes: 0 };
      async function request(url) {
        if (signal.aborted) fail("CANCELLED");
        if (++count > limits.pages) fail("CATALOGUE_PAGE_LIMIT");
        await pause(options.paceMs ?? 125, null, { signal });
        const perRequest = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
        let response;
        try{response=await fetchImpl(pageUrl(url), { signal: perRequest, redirect: "error", credentials: "omit", referrerPolicy: "no-referrer", headers: { accept: "text/html" } });}
        catch(error){if(perRequest.aborted||error.name==="AbortError")throw error;fail("CATALOGUE_NETWORK_UNAVAILABLE");}
        if (!response.ok || !/^text\/html(?:;|$)/i.test(response.headers.get("content-type") || "")) fail("CATALOGUE_HTTP_UNAVAILABLE");
        if (response.url && new URL(response.url).href !== url) fail("CATALOGUE_REDIRECT_REJECTED");
        let body = [], length = 0;
        for await (const chunk of response.body) { length += chunk.length; bytes += chunk.length; if (length > limits.body || bytes > limits.bytes) fail("CATALOGUE_BYTE_LIMIT"); body.push(Buffer.from(chunk)); }
        body = Buffer.concat(body);
        let html;try{html = new TextDecoder("utf-8", { fatal: true }).decode(body);}catch{fail("CATALOGUE_SOURCE_UTF8_INVALID");}
        const source = { url, sha256: sha(body), bytes: length, observedAt: new Date().toISOString(), etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") };
        sources.push(source);
        lastAttempt.pages = sources.length; lastAttempt.bytes = bytes;
        context.onProgress?.({ type: "ollama-catalogue", phase: "refreshing", pages: sources.length, bytes, models: families.size, variants: variants.size });
        return html;
      }
      async function walk(first, family) {
        const pending = [first];
        while (pending.length) {
          const url = pending.shift();
          if (visited.has(url)) continue;
          visited.add(url);
          const parsed = parsePage(await request(url), url, family);
          for (const name of parsed.families) { families.add(name); if (families.size > limits.models) fail("CATALOGUE_MODEL_LIMIT"); }
          for (const variant of parsed.variants) { variants.set(variant.model, variant); if (variants.size > limits.variants) fail("CATALOGUE_VARIANT_LIMIT"); }
          for (const next of parsed.next) if (!visited.has(next)) pending.push(next);
        }
      }
      try {
        await walk(START, null);
        const pending = [...families];
        async function worker() { while (pending.length) { const name = pending.shift(); await walk(ORIGIN + "/library/" + name + "/tags", name); } }
        let firstFailure = null;
        await Promise.allSettled([worker(), worker()].map(work => work.catch(error => { firstFailure ||= error; controller.abort(); throw error; })));
        if(firstFailure)throw firstFailure;
        if (signal.aborted) fail("CANCELLED");
        const snapshot = { startedAt, completedAt: new Date().toISOString(), families: [...families].sort(), variants: [...variants.values()].sort((a, b) => a.model.localeCompare(b.model)), sources: sources.sort((a, b) => a.url.localeCompare(b.url)), completeness: { traversal: "complete-observed-official-source", exhaustive: false, reason: "UPSTREAM_HTML_HAS_NO_ATOMIC_REVISION_OR_AUTHORITATIVE_TOTAL", metadataComplete: false }, limitations: ["All links observed in admitted official source pages were traversed; this is not proof of an exhaustive or atomic upstream catalogue.", "Display sizes/context are rounded source strings; exact values, capabilities and licences remain unknown unless separately admitted.", "No benchmark, hardware-fit or loading recommendation is inferred from model names."] };
        const record = await commit(snapshot, signal);
        lastAttempt = { startedAt, completedAt: snapshot.completedAt, state: "completed", pages: sources.length, bytes };
        return { revision: record.revision, ...await status(), refreshing: false };
      } catch (error) {
        const interrupted = context.signal?.aborted || error.name === "AbortError" || error.code === "CANCELLED" || error.name === "TimeoutError";
        controller.abort();
        const code = /^[A-Z_]+$/.test(error.code || "") ? error.code : error.name === "AbortError" ? "CANCELLED" : error.name === "TimeoutError" ? "CATALOGUE_TIMEOUT" : "CATALOGUE_REFRESH_FAILED";
        lastAttempt = { startedAt, completedAt: new Date().toISOString(), state: interrupted ? "cancelled-or-interrupted" : "failed", code, pages: sources.length, bytes };
        throw Object.assign(new Error(code), {code});
      } finally { context.signal?.removeEventListener("abort", abort); active = null; }
    })();
    return operation.promise;
  }
  async function page(request) {
    const record = await read();
    if (!record) return { ...describe(null), items: [], next: null };
    const filtered = record.snapshot.variants.filter(item => (!request.family || item.family === request.family) && (!request.query || item.model.toLowerCase().includes(request.query.toLowerCase())));
    const start = request.offset || 0, limit = request.limit || 50;
    return { ...describe(record), available: true, revision: record.revision, items: filtered.slice(start, start + limit), next: start + limit < filtered.length ? start + limit : null, matching: filtered.length, completeness: record.snapshot.completeness, lastSuccessfulRefresh: record.snapshot.completedAt };
  }
  async function execute(request, context = {}) {
    request = require("./request-contract.cjs").admit(request);
    if (disposed) fail("SERVICE_DISPOSED");
    switch (request.action) {
      case "ollama.catalogue.status": return status();
      case "ollama.catalogue.page": return page(request);
      case "ollama.catalogue.refresh": return refresh(context);
      case "ollama.catalogue.cancel": if(active?.phase==="publishing")return {cancelling:false,reason:"CATALOGUE_COMMIT_IN_PROGRESS"};active?.controller.abort(); return { cancelling: !!active };
      default: fail("INVALID_REQUEST");
    }
  }
  async function dispose() { disposed = true; const pending = active; if(pending?.phase!=="publishing")pending?.controller.abort(); if (pending) await pending.promise.catch(() => {}); }
  return { execute, status, refresh, dispose };
}
module.exports = { createOllamaCatalogue, parsePage, pageUrl };
