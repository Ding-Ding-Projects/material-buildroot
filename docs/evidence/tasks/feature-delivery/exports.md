# exports delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Complete formats, loss disclosure, selected/filtered scope and protected-data exclusions

Overall: **partial**. This label remains provisional.

Public ledger requirements: `exports-REQ-01`, `exports-REQ-02`, `exports-REQ-03`, `exports-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts`, `src/main/workspace-service.cjs`, `src/main/security/workspace-ipc.cjs`, `website/app.js`

exportPlans exports workspace JSON; queues, chats, logs, catalogue, history and other views lack complete export consumers.

Only bounded JSON paths are delivered in traced workspace/visitor flows; per-datum format selection absent.

workspaceExport document and document.import validate versioned JSON; visitor export/import has version/field checks.

No complete pre-export encoding/line-ending/loss disclosure across all owned data.

No ZIP/7z export UI with full compression, split-volume and encrypted-header choices.

Workspace export omits private mapping by construction; complete all-record redaction acceptance remains unverified.

Missing behavior: exportPlans exports workspace JSON; queues, chats, logs, catalogue, history and other views lack complete export consumers. Only bounded JSON paths are delivered in traced workspace/visitor flows; per-datum format selection absent. None asserted for this bounded slice; universal completeness remains separate. No complete pre-export encoding/line-ending/loss disclosure across all owned data. No ZIP/7z export UI with full compression, split-volume and encrypted-header choices. Workspace export omits private mapping by construction; complete all-record redaction acceptance remains unverified.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts`, `src/main/workspace-service.cjs`, `src/main/security/workspace-ipc.cjs`, `website/app.js`

D visitor state supports local goal/notes/checks, JSON backup/import, guides and read-only companion presentation; no independent complete consumer for this clause.

D visitor state supports local goal/notes/checks, JSON backup/import, guides and read-only companion presentation; no independent complete consumer for this clause. An existing browser-local slice is present.

Missing behavior: D visitor state supports local goal/notes/checks, JSON backup/import, guides and read-only companion presentation; no independent complete consumer for this clause. D visitor state supports local goal/notes/checks, JSON backup/import, guides and read-only companion presentation; no independent complete consumer for this clause. An existing browser-local slice is present.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts`, `src/main/workspace-service.cjs`, `src/main/security/workspace-ipc.cjs`, `website/app.js`

C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing behavior: C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts`, `src/main/workspace-service.cjs`, `src/main/security/workspace-ipc.cjs`, `website/app.js`

Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing behavior: Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

Applicability AP-036: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
