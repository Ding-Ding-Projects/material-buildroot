# Surface evidence admission

PH01-T05 adds authored validation for independent implementation, article, runtime, capture and design-parity proof. This implementation has not been executed or tested in the current authoring pass. It does not complete PH01-T05, any surface, or any runtime acceptance requirement. Negative and positive validation, real execution, capture inspection and parity proof remain pending.

## Completion receipt format

`scripts/evidence/validate-ledger.cjs` keeps the existing 109-identity, 436-surface ledger and invokes `validate-surface-proof.cjs` for each surface claiming `complete`. Incomplete records remain incomplete; validation never populates proof, refreshes hashes, executes a receipt command or changes acceptance flags.

Each `proof.source`, `proof.runtime`, `proof.capture` and `proof.parity` retains its existing `status`, `sourceRevision`, `builtHash` and `files` fields and additionally requires a `receipt` file binding: `{ "path": "relative/path.json", "sha256": "<64 lowercase hexadecimal characters>" }`. The validator reads the actual hash-bound JSON rather than trusting the enclosing status flag.

Every receipt requires schema version 1, its exact `kind` (`source`, `runtime`, `capture` or `parity`), the surface `workId`, matching `sourceRevision` and `builtHash`, `status: "verified"`, a dated `recordedAt` and a concrete `environment`. Its `buildArtifact` binding must resolve to existing bytes whose SHA-256 equals `builtHash`. Its nonempty `bindings` inventory must include every current implementation consumer, article, localized-copy file, focused test, negative test and required persistence file from the surface. Duplicate paths, stale hashes, missing files, traversal and resolved symlink escapes are rejected. Source receipts also list `articles` with current bindings for both `en` and `zh-HK`.

Runtime, capture and parity receipts require the actual successful `command`, `exitCode: 0` and `method`, plus their complete `tuples` inventory. The command is recorded data only. The validator does not run it. Each tuple carries its exact `id`, `state`, `language`, `theme`, `scale`, `viewport`, matching source/build identifiers, verified status and an existing hash-bound `output` file. Tuple IDs are expanded from the ledger's `plannedAdmission.runtime.tupleIdTemplate`; every combination of the ledger's state, language, theme, scale and viewport axes must occur exactly once. Unknown, missing, duplicate and stale tuples prevent completion. The expansion is bounded to 65,536 combinations, with at most 64 distinct values per axis.

Capture tuples additionally require `inspected: true`, `privacy: "approved"` and a concrete capture method. Parity tuples require hash-bound `reference` and `comparison` files, `matches: true` and the comparison method. These declarations remain producer assertions until an independent operator has inspected genuine output. Process-only surfaces need an explicit execution/parity matrix before completion; absence of visual axes is not automatically converted into a waiver.

## Consumer inventory compatibility

The optional `surfaceConsumerAdmission` section of `implementation-admission.json`, authored by PH01-T02-C02, is validated separately by `admit-implementation.cjs`. Its ledger file binding, source identifier, stable work IDs, applicability and all 109 identities with their 436 A/D/C/R rows must match the independent feature ledger.

The current mapping schema remains compatible: bounded consumer mappings may name current files, while historical candidates remain historical. Only `existing-bounded-consumer-pending-admission` rows may carry current `consumers`; those files are checked for currency. Historical `sourceMapping.references` are not promoted into current consumers and are not rejected merely because historical source has changed. Historical references establish neither current absence nor current implementation. Article, copy, persistence and focused-test groups remain pending with empty binding lists; runtime and capture remain pending with null receipts. Every row retains `accepted: false` and `independentlyAdmitted: false`. Structural inventory admission grants no execution authority or product acceptance.

## Failure and verification boundaries

Absent, unreadable, stale, malformed or mismatched proof prevents a complete claim. Authored validators, planned filenames, synthetic receipts and passing structural checks are not evidence that the application ran or that screenshots depict the intended behavior. No validator can independently establish execution merely from producer assertions. Source inspection, real build provenance, runtime observation and pixel review remain separate acceptance duties.

The current fast implementation mode intentionally runs no tests, reviews, static analysis or screenshots. Red/green regression proof and application acceptance remain unverified. Existing phase snapshot hashes may become stale when validator source changes; they must be renewed through their owning evidence process, not silently refreshed here.
