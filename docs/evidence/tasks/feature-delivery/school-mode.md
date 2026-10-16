# school-mode delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Shared renamed mode, live propagation, protected exit, complete suppression/restoration

Overall: **partial**. This label remains provisional.

Public ledger requirements: `school-mode-REQ-01`, `school-mode-REQ-02`, `school-mode-REQ-03`, `school-mode-REQ-04`, `school-mode-REQ-05`, `school-mode-REQ-06`, `school-mode-REQ-07`, `school-mode-REQ-08`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | missing |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/shared-mode-panel.ts#run`, `src/renderer/main.ts#applySharedSnapshot/restricted`, `src/main/privacy/shared-mode-service.cjs#createSharedModeService`, `src/main/privacy/shared-mode-ipc.cjs`, `src/main/index.cjs#sharedDirectory`, `src/main/security/experience-policy.cjs#challenge`

A typed requests reach locked revision-aware atomic host record and protected verifier. Events update renderer restrictions; unknown state is restricted. PIN/password present; passkey provider/transport unavailable. Separate ladder accepts schoolMode but full integration is explicitly incomplete.

Missing behavior: D/C control and shared propagation missing; whole suppression inventory incomplete; native vault and cross-product interoperability unverified.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/shared-mode-panel.ts#run`, `src/renderer/main.ts#applySharedSnapshot/restricted`, `src/main/privacy/shared-mode-service.cjs#createSharedModeService`, `src/main/privacy/shared-mode-ipc.cjs`, `src/main/index.cjs#sharedDirectory`, `src/main/security/experience-policy.cjs#challenge`

A typed requests reach locked revision-aware atomic host record and protected verifier. Events update renderer restrictions; unknown state is restricted. PIN/password present; passkey provider/transport unavailable. Separate ladder accepts schoolMode but full integration is explicitly incomplete.

Missing behavior: D/C control and shared propagation missing; whole suppression inventory incomplete; native vault and cross-product interoperability unverified.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/shared-mode-panel.ts#run`, `src/renderer/main.ts#applySharedSnapshot/restricted`, `src/main/privacy/shared-mode-service.cjs#createSharedModeService`, `src/main/privacy/shared-mode-ipc.cjs`, `src/main/index.cjs#sharedDirectory`, `src/main/security/experience-policy.cjs#challenge`

A typed requests reach locked revision-aware atomic host record and protected verifier. Events update renderer restrictions; unknown state is restricted. PIN/password present; passkey provider/transport unavailable. Separate ladder accepts schoolMode but full integration is explicitly incomplete.

Missing behavior: D/C control and shared propagation missing; whole suppression inventory incomplete; native vault and cross-product interoperability unverified.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/shared-mode-panel.ts#run`, `src/renderer/main.ts#applySharedSnapshot/restricted`, `src/main/privacy/shared-mode-service.cjs#createSharedModeService`, `src/main/privacy/shared-mode-ipc.cjs`, `src/main/index.cjs#sharedDirectory`, `src/main/security/experience-policy.cjs#challenge`

A typed requests reach locked revision-aware atomic host record and protected verifier. Events update renderer restrictions; unknown state is restricted. PIN/password present; passkey provider/transport unavailable. Separate ladder accepts schoolMode but full integration is explicitly incomplete.

Missing behavior: D/C control and shared propagation missing; whole suppression inventory incomplete; native vault and cross-product interoperability unverified.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

Applicability AP-004: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
