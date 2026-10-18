"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const REASONS = new Set(["clean-exit", "abnormal-exit", "killed", "crashed", "oom", "launch-failed", "integrity-failure", "memory-eviction"]);
/** Host-only, bounded diagnostic receipt. Never copy renderer data or paths. */
function recordRendererExit({ directory, metadata, details, now = () => new Date() }) {
  let temporary;
  try {
    if (!Number.isInteger(details?.exitCode) || details.exitCode < -2147483648 || details.exitCode > 2147483647) return false;
    const receipt = {
      schemaVersion: 1,
      event: "renderer-exit",
      reason: REASONS.has(details.reason) ? details.reason : "unknown",
      exitCode: details.exitCode,
      source: /^[a-f0-9]{40}$/.test(metadata?.source || "") ? metadata.source : null,
      version: typeof metadata?.version === "string" && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]{1,64})?$/.test(metadata.version) ? metadata.version : null,
      timestamp: now().toISOString(),
    };
    fs.mkdirSync(directory, { recursive: true });
    if (!fs.lstatSync(directory).isDirectory() || fs.realpathSync(directory) !== path.resolve(directory)) return false;
    temporary = path.join(directory, `.renderer-exit-${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(temporary, JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, path.join(directory, "renderer-exit.json"));
    temporary = undefined;
    return true;
  } catch { return false; }
  finally { if (temporary) { try { fs.unlinkSync(temporary); } catch {} } }
}
module.exports = { recordRendererExit };
