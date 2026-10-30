# Application design handoff

## Current implementation reference

The active visual direction is the complete `design/` folder from repository revision `9223534b5cfd4f2d6daa62bff9670411931f0f3d`, design tree `c7d0a32219113128af79808b69d5eb8ff0c446fa`. Use the [eight-artboard handoff](IMPLEMENTATION_HANDOFF.md), [shared component anatomy](m3.css), [light and dark color roles](theme.css), and [source identities](import-manifest.json). This revision supersedes the earlier attachment. The attachment is no longer an implementation input.

The target is Material 3 Expressive in the real Lit renderer: a 64-pixel title bar, a 96-pixel rail, rounded supporting panes, segmented lists, connected choice groups and registered Material Web controls. Preserve real records, typed host authority, drafts, local assets, localization and keyboard access. Reference sample records never become production data.

The normal and minimum client areas are 1440 by 960 and 960 by 640. Final runtime parity, all language/theme/scale tuples and current screenshots remain to be verified after implementation. Existing design images are historical references.

Earlier [design overview](archive/20261030-superseded-design-overview.md) and [attachment provenance](archive/20261030-superseded-import-manifest.json) are preserved for history. The operational contracts below remain applicable; earlier visual proposals yield to the current handoff.

Status: an executable desktop design fixture is authored under [reference/](reference/README.md). Its build and runtime remain unverified. No production renderer or genuine application capture is established by that fixture. Owner decisions in [DECISIONS.md](../DECISIONS.md) override earlier design suggestions. Independent review findings must be resolved before implementation.

## Productive workspace composition

Restore the last project, active workspace and active task. With no project, retain the working shell around honest Open/Create actions. Top-level workspaces: Projects, Configuration, Development, Builds, Outputs, Virtual Machines, Reproducibility, Tools, History, Documentation and Settings.

At a proposed normal 1440×960 client area, use a 64-pixel toolbar, 224-pixel left dock, 240-pixel configuration tree, flexible main table/canvas, 300-pixel inspector and collapsible 210-pixel task/log panel. These are starting references, not approved fixed dimensions. Resizers need pointer and keyboard support, persisted positions and Reset layout.

At the proposed minimum 960×640, replace tree/inspector/dock with bounded independently opened drawers as needed. Maintain readable controls at high scale rather than shrinking them. A named inner region may scroll wide data; the page must not overflow. The client minimum remains subject to owner and real layout verification.

Default to bilingual labels and system theme. Proposed color direction is green with warm neutral surfaces. Use actual Material color roles, full contrast-tested light/dark palettes, locally bundled complete Latin/CJK fonts and monospace technical tokens. Preserve exact symbol names, paths and code. Respect reduced motion and accessibility state without removing functionality.

## Interaction architecture

Typed action/setting descriptors provide identity, current/default values, allowed values, actual disabled reason, contextual help, validation, persistence, history, confirmation and dispatch. Direct controls, inspectors, guided workflows and the palette consume the same descriptors.

Configuration edits reconcile immediately, with serialized/debounced operations and explicit pending intent. Undo/history covers effective dependency changes as well as requested values. Upgrade migration uses a separate snapshot/preview/Apply flow. Required clean rebuilds explain the cause and request confirmation.

Trees, choice controls, switches, graphs, queues, previews and canvas editors are productive controls. Text/code editing is reserved for the underlying text/code tasks. Every enabled action has an actual backend consumer and truthful loading/error/cancellation/partial-result states.

## Canvas editor contract

Applicable candidates: guest/network topology, partition/disk layouts, package dependencies, build pipelines, image/logo editing and appearance timelines. Every editable canvas has selection, pan/zoom, useful snapping, an inspector, keyboard commands, accessible structured equivalents, validation, undo/redo and generated-change preview.

Keep dependency inspection read-only where the underlying relationship is derived. Enable editing only when a reviewed package/configuration consumer can apply it without losing unknown metadata. No arbitrary graph-to-shell execution.

## Handoff documents

- [Executable desktop reference and exact remaining gaps](reference/README.md)
- [Control, layout, focus and managed execution state contract](reference/control-map.md)
- [Hand-maintained deterministic state inventory](reference/states.json)
- [Screen/state inventory](screens.md)
- [Component provenance](components.md)
- [Acceptance and evidence matrix](acceptance.md)
- [Complete feature inventory](../docs/planning/feature-coverage.md)
- [Architecture, typed actions and security boundaries](../docs/planning/architecture.md)
- [Independent planning review](REVIEW.md)
- [Independent application, documentation and companion surfaces](../docs/planning/surfaces.md)

The separate website has its own screen, feature and evidence inventory. Application references never establish website parity or Windows runtime proof.

## Reference boundaries

The audit is discovery data, and its ten images are historical design references. The artboards retain their original design-tool support references; unavailable preview support does not establish a working offline canvas. Production uses local fonts and icons with no remote asset dependency. A design preview never establishes runtime behavior.
