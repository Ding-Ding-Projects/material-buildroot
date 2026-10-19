"use strict";
const fail = () => { throw Object.assign(Error("ISO producer ownership unverified"), { code: "ISO_TRANSACTION_PRODUCER_OWNER_UNVERIFIED" }); };
/** One reservation followed by exactly one precise owner. Neither record replaces the other. */
function createIsoProducerOwner(validateOwner, distribution) {
  let initial, precise;
  return Object.freeze({
    observe(receipt) {
      validateOwner(receipt);
      if (receipt.kind !== "wsl" || receipt.distribution !== distribution || precise) fail();
      if (!initial) {
        if (receipt.pid !== null || receipt.startTime !== null) fail();
        initial = Object.freeze({ ...receipt }); return initial;
      }
      if (["ownerToken", "distribution", "bootId", "pidNamespace"].some(key => receipt[key] !== initial[key]) || !Number.isSafeInteger(receipt.pid) || receipt.pid < 2 || typeof receipt.startTime !== "string" || !/^[0-9]{1,24}$/.test(receipt.startTime)) fail();
      precise = Object.freeze({ ...receipt }); return precise;
    },
    precise() { if (!precise) fail(); return precise; },
  });
}
module.exports = { createIsoProducerOwner };
