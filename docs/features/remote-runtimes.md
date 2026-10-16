# Remote Buildroot runtimes

The runtime workspace exposes target enrollment, source transfer, build dispatch, retained job observation, cancellation requests and checksum-verified output download. It implements the four target shapes approved in decision P41:

| Target kind | SSH host | Execution |
| --- | --- | --- |
| `linux-process` | Linux | Non-root Python supervisor and `make` |
| `linux-docker` | Linux | Non-root supervisor, digest-pinned Linux container and explicit non-root UID/GID |
| `windows-wsl` | Windows | Fixed `wsl.exe` command entering the selected distribution, then non-root Python and `make` |
| `windows-docker` | Windows | Host Python supervisor and digest-pinned Linux container with explicit non-root UID/GID |

## Enrollment and prerequisites

Choose and trust the SSH executable through the existing tool registry. Authentication uses the operating system SSH agent; passwords and private key contents are not accepted by this feature. Python 3 and the selected runtime must already be available on the target. No remote dependency installation, elevation, host restart or login-state changes are performed.

Use **Enroll target from JSON** to select a local enrollment document. Check the host public key independently before approving the native confirmation. The document contains only connection metadata and a public host key, never credentials:

```json
{
  "version": 1,
  "name": "Build server",
  "host": "builder.example.org",
  "port": 22,
  "username": "builder",
  "hostKey": "ssh-ed25519 REPLACE_WITH_VERIFIED_PUBLIC_KEY",
  "kind": "linux-process",
  "root": "/home/builder/material-buildroot",
  "distribution": null,
  "image": null,
  "uid": null,
  "gid": null
}
```

The example deliberately has no usable host key. Supply the actual independently verified public key. The root must already exist, be canonical, contain no symbolic-link components and be writable by the selected account. Linux and WSL roots use absolute Linux paths. Windows Docker roots use absolute Windows paths. Spaces, shell metacharacters, commas and relative components are rejected. Each target has a dedicated protected known-hosts file; strict host-key checking is mandatory. Key replacement requires a separately reviewed enrollment, never automatic acceptance.

For `windows-wsl`, set `distribution` to the exact WSL distribution name. For either Docker kind, set `image` to a local image reference pinned with `@sha256:...`, and set `uid` and `gid` to nonzero values. Containers require a Linux engine and an image containing Buildroot prerequisites. The application does not pull an image. The selected account needs Docker access and the configured UID/GID must be able to write the output bind mount. The container has no added capabilities and uses `no-new-privileges`; network access remains available for Buildroot downloads.

Enrollment probes root identity and protocol availability only. It does not claim the runtime or prerequisites passed a complete readiness check. Restart clears connection authority. **Reconnect and verify identity** checks the saved identity before further activity.

## Source transfer and jobs

Select a trusted ZIP containing the Buildroot tree at its root, including `Makefile`, `Config.in` and a reviewed `.config`. The compressed archive limit is 32 MiB, expanded content is bounded to 1 GiB and 100,000 entries. Duplicate paths, traversal, device names, hard-link/symlink representations and special files are rejected. A transfer creates an exclusive UUID directory and a receipt before extraction. Interrupted or rejected transfers remain in place for manual diagnosis; no existing directory is reused or erased.

The application hashes the archive and the remote supervisor independently verifies it. The supervisor records a complete regular-file source inventory digest. A build request binds the host identity, storage identity, transfer ID, source digest, target and parallelism. Supported targets are `all`, `sdk`, `legal-info` and `source`. Before execution the supervisor checks the inventory and copies the transferred source into a separate job directory. The reviewed `.config` seeds that job's new output directory. Docker mounts the copied source read-only and the output directory read-write.

Native confirmation explicitly grants execution of the transferred source. Trusted Buildroot source can execute build commands: the fixed transport is not a sandbox for untrusted Makefiles. The main process constructs all SSH commands and transfers the bundled supervisor over standard input. The renderer cannot supply shell fragments, executable paths, credentials, arbitrary remote paths or supervisor code.

The existing job manager records local dispatch state. A successful dispatch queue entry means the transport completed, **not** that the remote build succeeded. Remote observation is a separate explicit operation. Remote workers persist job records and heartbeat timestamps. Stale running records become `unknown`; interrupted dispatch is never replayed automatically. Local restart retains job identities but requires target reconnection. Remote host restart recovery is observation-only and does not restart a build.

Cancellation writes an exact job-owned request marker. The owning supervisor stops its live child process group, or verifies a Docker container's job label before stopping that exact container. A request acknowledgement is not proof of termination. Observe again for the terminal receipt. Local application shutdown cancels owned SSH transports without claiming that detached remote work stopped.

## Outputs and retention

Outputs become available only after the remote supervisor records build exit zero. The output list contains regular, non-linked files directly below that job's `output/images` directory with their lengths and SHA-256 digests. Individual downloads are limited to 32 MiB. Larger images stay on the target and remain an explicit delivery limitation.

A native directory picker grants local destination access. Each download creates a new exclusive directory and incomplete receipt. The remote file must still match the selected digest, then the local process independently verifies byte count and SHA-256 before recording `verified`. Downloads never execute or mount output. Partial output and receipts are retained; no automatic cleanup or overwrite occurs.

## Current limitations and verification

This is source implementation under the active rapid-delivery scope. No SSH enrollment, network execution, build, cancellation, restart, transfer, download, UI interaction, test or screenshot was run for this feature. End-to-end acceptance remains pending on all four target shapes. Source transfer and output download are bounded whole-file operations, not resumable chunk streams. Targets are selected from native enrollment documents rather than remote host discovery. Source editing and WSL project grants remain separate authorities. The remote dispatch queue records the existing job-manager contract, but does not participate in the local global build resource scheduler. CPU parallelism is bounded per remote job; aggregate remote host capacity is not yet enforced. Remote logs remain on the target and are not imported into local history.
