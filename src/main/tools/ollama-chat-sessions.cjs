"use strict";
const { randomUUID } = require('node:crypto');
const { fail } = require('./runtime.cjs');
// Responses are ephemeral: neither prompts nor generated text are written to disk.
function createChatSessions(execute) {
  const sessions = new Map();
  let disposed = false;
  function prune() {
    for (const [id, session] of sessions) if (session.state !== 'running' && Date.now() - session.updatedAt > 300000) sessions.delete(id);
  }
  function read(id) { const session = sessions.get(id); if (!session) fail('CHAT_SESSION_UNAVAILABLE'); return session; }
  return {
    dispatch(request) {
      if (disposed) fail('SERVICE_DISPOSED');
      prune();
      if (request.action === 'ollama.chat.start') {
        if ([...sessions.values()].some(s => s.state === 'running')) fail('CHAT_ALREADY_RUNNING');
        if (sessions.size >= 8) fail('CHAT_SESSION_LIMIT');
        const id = randomUUID(), controller = new AbortController();
        const session = {id, controller, state:'running', content:'', code:null, result:null, updatedAt:Date.now(), completion:null};
        sessions.set(id, session);
        session.completion = execute({...request, action:'ollama.chat'}, {signal:controller.signal, onProgress:event => {
          if (typeof event.message?.content === 'string') session.content = (session.content + event.message.content).slice(0,1048576);
          session.updatedAt = Date.now();
        }}).then(result => { session.result=result; session.state=controller.signal.aborted?'cancelled':'completed'; }, error => {
          session.state=controller.signal.aborted?'cancelled':'failed'; session.code=/^[A-Z_]+$/.test(error.code||'')?error.code:'MODEL_CHAT_FAILED';
        }).finally(()=>{session.updatedAt=Date.now();});
        return {id,state:session.state};
      }
      const session=read(request.id);
      if(request.action==='ollama.chat.cancel') { if(session.state==='running')session.controller.abort(); return {id:session.id,state:session.state,cancelling:session.state==='running'}; }
      if(request.action==='ollama.chat.forget') {if(session.state==='running')fail('CHAT_STILL_RUNNING');sessions.delete(session.id);return {forgotten:true};}
      const offset=request.offset||0;
      return {id:session.id,state:session.state,content:session.content.slice(offset,offset+16384),next:Math.min(session.content.length,offset+16384),length:session.content.length,code:session.code,doneReason:session.result?.doneReason||null};
    },
    async dispose(){disposed=true;for(const session of sessions.values())session.controller.abort();await Promise.all([...sessions.values()].map(s=>s.completion));sessions.clear();}
  };
}
module.exports={createChatSessions};
