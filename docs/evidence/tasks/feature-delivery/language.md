# language delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Persisted English/Cantonese/bilingual and complete localization

Overall: **partial**. This label remains provisional.

Public ledger requirements: `language-REQ-01`, `language-REQ-02`, `language-REQ-03`, `language-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | partial |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts#saveLanguage/effectiveLanguage/l`, `src/main/broker.cjs#settings.setLanguage`, `src/main/storage/settings-store.cjs#setLanguage`, `website/app.js#setLanguage`

A saveLanguage routes typed capability-checked revision-aware requests to durable storage. Inline l concatenates bilingual copy. D stores mb-docs-language but keeps document language en and article bodies English. C shares browser presentation.

Missing behavior: Complete localization and separate resources absent; bilingual layout proof missing.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts#saveLanguage/effectiveLanguage/l`, `src/main/broker.cjs#settings.setLanguage`, `src/main/storage/settings-store.cjs#setLanguage`, `website/app.js#setLanguage`

A saveLanguage routes typed capability-checked revision-aware requests to durable storage. Inline l concatenates bilingual copy. D stores mb-docs-language but keeps document language en and article bodies English. C shares browser presentation.

Missing behavior: Complete localization and separate resources absent; bilingual layout proof missing.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts#saveLanguage/effectiveLanguage/l`, `src/main/broker.cjs#settings.setLanguage`, `src/main/storage/settings-store.cjs#setLanguage`, `website/app.js#setLanguage`

A saveLanguage routes typed capability-checked revision-aware requests to durable storage. Inline l concatenates bilingual copy. D stores mb-docs-language but keeps document language en and article bodies English. C shares browser presentation.

Missing behavior: Complete localization and separate resources absent; bilingual layout proof missing.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts#saveLanguage/effectiveLanguage/l`, `src/main/broker.cjs#settings.setLanguage`, `src/main/storage/settings-store.cjs#setLanguage`, `website/app.js#setLanguage`

A saveLanguage routes typed capability-checked revision-aware requests to durable storage. Inline l concatenates bilingual copy. D stores mb-docs-language but keeps document language en and article bodies English. C shares browser presentation.

Missing behavior: Complete localization and separate resources absent; bilingual layout proof missing.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

Applicability AP-001: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
