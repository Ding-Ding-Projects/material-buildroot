# accessibility-sizing delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Accessible controls, target sizing, zoom and layout without clipping

Overall: **partial**. This label remains provisional.

Public ledger requirements: `accessibility-sizing-REQ-01`, `accessibility-sizing-REQ-02`, `accessibility-sizing-REQ-03`, `accessibility-sizing-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | partial |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts`, `src/renderer/workspace-styles.ts`, `src/renderer/operations-panel.ts`, `src/renderer/settings-search.ts`

Material controls, labels, focus rules, responsive CSS and reduced-motion CSS exist. Everywhere-reachable tools, read-aloud exclusion, confirmed hide and locked restoration are absent. CSS alone proves no layout verdict.

Missing behavior: Visible default accessibility entry across shell/dialog/modal/fullscreen/narrow/locked surfaces Live persisted text size, contrast, motion, focus, larger targets, keyboard help and reset Initiated read-aloud start/pause/resume/stop/voice/rate with secret and restricted-content exclusion Separated explicit hide confirmation, Cancel initial focus and preference retention Searchable locked-state restoration/palette route, immediate re-enable and reset visibility Keyboard, focus, roles/names/states and screen-reader structure everywhere Content and target sizing at every language/density/viewport and 100/125/150/200 percent scale Explicit capability/surface inventory and negative regressions plus current built proof

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`, `website/style.css`, `website/build.mjs`, `gallery/gallery.js`, `gallery/styles.css`

Skip link, focus rings, responsive CSS and drawer focus/inert handling exist. Full tools/hide/restore/read-aloud are absent.

Missing behavior: Visible default accessibility entry across shell/dialog/modal/fullscreen/narrow/locked surfaces Live persisted text size, contrast, motion, focus, larger targets, keyboard help and reset Initiated read-aloud start/pause/resume/stop/voice/rate with secret and restricted-content exclusion Separated explicit hide confirmation, Cancel initial focus and preference retention Searchable locked-state restoration/palette route, immediate re-enable and reset visibility Keyboard, focus, roles/names/states and screen-reader structure everywhere Content and target sizing at every language/density/viewport and 100/125/150/200 percent scale Explicit capability/surface inventory and negative regressions plus current built proof

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`, `website/style.css`, `src/main/security/companion-server.cjs`

Shared browser semantics and named status regions exist. Full accessibility tools, hide/restore/read-aloud absent; authenticated layout unverified.

Missing behavior: Visible default accessibility entry across shell/dialog/modal/fullscreen/narrow/locked surfaces Live persisted text size, contrast, motion, focus, larger targets, keyboard help and reset Initiated read-aloud start/pause/resume/stop/voice/rate with secret and restricted-content exclusion Separated explicit hide confirmation, Cancel initial focus and preference retention Searchable locked-state restoration/palette route, immediate re-enable and reset visibility Keyboard, focus, roles/names/states and screen-reader structure everywhere Content and target sizing at every language/density/viewport and 100/125/150/200 percent scale Explicit capability/surface inventory and negative regressions plus current built proof

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `docs/planning/feature-evidence.json`, `docs/planning/surfaces.md`, `docs/evidence/modern-workspace/current/captures.json`, `website/evidence/interactive-guides/browser-check.json`

Planning inventory exists; dedicated complete delivery articles, all-clause gates and current built proof do not.

feature-evidence.json contains planned future A/D/C implementation/article/test paths. Exact pinned ls-tree does not contain those feature modules. Broader documentation and historical receipts do not deliver this clause.

Missing behavior: Dedicated article and Cantonese twin cover behavior, restrictions and recovery All three language modes and both funny-level extremes Hand-written real implementation/persistence/consumer inventory Recorded red-then-green negative regression for each material invariant Current built per-clause interactions, screenshots and required tuple matrix

Missing proof: Complete per-clause delivery evidence absent.

Next action: Replace planned references with real source and current accepted proof while retaining honest gaps.

Applicability AP-018: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
