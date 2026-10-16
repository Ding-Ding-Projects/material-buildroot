# regex-search delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Independent anchored full regex workbench at every search/menu/picker

Overall: **partial**. This label remains provisional.

Public ledger requirements: `regex-search-REQ-01`, `regex-search-REQ-02`, `regex-search-REQ-03`, `regex-search-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | partial |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/regex-workbench.ts`, `src/renderer/regex-worker.ts`, `src/renderer/settings-search.ts`

RegexWorkbench.run uses a 250ms Worker; regex-worker bounds data and zero-width matching. SettingsSearch query/pattern are independent and its pattern/flags panel is shallow. D showSearch is literal filtering. C lacks full local search.

Missing behavior: RegexWorkbench.run uses a 250ms Worker; regex-worker bounds data and zero-width matching. SettingsSearch query/pattern are independent and its pattern/flags panel is shallow. D showSearch is literal filtering. C lacks full local search.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`

RegexWorkbench.run uses a 250ms Worker; regex-worker bounds data and zero-width matching. SettingsSearch query/pattern are independent and its pattern/flags panel is shallow. D showSearch is literal filtering. C lacks full local search.

Missing behavior: RegexWorkbench.run uses a 250ms Worker; regex-worker bounds data and zero-width matching. SettingsSearch query/pattern are independent and its pattern/flags panel is shallow. D showSearch is literal filtering. C lacks full local search.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`

RegexWorkbench.run uses a 250ms Worker; regex-worker bounds data and zero-width matching. SettingsSearch query/pattern are independent and its pattern/flags panel is shallow. D showSearch is literal filtering. C lacks full local search.

Missing behavior: RegexWorkbench.run uses a 250ms Worker; regex-worker bounds data and zero-width matching. SettingsSearch query/pattern are independent and its pattern/flags panel is shallow. D showSearch is literal filtering. C lacks full local search.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `docs/planning/feature-evidence.json`

Admission-only planned consumers do not establish delivery; complete localized articles and current runtime proof remain incomplete.

Missing behavior: Admission-only planned consumers do not establish delivery; complete localized articles and current runtime proof remain incomplete.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

Applicability AP-021: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
