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

This is the bounded source inventory for this change, not proof of universal per-element guidance. Other surfaces and every individual repeated action have not received independent info-button acceptance in this change.

## Useful empty-editor preset

The existing GNU Hello starter remains available under Start from example metadata. It never loads automatically. A populated draft requires an explicit replacement checkbox before the starter button becomes available. Changing the draft revokes that approval. Real source and license hashes remain empty because an example must not invent verification. Undo draft restores the prior recipe.

## Two separate undo histories

Package semantic history keeps up to 50 prior in-memory model snapshots, including metadata edits, list changes, imports, example loading and dependency removal. Undo/redo invalidates any generated preview and approval. New edits clear redo. It does not reverse files already written to an external tree and does not claim persistent recovery after closing the application.

Diagram undo/redo changes positions and viewport only. The selected-node picker and numeric X/Y fields provide an alternative to dragging. Coordinates must be finite and within -10000 through 10000. A focused node moves in ten-unit steps with arrow keys. Delete targets that focused removable node. A focused background pans with arrows, zooms with + or -, and supports Ctrl/Cmd+Z with Shift for redo. The existing toolbar remains available for keyboard activation.

## Settings provenance

Language continues to show the host-confirmed `default`, `saved` or unavailable origin. Theme distinguishes a loaded workspace document, session-only fallback, and unavailable/loading storage, states the compiled initial value (`system`) and current base value, and explains schedule overrides. The workspace host currently does not expose per-field written-versus-default origin for theme; this gap is disclosed rather than inferred from the value or document revision.

## Remaining acceptance

No tests, static analysis, runtime interaction, visual review or screenshots were performed for this source change under the requested release mode. Builds and packaging are owned by the coordinating release lane. Native equivalents, exhaustive guidance inventory, negative regressions, persisted semantic draft recovery, exact theme field provenance and real interaction/accessibility/layout acceptance remain unverified or incomplete. Documentation is not evidence that a sample or a real host action executed.
