"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), { spawnSync } = require("node:child_process");
const script = path.resolve(__dirname, "../scripts/ci/publication-eligibility.ps1");
function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publication-admission-")), work = path.join(root, "work"), origin = path.join(root, "origin.git");
  t.after(() => { const resolved = path.resolve(root); assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("publication-admission-")); fs.rmSync(resolved, { recursive: true, force: true }); });
  git(root, "init", "--bare", origin); git(root, "init", "--initial-branch=main", work);
  git(work, "config", "user.name", "Claude Fable 5.1"); git(work, "config", "user.email", "noreply@anthropic.com");
  fs.writeFileSync(path.join(work, "source.txt"), "main source\n"); git(work, "add", "source.txt"); git(work, "commit", "-m", "Main fixture source");
  const main = git(work, "rev-parse", "HEAD"); git(work, "remote", "add", "origin", origin); git(work, "push", "origin", "main");
  git(work, "checkout", "-b", "preservation"); fs.appendFileSync(path.join(work, "source.txt"), "preservation source\n"); git(work, "commit", "-am", "Preservation fixture source");
  const deferred = git(work, "rev-parse", "HEAD");
  const caller = path.join(root, "caller.ps1");
  // Match the Windows PowerShell Actions caller, including its native-command
  // exit propagation after the invoked script returns.
  fs.writeFileSync(caller, `$ErrorActionPreference = 'Stop'\n& '${script.replace(/'/g, "''")}'\nif ((Test-Path -LiteralPath variable:\\LASTEXITCODE)) { exit $LASTEXITCODE }\n`);
  function run(source, name, blockEvidence = false) {
    const state = path.join(root, name); fs.mkdirSync(state);
    if (blockEvidence) fs.mkdirSync(path.join(state, "material-release-evidence/publication-eligibility.json"), { recursive: true });
    const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", caller], { cwd: work, encoding: "utf8", windowsHide: true, timeout: 30000,
      env: { ...process.env, RUNNER_TEMP: state, GITHUB_SHA: source, GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", GITHUB_OUTPUT: path.join(state, "output"), GITHUB_STEP_SUMMARY: path.join(state, "summary") } });
    const recordPath = path.join(state, "material-release-evidence/publication-eligibility.json");
    return { ...result, record: fs.existsSync(recordPath) && fs.statSync(recordPath).isFile() ? JSON.parse(fs.readFileSync(recordPath, "utf8").replace(/^\uFEFF/, "")) : null,
      output: fs.existsSync(path.join(state, "output")) ? fs.readFileSync(path.join(state, "output"), "utf8").replace(/^\uFEFF/, "") : "" };
  }
  return { work, main, deferred, run };
}
test("Windows PowerShell publication caller distinguishes successful decisions from admission failures", { skip: process.platform !== "win32" }, async t => {
  const f = fixture(t);
  await t.test("eligible exact main source exits zero", () => { const r = f.run(f.main, "eligible"); assert.equal(r.status, 0, r.stderr); assert.equal(r.record.state, "eligible"); assert.equal(r.record.eligible, true); assert.match(r.output, /eligible=true/); });
  await t.test("legitimate deferred task source exits zero without eligibility", () => { const r = f.run(f.deferred, "deferred"); assert.equal(r.record.state, "publication-deferred"); assert.equal(r.record.eligible, false); assert.match(r.output, /eligible=false/); assert.equal(r.status, 0, `Deferred admission caller exit ${r.status}: ${r.stderr}`); });
  await t.test("invalid and missing source remain nonzero", () => { for (const [name, source] of [["invalid", "not-a-sha"], ["missing", "f".repeat(40)]]) { const r = f.run(source, name); assert.notEqual(r.status, 0); assert.equal(r.record.state, "admission-failed"); assert.equal(r.record.eligible, null); assert.equal(r.output, ""); } });
  await t.test("ancestry lookup failure remains nonzero", () => {
    const tree = git(f.work, "rev-parse", "HEAD^{tree}");
    const object = `tree ${tree}\nparent ${"f".repeat(40)}\nauthor Claude Fable 5.1 <noreply@anthropic.com> 1700000000 +0000\ncommitter Claude Fable 5.1 <noreply@anthropic.com> 1700000000 +0000\n\nMissing-parent fixture\n`;
    const created = spawnSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], { cwd: f.work, input: object, encoding: "utf8", windowsHide: true }); assert.equal(created.status, 0);
    const r = f.run(created.stdout.trim(), "ancestry-error"); assert.notEqual(r.status, 0); assert.equal(r.record.state, "admission-failed"); assert.equal(r.record.eligible, null); assert.equal(r.output, "");
  });
  await t.test("final evidence-write failure cannot reach the successful exit", () => { const r = f.run(f.main, "evidence-error", true); assert.notEqual(r.status, 0); assert.equal(r.record, null); });
  await t.test("fetch failure remains nonzero", () => { git(f.work, "remote", "set-url", "origin", path.join(f.work, "missing-origin.git")); const r = f.run(f.main, "fetch-error"); assert.notEqual(r.status, 0); assert.equal(r.record.state, "admission-failed"); assert.equal(r.record.eligible, null); assert.equal(r.output, ""); });
});
