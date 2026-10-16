"use strict";
const crypto = require("node:crypto");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function decodeBase32(text) {
  if (typeof text !== "string" || text.length > 512 || !/^[A-Z2-7]+={0,6}$/i.test(text))
    throw Error("Invalid authenticator secret");
  let bits = 0,
    value = 0,
    bytes = [];
  for (const c of text.replace(/=+$/, "").toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  if (!bytes.length || (bits && (value & ((1 << bits) - 1)) !== 0)) throw Error("Invalid authenticator secret");
  return Buffer.from(bytes);
}
function totp(
  secret,
  { time = Date.now(), period = 30, digits = 6, algorithm = "sha1" } = {},
) {
  if (
    ![6, 7, 8].includes(digits) ||
    !["sha1", "sha256", "sha512"].includes(algorithm) ||
    !Number.isFinite(time) ||
    time < 0 ||
    !Number.isSafeInteger(period) ||
    period < 1
  )
    throw Error("Invalid authenticator parameters");
  const key = Buffer.isBuffer(secret) ? secret : decodeBase32(secret),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / period)));
  const hash = crypto.createHmac(algorithm, key).update(counter).digest(),
    offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits)
    .toString()
    .padStart(digits, "0");
}
function verifyTotp(secret, code, options = {}) {
  const { window = 1, time = Date.now(), period = 30 } = options;
  if (
    !Number.isSafeInteger(window) ||
    window < 0 ||
    window > 2 ||
    typeof code !== "string"
  )
    return false;
  for (let delta = -window; delta <= window; delta++) {
    const at = time + delta * period * 1000;
    if (at < 0) continue;
    const expected = totp(secret, { ...options, time: at });
    if (
      expected.length === code.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))
    )
      return true;
  }
  return false;
}
// The host vault owns secrets. Records and renderer responses contain references only.
function createAuthenticator({ vault, now = Date.now }) {
  if (
    !vault ||
    typeof vault.read !== "function" ||
    typeof vault.write !== "function"
  )
    throw Error("Protected vault required");
  return {
    async enroll({ id, secret }) {
      decodeBase32(secret);
      const reference = typeof vault.forOwner === "function"
        ? await vault.forOwner(id, ["write"]).write(secret)
        : await vault.write(id, secret);
      if (typeof reference !== "string" || !reference)
        throw Error("Invalid vault reference");
      return { id, secretReference: reference };
    },
    async verify(record, code) {
      const secret = typeof vault.forOwner === "function"
        ? await vault.forOwner(record.id, ["read"]).read(record.secretReference)
        : await vault.read(record.secretReference, record.id);
      return verifyTotp(secret, code, { time: now() });
    },
  };
}
function enrollment(input) {
  let value = input;
  if (typeof input === "string") {
    if (input.length > 2048) throw Error("Invalid enrollment");
    const uri = new URL(input);
    if (uri.protocol !== "otpauth:" || uri.hostname !== "totp" || uri.username || uri.password || uri.port || uri.hash) throw Error("Invalid enrollment");
    const keys = [...uri.searchParams.keys()];
    if (new Set(keys).size !== keys.length || keys.some(k => !["secret", "issuer", "algorithm", "digits", "period"].includes(k))) throw Error("Invalid enrollment");
    const label = decodeURIComponent(uri.pathname.slice(1));
    const split = label.indexOf(":");
    const labelIssuer = split < 0 ? "" : label.slice(0, split);
    const issuer = uri.searchParams.get("issuer") || labelIssuer;
    if (labelIssuer && issuer !== labelIssuer) throw Error("Invalid enrollment");
    value = { secret: uri.searchParams.get("secret"), issuer, account: split < 0 ? label : label.slice(split + 1), algorithm: (uri.searchParams.get("algorithm") || "SHA1").toLowerCase(), digits: Number(uri.searchParams.get("digits") || 6), period: Number(uri.searchParams.get("period") || 30) };
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !["secret","issuer","account","algorithm","digits","period"].includes(k))) throw Error("Invalid enrollment");
  const { issuer = "", account, algorithm = "sha1", digits = 6, period = 30 } = value;
  if ([issuer, account].some(v => typeof v !== "string" || v.length > 128 || /[\x00-\x1f\x7f]/.test(v)) || !account.trim() || issuer.includes(":")) throw Error("Invalid enrollment");
  const secret = typeof value.secret === "string" ? value.secret.replace(/\s/g, "").toUpperCase().replace(/=+$/, "") : "";
  const key = decodeBase32(secret);
  try { if (key.length < 10 || key.length > 128) throw Error("Invalid enrollment"); totp(key, { algorithm, digits, period, time: 0 }); } finally { key.fill(0); }
  if (period > 86400) throw Error("Invalid enrollment");
  return { issuer: issuer.trim(), account: account.trim(), secret, algorithm, digits, period };
}
function enrollmentUri(value) {
  const entry = enrollment(value);
  const label = entry.issuer ? `${entry.issuer}:${entry.account}` : entry.account;
  const params = new URLSearchParams({ secret: entry.secret, issuer: entry.issuer, algorithm: entry.algorithm.toUpperCase(), digits: String(entry.digits), period: String(entry.period) });
  return `otpauth://totp/${encodeURIComponent(label)}?${params}`;
}
function generateEnrollment({issuer = "Material Buildroot", account = "Local factor"} = {}) {
  const bytes = crypto.randomBytes(20); let bits = 0, value = 0, secret = "";
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { bits -= 5; secret += alphabet[(value >>> bits) & 31]; } }
  bytes.fill(0);
  return enrollment({issuer, account, secret});
}
module.exports = { totp, verifyTotp, decodeBase32, createAuthenticator, enrollment, enrollmentUri, generateEnrollment };
