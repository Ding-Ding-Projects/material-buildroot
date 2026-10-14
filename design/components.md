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

## Rich composite specifications requiring admission

| Proposed registered composition | Material foundation | Keyboard/accessibility contract |
| --- | --- | --- |
| `studio-browser-tabs` | Genuine tab/action/menu primitives and tab-state tokens | Axis-correct arrows, Home/End, Ctrl navigation, reorder/pin/group actions, focus after close and locked-tab interception |
| `studio-tree` | Genuine selectable list/disclosure/action composition | Tree/treeitem roles, depth/expanded/selection states, arrows/Home/End, typeahead, real disabled reasons |
| `studio-data-grid` | Material data-table anatomy and genuine cells/actions/selection | Grid/header/cell semantics, row/cell navigation, sort/filter/selection and accessible virtualization |
| `studio-calendar` | Material date-picker anatomy, fields/actions and date states | Roving date focus, month/year navigation, exact keyboard entry, locale/timezone and validation |
| `studio-timeline` | Material sliders/actions/selection and motion tokens | Numeric alternative for every keyframe, keyboard seek/edit, reduced-motion preview, labelled tracks and undo |
| `studio-layer-editor` | Material selection/menus/fields with real layer canvas | Ordered accessible layers, keyboard reorder, selection/focus, numeric property alternatives and validated preview |
| `studio-topology-editor` | Material node/edge selection, menus/inspectors/actions | Structured node/edge list alternative, keyboard connect/move/delete, constraints and actual transaction preview |

These are exact proposed responsibilities, not implemented/imported provenance. Before implementation approval, select supported source/spec references and validate each primitive/composition. If the selected library cannot satisfy conformance, resolve the dependency decision explicitly. Design source and actual rendered reference tuples remain separate evidence.
