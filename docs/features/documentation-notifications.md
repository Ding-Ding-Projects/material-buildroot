# Documentation, release history and notification review

## Read offline help

Open **Help and documentation** in the workspace. The build bundles the indexed documentation and design articles, their category indexes and admitted local images. The reader provides local title/body search, its existing regular-expression builder, heading navigation, article links, Back, Forward and Home. The most recently opened article and section are remembered locally and restored on the next visit. A missing article remains an explicit unavailable result.

Markdown is rendered by the host's shared renderer with raw HTML disabled. Relative links resolve only to admitted bundled article IDs and anchors. External HTTPS links require an explicit click and are reopened from host-owned link identifiers. Images cannot cause network requests. Missing or unsupported resources remain visible as unavailable. No documentation action starts a build or changes a project.

## Review notifications

The header's **Notifications & changes** control opens a non-modal review centre. Escape and Close return focus to its trigger. Workspace-save results, terminal build-job transitions and unsuccessful operation replies create fixed, host-authored notifications without recording request payloads, project paths, credentials or raw errors. Reporting failure never changes an operation's result.

Notification records and review decisions use the existing local append-only notification store. Mark read, mark unread, resolve and dismiss preserve the original event. Mark unread restores an item to the pending review workflow. Records are loaded in pages of 100; the visible count distinguishes loaded records from total history. Text or worker-isolated regex search, review-state filtering and date range compose over the loaded records. Filter settings persist locally.

Checkboxes support keyboard selection and Shift-click ranges. Select all and invert explicitly affect loaded matches. The affected-item preview shows the selected titles and timestamps before a bulk review action. Bulk review requests contain at most 100 IDs each. Partial writes are reported honestly and can be inspected after reloading. Copy and Markdown export contain the selected matching records, or all loaded matches when nothing is selected, and record the active range and search. Records cannot be permanently deleted through this surface.

## Read release history

The Changelog view includes the captured published release inventory in `src/main/documentation/releases.json`. Each record retains the forge's exact version, title, publication timestamp, notes, release URL and resolved source commit. The snapshot timestamp is displayed; releases published after that snapshot are not silently inferred. Missing notes say that no notes were recorded. Raw release text is preserved, not rewritten into invented fixes or translated facts.

Release bodies use the same inert host Markdown renderer as offline articles. The original source commit and release page have explicit host-owned link actions. Date and text/regex filters compose, and selection, copy and Markdown export retain source references. The documentation bundling step requires every captured source commit to exist before producing a new bundle. Release acquisition is separate from normal builds and needs an explicit snapshot refresh when new releases are published.

## Inspect connection state

The Connection status view consumes only the existing typed Status Hub read/refresh projection: fixed state and reason codes, last attempt, last successful delivery and authenticated-delivery boolean. A missing client or enrollment remains unavailable. Refresh uses the trusted host service; the renderer receives no enrollment action, address, credential, raw service error or inbox content. Reading the surface is not evidence of authenticated delivery.

## Remaining acceptance

This implementation was prepared under an explicitly build-only delivery mode. Tests, static analysis, runtime exercises, accessibility evaluation and screenshots were deferred. The range calendar offers month/year jumps, endpoint selection, inclusive ranges, today/7-day/30-day presets and typed ISO or M/D/YYYY input; incomplete input stays visible with an inline message. Per-entry funny-level rewriting and permanent deletion are not implemented here. Notification history covers workspace saves, terminal build-job transitions and unsuccessful operation replies; download-specific progress remains in its existing update surface. The release inventory is a dated snapshot, not a live network feed. Offline completeness is scoped to the repository's admitted article inventory; absent external wiki history is not fabricated. These gaps remain acceptance work, not verified features.
