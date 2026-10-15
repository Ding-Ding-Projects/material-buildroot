# Unintegrated schedule editor recovery draft

This archive preserves an unfinished renderer draft at the requested closeout. It is not imported, built or enabled by the application. `schedule-editor.patch` contains only the proposed `src/renderer/main.ts` changes and new `src/renderer/scheduled-preferences-panel.ts`. The receipt binds the original draft bytes and records byte-identical reconstruction from the committed base before active files were restored.

The draft proposes typed local-rule editing, timezone/date/time/weekday and priority fields, enable/reorder/delete, revision-bound saves, history, unsaved-draft dialogs, and live language/theme consumers. Shared-mode restrictions take priority. External enrollment forms were not started. The draft passed TypeScript but has no browser acceptance; it must not be presented as working production functionality.

Before integration, review navigation and window-close draft guards (including direct route changes), asynchronous revision/conflict recovery, hidden mixed-language rules under shared restrictions, effective-versus-base restoration and media changes, field validation, keyboard/focus, reduced motion and narrow layouts. Add actual SQLite service/IPC browser fixtures for save/reload, active override, unchanged base, expiry/revert, shared precedence, history, cancellation and unavailable states. The source schema has since gained enrollment actions; consume only reviewed current types and do not infer source authority from rule URLs.

To resume, inspect the receipt and patch against the current source, resolve intervening changes, then complete review and focused verification before enabling the consumer. The patch is a recovery artifact, not a release feature or an automatic migration.
