# Workspace history and scoped exports

The workspace backup controls in Settings record applied project plans, their notes,
the workspace theme, and setup progress. They do not snapshot source checkouts,
build output or protected credential stores. Native project catalogue/options history
and scheduled local-rule history have separate scoped consumers described below.

## Revisions and recovery

Each successful workspace mutation records complete before and after states beside
the application data file. An isolated bare Git repository stores immutable revision
files and append-only commits. It has no working tree in a user's project and the
application never adds a remote, pushes, synchronizes, rewrites or automatically
prunes its history. Git must be available to the host through its supported executable
search path. A missing executable or inaccessible history storage produces an explicit
warning while preserving the successful workspace save.

The revision list loads 25 records at a time and supports UTC date range, plain-text
and worker-isolated regular-expression filtering of loaded pages. Action filters are
derived from loaded records and show their counts. The anchored expression workbench
shares its pattern with the search field; a bounded worker prevents expression evaluation
from blocking the UI. Scope and match counts remain visible. The list supports comparison
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
- **Last 25 matching loaded revisions:** an explicit bounded revision-page export,
  including selected revision identities and complete states. Load older pages and
  export them explicitly to handle histories larger than the single-export bound.
  This does not claim to be an automatic streaming or unlimited download.

The projection does not read credential vaults, personal wording payloads or source
file metadata, custom image bytes, external service enrollments, project paths or
build output. Plan names, notes and user-authored labels are ordinary user data and
are included where the chosen scope calls for them. The UI asks users to review
that text for sensitive material before exporting. No heuristic claims to detect or
remove secrets that a user manually typed into an ordinary plan field.

## Native project records

The native catalogue records its before/after documents at adoption and restore.
Each project's options store records before/after runtime and external-tree choices.
Both use independent local bare Git histories and retain existing v1-to-v2 migration
behavior, stable IDs and current state. The backup panel selects catalogue history or
an existing project's options history, displays safe metadata, exports that metadata
without local paths and offers an explicit restore confirmation. Restore creates a new
native revision, never edits checkout contents, and grants no new picker capabilities.
Reopen affected projects through the normal picker after restoration; already-running
operations keep their existing authorized state. Project root/source/output and external
tree paths are retained only in local recovery records, not ordinary history exports.

## Scheduled preferences

Active local-rule snapshots are retained inside the existing SQLite document/history
transaction under reserved internal profile keys. The schema and existing history
receipts remain intact; no second schedule journal is introduced. External rules,
source enrollments and credentials are excluded. Existing receipts from before this
implementation may have no full snapshot and are reported as unavailable for recovery.
The schedule panel can load an active local snapshot into its editor, using the existing
local-rule merge behavior to preserve current external rules and their relative order.
Only an explicit Save schedule applies that restored draft as a new revision.

Discarded-draft history keeps its existing local-only store, bounds and restore path.
Both active history and discarded history offer export of exactly the last loaded page
(up to 25 active records or 20 discarded records),
including each available local snapshot and clear unavailable snapshots. These actions
are disabled while shared restrictions apply and recheck host authorization. Credentials,
external rule details, source enrollments and personal wording are never read or exported.

## Delivery status

The exact build entrypoint produced a desktop package from source checkpoint
`5f69b3158441a2056a872f3d213bc71cb0d5a7af`; subsequent expression-flag and page-bound
corrections require their own candidate build. Runtime, installer,
interruption, concurrency, accessibility, localization and visual acceptance have not
been run in this delivery mode. Source implementation is not evidence that those
checks passed. Encrypted credential recovery, advanced calendar presets, automatic streaming exports
above the stated bound, and destructive history retention are not implemented. Native
metadata exports deliberately omit paths and are reporting documents, not re-importable
restore files. The existing credential operation metadata remains the only permitted
credential-history representation; this change does not read credential contents.
