# Getting started with the plan

## For future users

The intended workflow is to choose a board or virtual-machine preset, select a Linux build backend, configure the system, build it and export an image. Both guided and expert workflows are required.

The initial desktop target is Windows x64. Buildroot runs in WSL 2 or Docker Linux containers. The initial guest targets are x86_64 VMware Workstation and VirtualBox, with BIOS and UEFI presets. Planned outputs include bootable ISO, VMDK, VDI and OVA.

There is no downloadable installer yet. Download links will be added only after a real installer is built, tested and published. There is no live companion connection yet.

Read the [full plan](../../PLAN.md), [owner decisions](../../DECISIONS.md) and [phased roadmap](../../ROADMAP.md). Product behavior described there is required or proposed as labelled, not evidence that it already works.

## For the next implementer

Start with [the next-session guide](../../NEXT_SESSION.md). Work only on `main`. Select the first eligible unchecked roadmap task, read its prerequisites and complete its required evidence before checking it off. Keep blocked work visible and leave an exact handoff.

The [feature inventory](../planning/feature-coverage.md) contains 105 shared obligations in addition to the Buildroot-specific workflows. Each applicable desktop, documentation and companion surface needs independent verification.
