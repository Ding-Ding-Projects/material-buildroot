# Source acquisition and revision lifecycle

The Source workspace acquires Buildroot with Git over HTTPS, inspects the current revision and local changes, and separates fetch, preview and Apply. The official acquisition action fixes its origin to https://gitlab.com/buildroot.org/buildroot.git. Custom HTTPS repositories retain a separate explicit trust acknowledgement. Neither route replaces an existing nonempty destination.

## Preserve and apply a revision

1. Adopt a trusted source project, then refresh its status.
2. Retain the current committed revision if desired. Local modifications block snapshot creation.
3. Fetch a branch or tag. Fetch does not switch the source working tree.
4. Review the immutable target revision, changed-file summary and complete bounded text patch.
5. Read the compatibility advisory and explicitly accept the reviewed revision.
6. Apply switches to a detached revision only after rechecking the original revision and absence of local changes.

Before each Apply, a separate ref below `refs/material-buildroot/snapshots/` retains the previous commit. Snapshot creation uses an absent-ref compare-and-swap. Restarting the application does not remove these refs. Refresh lists the newest 100 retained snapshots, while older refs remain untouched. Selecting one creates a fresh rollback preview and requires a new Apply acknowledgement. Existing user branches are not rewritten.

Snapshots preserve committed source only. They do not back up uncommitted files, ignored files, unsaved configuration drafts, external trees or build output. A snapshot remains if a subsequent switch fails. Refresh status before deciding how to recover. Checkout refuses overwriting ignored files. No reset, forced checkout, automatic stash or source deletion is used.

## Preview and compatibility boundaries

A preview expires after ten minutes. The existing subprocess output bound is 4 MiB per command; an oversized patch stops preview creation rather than permitting Apply from incomplete content. Binary-file contents are not rendered as text. Changed toolchain, architecture, configuration, package, kernel, boot and build-infrastructure paths are advisory categories only.

Output files are preserved. Their compatibility with the proposed source remains unknown. Configuration migration, stamp invalidation and output rebuilding are not inferred or performed by switching the source revision. Review configuration before a subsequent build. Source operations acquire the existing source lease for mutations; the dedicated WSL consumer holds source/output leases throughout its operations.

## WSL authority

WSL source operations use a dedicated host-only consumer, never generic Windows path authority. Its process-local admitted receipt binds distribution, boot ID, machine ID, non-root uid, and root/source/output device and inode identities. Every operation holds a source/output lease. Every Git invocation repeats the identity check inside the process that runs Git; changed or unavailable identities stop the operation. References are validated data arguments to fixed host code. Renderer-provided shell scripts and filesystem paths are not accepted.

WSL acquisition remains in the WSL workspace's existing fixed official-source route. The source consumer requires an already adopted ordinary Git source tree and current receipt. Persisted project metadata cannot restore this authority after restart; native adoption is required. The existing simple ASCII Linux path constraints remain.

## Release archive limitation

The [official download page](https://buildroot.org/download.html) supplies release archives and detached PGP signatures. Archive acquisition and extraction are not implemented by this workflow. This application has no admitted Buildroot archive-signature verification route or source-specific, link-preserving extractor. Its existing generic payload extractor rejects links and must not be weakened for this purpose. A digest computed after downloading bytes is not independent upstream authentication.

Use the supported official HTTPS Git acquisition route instead. HTTPS authenticates the transport endpoint; it does not prove a signed commit or tag. No signature verification is claimed for the Git route.

## Verification state

Source implementation and production-build results are separate from runtime acceptance. Tests, static analysis, reviews, runtime source changes, WSL execution and screenshots are deferred for this delivery. Preservation, restart discovery, conflicting external writes, real Git/WSL failure recovery and complete localized interaction remain unverified until their explicit acceptance run.
