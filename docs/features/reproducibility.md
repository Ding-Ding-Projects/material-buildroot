# Reproducibility records and compliance evidence

The host result API reads the adopted project's output directory. It never executes an output file, extracts an archive, writes into the output directory, or accepts a caller-supplied filesystem root.

## Record selected outputs

`artifacts.manifest` takes `workspaceId` and `paths`. It returns sorted relative output paths, byte sizes, SHA-256 hashes, an integrity digest, and source/configuration content locks. The host captures inputs before and after hashing and rejects a changed input snapshot. External source trees are included by the existing build-intent capture policy. Its bounds and symbolic-link limitations remain applicable.

These locks describe inputs observed while collecting results. They are explicitly marked `current-input-observation` with `buildTimeBinding: false`. They cannot prove those inputs produced an earlier build. Toolchain, environment, and upstream revision locks are not invented when unavailable. The lower-level manifest API retains explicit validated lock support for callers holding that evidence.

## Compare repeat builds

Save returned records through an existing authorized export workflow, then place the two JSON records in the adopted output directory. `artifacts.compare` takes `workspaceId`, `beforePath`, and `afterPath`. Each record is limited to 4 MiB and 10,000 unique normalized relative output paths. It validates sizes, hashes, input locks, and the record digest before comparing.

The response distinguishes added, removed, and changed output bytes; changed input locks; and missing source/configuration locks. Byte equality alone does not produce a reproducibility verdict when those required locks are absent. A matching verdict covers selected bytes and recorded inputs only. It does not establish build-time provenance, unselected files, runtime correctness, or a cause for differences. Timestamps and randomness are investigation leads rather than automatic diagnoses. Earlier records with incompatible integrity encoding must be regenerated rather than silently trusted.

## Collect license and SBOM evidence

`artifacts.compliance` reads the existing `legal-info` directory. It returns file hashes, bounded previews, parsed complete CSV package records, original license declarations, manifest paths/hashes, parsing gaps, and an SPDX 2.3 evidence document. CSV parsing handles quoted fields and embedded commas/newlines. It requires package, version, and license columns; unsupported formats remain explicit gaps.

Each complete CSV is capped at 2 MiB and the total parsed CSV budget is 16 MiB. The existing collection is capped at 10,000 entries. Archives remain metadata-only and are never unpacked. Source license strings are preserved as source declarations. SPDX license assertions remain `NOASSERTION`; collection does not determine legal compatibility or certify compliance. The collection timestamp is observational metadata and is not part of an output reproducibility claim.

## Delivery status

This change connects the existing result-service consumers and host request registration. No renderer controls are added. Runtime result interaction, export presentation, real repeat builds, generated legal-info acceptance, and adversarial verification remain unverified in the expedited implementation mode.
