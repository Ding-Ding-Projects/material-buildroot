# Reproducibility records and compliance evidence

[香港粵語](reproducibility.zh-HK.md)

The host result API reads the adopted project's output directory. It never executes an output file, extracts an archive, writes into the output directory, or accepts a caller-supplied filesystem root.

## Record selected outputs

`artifacts.manifest` takes `workspaceId` and `paths`. It returns sorted relative output paths, byte sizes, SHA-256 hashes, an integrity digest, and source/configuration content locks. The host captures inputs before and after hashing and rejects a changed input snapshot. External source trees are included by the existing build-intent capture policy. Its bounds and symbolic-link limitations remain applicable.

Successful `all` jobs now collect a host-only post-build receipt while the scheduler retains its source/output lease. Collection binds the exact queued input intent, runtime selector digest, source/output/external-root identities and job ID. Input snapshots must match before and after hashing, and roots must match their pre-execution identities. Symbolic-link source snapshots are not admitted as build proof. Image discovery is capped at 10,000 entries and 4 GiB; collection has a 60-second deadline checked between reads, and source capture retains its own stricter limits. Individual file hashing finishes before a deadline check. Receipts are capped at 4 MiB and stored atomically in host-owned local state, never in the selected output tree.

A result manifest receives `buildTimeBinding: true` only when its selected paths, hashes, sizes and source/configuration locks match that host receipt and the owned job has actually reached `succeeded`. The host rereads and validates the receipt digest, job result, queued intent, runtime digest and root identities. Missing or altered evidence cannot admit a binding. Receipt collection failure remains an explicit `unbound` job result and does not turn a successful build into fabricated provenance. Incremental builds may legitimately reuse existing outputs; the receipt describes outputs observed after successful execution, not proof every file was rebuilt.

Other records remain `current-input-observation` with `buildTimeBinding: false`, including historical outputs, non-image targets, unavailable configuration, changed inputs, unmatched outputs and unavailable evidence. Toolchain contents, environment contents, and upstream revision locks are not invented when unavailable. The lower-level manifest API retains explicit validated lock support for callers holding that evidence.

## Compare repeat builds

Save returned records through an existing authorized export workflow, then place the two JSON records in the adopted output directory. `artifacts.compare` takes `workspaceId`, `beforePath`, and `afterPath`. Each record is limited to 4 MiB and 10,000 unique normalized relative output paths. It validates sizes, hashes, input locks, and the record digest before comparing.

The response distinguishes added, removed, and changed output bytes; changed input locks; missing source/configuration locks; unavailable build lineage; same-job observations; and changed runtime selectors. Comparison revalidates each claimed binding against the actual local owned job and host receipt. Caller-supplied provenance fields or a self-computed JSON digest never substitute for that evidence. At most the 100 most recent matching jobs are searched when no explicit receipt is selected.

A matching verdict requires two distinct successful jobs and covers selected bytes and recorded input/runtime selectors only. It does not certify toolchain/environment contents, unselected files, runtime correctness, a fresh rebuild, or a cause for differences. Timestamps and randomness are investigation leads rather than automatic diagnoses. Earlier records with incompatible integrity encoding must be regenerated rather than silently trusted. Receipts are scoped to the original adopted roots and local job storage; moving the outputs or importing records on another installation does not transfer host trust.

## Collect license and SBOM evidence

`artifacts.compliance` reads the existing `legal-info` directory. It returns file hashes, bounded previews, parsed complete CSV package records, original license declarations, manifest paths/hashes, parsing gaps, and an SPDX 2.3 evidence document. CSV parsing handles quoted fields and embedded commas/newlines. It requires package, version, and license columns; unsupported formats remain explicit gaps.

Each complete CSV is capped at 2 MiB and the total parsed CSV budget is 16 MiB. The existing collection is capped at 10,000 entries. Archives remain metadata-only and are never unpacked. Source license strings are preserved as source declarations. SPDX license assertions remain `NOASSERTION`; collection does not determine legal compatibility or certify compliance. The collection timestamp is observational metadata and is not part of an output reproducibility claim.

## Delivery status

This change connects the existing result-service consumers and host request registration. No renderer controls are added. Runtime result interaction, export presentation, real repeat builds, generated legal-info acceptance, and adversarial verification remain unverified in the expedited implementation mode.
