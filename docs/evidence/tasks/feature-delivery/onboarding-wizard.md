# onboarding-wizard delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Practical in-app first-run setup with real actions/results, progress, Back/Next, save/resume, optional skipping and accessible localized completion into the workspace

Overall: **partial**. This label remains provisional.

Public ledger requirements: `onboarding-wizard-REQ-01`, `onboarding-wizard-REQ-02`, `onboarding-wizard-REQ-03`, `onboarding-wizard-REQ-04`, `onboarding-wizard-REQ-05`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | not-applicable-with-reason |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts:setupView/saveSetup/createPlan/completeSetup/dialog`, `src/main/preload.cjs:workspaceMutate`, `src/main/security/workspace-ipc.cjs:createWorkspaceIPC`, `src/main/security/workspace-contract.cjs:onboarding/request`, `src/main/workspace-service.cjs:mutate`, `src/main/storage/workspace-store.cjs:transact`

Actual setup actions exist: setupView invokes runtime.discover, createPlan(true) calls workspaceMutate plan.create, and setTheme writes preferences.update. Discovery is optional and links open trusted-project/source workspaces. This establishes real plan/preferences setup, not installed runtime readiness.

Visible three-step progress, Back/Next, bounded plan-name validation and pending discovery state exist. Host mutations use revision validation and unavailable outcomes. No dedicated cancellation state for the ongoing discovery call was found; Skip may leave a read-only discovery result pending.

saveSetup persists step/runtime/name/dismissal/planId on transitions; loadWorkspace restores them. Skip records dismissal separately from completion. Text entry alone does not save the current draft, and plan.create plus onboarding.update are separate transactions.

Localized md-dialog and labels, restoreFocus, navigation Resume setup and completion routing to operations/projects exist. setup copy uses l() and does not demonstrate both funny-level extremes. Built keyboard/focus proof is absent.

Historical browser fixture tests exercise saved plan and reload, but do not establish native IPC acceptance at the pinned source. No assigned-current full setup interaction receipt, complete language/theme/scale matrix or independent omission regression was located.

Missing behavior: Complete universal localization, dedicated setup recovery proof and current acceptance remain incomplete.

Missing proof: Current built interaction, genuine screenshots, layout measurements and omission-regression receipts unavailable.

Next action: Implement the missing per-surface behavior, then independently verify exact built interactions and negative regressions.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts:setupView/saveSetup/createPlan/completeSetup/dialog`, `src/main/preload.cjs:workspaceMutate`, `src/main/security/workspace-ipc.cjs:createWorkspaceIPC`, `src/main/security/workspace-contract.cjs:onboarding/request`, `src/main/workspace-service.cjs:mutate`, `src/main/storage/workspace-store.cjs:transact`

The specific practical in-app onboarding contract applies to the installed application. This excludes only this identity; independent website delivery and contextual browser guidance remain required.

Missing behavior: None under this conditional identity.

Missing proof: No runtime proof demanded for inactive condition.

Next action: Retain explicit conditional exclusion; reassess only if visibility or product scope changes.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts:setupView/saveSetup/createPlan/completeSetup/dialog`, `src/main/preload.cjs:workspaceMutate`, `src/main/security/workspace-ipc.cjs:createWorkspaceIPC`, `src/main/security/workspace-contract.cjs:onboarding/request`, `src/main/workspace-service.cjs:mutate`, `src/main/storage/workspace-store.cjs:transact`

The specific practical in-app onboarding contract applies to the installed application. This excludes only this identity; independent website delivery and contextual browser guidance remain required.

Missing behavior: None under this conditional identity.

Missing proof: No runtime proof demanded for inactive condition.

Next action: Retain explicit conditional exclusion; reassess only if visibility or product scope changes.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts:setupView/saveSetup/createPlan/completeSetup/dialog`, `src/main/preload.cjs:workspaceMutate`, `src/main/security/workspace-ipc.cjs:createWorkspaceIPC`, `src/main/security/workspace-contract.cjs:onboarding/request`, `src/main/workspace-service.cjs:mutate`, `src/main/storage/workspace-store.cjs:transact`

The specific practical in-app onboarding contract applies to the installed application. This excludes only this identity; independent website delivery and contextual browser guidance remain required.

Missing behavior: None under this conditional identity.

Missing proof: No runtime proof demanded for inactive condition.

Next action: Retain explicit conditional exclusion; reassess only if visibility or product scope changes.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
