# Material Buildroot

A Windows desktop workspace for configuring Buildroot and running builds through WSL 2 or Docker Linux containers.

This repository contains the planning handoff, a generated documentation website and an unverified initial application scaffold. Application implementation is reserved for the next development session. Read [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md) and [HANDOFF.md](HANDOFF.md).

The [phased checklist](ROADMAP.md) has 11 phases and 77 stable task IDs, with evidence required before each completion check. The [website source and build guide](website/README.md) renders the current plan, checklist, articles and wiki directly. GitHub Pages activation is pending repository settings access; the prepared publishing source is `main` → `/docs`. No desktop installer or authenticated companion is available yet.

Start the next development session with [NEXT_SESSION.md](NEXT_SESSION.md). The owner requires work on `main`, frequent recoverable pushes, interactive rich/canvas editors, the complete shared feature baseline and a GitHub Pages documentation/browser companion.

## Build

The planned Windows entrypoint is `.\build.bat --run`. Build and installer scripts are being implemented.

Buildroot itself runs inside Linux. WSL projects should live on the distribution's Linux filesystem for predictable case sensitivity and performance. Docker projects use a dedicated Linux container with separate output storage.
