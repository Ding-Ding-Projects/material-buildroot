"use strict";
const { createIsoProducerOwner } = require("./iso-producer-owner.cjs");
const fail = code => { throw Object.assign(Error(code), { code }); };
/** Internal adapter, constructed only by trusted native composition. No scheduler connection. */
function createIsoWslProducer({ execution, transactions, jobs = 1, onLog }) {
  if (typeof execution?.startIsoProducer !== "function" || typeof transactions?.assertLifecycleLease !== "function" || !Number.isInteger(jobs) || jobs < 1 || jobs > 64) fail("ISO_TRANSACTION_ADAPTER_REQUIRED");
  return async function produce(input, { signal, onOwnership } = {}) {
    if (input.runtime?.kind !== "wsl" || typeof onOwnership !== "function") fail("ISO_TRANSACTION_ADAPTER_REQUIRED");
    const tracker = createIsoProducerOwner(value => execution.validateOwnershipReceipt(value), input.runtime.distribution);
    const handle = await execution.startIsoProducer({ grantId: input.grantId, runtime: input.runtime, target: "all", jobs }, onLog,
      { signal, onOwnership: async receipt => { tracker.observe(receipt); await onOwnership(receipt); } }, transactions, { lease: input.lease, jobId: input.jobId });
    const cancel = () => { void handle.cancel().catch(() => {}); };
    signal?.addEventListener("abort", cancel, { once: true }); if (signal?.aborted) cancel();
    try {
      const result = await handle.completion;
      if (result.state !== "succeeded" || result.code !== 0) return result;
      const precise = tracker.precise();
      const cleanup = await execution.reconcileCleanup(precise);
      if (cleanup.state !== "verified-stopped") return { ...result, state: "runtime-cleanup-failed", cleanup };
      return { ...result, ownership: precise, cleanup };
    } finally { signal?.removeEventListener("abort", cancel); }
  };
}
module.exports = { createIsoWslProducer };
