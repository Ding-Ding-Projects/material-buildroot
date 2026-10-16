# Concurrent project build queues

[香港粵語](build-queues.zh-HK.md)

The build workspace provides host-authorized project queues and a read-only job terminal. Inspect queue status to view global CPU, RAM, storage and concurrency reservations, then edit and save the global admission budgets. Budgets persist in local profile storage. They constrain admission, not operating-system execution, and reducing them does not terminate active jobs. New work waits until existing reservations fit the new budget.

Each project retains FIFO order. Canonical source, output and external-tree paths share mutation leases, so overlapping projects cannot concurrently write the same output tree. Independent projects may run concurrently when global budgets and fresh runtime resource observations admit them. Source or configuration changes block the original intent rather than silently changing a queued request.

Refresh the project queue, open a job terminal, and read subsequent pages to inspect that job's recorded output. The host validates project identity and job ownership on each scoped operation. The terminal accepts no arbitrary commands. It displays a bounded 500-record window and reads 50 records per request. Changing project clears its displayed terminal.

Cancel this job uses its current sequence and ownership. A stale sequence requires refresh. Active reservations remain until the existing runtime cancellation and cleanup path settles. Unverified cleanup remains quarantined and requires explicit host reconciliation. No unrelated runtime is force-stopped.

Malformed saved budgets fail closed. Invalid updates leave existing budgets unchanged. Runtime resource discovery failure continues to block admission.

## Verification status

Implementation was prepared under a build-only delivery mode. Tests, static analysis, runtime interaction and screenshots were intentionally not performed. Build output, when available, is compilation/package evidence only; concurrent execution, cancellation and UI behavior remain unverified.
