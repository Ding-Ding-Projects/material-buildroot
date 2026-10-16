# dependency-fetcher delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


One-click pinned trusted dependency acquisition with actual installation readback

Overall: **partial**. This label remains provisional.

Public ledger requirements: `dependency-fetcher-REQ-01`, `dependency-fetcher-REQ-02`, `dependency-fetcher-REQ-03`, `dependency-fetcher-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | not-applicable-with-reason |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build-manifest.json`, `scripts/build/entrypoint.ps1`, `scripts/build/toolchains.ps1`, `scripts/build/driver.cjs`

Dedicated root fetcher uses shared dependencies-only entrypoint and exact pinned Node, MinGit and desktop runtime archives.

ZIP size/member/hash checks and cold/warm complete-tree revalidation are present.

npm ci uses locked packages with lifecycle scripts disabled; dependencies-only returns before build.

Build calls the shared acquisition body, not the named root fetcher.

Runtime/test acquisition inventory does not include converter/Java tools or browser test binaries.

Missing behavior: Every run/test dependency or prerequisite is not acquired by the root route. No named-fetcher call from the two build scripts; shared code prevents duplication but differs from literal contract. npm ci reinstalls the locked tree on warm runs; per-phase timing absent.

Missing proof: Current cold/warm, silent and cache-miss execution unrun.

Next action: Expand the supported dependency or prerequisite inventory and verify named root route equivalence or implement direct invocation without caller exit.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build-manifest.json`, `scripts/build/entrypoint.ps1`, `scripts/build/toolchains.ps1`, `scripts/build/driver.cjs`

Dedicated root fetcher uses shared dependencies-only entrypoint and exact pinned Node, MinGit and desktop runtime archives.

ZIP size/member/hash checks and cold/warm complete-tree revalidation are present.

npm ci uses locked packages with lifecycle scripts disabled; dependencies-only returns before build.

Build calls the shared acquisition body, not the named root fetcher.

Runtime/test acquisition inventory does not include converter/Java tools or browser test binaries.

Missing behavior: Every run/test dependency or prerequisite is not acquired by the root route. No named-fetcher call from the two build scripts; shared code prevents duplication but differs from literal contract. npm ci reinstalls the locked tree on warm runs; per-phase timing absent.

Missing proof: Current cold/warm, silent and cache-miss execution unrun.

Next action: Expand the supported dependency or prerequisite inventory and verify named root route equivalence or implement direct invocation without caller exit.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build-manifest.json`, `scripts/build/entrypoint.ps1`, `scripts/build/toolchains.ps1`, `scripts/build/driver.cjs`

Dedicated root fetcher uses shared dependencies-only entrypoint and exact pinned Node, MinGit and desktop runtime archives.

ZIP size/member/hash checks and cold/warm complete-tree revalidation are present.

npm ci uses locked packages with lifecycle scripts disabled; dependencies-only returns before build.

Build calls the shared acquisition body, not the named root fetcher.

Runtime/test acquisition inventory does not include converter/Java tools or browser test binaries.

Missing behavior: Every run/test dependency or prerequisite is not acquired by the root route. No named-fetcher call from the two build scripts; shared code prevents duplication but differs from literal contract. npm ci reinstalls the locked tree on warm runs; per-phase timing absent.

Missing proof: Current cold/warm, silent and cache-miss execution unrun.

Next action: Expand the supported dependency or prerequisite inventory and verify named root route equivalence or implement direct invocation without caller exit.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build-manifest.json`, `scripts/build/entrypoint.ps1`, `scripts/build/toolchains.ps1`, `scripts/build/driver.cjs`

Dedicated root fetcher uses shared dependencies-only entrypoint and exact pinned Node, MinGit and desktop runtime archives.

ZIP size/member/hash checks and cold/warm complete-tree revalidation are present.

npm ci uses locked packages with lifecycle scripts disabled; dependencies-only returns before build.

Build calls the shared acquisition body, not the named root fetcher.

Runtime/test acquisition inventory does not include converter/Java tools or browser test binaries.

Missing behavior: Every run/test dependency or prerequisite is not acquired by the root route. No named-fetcher call from the two build scripts; shared code prevents duplication but differs from literal contract. npm ci reinstalls the locked tree on warm runs; per-phase timing absent.

Missing proof: Current cold/warm, silent and cache-miss execution unrun.

Next action: Expand the supported dependency or prerequisite inventory and verify named root route equivalence or implement direct invocation without caller exit.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
