# Workspace history and scoped exports

The workspace backup controls in Settings record applied project plans, their notes,
the workspace theme, and setup progress. They do not snapshot source checkouts,
build output, the project catalogue, project options, scheduled preferences, or
protected credential stores. Those records retain their own storage contracts.

## Revisions and recovery

Each successful workspace mutation records complete before and after states beside
the application data file. An isolated bare Git repository stores immutable revision
files and append-only commits. It has no working tree in a user's project and the
application never adds a remote, pushes, synchronizes, rewrites or automatically
prunes its history. Git must be available to the host through its supported executable
search path. A missing executable or inaccessible history storage produces an explicit
warning while preserving the successful workspace save.

The revision list loads 25 records at a time and supports older pages, comparison
against the current workspace, append-only labels and restore. Comparison shows
created, removed and changed plan records plus changed workspace preferences and
setup progress. Named snapshots continue to work. Both snapshot restore and revision
restore create a new workspace revision, leaving earlier history available. Restoring
does not import credentials or change the application's language setting.

Existing workspace documents remain version 1 and are not reset or destructively
migrated. Historical activity that predates full-state capture cannot be reconstructed
and is not presented as a restorable revision. Complete history starts with the first
save using this implementation. Unchanged preference and plan values do not create
new revisions. Pending renderer edits are not included in saved snapshots or exports.

## Explicit cache retention

Choose 25, 100 or 500 recent cached revisions and review the confirmation before
removing redundant cache files. Removal occurs only after comparing the cached bytes
with the corresponding immutable Git record. All history commits and full revision
contents remain stored, and uncached revisions restore directly from Git. This is
cache retention, not irreversible history deletion or a promise to reclaim the entire
history size. No pruning runs automatically. A partially interrupted cache cleanup
does not remove the corresponding history record.

## Export scopes and privacy

The host validates the requested scope and current revision. All exports are UTF-8
JSON with LF line endings and an explicit versioned format:

- **Current workspace:** the existing version-1 workspace export, including all
  applied plans, theme and setup state. It remains re-importable through the existing
  fully validated import flow.
- **Selected saved plans:** exactly the chosen IDs, with select-all and inverse
  selection controls. The export identifies its source revision and exclusions.
  This reporting format is not accepted by workspace import.
- **Complete recorded activity:** all available paginated activity records, including
  records older than the 100-event in-memory workspace window. It is a reporting
  format, not a restore document.
- **All complete recorded revisions:** complete preserved workspace states and their
  labels, with source revision and exclusions. The output is bounded at 32 MiB;
  exceeding the bound fails the whole export instead of silently truncating it.
  This archival reporting format is not accepted by workspace import.

The projection does not read credential vaults, personal wording payloads or source
file metadata, custom image bytes, external service enrollments, project paths or
build output. Plan names, notes and user-authored labels are ordinary user data and
are included where the chosen scope calls for them. The UI asks users to review
that text for sensitive material before exporting. No heuristic claims to detect or
remove secrets that a user manually typed into an ordinary plan field.

## Delivery status

This change implements workspace-scoped storage and consumers. Runtime, installer,
interruption, concurrency, accessibility, localization and visual acceptance have not
been run in this delivery mode. Source implementation is not evidence that those
checks passed. Cross-store history, encrypted credential recovery, advanced calendar
and regex history filtering, streaming exports above the stated bound, and destructive
history retention are not implemented by this workspace-scoped change.
