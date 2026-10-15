# Desktop reference control and state map

This is a hand-maintained design contract. Actual fixture handlers live in `reference.js`. Production consumers and runtime proof remain absent.

## Layout, responsiveness and focus

The root registered composite owns all visible layout; semantic HTML is internal component anatomy. The top reference strip always discloses synthetic data. The product toolbar includes a separate unavailable product-version/provenance line. The fixed reference date is never presented as the product build date.

Logical dimensions: toolbar minimum 64, expanded navigation 224, compact rail 72, tree preferred 240 (bounds 200–320), inspector preferred 300 (bounds 260–360), splitter 12, workspace padding 24 normally and 16 below 1200. These dimensions are CSS pixels/DIPs, independent of OS scale. Toolbar height grows for text wrapping rather than clipping bilingual labels.

The observed workspace content box determines pane admission. Reserve 592 pixels for the central configuration region, including its 32 pixels horizontal padding, leaving **560 usable pixels**. Add each requested pane and its 12-pixel splitter. When the sum does not fit, suppress the inspector first, then the tree. At 1440 the reference normally keeps the tree inline and offers the inspector as a dialog. Below 1200 the navigation rail collapses before these pane decisions; below 700 the rail is removed and its toolbar navigation dialog remains available. The 700 behavior supports zoom/reflow but does not expand the declared desktop minimum.

`treePreferred` and `inspectorPreferred` store user intent for the fixture session. Responsive suppression is derived, never written into these values. Widening restores the requested panes when their width budget fits. Reset restores both preferences and preferred widths. Production persistence must store preferences separately from viewport-derived state. Pane content scrolls internally; data tables and logs have named bounded scrolling regions.

Splitters have `role=separator`, vertical orientation, accessible names, numeric bounds and current values. ArrowLeft decreases by 8; ArrowRight increases by 8; Shift uses 32; Home/End select bounds. Pointer dragging uses pointer capture and clamps to the same bounds. Insets and pane admission are recomputed after every resize. Production interaction must verify focus remains valid if a resized pane collapses; the current reference does not yet repair that focused-splitter collapse case.

At narrow sizes, tree, inspector and navigation open through genuine `md-dialog`. These are modal reference drawers with their own opaque surface, viewport bounds, a labelled heading and explicit Close action. Material dialog owns focus containment and Escape cancellation; the reference requests initial focus on Close, then restores the originating control on `closed`, falling back to the workspace heading when it no longer exists. Navigation moves focus to the destination heading. Escape behavior and focus return require actual keyboard verification, not source inference.

## Control wiring

| Screen | Registered anatomy and real fixture behavior | Production action contract |
| --- | --- | --- |
| S01/S02 projects | `studio-project-grid`, Material selection controls and text actions inside a semantic table. Literal search filters actual synthetic rows. Selection updates the selected ID. Opening a ready row navigates to Configuration; missing-source state reports a locate requirement. | `projects.list/open/locate`, capability-scoped paths, stable records, real missing-source detection. Native picker unavailable in fixture. |
| S02 wizard | Genuine fields/selects/sliders and buttons. Source route, name, runtime and parallelism remain in the draft across Back. Empty name routes to validation. Review shows exact draft. Create produces an in-memory fixture receipt; Cancel leaves source data untouched. | `projects.preview/create/adopt`, expected revision, idempotency key, resource manifest, durable receipt and partial-resource recovery. |
| S09 runtime | Runtime picker changes WSL/Docker content. Refresh reloads only fixture presentation and explicitly says no host was inspected. Use requires ready state. Other states explain unavailable admission. | `runtime.discover/validate/select`, observed version, non-root identity, writable output, capacity, ownership and freshness. Installation/restart are not executable here. |
| S03/S04 configuration | Genuine BusyBox switch changes requested value, retains effective value, enters pending. Explicit simulation controls accept or reject. Undo restores requested value to effective value. Optional pane preferences affect layout. | `configuration.edit/reconcile/undo`, serialized per output tree, requested/effective revision pair, authoritative semantics, atomic snapshot/rollback. Fixture menu buttons are selection demonstrations, not full Kconfig navigation. |
| S06/S07 builds | Start, pause admission, cancel request and simulated termination/result controls update visible fixture state. Follow switch and literal log filter affect local controls. Synthetic log never determines success. | `jobs.preview/submit/observe/cancel/reconnect/collect`, durable identity, output lock and source/config binding. Follow currently has no streaming source; queue reordering and bulk actions remain absent. |
| S11 settings | Language and theme update address and render; system theme listens to media changes. Two humor sliders update a preview at serious/other values. Reset changes pane preferences and widths. | Versioned persistent setting descriptors, all-level localized copy consumers, history/reset, complete settings inventory. Intermediate humor levels are not distinct yet. |
| Shared search dialog | Genuine dialog explains that regex controls are not implemented. It never labels literal filtering as regex support. | Independent bounded regex model, adjacent anchored workbench, validation, history and cancellation for every search instance. |

`md-outlined-text-field`, `md-outlined-select`/`md-select-option`, `md-switch`, `md-checkbox`, `md-slider`, Material filled/tonal/outlined/text buttons, `md-dialog`, and `md-linear-progress` are imported from the admitted package. Their registration, contrast, shadow-root accessibility and interaction must be exercised after the root build. The semantic table is not an admitted rich data-grid replacement. Full row/cell navigation, sort and virtualization remain open.

## Action identity and interruption

The fixture's action map records synthetic operation receipts only in memory. Repeating the same create draft or cancel request reuses its prior receipt. Queue start generates a new attempt; a new attempt is distinct from retrying an unacknowledged request. Fixture navigation/reload is not durable recovery and may reset data. This difference is disclosed, never presented as production durability.

| Action | Required identity | Interruption behavior in production |
| --- | --- | --- |
| Project creation/adoption | Client request ID plus canonical draft hash and expected project revision | Query receipt first; reconcile owned partial resources, preserve adopted trees, never blindly create a second project. |
| Configuration edit | Output-tree ID, expected effective revision, intent sequence | Reconcile serialized intent against snapshot; restore last usable effective revision on failure; preserve user intent for correction. |
| Build submit | Project/output/source/config identity plus stable request ID | Find durable job and owned process/container. Resume observation or mark interrupted. Explicitly create a new attempt only after ownership reconciliation. |
| Cancel | Existing job ID and cancellation request ID | Remain cancelling until ownership and complete termination are verified. Lost connection never means cancelled. |
| Save workflow draft | Destination ID, draft hash, expected revision | Return same saved revision, or preserve conflict for reviewed resolution. Save is not publish. |
| Publish workflow | Verified destination, reviewed content hash, expected repository revision | Read destination revision before retry; never overwrite an unexpected change or infer publication from local save. |
| Dispatch/collect | Published workflow revision, request ID, provider run ID; output digest for collection | Reconcile provider run before retry. Interrupted transfer preserves bounded partials and verifies checksums before exposing complete output. |

## Managed execution inventory

The separate screen family is S41, with the exact states listed below and in `states.json`.

| State | Visible facts and controls | Deliberate boundary |
| --- | --- | --- |
| setup | Purpose, standard hosted/self-hosted choice, source/dedicated execution repository. User builds require Linux; product packaging requires Windows and exact root batch entrypoints. | No paid runner default, no host registration, no credential intake, no encrypted-route authorization. |
| review | Generated YAML preview in a genuine multiline field; edits invalidate the review checkbox; reviewed draft can be saved in fixture memory. | Draft intentionally has no executable build steps. No semantic parser, immutable engine binding or permission validation is claimed. |
| saved | Synthetic saved-draft state, independent from publication. | No repository mutation. |
| published | Addressable synthetic workflow-publication observation. | Only the state selector can select it; Save never implies published. |
| queued | Synthetic accepted-run observation, exact fixture run ID. | No runner availability or work-start claim. |
| running | Synthetic running observation with indeterminate progress. | No known total invented. |
| unavailable | Explicit disconnected/unavailable observation. | Prior data never becomes current without a freshness receipt. |
| succeeded | Synthetic process-result observation. | Does not establish retrieved outputs, package acceptance, native installation or a release. |

The S41 inventory still needs guided self-hosted runner registration/verification, cancellation and attempt history, permissions diff, semantic YAML diagnostics, private-destination verification, conditional encrypted transport, reviewed generic engine extraction, actual output retrieval and independently verified publication. These are product requirements, not delivered fixture features.
