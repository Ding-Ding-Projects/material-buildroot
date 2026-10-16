# minecraft-server-manager delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Java/Bedrock versions/flavours/plugins and local-process/local-container/SSH-process/SSH-container targets

Overall: **partial**. This label remains provisional.

Public ledger requirements: `minecraft-server-manager-REQ-01`, `minecraft-server-manager-REQ-02`, `minecraft-server-manager-REQ-03`, `minecraft-server-manager-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | missing |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/tools-panel.ts`, `src/main/tools/minecraft.cjs`, `src/main/tools/minecraft-catalog.cjs`, `src/main/operations-service.cjs`

UI hardcodes local-process; host supplies no pinned Docker image; two SSH target adapters absent.

Official Java manifest + size/SHA-1 verification; Bedrock/flavour metadata exists but full distribution/version compatibility coverage absent.

Start/status/stop use owned process map, not health/readiness, graceful console stop, durable adoption or restart/schedules.

Eight property allowlist and four visible fields cannot deliver worlds/backup/restore/players/permissions/network/topology.

Plugin metadata/install service exists; rich catalogue/install/configure/update/remove GUI and full rollback compatibility absent.

Initial configuration validates fixed schema; no version-bound descriptor consumer for complete config and preserved unknown values.

No manager history, export, bulk, transactional update/rollback or reconnect workflow.

No current edition/version/flavour/target/extension acceptance matrix with genuine complete built interaction.

Missing behavior: UI hardcodes local-process; host supplies no pinned Docker image; two SSH target adapters absent. Official Java manifest + size/SHA-1 verification; Bedrock/flavour metadata exists but full distribution/version compatibility coverage absent. Start/status/stop use owned process map, not health/readiness, graceful console stop, durable adoption or restart/schedules. Eight property allowlist and four visible fields cannot deliver worlds/backup/restore/players/permissions/network/topology. Plugin metadata/install service exists; rich catalogue/install/configure/update/remove GUI and full rollback compatibility absent. Initial configuration validates fixed schema; no version-bound descriptor consumer for complete config and preserved unknown values. No manager history, export, bulk, transactional update/rollback or reconnect workflow. No current edition/version/flavour/target/extension acceptance matrix with genuine complete built interaction.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/tools-panel.ts`, `src/main/tools/minecraft.cjs`, `src/main/tools/minecraft-catalog.cjs`, `src/main/operations-service.cjs`

D visitor state supports local goal/notes/checks, JSON backup/import, guides and read-only companion presentation; no independent complete consumer for this clause.

Missing behavior: D visitor state supports local goal/notes/checks, JSON backup/import, guides and read-only companion presentation; no independent complete consumer for this clause.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/tools-panel.ts`, `src/main/tools/minecraft.cjs`, `src/main/tools/minecraft-catalog.cjs`, `src/main/operations-service.cjs`

C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing behavior: C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/tools-panel.ts`, `src/main/tools/minecraft.cjs`, `src/main/tools/minecraft-catalog.cjs`, `src/main/operations-service.cjs`

Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing behavior: Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

Applicability AP-044: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
