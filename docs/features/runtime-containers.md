# Managed container runtime

The runtime workspace discovers the Docker Linux engine without starting it or installing software. Discovery distinguishes a missing client, unavailable daemon, denied access and a non-Linux engine. It lists locally installed image references with SHA-256 digests. Tags alone are not executable build inputs, and preparation never pulls an image.

## Prepare and build

1. Adopt a trusted Buildroot project and choose its output directory.
2. Open Builds, select Docker, refresh local images and select a pinned image (or supply its digest reference).
3. Prepare the retained cache. This creates or reuses a local-driver volume scoped to the project, image digest, UID/GID and daemon identity. Its ownership label and driver/options are checked before use.
4. Submit the build. The existing queue, job output, cancellation and recovery controls report its actual outcome.

The image must contain `/material-buildroot-cache`, owned and writable by the configured non-root build identity (the desktop currently selects UID/GID 1000). Docker initializes the named volume from that image directory. Preparation proves only that the volume exists with the expected metadata; write permission remains unverified until the build checks it. Source and external trees are read-only mounts. The existing selected host output directory remains the output destination, preserving artifact discovery and existing files. Downloads use the retained cache through `DL_DIR`.

Build containers have a read-only root, bounded writable temporary storage, no network, no capabilities, no privilege escalation, and the existing CPU, memory and process limits. Neither the host socket nor privileged mode is exposed. The host constructs all commands; the renderer cannot supply shell commands or volume names.

## Recovery and retention

A denied daemon connection requires the owner or administrator to restore normal runtime access. The application does not change group membership, elevate, restart the daemon or weaken permissions. Rediscover after that external repair.

A storage-permission failure stops before make starts. Preserve the volume, correct the image's directory ownership or the chosen output directory permissions through supported administration, and retry. A new image digest gets a separate cache. There is no automatic deletion, chmod, chown, reset, prune or migration of retained volumes. Missing or mismatched ownership never causes adoption of an unrelated volume.

Cancellation and probe timeout stop only an exact container ID whose operation label, generated name and daemon identity match. Job reconciliation retains the existing quarantine until stopped-state evidence is available. An unavailable daemon or changed namespace remains unknown, not successful cleanup.

## Verification state

This implementation was authored under the release-speed workflow. Container execution, tests, reviews, screenshots, installation and runtime permission/lifecycle acceptance were intentionally not run. The roadmap runtime-proof requirement remains open. No new HTTP API is added.
