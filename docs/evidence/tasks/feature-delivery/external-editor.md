# external-editor delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Discovered configurable editors, actual file handoff and recovery

Overall: **missing**. This label remains provisional.

Public ledger requirements: `external-editor-REQ-01`, `external-editor-REQ-02`, `external-editor-REQ-03`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | missing |
| D | partial |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/tools/index.cjs`, `src/main/operations-service.cjs`, `src/main/tools/request-contract.cjs`, `src/renderer/main.ts`

editor.open service requires editorIds, but host supplies none and action is not admitted; no editor detection/choice/persistence UI.

No delivered file or workspace-root handoff; dormant service invokes one file only.

No code PATH/per-user/machine/Insiders/portable detection consumer.

No VS Code action from export/source record or absent-editor download flow.

Missing behavior: editor.open service requires editorIds, but host supplies none and action is not admitted; no editor detection/choice/persistence UI. No delivered file or workspace-root handoff; dormant service invokes one file only. No code PATH/per-user/machine/Insiders/portable detection consumer. No VS Code action from export/source record or absent-editor download flow.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/tools/index.cjs`, `src/main/operations-service.cjs`, `src/main/tools/request-contract.cjs`, `src/renderer/main.ts`

D is a public documentation visitor surface with no installed extension/editor or forge-publishing authority. Its applicable local equivalent and boundary still need documented product acceptance.

Missing behavior: D is a public documentation visitor surface with no installed extension/editor or forge-publishing authority. Its applicable local equivalent and boundary still need documented product acceptance. Exact required surface implementation or a justified accessible equivalent is not independently admitted.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified. Applicability remains unresolved; no current proof establishes a surface exemption.

Next action: Record the exact surface boundary and verify its closest applicable equivalent.

Applicability AP-046: The formal ledger requires this surface and no sufficiently specific exemption is admitted. Browser capability constraints or a sibling implementation do not establish nonapplicability. Retain the obligation as partial until its exact accessible equivalent or explicit scope exclusion is reviewed.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/tools/index.cjs`, `src/main/operations-service.cjs`, `src/main/tools/request-contract.cjs`, `src/renderer/main.ts`

C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing behavior: C host admission is limited to workspace/project/job reads, job cancellation and build submission; no assigned feature consumer beyond the narrow browser read/recovery paths exists.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/tools/index.cjs`, `src/main/operations-service.cjs`, `src/main/tools/request-contract.cjs`, `src/renderer/main.ts`

Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing behavior: Pinned source and some articles/fixtures describe this behavior; current clause-specific built/source/hash proof and complete localized article inventory are absent or unverified.

Missing proof: Current source/hash-bound real interaction, persistence/reload, language/funny-level matrix, accessibility and genuine screenshots are unverified.

Next action: Implement the named missing consumer and then verify the exact built effect and persistence.

Applicability AP-047: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
