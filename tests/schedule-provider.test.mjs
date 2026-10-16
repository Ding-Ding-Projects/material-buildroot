import hostTools from './helpers/host-tools.cjs';
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  createScheduleSourceProvider,
  homeAssistantVaultOwner,
} from "../src/main/preferences/schedule-provider.mjs";
import {
  createExternalScheduleCoordinator,
  evaluateSchedule,
} from "../src/shared/scheduled-settings.mjs";
const registry = {
  language: (v) => ["en", "zh-HK", "bilingual"].includes(v),
  "appearance.theme": (v) => ["system", "light", "dark"].includes(v),
};
const makeRule = (source) => ({
  id: "source-rule",
  label: "Source test",
  enabled: true,
  priority: 0,
  startDate: null,
  endDate: null,
  startTime: "00:00",
  endTime: "00:00",
  days: { type: "everyday" },
  values: { language: "bilingual", "appearance.theme": "dark" },
  source,
});
async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "schedule-tls-"));
  execFileSync(
    hostTools.hostTool('openssl'),
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost",
      "-keyout",
      path.join(directory, "key.pem"),
      "-out",
      path.join(directory, "cert.pem"),
    ],
    { stdio: "ignore" },
  );
  const cert = fs.readFileSync(path.join(directory, "cert.pem")),
    seen = [];
  let mode = "ready",
    held = [];
  const server = https.createServer(
    { key: fs.readFileSync(path.join(directory, "key.pem")), cert },
    (req, res) => {
      seen.push({ path: req.url, authorization: req.headers.authorization });
      res.setHeader("content-type", "application/json");
      if (mode === "hold") {
        held.push(res);
        return;
      }
      if (mode === "redirect") {
        res.writeHead(302, { Location: "https://other.invalid/" });
        res.end();
        return;
      }
      if (mode === "oversized") {
        res.end("x".repeat(5000));
        return;
      }
      if (mode === "auth") {
        res.writeHead(401);
        res.end("{}");
        return;
      }
      if (mode === "rate") {
        res.writeHead(429);
        res.end("{}");
        return;
      }
      if (req.url.startsWith("/api/states/")) {
        res.end(
          JSON.stringify({
            entity_id: "input_boolean.focus",
            state: mode === "off" ? "off" : "on",
            attributes: {},
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          schemaVersion: 1,
          status: "ready",
          values: { language: "bilingual", "appearance.theme": "dark" },
        }),
      );
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "https://localhost:" + server.address().port,
    source = {
      type: "https",
      url: origin + "/v1/settings",
      refreshMs: 30000,
      timeoutMs: 500,
      maxResponseBytes: 4096,
    };
  t.after(async () => {
    for (const res of held) res.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const enroll = (kind = "https", extra = {}) => ({
    origin,
    kind,
    privateAddresses: [],
    developmentLoopback: true,
    credentialReference: kind === "https" ? null : "vault:" + randomUUID(),
    ...extra,
  });
  return {
    origin,
    source,
    cert,
    seen,
    enroll,
    setMode: (value) => (mode = value),
    lookup: async () => [{ address: "127.0.0.1", family: 4 }],
  };
}

test("actual local HTTPS with trusted certificate composes core coordinator without applying remote values as base", async (t) => {
  const f = await fixture(t),
    provider = createScheduleSourceProvider({
      registry,
      enrollments: [f.enroll()],
      trustedCa: f.cert,
      lookup: f.lookup,
    }),
    rule = makeRule(f.source),
    document = {
      schemaVersion: 1,
      revision: 0,
      timeZone: "UTC",
      rules: [rule],
    },
    coordinator = createExternalScheduleCoordinator(provider.options()),
    now = Date.now();
  coordinator.reset(document);
  const token = coordinator.begin(document, rule.id, now),
    bytes = await provider.request(rule, { signal: token.signal });
  assert.equal(coordinator.settleBytes(token, bytes, Date.now()), true);
  const base = { language: "en", "appearance.theme": "system" };
  assert.equal(
    evaluateSchedule({
      document,
      base,
      at: Date.now(),
      external: coordinator.snapshot(),
      ...provider.options(),
    }).values.language,
    "bilingual",
  );
  assert.deepEqual(base, { language: "en", "appearance.theme": "system" });
  assert.equal(f.seen.length, 1);
  assert.equal(f.seen[0].authorization, undefined);
  provider.close();
});

test("real HTTPS refuses redirects, oversized bodies, authentication/rate failures and certificate bypass", async (t) => {
  const f = await fixture(t),
    provider = createScheduleSourceProvider({
      registry,
      enrollments: [f.enroll()],
      trustedCa: f.cert,
      lookup: f.lookup,
    }),
    rule = makeRule(f.source);
  for (const [mode, code] of [
    ["redirect", "SOURCE_REDIRECT_DENIED"],
    ["oversized", "SOURCE_RESPONSE_LIMIT"],
    ["auth", "SOURCE_AUTH_REQUIRED"],
    ["rate", "SOURCE_RATE_LIMITED"],
  ]) {
    f.setMode(mode);
    await assert.rejects(provider.request(rule), { code });
  }
  const withoutCa = createScheduleSourceProvider({
    registry,
    enrollments: [f.enroll()],
    lookup: f.lookup,
  });
  f.setMode("ready");
  await assert.rejects(withoutCa.request(rule), {
    code: "SOURCE_TRANSPORT_FAILED",
  });
  provider.close();
  withoutCa.close();
});

test("Home Assistant lookup uses host-held protected reference and stable origin account, maps on/off only", async (t) => {
  const f = await fixture(t),
    enrollment = f.enroll("home-assistant"),
    calls = [],
    provider = createScheduleSourceProvider({
      registry,
      enrollments: [enrollment],
      trustedCa: f.cert,
      lookup: f.lookup,
      vault: {
        read: async (...args) => {
          calls.push(args);
          return "fixture-local-token";
        },
      },
    }),
    rule = makeRule({
      type: "home-assistant",
      baseUrl: f.origin + "/",
      entityId: "input_boolean.focus",
      refreshMs: 30000,
      timeoutMs: 500,
      maxResponseBytes: 4096,
    });
  for (const mode of ["ready", "off"]) {
    f.setMode(mode);
    const response = JSON.parse(
      new TextDecoder().decode(await provider.request(rule)),
    );
    assert.equal(response.status, mode === "off" ? "off" : "ready");
    assert.deepEqual(response.values, {});
  }
  assert.ok(
    calls.every(
      ([ref, owner]) =>
        ref === enrollment.credentialReference &&
        owner === homeAssistantVaultOwner(f.origin),
    ),
  );
  assert.ok(
    f.seen.every((req) => req.authorization === "Bearer fixture-local-token"),
  );
  const missing = createScheduleSourceProvider({
    registry,
    enrollments: [enrollment],
    trustedCa: f.cert,
    lookup: f.lookup,
    vault: {
      read() {
        throw Error("private details");
      },
    },
  });
  await assert.rejects(
    missing.request(rule),
    (e) =>
      e.code === "SOURCE_CREDENTIAL_UNAVAILABLE" &&
      !e.message.includes("private details"),
  );
  provider.close();
  missing.close();
});

test("DNS/IP admission rejects unapproved private, link-local, mapped loopback and mixed answers before sockets", async () => {
  const source = {
      type: "https",
      url: "https://settings.example/v1",
      refreshMs: 30000,
      timeoutMs: 100,
      maxResponseBytes: 4096,
    },
    enrollment = {
      origin: "https://settings.example",
      kind: "https",
      privateAddresses: [],
      developmentLoopback: false,
      credentialReference: null,
    };
  for (const addresses of [
    ["127.0.0.1"],
    ["10.0.0.2"],
    ["169.254.169.254"],
    ["::ffff:127.0.0.1"],
    ["::1"],
    ["fe80::1"],
    ["fd00::1"],
    ["2001:db8::1"],
    ["8.8.8.8", "192.168.1.2"],
  ]) {
    const provider = createScheduleSourceProvider({
      registry,
      enrollments: [enrollment],
      lookup: async () =>
        addresses.map((address) => ({
          address,
          family: address.includes(":") ? 6 : 4,
        })),
    });
    await assert.rejects(provider.request(makeRule(source)), {
      code: "SOURCE_ADDRESS_DENIED",
    });
    provider.close();
  }
  assert.throws(
    () =>
      createScheduleSourceProvider({
        registry,
        enrollments: [{ ...enrollment, privateAddresses: ["10.0.0.2"] }],
      }),
    { code: "INVALID_SOURCE_ENROLLMENT" },
  );
  assert.throws(
    () =>
      createScheduleSourceProvider({
        registry,
        enrollments: [
          {
            ...enrollment,
            origin: "http://settings.example",
            developmentLoopback: true,
          },
        ],
      }),
    { code: "INVALID_SOURCE_ENROLLMENT" },
  );
});

test("timeout/cancellation cover pending DNS and retain bounded capacity until underlying lookup settles", async () => {
  let release, started;
  const ready = new Promise((resolve) => (started = resolve)),
    lookup = new Promise((resolve) => (release = resolve)),
    enrollment = {
      origin: "https://settings.example",
      kind: "https",
      privateAddresses: [],
      developmentLoopback: false,
      credentialReference: null,
    },
    provider = createScheduleSourceProvider({
      registry,
      enrollments: [enrollment],
      maxConcurrent: 1,
      lookup: async () => {
        started();
        return lookup;
      },
    }),
    rule = makeRule({
      type: "https",
      url: "https://settings.example/v1",
      refreshMs: 30000,
      timeoutMs: 100,
      maxResponseBytes: 4096,
    });
  const pending = provider.request(rule);
  await ready;
  await assert.rejects(provider.request(rule), {
    code: "SOURCE_CONCURRENCY_LIMIT",
  });
  await assert.rejects(pending, { code: "SOURCE_TIMEOUT" });
  await assert.rejects(provider.request(rule), {
    code: "SOURCE_CONCURRENCY_LIMIT",
  });
  release([{ address: "8.8.8.8", family: 4 }]);
  await new Promise((resolve) => setImmediate(resolve));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(provider.request(rule, { signal: controller.signal }), {
    code: "SOURCE_CANCELLED",
  });
  provider.close();
});

test("actual in-flight HTTPS cancellation settles generically without response payload or late success", async (t) => {
  const f = await fixture(t);
  f.setMode("hold");
  const provider = createScheduleSourceProvider({
      registry,
      enrollments: [f.enroll()],
      trustedCa: f.cert,
      lookup: f.lookup,
    }),
    controller = new AbortController(),
    pending = provider.request(makeRule(f.source), {
      signal: controller.signal,
    });
  while (!f.seen.length) await new Promise((resolve) => setTimeout(resolve, 2));
  controller.abort();
  await assert.rejects(pending, { code: "SOURCE_CANCELLED" });
  provider.close();
});

test("IPv4-mapped IPv6 pins retain their transport family while matching normalized endpoint identity", async (t) => {
  const f = await fixture(t),
    provider = createScheduleSourceProvider({
      registry,
      enrollments: [f.enroll()],
      trustedCa: f.cert,
      lookup: async () => [{ address: "::ffff:127.0.0.1", family: 6 }],
    });
  assert.ok((await provider.request(makeRule(f.source))).byteLength > 0);
  provider.close();
});
