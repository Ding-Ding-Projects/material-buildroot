"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { enrollment, enrollmentUri, generateEnrollment, totp, verifyTotp } = require("./authenticator.cjs");
const { createVault } = require("./vault.cjs");
const { parse } = require("./workspace-contract.cjs");
const { createWorkspaceHistory } = require("../storage/workspace-history.cjs");
const QRCode = require("qrcode");
function createAuthenticatorIPC({ desktop, directory, safeStorage, now = Date.now }) {
  const vault = createVault({ safeStorage, directory: path.join(directory, "authenticator-vault") }).forOwner("authenticator", ["read", "write", "remove"]);
  const file = path.join(directory, "authenticator-index.json");
  const history = createWorkspaceHistory(path.join(directory, "authenticator-history.json"));
  let state = { revision: 0, entries: [] }, ready = true, pending = new Map(), queue = Promise.resolve();
  try {
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 262144) throw Error();
      state = parse(fs.readFileSync(file, "utf8"));
      if (!state || Object.keys(state).sort().join() !== 'entries,revision' || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.entries) || state.entries.length > 500 || state.entries.some(e => !e || Object.keys(e).sort().join() !== 'account,algorithm,digits,group,id,issuer,period,reference' || !/^[0-9a-f-]{36}$/.test(e.id) || !/^vault:[0-9a-f-]{36}$/.test(e.reference) || [e.issuer,e.account,e.group].some(v=>typeof v!=='string'||v.length>128||/[\x00-\x1f\x7f]/.test(v)) || !['sha1','sha256','sha512'].includes(e.algorithm) || ![6,7,8].includes(e.digits) || !Number.isInteger(e.period) || e.period<1 || e.period>86400) || new Set(state.entries.map(e=>e.id)).size!==state.entries.length) throw Error();
    }
  } catch { ready = false; }
  const metadata = e => ({id:e.id, issuer:e.issuer, account:e.account, group:e.group || "", algorithm:e.algorithm, digits:e.digits, period:e.period});
  function save(entries) {
    const next = {revision:state.revision + 1, entries};
    // History contains only display metadata and protected references, never usable secrets.
    history.preserve(next);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(next), {flag:"wx",mode:0o600}); fs.renameSync(temporary,file); } finally { try { fs.unlinkSync(temporary); } catch {} }
    state = next;
  }
  function status() { return {available:ready && vault.availability().available, entries:state.entries.map(metadata), clock:now(), clockWarning:"CLOCK_NOT_EXTERNALLY_VERIFIED"}; }
  const fields = {status:[], begin:["input","revealAccepted"], generate:["account","revealAccepted"], confirm:["pendingId","code"], cancel:[], codes:[], remove:["ids"], organize:["id","group","direction"]};
  async function run(event, serialized) {
    if (!desktop.admitted(event)) return {ok:false,code:"UNAUTHORIZED"};
    try {
      if (typeof serialized !== "string" || Buffer.byteLength(serialized) > 8192) throw Error();
      const input = parse(serialized);
      if (!input || !Object.hasOwn(fields,input.action) || Object.keys(input).sort().join() !== ["action",...fields[input.action]].sort().join()) throw Error();
      if (!ready || !vault.availability().available) return {ok:false,code:"VAULT_UNAVAILABLE"};
      for (const [id,p] of pending) if (p.expires <= now()) pending.delete(id);
      let result;
      if (input.action === "status") result = status();
      else if (input.action === "begin" || input.action === "generate") {
        if (input.revealAccepted !== true || state.entries.length >= 500) throw Error();
        if(input.action === "generate" && typeof input.account !== "string") throw Error();
        const entry = input.action === "generate" ? generateEnrollment({account:input.account}) : enrollment(input.input);
        const uri = enrollmentUri(entry), qr = QRCode.create(uri,{errorCorrectionLevel:"M"});
        const id = randomUUID(), expires = now()+300000;
        pending.clear(); pending.set(id,{entry,expires,attempts:0});
        result = {...entry,pendingId:id,expires,qr:{size:qr.modules.size,data:Array.from(qr.modules.data)}};
      } else if (input.action === "cancel") { pending.clear(); result = status(); }
      else if (input.action === "confirm") {
        const p = pending.get(input.pendingId);
        if (!p || ++p.attempts > 5) { pending.clear(); return {ok:false,code:"PAIRING_EXPIRED"}; }
        if (!verifyTotp(p.entry.secret,input.code,{...p.entry,time:now()})) return {ok:false,code:"CODE_MISMATCH"};
        const reference = vault.write(p.entry.secret), {secret,...data} = p.entry;
        try { save([...state.entries,{...data,id:randomUUID(),reference,group:""}]); } catch { vault.remove(reference); throw Error(); }
        pending.delete(input.pendingId); result = status();
      } else if (input.action === "codes") {
        const time = now();
        result = {clock:time,entries:state.entries.map(e => { const secret = vault.read(e.reference); return {id:e.id,code:totp(secret,{...e,time}),next:totp(secret,{...e,time:time+e.period*1000}),remaining:e.period-Math.floor(time/1000)%e.period}; })};
      } else if (input.action === "remove") {
        if (!Array.isArray(input.ids) || input.ids.length < 1 || input.ids.length > 500 || input.ids.some(id => typeof id !== "string" || !state.entries.some(e=>e.id===id))) throw Error();
        // Encrypted records remain for local history recovery; no plaintext export exists.
        save(state.entries.filter(e=>!input.ids.includes(e.id))); result=status();
      } else if (input.action === "organize") {
        if (typeof input.group !== "string" || input.group.length > 80 || /[\x00-\x1f]/.test(input.group) || ![-1,0,1].includes(input.direction)) throw Error();
        const entries = state.entries.map(e=>({...e})), index=entries.findIndex(e=>e.id===input.id);
        if (index < 0) throw Error(); entries[index].group=input.group.trim();
        const destination=Math.max(0,Math.min(entries.length-1,index+input.direction));
        const [entry]=entries.splice(index,1); entries.splice(destination,0,entry); save(entries); result=status();
      }
      if (!desktop.admitted(event)) { pending.clear(); return {ok:false,code:"UNAUTHORIZED"}; }
      return {ok:true,result};
    } catch { return {ok:false,code:"AUTHENTICATOR_UNAVAILABLE"}; }
  }
  return {request(event,input) { const result=queue.then(()=>run(event,input)); queue=result.then(()=>undefined,()=>undefined); return result; }};
}
module.exports={createAuthenticatorIPC};
