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

`node --test tests/evidence-ledger.test.cjs` exited 0: 10 tests, 10 pass, 0 fail, 0 skipped. Negative fixtures reject missing identity, duplicate identity, missing/waived surface, completion with absent proof, stale source/build binding, missing/changed evidence files and stale catalogue. Additional negative cases reject extra surface keys, array/inherited surface maps, traversal and absolute paths, directories and an internal directory link resolving to external proof. The link test ran using a Windows junction on this host, with no skip; Linux uses a directory symlink. Restoring the valid contained proof passes. Valid admission and restored structural completion fixtures pass. Structural completion fixtures are synthetic validator tests, never product acceptance.

## Remaining acceptance

PH01-T03/T04 are unchanged and pending. Full canonical reconciliation, concrete consumer admission, semantic evidence validation, native runtime, responsive/language/theme/scale captures, installer, guest, cloud/SSH/device adapters, encrypted-engine review and release publication remain pending. No product build or capture ran in this unit. All PH00–PH10 scope is retained.

## Structural review repair

Independent review reproduced two acceptance defects: a lexical in-repository path could resolve through a junction outside the repository, and an extra surface record was ignored. The validator now requires a plain object with exactly A/D/C/R own keys, checks lexical and resolved path containment, and requires resolved proof targets to be regular files before hashing. Tests allocate isolated temporary fixtures and remove only their verified task-owned temporary directory. Structural validation still cannot authenticate evidence semantics, and filesystem checks do not claim protection against hostile concurrent filesystem replacement.
