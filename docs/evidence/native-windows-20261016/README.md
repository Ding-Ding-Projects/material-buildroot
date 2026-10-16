# Native Windows continuation evidence, 2026-10-16

The owner resumed the complete PH00–PH10 roadmap and requested actual Windows tests. This replaces the earlier runtime-test deferral. The complete product remains unfinished.

## Exact baseline

- Source: `1b7ea15359ac2870a9f8bc02889770db4cb48d08`.
- Host platform observed: Windows 11 IoT Enterprise LTSC, version `10.0.26100`, build `26100`, x64. This is current-host evidence, not newest-stable or fresh-environment proof.
- Exact command: `build.bat /s --target desktop`.
- Result: successful desktop package build after the maintainer-local currency lock was explicitly refreshed following instruction synchronization.
- Build receipt SHA-256: `b834005e5e2888f615e9ddfc7fc8b607b6c3752aa66786f6fa9663a53ff897aa`.
- Verified portable tools: Node `24.22.0`, MinGit `2.56.0.2`, desktop runtime `44.7.2`.

The first entrypoint attempt stopped at the stale maintainer currency lock. It did not produce an accepted desktop build. The successful second attempt reused hash-verified tool caches and installed exact locked packages with lifecycle scripts disabled. No administrator rights or machine-wide installation was required for this build.

## Test results

The focused `tests/build.test.cjs` run passed all six tests, with no skips. It exercised actual PowerShell 5.1 portable-tree activation and recovery, a real native junction escape, source/index admission, interrupted output activation, and Squirrel package-record validation. Synthetic package bytes in the last test are not installer acceptance.

The fresh complete Node baseline discovered **444 tests: 361 passed, 74 failed, nine skipped**. It is a failing baseline, not a product acceptance result. The main portability groups were extensionless executable fixtures, hardcoded POSIX Python paths, OpenSSL discovery, native file-link privileges, POSIX permissions/signals, and open SQLite journal replacement assumptions.

A later focused discovery/TLS/Kconfig run discovered **47 tests: 44 passed, zero failed, three skipped**. It used a real discovered Python interpreter and OpenSSL executable. The skips are one pre-existing opt-in downloaded-source case and two explicitly separated file-symbolic-link cases unavailable under the current native privilege. Parent assertions for malformed descriptors, corrupted metadata and oversized files still run. This focused result does not replace the failing complete baseline.

A separate complete `tests/tools.test.cjs` run passed **16 tests, zero failed and zero skipped**. Its Windows fixtures are genuine test-owned PE executables compiled with the installed Framework64 compiler. They launch the pinned Node executable directly with quoted arguments and use an unnamed native job with kill-on-close behavior. Consent, grants, actual child existence/disappearance, PDF output, page selection and queue assertions remain. Independent correctness/security review found no actionable defect in that batch. The helper assumes the selected x64 host and does not establish 32-bit support or production admission of arbitrary fixture sidecars.

## Exact-byte vendor repair

The committed `scripts/configuration/vendor/kconfiglib.py` and `LICENSE.txt` blobs matched their existing SHA-256 provenance. Native checkout text conversion changed their working bytes to CRLF, correctly triggering `KCONFIG_INTEGRITY_FAILED` before interpreter execution.

The repair marks that vendor directory `-text` and restores the already verified blob bytes. It does not alter the admitted hashes or normalize bytes inside the integrity validator. The regression checks the exact vendor inventory, actual hashes and effective checkout attributes.

## Built runtime evidence

The baseline packaged executable launched through Lowlevel on a task-owned named hidden desktop with an isolated verification profile. Exact process identity and ancestry were checked before CDP access. The entire target list contained exactly one page matching the intended packaged renderer URL.

The actual workspace rendered and the **Discover runtimes** control invoked the native host operation. Its pending state settled. The resulting surface truthfully reported unavailable runtime capability. During the recorded interaction interval, prospective CDP observation reported zero console errors, zero unhandled exceptions and zero page errors. These counts cover that interval only, not unobserved startup history.

Original captures and private process receipts are retained locally pending sanitized evidence promotion. The initial capture SHA-256 is `791f489957b7ece238d006d4cc7f09f1b4a33009b930a5f2f8ecfcb260c6a775`; runtime discovery is `22c07c6e5deda59ffb4db729a06ad94b3f4a7245a41f07274531fe289b9a4784`. They bind to the baseline source above, not later scheduling or test changes.

A later ownership query timed out at its bounded listener-query stage before attachment. That attempt proves no onboarding interaction or capture. No timeout was relabelled as a successful operation.

A bounded retry independently passed ownership proof, opened the real setup dialog and captured its first step. The capture SHA-256 is `8297e58c353390fad2a3af038d7270cf3ef0ae50fca10a19be63a57870b198f0`. Its recorded observation interval also had zero console, exception and page errors. This proves setup opening and displayed controls, not save/resume or completion. A native HWND-targeted PrintWindow capture was separately retained. Owned teardown remains pending until its final absence proof.

## Open acceptance

- [ ] Complete the native fixture repair groups and establish a new complete-suite result.
- [ ] Complete scheduled-preferences consumers and independently review their browser and native behavior.
- [ ] Promote inspected captures with sanitized source/build/runtime receipts and finish owned process teardown.
- [ ] Build and verify the final installer, installation, update, rollback and cancellation paths.
- [ ] Acquire and verify supported WSL/Docker capability before claiming real source-to-image builds.
- [ ] Complete actual guest lifecycle, provider and A/D/C acceptance across the roadmap.

The Status Hub health endpoint responded, but no configured ingest credential was available for this session. No authenticated session or display delivery is claimed. Project-board discovery lacked `read:project`; no scope change was requested. Progress is recorded in the existing [implementation discussion](https://github.com/Ding-Ding-Projects/material-buildroot/discussions/2#discussioncomment-18964848).
