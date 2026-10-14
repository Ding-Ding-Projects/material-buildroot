# Planned component provenance

This inventory records proposed registrations, not existing code. Every visible layout and control must be a real registered component. Generic HTML is permitted only as document plumbing or inside registered component internals. A registered wrapper does not excuse fake Material controls.

| Role | Genuine primitive or registered composite | Provenance and boundary |
| --- | --- | --- |
| Main actions | `md-filled-button`, `md-filled-tonal-button`, `md-outlined-button`, `md-text-button` | `@material/web/button`; retain real anatomy, states, focus and disabled behavior |
| Compact actions | `md-icon-button`, `md-filled-icon-button` | `@material/web/iconbutton`; local icons and meaningful accessible names |
| Value editing | `md-outlined-text-field`, `md-filled-text-field` | `@material/web/textfield`; registered field composite owns clear/browse/help/validation |
| Boolean/selection | `md-switch`, `md-checkbox`, `md-radio` | `@material/web`; values share descriptor consumers |
| Numeric controls | `md-slider` plus validated numeric field | `@material/web/slider`; exact entry and range accessible; no imprecise-only numeric editing |
| Tabs | `md-tabs`, `md-primary-tab`, `md-secondary-tab` where supported | `@material/web/tabs`; composite implements required vertical orientation, browser-style management and overflow; verify genuine anatomy rather than CSS rotation |
| Menus and choices | `md-menu`, `md-menu-item`, `md-list`, `md-list-item` | `@material/web`; searchable picker composite adds isolated anchored builder and keyboard path |
| Decisions | `md-dialog` | `@material/web/dialog`; informational messages stay non-modal |
| Progress and separators | `md-linear-progress`, `md-circular-progress`, `md-divider` | `@material/web`; indeterminate when actual percentage unknown |
| Application shell | `studio-app`, `studio-toolbar`, `studio-dock`, `studio-workspace`, `studio-panel` | Lit-registered composites using Material tokens and real primitives; own responsive layout/resizing |
| Domain views | `studio-projects`, `studio-config-tree`, `studio-symbol-table`, `studio-symbol-inspector`, `studio-builds`, `studio-artifacts`, `studio-runtime` | Lit composites; typed data and real allowlisted actions, no generic command catalogue |
| Shared interaction | `studio-field`, `studio-picker`, `studio-search`, `studio-regex-builder`, `studio-context-menu`, `studio-command-palette` | Lit composites; one action/setting registry and isolated field state |
| Cross-cutting state | `studio-notifications`, `studio-history`, `studio-docs`, `studio-settings`, `studio-confirmation`, `studio-element-editor` | Lit composites; required complete behavior and capability inventories |
| Tool suite | `studio-universal` and its registered descendants | Separate tool-suite owner; must pass the same component audit |

## Audit required before implementation approval

Confirm each chosen primitive exists at the pinned package version and document exact imports and runtime `customElements` registration. Material Web does not provide every required rich desktop component. Tree, table, vertical browser-style dock, code/log viewer, graphics editors, calendar and timelines require reviewed registered composites with genuine Material primitives, semantic accessibility and explicit provenance. Do not label an arbitrary custom element a genuine Material primitive simply because its name contains a product prefix.

Hand-written screen-to-component maps must include empty/error/loading/disabled/overlay states. The negative guard replaces a required primitive with a generic rendered placeholder and must fail. Test shadow-root accessibility and behavior, not tag-name presence alone. Future icon/font manifests record license, canonical URL, hash, ranges and actual bundled consumption.
