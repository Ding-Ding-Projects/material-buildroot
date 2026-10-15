# Executable desktop reference

Status: authored design fixture, not a production application. Rendering, component registration, accessibility, layout and native behavior have not yet been verified. All displayed projects, revisions, operations and logs are synthetic. No backend, filesystem, credential, installation, workflow publication or build operation is performed.

## Entry and routes

The entry is `design/reference/index.html`. It imports `reference.js`, local fixture data, and genuine Material Web modules through the root dependency resolver. The repository root build entrypoint must build this entry before runtime review. Do not treat direct helper execution as root-build acceptance. Dependency versions and installation are owned by the root build configuration, not this folder. There are no CDN imports or external font requests.

Address a reference using `?screen=projects&state=populated&lang=both&theme=light`. Supported languages are `en`, `yue`, `both`; themes are `light`, `dark`, `system`. A missing language defaults to `both`; a missing theme defaults to `system`. For deterministic captures select light or dark explicitly. Unknown screen, state, language or theme values fall back to declared defaults. The state selector exposes each declared route. Theme and language changes update the address without discarding active draft values.

The 30 declared states are hand-maintained in [states.json](states.json), mirrored by `fixtures.js`, and described in [control-map.md](control-map.md). Reload resets synthetic data to the selected route. Fixture time is fixed at `2026-10-14T12:00:00Z`; operation IDs advance only on explicit interaction. No wall-clock simulation, random values or timers mutate the reference. Indeterminate progress is intentionally animated by the genuine component, so capture tooling must freeze its animation or capture under reduced motion and record that choice.

Normal client size is **1440×960 logical CSS pixels/DIPs** and minimum is **960×640 logical CSS pixels/DIPs**. OS display scale is a separate tuple field, never CSS `transform:scale`. Capture records must include actual `innerWidth`, `innerHeight`, device-pixel ratio and native display scale; physical pixel dimensions alone do not establish logical viewport size. Use the root-owned native reference viewer for Windows proof. A browser preview remains browser evidence.

## Scope and remaining gaps

These references concern desktop surface A. Surface D retains documentation, status, settings and download equivalents; it is not a primary-runtime imitation. Surface C requires explicit authenticated pairing and scoped authority before privileged actions. Reference data grants no such authority. R acceptance remains separate. All 105 required-feature identities remain in the authoritative feature inventory.

Implemented fixture interactions are enumerated in the control map. Remaining gaps include production action schemas and consumers, persistence across restart, full localization of technical fixture datasets and route-stage labels, complete typography/font bundling, all five distinct humor levels, full regex builders, complete tab/dock controls, genuine configuration semantics, rich tree/grid keyboard composites, queue reordering/resource enforcement, real runtime discovery, managed runner setup, YAML semantic validation, publication and output retrieval. Full settings, private vocabulary import, accessibility tools, locks, status integration, shared tools and every other applicable requirement remain open. No disabled control counts as a delivered feature.

The source currently registers `studio-reference` and `studio-project-grid`. Material control imports are real module imports, but importing them in source is not proof of successful runtime registration or conformant rendered anatomy. `control-map.md` records intended semantics and actual limitations. Production interaction receipts, reference captures, production captures, side-by-side comparisons, visual diffs and the full 48-tuple matrix per state are absent.

## Root build handoff

Configure the root build entrypoint to select this HTML entry, resolve the root's admitted `@material/web` and `lit` versions, set relative asset URLs, and write to a dedicated reference output such as `dist-design`. A Vite HTML input at this nested path ordinarily emits `dist-design/design/reference/index.html`; read back the actual emitted path before launching. The root owner controls build arguments, dependency admission and the exact successful invocation. This document does not claim that a command or build target already exists.
