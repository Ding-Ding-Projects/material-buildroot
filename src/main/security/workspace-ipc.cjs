"use strict";
const contract = require("./workspace-contract.cjs");

/** Only the exact admitted packaged main frame can reach the local workspace. */
function createWorkspaceIPC({ desktop, service }) {
  const unavailable = () => ({ ok: false, code: "STORAGE_UNAVAILABLE" });
  function admit(event, work) {
    if (!desktop.admitted(event)) return { ok: false, code: "UNAUTHORIZED" };
    if (!service) return unavailable();
    try {
      return work();
    } catch {
      return unavailable();
    }
  }
  return {
    get: (event) => admit(event, () => service.get()),
    export: (event) => admit(event, () => service.exportDocument()),
    mutate: (event, serialized) =>
      admit(event, () => {
        let request;
        try {
          request = contract.parse(serialized);
          contract.request(request);
        } catch {
          return { ok: false, code: "INVALID_REQUEST" };
        }
        return service.mutate(request);
      }),
  };
}
module.exports = { createWorkspaceIPC };
