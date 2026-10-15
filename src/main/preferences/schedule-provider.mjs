import https from "node:https";
import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { validateScheduleDocument } from "../../shared/scheduled-settings.mjs";
const require = createRequire(import.meta.url),
  { parse } = require("../security/workspace-contract.cjs");
export class ScheduleProviderError extends Error {
  constructor(code) {
    super("The scheduled settings source is unavailable.");
    this.name = "ScheduleProviderError";
    this.code = code;
  }
}
const fail = (code) => {
  throw new ScheduleProviderError(code);
};
export const homeAssistantVaultOwner = (origin) =>
  "schedule_ha_" +
  createHash("sha256").update(origin).digest("hex").slice(0, 32);
function addressInfo(address) {
  if (typeof address !== "string" || address.includes("%"))
    fail("SOURCE_ADDRESS_DENIED");
  const family = net.isIP(address);
  if (!family) fail("SOURCE_ADDRESS_DENIED");
  if (family === 4) {
    const p = address.split(".").map(Number),
      [a, b, c] = p;
    const loopback = a === 127,
      privateAddress =
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168);
    const denied =
      a === 0 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224;
    return {
      family,
      key: "v4:" + p.join("."),
      loopback,
      privateAddress,
      public: !loopback && !privateAddress && !denied,
    };
  }
  let normalized;
  try {
    normalized = new URL("http://[" + address + "]/").hostname.slice(1, -1);
  } catch {
    fail("SOURCE_ADDRESS_DENIED");
  }
  let input = normalized;
  if (input.includes(".")) {
    const cut = input.lastIndexOf(":"),
      p = input
        .slice(cut + 1)
        .split(".")
        .map(Number);
    input =
      input.slice(0, cut) +
      ":" +
      ((p[0] << 8) | p[1]).toString(16) +
      ":" +
      ((p[2] << 8) | p[3]).toString(16);
  }
  const halves = input.split("::"),
    left = halves[0] ? halves[0].split(":") : [],
    right = halves[1] ? halves[1].split(":") : [],
    groups =
      halves.length === 2
        ? [
            ...left,
            ...Array(8 - left.length - right.length).fill("0"),
            ...right,
          ]
        : left,
    parts = groups.map((v) => parseInt(v, 16));
  if (parts.length !== 8) fail("SOURCE_ADDRESS_DENIED");
  if (parts.slice(0, 5).every((v) => v === 0) && parts[5] === 65535)
    return {
      ...addressInfo(
        [parts[6] >> 8, parts[6] & 255, parts[7] >> 8, parts[7] & 255].join(
          ".",
        ),
      ),
      family: 6,
    };
  const loopback = parts.slice(0, 7).every((v) => v === 0) && parts[7] === 1,
    privateAddress = (parts[0] & 0xfe00) === 0xfc00,
    global = (parts[0] & 0xe000) === 0x2000,
    excluded =
      parts[0] === 0x2002 ||
      (parts[0] === 0x2001 && (parts[1] === 0 || parts[1] === 0x0db8));
  return {
    family,
    key: "v6:" + parts.map((v) => v.toString(16)).join(":"),
    loopback,
    privateAddress,
    public: global && !excluded,
  };
}
function exact(v, keys) {
  return (
    v &&
    Object.getPrototypeOf(v) === Object.prototype &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k))
  );
}
/** All enrollment and credential references are trusted host configuration, never renderer authority. */
export function createScheduleSourceProvider({
  enrollments,
  registry,
  vault,
  lookup = (host, opts) => dns.lookup(host, opts),
  trustedCa,
  maxConcurrent = 2,
} = {}) {
  if (
    !Array.isArray(enrollments) ||
    enrollments.length > 32 ||
    !Number.isInteger(maxConcurrent) ||
    maxConcurrent < 1 ||
    maxConcurrent > 4 ||
    typeof lookup !== "function"
  )
    fail("INVALID_SOURCE_ENROLLMENT");
  const admitted = new Map();
  for (const enrollment of enrollments) {
    if (
      !exact(enrollment, [
        "origin",
        "kind",
        "privateAddresses",
        "developmentLoopback",
        "credentialReference",
      ]) ||
      !["https", "home-assistant"].includes(enrollment.kind) ||
      typeof enrollment.origin !== "string" ||
      !Array.isArray(enrollment.privateAddresses) ||
      enrollment.privateAddresses.length > 16 ||
      typeof enrollment.developmentLoopback !== "boolean"
    )
      fail("INVALID_SOURCE_ENROLLMENT");
    let url;
    try {
      url = new URL(enrollment.origin);
    } catch {
      fail("INVALID_SOURCE_ENROLLMENT");
    }
    if (
      url.origin !== enrollment.origin ||
      url.username ||
      url.password ||
      !["https:", "http:"].includes(url.protocol) ||
      (url.protocol === "http:" && !enrollment.developmentLoopback) ||
      admitted.has(url.origin)
    )
      fail("INVALID_SOURCE_ENROLLMENT");
    const host = url.hostname.replace(/^\[|\]$/g, ""),
      loopbackHost = ["localhost", "127.0.0.1", "::1"].includes(host);
    if (enrollment.developmentLoopback && !loopbackHost)
      fail("INVALID_SOURCE_ENROLLMENT");
    const privateKeys = enrollment.privateAddresses.map((address) => {
      const info = addressInfo(address);
      if (enrollment.kind !== "home-assistant" || !info.privateAddress)
        fail("INVALID_SOURCE_ENROLLMENT");
      return info.key;
    });
    if (
      (enrollment.kind === "https" &&
        enrollment.credentialReference !== null) ||
      (enrollment.kind === "home-assistant" &&
        (typeof enrollment.credentialReference !== "string" ||
          !/^vault:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
            enrollment.credentialReference,
          ) ||
          !vault ||
          typeof vault.read !== "function"))
    )
      fail("INVALID_SOURCE_ENROLLMENT");
    admitted.set(url.origin, { ...enrollment, privateKeys });
  }
  const active = new Set();
  let closed = false;
  const options = {
    registry,
    allowedOrigins: [...admitted.keys()],
    allowLoopbackHttp: enrollments.some((e) => e.developmentLoopback),
  };
  async function response(url, source, enrollment, signal) {
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    let answers;
    try {
      answers = net.isIP(hostname)
        ? [{ address: hostname, family: net.isIP(hostname) }]
        : await lookup(hostname, { all: true, verbatim: true });
    } catch {
      fail("SOURCE_DNS_UNAVAILABLE");
    }
    if (signal.aborted) fail("SOURCE_CANCELLED");
    if (!Array.isArray(answers) || answers.length < 1 || answers.length > 16)
      fail("SOURCE_ADDRESS_DENIED");
    for (const answer of answers) {
      const info = addressInfo(answer.address);
      if (
        !(
          info.public ||
          (enrollment.developmentLoopback && info.loopback) ||
          (enrollment.kind === "home-assistant" &&
            enrollment.privateKeys.includes(info.key))
        )
      )
        fail("SOURCE_ADDRESS_DENIED");
    }
    const pinned = answers[0],
      pinnedInfo = addressInfo(pinned.address),
      headers = { Accept: "application/json", "Accept-Encoding": "identity" };
    if (enrollment.kind === "home-assistant") {
      let token;
      try {
        token = await vault.read(
          enrollment.credentialReference,
          homeAssistantVaultOwner(enrollment.origin),
        );
      } catch {
        fail("SOURCE_CREDENTIAL_UNAVAILABLE");
      }
      if (signal.aborted) fail("SOURCE_CANCELLED");
      if (
        typeof token !== "string" ||
        !token ||
        token.length > 8192 ||
        /[\u0000-\u0020\u007f]/u.test(token)
      )
        fail("SOURCE_CREDENTIAL_UNAVAILABLE");
      headers.Authorization = "Bearer " + token;
    }
    return new Promise((resolve, reject) => {
      let request;
      const rejectCode = (code) => reject(new ScheduleProviderError(code));
      const transport = url.protocol === "https:" ? https : http;
      request = transport.request(
        url,
        {
          method: "GET",
          headers,
          agent: false,
          signal,
          ca: trustedCa,
          rejectUnauthorized: true,
          lookup: (_host, _opts, callback) =>
            _opts.all
              ? callback(null, [
                  { address: pinned.address, family: pinnedInfo.family },
                ])
              : callback(null, pinned.address, pinnedInfo.family),
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400) {
            res.destroy();
            rejectCode("SOURCE_REDIRECT_DENIED");
            return;
          }
          if (res.statusCode !== 200) {
            res.destroy();
            rejectCode(
              res.statusCode === 401 || res.statusCode === 403
                ? "SOURCE_AUTH_REQUIRED"
                : res.statusCode === 429
                  ? "SOURCE_RATE_LIMITED"
                  : "SOURCE_RESPONSE_FAILED",
            );
            return;
          }
          if (
            (res.headers["content-encoding"] &&
              res.headers["content-encoding"] !== "identity") ||
            !/^application\/json(?:\s*;|$)/i.test(
              res.headers["content-type"] || "",
            )
          ) {
            res.destroy();
            rejectCode("SOURCE_RESPONSE_INVALID");
            return;
          }
          const chunks = [];
          let bytes = 0;
          res.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > source.maxResponseBytes) {
              res.destroy();
              request.destroy();
              rejectCode("SOURCE_RESPONSE_LIMIT");
            } else chunks.push(chunk);
          });
          res.on("error", () =>
            rejectCode(
              signal.aborted ? "SOURCE_CANCELLED" : "SOURCE_RESPONSE_FAILED",
            ),
          );
          res.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
        },
      );
      request.on("socket", (socket) => {
        socket.once(
          url.protocol === "https:" ? "secureConnect" : "connect",
          () => {
            try {
              if (addressInfo(socket.remoteAddress).key !== pinnedInfo.key) {
                request.destroy();
                rejectCode("SOURCE_ADDRESS_DENIED");
              }
            } catch {
              request.destroy();
              rejectCode("SOURCE_ADDRESS_DENIED");
            }
          },
        );
      });
      request.on("error", () =>
        rejectCode(
          signal.aborted ? "SOURCE_CANCELLED" : "SOURCE_TRANSPORT_FAILED",
        ),
      );
      request.end();
    });
  }
  return Object.freeze({
    options: () => ({
      ...options,
      allowedOrigins: [...options.allowedOrigins],
    }),
    async request(rule, { signal } = {}) {
      if (closed) fail("SOURCE_PROVIDER_CLOSED");
      if (active.size >= maxConcurrent) fail("SOURCE_CONCURRENCY_LIMIT");
      let checked;
      try {
        checked = validateScheduleDocument(
          { schemaVersion: 1, revision: 0, timeZone: "UTC", rules: [rule] },
          options,
        ).rules[0];
      } catch {
        fail("SOURCE_NOT_ENROLLED");
      }
      const source = checked.source;
      if (source.type === "local") fail("SOURCE_NOT_ENROLLED");
      const url = new URL(
          source.type === "https"
            ? source.url
            : source.baseUrl + "api/states/" + source.entityId,
        ),
        enrollment = admitted.get(url.origin);
      if (!enrollment || enrollment.kind !== source.type)
        fail("SOURCE_NOT_ENROLLED");
      const controller = new AbortController();
      active.add(controller);
      let timer,
        reason = "SOURCE_CANCELLED",
        abort;
      const cancelled = new Promise((_, reject) => {
        abort = () => {
          controller.abort();
          reject(new ScheduleProviderError(reason));
        };
        controller.signal.addEventListener(
          "abort",
          () => reject(new ScheduleProviderError(reason)),
          { once: true },
        );
      });
      const parentAbort = () => abort();
      if (signal?.aborted) parentAbort();
      else signal?.addEventListener("abort", parentAbort, { once: true });
      timer = setTimeout(() => {
        reason = "SOURCE_TIMEOUT";
        abort();
      }, source.timeoutMs);
      const operation = (async () => {
        if (controller.signal.aborted) fail("SOURCE_CANCELLED");
        const bytes = await response(
          url,
          source,
          enrollment,
          controller.signal,
        );
        if (controller.signal.aborted) fail("SOURCE_CANCELLED");
        if (source.type === "https") return bytes;
        let value;
        try {
          value = parse(
            new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          );
        } catch {
          fail("SOURCE_RESPONSE_INVALID");
        }
        if (
          !value ||
          value.entity_id !== source.entityId ||
          !["on", "off"].includes(value.state)
        )
          fail("SOURCE_RESPONSE_INVALID");
        return new TextEncoder().encode(
          JSON.stringify({
            schemaVersion: 1,
            status: value.state === "on" ? "ready" : "off",
            values: {},
          }),
        );
      })();
      operation.finally(() => active.delete(controller)).catch(() => {});
      try {
        return await Promise.race([operation, cancelled]);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", parentAbort);
      }
    },
    cancelAll() {
      for (const controller of active) controller.abort();
    },
    close() {
      closed = true;
      for (const controller of active) controller.abort();
    },
  });
}
