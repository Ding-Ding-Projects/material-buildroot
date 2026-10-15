# Durable settings broker admission

Status: implemented data-only core for `settings.setLanguage`, with focused behavioral evidence. This is not production IPC, filesystem capability admission, project creation, Buildroot execution, a GUI or complete feature delivery.

## Trusted host boundary

`src/main/broker.cjs` accepts serialized requests through the existing strict operation parser. The trusted host supplies caller context separately; request JSON cannot provide a principal. Unknown fields, malformed JSON and unsupported schema versions produce `INVALID_REQUEST`. Every operation and every settings/event read validates an opaque capability before effects or stored-result disclosure. Other parser-admitted actions return `NOT_IMPLEMENTED` after authorization and never enter storage mutation.

The host owns the database path, project namespace enrollment and capability registry. They must never come from an untrusted renderer dispatcher. The host grants principal/project/action/expiry-bound capabilities through `createCapabilityRegistry`; 32 random bytes become a 43-character opaque reference. At most 4,096 live grants exist, with a default five-minute lifetime and maximum one hour. Expiry uses a process-monotonic clock; revocation removes the grant. A new process has no prior grants. Regrant is an explicit trusted action, and reopening a store inside an existing process must not be confused with restarting its registry.

## Durable transaction and retry behavior

`src/main/storage/settings-store.cjs` uses built-in SQLite, verified locally on pinned Node.js 24.22.0 with create/insert/read operations. Parameterized statements operate on fixed tables/actions only; no SQL, shell command, filesystem path or dynamic action dispatcher is exposed through requests.

An initially absent principal/project settings row reads as bilingual with revision `0000000000000000000000000000000000000000`. An authorized change runs a single immediate transaction containing settings language/revision, operation digest/result and its sequenced event. The durable key is `(principal, namespace, operationId)`. Exact semantic retries return the accepted result without changing settings or inserting another event. Reusing that key with changed semantic content returns `OPERATION_CONFLICT`. Stale revision returns `STALE_REVISION` and preserves current data. Stale refusals are not accepted operations and may be retried after a fresh review.

The broker's version-1 semantic digest uses sorted-key canonical JSON excluding the ephemeral capability reference, while retaining action, arguments, project, expected revision, version and operation ID. This differs deliberately from the parser's full-envelope digest: a valid replacement grant after process restart can recover an accepted result, but authorization still precedes every disclosure. Failed transaction steps roll back settings, event and operation record together. Event reads are bounded to 1,000 records with `hasMore` and `nextSequence`; callers explicitly request the next page.

Internal core result codes are `OK`, `INVALID_REQUEST`, `NOT_AUTHORIZED`, `NOT_IMPLEMENTED`, `OPERATION_CONFLICT`, `STALE_REVISION` and `STORAGE_UNAVAILABLE`. Errors returned by the broker contain no submitted payload, capability value, database path, SQL text or SQLite exception. Direct trusted storage errors use only a generic storage message.

## Database ownership and interruption limits

The database must live in a trusted host-owned directory. Ancestors cannot be symlinks/junctions or resolve elsewhere. Database/ownership files must be regular, single-link files. A dedicated exclusive-create ownership marker prevents cooperative concurrent stores; SQLite also uses exclusive locking, zero busy wait, full synchronous durability and DELETE rollback journals. WAL is not enabled.

Before opening, pre-existing WAL, shared-memory and rollback-journal sidecars cause an explicit unavailable result. While open, the exact SQLite-owned retained rollback journal is tracked by file identity. Operations recheck database, marker, ancestor and sidecar identity; unexpected replacement fails closed. Existing files are admitted before any mutating SQLite open or persistent pragma. A bounded 100-byte header must match SQLite format, fixed application ID `0x4d425253`, supported version 1 and DELETE journal header mode. A read-only connection then requires the exact supported table/index SQL inventory, rejecting additional tables, views or triggers. Missing, foreign and empty pre-existing files are never initialized. Only a file exclusively created by this constructor is initialized. Reopen performs the same ownership/schema admission; unsupported older data requires a separate reviewed migration. Foreign WAL mode is rejected from header bytes without asking SQLite to change its journal mode. Closing deletes only the marker whose identity this store still owns; SQLite handles its own journal. No unrelated sidecar is deleted.

An abrupt process exit may leave the ownership marker or a journal. Automatic stale-lock reclamation and hot-journal recovery are intentionally unavailable in this slice. Preserve those files and require a separately reviewed trusted recovery workflow. The tests prove interrupted serialized input has no effect, graceful close/reopen retains accepted transactions, and simulated interrupted ownership/journal state is retained and rejected. They do not prove power-loss recovery. These checks are not protection against a hostile process with directory-write access or in-place database mutation; OS permissions and eventual native handle-relative capabilities remain separate admission work. Windows reparse checks are exercised through an actual directory junction, but exotic reparse providers and hostile filesystem races remain unverified.

## Focused evidence

Executed the focused broker and translation test files on the pinned executable:

```text
.cache/toolchains/node-24.22.0/active/node.exe --test tests/broker.test.cjs tests/broker-contract.test.cjs
20 tests, 20 pass, 0 fail, 0 skipped
```

Behavioral cases cover authorized mutation, revision/event persistence, stable key-order retry, changed-content conflict, wrong owner/action/project, expiry/revocation, cross-principal/project separation, reopen and explicit regrant, strict caller-claim rejection, unimplemented-action isolation, authorization-expiry-induced transaction rollback, concurrent open, unowned sidecars, linked parents, replaced ownership marker, generic diagnostics, bounded grants, interrupted input, retained interrupted file state, foreign database rejection and bounded event cursors. Rollback is exercised by revoking transaction authorization at the pre-commit check, after settings/event/idempotency writes but before commit. Persistent arbitrary triggers are rejected by production schema admission, including in the negative tests.

Production IPC authentication, principal derivation, permission UI, native filesystem grants, crash recovery, migration/backup policy, concurrent multi-process service operation and every remaining product action are unimplemented. No build, installer or runtime GUI acceptance is claimed.


## Internal and public typed seam

`src/shared/broker-core.ts` defines explicit internal result, event, store, authority and caller contracts. The broker factory exposes that typed core. `src/main/security/broker-contract.cjs` strictly translates validated internal success and every fixed failure code to `OperationReply`; unknown or extra fields yield a generic unavailable result. Stored event translation requires exact fields and yields `OperationEvent` with version 1 and succeeded state. Its timestamp is written inside the settings transaction and survives reopen/replay unchanged; observation time is never substituted. Invalid event records fail with generic contract diagnostics. No cast or broad unknown output weakens the public API.

Focused runtime verification after the admission repairs: 20 tests pass with zero failures or skips, including foreign version-1 and sidecar-free version-0 WAL fixtures with before/after exact bytes, header journal modes, schema-presence and sidecar comparisons. Genuine application identity plus an extra table or trigger is also rejected with byte/schema/file-inventory preservation. Existing empty files remain empty. Actual core success and its persisted event traverse the translator; all fixed failure codes and malformed translations have exact assertions.

Focused type verification on pinned Node.js 24.22.0:

```text
node node_modules/typescript/lib/tsc.js --ignoreConfig --noEmit --strict --allowJs --target ES2022 --module nodenext --moduleResolution nodenext --skipLibCheck tests/broker-contract-types.ts
exit 0
```

The type test checks the internal/public seam, factory return shape and rejected missing timestamps, unknown internal codes, public-as-internal replies and malformed caller context. Production preload wiring is still absent. Existing database admission authenticates format/schema ownership, not hostile-process integrity or row-content authenticity; the trusted-directory boundary remains essential.
