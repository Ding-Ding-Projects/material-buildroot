# Local assistant plans and reviewed actions

## Scope

The Assistant workspace includes saved local plans alongside existing Ollama chat. It does not duplicate chat or send conversation history to the planner. Users select registered host profiles: source/configuration summary, output inventory, saved build status and applying a catalogued Buildroot defconfig. Configuration application mutates project configuration through the existing trusted configuration service. A fifth fixed profile submits reviewed Buildroot targets through the existing owned queue, as detailed below.

A plan contains at most 12 ordered actions. Up to 100 plans and 20 progress checkpoints per plan are retained. Every action requires an individual preview and explicit one-time consent. No blanket approval, persisted grant, model-selected destination or automatic queue execution exists. One action executes at a time. Prior steps must succeed or be explicitly acknowledged before the next can be previewed.

## Structured proposals

A local JSON proposal accepts exactly `version` and `steps`. Version is `1`. Inspection steps are the strings `source-summary`, `output-inventory` and `build-status`. Configuration steps use this exact shape:

```json
{"profile":"apply-defconfig","selection":{"id":"catalogue-entry-sha256","revision":"catalogue-revision-sha256"}}
```

The actual values must be 64-character lowercase hexadecimal hashes from the current host catalog. The interface loads that catalog and offers a picker, so users do not need to guess them. A full inspection proposal is:

```json
{"version":1,"steps":["source-summary","output-inventory","build-status"]}
```

Model output is untrusted data. Documents are bounded to 16 KiB and parsed through the existing duplicate-key/depth/complexity checks, then exact keys and profile values are validated. Commands, executable paths, environment variables, free-form arguments and unknown profiles are rejected. Import saves pending steps only and executes nothing. It neither retains the original proposal nor reads model history. No model call is introduced.

## Review and execution

Open an adopted project, then Assistant. Add steps, save the plan and preview the next step. Configuration steps require loading the actual defconfig catalog after normal project access, runtime selection and configuration trust. The planner never grants trust itself.

Preview shows the exact selected defconfig name, origin and digest when applicable, plus source and configuration fingerprints. It captures the current host grant binding, expires after two minutes and is consumed once. Run checks the selected catalog entry, existing trust, grants and fingerprints again. Restored metadata cannot supply project access; the normal project picker must renew it.

Source summaries use the existing bounded content snapshotter without launching processes. Output inventory uses the existing project output service. Build status reads saved project job metadata. Applying a defconfig calls the existing revision-bound configuration transaction, including its native configuration execution and rollback behavior. It does not execute arbitrary generated commands or submit a build. Only aggregate counts and hashes become durable receipts. Mutation receipts bind the resulting configuration revision; inspection receipts require the configuration to remain unchanged.

## Checkpoints, cancellation and recovery

Progress checkpoints record step states, not rollback bytes or permission, and remain visible with the plan. Reopening the application turns a recorded running/cancelling phase into unknown. Nothing is replayed. Cancellation aborts supported bounded reads and remains cancelling until the consumer settles. Existing inventory/configuration consumers may need to finish before cancellation settles. A mutation interrupted or failing after dispatch stays unknown even if the lower-level service attempted rollback. It never becomes a success or a claim that cancellation prevented all effects.

For failed, cancelled or unknown steps, inspect the actual configuration and use Open build recovery when relevant. Explicitly reset the step for fresh review or acknowledge and skip it. Neither choice claims success or executes anything. If configuration changed, reload the catalog and create a new plan with its current revision. Existing configuration history/undo remains available in Configuration, subject to its own current-revision and history checks. The planner does not invent durable rollback when that history is unavailable after restart.

Build process reconciliation remains owned by the existing build queue recovery service. This planner does not restore process ownership or persist process IDs. A lost journal write leaves storage unavailable and the last persisted running phase available for next-start unknown-state recovery.

## Privacy and storage

The host-owned journal contains UUIDs, timestamps, fixed profiles, catalog hashes, states, attempt counts, source/configuration hashes and aggregate counts only. It accepts no free-form titles, prompts, chat content, environment values, credentials, imported personal wording or file paths. No export route is introduced. Journal access rejects symbolic links, hard-linked files, oversized content, malformed schemas and concurrent revisions. Writes use an exclusive lock and a flushed temporary file before rename. An unresolved lock or invalid journal is reported unavailable, never silently reset or deleted.

## Delivery limits

Additional mutation profiles, arbitrary executable registration, autonomous model generation and external harness launch/rollback are not implemented. The UI makes unsupported external harness execution explicit. Existing typed Buildroot configuration execution and the reviewed owned build queue are its executable consumers. Build submission is also available through the fixed reviewed profile below, sharing the existing host submission helper.

Source integration is provided. Tests, static analysis, runtime execution, failure/cancellation phases, visual acceptance and accessibility inspection were intentionally deferred for the selected delivery mode. No runtime acceptance is claimed.

## Reviewed Buildroot harness profile

`build-submit` is the supported application-owned harness route. Its exact proposal shape is:

```json
{"version":1,"steps":[{"profile":"build-submit","selection":{"target":"all","jobs":1}}]}
```

Only `all`, `sdk`, `legal-info` and `source` are accepted. Parallelism is an integer from 1 to 32. The UI supplies fixed target and parallelism pickers and defaults to one worker. No shell command, executable path, destructive target, package-defined target or runtime override is accepted. The runtime comes from the currently adopted project, and its identity is part of the reviewed binding. The preview discloses the selected target, runtime kind, parallelism, source/configuration fingerprints and execution consequences. Existing scheduler budgets remain authoritative.

The normal build workflow and assistant share one host submission helper. It preserves project access, external-tree admission, target checks, runtime validation, resource reservation, bounded content capture and the existing durable scheduler. Assistant submission additionally requires the fresh captured intent to match its reviewed source/configuration identity and checks cancellation before enqueueing. The queued adapter rechecks its own grants, source intent and execution ownership before running. The assistant never grants permission to execute an unrelated process.

Before dispatch, the plan journal records a fresh operation identity. The queue uses that identity as its existing idempotency key. Plan reads join only a job with that exact operation identity, workspace and owner. A recorded submission is not success: the plan remains submitted until the owned job reaches a recorded terminal state. A missing or interrupted job is unknown and directs the user to the existing build recovery surface. Reset/retry is blocked while that job is active, interrupted or already succeeded. Failed/cancelled work may be explicitly reset for a new preview; this does not immediately resubmit it.

Cancellation resolves the currently owned job and uses its current sequence with the existing project cancellation action. Requests remain pending until the queue settles. Recovery uses the existing build queue, process ownership receipts and reconciliation controls; no second process journal, PID adoption or silent retry is introduced. Cancellation during the narrow dispatch interval also requests cancellation of the newly recorded owned job. Output rollback for an interrupted build is not promised: inspect recorded outcomes and reconcile ownership before a new action.

All build execution, model calls, cancellation-phase verification and runtime acceptance remain deferred. Arbitrary third-party executable registration and rollback remain unsupported. Literal authored panel copy now uses the shared localized-copy pipeline; job identifiers, states, hashes, timestamps, catalog names, proposal JSON and other factual records remain literal.

