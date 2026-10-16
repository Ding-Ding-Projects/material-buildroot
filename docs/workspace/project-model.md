# Versioned project model

Implementation scope: PH02-T01. Source changes are authored; tests, independent
review, installed migration, cross-surface isolation and runtime acceptance are
not performed in this delivery mode. The roadmap acceptance item remains open.

## Identity and records

The installed application identity stays `com.dingdingprojects.materialbuildroot`,
the package name stays `material-buildroot`, and the Squirrel package identity
stays `MaterialBuildroot`. Display labels must not become storage identities.
This change does not rename installed directories or move user data.

`src/shared/project-model.ts` describes the persisted project catalogue and
per-project options. A project retains its UUID, display name, root, source and
output directories. Existing root/source/output identity matching continues to
reuse the same UUID. Metadata does not grant filesystem access: reopening a
saved project still requires fresh host-authorized directory grants.

The catalogue and options documents now use version 2, with explicit storage
ownership `{ applicationId: "com.dingdingprojects.materialbuildroot", surface:
"desktop" }`. Options remain separate files keyed by the saved project UUID.
Each store preserves its existing revision and transaction boundaries.

## Migration and preservation

Both stores accept the exact known version 1 shape and migrate it in memory to
version 2 before returning data. Project UUIDs, revisions, paths, runtime choice,
external-tree names and array order are preserved. Reading a store never rewrites
it. A successful catalogue addition or options save writes the version 2 envelope
through the existing exclusive lock, temporary file, flush and rename path.
Re-adopting an already known project does not trigger an unnecessary rewrite.

Unknown versions, unknown keys, malformed content, duplicate keys and mismatched
surface/application identities fail closed. Existing invalid or newer-version
files are not reset, truncated or replaced with empty defaults. Existing revision
conflicts and storage-busy responses remain distinct. A current-format document
can carry only the desktop identity; browser-owned documents cannot be substituted
for it. Validation and filesystem protections remain enforced by the stores, not
by the TypeScript declarations alone.

The migration is forward-only. An older build that only understands version 1
cannot be assumed to read a version 2 document. Keep an owner-managed backup
before a downgrade; no automatic backward conversion is claimed.

## Ordered external trees

Options store an array of at most 32 `{ path, name }` entries. Position is
significant and is preserved across load/save and known-version migration.
Names use the existing Buildroot identifier rules, and duplicate names and paths
are rejected. The store does not sort or deduplicate by silently dropping entries.
Runtime choices retain either a named WSL distribution or a digest-pinned Docker
image with non-root UID/GID. Re-authorizing external trees is a separate host
operation; loading their metadata never authorizes access.

## Surface isolation

Desktop project metadata stays below the existing host-owned operations storage
root. The public documentation visitor workspace uses its browser origin and its
own local-storage format. Companion browser preferences and transient pairing
state remain browser-owned; their transport does not make them desktop project
files. Version 2 desktop identity validation adds a persisted boundary without
moving or adopting any browser storage. Actual cross-origin, installed-profile
and restart isolation still require runtime acceptance.

## Remaining verification

Deferred proof includes version 1 migration with unchanged IDs and tree order,
version 2 reopen after save, unknown-version preservation, invalid identity
rejection, lock/revision conflicts, failed-write preservation, installed identity
through upgrade and display rename, and independent desktop/documentation/
companion storage across reload and restart. No build or source inspection alone
is evidence that these runtime cases passed.
