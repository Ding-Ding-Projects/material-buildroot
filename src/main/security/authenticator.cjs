"use strict";
const crypto = require("node:crypto");
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function decodeBase32(text) {
  if (typeof text !== "string" || !/^[A-Z2-7]+={0,6}$/i.test(text))
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
      const reference = await vault.write(id, secret);
      if (typeof reference !== "string" || !reference)
        throw Error("Invalid vault reference");
      return { id, secretReference: reference };
    },
    async verify(record, code) {
      const secret = await vault.read(record.secretReference);
      return verifyTotp(secret, code, { time: now() });
    },
  };
}
module.exports = { totp, verifyTotp, decodeBase32, createAuthenticator };
