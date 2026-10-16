# release-workflow delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Implementation-phase publication produces real uniquely tagged normal releases and installer assets

Overall: **implemented-unverified**. This label remains provisional.

Public ledger requirements: `release-workflow-REQ-01`, `release-workflow-REQ-02`, `release-workflow-REQ-03`, `release-workflow-REQ-04`, `release-workflow-REQ-05`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | not-applicable-with-reason |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | implemented-unverified |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `.github/workflows/release.yml`, `scripts/release/publish.cjs`, `scripts/release/prepare.cjs`

Every branch push plus dispatch triggers a Microsoft Windows-only job; tag events excluded and no tests/lint jobs.

Pinned cloud image, exact root installer command and token fallback chain present.

Publisher creates unique version/build number/attempt normal release, binds source, readbacks classification, assets and tag peeling.

Source lineage allows either main ancestor of source or source ancestor of main; target exact SHA remains fixed.

Release notes honestly state unrun native acceptance and ungated packaging.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No new external run or exact pinned release inspected by this implementation subagent. No current local-check result enters generated release notes beyond fixed unrun workflow statement.

Next action: Read back exact-source run/release and downloaded hashes; retain separate local and runtime verdicts.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `.github/workflows/release.yml`, `scripts/release/publish.cjs`, `scripts/release/prepare.cjs`

Every branch push plus dispatch triggers a Microsoft Windows-only job; tag events excluded and no tests/lint jobs.

Pinned cloud image, exact root installer command and token fallback chain present.

Publisher creates unique version/build number/attempt normal release, binds source, readbacks classification, assets and tag peeling.

Source lineage allows either main ancestor of source or source ancestor of main; target exact SHA remains fixed.

Release notes honestly state unrun native acceptance and ungated packaging.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No new external run or exact pinned release inspected by this implementation subagent. No current local-check result enters generated release notes beyond fixed unrun workflow statement.

Next action: Read back exact-source run/release and downloaded hashes; retain separate local and runtime verdicts.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `.github/workflows/release.yml`, `scripts/release/publish.cjs`, `scripts/release/prepare.cjs`

Every branch push plus dispatch triggers a Microsoft Windows-only job; tag events excluded and no tests/lint jobs.

Pinned cloud image, exact root installer command and token fallback chain present.

Publisher creates unique version/build number/attempt normal release, binds source, readbacks classification, assets and tag peeling.

Source lineage allows either main ancestor of source or source ancestor of main; target exact SHA remains fixed.

Release notes honestly state unrun native acceptance and ungated packaging.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No new external run or exact pinned release inspected by this implementation subagent. No current local-check result enters generated release notes beyond fixed unrun workflow statement.

Next action: Read back exact-source run/release and downloaded hashes; retain separate local and runtime verdicts.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `.github/workflows/release.yml`, `scripts/release/publish.cjs`, `scripts/release/prepare.cjs`

Every branch push plus dispatch triggers a Microsoft Windows-only job; tag events excluded and no tests/lint jobs.

Pinned cloud image, exact root installer command and token fallback chain present.

Publisher creates unique version/build number/attempt normal release, binds source, readbacks classification, assets and tag peeling.

Source lineage allows either main ancestor of source or source ancestor of main; target exact SHA remains fixed.

Release notes honestly state unrun native acceptance and ungated packaging.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No new external run or exact pinned release inspected by this implementation subagent. No current local-check result enters generated release notes beyond fixed unrun workflow statement.

Next action: Read back exact-source run/release and downloaded hashes; retain separate local and runtime verdicts.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
