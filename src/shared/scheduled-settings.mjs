/** Pure scheduling protocol. Network access and actual setting consumers are separate. */
export const SCHEDULE_LIMITS = Object.freeze({
  documentBytes: 262144,
  rules: 256,
  depth: 8,
  keys: 256,
  arrayItems: 256,
  stringCodePoints: 4096,
  valueBytes: 16384,
  responseBytes: 65536,
});
const admittedResults = new WeakMap();
const unsafe = new Set(["__proto__", "prototype", "constructor"]);
const plain = (value) =>
  value !== null &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;
const exact = (value, keys) =>
  plain(value) &&
  Reflect.ownKeys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const boundedText = (value, max) =>
  typeof value === "string" &&
  [...value].length > 0 &&
  [...value].length <= max &&
  !/[\u0000-\u001f\u007f]/u.test(value);
const stableId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value);
const integer = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
const clone = (value) => JSON.parse(JSON.stringify(value));
const freeze = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
export class ScheduleError extends Error {
  constructor(code) {
    super("The scheduled setting could not be used.");
    this.name = "ScheduleError";
    this.code = code;
  }
}
const fail = (code) => {
  throw new ScheduleError(code);
};
function json(value, depth = 0) {
  if (typeof value === "string") {
    if ([...value].length > SCHEDULE_LIMITS.stringCodePoints)
      fail("INVALID_SCHEMA");
    return;
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return;
  if (depth >= SCHEDULE_LIMITS.depth) fail("INVALID_SCHEMA");
  if (Array.isArray(value)) {
    if (
      Object.keys(value).length !== value.length ||
      value.length > SCHEDULE_LIMITS.arrayItems
    )
      fail("INVALID_SCHEMA");
    for (const child of value) json(child, depth + 1);
    return;
  }
  if (
    !plain(value) ||
    Reflect.ownKeys(value).length !== Object.keys(value).length ||
    Object.keys(value).length > SCHEDULE_LIMITS.keys
  )
    fail("INVALID_SCHEMA");
  for (const [key, child] of Object.entries(value)) {
    if (unsafe.has(key) || [...key].length > 160) fail("INVALID_SCHEMA");
    json(child, depth + 1);
  }
}
function byteLength(value) {
  return new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  ).byteLength;
}
function dateValid(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\d$/.test(value) ||
    value.startsWith("0000")
  )
    return false;
  const date = new Date(value + "T00:00:00.000Z");
  return (
    Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
const timeValid = (value) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
function zoneValid(value) {
  if (!boundedText(value, 100)) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}
function registryValid(registry) {
  if (!plain(registry) || !Object.keys(registry).length)
    fail("REGISTRY_REQUIRED");
  for (const [key, validator] of Object.entries(registry))
    if (
      !boundedText(key, 160) ||
      unsafe.has(key) ||
      typeof validator !== "function"
    )
      fail("REGISTRY_REQUIRED");
}
function valuesValid(values, registry, allowEmpty = false) {
  if (!plain(values) || (!allowEmpty && !Object.keys(values).length))
    fail("INVALID_VALUES");
  json(values);
  if (byteLength(values) > SCHEDULE_LIMITS.valueBytes) fail("INVALID_VALUES");
  for (const [key, value] of Object.entries(values)) {
    if (!Object.hasOwn(registry, key)) fail("UNKNOWN_SETTING");
    let valid = false;
    try {
      valid = registry[key](clone(value)) === true;
    } catch {}
    if (!valid) fail("INVALID_VALUES");
  }
}
function validateOrigin(
  urlText,
  { allowedOrigins = [], allowLoopbackHttp = false } = {},
) {
  if (
    typeof urlText !== "string" ||
    urlText.length > 2048 ||
    /[\u0000-\u0020\u007f]/u.test(urlText)
  )
    fail("INVALID_SOURCE");
  let url;
  try {
    url = new URL(urlText);
  } catch {
    fail("INVALID_SOURCE");
  }
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.href !== urlText ||
    !/^\/[A-Za-z0-9/_~.-]*$/.test(url.pathname) ||
    url.pathname.includes("//") ||
    !Array.isArray(allowedOrigins) ||
    !allowedOrigins.includes(url.origin)
  )
    fail("INVALID_SOURCE");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(allowLoopbackHttp && loopback && url.protocol === "http:")
  )
    fail("INVALID_SOURCE");
  return url;
}
function sourceValid(source, options) {
  if (exact(source, ["type"]) && source.type === "local") return;
  const fields =
    source?.type === "home-assistant"
      ? [
          "type",
          "baseUrl",
          "entityId",
          "refreshMs",
          "timeoutMs",
          "maxResponseBytes",
        ]
      : ["type", "url", "refreshMs", "timeoutMs", "maxResponseBytes"];
  if (
    !exact(source, fields) ||
    !["https", "home-assistant"].includes(source.type) ||
    !integer(source.refreshMs, 30000, 86400000) ||
    !integer(source.timeoutMs, 100, 30000) ||
    !integer(source.maxResponseBytes, 1, SCHEDULE_LIMITS.responseBytes)
  )
    fail("INVALID_SOURCE");
  const url = validateOrigin(
    source.type === "https" ? source.url : source.baseUrl,
    options,
  );
  if (
    source.type === "home-assistant" &&
    (!/^(?:binary_sensor|input_boolean)\.[a-z0-9_]{1,128}$/.test(
      source.entityId,
    ) ||
      url.search ||
      url.pathname !== "/")
  )
    fail("INVALID_SOURCE");
}
export function validateScheduleDocument(
  input,
  { registry, ...sourceOptions } = {},
) {
  registryValid(registry);
  json(input);
  if (byteLength(input) > SCHEDULE_LIMITS.documentBytes) fail("BYTE_LIMIT");
  if (
    !exact(input, ["schemaVersion", "revision", "timeZone", "rules"]) ||
    input.schemaVersion !== 1 ||
    !integer(input.revision, 0, Number.MAX_SAFE_INTEGER - 1) ||
    !zoneValid(input.timeZone) ||
    !Array.isArray(input.rules) ||
    input.rules.length > SCHEDULE_LIMITS.rules
  )
    fail("INVALID_SCHEMA");
  const ids = new Set();
  for (const rule of input.rules) {
    if (
      !exact(rule, [
        "id",
        "label",
        "enabled",
        "priority",
        "startDate",
        "endDate",
        "startTime",
        "endTime",
        "days",
        "values",
        "source",
      ]) ||
      !stableId(rule.id) ||
      ids.has(rule.id) ||
      !boundedText(rule.label, 160) ||
      typeof rule.enabled !== "boolean" ||
      !integer(rule.priority, -1000, 1000) ||
      !timeValid(rule.startTime) ||
      !timeValid(rule.endTime)
    )
      fail("INVALID_RULE");
    ids.add(rule.id);
    if (
      (rule.startDate !== null && !dateValid(rule.startDate)) ||
      (rule.endDate !== null && !dateValid(rule.endDate)) ||
      (rule.startDate !== null &&
        rule.endDate !== null &&
        rule.startDate > rule.endDate)
    )
      fail("INVALID_RULE");
    const d = rule.days;
    if (
      !(exact(d, ["type"]) && d.type === "everyday") &&
      !(
        exact(d, ["type", "weekdays"]) &&
        d.type === "weekdays" &&
        Array.isArray(d.weekdays) &&
        d.weekdays.length >= 1 &&
        d.weekdays.length <= 7 &&
        d.weekdays.every((day) => integer(day, 0, 6)) &&
        new Set(d.weekdays).size === d.weekdays.length
      )
    )
      fail("INVALID_RULE");
    valuesValid(rule.values, registry);
    sourceValid(rule.source, sourceOptions);
  }
  return clone(input);
}
// A full strict JSON parse with duplicate detection, including escaped property names.
function parseJsonBytes(bytes, maxBytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > maxBytes)
    fail("BYTE_LIMIT");
  let text, input;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    input = JSON.parse(text);
  } catch {
    fail("INVALID_JSON");
  }
  const levels = [];
  for (let at = 0; at < text.length; at++) {
    if (text[at] === "{") {
      if (levels.length >= SCHEDULE_LIMITS.depth) fail("INVALID_SCHEMA");
      levels.push(new Set());
      continue;
    }
    if (text[at] === "}") {
      levels.pop();
      continue;
    }
    if (text[at] !== '"') continue;
    const start = at++;
    while (at < text.length) {
      if (text[at] === "\\") {
        at += 2;
        continue;
      }
      if (text[at] === '"') break;
      at++;
    }
    let after = at + 1;
    while (/[\x20\t\r\n]/u.test(text[after] || "")) after++;
    if (text[after] === ":") {
      const key = JSON.parse(text.slice(start, at + 1)),
        set = levels.at(-1);
      if (!set || set.has(key)) fail("DUPLICATE_KEY");
      set.add(key);
    }
  }
  return input;
}
export function parseScheduleBytes(bytes, options) {
  return validateScheduleDocument(
    parseJsonBytes(bytes, SCHEDULE_LIMITS.documentBytes),
    options,
  );
}
function wallTime(at, timeZone) {
  if (!Number.isFinite(at) || at < -62135596800000 || at > 253402300799999)
    fail("INVALID_TIME");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${p.year.padStart(4, "0")}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
function matches(rule, wall) {
  if (!rule.enabled) return false;
  const overnight = rule.startTime > rule.endTime;
  let date = wall.date;
  if (overnight && wall.time < rule.endTime)
    date = new Date(Date.parse(date + "T12:00:00Z") - 86400000)
      .toISOString()
      .slice(0, 10);
  if (
    (rule.startDate !== null && date < rule.startDate) ||
    (rule.endDate !== null && date > rule.endDate)
  )
    return false;
  if (
    rule.days.type === "weekdays" &&
    !rule.days.weekdays.includes(new Date(date + "T12:00:00Z").getUTCDay())
  )
    return false;
  return (
    rule.startTime === rule.endTime ||
    (overnight
      ? wall.time >= rule.startTime || wall.time < rule.endTime
      : wall.time >= rule.startTime && wall.time < rule.endTime)
  );
}
export function evaluateSchedule({
  document,
  base,
  at,
  external = {},
  registry,
  ...sourceOptions
}) {
  const checked = validateScheduleDocument(document, {
    registry,
    ...sourceOptions,
  });
  valuesValid(base, registry, true);
  const identity = JSON.stringify(checked),
    wall = wallTime(at, checked.timeZone),
    values = clone(base),
    provenance = Object.fromEntries(
      Object.keys(base).map((key) => [key, null]),
    ),
    appliedRuleIds = [],
    issues = [];
  const rules = checked.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => matches(rule, wall))
    .sort((a, b) => a.rule.priority - b.rule.priority || a.index - b.index);
  for (const { rule } of rules) {
    let chosen = rule.values;
    if (rule.source.type !== "local") {
      const result = Object.hasOwn(external, rule.id)
        ? external[rule.id]
        : null;
      if (
        !result ||
        admittedResults.get(result)?.identity !== identity ||
        admittedResults.get(result)?.current() !== true ||
        result.revision !== checked.revision ||
        result.ruleId !== rule.id ||
        result.status !== "ready" ||
        !Number.isFinite(result.observedAt) ||
        result.observedAt > at ||
        !Number.isFinite(result.expiresAt) ||
        result.expiresAt <= at ||
        result.expiresAt - result.observedAt > rule.source.refreshMs
      ) {
        issues.push({
          ruleId: rule.id,
          code: result?.status === "off" ? "SOURCE_OFF" : "SOURCE_UNAVAILABLE",
        });
        continue;
      }
      try {
        valuesValid(result.values, registry);
        if (
          Object.keys(result.values).some(
            (key) => !Object.hasOwn(rule.values, key),
          )
        )
          fail("UNKNOWN_SETTING");
      } catch {
        issues.push({ ruleId: rule.id, code: "SOURCE_INVALID" });
        continue;
      }
      chosen =
        rule.source.type === "home-assistant" ? rule.values : result.values;
    }
    for (const [key, value] of Object.entries(chosen)) {
      values[key] = clone(value);
      provenance[key] = rule.id;
    }
    appliedRuleIds.push(rule.id);
  }
  return { values, provenance, appliedRuleIds, issues };
}
export function createExternalScheduleCoordinator({
  registry,
  ...sourceOptions
}) {
  registryValid(registry);
  let generation = 0,
    revision = null,
    identity = null,
    requests = new Map(),
    results = new Map();
  const checkedDocument = (document) => {
    const checked = validateScheduleDocument(document, {
      registry,
      ...sourceOptions,
    });
    if (checked.revision !== revision || JSON.stringify(checked) !== identity)
      fail("STALE_GENERATION");
    return checked;
  };
  return Object.freeze({
    reset(document) {
      const checked = validateScheduleDocument(document, {
        registry,
        ...sourceOptions,
      });
      for (const request of requests.values()) request.controller.abort();
      requests = new Map();
      results = new Map();
      generation++;
      revision = checked.revision;
      identity = JSON.stringify(checked);
      return generation;
    },
    reconcile(document, at) {
      const checked = checkedDocument(document),
        wall = wallTime(at, checked.timeZone);
      for (const [id, request] of requests) {
        const rule = checked.rules.find((rule) => rule.id === id);
        if (!rule || !matches(rule, wall)) {
          request.controller.abort();
          requests.delete(id);
          results.delete(id);
        }
      }
    },
    begin(document, ruleId, at) {
      const checked = checkedDocument(document),
        rule = checked.rules.find((rule) => rule.id === ruleId);
      if (
        !rule ||
        rule.source.type === "local" ||
        !matches(rule, wallTime(at, checked.timeZone))
      )
        fail("INACTIVE_RULE");
      const previous = requests.get(ruleId);
      if (previous && at - previous.startedAt < rule.source.refreshMs)
        fail("REFRESH_LIMIT");
      previous?.controller.abort();
      const controller = new AbortController(),
        token = Object.freeze({
          generation,
          revision,
          ruleId,
          startedAt: at,
          signal: controller.signal,
        });
      requests.set(ruleId, { controller, token, startedAt: at, rule });
      return token;
    },
    settleBytes(token, bytes, at) {
      const request = requests.get(token?.ruleId);
      if (
        !request ||
        request.token !== token ||
        token.generation !== generation ||
        token.revision !== revision ||
        token.signal.aborted
      )
        return false;
      let payload;
      try {
        payload = parseJsonBytes(bytes, request.rule.source.maxResponseBytes);
      } catch {
        request.controller.abort();
        results.delete(token.ruleId);
        return false;
      }
      return this.settle(token, payload, at);
    },
    settle(token, payload, at) {
      const request = requests.get(token?.ruleId);
      if (
        !request ||
        request.token !== token ||
        token.generation !== generation ||
        token.revision !== revision ||
        token.signal.aborted ||
        !Number.isFinite(at) ||
        at < token.startedAt
      )
        return false;
      request.controller.abort();
      const source = request.rule.source;
      if (at - token.startedAt > source.timeoutMs) {
        results.delete(token.ruleId);
        return false;
      }
      let result;
      try {
        json(payload);
        if (
          byteLength(payload) > source.maxResponseBytes ||
          !exact(payload, ["schemaVersion", "status", "values"]) ||
          payload.schemaVersion !== 1 ||
          !["ready", "off", "failed"].includes(payload.status)
        )
          fail("INVALID_RESPONSE");
        const emptyAllowed =
          source.type === "home-assistant" || payload.status !== "ready";
        valuesValid(payload.values, registry, emptyAllowed);
        if (
          (payload.status !== "ready" && Object.keys(payload.values).length) ||
          Object.keys(payload.values).some(
            (key) => !Object.hasOwn(request.rule.values, key),
          ) ||
          (source.type === "home-assistant" &&
            Object.keys(payload.values).length)
        )
          fail("INVALID_RESPONSE");
        result = clone(payload);
      } catch {
        results.delete(token.ruleId);
        return false;
      }
      results.set(token.ruleId, {
        revision,
        ruleId: token.ruleId,
        status: result.status,
        values:
          source.type === "home-assistant" && result.status === "ready"
            ? clone(request.rule.values)
            : result.values,
        observedAt: at,
        expiresAt: at + source.refreshMs,
      });
      return true;
    },
    snapshot() {
      return Object.fromEntries(
        [...results].map(([key, value]) => {
          const receipt = freeze(clone(value)),
            observedGeneration = generation;
          admittedResults.set(receipt, {
            identity,
            current: () =>
              generation === observedGeneration && results.get(key) === value,
          });
          return [key, receipt];
        }),
      );
    },
    cancel() {
      for (const request of requests.values()) request.controller.abort();
      requests.clear();
      results.clear();
      generation++;
      identity = null;
      revision = null;
    },
  });
}

/** Adapter must atomically compare exact observed bytes and commit document+receipt.
 * This portable seam does not claim filesystem or browser transaction ownership. */
export function createScheduleStore({ adapter, registry, ...sourceOptions }) {
  if (
    !adapter ||
    typeof adapter.read !== "function" ||
    typeof adapter.commit !== "function"
  )
    fail("STORAGE_REQUIRED");
  let queue = Promise.resolve();
  const serialize = (task) => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const read = async () => {
    let bytes;
    try {
      bytes = await adapter.read();
    } catch {
      fail("STORAGE_UNAVAILABLE");
    }
    if (bytes === null) return { bytes: null, document: null };
    if (!(bytes instanceof Uint8Array)) fail("STORAGE_INVALID");
    const observed = new Uint8Array(bytes);
    return {
      bytes: observed,
      document: parseScheduleBytes(observed, { registry, ...sourceOptions }),
    };
  };
  return Object.freeze({
    load() {
      return serialize(async () => (await read()).document);
    },
    replace(input, { expectedRevision }) {
      const candidate = validateScheduleDocument(input, {
        registry,
        ...sourceOptions,
      });
      return serialize(async () => {
        const observed = await read();
        if ((observed.document?.revision ?? null) !== expectedRevision)
          fail("STALE_REVISION");
        if (observed.document?.revision >= Number.MAX_SAFE_INTEGER - 1)
          fail("REVISION_EXHAUSTED");
        const next = validateScheduleDocument(
          { ...candidate, revision: (observed.document?.revision ?? -1) + 1 },
          { registry, ...sourceOptions },
        );
        const bytes = new TextEncoder().encode(JSON.stringify(next));
        const receipt = {
          schemaVersion: 1,
          action: observed.document ? "schedule.updated" : "schedule.created",
          fromRevision: expectedRevision,
          toRevision: next.revision,
        };
        let result;
        try {
          result = await adapter.commit({
            expectedBytes: observed.bytes,
            bytes,
            receipt,
          });
        } catch {
          fail("STORAGE_UNAVAILABLE");
        }
        if (result !== true) fail("STALE_REVISION");
        return clone(next);
      });
    },
  });
}
