# auto-updates delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Background discovery/download, unsigned ready banner, explicit restart, rollback and unsaved protection

Overall: **partial**. This label remains provisional.

Public ledger requirements: `auto-updates-REQ-01`, `auto-updates-REQ-02`, `auto-updates-REQ-03`, `auto-updates-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/updates/service.cjs`, `src/main/operations-service.cjs`, `src/renderer/operations-panel.ts`, `src/renderer/main.ts`, `docs/desktop/updates.md`, `tests/updates.test.cjs`

Manual updatesView check/refresh/download calls updateAction then admitted operations-service fields.

Service pins HTTPS hosts, enumerates normal releases, binds provenance to tag source and verifies Setup.exe bytes and SHA-256.

Bounded stream, checked HTTP Range resume, cancellation and existing-file revalidation implemented.

requestInstall requires explicit unsigned consent plus host callback, but operations-service creates service without callback and admits no install action.

No startup check, bounded schedule, automatic staging, persistent global ready banner, restart/Later controls or release-note link.

Ready and candidate state are memory-only; restart requires rediscovery.

updatesView prints raw status string and manual byte refresh; no localized state map, per-control guidance, indexed settings/palette action or automatic progress subscription established.

Unit source tests exercise synthetic service cases, not real installed update, rollback or unsaved drafts.

Missing behavior: Automatic schedule and complete end-user installation workflow missing. Persistent banner/release-note/Later/unsaved-work protection and install callback wiring missing. Cancel backend exists but updatesView exposes no cancel button. Localized state labels and full guidance/search/palette integration missing.

Missing proof: No real current-source update, corrupt-feed UI, cancel/recovery/rollback or accessibility/screenshot proof.

Next action: Implement the host-owned full Squirrel update workflow, preserve drafts and explicit consent, then exercise all real lifecycle cases.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/updates/service.cjs`, `src/main/operations-service.cjs`, `src/renderer/operations-panel.ts`, `src/renderer/main.ts`, `docs/desktop/updates.md`, `tests/updates.test.cjs`

Manual updatesView check/refresh/download calls updateAction then admitted operations-service fields.

Service pins HTTPS hosts, enumerates normal releases, binds provenance to tag source and verifies Setup.exe bytes and SHA-256.

Bounded stream, checked HTTP Range resume, cancellation and existing-file revalidation implemented.

requestInstall requires explicit unsigned consent plus host callback, but operations-service creates service without callback and admits no install action.

No startup check, bounded schedule, automatic staging, persistent global ready banner, restart/Later controls or release-note link.

Ready and candidate state are memory-only; restart requires rediscovery.

updatesView prints raw status string and manual byte refresh; no localized state map, per-control guidance, indexed settings/palette action or automatic progress subscription established.

Unit source tests exercise synthetic service cases, not real installed update, rollback or unsaved drafts.

Missing behavior: Automatic schedule and complete end-user installation workflow missing. Persistent banner/release-note/Later/unsaved-work protection and install callback wiring missing. Cancel backend exists but updatesView exposes no cancel button. Localized state labels and full guidance/search/palette integration missing.

Missing proof: No real current-source update, corrupt-feed UI, cancel/recovery/rollback or accessibility/screenshot proof.

Next action: Implement the host-owned full Squirrel update workflow, preserve drafts and explicit consent, then exercise all real lifecycle cases.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/updates/service.cjs`, `src/main/operations-service.cjs`, `src/renderer/operations-panel.ts`, `src/renderer/main.ts`, `docs/desktop/updates.md`, `tests/updates.test.cjs`

Manual updatesView check/refresh/download calls updateAction then admitted operations-service fields.

Service pins HTTPS hosts, enumerates normal releases, binds provenance to tag source and verifies Setup.exe bytes and SHA-256.

Bounded stream, checked HTTP Range resume, cancellation and existing-file revalidation implemented.

requestInstall requires explicit unsigned consent plus host callback, but operations-service creates service without callback and admits no install action.

No startup check, bounded schedule, automatic staging, persistent global ready banner, restart/Later controls or release-note link.

Ready and candidate state are memory-only; restart requires rediscovery.

updatesView prints raw status string and manual byte refresh; no localized state map, per-control guidance, indexed settings/palette action or automatic progress subscription established.

Unit source tests exercise synthetic service cases, not real installed update, rollback or unsaved drafts.

Missing behavior: Automatic schedule and complete end-user installation workflow missing. Persistent banner/release-note/Later/unsaved-work protection and install callback wiring missing. Cancel backend exists but updatesView exposes no cancel button. Localized state labels and full guidance/search/palette integration missing.

Missing proof: No real current-source update, corrupt-feed UI, cancel/recovery/rollback or accessibility/screenshot proof.

Next action: Implement the host-owned full Squirrel update workflow, preserve drafts and explicit consent, then exercise all real lifecycle cases.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/updates/service.cjs`, `src/main/operations-service.cjs`, `src/renderer/operations-panel.ts`, `src/renderer/main.ts`, `docs/desktop/updates.md`, `tests/updates.test.cjs`

Manual updatesView check/refresh/download calls updateAction then admitted operations-service fields.

Service pins HTTPS hosts, enumerates normal releases, binds provenance to tag source and verifies Setup.exe bytes and SHA-256.

Bounded stream, checked HTTP Range resume, cancellation and existing-file revalidation implemented.

requestInstall requires explicit unsigned consent plus host callback, but operations-service creates service without callback and admits no install action.

No startup check, bounded schedule, automatic staging, persistent global ready banner, restart/Later controls or release-note link.

Ready and candidate state are memory-only; restart requires rediscovery.

updatesView prints raw status string and manual byte refresh; no localized state map, per-control guidance, indexed settings/palette action or automatic progress subscription established.

Unit source tests exercise synthetic service cases, not real installed update, rollback or unsaved drafts.

Missing behavior: Automatic schedule and complete end-user installation workflow missing. Persistent banner/release-note/Later/unsaved-work protection and install callback wiring missing. Cancel backend exists but updatesView exposes no cancel button. Localized state labels and full guidance/search/palette integration missing.

Missing proof: No real current-source update, corrupt-feed UI, cancel/recovery/rollback or accessibility/screenshot proof.

Next action: Implement the host-owned full Squirrel update workflow, preserve drafts and explicit consent, then exercise all real lifecycle cases.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
