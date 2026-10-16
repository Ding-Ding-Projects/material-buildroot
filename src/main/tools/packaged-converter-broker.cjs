"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createNativeFileBroker } = require("../security/native-file-broker.cjs");
const { inspectCanonicalPath } = require("../security/file-grants.cjs");
const { fail } = require("./runtime.cjs");
/** Installed application resources only; no renderer paths or configuration enter this loader. */
function createPackagedConverterBroker({ resources = process.resourcesPath, resolveNativeGrant } = {}) {
  if (process.platform !== "win32" || !resources || !path.isAbsolute(resources)) fail("NATIVE_BROKER_UNAVAILABLE");
  const root = path.join(resources, "native-file-broker");
  const file = path.join(root, "broker-manifest.json");
  inspectCanonicalPath(file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 16384) fail("INVALID_BROKER_MANIFEST");
  const manifest = JSON.parse(fs.readFileSync(file,"utf8"));
  if (manifest.schemaVersion !== 1 || manifest.file !== "material-file-broker.exe" ||
      manifest.mechanism !== "appcontainer-handle-job" || !/^[a-f0-9]{64}$/.test(manifest.sha256 || "")) fail("INVALID_BROKER_MANIFEST");
  const bundled = require("./bundled-payloads.cjs").loadBundledPayloads(resources);
  const payloads = Object.create(null);
  for (const [adapterId,toolId] of [["imagemagick","magick"],["ffmpeg","ffmpeg"]]) {
    const record = bundled[toolId];
    if (!record) continue;
    const runtimeRoot = path.dirname(record.path);
    const files = record.files.filter(entry=>entry.path.startsWith(runtimeRoot+path.sep)).map(entry=>({
      path:path.relative(runtimeRoot,entry.path).split(path.sep).join("/"),sha256:entry.sha256,
    }));
    if (!files.some(entry=>entry.path===path.basename(record.path))) fail("INVALID_BROKER_MANIFEST");
    payloads[adapterId]={root:runtimeRoot,executable:path.basename(record.path),files};
  }
  return createNativeFileBroker({brokerPath:path.join(root,manifest.file),brokerSha256:manifest.sha256,payloads,resolveNativeGrant});
}
module.exports={createPackagedConverterBroker};
