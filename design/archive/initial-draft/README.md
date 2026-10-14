# Material Buildroot application design plan

Status: proposed, awaiting product decisions and independent design review. This is a planning artifact, not an implemented interface or runtime acceptance report. No renderer implementation is authorized by this document.

Baseline: `c0d99b8295f7466efff4ce3a69a503df22161946`. Target: Windows Electron desktop application with Lit composites and genuine registered Material Design 3 primitives from `@material/web`. Buildroot executes in WSL 2 or Linux Docker containers, not natively on Windows. The separate public documentation website is outside this application design lane.

## Product direction

Open into productive work. With an existing project, restore its Configuration workspace, selected category, inspector and current task. With no project, show the same workspace chrome around an honest project empty state with Open project and guided Create project actions. Never invent a recent project, successful build, device image or runtime readiness.

The working hierarchy is project, configuration, build task, artifact. Runtime status is persistently reachable without becoming a landing-page dashboard. Advanced features are organized into task workspaces, with the common command palette providing discovery and exact-control navigation.

## Proposed composition

At 1440 × 960 CSS pixels: a 64 px application toolbar, 224 px left dock, 240 px category tree, flexible configuration table with a minimum useful width of 360 px, and 300 px detail inspector. The bottom task/log panel starts at 210 px and can collapse. These dimensions are starting references, not fixed restrictions. Split boundaries have pointer and keyboard resize controls, persisted sizes and Reset layout.

The toolbar carries project selection, backend health, configuration save state, primary Build action, active task access, command search and notification count. The top-level dock contains Projects, Configuration, Builds, Artifacts, Tools, History, Documentation and Settings. Tabs support all four edges with left as default, overflow, pinning, groups, reorder, discovery and contextual actions. Icons never replace accessible full labels.

At the minimum 960 × 640 client area, the dock collapses to a labelled edge control. Tree and inspector become independently opened bounded drawers, leaving the configuration table usable. At high zoom, the toolbar wraps into meaningful rows; controls are not scaled down to fit. The log panel retains a visible reopen action. No horizontal page overflow; wide task data scrolls inside a named region.

## Visual direction

Use a quiet green and warm-neutral Material 3 scheme: proposed seed `#426B3C`, surface `#F8FAF3`, on-surface `#1A1D18`, tonal container `#D5E8CB`. Dark colors must be derived and contrast-tested, not inverted. Rounded workspace surfaces use 20 px major corners, 12 px inset surfaces, and genuine Material control shapes. Dense data rows remain readable with at least 40 px row height and 44 px standalone targets. Comfortable density increases spacing without changing functionality.

Typography uses a locally bundled Latin face with complete CJK-safe Cantonese fallback. Font acquisition requires a reviewed script, canonical source URLs, complete returned subsets and per-file hashes. No assets have been downloaded for this plan. Data and command tokens use a bundled monospace face; exact paths and symbols never receive playful translation.

Motion communicates expansion, task progression and state change. Respect platform reduced motion, offer independent low-stimulation mode, and never require animation to discover an action. Error, warning and progress meanings use text and icons as well as color.

## Core workflows

1. Open or create a project: select a Buildroot tree through a native folder picker, validate version and backend mapping, choose an output tree, select a real discovered defconfig, review changes, then create or adopt. Existing checkouts and outputs remain preserved. The wizard explains storage, host/container paths and permissions before writing.
2. Configure: browse actual Kconfig hierarchy, search prompts/symbols/help, edit typed values inline, inspect dependencies and consequences, review pending changes and apply. Boolean, tristate, numeric, string and choice nodes use appropriate controls; unassignable values show the actual dependency reason. Unknown metadata is labelled unknown.
3. Build: preflight project/backend/toolchain/storage, select a named supported target, review affected output, run, monitor actual phase/log/task state, cancel cooperatively and inspect cancellation settlement. No fabricated percentage when the backend exposes only logs.
4. Inspect results: browse real artifacts with size/type/time/checksum when available, preview safe formats, export a selected set and open the result in the selected editor. Legal information and graphs retain generation status and source task identity.
5. Recover: show missing runtime, invalid source, stale configuration, build failure and interrupted task states where the initiating action lives. Offer a specific retry/setup/restore route with an explanation. A disconnected runtime never becomes a successful build or a stopped process by assumption.

## Shared action and state architecture

One descriptor per editable setting or operation supplies identity, label/help, type, bounds, enum source, current value, default provenance, validation, permissions, persistence, confirmation, undo/history and exact action. The inline table, inspector, optional guided wizard and command palette consume that descriptor. Rendering a control in several places never creates competing state.

The proposed preload boundary is `window.studio.invoke(action, payload)` plus `onEvent(listener)`. Action names are allowlisted and validated in the privileged process. Project descriptors carry `id`, `name`, `root`, `output`, `backend`, `distro`, `image`, `jobs` and `external`. Kconfig nodes carry `id`, `name`, `prompt`, `type`, `value`, `help`, `visible`, `assignable`, `children` and `choices`. Exact payload schemas, dependency semantics and event ordering remain integration decisions; these names are not proof that handlers exist.

Proposed domain routes: `buildroot.discover`, `validateProject`, `defconfigs`, `kconfig`, `setSymbols`, `saveDefconfig`, `run`, `cancel`, `tasks`, `artifacts`, `readArtifact`, `exportArtifacts`, `installPrerequisites`, `buildImage`, `packageGraph`, `buildGraph` and `legalInfo`, each with the `buildroot.` prefix. The shell uses separately validated persistence, native dialogs, export, documentation, snapshots, updates and external-link actions. Never pass raw shell commands from the renderer.

The Tools workspace hosts registered `<studio-universal>` with an explicit API/language contract and notification event. It remains part of this app and inherits app search, accessibility, persistence and navigation; linking to another app does not satisfy embedded tool delivery.

## Ownership and review gate

This lane owns `design/**` and, only after renewed implementation authorization and independent design approval, `src/renderer/**` excluding `src/renderer/universal/**`, `tests/gui*.*`, and `docs/features/interface/**`. Main-process persistence, backend execution, universal tools and website have separate owners.

An independent reviewer must assess the screen inventory, component provenance, workflow reachability, responsive matrix and unanswered decisions before frontend implementation. Record their actual model, verdict and requested changes. Design references remain proposed; a later reference viewer must render the actual checked-in references and expose deterministic screen/state/theme/viewport/scale routes. Neither references nor browser previews establish Windows product acceptance.

See [screen inventory](screens.md), [component provenance](components.md), [acceptance plan](acceptance.md), and [product questions](questions.md).
