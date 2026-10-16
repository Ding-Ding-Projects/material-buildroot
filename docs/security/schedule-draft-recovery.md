# Local scheduled-preference draft recovery

[香港粵語](schedule-draft-recovery.zh-HK.md)

The host provides a separate append-only history for validated local schedule drafts. Recording a draft does not save it as the active schedule, evaluate it, contact a provider or apply its values. The editor integration remains a separate acceptance surface.

## Host actions

The typed schedule bridge admits exactly these additional envelopes:

```ts
{ action: 'draft.discard', document: ScheduleDocument }
{ action: 'draft.list', after: number, limit: number }
{ action: 'draft.read', sequence: number }
```

Discard returns a host-generated sequence and timestamp. List returns only those receipts, a continuation sequence and `hasMore`. Read returns one validated document with its original revision, or `null`. Restoration supplies editor data only. Applying it still requires the ordinary explicit revision-checked save against the current stored schedule.

All actions require the owned top-level frame and a live shared-mode result that is available and inactive. Missing, active, unknown or throwing status blocks access. Authority is checked again before commit and before outgoing replies. Renderer requests cannot supply an authorizer, storage directory or credential reference.

## Storage and limits

Drafts use a separate profile-scoped directory, SQLite application identity and exact schema. Saved-document revision receipts remain unchanged. Storage opens lazily, so invalid draft storage does not prevent active schedules from starting or being read.

Only complete valid documents containing local-source rules are admitted. Enrollment data, credentials, unknown fields and external rules are rejected. The editor explicitly projects local data when preserving edits from a mixed document, then combines it with current external records during later explicit restoration. Its independent source review and browser recovery cases passed; native packaged acceptance remains pending.

Limits are 64 records, 262,144 original document bytes, 16,777,216 aggregate document bytes, 20 receipts per page and a 64 MiB physical database bound. There is no eviction or deletion action. Full storage returns an explicit capacity error and preserves existing records. Since 64 times the maximum document size equals the aggregate limit, a valid append cannot exceed the aggregate bound while a record slot remains. No separate reachable aggregate-refusal branch is claimed.

The adapter retains existing path-identity, schema, journal-identity, transaction-marker, rollback and foreign-evidence checks. Corrupt or foreign storage is preserved and reported unavailable. Native ACL privacy and hostile journal replacement remain separate host-evidence gaps.

## Verification

The first focused native Node run passed ten new storage/service/IPC cases with no skips. A later actual child-process interruption case passed: the writer terminated after insertion and spilled database pages, reopening rolled back its uncommitted draft, preserved the original record and recovered sequence allocation.

The existing active schedule store/service/IPC regression then discovered 23 cases: 19 passed, zero failed and four explicitly skipped. Those four involve replacing an active journal, which native file sharing prevents on this host. A separate native sharing-denial/rollback case ran and passed. Skipped foreign-evidence retention paths are not relabelled verified.

These checks establish bounded host behavior on the current machine. They do not establish packaged renderer interaction, all-language accessibility, installed-profile protection, fresh-host installation or the full product roadmap. See the [native continuation evidence](../evidence/native-windows-20261016/README.md).
