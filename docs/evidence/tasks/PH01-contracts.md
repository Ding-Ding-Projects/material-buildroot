# PH01 contract and evidence admission unit

Baseline source revision: `9c8fe848ff7abb1c11fd3d5014fc0ebfa8c60f1a`. This receipt covers planning/evidence source changes after that baseline, not a product build. The integration commit will identify the resulting source. No built product hash, runtime receipt or capture is claimed.

## Changes and disposition

- PH01-T06: P40 all four cloud destinations; P41 Linux SSH process/container and Windows SSH WSL/Docker; P42 USB/SD/physical drives and ISO/guest installation are recorded as the owner's selected scope in DECISIONS.md.
- PH01-T01-C01: 105 catalogue identities reconciled into an explicit disposition baseline. Detailed canonical subrequirements remain pending under PH01-T01-C02; parent T01 stays unchecked.
- PH01-T02-C01: 420 separate A/D/C/R records created, each with a stable ID, applicability reason and independent source/runtime/capture/parity slots. Concrete consumers, articles, copy, persistence and runtime tuples remain pending under C02; parent T02 stays unchecked.
- PH01-T05-C01: local admission-integrity validator and negative fixtures implemented. Full implementation/runtime/parity evidence admission remains pending, so parent T05 stays unchecked.
- PH05-T11 and PH10-T09: separate managed user builds use hosted/self-hosted Linux runners; product build/package delivery uses compatible Windows runners invoking exact root `build.bat` and `build-installer.bat`. Both retain guided/generated/reviewed YAML, source/dedicated execution repository, conditional private transport and no automatic larger billed runner selection.

## Observed local verification

`node scripts/evidence/validate-ledger.cjs` exited 0:

```text
PASS: 105 identities, 420 surface records; admission integrity only, product completion unverified.
```

`node --test tests/evidence-ledger.test.cjs` exited 0: 17 tests, 17 pass, 0 fail, 0 skipped. Negative fixtures reject missing identity, duplicate identity, missing/waived surface, completion with absent proof, stale source/build binding, missing/changed evidence files and stale catalogue. Additional negative cases reject extra surface keys, array/inherited surface maps, traversal and absolute paths, directories and an internal directory link resolving to external proof. The link test ran using a Windows junction on this host, with no skip; Linux uses a directory symlink. Restoring the valid contained proof passes. Valid admission and restored structural completion fixtures pass. Structural completion fixtures are synthetic validator tests, never product acceptance.

## Remaining acceptance

PH01-T03/T04 are unchanged and pending. Full canonical reconciliation, concrete consumer admission, semantic evidence validation, native runtime, responsive/language/theme/scale captures, installer, guest, cloud/SSH/device adapters, encrypted-engine review and release publication remain pending. No product build or capture ran in this unit. All PH00–PH10 scope is retained.

## Structural review repair

Independent review reproduced two acceptance defects: a lexical in-repository path could resolve through a junction outside the repository, and an extra surface record was ignored. The validator now requires a plain object with exactly A/D/C/R own keys, checks lexical and resolved path containment, and requires resolved proof targets to be regular files before hashing. Tests allocate isolated temporary fixtures and remove only their verified task-owned temporary directory. Structural validation still cannot authenticate evidence semantics, and filesystem checks do not claim protection against hostile concurrent filesystem replacement.

## Catalogue detail and planned consumer expansion

Expanded 105 matched catalogue identities into 386 stable bounded planned subrequirements. Added separate planned admissions to all 420 surface records: proposed consumer paths/IDs and authority, localized article/copy identities, versioned state identities, test paths and explicit runtime/capture tuple axes. No implementation file, runtime receipt, built hash or capture was invented. Empty implementation proof arrays and null source/runtime/capture/parity slots remain intact.

The private source catalogue summaries and proof demands were transformed using the canonical public export implementation before writing product records; no private links or source paths were retained. This was catalogue expansion, not a completed reading/reconciliation of every linked full canonical section. PH01-T01-C02 and PH01-T02-C02 remain incomplete. Their remaining work includes full linked-section reconciliation, independent semantic review, exact per-feature action/capability inventories, actual consumer admission, detailed viewport-state coverage and persistence-property review. Existing catalogue-only exclusions remain provisional until full canonical applicability review.

Focused verification after expansion: `node --test tests/evidence-ledger.test.cjs` exited 0 with 12 tests, 12 pass, 0 fail and 0 skipped. The original ten tests remain. Two new cases remove/overbound subrequirements and remove planned consumer/localization/state/test/runtime identities or insert a false planned build hash; each mutation is rejected, while the restored baseline passes. These are structural admission tests, not product acceptance. Authenticated status ingestion was unavailable, so no delivery receipt is claimed.

## Representative operation admission handoff

Added `docs/planning/operation-request.schema.json`, a version-1 representative request design for language settings, project creation, build preview/submission and owned cancellation. Envelope/action arguments reject unknown keys and versions and carry bounded fields. The architecture records 64 KiB/depth-8/duplicate-key parser requirements, operation-ID idempotency and conflict rules, stale-revision rejection, preview binding, actual-state recovery, monotonic events and partial outcomes. Every applicable planned consumer links this schema and now includes stale/disconnected/interrupted/partial runtime states. This schema is not yet an executable IPC boundary; parser, durable transactional effects and consumer-specific negative tests remain implementation work.

After the request-admission additions, the ledger validator again exited 0 and all 12 focused tests passed with no skips. No product runtime or request-execution proof is implied.

## Independent completeness and planned-value repair

Review demonstrated that removing a planned requirement together with all four bindings escaped validation, and a numeric consumer path was accepted. Added `scripts/evidence/expected-subrequirements.json`, a separate fixed expected inventory derived from the existing sanitized catalogue expansion. Validation compares exact ordered IDs/text for every identity rather than deriving expectations from the ledger being checked. Do not regenerate that inventory as part of validation; deliberate inventory changes need independent source reconciliation and review. It retains 105 identities and 386 planned subrequirements and does not claim completed full canonical-section review.

Every planned consumer/request-schema/article/copy/test/capture path is now a nonempty bounded relative string, with 512-character maximum and rejection of absolute Windows/POSIX paths, drive-relative forms, traversal segments, control characters, backslashes, empty path segments and whitespace-only segments. Future planned paths need not exist. Application storage uses the same relative-path rule; browser/repository store references must match their exact declared namespace and identity. Operation/ID/authority/behavior/tuple fields are separately bounded strings. Null identity, subrequirement, surface, planned admission and child rows produce findings rather than crashes.

All applicable desktop plans now use exact logical viewport axes `minimum-960x640` and `normal-1440x960`, with display scale percentages `[100,125,150,200]`. These are accepted planning dimensions, not measured runtime proof. Detailed state/layout coverage and all runtime captures remain pending.

`node scripts/evidence/validate-ledger.cjs` exited 0 with the unchanged 105-identity/420-surface admission-only summary. `node --test tests/evidence-ledger.test.cjs` exited 0: 17 tests, 17 pass, 0 fail, 0 skipped. The original twelve tests remain; five new tests cover deletion with all bindings, exact-text drift, invalid planned paths/store references, bounded value types, malformed null rows and exact viewport/scale axes. Valid synthetic contained proof fixtures still pass. No native build, capture, product execution or full canonical review was performed in this repair.
