# Native Windows continuation evidence, 2026-10-16

The owner resumed the complete PH00–PH10 roadmap and requested actual Windows tests. This replaces the earlier runtime-test deferral. The complete product remains unfinished.

## Settled dialog actions at e722cf1

The exact root desktop build at `e722cf1b91ccc46465eb449df4abd84d9d6df2a1` was captured after the dialog's animations stopped. The bilingual, light-theme unsaved-preference dialog contains all three actions; the final action wraps onto a second row. Its action area has equal 560 px client and scroll widths. All three button rectangles remain inside the dialog's x=360..920 and y=180..572 bounds. This is a narrow layout result, not a full accessibility or feature verdict.

![Native Windows unsaved preference drafts dialog with all three bilingual actions contained at 1280 by 752 and 150 percent scale](dialog-actions-e722cf1.png)

- Logical viewport: 1280×752; observed device-pixel ratio: 1.5, without scale emulation.
- Raw and promoted PNG: 1920×1128, SHA-256 `cf450358cc4ad6eb1c79cdbd192836ff1b77649ac25c6f4fcbe1c6dc26ee77ad`; copied without modifying the image bytes.
- Executable SHA-256: `47ed433b93e9c924ba510207f670a455c54ec28a5c8c59b5883a8090f5f77c6b`.
- Root build receipt SHA-256: `00d8933d9f763899ccde2023e9c34f4f4da5c77b0bdaf8db28d29fc2665a9273`; produced at `2026-10-16T09:49:49.246Z`.
- Capture interval: `2026-10-16T10:04:39.063Z` to `2026-10-16T10:04:39.245Z`, UTC, from the producer's recorded clock.
- Runtime observation: zero console errors, unhandled exceptions and page errors during `2026-10-16T10:04:39.053Z` to `2026-10-16T10:04:39.250Z` only. Startup history was not observed.
- The owned native window, process ancestry and exact single renderer target were verified before capture. The visible desktop was untouched. The raw and promoted pixels were inspected for the intended state and sensitive content.
- Normal close used background native Enter on the focused admitted discard action. A fresh independent query found all four recorded processes absent; the named hidden desktop was absent with native result code 2. Private process and profile details remain outside the published receipt.

The [exact inventory](current-inventory.json) and [sanitized receipt](dialog-actions-e722cf1.receipt.json) record this state. The earlier transitional capture is deliberately excluded. Complete language, theme, viewport and scale coverage, installation, updates and full product acceptance remain unverified. Earlier evidence below retains its original source bindings.

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

The repaired complete native run discovered **466 tests: 423 passed, nine failed, 34 skipped**. Seven failures were caused by the invocation omitting `TEST_PYTHON3_EXECUTABLE`. Repeating only the affected Kconfig files with the verified interpreter discovered ten cases: eight passed, zero failed and two explicitly skipped. This corrects the invocation evidence, not the complete-run verdict.

The remaining two failures were positive local-TLS integration cases with a 500 ms fixture timeout under severe paging. Both still failed in an unchanged sequential pair. Only these two positive rules now use the already supported bounded 10,000 ms allowance. The corrected pair passed both cases with no skips, retaining request count, worker concurrency, authentication and base/effective-state assertions. The separate unchanged 100 ms timeout/cancellation/capacity case also passed. No production deadline changed. These focused results account for the nine failures but do not fabricate a new combined-suite pass.

The focused SQLite storage and personal-vocabulary recovery run discovered **23 tests: 17 passed, zero failed, six skipped**. Native file-link privilege, ACL privacy and foreign-journal retention limitations remain explicit. A native sharing-denial case verifies rollback and reopened state without treating POSIX mode bits as native ACL proof.

## Exact-byte vendor repair

The committed `scripts/configuration/vendor/kconfiglib.py` and `LICENSE.txt` blobs matched their existing SHA-256 provenance. Native checkout text conversion changed their working bytes to CRLF, correctly triggering `KCONFIG_INTEGRITY_FAILED` before interpreter execution.

The repair marks that vendor directory `-text` and restores the already verified blob bytes. It does not alter the admitted hashes or normalize bytes inside the integrity validator. The regression checks the exact vendor inventory, actual hashes and effective checkout attributes.

## Built runtime evidence

The baseline packaged executable launched through Lowlevel on a task-owned named hidden desktop with an isolated verification profile. Exact process identity and ancestry were checked before CDP access. The entire target list contained exactly one page matching the intended packaged renderer URL.

The actual workspace rendered and the **Discover runtimes** control invoked the native host operation. Its pending state settled. The resulting surface truthfully reported unavailable runtime capability. During the recorded interaction interval, prospective CDP observation reported zero console errors, zero unhandled exceptions and zero page errors. These counts cover that interval only, not unobserved startup history.

Original captures and private process receipts are retained locally pending sanitized evidence promotion. The initial capture SHA-256 is `791f489957b7ece238d006d4cc7f09f1b4a33009b930a5f2f8ecfcb260c6a775`; runtime discovery is `22c07c6e5deda59ffb4db729a06ad94b3f4a7245a41f07274531fe289b9a4784`. They bind to the baseline source above, not later scheduling or test changes.

A later ownership query timed out at its bounded listener-query stage before attachment. That attempt proves no onboarding interaction or capture. No timeout was relabelled as a successful operation.

A bounded retry independently passed ownership proof, opened the real setup dialog and captured its first step. The capture SHA-256 is `8297e58c353390fad2a3af038d7270cf3ef0ae50fca10a19be63a57870b198f0`. Its recorded observation interval also had zero console, exception and page errors. This proves setup opening and displayed controls, not save/resume or completion. A native HWND-targeted PrintWindow capture was separately retained. Final owned teardown evidence is recorded below.

The final alternate teardown used the supported application close operation after exact process ancestry, listener and page checks. All four recorded process IDs were subsequently absent. Lowlevel reported zero windows on the owned hidden desktop and confirmed that desktop closed. The task-owned persistent Lowlevel server was then stopped after repeated identity checks. Earlier helper receipts retain their actual incomplete verdicts; separate final receipts establish this alternate cleanup route.

## Open acceptance

Release [v0.1.0-build.42.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0-build.42.1) is a normal release bound to `22861aed9678918b5a9a23e319ac5f17719f5d5d`. All five downloaded files match GitHub asset sizes and SHA-256 digests, and the published checksum list and provenance agree. The [asset receipt](release-v0.1.0-build.42.1.json) records those exact bytes. This establishes download integrity for that earlier source, not installation, updates, current-candidate acceptance or full release completeness.

The fixture recovery batch has zero static parse errors across 28 changed non-renderer files and bounded independent assertion-preservation review. It separates unavailable real file-link cases from hardlink, junction, malformed-data, revision and persistence checks; preserves exact native process protocol assertions; and adds a Windows SQLite sharing-denial/rollback case alongside the four explicitly unverified foreign-journal retention cases. Its complete-run and focused runtime results are recorded above. Native cache ACL privacy remains unverified, and POSIX mode bits are not used as a substitute.

The [scheduled-preferences recovery archive](../../../design/archive/schedule-editor-20261016/README.md) records its exact source bytes and the incomplete twelve-case browser verdict. No candidate acceptance is inferred from TypeScript or a single assertion.

- [ ] Complete the native fixture repair groups and establish a new complete-suite result.
- [ ] Complete scheduled-preferences consumers and independently review their browser and native behavior.
- [ ] Promote inspected captures with sanitized source/build/runtime receipts. Owned baseline process, desktop and server teardown is verified separately above.
- [ ] Build and verify the final installer, installation, update, rollback and cancellation paths.
- [ ] Acquire and verify supported WSL/Docker capability before claiming real source-to-image builds.
- [ ] Complete actual guest lifecycle, provider and A/D/C acceptance across the roadmap.

The Status Hub health endpoint responded, but no configured ingest credential was available for this session. No authenticated session or display delivery is claimed. Project-board discovery lacked `read:project`; no scope change was requested. Progress is recorded in the existing [implementation discussion](https://github.com/Ding-Ding-Projects/material-buildroot/discussions/2#discussioncomment-18964848).
