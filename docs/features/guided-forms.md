# Guided forms, recipe drafts and keyboard diagrams

## Scope

The optional `guided-forms` component places a locally bundled information button directly above the associated control. It opens an inline non-modal explanation with a worked example, validation, Back, Next/Try, Reset and Cancel. Practice uses a fresh synthetic value, never the current field value. Closing destroys the sample state and returns focus to the entry button. It has no host operation API and never saves a practice value into the live document.

English, Cantonese and bilingual authored copy use the existing local wording pipeline. Technical values, external metadata, paths and user text remain literal. The entry is 44 CSS pixels; guidance remains in document flow.

## Control inventory

| Surface | Controls and purpose | Practice and real authority |
| --- | --- | --- |
| Package identity | Name, version, source URL, source filename, homepage and help | Synthetic package metadata, field-specific validation; actual generation still uses `package.preview` |
| Package build | Build system, Python setup type, license and license files | Isolated select choices and basename/license examples; host validates the actual model |
| Package dependencies | Package names and configuration symbols | Identifier examples; direct controls and diagram removal share semantic draft history |
| Package hashes | File, algorithm and digest | Synthetic all-zero digest explicitly has no checksum authority; actual hashes still require independently verified file digests |
| Package files | Patch URL, configure options, file hooks and overlays | Relative-path and octal examples; no download, shell or file operation occurs in practice |
| Defconfig discovery | Catalog entry selection and replacement workflow | Synthetic name validation explains trust, provenance, replacement consent and recovery; actual catalog/apply/save remain host actions |
| Settings language | Language picker | Isolated enumerated choice; actual Save and Discard retain existing confirmed-origin handling |
| Settings theme | Theme picker | Isolated enum; real picker retains immediate workspace mutation and schedule behavior |
| Diagram | Selection, X/Y coordinates, node arrows, background pan/zoom and layout history | Real layout controls; persisted layout still uses `canvas.read` and revision-checked `canvas.write` |

This is the bounded source inventory for this change, not proof of universal per-element guidance. Package action buttons include contextual information entries explaining preview, apply, example replacement, row add/remove/reorder, draft undo/redo and saved-history operations. The coordinate editor includes separate X and Y guidance. Other surfaces and repeated controls still require independent built interaction acceptance.

## Useful empty-editor preset

The existing GNU Hello starter remains available under Start from example metadata. It never loads automatically. A populated draft requires an explicit replacement checkbox before the starter button becomes available. Changing the draft revokes that approval. Real source and license hashes remain empty because an example must not invent verification. Undo draft restores the prior recipe.

## Two separate undo histories

Package semantic history keeps up to 50 prior in-memory model snapshots, including metadata edits, list changes, imports, example loading and dependency removal. Undo/redo invalidates any generated preview and approval. New edits clear redo. It does not reverse files already written to an external tree. Explicit Save draft and undo history persists the current recipe plus up to ten undo and ten redo snapshots. The in-memory history can retain up to 50 previous states; the UI states the smaller saved-history bound.

Diagram undo/redo changes positions and viewport only. The selected-node picker and numeric X/Y fields provide an alternative to dragging. Coordinates must be finite and within -10000 through 10000. A focused node moves in ten-unit steps with arrow keys. Delete targets that focused removable node. A focused background pans with arrows, zooms with + or -, and supports Ctrl/Cmd+Z with Shift for redo. The existing toolbar remains available for keyboard activation.

## Persistent draft recovery

The package editor offers explicit Refresh saved draft history, Save draft and undo history, and Restore selected draft. Nothing autosaves or restores silently. Refresh is required after selecting or reacquiring a project and prepared external tree, and after an uncertain operation. Restoration requires a selected recorded revision and explicit editor-replacement consent. It invalidates preview and file-write approval, clears pending dependency text, returns to Identity, and retains the previously displayed draft as an Undo step. A later explicit save preserves that restored editor state.

The host resolves current project authority and external-tree write authority on every call. It derives an internal storage key from project identity, source/output paths and filesystem identities, and the currently selected external-folder path and filesystem identity. The renderer supplies neither a storage path nor a persistent grant. Restart requires reacquiring current project and external-folder access; changed identities select a separate history. A saved draft is not a source-content snapshot: source changes within an unchanged directory still require a fresh package preview and host revision checks before writing.

Drafts reuse the existing atomic workspace store and append-only revision history under a dedicated host-owned package-drafts directory. Each saved model is limited to 32 KiB with exact known fields and bounded string/list shapes; incomplete field values are permitted because recovery must preserve unfinished edits. The saved bundle includes at most ten undo and ten redo models and is bounded below the workspace store's one-MiB ceiling. Actual package validity is still enforced by the existing preview/apply validation. Unsupported fields and credential-bearing source/homepage URLs are rejected. Draft contents are not sent to remote services, inserted into activity messages, or included in ordinary workspace exports. Local revision storage intentionally holds the saved recipe content.

History lists the most recent 25 recorded revisions. If older journal history is unavailable but the current state is readable, it reports that limitation and retains the latest saved draft as a recovery choice. A revision conflict requires refreshing history before another save or restore. The latest saved draft never replays a previous file approval or a grant. No recovery action writes package source files.

## Settings provenance

Language continues to show the host-confirmed `default`, `saved` or unavailable origin. Theme distinguishes a loaded workspace document, session-only fallback, and unavailable/loading storage, states the compiled initial value (`system`) and current base value, and explains schedule overrides. The host stores optional theme provenance atomically with the workspace transaction: a fresh workspace records the compiled default; an explicit preference save records its new revision; workspace restore and import record those distinct operations. Restoring a snapshot never masquerades as the original explicit write. Older documents without provenance remain unknown, even when their value equals the default. Their next explicit save establishes new provenance. Renderer requests cannot supply provenance; the host constructs it. Ordinary workspace export omits this host-owned metadata, and importing records the actual new import instead of trusting external origin claims.

## Remaining acceptance

No tests, static analysis, runtime interaction, visual review or screenshots were performed for this source change under the requested release mode. Builds and packaging are owned by the coordinating release lane. Native equivalents, exhaustive guidance inventory, negative regressions, historical theme provenance predating these records and real interaction/accessibility/layout acceptance remain unverified or incomplete. Documentation is not evidence that a sample or a real host action executed.
