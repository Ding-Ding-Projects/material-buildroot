# Material Buildroot

A Windows desktop workspace for configuring Buildroot and running builds through WSL 2 or Docker Linux containers.

This repository currently contains a planning handoff and an unverified initial scaffold. Application implementation is reserved for the next development session. Read [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md) and [HANDOFF.md](HANDOFF.md).

## Build

The planned Windows entrypoint is `.\build.bat --run`. Build and installer scripts are being implemented.

Buildroot itself runs inside Linux. WSL projects should live on the distribution's Linux filesystem for predictable case sensitivity and performance. Docker projects use a dedicated Linux container with separate output storage.
