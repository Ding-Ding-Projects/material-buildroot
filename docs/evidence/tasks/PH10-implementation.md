# PH10 implementation evidence

The desktop updater is implemented in `src/main/updates/service.cjs`. Its focused local verification command is `node --test tests/updates.test.cjs`.

The eleven passing tests use a real loopback HTTP server through an injected transport adapter. Production URLs and redirect validation remain HTTPS/pinned GitHub paths. They cover verified discovery/download, explicit unsigned consent, source mismatch, untrusted redirect rejection, corrupt data cleanup, interrupted range resume, pre-install revalidation, cancellation, existing-file reuse and unrelated user-data preservation. These fixtures are not native installer or public-network acceptance proof.

The existing root installer/release entrypoints were inspected: `build-installer.bat` delegates build packaging; `scripts/release/prepare.cjs` preserves existing publication staging, emits the reduced schemaVersion 1 provenance and checksums, and selects Setup.exe, RELEASES and Squirrel full/delta packages. The updater uses Setup.exe, not delta packages. Its source binding resolves the selected GitHub release tag through the commits API and compares that commit to provenance. Unique build-tag releases can share the package's semantic version; installed source identity distinguishes those builds.

No release, publication, commit, push or Windows execution was performed for this work. Windows checks were explicitly deferred by the user. PH10-T03, the native transition/recovery portion of PH10-T04 and full PH10 acceptance remain open. The service's host callback is the explicit handoff boundary; no actual installer is started by it. Release signing, immutable external authenticity and native rollback remain unproven.
