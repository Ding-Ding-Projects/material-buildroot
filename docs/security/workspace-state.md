# Persistent workspace state

The host workspace service persists project planning metadata, appearance, onboarding completion, snapshots and recent activity. It does not execute builds, interpret project notes as commands, accept filesystem paths from the renderer, store credentials or prove WSL/Docker availability. Runtime and Windows installer acceptance remain separate work.

`createWorkspaceService({filePath})` receives an absolute storage filename selected by the trusted main process under application user data. Never forward a renderer-supplied filename. `get()` returns `{ok:true,state}`. `mutate(request)` returns the same shape after persistence. `exportDocument()` additionally returns `document`, a JSON string suitable for a host-mediated save dialog. Errors expose only a bounded code, never filesystem details.

Every mutation requires an integer `expectedRevision` matching the current durable revision. The initial revision is zero. The exact allowed action shapes are:

| Action | Additional fields |
| --- | --- |
| `plan.create` | `plan: {name,runtime,target,status,notes}` |
| `plan.update` | `id`, `changes` containing a nonempty subset of the five editable plan fields |
| `plan.delete` | `id` |
| `preferences.update` | `preferences: {theme}` |
| `onboarding.complete` | none |
| `onboarding.update` | `onboarding: {step,runtime,name,dismissed,planId?}` |
| `snapshot.create` | `name` |
| `snapshot.restore` | `id` |
| `document.import` | `document`, a serialized export document |

The host generates UUIDs and timestamps. Runtime is `wsl` or `docker`; target is `image`, `sdk` or `toolchain`; status is `draft` or `ready-for-review`. Theme is `system`, `light` or `dark`, defaulting to `system`. Plans are limited to 100, names to 80 characters, notes to 4,000 characters, snapshots to 20 and the workspace activity view to the latest 100 successful mutations. Serialized data is limited to 1 MiB. Schema version 1 is exact: unknown fields, inherited object schemas, accessors, prototype keys, duplicate serialized keys, excessive nesting, unsupported versions and invalid enum values are rejected. No coercion occurs.

The versioned JSON format is appropriate for these small bounded metadata transactions. It uses Node built-ins and remains independently testable without loading the existing experimental SQLite settings broker. Each mutation acquires an exclusive host-side lock, rereads and validates disk state, checks the expected revision, validates the complete resulting document, writes a unique mode-0600 temporary file, flushes it and atomically renames it over the prior document. A successful reply follows replacement. Temporary files and the owned lock are removed on ordinary failures. This guarantees complete-file replacement, not a cross-file transaction or a universal power-loss durability guarantee. The application should keep its normal single-instance lifecycle.

An interrupted process may leave a `.lock` file. The service reports `STORAGE_BUSY` and does not automatically remove that lock or infer ownership from elapsed time. Recovery requires the trusted host to establish that the owning process has ended before removing only its workspace lock. No automatic overwrite/reset is performed.

Corrupt, oversized, foreign-format and unsupported-version files remain untouched. Symbolic-link storage files are rejected. Reads report `STORAGE_UNAVAILABLE`; subsequent mutations also fail closed. The parent directory is host-owned application storage, not an attacker-selected project directory. Directory substitution by another process with access to that trusted parent is outside this service's authority boundary.

Snapshots contain planning payloads only. Restore copies a snapshot payload into the current workspace and records a new revision and activity entry; it never rewinds the revision or history. Imports replace plans, appearance and onboarding at the expected revision, while preserving host history and snapshots. Exports contain only the versioned planning payload, with no activity, snapshots, storage paths, capability handles or credentials. They are not Buildroot source/configuration backups and do not establish runtime execution authority.

Focused Node tests cover restart persistence, concurrent-instance stale revisions, busy locks, failed replacement, corrupt/foreign preservation, symbolic links, unsafe requests, bounded fields/counts, snapshots and validated import/export. These checks run on the development host; they do not establish Windows filesystem behavior, Electron sender authorization or native dialog integration. Main-process IPC must independently authorize its trusted renderer and reject navigation or untrusted frames before invoking this service.

## Native file capabilities

`createFileGrants({now})` is a host-only registry. A native picker callback may call `grant({path,kind,access,owner})` after the user selects a canonical existing file or directory. Never expose `grant` or a raw path field through renderer IPC. Its result is an opaque UUID scoped to that owner, valid for five minutes and lost on application restart. Grants are limited to 1,024. `resolve({id,owner,relative?,write?})` returns a host-only canonical path, kind and access after verifying owner, lifetime, access and all original ancestor identities. `revoke({id,owner})` and `clear()` invalidate grants.

Resolution rejects traversal, absolute relative paths, alternate separators, Windows stream/reserved/ambiguous names, symbolic links, noncanonical aliases and multiply linked files. It rechecks ancestor device/inode/creation identity and canonical real paths, detecting replaced parents and junction-style redirection that changes the canonical path. Read access requires an existing target. Write access may address a new final file only under an existing checked parent. Actual filesystem operations must resolve immediately before use, retain the host-only path and apply operation-specific safeguards. This synchronous path resolution does not itself provide an atomic open descriptor or eliminate hostile filesystem replacement between checking and use. Windows reparse behavior and native picker integration require separate Windows verification.

## OS protected secrets

`createVault({safeStorage,directory})` wraps the trusted Electron `safeStorage` implementation. `availability()` reports explicit unavailability; encryption is never replaced by plaintext. Linux requires an identifiable secure backend, and `basic_text` or `unknown` backends are rejected. The trusted host calls `write(owner,secret)` and receives only `vault:<UUID>`; `read(reference,owner)` and `remove(reference,owner)` require the same owner. Do not expose secret reads or unrestricted secret writes through renderer IPC. Existing secret-consuming services receive an owner-bound host adapter.

Each stored file contains only OS-encrypted bytes, with its owner and schema inside the protected envelope. Writes create exclusive mode-0600 files and flush them before returning a reference. References cannot supply paths; record sizes, secret sizes and owner identifiers are bounded. Symbolic links and multiply linked records fail closed. The directory must be canonical host-owned storage. The fixture tests use authenticated encryption to check the wrapper and persistence boundaries; they do not prove a live operating-system credential backend or native Electron behavior.

## Retained activity journal

The last 100 activity entries in workspace state are a bounded presentation view. All new activity is retained in the adjacent host-owned `.activity` directory, one version-validated record per revision, without automatic pruning. `activityPage({beforeRevision?,limit?})` returns `{ok:true,events,nextBeforeRevision}` in descending revision order; limits range from 1 to 100 and the default is 50. Pagination reads only bounded record payloads and retains at most one page of directory candidates in memory.

A mutation flushes its next-revision journal record before replacing workspace state. The workspace revision is the commit boundary. A failed or interrupted state replacement may leave a next-revision record; pagination excludes records beyond the committed revision, and a subsequent successful attempt replaces only that uncommitted revision. Already committed records are checked against the bounded state view and never replaced with conflicting content. Existing bounded activity is backfilled when encountered, but records discarded by older versions cannot be reconstructed. The journal and state are application-owned data; this is not an adversarial tamper-proof audit log.

## Resumable onboarding

Workspace `onboarding` contains `{step:0|1|2,runtime:"wsl"|"docker",name:string,dismissed:boolean,planId?:UUID}`. Its default is `{step:0,runtime:"wsl",name:"",dismissed:false}`. Names are bounded to 80 characters, including an allowed empty initial draft. `onboarding.update` replaces this exact progress object at the expected revision. Dismissal and the existing `onboardingCompleted` flag are independent; dismissal does not mark onboarding complete, and completion preserves the saved progress. Snapshots and exports include progress.

An exact legacy version-one workspace, snapshot payload or export without the new progress field receives the default additively in memory. Existing plans, revisions, completion, preferences, snapshots and history are retained. Reading does not rewrite the workspace file; the next successful mutation persists the additive shape. Unknown fields and malformed progress are rejected with the original file preserved. This compatibility path cannot reconstruct progress that older versions never stored.
