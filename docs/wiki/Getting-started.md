# Getting started with the plan

## For future users

The intended workflow is to choose a board or virtual-machine preset, select a Linux build backend, configure the system, build it and export an image. Both guided and expert workflows are required.

The initial desktop target is Windows x64. Buildroot runs in WSL 2 or Docker Linux containers. The initial guest targets are x86_64 VMware Workstation and VirtualBox, with BIOS and UEFI presets. Planned outputs include bootable ISO, VMDK, VDI and OVA.

Normal Windows installer releases are available from the [release history](https://github.com/Ding-Ding-Projects/material-buildroot/releases). They use unsigned Squirrel.Windows and may display an unknown-publisher warning. Build and release evidence is separate from installation, update and runtime acceptance, which remains incomplete. The current pass deliberately defers tests and screenshots. Companion source exists, while actual paired-host acceptance remains separately tracked.

Read the [full plan](../../PLAN.md), [owner decisions](../../DECISIONS.md) and [phased roadmap](../../ROADMAP.md). Product behavior described there is required or proposed as labelled, not evidence that it already works.

## For the next implementer

Start with [the current handoff](../../HANDOFF.md). The current pass uses one implementation worker per unfinished roadmap leaf in isolated branches and checkouts, then integrates completed contributions into `main`. Follow the [assignment inventory](../planning/implementation-queue.json). Acceptance-dependent tasks stay unchecked while their evidence is deferred. Keep blocked work visible and leave an exact handoff.

The [feature inventory](../planning/feature-coverage.md) maps 109 identities and 436 surface records in addition to the Buildroot-specific workflows. Each applicable desktop, documentation and companion surface needs independent verification.
