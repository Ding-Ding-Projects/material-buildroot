# scheduled-settings delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Timezone/DST/precedence/base restoration and protected external sources for settings

Overall: **partial**. This label remains provisional.

Public ledger requirements: `scheduled-settings-REQ-01`, `scheduled-settings-REQ-02`, `scheduled-settings-REQ-03`, `scheduled-settings-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | missing |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/scheduled-preferences-panel.ts`, `src/renderer/main.ts#applyScheduledSnapshot/effectiveLanguage/effectiveTheme`, `src/main/preferences/service.mjs#CURRENT_SCHEDULE_REGISTRY`, `src/main/preferences/schedule-ipc.cjs`, `src/main/preferences/schedule-store.mjs`, `src/main/preferences/schedule-provider.mjs`, `src/main/preferences/source-enrollments.mjs`, `src/shared/scheduled-settings.mjs#evaluateSchedule/createExternalScheduleCoordinator`

A editor routes typed IPC to SQLite/history and enrollment services. Provider/coordinator creates effective snapshots consumed by language/theme only. Registry has exactly language and appearance.theme. Editor selected rule requires local source; enrollment alone does not establish external-rule authoring.

Missing behavior: Broader setting registry, D/C scheduler and full external-rule UI missing; current native effects, fallback and recovery proof absent.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/scheduled-preferences-panel.ts`, `src/renderer/main.ts#applyScheduledSnapshot/effectiveLanguage/effectiveTheme`, `src/main/preferences/service.mjs#CURRENT_SCHEDULE_REGISTRY`, `src/main/preferences/schedule-ipc.cjs`, `src/main/preferences/schedule-store.mjs`, `src/main/preferences/schedule-provider.mjs`, `src/main/preferences/source-enrollments.mjs`, `src/shared/scheduled-settings.mjs#evaluateSchedule/createExternalScheduleCoordinator`

A editor routes typed IPC to SQLite/history and enrollment services. Provider/coordinator creates effective snapshots consumed by language/theme only. Registry has exactly language and appearance.theme. Editor selected rule requires local source; enrollment alone does not establish external-rule authoring.

Missing behavior: Broader setting registry, D/C scheduler and full external-rule UI missing; current native effects, fallback and recovery proof absent.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/scheduled-preferences-panel.ts`, `src/renderer/main.ts#applyScheduledSnapshot/effectiveLanguage/effectiveTheme`, `src/main/preferences/service.mjs#CURRENT_SCHEDULE_REGISTRY`, `src/main/preferences/schedule-ipc.cjs`, `src/main/preferences/schedule-store.mjs`, `src/main/preferences/schedule-provider.mjs`, `src/main/preferences/source-enrollments.mjs`, `src/shared/scheduled-settings.mjs#evaluateSchedule/createExternalScheduleCoordinator`

A editor routes typed IPC to SQLite/history and enrollment services. Provider/coordinator creates effective snapshots consumed by language/theme only. Registry has exactly language and appearance.theme. Editor selected rule requires local source; enrollment alone does not establish external-rule authoring.

Missing behavior: Broader setting registry, D/C scheduler and full external-rule UI missing; current native effects, fallback and recovery proof absent.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/scheduled-preferences-panel.ts`, `src/renderer/main.ts#applyScheduledSnapshot/effectiveLanguage/effectiveTheme`, `src/main/preferences/service.mjs#CURRENT_SCHEDULE_REGISTRY`, `src/main/preferences/schedule-ipc.cjs`, `src/main/preferences/schedule-store.mjs`, `src/main/preferences/schedule-provider.mjs`, `src/main/preferences/source-enrollments.mjs`, `src/shared/scheduled-settings.mjs#evaluateSchedule/createExternalScheduleCoordinator`

A editor routes typed IPC to SQLite/history and enrollment services. Provider/coordinator creates effective snapshots consumed by language/theme only. Registry has exactly language and appearance.theme. Editor selected rule requires local source; enrollment alone does not establish external-rule authoring.

Missing behavior: Broader setting registry, D/C scheduler and full external-rule UI missing; current native effects, fallback and recovery proof absent.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

Applicability AP-006: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
