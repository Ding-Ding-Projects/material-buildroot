# ISO configuration and recovery

## Purpose and recommended default

Preview the current source requirements before approving fixed ISO requests. Apply reconciles Kconfig and reports whether every requested value remained effective. Recommended behavior is to build only after effective configuration is confirmed.

## Example and constraints

A valid flow is Check, approve, Configure, Build, Refresh, Inspect. A stale revision invalidates the preview. A successful apply response with `effective: false` is incomplete and does not enable Build. Configuration undo remains available in the editor.

## Cancellation and recovery

Cancel targets the recorded job identity and sequence. Refresh until the host reports a terminal state; a cancellation request alone does not prove the process stopped. Partial outputs remain possible and are not accepted as bootable media. Read the log, resolve the cause and explicitly start a new build. No automatic deletion or retry is performed. Switching workspaces discards the local planning view but does not cancel a running host job; use the existing Jobs view to recover it.
