# WSL setup and Linux storage

The Projects & runtime workspace includes a dedicated WSL panel. Discovery enumerates registered distributions and their WSL version without launching them. Inspection deliberately starts the selected WSL 2 distribution and checks that its default user is non-root, that its home is an ordinary `/home/<user>` directory, and that common Buildroot host commands exist.

## Setup actions

- Select an existing WSL 2 distribution and inspect readiness. WSL 1 entries cannot be selected for setup.
- Install missing prerequisites on Debian or Ubuntu after a native confirmation. This runs a fixed package-manager command as root; Buildroot itself always uses the non-root default account. Network access is required for packages. This is a host-tool presence check, not proof of compatibility with every Buildroot revision.
- Import a trusted `.tar` Linux root filesystem through the native picker. Each import gets a unique dedicated distribution name and storage directory. Existing registrations are never replaced. A managed record is saved before import starts and retained if import or account configuration does not finish.
- A new managed distribution initializes a `materialbuilder` non-root account and asks WSL to make it the default. Older WSL versions without default-user management remain explicitly incomplete. The imported archive must provide Debian/Ubuntu-compatible user-management utilities; unsupported archives remain preserved for manual recovery.
- Prepare `source`, `output` and `downloads` directories inside the non-root user's Linux home. Existing content is preserved; symbolic-link substitutions are rejected.
- Browse the verified Linux storage through the native file browser. The path is constructed from the selected registered distribution and verified Linux storage, never a renderer-provided UNC path.
- Export the selected distribution to an exclusively created folder inside a native-picked destination. The native confirmation explains that backups can contain secrets and that running workloads can make a backup inconsistent. Partial exports are retained and labelled incomplete. Export does not stop, unregister, overwrite or delete a distribution.

## Prerequisites and recovery

WSL 2 requires supported Windows, hardware virtualization and the Windows WSL/Virtual Machine Platform features. The panel explains these prerequisites, but does not enable operating-system features or restart the host. Any required restart is performed manually by the user. Cancellation and unavailable WSL never count as readiness.

Setup never changes an existing distribution's default user or registration. A managed import interrupted during account initialization can be inspected again; manual repair must preserve its existing filesystem and managed record. No automatic rollback deletes data. The managed record is local to the application profile and is not included in telemetry or exported reports.

## Current limits and verification

This increment supplies setup, storage preparation, native browse and backup controls. It does **not** relax the existing generic UNC/network-path rejection. Project adoption and build execution from Linux-side storage still need a separately admitted, distribution-bound project grant before they can consume these folders. Source checkout/bootstrap inside the new distribution is also not implemented here.

No WSL discovery, import, package installation, distribution launch, build execution, backup, restoration or interactive UI acceptance was performed for this increment. Production packaging only is permitted in the current delivery mode. Account creation, permissions, cancellation, restart requirements, all language/theme/scale layouts and backup consistency remain runtime acceptance work. PH05-T02 must remain unchecked until the remaining project-grant work and acceptance are complete.
