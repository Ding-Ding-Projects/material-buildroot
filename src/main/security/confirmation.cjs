"use strict";
const crypto = require("node:crypto");
function createConfirmationService({ now = Date.now, ttlMs = 120000 } = {}) {
  const pending = new Map(),
    tokens = new Map();
  const binding = (operation, destination) => {
    if (
      typeof operation !== "string" ||
      !operation ||
      typeof destination !== "string" ||
      !destination
    )
      throw Error("Invalid confirmation binding");
    return crypto
      .createHash("sha256")
      .update(JSON.stringify([operation, destination]))
      .digest("hex");
  };
  return {
    challenge({ operation, destination }) {
      const id = crypto.randomUUID(),
        keys = [
          crypto.randomBytes(4).toString("hex"),
          crypto.randomBytes(4).toString("hex"),
        ];
      pending.set(id, {
        binding: binding(operation, destination),
        keys,
        expires: now() + ttlMs,
      });
      return { id, operation, destination, keys, expires: now() + ttlMs };
    },
    confirm({ id, operation, destination, firstKey, secondKey, slider }) {
      const c = pending.get(id);
      pending.delete(id);
      if (
        !c ||
        c.expires <= now() ||
        c.binding !== binding(operation, destination) ||
        firstKey !== c.keys[0] ||
        secondKey !== c.keys[1] ||
        slider !== 1
      )
        throw Error("Confirmation rejected");
      const token = crypto.randomBytes(32).toString("hex");
      tokens.set(token, { binding: c.binding, expires: c.expires });
      return token;
    },
    consume({ token, operation, destination }) {
      const c = tokens.get(token);
      tokens.delete(token);
      if (
        !c ||
        c.expires <= now() ||
        c.binding !== binding(operation, destination)
      )
        throw Error("Confirmation rejected");
      return true;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
}
module.exports = { createConfirmationService };
