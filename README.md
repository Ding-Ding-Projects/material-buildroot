# Material Buildroot

A Windows desktop workspace for configuring Buildroot and running builds through WSL 2 or Docker Linux containers.

Implementation is underway. This repository contains the initial documentation website, a 105-identity/420-surface evidence ledger, its validator with 17 passing local tests, 30 authored reference states, six passing build-tool tests, a strict request parser with nine passing tests, a durable settings broker with 20 passing tests and strict typed translation, and an unverified desktop scaffold. Structural validation does not establish product completion. Read [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md) and [HANDOFF.md](HANDOFF.md).

The [phased checklist](ROADMAP.md) preserves 11 phases with stable task IDs and independently verified children, with evidence required before each completion check. The [website source and build guide](website/README.md) renders the current plan, checklist, articles and wiki directly. The [initial website](https://ding-ding-projects.github.io/material-buildroot/) is deployed from `main` → `/docs`; [hosting evidence](docs/evidence/hosting/initial-live.json) records 46 HTML routes and 62 exact source-matching files. New documentation updates still require regeneration. No desktop installer or authenticated companion is available yet.

Start the next development session with [NEXT_SESSION.md](NEXT_SESSION.md). The owner requires work on `main`, frequent recoverable pushes, interactive rich/canvas editors, the complete shared feature baseline and a GitHub Pages documentation/browser companion.

## Build

The intended one-command Windows desktop route is:

```powershell
.\build.bat --run
```

The root entrypoints now acquire pinned portable tools and locked packages without administrator rights. Production desktop source is still incomplete, so the desktop and installer commands return a nonzero result. The current buildable reference target is `.\build.bat --target design-reference /s`; it is synthetic design material, not the installed product. See [Windows build boundaries and verification](docs/build/windows-entrypoints.md). No fresh-operating-system or installer success is claimed.

Buildroot itself runs inside Linux. WSL projects should live on the distribution's Linux filesystem for predictable case sensitivity and performance. Docker projects use a dedicated Linux container with separate output storage.
