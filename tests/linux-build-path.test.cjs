"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { spawnSync } = require("node:child_process");
const { LINUX_BUILD_PATH_SCRIPT } = require("../src/main/execution/linux-build-path.cjs");
test("Linux build child preserves toolchains and excludes incompatible inherited path entries", t => {
  const windows = process.platform === "win32";
  const input = "PATH='/opt/cross/bin:/usr/bin:/mnt/c/Program Files/tool:/mnt/c/tools:relative::/home/user/my tools:/home/user/bin'\n" + LINUX_BUILD_PATH_SCRIPT + "printf '%s' \"$PATH\"\n";
  const result = spawnSync(windows ? "wsl.exe" : "/bin/sh", windows ? ["--exec", "/bin/sh", "-s"] : ["-s"], { input, encoding: "utf8", windowsHide: true, timeout: 10000 });
  if (result.error || result.status !== 0) return t.skip("A working Linux shell is unavailable for the child-PATH integration check");
  assert.equal(result.stdout, "/opt/cross/bin:/usr/bin:/home/user/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");
  assert.equal(process.env.PATH?.includes("/opt/cross/bin"), false);
});
