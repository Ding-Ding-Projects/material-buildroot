# Application design handoff

Status: proposed planning reference. No renderer implementation, prototype or genuine application capture exists. Owner decisions in [DECISIONS.md](../DECISIONS.md) override earlier design suggestions. Independent review findings must be resolved before implementation.

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

- [Screen/state inventory](screens.md)
- [Component provenance](components.md)
- [Acceptance and evidence matrix](acceptance.md)
- [Complete feature inventory](../docs/planning/feature-coverage.md)
- [Architecture, typed actions and security boundaries](../docs/planning/architecture.md)
- [Independent planning review](REVIEW.md)
- [Independent application, documentation and companion surfaces](../docs/planning/surfaces.md)

The separate website has its own screen, feature and evidence inventory. Application references never establish website parity or Windows runtime proof.
