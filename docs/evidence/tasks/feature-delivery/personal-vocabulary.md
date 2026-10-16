# personal-vocabulary delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Visible local-only bounded JSON upload, atomic validation, replace/clear/corrupt states and leak exclusions

Overall: **partial**. This label remains provisional.

Public ledger requirements: `personal-vocabulary-REQ-01`, `personal-vocabulary-REQ-02`, `personal-vocabulary-REQ-03`, `personal-vocabulary-REQ-04`, `personal-vocabulary-REQ-05`, `personal-vocabulary-REQ-06`, `personal-vocabulary-REQ-07`, `personal-vocabulary-REQ-08`, `personal-vocabulary-REQ-09`, `personal-vocabulary-REQ-10`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | missing |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/personal-vocabulary-panel.ts#importFile/clear/focusAction`, `src/renderer/owned-copy.ts#ownedCopy`, `src/shared/personal-vocabulary.mjs#parseVocabularyBytes/createVocabularyController`, `src/shared/personal-vocabulary-indexeddb.mjs`, `website/app.js#taskGuides.vocabulary`

Native selection feeds bounded bytes to serialized whole-file validator then private IndexedDB commit and ownedCopy. Clear suppresses immediately; deletion error locks changes until reload. Only selected shell labels/headings/palette text use ownedCopy. D explicitly states it does not accept wording files.

Missing behavior: Whole-interface substitution and independent D/C upload missing; nested search completeness missing. Drop is a separate identity.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/personal-vocabulary-panel.ts#importFile/clear/focusAction`, `src/renderer/owned-copy.ts#ownedCopy`, `src/shared/personal-vocabulary.mjs#parseVocabularyBytes/createVocabularyController`, `src/shared/personal-vocabulary-indexeddb.mjs`, `website/app.js#taskGuides.vocabulary`

Native selection feeds bounded bytes to serialized whole-file validator then private IndexedDB commit and ownedCopy. Clear suppresses immediately; deletion error locks changes until reload. Only selected shell labels/headings/palette text use ownedCopy. D explicitly states it does not accept wording files.

Missing behavior: Whole-interface substitution and independent D/C upload missing; nested search completeness missing. Drop is a separate identity.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/personal-vocabulary-panel.ts#importFile/clear/focusAction`, `src/renderer/owned-copy.ts#ownedCopy`, `src/shared/personal-vocabulary.mjs#parseVocabularyBytes/createVocabularyController`, `src/shared/personal-vocabulary-indexeddb.mjs`, `website/app.js#taskGuides.vocabulary`

Native selection feeds bounded bytes to serialized whole-file validator then private IndexedDB commit and ownedCopy. Clear suppresses immediately; deletion error locks changes until reload. Only selected shell labels/headings/palette text use ownedCopy. D explicitly states it does not accept wording files.

Missing behavior: Whole-interface substitution and independent D/C upload missing; nested search completeness missing. Drop is a separate identity.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/personal-vocabulary-panel.ts#importFile/clear/focusAction`, `src/renderer/owned-copy.ts#ownedCopy`, `src/shared/personal-vocabulary.mjs#parseVocabularyBytes/createVocabularyController`, `src/shared/personal-vocabulary-indexeddb.mjs`, `website/app.js#taskGuides.vocabulary`

Native selection feeds bounded bytes to serialized whole-file validator then private IndexedDB commit and ownedCopy. Clear suppresses immediately; deletion error locks changes until reload. Only selected shell labels/headings/palette text use ownedCopy. D explicitly states it does not accept wording files.

Missing behavior: Whole-interface substitution and independent D/C upload missing; nested search completeness missing. Drop is a separate identity.

Missing proof: No pinned-current built interaction, persistence/recovery or accessibility tuple proof admitted.

Next action: Complete named behavior then verify each surface independently.

Applicability AP-003: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
