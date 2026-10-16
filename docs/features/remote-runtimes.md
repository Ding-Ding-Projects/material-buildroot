# Remote Buildroot runtimes

[香港粵語](remote-runtimes.zh-HK.md)

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

Select the current authorized project in the workspace and use **Transfer current project**. The host revalidates the existing project authority, acquires the existing source/output mutation leases, captures the existing source/configuration intent, and writes a new exclusive source archive. The archive includes the real source tree, omits `.git` history, and uses the current output directory's `.config` in place of any source-root configuration. The intent is captured again before accepting the archive. Neither renderer paths nor a fixture archive substitute for project authority.

Currently this source route supports locally accessible regular-file projects with no external trees. WSL-owned Linux storage, external-tree projects, symlinks and special-file source shapes explicitly return unsupported rather than silently losing content. Existing build-intent limits still apply, including 512 MiB total source capture. These source-shape limitations are separate from the four remote execution target shapes.

Source archive transport and individual output transport have the existing ceiling of 1,107,296,256 bytes. Transport uses fixed 1 MiB chunks with exact offsets, bounded response sizes and whole-stream SHA-256 verification. The archive writer and downloader never allocate the entire archive or image in memory. Remote extraction permits at most 100,000 entries and the same expanded-byte ceiling. Duplicate paths, traversal, device names, links and special files are rejected. Each upload creates an exclusive UUID directory and incomplete receipt before its first chunk. Explicit retry creates a new destination and recomputes the source binding; automatic resume is not implemented. Interrupted local archives, remote streams and local downloads remain retained.

The application hashes the archive and the remote supervisor independently verifies it. The supervisor records a complete regular-file source inventory digest. A build request binds the host identity, storage identity, transfer ID, source digest, target and parallelism. Supported targets are `all`, `sdk`, `legal-info` and `source`. Before execution the supervisor checks the inventory and copies the transferred source into a separate job directory. The reviewed `.config` seeds that job's new output directory. Docker mounts the copied source read-only and the output directory read-write.

Native confirmation explicitly grants execution of the transferred source. Trusted Buildroot source can execute build commands: the fixed transport is not a sandbox for untrusted Makefiles. The main process constructs all SSH commands and transfers the bundled supervisor over standard input. The renderer cannot supply shell fragments, executable paths, credentials, arbitrary remote paths or supervisor code.

The existing job manager records local dispatch state. A successful dispatch queue entry means the transport completed, **not** that the remote build succeeded. Remote observation is a separate explicit operation. Remote workers persist job records and heartbeat timestamps. Stale running records become `unknown`; interrupted dispatch is never replayed automatically. Local restart retains job identities but requires target reconnection. Remote host restart recovery is observation-only and does not restart a build.

Cancellation writes an exact job-owned request marker. The owning supervisor stops its live child process group, or verifies a Docker container's job label before stopping that exact container. A request acknowledgement is not proof of termination. Observe again for the terminal receipt. Local application shutdown cancels owned SSH transports without claiming that detached remote work stopped.

## Outputs and retention

Outputs become available only after the remote supervisor records build exit zero. The output list contains regular, non-linked files directly below that job's `output/images` directory with their lengths and SHA-256 digests. Individual downloads are bounded to 1,107,296,256 bytes. A selected file is hashed remotely once, then every chunk must match its exact file identity, size and offset. The local SHA-256 is accumulated as chunks are written, and the incomplete receipt becomes verified only after the complete length and digest match. Larger images stay on the target.

A native directory picker grants local destination access. Each download creates a new exclusive directory and incomplete receipt. The remote file must still match the selected digest, then the local process independently verifies byte count and SHA-256 before recording `verified`. Downloads never execute or mount output. Partial output and receipts are retained; no automatic cleanup or overwrite occurs.

## Current limitations and verification

This is source implementation under the active rapid-delivery scope. No SSH enrollment, network execution, build, cancellation, restart, transfer, download, UI interaction, test or screenshot was run for this feature. End-to-end acceptance remains pending on all four target shapes. Source transfer and output download use bounded chunk streams without automatic resume. Targets are selected from native enrollment documents rather than remote host discovery. Remote source transfer uses existing project identity, source/configuration intent and source mutation leases. WSL-owned source storage and external-tree transfer remain unsupported. The remote dispatch queue uses the existing job manager and the same global resource scheduler through an explicit external-reservation API. Every remote build reserves its selected CPU slots, 4 GiB memory and 16 GiB storage. Resource observations come from the identity-bound remote supervisor. CPU and memory aggregate by pinned host identity; storage aggregates by that host and enrolled root identity. Container commands additionally set the CPU and memory limits. Process memory/storage reservations are admission accounting, not operating-system quotas.

Uncertain remote jobs keep their reservations after disconnect and restart. Restored reservations consume the same budgets before local requests are accepted and do not silently renew source access. Only an identity/source-bound terminal receipt releases a reservation. Cancellation acknowledgement, dispatch transport success and elapsed time cannot release it. Remote jobs are not automatically replayed. Budget edits use the existing shared budget store and revision. An unknown outcome may require operator recovery; absence of a remote receipt does not prove a detached process stopped.

**Read next log page** retrieves at most 64 KiB from the exact retained job, checking file identity and monotonically advancing byte offsets. At most 1 MiB is exposed per job session. Control characters are stripped. Build logs are untrusted source output and may contain sensitive source-generated text; they remain literal in the interface and are not exported or sent to telemetry. Remote full logs remain on the target. Runtime, cancellation, persistent reservation recovery, all four execution targets and streamed download acceptance are unverified.

