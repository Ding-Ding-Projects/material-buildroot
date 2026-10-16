# WSL setup and Linux storage

The Projects & runtime workspace includes a dedicated WSL panel. Discovery enumerates registered distributions and their WSL version without launching them. Inspection deliberately starts the selected WSL 2 distribution and checks that its default user is non-root, that its home is an ordinary `/home/<user>` directory, and that common Buildroot host commands exist.

## Setup actions

- Select an existing WSL 2 distribution and inspect readiness. WSL 1 entries cannot be selected for setup.
- Install missing prerequisites on Debian or Ubuntu after a native confirmation. This runs a fixed package-manager command as root; Buildroot itself always uses the non-root default account. Network access is required for packages. This is a host-tool presence check, not proof of compatibility with every Buildroot revision.
- Get dedicated Ubuntu downloads the official Ubuntu 24.04.3 WSL image from `releases.ubuntu.com` and verifies the pinned SHA-256 before import. Downloads are bounded to 2 GiB and 30 minutes, use HTTPS without redirects, and preserve incomplete files. Existing matching cache files are rehashed before reuse.
- Import a trusted `.tar` or `.wsl` Linux root filesystem through the native picker. Each import gets a unique dedicated distribution name and storage directory. Existing registrations are never replaced. A managed record is saved before import starts and retained if import or account configuration does not finish.
- A new managed distribution initializes a `materialbuilder` non-root account and asks WSL to make it the default. Older WSL versions without default-user management remain explicitly incomplete. The imported archive must provide Debian/Ubuntu-compatible user-management utilities; unsupported archives remain preserved for manual recovery.
- Prepare `source`, `output` and `downloads` directories inside the non-root user's Linux home. Existing content is preserved; symbolic-link substitutions are rejected.
- Browse the verified Linux storage through the native file browser. The path is constructed from the selected registered distribution and verified Linux storage, never a renderer-provided UNC path.
- Export the selected distribution to an exclusively created folder inside a native-picked destination. The native confirmation explains that backups can contain secrets and that running workloads can make a backup inconsistent. Partial exports are retained and labelled incomplete. Export does not stop, unregister, overwrite or delete a distribution.

## Prerequisites and recovery

WSL 2 requires supported Windows, hardware virtualization and the Windows WSL/Virtual Machine Platform features. The panel explains these prerequisites, but does not enable operating-system features or restart the host. Any required restart is performed manually by the user. Cancellation and unavailable WSL never count as readiness.

Setup never changes an existing distribution's default user or registration. A managed import interrupted during account initialization can be inspected again; manual repair must preserve its existing filesystem and managed record. No automatic rollback deletes data. The managed record is local to the application profile and is not included in telemetry or exported reports.

## Current limits and verification

The Linux project workflow prepares folders, optionally clones the official Buildroot source into an empty source folder, then opens native source/output pickers confined to that distribution's Linux workspace. A separate native confirmation admits the selected source for code execution. The resulting project enters the existing build queue, resource reservation, ownership, cancellation and recovery workflow, with that same distribution selected.

A main-process-only receipt binds the distribution, boot, machine identity, non-root uid and Linux root/source/output device and inode identities. It rejects symlink paths, cross-device roots, non-Linux filesystems and overlapping source/output. The actual build process repeats this identity check before accepting its ownership handshake. Runtime probes and subsequent project consumers revalidate the receipt. Only typed storage metadata is persisted; restarting or replacing the distribution requires selecting the folders and granting access again. Generic native UNC/network grants remain rejected. Selected paths currently require simple ASCII path components without spaces.

The dedicated [source lifecycle](source-lifecycle.md) consumer now authors receipt-bound WSL upgrade and rollback operations; these do not receive a generic host grant, and runtime acceptance remains unverified. External-tree activation for WSL remains unsupported rather than widening the admitted Linux root. Existing configuration/build consumers can use the admitted source/output pair, but their end-to-end behavior remains unverified in this delivery mode.

Official references: [Microsoft WSL commands](https://learn.microsoft.com/en-us/windows/wsl/basic-commands), [Ubuntu image checksums](https://releases.ubuntu.com/24.04.3/SHA256SUMS), and [Buildroot source](https://gitlab.com/buildroot.org/buildroot).

No WSL discovery, import, package installation, distribution launch, build execution, backup, restoration or interactive UI acceptance was performed for this increment. Production packaging only is permitted in the current delivery mode. Account creation, permissions, cancellation, restart requirements, all language/theme/scale layouts and backup consistency remain runtime acceptance work. PH05-T02 must remain unchecked until runtime acceptance is complete.

