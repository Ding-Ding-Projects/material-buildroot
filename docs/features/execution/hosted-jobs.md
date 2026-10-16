# Hosted Buildroot job controls

The execution workflow panel queues one published and admitted workflow after the user selects its explicit consent checkbox. Only public source and execution repositories with the standard `ubuntu-24.04` hosted runner are admitted. The workflow fixes the source commit, target, defconfig and parallelism; dispatch supplies only a fresh operation UUID.

The local journal is written before dispatch. An uncertain response remains `dispatch-unconfirmed` and must be observed or reconnected, never automatically dispatched again. Run discovery matches the operation UUID, exact repository, workflow path and workflow commit. Rerun attempts are rejected rather than silently adopted. Polling is user initiated, with a bounded five-page discovery request. Queued, pending, waiting, in-progress and completed states report the service observation. A cancellation request does not claim termination; the next observation must confirm the terminal conclusion.

Restart history stores metadata only. It stores no credential or authorization grant. Select the same destination and renew its current account grant, then choose Reconnect. Reconnection rechecks the persisted run binding. Changed identities, revoked grants and unreachable service responses remain explicit errors.

## Download and extraction

Only a successful bound run's unexpired `buildroot-output` artifact with an API-provided SHA-256 digest is eligible. Downloads use the trusted GitHub CLI actor, a native directory picker and a fresh output subdirectory, never a renderer-supplied path. Compressed downloads stream to an exclusive partial file and are bounded to 1,107,296,256 bytes and ten minutes. The trusted CLI actor verifies the expected size and SHA-256 before publishing the archive. Cancel active download aborts the owned transfer or extraction. Larger output is unsupported by this transport.

The archive digest and exact byte length must match before its ZIP inventory is read. Its `manifest.json` binds the operation UUID, workflow commit and source commit. Every regular file requires an exact length and SHA-256 manifest entry. Extraction rejects traversal, symbolic links, duplicate names, unsupported methods and ZIP64; it accepts at most 1,000 direct `images/<basename>` files totaling 1 GiB, plus a manifest bounded to 1 MiB. Existing files are not overwritten. Extracted files are never executed. The digest proves integrity against the service metadata, not publisher authenticity or safety of the resulting firmware.

The downloaded ZIP contains `manifest.json` and `images/<basename>` directly, never a nested archive. A fresh output folder starts with an `output-status.json` receipt marked `incomplete`; only complete digest, manifest and extraction success changes it to `verified`. Nonempty partial downloads and interrupted or rejected extractions remain in that folder for diagnosis. It is never returned as verified output. The original project and output trees remain untouched.

## Verification state

Implemented in source under the scoped release mode. No hosted run was dispatched, no external repository was created, and no tests, runtime inspection or screenshots were performed in this task. Actual dispatch, cancellation, restart recovery, download and extraction acceptance remain unverified.


