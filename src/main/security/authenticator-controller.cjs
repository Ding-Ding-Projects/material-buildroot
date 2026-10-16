"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const derive = require("node:util").promisify(scrypt);
const { enrollment, enrollmentUri, generateEnrollment, totp, verifyTotp } = require("./authenticator.cjs");
const { createVault } = require("./vault.cjs");
const { parse } = require("./workspace-contract.cjs");
const { createWorkspaceHistory } = require("../storage/workspace-history.cjs");
const QRCode = require("qrcode");
function createAuthenticatorIPC({ desktop, directory, safeStorage, now = Date.now }) {
  const vault = createVault({ safeStorage, directory: path.join(directory, "authenticator-vault") }).forOwner("authenticator", ["read", "write", "remove"]);
  const file = path.join(directory, "authenticator-index.json");
  const history = createWorkspaceHistory(path.join(directory, "authenticator-history.json"));
  const accessFile = path.join(directory,"authenticator-history-access.json");
  let historyUntil = 0, historyAttempts = 0, historyWait = 0;
  function validState(value) {
    return value && Object.keys(value).sort().join() === 'entries,revision' && Number.isSafeInteger(value.revision) && value.revision >= 0 && Array.isArray(value.entries) && value.entries.length <= 500 && value.entries.every(e => e && Object.keys(e).every(k=>['id','issuer','account','group','icon','algorithm','digits','period','reference'].includes(k)) && /^[0-9a-f-]{36}$/.test(e.id) && /^vault:[0-9a-f-]{36}$/.test(e.reference) && [e.issuer,e.account,e.group,e.icon||''].every(v=>typeof v==='string'&&v.length<=128&&!/[\x00-\x1f\x7f]/.test(v)) && ['sha1','sha256','sha512'].includes(e.algorithm) && [6,7,8].includes(e.digits) && Number.isInteger(e.period) && e.period>=1 && e.period<=86400) && new Set(value.entries.map(e=>e.id)).size===value.entries.length;
  }
  function historyReference() {
    if(!fs.existsSync(accessFile))return null;
    const stat=fs.lstatSync(accessFile);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>256)throw Error();
    const value=parse(fs.readFileSync(accessFile,'utf8'));
    if(!value||Object.keys(value).join()!=='reference'||!/^vault:[0-9a-f-]{36}$/.test(value.reference))throw Error();
    return value.reference;
  }
  function historyOpen(){if(historyUntil<=now())throw Error();}
  let state = { revision: 0, entries: [] }, ready = true, pending = new Map(), queue = Promise.resolve();
  try {
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) throw Error();
      state = parse(fs.readFileSync(file, "utf8"));
      if (!validState(state)) throw Error();
    }
  } catch { ready = false; }
  const metadata = e => ({id:e.id, issuer:e.issuer, account:e.account, group:e.group || "", icon:e.icon||"", algorithm:e.algorithm, digits:e.digits, period:e.period});
  function save(entries) {
    const next = {revision:state.revision + 1, entries};
    // History contains only display metadata and protected references, never usable secrets.
    history.preserve(state);
    history.preserve(next);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(next), {flag:"wx",mode:0o600}); fs.renameSync(temporary,file); } finally { try { fs.unlinkSync(temporary); } catch {} }
    state = next;
  }
  function status() { return {available:ready && vault.availability().available, entries:state.entries.map(metadata), clock:now(), clockWarning:"CLOCK_NOT_EXTERNALLY_VERIFIED",historyConfigured:!!historyReference(),historyUnlocked:historyUntil>now()}; }
  const fields = {status:[], begin:["input","revealAccepted"], generate:["account","revealAccepted"], confirm:["pendingId","code"], cancel:[], cancelPairing:['pendingId'], codes:[], remove:["ids"], organize:["id","group","direction"],edit:['id','issuer','account','icon'],bulkGroup:['ids','group'],historySetup:['password','confirmation'],historyUnlock:['password'],historyLock:[],history:['before'],historyRead:['revision'],historyRestore:['revision','expectedRevision','accepted']};
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
        if (input.revealAccepted !== true || state.entries.length >= 500 || pending.size >= 8) throw Error();
        if(input.action === "generate" && typeof input.account !== "string") throw Error();
        const entry = input.action === "generate" ? generateEnrollment({account:input.account}) : enrollment(input.input);
        const uri = enrollmentUri(entry), qr = QRCode.create(uri,{errorCorrectionLevel:"M"});
        const id = randomUUID(), expires = now()+300000;
        pending.set(id,{entry,expires,attempts:0});
        result = {...entry,pendingId:id,expires,qr:{size:qr.modules.size,data:Array.from(qr.modules.data)}};
      } else if (input.action === "cancel") { pending.clear(); result = status(); }
      else if (input.action === 'cancelPairing') { if(typeof input.pendingId!=='string'||!/^[0-9a-f-]{36}$/.test(input.pendingId))throw Error();pending.delete(input.pendingId);result={cancelled:true}; }
      else if (input.action === "confirm") {
        const p = pending.get(input.pendingId);
        if (!p || ++p.attempts > 5) { pending.delete(input.pendingId); return {ok:false,code:"PAIRING_EXPIRED"}; }
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
      } else if(input.action==='edit') {
        if([input.issuer,input.account,input.icon].some(v=>typeof v!=='string'||v.length>128||/[\x00-\x1f\x7f]/.test(v))||!input.account.trim()||input.icon.length>32||!state.entries.some(e=>e.id===input.id))throw Error();
        save(state.entries.map(e=>e.id===input.id?{...e,issuer:input.issuer.trim(),account:input.account.trim(),icon:input.icon.trim()}:e));result=status();
      } else if(input.action==='bulkGroup') {
        if(!Array.isArray(input.ids)||input.ids.length<1||input.ids.length>500||input.ids.some(id=>!state.entries.some(e=>e.id===id))||typeof input.group!=='string'||input.group.length>80||/[\x00-\x1f\x7f]/.test(input.group))throw Error();
        save(state.entries.map(e=>input.ids.includes(e.id)?{...e,group:input.group.trim()}:e));result=status();
      } else if(input.action==='historySetup'||input.action==='historyUnlock') {
        if(now()<historyWait)return {ok:false,code:'HISTORY_RETRY_LATER'};
        if(typeof input.password!=='string'||input.password.length<12||input.password.length>1024)throw Error();
        const reference=historyReference();
        if(input.action==='historySetup'){
          if(reference||input.confirmation!==input.password)throw Error();
          const salt=randomBytes(32),hash=await derive(input.password,salt,32,{N:32768,r:8,p:1,maxmem:67108864});
          let protectedReference;
          try {if(!desktop.admitted(event))throw Error();protectedReference=vault.write(JSON.stringify({salt:salt.toString('hex'),hash:hash.toString('hex')}));fs.writeFileSync(accessFile,JSON.stringify({reference:protectedReference}),{flag:'wx',mode:0o600});}catch{if(protectedReference)vault.remove(protectedReference);throw Error();}finally{salt.fill(0);hash.fill(0);}
        }else{
          if(!reference)throw Error();
          const record=parse(vault.read(reference));if(!record||!/^[a-f0-9]{64}$/.test(record.salt)||!/^[a-f0-9]{64}$/.test(record.hash))throw Error();
          const expected=Buffer.from(record.hash,'hex'),actual=await derive(input.password,Buffer.from(record.salt,'hex'),32,{N:32768,r:8,p:1,maxmem:67108864});
          let matched;try{matched=timingSafeEqual(expected,actual);}finally{expected.fill(0);actual.fill(0);}
          if(!matched){historyAttempts++;historyUntil=0;if(historyAttempts>=5){historyWait=now()+30000;historyAttempts=0;}return {ok:false,code:'HISTORY_LOCKED'};}
        }
        if(!desktop.admitted(event))throw Error();historyAttempts=0;historyUntil=now()+300000;result=status();
      } else if(input.action==='historyLock'){historyUntil=0;result={locked:true};}
      else if(input.action==='history'){
        historyOpen();if(!Number.isSafeInteger(input.before)||input.before<0)throw Error();
        const revisions=history.revisions().filter(r=>input.before===0||r<input.before).sort((a,b)=>b-a);
        result={currentRevision:state.revision,revisions:revisions.slice(0,25),hasMore:revisions.length>25,expires:historyUntil};
      } else if(input.action==='historyRead'||input.action==='historyRestore'){
        historyOpen();if(!Number.isSafeInteger(input.revision)||input.revision<0)throw Error();
        const snapshot=parse(history.read(input.revision));if(!validState(snapshot)||snapshot.revision!==input.revision)throw Error();
        if(input.action==='historyRead')result={revision:snapshot.revision,entries:snapshot.entries.map(metadata),currentRevision:state.revision};
        else {if(input.accepted!==true||input.expectedRevision!==state.revision)throw Error();for(const entry of snapshot.entries)vault.read(entry.reference);save(snapshot.entries);result=status();}
      }
      if (!desktop.admitted(event)) { pending.clear(); historyUntil=0; return {ok:false,code:"UNAUTHORIZED"}; }
      return {ok:true,result};
    } catch { return {ok:false,code:"AUTHENTICATOR_UNAVAILABLE"}; }
  }
  return {revoke(){pending.clear();historyUntil=0;},request(event,input) { const result=queue.then(()=>run(event,input)); queue=result.then(()=>undefined,()=>undefined); return result; }};
}
module.exports={createAuthenticatorIPC};
