import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateScheduleDocument,
  parseScheduleBytes,
  evaluateSchedule,
  createExternalScheduleCoordinator,
  createScheduleStore,
  SCHEDULE_LIMITS,
} from "../src/shared/scheduled-settings.mjs";
const registry = {
  language: (v) => ["en", "zh-HK", "bilingual"].includes(v),
  "appearance.theme": (v) => ["system", "light", "dark"].includes(v),
  "appearance.scale": (v) => typeof v === "number" && v >= 0.5 && v <= 4,
  "custom.element.color": (v) =>
    typeof v === "string" && /^#[0-9a-f]{6}$/.test(v),
};
const options = {
  registry,
  allowedOrigins: ["https://settings.example", "https://home.example"],
};
const rule = (patch = {}) => ({
  id: "rule-1",
  label: "Scheduled appearance",
  enabled: true,
  priority: 0,
  startDate: null,
  endDate: null,
  startTime: "09:00",
  endTime: "17:00",
  days: { type: "everyday" },
  values: { language: "zh-HK" },
  source: { type: "local" },
  ...patch,
});
const doc = (rules = [], timeZone = "UTC") => ({
  schemaVersion: 1,
  revision: 0,
  timeZone,
  rules,
});
const at = (text) => Date.parse(text);
const run = (document, time, extra = {}) =>
  evaluateSchedule({
    document,
    base: { language: "en", "appearance.theme": "system" },
    at: at(time),
    ...options,
    ...extra,
  });
const remote = {
  type: "https",
  url: "https://settings.example/v1/settings",
  refreshMs: 30000,
  timeoutMs: 1000,
  maxResponseBytes: 4096,
};

test("local windows, every day, dates, equal civil days and per-setting precedence restore base", () => {
  const document = doc([
    rule({
      id: "low",
      values: { language: "zh-HK", "appearance.theme": "light" },
    }),
    rule({ id: "high", priority: 5, values: { "appearance.theme": "dark" } }),
    rule({ id: "later", priority: 5, values: { language: "bilingual" } }),
  ]);
  const active = run(document, "2026-10-15T09:00:00Z");
  assert.equal(active.values.language, "bilingual");
  assert.equal(active.values["appearance.theme"], "dark");
  assert.equal(active.provenance.language, "later");
  assert.deepEqual(run(document, "2026-10-15T17:00:00Z").values, {
    language: "en",
    "appearance.theme": "system",
  });
  const equal = doc([
    rule({
      startDate: "2026-10-15",
      endDate: "2026-10-15",
      startTime: "12:00",
      endTime: "12:00",
    }),
  ]);
  for (const time of ["2026-10-15T00:00:00Z", "2026-10-15T23:59:59Z"])
    assert.equal(run(equal, time).values.language, "zh-HK");
  assert.equal(run(equal, "2026-10-16T00:00:00Z").values.language, "en");
  assert.equal(run(doc([]), "2026-10-15T12:00:00Z").appliedRuleIds.length, 0);
});

test("overnight dates and weekdays belong to start day including end-date spillover", () => {
  const document = doc([
    rule({
      startDate: "2026-10-16",
      endDate: "2026-10-16",
      startTime: "22:00",
      endTime: "02:00",
      days: { type: "weekdays", weekdays: [5] },
    }),
  ]);
  for (const time of ["2026-10-16T22:00:00Z", "2026-10-17T01:59:59Z"])
    assert.equal(run(document, time).values.language, "zh-HK");
  for (const time of [
    "2026-10-16T01:00:00Z",
    "2026-10-17T02:00:00Z",
    "2026-10-17T22:00:00Z",
  ])
    assert.equal(run(document, time).values.language, "en");
});

test("Intl timezone rules match both repeated DST hours and never invent missing wall minutes", () => {
  const repeated = doc(
    [rule({ startTime: "01:15", endTime: "01:45" })],
    "America/New_York",
  );
  assert.equal(run(repeated, "2026-11-01T05:30:00Z").values.language, "zh-HK");
  assert.equal(run(repeated, "2026-11-01T06:30:00Z").values.language, "zh-HK");
  assert.equal(run(repeated, "2026-11-01T06:45:00Z").values.language, "en");
  const skipped = doc(
    [rule({ startTime: "02:15", endTime: "02:45" })],
    "America/New_York",
  );
  assert.equal(run(skipped, "2026-03-08T06:30:00Z").values.language, "en");
  assert.equal(run(skipped, "2026-03-08T07:30:00Z").values.language, "en");
  const full = doc(
    [
      rule({
        startDate: "2026-03-08",
        endDate: "2026-03-08",
        startTime: "12:00",
        endTime: "12:00",
      }),
    ],
    "America/New_York",
  );
  assert.equal(run(full, "2026-03-08T05:00:00Z").values.language, "zh-HK");
  assert.equal(run(full, "2026-03-09T03:59:59Z").values.language, "zh-HK");
  assert.equal(run(full, "2026-03-09T04:00:00Z").values.language, "en");
  const hongKong = doc(
    [rule({ startTime: "09:00", endTime: "10:00" })],
    "Asia/Hong_Kong",
  );
  assert.equal(run(hongKong, "2026-10-15T01:00:00Z").values.language, "zh-HK");
});

test("strict bounded schema refuses duplicate JSON, partial windows, unknown registry and unsafe sources", () => {
  const invalid = [
    doc([rule({ startTime: null })]),
    doc([rule({ days: { type: "weekdays", weekdays: [] } })]),
    doc([rule({ startDate: "2026-02-30" })]),
    doc([rule({ endDate: "2026-01-01", startDate: "2026-02-01" })]),
    doc([rule({ values: { unknown: true } })]),
    doc([rule({ values: { "appearance.scale": NaN } })]),
    doc([rule(), rule()]),
    doc([], "Bad/Zone"),
    { ...doc([]), schemaVersion: 2 },
  ];
  for (const candidate of invalid)
    assert.throws(() => validateScheduleDocument(candidate, options));
  for (const url of [
    "https://settings.example/v1?token=x",
    "https://user:pass@settings.example/v1",
    "https://settings.example/a/../v1",
    "https://settings.example/%2e%2e/v1",
    "https://settings.example/v1#part",
    "https://other.example/v1",
    "http://settings.example/v1",
    "file:///tmp/settings",
  ])
    assert.throws(() =>
      validateScheduleDocument(
        doc([rule({ source: { ...remote, url } })]),
        options,
      ),
    );
  assert.throws(
    () =>
      parseScheduleBytes(
        new TextEncoder().encode(
          '{"schemaVersion":1,"schemaVersion":1,"revision":0,"timeZone":"UTC","rules":[]}',
        ),
        options,
      ),
    { code: "DUPLICATE_KEY" },
  );
  assert.throws(() =>
    parseScheduleBytes(
      new Uint8Array(SCHEDULE_LIMITS.documentBytes + 1),
      options,
    ),
  );
  assert.throws(() => parseScheduleBytes(new Uint8Array([255]), options));
  assert.throws(() => validateScheduleDocument(doc([rule()])));
  assert.doesNotThrow(() =>
    validateScheduleDocument(
      doc([rule({ values: { "custom.element.color": "#102030" } })]),
      options,
    ),
  );
});

test("external coordinator rejects obsolete, timed-out, malformed and inactive results without base mutations", () => {
  const document = doc([
      rule({ id: "local", priority: -1 }),
      rule({
        id: "api",
        priority: 2,
        source: remote,
        values: { language: "bilingual" },
      }),
    ]),
    start = at("2026-10-15T12:00:00Z");
  const c = createExternalScheduleCoordinator(options);
  c.reset(document);
  const old = c.begin(document, "api", start);
  assert.throws(() => c.begin(document, "api", start + 1), {
    code: "REFRESH_LIMIT",
  });
  c.reset(document);
  assert.equal(old.signal.aborted, true);
  assert.equal(
    c.settle(
      old,
      { schemaVersion: 1, status: "ready", values: { language: "bilingual" } },
      start + 10,
    ),
    false,
  );
  const current = c.begin(document, "api", start);
  assert.equal(
    c.settle(
      current,
      { schemaVersion: 1, status: "ready", values: { language: "bilingual" } },
      start + 10,
    ),
    true,
  );
  const applied = evaluateSchedule({
    document,
    base: { language: "en" },
    at: start + 20,
    external: c.snapshot(),
    ...options,
  });
  assert.equal(applied.values.language, "bilingual");
  assert.equal(applied.provenance.language, "api");
  assert.equal(
    evaluateSchedule({
      document,
      base: { language: "en" },
      at: start + 30011,
      external: c.snapshot(),
      ...options,
    }).values.language,
    "zh-HK",
  );
  const late = c.begin(document, "api", start + 30001);
  assert.equal(
    c.settle(
      late,
      { schemaVersion: 1, status: "ready", values: { language: "en" } },
      start + 31002,
    ),
    false,
  );
  assert.equal(
    evaluateSchedule({
      document,
      base: { language: "en" },
      at: start + 31003,
      external: c.snapshot(),
      ...options,
    }).values.language,
    "zh-HK",
  );
  const next = c.begin(document, "api", start + 60002);
  assert.equal(
    c.settle(
      next,
      {
        schemaVersion: 1,
        status: "ready",
        values: { "appearance.theme": "dark" },
      },
      start + 60003,
    ),
    false,
  );
  const active = c.begin(document, "api", start + 90003);
  c.reconcile(document, at("2026-10-15T18:00:00Z"));
  assert.equal(active.signal.aborted, true);
  assert.equal(
    c.settle(
      active,
      { schemaVersion: 1, status: "ready", values: { language: "en" } },
      start + 90004,
    ),
    false,
  );
  assert.throws(() => c.begin({ ...document, rules: [] }, "api", start), {
    code: "STALE_GENERATION",
  });
});

test("Home Assistant boolean off falls through while on applies admitted local values only", () => {
  const source = {
      type: "home-assistant",
      baseUrl: "https://home.example/",
      entityId: "input_boolean.focus",
      refreshMs: 30000,
      timeoutMs: 1000,
      maxResponseBytes: 4096,
    },
    document = doc([rule({ source })]),
    time = at("2026-10-15T12:00:00Z"),
    c = createExternalScheduleCoordinator(options);
  c.reset(document);
  let token = c.begin(document, "rule-1", time);
  assert.equal(
    c.settle(token, { schemaVersion: 1, status: "off", values: {} }, time + 1),
    true,
  );
  assert.equal(
    evaluateSchedule({
      document,
      base: { language: "en" },
      at: time + 2,
      external: c.snapshot(),
      ...options,
    }).values.language,
    "en",
  );
  token = c.begin(document, "rule-1", time + 30001);
  assert.equal(
    c.settle(
      token,
      { schemaVersion: 1, status: "ready", values: {} },
      time + 30002,
    ),
    true,
  );
  assert.equal(
    evaluateSchedule({
      document,
      base: { language: "en" },
      at: time + 30003,
      external: c.snapshot(),
      ...options,
    }).values.language,
    "zh-HK",
  );
  assert.throws(() =>
    validateScheduleDocument(
      doc([rule({ source: { ...source, entityId: "sensor.temperature" } })]),
      options,
    ),
  );
  assert.throws(() =>
    validateScheduleDocument(
      doc([rule({ source: { ...source, token: "not-permitted" } })]),
      options,
    ),
  );
});

test("transaction seam serializes CAS and history, revalidates reload and preserves failed commits", async () => {
  let bytes = null;
  const history = [];
  let reject = false;
  const adapter = {
    async read() {
      return bytes?.slice() ?? null;
    },
    async commit({ expectedBytes, bytes: next, receipt }) {
      if (reject) throw Error("private failure");
      const matches =
        bytes === null
          ? expectedBytes === null
          : expectedBytes !== null &&
            Buffer.from(bytes).equals(Buffer.from(expectedBytes));
      if (!matches) return false;
      bytes = next.slice();
      history.push(receipt);
      return true;
    },
  };
  const store = createScheduleStore({ adapter, ...options });
  assert.equal(await store.load(), null);
  let saved = await store.replace(doc([rule()]), { expectedRevision: null });
  assert.equal(saved.revision, 0);
  assert.equal(history.length, 1);
  const a = store.replace(doc([]), { expectedRevision: 0 }),
    b = store.replace(doc([rule()]), { expectedRevision: 0 });
  await a;
  await assert.rejects(b, { code: "STALE_REVISION" });
  assert.equal(history.length, 2);
  assert.equal(
    (await createScheduleStore({ adapter, ...options }).load()).rules.length,
    0,
  );
  reject = true;
  await assert.rejects(store.replace(doc([rule()]), { expectedRevision: 1 }), {
    code: "STORAGE_UNAVAILABLE",
  });
  assert.equal((await store.load()).revision, 1);
  assert.equal(history.length, 2);
  bytes = new TextEncoder().encode("{");
  await assert.rejects(store.load());
});

test("raw remote responses reject duplicate keys and obsolete tokens cannot abort current work", () => {
  const document = doc([rule({ source: remote })]),
    time = at("2026-10-15T12:00:00Z"),
    c = createExternalScheduleCoordinator(options);
  c.reset(document);
  const old = c.begin(document, "rule-1", time);
  c.reset(document);
  const current = c.begin(document, "rule-1", time);
  assert.equal(
    c.settleBytes(old, new TextEncoder().encode("{"), time + 1),
    false,
  );
  assert.equal(current.signal.aborted, false);
  const duplicate = new TextEncoder().encode(
    '{"schemaVersion":1,"status":"ready","values":{"language":"en","language":"zh-HK"}}',
  );
  assert.equal(c.settleBytes(current, duplicate, time + 2), false);
  assert.equal(current.signal.aborted, true);
  const next = c.begin(document, "rule-1", time + 30000);
  const response = new TextEncoder().encode(
    JSON.stringify({
      schemaVersion: 1,
      status: "ready",
      values: { language: "bilingual" },
    }),
  );
  assert.equal(c.settleBytes(next, response, time + 30001), true);
  assert.equal(
    evaluateSchedule({
      document,
      base: { language: "en" },
      at: time + 30002,
      external: c.snapshot(),
      ...options,
    }).values.language,
    "bilingual",
  );
});

test("value/depth/array/string bounds and explicitly admitted loopback transport are enforced", () => {
  const openRegistry = { value: () => true },
    custom = { ...options, registry: openRegistry };
  for (const value of [
    "x".repeat(4097),
    Array.from({ length: 257 }, () => 0),
    Object.fromEntries(Array.from({ length: 257 }, (_, i) => ["key" + i, 0])),
  ])
    assert.throws(() =>
      validateScheduleDocument(doc([rule({ values: { value } })]), custom),
    );
  let nested = 0;
  for (let n = 0; n < 10; n++) nested = { a: nested };
  assert.throws(() =>
    validateScheduleDocument(
      doc([rule({ values: { value: nested } })]),
      custom,
    ),
  );
  const localSource = { ...remote, url: "http://127.0.0.1:8123/v1/settings" };
  assert.throws(() =>
    validateScheduleDocument(doc([rule({ source: localSource })]), {
      ...options,
      allowedOrigins: ["http://127.0.0.1:8123"],
    }),
  );
  assert.doesNotThrow(() =>
    validateScheduleDocument(doc([rule({ source: localSource })]), {
      ...options,
      allowedOrigins: ["http://127.0.0.1:8123"],
      allowLoopbackHttp: true,
    }),
  );
});

test("external receipts bind exact schedule identity and cannot survive serialization or same-revision edits", () => {
  const document = doc([rule({ source: remote })]),
    time = at("2026-10-15T12:00:00Z"),
    c = createExternalScheduleCoordinator(options);
  c.reset(document);
  const token = c.begin(document, "rule-1", time);
  c.settle(
    token,
    { schemaVersion: 1, status: "ready", values: { language: "bilingual" } },
    time + 1,
  );
  const external = c.snapshot();
  const changed = structuredClone(document);
  changed.rules[0].label = "Changed same revision";
  assert.equal(
    evaluateSchedule({
      document: changed,
      base: { language: "en" },
      at: time + 2,
      external,
      ...options,
    }).values.language,
    "en",
  );
  assert.equal(
    evaluateSchedule({
      document,
      base: { language: "en" },
      at: time + 2,
      external: JSON.parse(JSON.stringify(external)),
      ...options,
    }).values.language,
    "en",
  );
});

test("cancellation revokes previously captured receipts and snapshot values cannot be mutated", () => {
  const document = doc([rule({ source: remote })]),
    time = at("2026-10-15T12:00:00Z"),
    c = createExternalScheduleCoordinator(options);
  c.reset(document);
  const token = c.begin(document, "rule-1", time);
  c.settle(
    token,
    { schemaVersion: 1, status: "ready", values: { language: "bilingual" } },
    time + 1,
  );
  const external = c.snapshot();
  assert.throws(() => (external["rule-1"].values.language = "zh-HK"));
  c.cancel();
  assert.equal(
    evaluateSchedule({
      document,
      base: { language: "en" },
      at: time + 2,
      external,
      ...options,
    }).values.language,
    "en",
  );
});

test("revision growth cannot publish an oversized schedule or its history receipt", async () => {
  const admitted = { registry: { value: () => true } };
  const document = {
    schemaVersion: 1,
    revision: 9,
    timeZone: "UTC",
    rules: Array.from({ length: 16 }, (_, index) =>
      rule({
        id: "rule-" + index,
        label: "Schedule",
        values: { value: Array.from({ length: 4 }, () => "x".repeat(4000)) },
      }),
    ),
  };
  let remaining =
    SCHEDULE_LIMITS.documentBytes - Buffer.byteLength(JSON.stringify(document));
  for (const item of document.rules)
    for (
      let index = 0;
      index < item.values.value.length && remaining > 0;
      index++
    ) {
      const count = Math.min(90, remaining);
      item.values.value[index] += "x".repeat(count);
      remaining -= count;
    }
  assert.equal(remaining, 0);
  validateScheduleDocument(document, admitted);
  const original = new TextEncoder().encode(JSON.stringify(document));
  let durable = original.slice();
  const history = [];
  const store = createScheduleStore({
    ...admitted,
    adapter: {
      read: async () => durable,
      commit: async ({ bytes, receipt }) => {
        durable = bytes;
        history.push(receipt);
        return true;
      },
    },
  });
  await assert.rejects(store.replace(document, { expectedRevision: 9 }), {
    code: "BYTE_LIMIT",
  });
  assert.deepEqual(durable, original);
  assert.equal(history.length, 0);
  assert.equal((await store.load()).revision, 9);
  document.rules[0].values.value[0] = document.rules[0].values.value[0].slice(
    0,
    -1,
  );
  assert.equal(
    (await store.replace(document, { expectedRevision: 9 })).revision,
    10,
  );
  assert.equal(history.length, 1);
  assert.equal(durable.length, SCHEDULE_LIMITS.documentBytes);
  assert.equal((await store.load()).revision, 10);
});
