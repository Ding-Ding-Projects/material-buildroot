# PH10 implementation evidence

The desktop updater is implemented in `src/main/updates/service.cjs`. Its focused local verification command is `node --test tests/updates.test.cjs`.

The eleven passing tests use a real loopback HTTP server through an injected transport adapter. Production URLs and redirect validation remain HTTPS/pinned GitHub paths. They cover verified discovery/download, explicit unsigned consent, source mismatch, untrusted redirect rejection, corrupt data cleanup, interrupted range resume, pre-install revalidation, cancellation, existing-file reuse and unrelated user-data preservation. These fixtures are not native installer or public-network acceptance proof.

The existing root installer/release entrypoints were inspected: `build-installer.bat` delegates build packaging; `scripts/release/prepare.cjs` preserves existing publication staging, emits the reduced schemaVersion 1 provenance and checksums, and selects Setup.exe, RELEASES and Squirrel full/delta packages. The updater uses Setup.exe, not delta packages. Its source binding resolves the selected GitHub release tag through the commits API and compares that commit to provenance. Unique build-tag releases can share the package's semantic version; installed source identity distinguishes those builds.

No release, publication, commit, push or Windows execution was performed for this work. Windows checks were explicitly deferred by the user. PH10-T03, the native transition/recovery portion of PH10-T04 and full PH10 acceptance remain open. The service's host callback is the explicit handoff boundary; no actual installer is started by it. Release signing, immutable external authenticity and native rollback remain unproven.

## Build 14.1 release readback

[The independent release receipt](../desktop-shell/release-v0.1.0-build.14.1.json) binds normal release `v0.1.0-build.14.1` to source `d236e56824e5d428820a06c2210fedb9d7e9c110`. Both release run 38796364595 and Pages run 38796364007 succeeded for that source. All five assets were downloaded and independently matched against GitHub sizes/digests; all four checksum-covered assets matched downloaded `SHA256SUMS.txt`, and package files matched provenance. The provenance manifest and lock hashes match the tagged Git blobs after the Windows checkout's LF-to-CRLF conversion.

An updater metadata replay using those downloaded files and live GitHub commit resolution returned `available` for the earlier installed source and `current` for the matching source. The focused updater suite passed 11 tests again. No updater schema bug was found. This proves metadata compatibility, not a native update transition.

GitHub reports `draft=false`, `prerelease=false` and `immutable=false`. The uniquely named tag resolves to the expected commit at readback; server-enforced release immutability is not established. This evidence covers the recorded source only, and does not close acceptance for later revisions. Physical Windows testing remains explicitly deferred.
