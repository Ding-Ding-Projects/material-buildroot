# Local assistant plans and reviewed actions

## Scope

The assistant workspace includes saved local inspection plans alongside the existing Ollama chat. It does not duplicate chat or automatically interpret model output. Users select registered host profiles: source/configuration summary, output inventory, and saved build status. Every profile is read-only. Generated shell commands, executable paths, environment variables, file arguments and arbitrary model action names are not accepted.

A plan contains at most 12 ordered actions. Up to 100 plans and 20 progress checkpoints per plan are retained. Actions require individual previews and explicit one-time consent. No blanket approval, persisted grant, model-selected destination or automatic queue execution exists. The host serializes execution to one active action. Prior steps must succeed or be explicitly acknowledged before the next step can be previewed.

## Review and execution

Open an adopted project, then Assistant. Add steps from the registered profile picker, save the plan and preview its next step. Preview captures bounded source/configuration hashes and the current host grant identity. It expires after two minutes and is consumed once. Run checks grants and fingerprints again before dispatch. Restored metadata cannot supply project access; the normal project picker must renew it.

Source summaries use the existing bounded content snapshotter without launching processes. Output inventory uses the existing project output service. Build status reads saved project job metadata. Only aggregate counts and hashes become receipts. The planner does not grant configuration trust, launch a build, execute a model command, install a runtime, or stop an unrelated process.

## Checkpoints and recovery

Progress checkpoints record step states, not rollback bytes or permission. Reopening the application turns any recorded running/cancelling phase into unknown. Nothing is replayed. Cancellation requests abort supported bounded reads and remain cancelling until the current consumer settles. An uninterruptible underlying inventory read may need to finish before cancellation settles. A lost journal write leaves storage unavailable and the persisted running phase available for next-start unknown-state recovery.

For failed, cancelled or unknown steps, inspect the project and use Open build recovery when relevant. Explicitly reset the inspection for a fresh preview or acknowledge and skip it. Neither choice claims success; neither executes an action. Build process reconciliation remains owned by the existing build queue recovery service. This planner does not restore process ownership or persist process IDs.

## Privacy and storage

The host-owned journal contains UUIDs, timestamps, fixed profile identifiers, states, attempt counts, source/configuration hashes and aggregate counts only. It accepts no free-form titles, prompts, chat content, environment values, credentials, imported personal wording or file paths. Local Ollama history is never read or transmitted by this service. No model call or export route is introduced. Journal access rejects symbolic links, hard-linked files, oversized content, malformed schemas and concurrent revisions. Writes use an exclusive lock and a flushed temporary file before rename. An unresolved lock or invalid journal is reported unavailable, never silently reset or deleted.

## Delivery limits

This is a bounded inspection consumer, not arbitrary autonomous coding or a launcher for third-party harnesses. Additional mutation profiles, executable registration, model-to-plan generation, process snapshot/rollback and model-generated action ingestion are not implemented. No action automatically grants authority to another service.

Implementation is provided for source integration. Tests, static analysis, runtime execution, cancellation-phase verification, visual acceptance and accessibility inspection were intentionally deferred for the selected delivery mode. No runtime acceptance is claimed.
