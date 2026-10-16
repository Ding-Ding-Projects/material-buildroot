"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { parse } = require("../security/workspace-contract.cjs");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const PROFILES = Object.freeze([
  { id: "source-summary", effect: "Read bounded source and configuration fingerprints; no process is launched." },
  { id: "output-inventory", effect: "Read the current output inventory; no files are changed." },
  { id: "build-status", effect: "Read saved build states; no job is started, retried or cancelled." },
]);
const STATES = ["pending", "running", "cancelling", "succeeded", "failed", "cancelled", "unknown", "acknowledged"];
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function exact(value, keys) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail("INVALID_REQUEST");
  for (const key of Reflect.ownKeys(value)) if (!keys.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) fail("INVALID_REQUEST");
}
function id(value) { if (typeof value !== "string" || !UUID.test(value)) fail("INVALID_REQUEST"); return value; }
function revision(value) { if (!Number.isSafeInteger(value) || value < 0) fail("INVALID_REQUEST"); }
function profiles(value) {
  if (!Array.isArray(value) || !value.length || value.length > 12 || value.some(item => !PROFILES.some(profile => profile.id === item))) fail("INVALID_PROPOSAL");
  return [...value];
}
function validate(state) {
  exact(state, ["version", "revision", "plans"]);
  if (state.version !== 1) fail("STORAGE_UNAVAILABLE"); revision(state.revision);
  if (!Array.isArray(state.plans) || state.plans.length > 100) fail("STORAGE_UNAVAILABLE");
  const ids = new Set();
  for (const plan of state.plans) {
    exact(plan, ["id", "workspaceId", "createdAt", "steps", "checkpoints"]); id(plan.id); id(plan.workspaceId);
    if (ids.has(plan.id)) fail("STORAGE_UNAVAILABLE"); ids.add(plan.id);
    if (typeof plan.createdAt !== "string" || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(plan.createdAt)) fail("STORAGE_UNAVAILABLE");
    profiles(plan.steps.map(step => step.profile));
    for (const step of plan.steps) {
      exact(step, ["profile", "state", "attempt", "receipt"]);
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
function createAssistantActions({ directory, bind, execute }) {
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
      const state = read();
      return { revision: state.revision, plans: state.plans.filter(plan => plan.workspaceId === request.workspaceId), profiles: PROFILES, busy: !!active };
    }
    if (action === "assistant.create") {
      exact(request, ["action", "workspaceId", "expectedRevision", "profiles"]); id(request.workspaceId);
      const actions = profiles(request.profiles); const state = read(); expected(state, request.expectedRevision);
      if (state.plans.length >= 100) fail("PLAN_LIMIT");
      state.plans.push({ id: randomUUID(), workspaceId: request.workspaceId, createdAt: new Date().toISOString(), steps: actions.map(profile => ({ profile, state: "pending", attempt: 0, receipt: null })), checkpoints: [] });
      return { revision: save(state, state.revision).revision };
    }
    if (action === "assistant.preview") {
      exact(request, ["action", "workspaceId", "planId", "index", "expectedRevision"]);
      if (active) fail("ASSISTANT_BUSY");
      const state = read(); expected(state, request.expectedRevision); const plan = selected(state, request); const step = stepAt(plan, request.index);
      if (step.state !== "pending" || plan.steps.slice(0, request.index).some(item => !["succeeded", "acknowledged"].includes(item.state))) fail("ACTION_NOT_READY");
      const binding = await bind(plan.workspaceId);
      ready(); if (active || read().revision !== state.revision) fail("REVISION_CONFLICT");
      const now = Date.now(); for (const [key, value] of previews) if (value.expiresAt <= now) previews.delete(key);
      if (previews.size >= 100) fail("PREVIEW_LIMIT");
      const preview = { id: randomUUID(), workspaceId: plan.workspaceId, planId: plan.id, index: request.index, profile: step.profile, revision: state.revision, sourceRevision: binding.sourceRevision, configRevision: binding.configRevision, grantBinding: binding.grantBinding, expiresAt: now + 120000 };
      previews.set(preview.id, preview);
      return { id: preview.id, digest: hash(preview), profile: step.profile, sourceRevision: binding.sourceRevision, configRevision: binding.configRevision, expiresAt: preview.expiresAt, effect: PROFILES.find(item => item.id === step.profile).effect };
    }
    if (action === "assistant.run") {
      exact(request, ["action", "workspaceId", "previewId", "digest", "consent"]); id(request.workspaceId); id(request.previewId);
      if (request.consent !== true) fail("CONSENT_REQUIRED");
      if (active) fail("ASSISTANT_BUSY");
      const preview = previews.get(request.previewId); previews.delete(request.previewId);
      if (!preview || preview.workspaceId !== request.workspaceId || hash(preview) !== request.digest || preview.expiresAt <= Date.now()) fail("PREVIEW_EXPIRED");
      const state = read(); expected(state, preview.revision); const plan = selected(state, preview); const step = stepAt(plan, preview.index);
      if (step.state !== "pending") fail("ACTION_NOT_READY");
      const controller = new AbortController();
      // Reserve before awaiting a fresh grant check; overlapping run requests cannot pass admission.
      const job = { planId: plan.id, index: preview.index, workspaceId: plan.workspaceId, controller, promise: null, started: false };
      active = job;
      try {
        const binding = await bind(plan.workspaceId, controller.signal);
        ready();
        if (controller.signal.aborted) fail("ACTION_CANCELLED");
        if (binding.sourceRevision !== preview.sourceRevision || binding.configRevision !== preview.configRevision || binding.grantBinding !== preview.grantBinding) fail("SOURCE_OR_GRANT_CHANGED");
        if (Date.now() >= preview.expiresAt) fail("PREVIEW_EXPIRED");
        expected(read(), preview.revision);
        step.state = "running"; step.attempt++; save(state, state.revision); job.started = true;
        job.promise = (async () => {
          let outcome = "unknown", receipt = null;
          try {
            const result = await execute(step.profile, plan.workspaceId, controller.signal, binding);
            const after = await bind(plan.workspaceId, controller.signal);
            if (after.sourceRevision !== binding.sourceRevision || after.configRevision !== binding.configRevision || after.grantBinding !== binding.grantBinding) fail("SOURCE_OR_GRANT_CHANGED");
            if (!Number.isSafeInteger(result.count) || result.count < 0) fail("INVALID_RESULT");
            outcome = controller.signal.aborted ? "cancelled" : "succeeded";
            receipt = { sourceRevision: binding.sourceRevision, configRevision: binding.configRevision, count: result.count };
          } catch { outcome = controller.signal.aborted ? "cancelled" : "failed"; }
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
      if (!active || active.planId !== request.planId || active.workspaceId !== request.workspaceId) fail("ACTION_NOT_RUNNING");
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
      step.state = request.resolution === "retry" ? "pending" : "acknowledged"; step.receipt = null; previews.clear();
      return { revision: save(state, state.revision).revision, executed: false };
    }
    fail("INVALID_ACTION");
  }
  return { dispatch, async dispose() { closed = true; previews.clear(); active?.controller.abort(); await active?.promise; } };
}
module.exports = { createAssistantActions, PROFILES };
