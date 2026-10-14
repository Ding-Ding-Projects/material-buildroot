# Planned component provenance

This is a proposed inventory. Imports, registrations, anatomy and interaction still require proof at the chosen dependency version. A custom-element name or wrapper is not evidence of a genuine Material component.

| Function | Proposed genuine primitives/composites | Proof required |
| --- | --- | --- |
| Actions | Material filled/tonal/outlined/text/icon buttons | Anatomy, states, focus, disabled behavior and exact registration |
| Text/value fields | Material fields with clear/browse/help composites | Shared consumer, validation, exact-value editing and label/accessibility |
| Selection | Material switches, checkboxes, radios and searchable select/menu composites | Keyboard/touch, actual options, dependency reasons |
| Numeric values | Material sliders plus exact numeric entry | Ranges/steps, accessible values, consistent consumers |
| Navigation | Material tabs plus reviewed browser-tab/dock composites | Four edges, axis-correct keyboard, grouping/pinning/overflow |
| Decisions/progress | Material dialogs, progress and dividers | Own bounded surface, truthful indeterminate state, focus return |
| Desktop data | Registered trees/tables/inspectors/log/code viewers | Real Material internals, semantic accessibility, density and all states |
| Visual editing | Registered canvas/timeline/topology/partition editors | Material control provenance, accessible equivalents and actual change consumers |
| Shared workspaces | Registered tool, settings, history, docs, palette, search, notifications and lock composites | Complete shared feature registration and per-surface evidence |

Evaluate `@material/web` and every proposed primitive against the complete Material Design 3 Expressive contract. It does not provide every required desktop/editor component. Review extensions or alternatives within the chosen application runtime rather than silently shipping incomplete conformance. Generic document markup is only plumbing or registered-component internals.

Maintain a hand-written screen/state-to-component map, local icon/font license/hash manifests, and a negative substitution test that fails when required components become generic rendered placeholders. Test shadow-root behavior and accessibility, not only tag presence.
