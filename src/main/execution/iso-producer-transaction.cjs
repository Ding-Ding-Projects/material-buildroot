"use strict";
const crypto = require("node:crypto");
const { assertIsoOutputPolicy } = require("../jobs/iso-output-policy.cjs");
const { createIsoTransactionStore } = require("../jobs/iso-transaction-store.cjs");
const SHA = /^[a-f0-9]{64}$/;
const fail = code => { throw Object.assign(Error(code), { code }); };
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const copy = value => JSON.parse(JSON.stringify(value));
const keys = (value, expected) => value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).sort().join() === expected.split(",").sort().join();
/** Internal, unexposed coordinator. Production adapters must explicitly support this lease. */
function createIsoProducerTransactions({ execution, directory, adapters }) {
  if (!execution?.grants || !execution?.locks || ["current", "prepare", "produce", "capture", "inspectCleanup", "validateOwner"].some(key => typeof adapters?.[key] !== "function")) fail("ISO_TRANSACTION_ADAPTER_REQUIRED");
  const store = createIsoTransactionStore(directory), leases = new WeakMap();
  function assertLease(lease, jobId) {
    const state = leases.get(lease);
    if (!state || state.jobId !== jobId || state.roots.some(root => !execution.locks.has(root)) || execution.grants.get(state.grantId) !== state.grant) fail("ISO_TRANSACTION_LEASE_REQUIRED");
    return state;
  }
  async function run(request, { signal } = {}) {
    if (!request || Object.keys(request).sort().join() !== "grantId,jobId,policy,runtime" || request.runtime?.kind !== "wsl" || Object.keys(request.runtime).sort().join() !== "distribution,kind") fail("ISO_TRANSACTION_INVALID_REQUEST");
    const fixed = freeze(copy(request)); assertIsoOutputPolicy(fixed.policy, "all");
    const grant = execution.grants.get(fixed.grantId);
    if (!grant?.wslReceipt || grant.wslReceipt.storage.distribution !== fixed.runtime.distribution) fail("ISO_TRANSACTION_AUTHORITY_REQUIRED");
    const roots = [grant.root, grant.source, grant.output];
    if (new Set(roots).size !== 3 || roots.some(root => typeof root !== "string" || execution.locks.has(root))) fail("ISO_TRANSACTION_PROJECT_BUSY");
    const admittedReceipt = grant.wslReceipt;
    const lease = Object.freeze({}), state = { jobId: fixed.jobId, grantId: fixed.grantId, grant, roots, runtime: fixed.runtime, admittedReceipt };
    roots.forEach(root => execution.locks.add(root)); leases.set(lease, state);
    let journal, stage = "admission", binding, completed = false, reserved = false;
    async function current() {
      if (signal?.aborted) fail("ISO_TRANSACTION_CANCELLED");
      assertLease(lease, fixed.jobId);
      if (grant.wslReceipt !== admittedReceipt || roots.some((root, index) => root !== [grant.root, grant.source, grant.output][index])) fail("ISO_TRANSACTION_AUTHORITY_CHANGED");
      const value = await adapters.current({ lease, jobId: fixed.jobId, grantId: fixed.grantId, runtime: fixed.runtime });
      if (!value || Object.keys(value).sort().join() !== "configurationSha256,projectProofSha256,sourceSha256" || !Object.values(value).every(hash => typeof hash === "string" && SHA.test(hash)) || value.configurationSha256 !== fixed.policy.appliedConfigurationRevision) fail("ISO_TRANSACTION_INPUT_CHANGED");
      const serialized = JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])));
      if (binding && serialized !== binding) fail("ISO_TRANSACTION_INPUT_CHANGED");
      binding = serialized;
      assertLease(lease, fixed.jobId);
      if (signal?.aborted) fail("ISO_TRANSACTION_CANCELLED");
    }
    async function invoke(name, extra = {}) {
      stage = name; await current(); journal.append("stage", { stage });
      const owners = [];
      const onOwnership = async receipt => {
        assertLease(lease, fixed.jobId); adapters.validateOwner(receipt);
        const owner = freeze(copy(receipt));
        if (owner.kind !== "wsl" || owner.distribution !== fixed.runtime.distribution) fail("ISO_TRANSACTION_OWNER_CHANGED");
        journal.append("ownership", { stage, receipt: owner }); owners.push(owner);
        await current();
      };
      const result = await adapters[name]({ lease, ...fixed, ...extra }, { signal, onOwnership });
      if (!owners.length || result?.state !== "succeeded" || result.code !== 0) fail("ISO_TRANSACTION_STAGE_UNVERIFIED");
      // Independent owner inspection is mandatory, even when the adapter reports cleanup success.
      for (const owner of owners) {
        const cleanup = await adapters.inspectCleanup(owner);
        journal.append("cleanup", { stage, receipt: owner, verdict: cleanup });
        if (cleanup?.state !== "verified-stopped") fail("ISO_TRANSACTION_CLEANUP_UNVERIFIED");
      }
      await current(); return result;
    }
    try {
      await current();
      journal = store.begin(fixed.jobId, { ...fixed, binding: JSON.parse(binding) }, () => { reserved = true; });
      const prepared = await invoke("prepare"), preparation = prepared.observation;
      if (!keys(preparation, "state,jobId,preparationSha256,prior,jobBound,bootVerified")) fail("ISO_TRANSACTION_PREPARATION_UNVERIFIED");
      if (preparation?.state !== "prepared-unbound" || preparation.jobId !== fixed.jobId || !SHA.test(preparation.preparationSha256 || "") || preparation.jobBound !== false || preparation.bootVerified !== false) fail("ISO_TRANSACTION_PREPARATION_UNVERIFIED");
      journal.append("preparation", preparation);
      await invoke("produce", { preparationSha256: preparation.preparationSha256 });
      const captured = await invoke("capture", { preparationSha256: preparation.preparationSha256 }), observation = captured.observation, output = observation?.output;
      if (!keys(observation, "state,jobId,preparationSha256,output,jobBound,producerVerified,cleanupVerified,bootVerified") || !keys(output, "sha256,bytes,identity,structure") || !keys(output.structure, "descriptorValid,withinImage,biosCatalogValid,bootVerified")) fail("ISO_TRANSACTION_OUTPUT_UNVERIFIED");
      if (observation?.state !== "fresh-file-observed-unbound" || observation.jobId !== fixed.jobId || observation.preparationSha256 !== preparation.preparationSha256 || observation.jobBound !== false || observation.producerVerified !== false || observation.cleanupVerified !== false || observation.bootVerified !== false || !output || !SHA.test(output.sha256 || "") || !Number.isSafeInteger(output.bytes) || output.bytes < 1 || output.bytes > 4 * 1024 ** 3 || !Array.isArray(output.identity) || output.identity.length !== 9 || !output.identity.every(value => typeof value === "string" && /^(0|[1-9][0-9]{0,19})$/.test(value)) || output.structure?.descriptorValid !== true || output.structure.withinImage !== true || output.structure.biosCatalogValid !== true || output.structure.bootVerified !== false) fail("ISO_TRANSACTION_OUTPUT_UNVERIFIED");
      if (preparation.prior && JSON.stringify(preparation.prior.identity) === JSON.stringify(output.identity)) fail("ISO_TRANSACTION_STALE_OUTPUT");
      await current();
      const receipt = freeze({ version: 1, jobId: fixed.jobId, runtime: fixed.runtime, policy: fixed.policy, binding: JSON.parse(binding), preparationSha256: preparation.preparationSha256, output: copy(output), jobBound: true, producerVerified: true, cleanupVerified: true, bootVerified: false });
      const receiptRecordSha256 = journal.complete(receipt);
      completed = true;
      return freeze({ state: "succeeded", receipt, receiptRecordSha256 });
    } catch (error) {
      // The complete history remains on disk. No recovery record is cleared on failure.
      if (journal) journal.append("incomplete", { stage, code: /^ISO_TRANSACTION_[A-Z_]+$/.test(error.code || "") ? error.code : "ISO_TRANSACTION_UNVERIFIED" });
      throw error;
    } finally {
      leases.delete(lease);
      // Incomplete durable work retains its reservation until separately verified recovery.
      if (completed || !reserved) roots.forEach(root => execution.locks.delete(root));
    }
  }
  function assertLifecycleLease(lease, context) {
    const state = assertLease(lease, context.jobId);
    if (context.execution !== execution || context.grantId !== state.grantId ||
        context.runtime?.kind !== state.runtime.kind || context.runtime?.distribution !== state.runtime.distribution ||
        state.grant.wslReceipt !== state.admittedReceipt || !Array.isArray(context.roots) || context.roots.length !== 3 ||
        state.roots.some((root, index) => root !== context.roots[index] || root !== [state.grant.root, state.grant.source, state.grant.output][index])) fail("ISO_TRANSACTION_LEASE_REQUIRED");
  }
  return Object.freeze({ run, assertLease, assertLifecycleLease });
}
module.exports = { createIsoProducerTransactions };
