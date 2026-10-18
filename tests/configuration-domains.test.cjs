"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveDomains } = require("../src/main/configuration/domains.cjs");
test("component discovery loads and respects enabled component boundaries", t => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "domain-discovery-"));
  t.after(() => fs.rmSync(output, { recursive: true, force: true }));
  const report = "MATERIAL_CONFIG_OUTPUT=/output\nLINUX_DIR=/elsewhere/linux\n";
  fs.writeFileSync(path.join(output, ".config"), "# BR2_LINUX_KERNEL is not set\n");
  assert.deepEqual(resolveDomains({ output }, report), {});
  fs.writeFileSync(path.join(output, ".config"), "BR2_LINUX_KERNEL=y\n");
  assert.throws(() => resolveDomains({ output }, report), { code: "COMPONENT_OUTSIDE_BUILD_OUTPUT" });
  fs.writeFileSync(path.join(output, ".config"), "BR2_LINUX_KERNEL=yes\n");
  assert.deepEqual(resolveDomains({ output }, report), {});
});
