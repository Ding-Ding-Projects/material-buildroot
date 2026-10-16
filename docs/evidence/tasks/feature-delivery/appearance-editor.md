# appearance-editor delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Every-element typography/layers/geometry/states/effects/motion editor, timeline, undo and resets

Overall: **partial**. This label remains provisional.

Public ledger requirements: `appearance-editor-REQ-01`, `appearance-editor-REQ-02`, `appearance-editor-REQ-03`, `appearance-editor-REQ-04`, `appearance-editor-REQ-05`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | partial |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/renderer/main.ts`, `src/renderer/workspace-styles.ts`, `src/renderer/operations-panel.ts`, `src/renderer/settings-search.ts`, `src/renderer/main.ts settingsPanel/setTheme (line 550)`, `src/main/security/workspace-contract.cjs preferences (lines 66-67)`, `src/main/workspace-service.cjs preferences.update (line 65)`, `website/app.js setTheme (line 177)`

settingsPanel offers theme only. setTheme -> mutateWorkspace(preferences.update) -> workspace-contract.preferences validates system/light/dark -> workspace-service -> transactional store -> hydrateWorkspace/mediaChanged. Session mode resets at restart; unavailable persistence reports uncertainty. No element editor.

hydrateWorkspace and mediaChanged update theme after confirmed mutation.

src/main/storage/workspace-store.cjs transactional state and history; session mode explicitly temporary.

data-theme switches live CSS; OS changes used while system choice active.

mb-docs-theme localStorage; exceptions leave session behavior.

Missing behavior: Persisted live theme, density, seed colour, installed/bundled fonts, scale, weight and CJK fallback Every element/state/pseudo-state context and keyboard editor entry, including tabs/groups/editor controls Non-modal exact-target anchor tracking, viewport collision and focus return Word-depth typography: fonts, axes, decorations, colours, spacing, direction and alignment with capability explanations Layered non-destructive tools: selections, channels, masks, blend modes, effects, gradients, fills, transforms, crop, filters, paths and state inheritance Before/after and multi-state preview, zoom, rulers, guides and regex-enabled property inspector Animation and Transition tab with tracks, keyframes, properties, motion paths and composition Complete timing, easing, delays, iterations, direction, fill, playback rates and bounds Timeline/playback/seek/frame steps, clocks, sequencing, overlaps and interruption semantics Scoped transition triggers, debounce, cancellation, priority and inheritance without authority escalation Property/layer/track/state/element/global reset, undo/redo, history, presets, style copy/paste and validated portable import/export Localization, keyboard/screen-reader editing, schedules, palette teleport and reduced-motion preview Hand-written capability/consumer matrix, negative completeness and real per-click/timed evidence

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`, `website/style.css`, `website/build.mjs`, `gallery/gallery.js`, `gallery/styles.css`, `src/renderer/main.ts settingsPanel/setTheme (line 550)`, `src/main/security/workspace-contract.cjs preferences (lines 66-67)`, `src/main/workspace-service.cjs preferences.update (line 65)`, `website/app.js setTheme (line 177)`

setTheme applies data-theme with mb-docs-theme storage and session fallback; gallery-theme similarly persists. No density/seed/font/element editor.

hydrateWorkspace and mediaChanged update theme after confirmed mutation.

src/main/storage/workspace-store.cjs transactional state and history; session mode explicitly temporary.

data-theme switches live CSS; OS changes used while system choice active.

mb-docs-theme localStorage; exceptions leave session behavior.

Missing behavior: Persisted live theme, density, seed colour, installed/bundled fonts, scale, weight and CJK fallback Every element/state/pseudo-state context and keyboard editor entry, including tabs/groups/editor controls Non-modal exact-target anchor tracking, viewport collision and focus return Word-depth typography: fonts, axes, decorations, colours, spacing, direction and alignment with capability explanations Layered non-destructive tools: selections, channels, masks, blend modes, effects, gradients, fills, transforms, crop, filters, paths and state inheritance Before/after and multi-state preview, zoom, rulers, guides and regex-enabled property inspector Animation and Transition tab with tracks, keyframes, properties, motion paths and composition Complete timing, easing, delays, iterations, direction, fill, playback rates and bounds Timeline/playback/seek/frame steps, clocks, sequencing, overlaps and interruption semantics Scoped transition triggers, debounce, cancellation, priority and inheritance without authority escalation Property/layer/track/state/element/global reset, undo/redo, history, presets, style copy/paste and validated portable import/export Localization, keyboard/screen-reader editing, schedules, palette teleport and reduced-motion preview Hand-written capability/consumer matrix, negative completeness and real per-click/timed evidence

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`, `website/style.css`, `src/main/security/companion-server.cjs`, `src/renderer/main.ts settingsPanel/setTheme (line 550)`, `src/main/security/workspace-contract.cjs preferences (lines 66-67)`, `src/main/workspace-service.cjs preferences.update (line 65)`, `website/app.js setTheme (line 177)`

Shared browser theme state is present. No independent element editor or browser-local appearance authoring. Server ACTION_SCOPES does not provide appearance commands.

hydrateWorkspace and mediaChanged update theme after confirmed mutation.

src/main/storage/workspace-store.cjs transactional state and history; session mode explicitly temporary.

data-theme switches live CSS; OS changes used while system choice active.

mb-docs-theme localStorage; exceptions leave session behavior.

Missing behavior: Persisted live theme, density, seed colour, installed/bundled fonts, scale, weight and CJK fallback Every element/state/pseudo-state context and keyboard editor entry, including tabs/groups/editor controls Non-modal exact-target anchor tracking, viewport collision and focus return Word-depth typography: fonts, axes, decorations, colours, spacing, direction and alignment with capability explanations Layered non-destructive tools: selections, channels, masks, blend modes, effects, gradients, fills, transforms, crop, filters, paths and state inheritance Before/after and multi-state preview, zoom, rulers, guides and regex-enabled property inspector Animation and Transition tab with tracks, keyframes, properties, motion paths and composition Complete timing, easing, delays, iterations, direction, fill, playback rates and bounds Timeline/playback/seek/frame steps, clocks, sequencing, overlaps and interruption semantics Scoped transition triggers, debounce, cancellation, priority and inheritance without authority escalation Property/layer/track/state/element/global reset, undo/redo, history, presets, style copy/paste and validated portable import/export Localization, keyboard/screen-reader editing, schedules, palette teleport and reduced-motion preview Hand-written capability/consumer matrix, negative completeness and real per-click/timed evidence

Missing proof: No accepted current pinned-source built interaction, language/theme/scale and accessibility evidence. Earlier and fixture receipts remain bounded history.

Next action: Implement absent behavior and then drive focused current built proof.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `docs/planning/feature-evidence.json`, `docs/planning/surfaces.md`, `docs/evidence/modern-workspace/current/captures.json`, `website/evidence/interactive-guides/browser-check.json`, `src/renderer/main.ts settingsPanel/setTheme (line 550)`, `src/main/security/workspace-contract.cjs preferences (lines 66-67)`, `src/main/workspace-service.cjs preferences.update (line 65)`, `website/app.js setTheme (line 177)`

Planning inventory exists; dedicated complete delivery articles, all-clause gates and current built proof do not.

feature-evidence.json contains planned future A/D/C implementation/article/test paths. Exact pinned ls-tree does not contain those feature modules. Broader documentation and historical receipts do not deliver this clause.

hydrateWorkspace and mediaChanged update theme after confirmed mutation.

src/main/storage/workspace-store.cjs transactional state and history; session mode explicitly temporary.

data-theme switches live CSS; OS changes used while system choice active.

mb-docs-theme localStorage; exceptions leave session behavior.

Missing behavior: Dedicated article and Cantonese twin cover behavior, restrictions and recovery All three language modes and both funny-level extremes Hand-written real implementation/persistence/consumer inventory Recorded red-then-green negative regression for each material invariant Current built per-clause interactions, screenshots and required tuple matrix

Missing proof: Complete per-clause delivery evidence absent.

Next action: Replace planned references with real source and current accepted proof while retaining honest gaps.

Applicability AP-013: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
