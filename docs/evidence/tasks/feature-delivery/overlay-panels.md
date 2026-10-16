# overlay-panels delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Bounded own-surface overlays, accessible move/resize/focus/restore

Overall: **partial**. This label remains provisional.

Public ledger requirements: `overlay-panels-REQ-01`, `overlay-panels-REQ-02`, `overlay-panels-REQ-03`, `overlay-panels-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | partial |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts`, `src/renderer/workspace-styles.ts`, `src/renderer/operations-panel.ts`, `src/renderer/settings-search.ts`, `src/renderer/operations-panel.ts resizeDock (line 1180), dock separator (line 1325)`

md-dialog has Material surface and width cap; settings-search builder paints background/border. resizeDock bounds height 80..400 and ArrowUp/Down adjusts it. dockHeight initializes 140 with no save route; other panels lack full geometry controls.

Pointer or ArrowUp/Down updates dockHeight within 80..400.

No persistence; initializes 140 at line 98.

Missing behavior: Own background, border, elevation and shape for every overlay Viewport bounds, scrolling, stack order and anchor visibility across language/scale tuples Every panel edge/corner resize with keyboard path Floating header drag and keyboard move with recoverable viewport bounds Per-surface geometry persistence and reset

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`, `website/style.css`, `website/build.mjs`, `gallery/gallery.js`, `gallery/styles.css`, `src/renderer/operations-panel.ts resizeDock (line 1180), dock separator (line 1325)`

setDrawer has responsive modal semantics; search has keyboard dismissal. CSS paints surfaces, but no universal resize/move/persist/reset.

Pointer or ArrowUp/Down updates dockHeight within 80..400.

No persistence; initializes 140 at line 98.

Missing behavior: Own background, border, elevation and shape for every overlay Viewport bounds, scrolling, stack order and anchor visibility across language/scale tuples Every panel edge/corner resize with keyboard path Floating header drag and keyboard move with recoverable viewport bounds Per-surface geometry persistence and reset

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`, `website/style.css`, `src/main/security/companion-server.cjs`, `src/renderer/operations-panel.ts resizeDock (line 1180), dock separator (line 1325)`

Inline companion records inherit browser surfaces; no universal geometry controls or persistence.

Pointer or ArrowUp/Down updates dockHeight within 80..400.

No persistence; initializes 140 at line 98.

Missing behavior: Own background, border, elevation and shape for every overlay Viewport bounds, scrolling, stack order and anchor visibility across language/scale tuples Every panel edge/corner resize with keyboard path Floating header drag and keyboard move with recoverable viewport bounds Per-surface geometry persistence and reset

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `docs/planning/feature-evidence.json`, `docs/planning/surfaces.md`, `docs/evidence/modern-workspace/current/captures.json`, `website/evidence/interactive-guides/browser-check.json`, `src/renderer/operations-panel.ts resizeDock (line 1180), dock separator (line 1325)`

Planning inventory exists; dedicated complete delivery articles, all-clause gates and current built proof do not.

feature-evidence.json contains planned future A/D/C implementation/article/test paths. Exact pinned ls-tree does not contain those feature modules. Broader documentation and historical receipts do not deliver this clause.

Pointer or ArrowUp/Down updates dockHeight within 80..400.

No persistence; initializes 140 at line 98.

Missing behavior: Dedicated article and Cantonese twin cover behavior, restrictions and recovery All three language modes and both funny-level extremes Hand-written real implementation/persistence/consumer inventory Recorded red-then-green negative regression for each material invariant Current built per-clause interactions, screenshots and required tuple matrix

Missing proof: Complete per-clause delivery evidence absent.

Next action: Replace planned references with real source and current accepted proof while retaining honest gaps.

Applicability AP-016: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
