# Feature evidence ledger

The [machine-readable ledger](feature-evidence.json) is an admission baseline for the 105 identities in [the hand-written catalogue](feature-coverage.md). It contains four independent records per identity, including explicit excluded-surface records. All product implementation remains unimplemented or pending; this file cannot attest runtime delivery.

## Reconciliation boundary

The catalogue requirement and surface are preserved verbatim. Canonical-only, owner-memory, product-inapplicable and conditional encrypted-builder dispositions remain explicit. The canonical universal surface contract was reviewed for its independent implementation/evidence rule, including version/date provenance, layout and exact negative checks. Detailed per-identity canonical subrequirements and applicability review are still pending. Catalogue boundaries do not authorize exemptions from current canonical requirements. PH01-T01 and PH01-T02 remain partial until that review and concrete consumer admission finish.

## Record contract

Every identity/surface has a stable `PH01-T02-<identity>-<surface>` work ID, applicability reason, state, consumer/article/localized-copy/persistence/test inventories, source revision, built hash and distinct source/runtime/capture/parity proof slots. Empty arrays and null proof mean pending admission. They are intentional gaps, never evidence that a feature exists.

A complete record requires reviewed reconciliation, exact source/build bindings, nonempty file inventories with current SHA-256 hashes, a resolved persistence disposition and verified proof records with matching source/build bindings and hashed files. `sourceRevision` is a 40-character revision; `builtHash` is a 64-character SHA-256. A proof contains `status`, `sourceRevision`, `builtHash` and `files`, each file containing repository-relative `path` and `sha256`. Conditional rows cannot be silently waived; activation and acceptance need their own reviewed facts.

## Local validation

Run `node scripts/evidence/validate-ledger.cjs` and `node --test tests/evidence-ledger.test.cjs`. The validator rejects a missing or duplicate identity, stale catalogue, missing or extra surface, non-plain surface map, unsupported state, applicability waiver and completion without current file and source/build proof bindings. Proof paths must remain inside the repository both lexically and after realpath resolution, and resolve to regular files. Directory links escaping the repository, traversal, absolute paths and directories are rejected. Negative tests mutate copies in memory and restore a valid fixture. They do not change production statuses.

This validator checks structure and file currency. It cannot determine whether a capture depicts the claimed build, whether runtime behavior was exercised, or whether an attestation is truthful. Synthetic test fixtures demonstrate only validation rules. Human/source-bound evidence admission, semantic article/copy/persistence coverage, complete runtime tuples, actual captures and independent review remain required. PH01-T05 is not complete from this validator alone.
