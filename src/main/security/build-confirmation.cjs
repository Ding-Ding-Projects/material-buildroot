"use strict";
const { createHash } = require("node:crypto");
const { createConfirmationService } = require("./confirmation.cjs");

const OPERATIONS = new Set(["build.submit"]);
const fail = () => { throw Object.assign(new Error("Confirmation required"), {code:"CONFIRMATION_REQUIRED"}); };
/** Host-resolved, single-use consent. Renderer paths never establish authority. */
function createBuildConfirmation({ resolveWorkspace, now = Date.now }) {
  const service = createConfirmationService({ now });
  const pending = new Map();
  const grants = new Map();
  const digest = (request) => {
    const { confirmationToken, ...action } = request;
    const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])])) : value;
    return createHash("sha256").update(JSON.stringify(stable(action))).digest("hex");
  };
  function binding(request) {
    if (!request || !OPERATIONS.has(request.action) || request.target !== "clean" || typeof request.workspaceId !== "string") fail();
    const project = resolveWorkspace(request.workspaceId);
    return { operation:request.action, destination:project.output, digest:digest(request),
      identity:JSON.stringify(project.identities), workspaceId:request.workspaceId };
  }
  function prune() {
    for (const [id,item] of pending) if (item.expires <= now()) { pending.delete(id); service.cancel(id); }
    for (const [id,item] of grants) if (item.expires <= now()) grants.delete(id);
  }
  return {
    challenge(request) {
      prune();
      if (pending.size + grants.size >= 64) fail();
      const bound = binding(request);
      const challenge = service.challenge(bound);
      pending.set(challenge.id,{...bound,expires:challenge.expires});
      return {...challenge, rebuildRequired:true};
    },
    confirm({id, firstKey, secondKey, slider, rebuildConsent}) {
      prune();
      const bound = pending.get(id);
      pending.delete(id);
      if (!bound || rebuildConsent !== true) { service.cancel(id); fail(); }
      const current = resolveWorkspace(bound.workspaceId);
      if (JSON.stringify(current.identities) !== bound.identity || current.output !== bound.destination) { service.cancel(id); fail(); }
      let token;
      try { token = service.confirm({id,...bound,firstKey,secondKey,slider}); } catch { fail(); }
      grants.set(token,bound);
      return {token};
    },
    consume(request) {
      prune();
      const token = request.confirmationToken;
      const granted = grants.get(token);
      grants.delete(token);
      const current = binding(request);
      if (!granted || ["operation","destination","digest","identity","workspaceId"].some(key => granted[key] !== current[key])) fail();
      try { service.consume({token,...current}); } catch { fail(); }
    },
    cancel(id) { pending.delete(id); service.cancel(id); },
    dispose() { service.clear(); pending.clear(); grants.clear(); },
  };
}
module.exports = { createBuildConfirmation };
