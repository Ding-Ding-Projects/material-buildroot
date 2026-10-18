"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { spawnSync } = require("node:child_process");
const { validateNativeIntent } = require("../src/main/jobs/wsl-build-intent.cjs");
test("native receipt rejects forged bounds, extra private fields and unbound links", () => {
  const receipt = { sourceRevision: "a".repeat(64), configRevision: "b".repeat(64), snapshot: { version: 3, entries: 4, bytes: 10, symlinks: 1, symlinkPolicy: "internal-content-and-missing-targets", excludesGitObjectHistory: true, limitations: [], limits: { maxEntries: 50000, maxBytes: 536870912, maxFileBytes: 67108864, maxMs: 10000, maxDepth: 64 }, downloadCache: null } };
  assert.equal(validateNativeIntent(receipt), receipt);
  for (const mutate of [r => r.sourceBytes = "private", r => r.snapshot.path = "/private", r => r.snapshot.bytes = 536870913, r => r.snapshot.limits.maxFileBytes++, r => r.snapshot.symlinkPolicy = "link-text-only", r => r.snapshot.downloadCache = { disposition: "anything" }]) {
    const changed = structuredClone(receipt); mutate(changed); assert.throws(() => validateNativeIntent(changed), { code: "BLOCKED_CONTENT_INVALID_RESPONSE" });
  }
});
test("real native walker binds referents and explicit cache bytes without weakening source and shared limits", t => {
  if (process.platform === "win32" && !process.env.MATERIAL_TEST_WSL_DISTRIBUTION) return t.skip("Select a non-root Python-capable WSL fixture distribution explicitly");
  const helper = fs.readFileSync(path.resolve(__dirname, "../scripts/configuration/capture-intent.py")).toString("base64");
  const program = String.raw`import os,sys,json,base64,tempfile,pathlib,shutil
if os.getuid()==0:
 print(json.dumps({'skip':'non-root Linux account unavailable'}));sys.exit(0)
ns={'__name__':'fixture'};exec(compile(base64.b64decode('${helper}'),'trusted-helper','exec'),ns)
capture=ns['capture'];Blocked=ns['Blocked'];checks=[]
root=pathlib.Path(tempfile.mkdtemp(prefix='native-intent-test-'))
try:
 source=root/'source';output=root/'output';source.mkdir();output.mkdir()
 (source/'Config.in').write_text('config SAMPLE\n');(source/'target').write_text('one');(source/'link').symlink_to('target')
 (output/'.config').write_text('BR2_DL_DIR="$(TOPDIR)/dl"\n')
 request={'source':str(source),'output':str(output)}
 def blocked(code):
  try:capture(request)
  except Blocked as e:assert str(e)==code,(str(e),code);return
  raise AssertionError('expected blocked result')
 first=capture(request);assert first['snapshot']['symlinks']==1 and first['snapshot']['limitations']==[]
 (source/'target').write_text('two');assert capture(request)['sourceRevision']!=first['sourceRevision'];checks.append('referent content revalidation')
 (root/'outside').write_text('outside');(source/'escape').symlink_to(root/'outside');blocked('BLOCKED_CONTENT_UNBOUND_SYMLINK');(source/'escape').unlink();checks.append('existing outside referent rejected')
 (source/'dangling').symlink_to('appears')
 original=os.path.lexists;created=[False]
 def appearance(p):
  answer=original(p)
  if str(p)==str(source/'appears') and not answer and not created[0]:
   created[0]=True;(source/'appears').write_text('late')
  return answer
 os.path.lexists=appearance
 try:blocked('BLOCKED_CONTENT_CHANGED')
 finally:os.path.lexists=original
 (source/'appears').unlink();(source/'dangling').unlink();checks.append('missing target appearance rejected')
 with (source/'large').open('wb') as f:f.truncate(64*1024*1024+1)
 blocked('BLOCKED_CONTENT_LIMIT');(source/'large').unlink();checks.append('source 64 MiB boundary')
 cache=source/'dl';cache.mkdir()
 with (cache/'archive').open('wb') as f:f.truncate(65*1024*1024)
 cached=capture(request);assert cached['snapshot']['downloadCache']['bytes']==65*1024*1024
 (cache/'archive').write_bytes(b'changed');assert capture(request)['sourceRevision']!=cached['sourceRevision'];checks.append('all cache bytes and revalidation')
 with (cache/'archive').open('wb') as f:f.truncate(256*1024*1024+1)
 blocked('BLOCKED_CONTENT_LIMIT');(cache/'archive').unlink();checks.append('cache 256 MiB boundary')
 for name in ['a','b']:
  with (cache/name).open('wb') as f:f.truncate(256*1024*1024)
 blocked('BLOCKED_CONTENT_LIMIT')
 for name in ['a','b']:(cache/name).unlink()
 checks.append('combined 512 MiB boundary')
 (output/'.config').write_text('BR2_DL_DIR="/unsupported"\n');blocked('BLOCKED_CACHE_DISPOSITION_UNSUPPORTED');checks.append('unsupported cache declaration rejected')
 (output/'.config').write_text('BR2_DL_DIR="$(TOPDIR)/dl"\n');cache.rmdir();cache.symlink_to(root,target_is_directory=True);blocked('BLOCKED_CONTENT_UNSAFE');cache.unlink();checks.append('cache alias rejected')
 (source/'hardlink').hardlink_to(source/'target');blocked('BLOCKED_CONTENT_UNSAFE');(source/'hardlink').unlink();checks.append('hardlink rejected')
 request['limits']={'maxEntries':1};blocked('BLOCKED_CONTENT_LIMIT');checks.append('entry bound')
 print(json.dumps({'ok':True,'checks':checks}))
finally:
 assert root.parent==pathlib.Path(tempfile.gettempdir()) and root.name.startswith('native-intent-test-')
 shutil.rmtree(root)
`;
  const windows = process.platform === "win32";
  const result = spawnSync(windows ? "wsl.exe" : "python3", windows ? ["--distribution", process.env.MATERIAL_TEST_WSL_DISTRIBUTION, "--exec", "python3", "-I", "-B", "-"] : ["-I", "-B", "-"], { input: program, encoding: "utf8", windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true, report.skip); assert.equal(report.checks.length, 11);
});
