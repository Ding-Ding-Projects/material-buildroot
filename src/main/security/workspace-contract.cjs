"use strict";
const MAX_BYTES = 1024 * 1024;
const fail = () => {
  const error = new Error("Invalid workspace data.");
  error.code = "INVALID_REQUEST";
  throw error;
};
function object(value, keys, required = keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    fail();
  const own = Reflect.ownKeys(value);
  if (
    own.some((key) => typeof key !== "string" || !keys.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    fail();
  for (const key of own) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !Object.hasOwn(d, "value")) fail();
  }
  return value;
}
function string(value, max, min = 0) {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail();
  return value;
}
function one(value, values) {
  if (!values.includes(value)) fail();
  return value;
}
function id(value) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value,
    )
  )
    fail();
  return value;
}
function timestamp(value) {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    fail();
  return value;
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail();
  return value;
}
function preferences(value) {
  object(value, ["theme"]);
  one(value.theme, ["system", "light", "dark"]);
  return value;
}
function planFields(value, partial = false) {
  object(
    value,
    ["name", "runtime", "target", "status", "notes"],
    partial ? [] : ["name", "runtime", "target", "status", "notes"],
  );
  if (!Reflect.ownKeys(value).length) fail();
  if (Object.hasOwn(value, "name")) {
    string(value.name, 80, 1);
    if (!value.name.trim()) fail();
  }
  if (Object.hasOwn(value, "runtime")) one(value.runtime, ["wsl", "docker"]);
  if (Object.hasOwn(value, "target"))
    one(value.target, ["image", "sdk", "toolchain"]);
  if (Object.hasOwn(value, "status"))
    one(value.status, ["draft", "ready-for-review"]);
  if (Object.hasOwn(value, "notes")) string(value.notes, 4000);
  return value;
}
function plan(value) {
  object(value, [
    "id",
    "name",
    "runtime",
    "target",
    "status",
    "notes",
    "createdAt",
    "updatedAt",
  ]);
  id(value.id);
  timestamp(value.createdAt);
  timestamp(value.updatedAt);
  planFields(
    Object.fromEntries(
      ["name", "runtime", "target", "status", "notes"].map((key) => [
        key,
        value[key],
      ]),
    ),
  );
  return value;
}
function defaultOnboarding() {
  return { step: 0, runtime: "wsl", name: "", dismissed: false };
}
function onboarding(value) {
  object(
    value,
    ["step", "planId", "runtime", "name", "dismissed"],
    ["step", "runtime", "name", "dismissed"],
  );
  one(value.step, [0, 1, 2]);
  one(value.runtime, ["wsl", "docker"]);
  string(value.name, 80);
  if (typeof value.dismissed !== "boolean") fail();
  if (Object.hasOwn(value, "planId")) id(value.planId);
  return value;
}
function payload(value) {
  object(
    value,
    ["plans", "preferences", "onboardingCompleted", "onboarding"],
    ["plans", "preferences", "onboardingCompleted"],
  );
  if (!Object.hasOwn(value, "onboarding"))
    value.onboarding = defaultOnboarding();
  onboarding(value.onboarding);
  if (
    !Array.isArray(value.plans) ||
    value.plans.length > 100 ||
    typeof value.onboardingCompleted !== "boolean"
  )
    fail();
  value.plans.forEach(plan);
  if (new Set(value.plans.map((p) => p.id)).size !== value.plans.length) fail();
  preferences(value.preferences);
  return value;
}
function state(value) {
  object(
    value,
    [
      "format",
      "version",
      "revision",
      "plans",
      "preferences",
      "onboardingCompleted",
      "onboarding",
      "snapshots",
      "activity",
      "preferenceProvenance",
    ],
    [
      "format",
      "version",
      "revision",
      "plans",
      "preferences",
      "onboardingCompleted",
      "snapshots",
      "activity",
    ],
  );
  if (!Object.hasOwn(value, "onboarding"))
    value.onboarding = defaultOnboarding();
  if (value.format !== "material-buildroot-workspace" || value.version !== 1)
    fail();
  revision(value.revision);
  // Absence on older files is unknown, never inferred from the value or revision.
  if (Object.hasOwn(value, "preferenceProvenance")) {
    object(value.preferenceProvenance, ["theme"]);
    const source = value.preferenceProvenance.theme;
    object(source, ["origin", "revision"]);
    one(source.origin, ["default", "saved", "restored", "imported"]);
    revision(source.revision);
    if (source.revision > value.revision) fail();
    if (source.origin === "default" && (source.revision !== 0 || value.preferences?.theme !== "system")) fail();
    if (source.origin !== "default" && source.revision < 1) fail();
  }
  payload({
    plans: value.plans,
    preferences: value.preferences,
    onboardingCompleted: value.onboardingCompleted,
    onboarding: value.onboarding,
  });
  if (
    !Array.isArray(value.snapshots) ||
    value.snapshots.length > 20 ||
    !Array.isArray(value.activity) ||
    value.activity.length > 100
  )
    fail();
  for (const s of value.snapshots) {
    object(s, ["id", "name", "createdAt", "payload"]);
    id(s.id);
    string(s.name, 80, 1);
    timestamp(s.createdAt);
    payload(s.payload);
  }
  if (new Set(value.snapshots.map((s) => s.id)).size !== value.snapshots.length)
    fail();
  for (const a of value.activity) {
    object(a, ["id", "action", "timestamp", "revision"]);
    id(a.id);
    one(a.action, ACTIONS);
    timestamp(a.timestamp);
    revision(a.revision);
    if (a.revision > value.revision) fail();
  }
  bounded(value);
  return value;
}
const ACTIONS = [
  "plan.create",
  "plan.update",
  "plan.delete",
  "preferences.update",
  "onboarding.complete",
  "onboarding.update",
  "onboarding.createPlan",
  "snapshot.create",
  "snapshot.restore",
  "document.import",
  "revision.restore",
];
function request(value) {
  object(
    value,
    [
      "expectedRevision",
      "action",
      "plan",
      "id",
      "changes",
      "preferences",
      "name",
      "document",
      "onboarding",
      "revision",
      "beforeRevision",
      "scope",
      "ids",
      "label",
      "keep",
      "kind",
      "workspaceId",
      "expectedNativeRevision",
    ],
    ["expectedRevision", "action"],
  );
  revision(value.expectedRevision);
  if (["native.history","native.restore","native.export"].includes(value.action)) {
    one(value.kind,["catalogue","options"]);
    const fields=["expectedRevision","action","kind",...(value.kind==="options"?["workspaceId"]:[]),...(value.action==="native.restore"?["revision","expectedNativeRevision"]:[])];
    object(value,fields);
    if(value.kind==="options") id(value.workspaceId);
    if(value.action==="native.restore"){revision(value.revision);revision(value.expectedNativeRevision);}
    return value;
  }
  if (["history.compare", "history.label", "history.retain"].includes(value.action)) {
    const keys = value.action === "history.label" ? ["revision", "label"] : value.action === "history.retain" ? ["keep"] : ["revision"];
    object(value, ["expectedRevision", "action", ...keys]);
    if (value.action === "history.retain") one(value.keep, [25, 100, 500]);
    else revision(value.revision);
    if (value.action === "history.label") { string(value.label, 80, 1); if (!value.label.trim()) fail(); }
    return value;
  }
  if (value.action === "history.read") {
    object(value, ["expectedRevision", "action", "beforeRevision"], ["expectedRevision", "action"]);
    if (value.beforeRevision !== undefined) revision(value.beforeRevision);
    return value;
  }
  if (value.action === "document.export") {
    object(value, ["expectedRevision", "action", "scope", "ids"]);
    one(value.scope, ["workspace", "plans", "history", "revisions", "revision-page"]);
    if (!Array.isArray(value.ids) || value.ids.length > 100 || new Set(value.ids).size !== value.ids.length) fail();
    if (value.scope === "plans") value.ids.forEach(id);
    else if (value.scope === "revision-page") { if(value.ids.length>25||value.ids.some(id=>typeof id!=="string"||! /^(0|[1-9][0-9]*)$/.test(id)||!Number.isSafeInteger(Number(id))))fail(); }
    else if (value.ids.length) fail();
    return value;
  }
  one(value.action, ACTIONS);
  const fields = {
    "plan.create": ["plan"],
    "plan.update": ["id", "changes"],
    "plan.delete": ["id"],
    "preferences.update": ["preferences"],
    "onboarding.complete": [],
    "onboarding.update": ["onboarding"],
    "onboarding.createPlan": ["plan"],
    "snapshot.create": ["name"],
    "snapshot.restore": ["id"],
    "document.import": ["document"],
    "revision.restore": ["revision"],
  }[value.action];
  object(value, ["expectedRevision", "action", ...fields]);
  if (["plan.create", "onboarding.createPlan"].includes(value.action))
    planFields(value.plan);
  if (value.action === "plan.update") {
    id(value.id);
    planFields(value.changes, true);
  }
  if (["plan.delete", "snapshot.restore"].includes(value.action)) id(value.id);
  if (value.action === "preferences.update") preferences(value.preferences);
  if (value.action === "onboarding.update") onboarding(value.onboarding);
  if (value.action === "snapshot.create") string(value.name, 80, 1);
  if (value.action === "document.import") parseExport(value.document);
  if (value.action === "revision.restore") revision(value.revision);
  bounded(value);
  return value;
}
function bounded(value) {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_BYTES) fail();
}
function parse(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_BYTES)
    fail();
  let value;
  try {
    const tokens =
      text.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) || [];
    const stack = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "{" || token === "[") {
        stack.push(token === "{" ? new Set() : null);
        if (stack.length > 16) fail();
      } else if (token === "}" || token === "]") {
        stack.pop();
      } else if (token.startsWith('"') && tokens[i + 1] === ":") {
        const key = JSON.parse(token);
        const keys = stack[stack.length - 1];
        if (
          !keys ||
          keys.has(key) ||
          ["__proto__", "constructor", "prototype"].includes(key)
        )
          fail();
        keys.add(key);
      }
    }
    value = JSON.parse(text);
  } catch {
    fail();
  }
  return value;
}
function parseExport(text) {
  const value = parse(text);
  object(
    value,
    [
      "format",
      "version",
      "plans",
      "preferences",
      "onboardingCompleted",
      "onboarding",
    ],
    ["format", "version", "plans", "preferences", "onboardingCompleted"],
  );
  if (!Object.hasOwn(value, "onboarding"))
    value.onboarding = defaultOnboarding();
  if (
    value.format !== "material-buildroot-workspace-export" ||
    value.version !== 1
  )
    fail();
  payload({
    plans: value.plans,
    preferences: value.preferences,
    onboardingCompleted: value.onboardingCompleted,
    onboarding: value.onboarding,
  });
  return value;
}
module.exports = { MAX_BYTES, state, request, parse, parseExport };
