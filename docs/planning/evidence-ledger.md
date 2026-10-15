# Feature evidence ledger

The [machine-readable ledger](feature-evidence.json) is an admission baseline for the 107 identities in [the hand-written catalogue](feature-coverage.md). It contains four independent records per identity, including explicit excluded-surface records. All product implementation remains unimplemented or pending; this file cannot attest runtime delivery.

## Reconciliation boundary

The catalogue requirement and surface are preserved verbatim. Canonical-only, owner-memory, product-inapplicable and conditional encrypted-builder dispositions remain explicit. The canonical universal surface contract was reviewed for its independent implementation/evidence rule, including version/date provenance, layout and exact negative checks. Detailed per-identity canonical subrequirements and applicability review are still pending. Catalogue boundaries do not authorize exemptions from current canonical requirements. PH01-T01 and PH01-T02 remain partial until that review and concrete consumer admission finish.

## Record contract

Every identity/surface has a stable `PH01-T02-<identity>-<surface>` work ID, applicability reason, state, consumer/article/localized-copy/persistence/test inventories, source revision, built hash and distinct source/runtime/capture/parity proof slots. Empty arrays and null proof mean pending admission. They are intentional gaps, never evidence that a feature exists.

A complete record requires reviewed reconciliation, exact source/build bindings, nonempty file inventories with current SHA-256 hashes, a resolved persistence disposition and verified proof records with matching source/build bindings and hashed files. `sourceRevision` is a 40-character revision; `builtHash` is a 64-character SHA-256. A proof contains `status`, `sourceRevision`, `builtHash` and `files`, each file containing repository-relative `path` and `sha256`. Conditional rows cannot be silently waived; activation and acceptance need their own reviewed facts.

## Local validation

Run `node scripts/evidence/validate-ledger.cjs` and `node --test tests/evidence-ledger.test.cjs`. The validator rejects a missing or duplicate identity, stale catalogue, missing or extra surface, non-plain surface map, unsupported state, applicability waiver and completion without current file and source/build proof bindings. Proof paths must remain inside the repository both lexically and after realpath resolution, and resolve to regular files. Directory links escaping the repository, traversal, absolute paths and directories are rejected. Negative tests mutate copies in memory and restore a valid fixture. They do not change production statuses.

This validator checks structure and file currency. It cannot determine whether a capture depicts the claimed build, whether runtime behavior was exercised, or whether an attestation is truthful. Synthetic test fixtures demonstrate only validation rules. Human/source-bound evidence admission, semantic article/copy/persistence coverage, complete runtime tuples, actual captures and independent review remain required. PH01-T05 is not complete from this validator alone.

## Planned contract expansion

The ledger now matches all 107 canonical catalogue entries, with 398 bounded subrequirements derived through the reviewed public-text export route. Each has a stable `<identity>-REQ-NN` identifier and explicit pending full-section review. These are expanded catalogue summaries and proof demands, not a claim that every full linked canonical section has been reconciled. Five differing source catalogue identifiers were reconciled to this product's public identity names without changing the 107-identity inventory.

Every one of the 428 surface records carries `plannedAdmission`. Applicable rows name a proposed consumer ID/path/behavior/operation/authority, separate English and Cantonese article IDs, English/Cantonese/bilingual copy identities and expected state keys, a versioned storage identity, focused and negative test paths, and a parameterized runtime/capture tuple identity. Excluded rows preserve exact catalogue reasons and remain pending canonical applicability review. Planned paths are reserved identities, not existing implementation files or proof. Existing implementation arrays and proof slots remain empty/null.

Visual runtime tuples explicitly enumerate initial/success/invalid/unavailable/cancelled/recovery/reload/reset, three languages, light/dark, 100/125/150/200 percent, and normal/minimum viewports. Website minimum is 320 pixels. The accepted desktop logical bounds are 960×640 minimum and 1440×960 normal, tested at each declared scale; measured runtime proof remains pending. Every feature's actual state/action/capability inventory must expand this common baseline before acceptance. Process-only R records use source/output receipts; any visible R controls require the appropriate surface captures instead of an exemption. Storage keys are design identities, not final physical paths or an authorization to serialize secrets.

The validator bounds subrequirements to 1–64 per identity and 1–6,000 characters per requirement, verifies stable IDs and bindings, and rejects missing planned consumers/articles/copy/persistence/tests/runtime or falsely populated planned proof hashes. It does not treat plans as evidence. PH01-T01-C02 and PH01-T02-C02 remain open for full canonical detail review and concrete implementation admission.


The fixed expected subrequirement inventory at `scripts/evidence/expected-subrequirements.json` is independent of the ledger under test. Exact ID/text comparison detects deleted requirements even if all surface bindings are deleted too. Update this expected inventory only through deliberate source reconciliation and independent review, never automatic validation-time regeneration. Planned file paths are bounded relative strings and may name future files; namespace-based storage references and operation/authority/behavior/tuple fields have separate bounded validation. Null malformed rows report findings. These controls validate the admitted plan structure, not its implementation.

## Current catalogue delta

The current inventory adds independent `onboarding-wizard` and `info-icon-guidance` identities. In-app onboarding requires A; its D/C/R exclusions apply only to that installed-application identity. Per-control info guidance independently requires A/D/C and is not included in a broad guided-forms completion claim. See the [delta reconciliation](../evidence/tasks/PH01-catalogue-delta.md) for exact boundaries, existing source candidates and verification limits. The resulting inventory has 107 identities, 428 surface records and 398 planned subrequirements; all complete canonical-section review and product acceptance remain pending.

The [current documentation/interface review](../evidence/tasks/PH01-current-interface-contracts.md) strengthens four existing requirement texts without changing identity, surface or requirement counts. It distinguishes the website's existing task walkthrough and functional package/guest canvas candidates from missing offline in-app documentation, incomplete editor icons and per-control guidance, final semantic/native effects and current-image replacement/archive work. None of these planning updates establishes complete canonical review or runtime acceptance.

The targeted follow-up in that review records the icon checkpoint and newly authored offline documentation bundle/service/build/typed operations and reader candidates. The earlier absent-backend and text-glyph findings are superseded. Per-control guidance, source-derived recipe discovery and measured model fit remain active implementation priorities; settled reader behavior, deployed documentation and final current-image/archive coverage still require their own review and evidence. Inventory counts and all acceptance boundaries remain unchanged.
