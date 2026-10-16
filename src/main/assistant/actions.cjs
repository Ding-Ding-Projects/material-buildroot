"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { parse } = require("../security/workspace-contract.cjs");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const PROFILES = Object.freeze([
  { id: "build-submit", effect: "Submit the selected fixed Buildroot target to the existing owned scheduler. Source build code executes with current grants; output files may change." },
  { id: "apply-defconfig", effect: "Replace project configuration with one catalogued defconfig through existing trusted configuration reconciliation. This may execute trusted Buildroot configuration code." },
  { id: "source-summary", effect: "Read bounded source and configuration fingerprints; no process is launched." },
  { id: "output-inventory", effect: "Read the current output inventory; no files are changed." },
  { id: "build-status", effect: "Read saved build states; no job is started, retried or cancelled." },
]);
const STATES = ["pending", "running", "cancelling", "succeeded", "failed", "cancelled", "unknown", "acknowledged", "submitted"];
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function exact(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail("INVALID_REQUEST");
  for (const key of Reflect.ownKeys(value)) if (!keys.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) fail("INVALID_REQUEST");
}
function id(value) { if (typeof value !== "string" || !UUID.test(value)) fail("INVALID_REQUEST"); return value; }
function revision(value) { if (!Number.isSafeInteger(value) || value < 0) fail("INVALID_REQUEST"); }
function profiles(value) {
  if (!Array.isArray(value) || !value.length || value.length > 12) fail("INVALID_PROPOSAL");
  return value.map(item => {
    if (typeof item === "string" && PROFILES.some(profile => profile.id === item && !["apply-defconfig", "build-submit"].includes(item))) return { profile: item, selection: null };
    exact(item, ["profile", "selection"]);
    if (item.profile === "build-submit") {
      exact(item.selection, ["target", "jobs"]);
      if (!["all", "sdk", "legal-info", "source"].includes(item.selection.target) || !Number.isSafeInteger(item.selection.jobs) || item.selection.jobs < 1 || item.selection.jobs > 32) fail("INVALID_PROPOSAL");
      return {profile:item.profile,selection:clone(item.selection)};
    }
    if (item.profile !== "apply-defconfig") fail("INVALID_PROPOSAL");
    exact(item.selection, ["id", "revision"]);
    if (typeof item.selection.id !== "string" || !HASH.test(item.selection.id) || typeof item.selection.revision !== "string" || !HASH.test(item.selection.revision)) fail("INVALID_PROPOSAL");
    return { profile: item.profile, selection: clone(item.selection) };
  });
}function validate(state) {
  exact(state, ["version", "revision", "plans"]);
  if (state.version !== 1) fail("STORAGE_UNAVAILABLE"); revision(state.revision);
  if (!Array.isArray(state.plans) || state.plans.length > 100) fail("STORAGE_UNAVAILABLE");
  const ids = new Set();
  for (const plan of state.plans) {
    exact(plan, ["id", "workspaceId", "createdAt", "steps", "checkpoints"]); id(plan.id); id(plan.workspaceId);
    if (ids.has(plan.id)) fail("STORAGE_UNAVAILABLE"); ids.add(plan.id);
    if (typeof plan.createdAt !== "string" || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(plan.createdAt)) fail("STORAGE_UNAVAILABLE");
    profiles(plan.steps.map(step => ["apply-defconfig", "build-submit"].includes(step.profile) ? {profile:step.profile,selection:step.selection} : step.profile));
    for (const step of plan.steps) {
      exact(step, ["profile", "selection", "operationId", "state", "attempt", "receipt"]);
      if (step.operationId !== null) id(step.operationId);
      if (!["apply-defconfig", "build-submit"].includes(step.profile) && step.selection !== null) fail("STORAGE_UNAVAILABLE");
      if (!STATES.includes(step.state)) fail("STORAGE_UNAVAILABLE"); revision(step.attempt);
      if (step.receipt !== null) {
        exact(step.receipt, ["sourceRevision", "configRevision", "count"]);
        if (!HASH.test(step.receipt.sourceRevision) || !HASH.test(step.receipt.configRevision) || !Number.isSafeInteger(step.receipt.count) || step.receipt.count < 0) fail("STORAGE_UNAVAILABLE");
      }
    }
    if (!Array.isArray(plan.checkpoints) || plan.checkpoints.length > 20) fail("STORAGE_UNAVAILABLE");
    for (const checkpoint of plan.checkpoints) {
      exact(checkpoint, ["id", "states"]); id(checkpoint.id);
      if (!Array.isArray(checkpoint.states) || checkpoint.states.length !== plan.steps.length || checkpoint.states.some(value => !STATES.includes(value))) fail("STORAGE_UNAVAILABLE");
    }
  }
  return state;
}
/** Only identifiers, fixed profiles, hashes, counters and states are durable. Never prompts or permissions. */
function createAssistantActions({ directory, bind, execute, catalog, prepare, observe, cancelJob }) {
  const file = path.join(directory, "plans.json");
  let previews = new Map(), active = null, closed = false, unavailable = false;
  function safeDirectory() {
    const absolute = path.resolve(directory);
    if (absolute !== directory) fail("STORAGE_UNAVAILABLE");
    let cursor = path.parse(absolute).root;
    for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      try { fs.mkdirSync(cursor, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
      const stat = fs.lstatSync(cursor);
      if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(cursor).toLowerCase() !== cursor.toLowerCase()) fail("STORAGE_UNAVAILABLE");
    }
  }
  function read() {
    safeDirectory();
    let before;
    try { before = fs.lstatSync(file); } catch (error) { if (error.code === "ENOENT") return { version: 1, revision: 0, plans: [] }; throw error; }
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 1024 * 1024) fail("STORAGE_UNAVAILABLE");
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const after = fs.fstatSync(fd);
      if (after.dev !== before.dev || after.ino !== before.ino || after.nlink !== 1 || after.size > 1024 * 1024) fail("STORAGE_UNAVAILABLE");
      const bytes = fs.readFileSync(fd);
      if (bytes.length > 1024 * 1024 || !Buffer.from(bytes.toString("utf8")).equals(bytes)) fail("STORAGE_UNAVAILABLE");
      return validate(parse(bytes.toString("utf8")));
    } finally { fs.closeSync(fd); }
  }
  function save(state, expected) {
    safeDirectory();
    const lock = fs.openSync(file + ".lock", "wx", 0o600);
    let temporary;
    try {
      if (read().revision !== expected) fail("REVISION_CONFLICT");
      const next = validate({ ...state, revision: expected + 1 });
      const bytes = JSON.stringify(next);
      if (Buffer.byteLength(bytes) > 1024 * 1024) fail("PLAN_LIMIT");
      temporary = file + "." + randomUUID() + ".tmp";
      const fd = fs.openSync(temporary, "wx", 0o600);
      try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      safeDirectory(); fs.renameSync(temporary, file); temporary = null;
      return next;
    } finally {
      fs.closeSync(lock); fs.unlinkSync(file + ".lock");
      if (temporary) fs.unlinkSync(temporary);
    }
  }
  // A previous running phase is never success or permission to resume.
  try {
    const state = read(); let changed = false;
    for (const plan of state.plans) for (const step of plan.steps) if (["running", "cancelling"].includes(step.state)) { step.state = "unknown"; changed = true; }
    if (changed) save(state, state.revision);
  } catch { unavailable = true; }
  function ready() { if (closed) fail("SERVICE_DISPOSED"); if (unavailable) fail("ASSISTANT_STORAGE_UNAVAILABLE"); }
  function selected(state, request) {
    id(request.workspaceId); id(request.planId);
    const plan = state.plans.find(item => item.id === request.planId && item.workspaceId === request.workspaceId);
    if (!plan) fail("PLAN_NOT_FOUND"); return plan;
  }
  function stepAt(plan, index) { if (!Number.isSafeInteger(index) || index < 0 || index >= plan.steps.length) fail("INVALID_REQUEST"); return plan.steps[index]; }
  function expected(state, value) { revision(value); if (state.revision !== value) fail("REVISION_CONFLICT"); }
  async function dispatch(request) {
    ready(); const { action } = request;
    if (action === "assistant.list") {
      exact(request, ["action", "workspaceId"]); id(request.workspaceId);
      let state = read(), changed = false;
      for (const plan of state.plans.filter(item => item.workspaceId === request.workspaceId)) for (const step of plan.steps) {
        if (step.profile !== "build-submit" || !step.operationId || !["submitted", "unknown"].includes(step.state)) continue;
        const job = observe(plan.workspaceId, step.operationId);
        const next = !job || job.state === "interrupted" ? "unknown" : ["succeeded", "failed", "cancelled"].includes(job.state) ? job.state : "submitted";
        if (step.state !== next) { step.state = next; changed = true; }
      }
      if (changed) state = save(state, state.revision);
      const plans = clone(state.plans.filter(plan => plan.workspaceId === request.workspaceId));
      for (const plan of plans) for (const step of plan.steps) if (step.profile === "build-submit" && step.operationId) step.job = observe(plan.workspaceId, step.operationId);
      return { revision: state.revision, plans, profiles: PROFILES, busy: !!active || plans.some(plan=>plan.steps.some(step=>step.job && ["queued","running","cancelling"].includes(step.job.state))) };
    }
    if (action === "assistant.catalog") {
      exact(request, ["action", "workspaceId"]); id(request.workspaceId);
      return catalog(request.workspaceId);
    }
    if (action === "assistant.propose") {
      exact(request, ["action", "workspaceId", "expectedRevision", "document"]); id(request.workspaceId);
      if (typeof request.document !== "string" || Buffer.byteLength(request.document) > 16384) fail("INVALID_PROPOSAL");
      const proposal = parse(request.document); exact(proposal, ["version", "steps"]);
      if (proposal.version !== 1) fail("INVALID_PROPOSAL");
      // Projection accepts fixed profile IDs and catalog hashes only, never natural-language instructions.
      return dispatch({ action: "assistant.create", workspaceId: request.workspaceId, expectedRevision: request.expectedRevision, profiles: proposal.steps });
    }
    if (action === "assistant.create") {
      exact(request, ["action", "workspaceId", "expectedRevision", "profiles"]); id(request.workspaceId);
      const actions = profiles(request.profiles); const state = read(); expected(state, request.expectedRevision);
      if (state.plans.length >= 100) fail("PLAN_LIMIT");
      state.plans.push({ id: randomUUID(), workspaceId: request.workspaceId, createdAt: new Date().toISOString(), steps: actions.map(item => ({ ...item, operationId: null, state: "pending", attempt: 0, receipt: null })), checkpoints: [] });
      return { revision: save(state, state.revision).revision };
    }
    if (action === "assistant.preview") {
      exact(request, ["action", "workspaceId", "planId", "index", "expectedRevision"]);
      if (active) fail("ASSISTANT_BUSY");
      const state = read(); expected(state, request.expectedRevision); const plan = selected(state, request); const step = stepAt(plan, request.index);
      if (step.state !== "pending" || plan.steps.slice(0, request.index).some(item => !["succeeded", "acknowledged"].includes(item.state))) fail("ACTION_NOT_READY");
      const target = await prepare(step.profile, plan.workspaceId, step.selection);
      const binding = await bind(plan.workspaceId);
      if (hash(await prepare(step.profile, plan.workspaceId, step.selection)) !== hash(target)) fail("SOURCE_OR_GRANT_CHANGED");
      ready(); if (active || read().revision !== state.revision) fail("REVISION_CONFLICT");
      const now = Date.now(); for (const [key, value] of previews) if (value.expiresAt <= now) previews.delete(key);
      if (previews.size >= 100) fail("PREVIEW_LIMIT");
      const preview = { id: randomUUID(), workspaceId: plan.workspaceId, planId: plan.id, index: request.index, profile: step.profile, selection: step.selection, target, revision: state.revision, sourceRevision: binding.sourceRevision, configRevision: binding.configRevision, grantBinding: binding.grantBinding, expiresAt: now + 120000 };
      previews.set(preview.id, preview);
      return { id: preview.id, digest: hash(preview), profile: step.profile, target, selection: step.selection, sourceRevision: binding.sourceRevision, configRevision: binding.configRevision, expiresAt: preview.expiresAt, effect: PROFILES.find(item => item.id === step.profile).effect };
    }
    if (action === "assistant.run") {
      exact(request, ["action", "workspaceId", "previewId", "digest", "consent"]); id(request.workspaceId); id(request.previewId);
      if (request.consent !== true) fail("CONSENT_REQUIRED");
      if (active) fail("ASSISTANT_BUSY");
      const preview = previews.get(request.previewId); previews.delete(request.previewId);
      if (!preview || preview.workspaceId !== request.workspaceId || hash(preview) !== request.digest || preview.expiresAt <= Date.now()) fail("PREVIEW_EXPIRED");
      const state = read(); expected(state, preview.revision); const plan = selected(state, preview); const step = stepAt(plan, preview.index);
      if (step.state !== "pending") fail("ACTION_NOT_READY");
      if (step.attempt >= 3) fail("ACTION_ATTEMPT_LIMIT");
      const controller = new AbortController();
      // Reserve before awaiting a fresh grant check; overlapping run requests cannot pass admission.
      const job = { planId: plan.id, index: preview.index, workspaceId: plan.workspaceId, controller, promise: null, started: false };
      active = job;
      try {
        if (hash(await prepare(step.profile, plan.workspaceId, step.selection)) !== hash(preview.target)) fail("SOURCE_OR_GRANT_CHANGED");
        const binding = await bind(plan.workspaceId, controller.signal);
        ready();
        if (controller.signal.aborted) fail("ACTION_CANCELLED");
        if (binding.sourceRevision !== preview.sourceRevision || binding.configRevision !== preview.configRevision || binding.grantBinding !== preview.grantBinding) fail("SOURCE_OR_GRANT_CHANGED");
        if (Date.now() >= preview.expiresAt) fail("PREVIEW_EXPIRED");
        expected(read(), preview.revision);
        step.state = "running"; step.attempt++; step.operationId = randomUUID(); save(state, state.revision); job.started = true;
        job.promise = (async () => {
          let outcome = "unknown", receipt = null;
          try {
            const result = await execute(step.profile, plan.workspaceId, controller.signal, binding, step.selection, step.operationId);
            if (result.submitted === true && step.profile === "build-submit") {
              if (controller.signal.aborted) await cancelJob(plan.workspaceId, step.operationId);
              outcome = "submitted";
              receipt = { sourceRevision: binding.sourceRevision, configRevision: binding.configRevision, count: 1 };
            } else {
            const after = await bind(plan.workspaceId, controller.signal);
            if (after.sourceRevision !== binding.sourceRevision || (step.profile !== "apply-defconfig" && after.configRevision !== binding.configRevision) || after.grantBinding !== binding.grantBinding) fail("SOURCE_OR_GRANT_CHANGED");
            if (!Number.isSafeInteger(result.count) || result.count < 0) fail("INVALID_RESULT");
            outcome = controller.signal.aborted ? (step.profile === "apply-defconfig" ? "unknown" : "cancelled") : "succeeded";
            receipt = { sourceRevision: binding.sourceRevision, configRevision: after.configRevision, count: result.count };
            }
          } catch { outcome = ["apply-defconfig", "build-submit"].includes(step.profile) ? "unknown" : controller.signal.aborted ? "cancelled" : "failed"; }
          try {
            const current = read(); const record = selected(current, preview); const currentStep = stepAt(record, preview.index);
            currentStep.state = outcome; currentStep.receipt = receipt; save(current, current.revision);
          } catch { unavailable = true; }
          finally { if (active === job) active = null; }
        })();
        return { started: true };
      } catch (error) { if (active === job && !job.started) active = null; throw error; }
    }
    if (action === "assistant.cancel") {
      exact(request, ["action", "workspaceId", "planId"]); id(request.workspaceId); id(request.planId);
      if (!active || active.planId !== request.planId || active.workspaceId !== request.workspaceId) {
        const state = read(); const plan = selected(state, request);
        const step = plan.steps.find(item=>item.profile === "build-submit" && item.operationId && ["submitted","unknown"].includes(item.state));
        if (!step) fail("ACTION_NOT_RUNNING");
        await cancelJob(plan.workspaceId, step.operationId);
        return {cancellationRequested:true,settled:false};
      }
      active.controller.abort();
      if (active.started) { const state = read(); const plan = selected(state, request); stepAt(plan, active.index).state = "cancelling"; save(state, state.revision); }
      return { cancellationRequested: true, settled: false };
    }
    if (action === "assistant.checkpoint") {
      exact(request, ["action", "workspaceId", "planId", "expectedRevision"]);
      const state = read(); expected(state, request.expectedRevision); const plan = selected(state, request);
      if (active || plan.checkpoints.length >= 20) fail("CHECKPOINT_UNAVAILABLE");
      plan.checkpoints.push({ id: randomUUID(), states: plan.steps.map(step => step.state) });
      return { revision: save(state, state.revision).revision };
    }
    if (action === "assistant.recover") {
      exact(request, ["action", "workspaceId", "planId", "index", "expectedRevision", "resolution", "consent"]);
      if (request.consent !== true) fail("CONSENT_REQUIRED"); if (active) fail("ASSISTANT_BUSY");
      const state = read(); expected(state, request.expectedRevision); const step = stepAt(selected(state, request), request.index);
      if (!["unknown", "failed", "cancelled"].includes(step.state) || !["retry", "acknowledge"].includes(request.resolution)) fail("RECOVERY_NOT_AVAILABLE");
      if (step.profile === "build-submit" && step.operationId) {
        const job = observe(request.workspaceId, step.operationId);
        if (job && !["failed","cancelled"].includes(job.state)) fail("BUILD_RECOVERY_REQUIRED");
      }
      if (request.resolution === "retry" && step.attempt >= 3) fail("ACTION_ATTEMPT_LIMIT");
      step.state = request.resolution === "retry" ? "pending" : "acknowledged"; step.receipt = null; previews.clear();
      return { revision: save(state, state.revision).revision, executed: false };
    }
    fail("INVALID_ACTION");
  }
  return { dispatch, async dispose() { closed = true; previews.clear(); active?.controller.abort(); await active?.promise; } };
}
module.exports = { createAssistantActions, PROFILES };





