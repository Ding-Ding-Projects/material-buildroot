# offline-docs delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Complete bundled rendered articles, internal navigation and search

Overall: **partial**. This label remains provisional.

Public ledger requirements: `offline-docs-REQ-01`, `offline-docs-REQ-02`, `offline-docs-REQ-03`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/documentation-panel.ts`, `src/main/documentation/service.cjs`, `scripts/documentation/bundle.mjs`, `website/inventory.mjs`

bundleDocumentation writes hashed article/asset index; createDocumentationService verifies admitted bounded bytes.

DocumentationPanel open/link/back uses typed documentation.list/read/open; article links resolve to admitted IDs and anchors.

search() searches title/category/500-character summary only; worker receives same metadata, not complete body.

Bundle obtains documentSources from index and has bounded manifest; exact independent negative omission proof not established by this audit.

renderMarkdown handles bundled Markdown; shared isolated renderer for all provider surfaces and emoji map is not delivered.

No network fetch for articles; restricted mode replaces reader with short help and removes index/history/search.

Missing behavior: None asserted for this bounded slice; universal completeness remains separate. search() searches title/category/500-character summary only; worker receives same metadata, not complete body. Bundle obtains documentSources from index and has bounded manifest; exact independent negative omission proof not established by this audit. renderMarkdown handles bundled Markdown; shared isolated renderer for all provider surfaces and emoji map is not delivered. No network fetch for articles; restricted mode replaces reader with short help and removes index/history/search.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Drive the exact current built consumer and retain bounded proof.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/documentation-panel.ts`, `src/main/documentation/service.cjs`, `scripts/documentation/bundle.mjs`, `website/inventory.mjs`

This ID specifically requires an installed reader; D public article delivery is a separate obligation, not evidence of A completion.

Missing behavior: This ID specifically requires an installed reader; D public article delivery is a separate obligation, not evidence of A completion. Exact required surface implementation or a justified accessible equivalent is not independently admitted.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified. Applicability remains unresolved; no current proof establishes a surface exemption.

Next action: Record the exact surface boundary and verify its closest applicable equivalent.

Applicability AP-039: The formal ledger requires this surface and no sufficiently specific exemption is admitted. Browser capability constraints or a sibling implementation do not establish nonapplicability. Retain the obligation as partial until its exact accessible equivalent or explicit scope exclusion is reviewed.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/documentation-panel.ts`, `src/main/documentation/service.cjs`, `scripts/documentation/bundle.mjs`, `website/inventory.mjs`

C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing behavior: C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/documentation-panel.ts`, `src/main/documentation/service.cjs`, `scripts/documentation/bundle.mjs`, `website/inventory.mjs`

Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing behavior: Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

Applicability AP-040: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
