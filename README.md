# Material Buildroot

A Material Design 3 desktop workspace for configuring and building embedded Linux systems through WSL 2 or Docker.

[Interactive documentation](https://ding-ding-projects.github.io/material-buildroot/) · [Latest Windows release](https://github.com/Ding-Ding-Projects/material-buildroot/releases/latest) · [Full screenshot gallery](docs/evidence/modern-workspace/README.md) · [Roadmap](ROADMAP.md)

## A productive desktop workspace

An activity rail, project explorer, editor tabs and resizable output dock keep projects and their results together. Bundled Material icons identify navigation and editor actions. Package dependencies and guest topology have interactive canvases with pan, zoom, fit, keyboard movement and separate layout history.

Practical onboarding creates a saved plan and preserves setup progress. Native folder selection connects trusted sources and separate outputs. Package discovery reads actual source declarations; reviewed imports preserve unsupported recipes. Runtime choices and ordered external trees persist, while filesystem and execution authority must be renewed after restart.

The local assistant exposes managed Ollama controls, actual installed-model metadata and measured capacity evidence. Offline help packages the public articles with formatted reading, topic navigation and isolated local search. The documentation website adds guided tasks, recipe previews, troubleshooting and saved browser progress.

## Current interface

These are genuine, unretouched Linux Chromium captures of the application renderer. Workspace storage and the offline documentation service are real; native-operation boundaries use explicit fixtures. The [capture manifest and full gallery](docs/evidence/modern-workspace/README.md) record exact source and image hashes, capture clocks, language/theme/viewport and each workflow's verification limit. They do not establish packaged Windows acceptance.

### Package dependency canvas

![Material package dependency editor with source discovery and typed inspectors](docs/evidence/modern-workspace/current/package-canvas-en-light-1440.png)

### Guest topology

![Guest topology canvas with hardware, network and storage inspectors](docs/evidence/modern-workspace/current/guest-canvas-en-light-1440.png)

### Source management

![Source clone, revision and reviewed update controls](docs/evidence/modern-workspace/current/source-en-light-1440.png)

### Configuration

![Bilingual configuration controls with typed values and contextual help](docs/evidence/modern-workspace/current/configuration-bilingual-dark-960.png)

### Runtime and project setup

![Trusted project and Linux runtime setup workspace](docs/evidence/modern-workspace/current/runtime-en-light-1440.png)

### Builds and output

![Build controls and an empty jobs and output dock](docs/evidence/modern-workspace/current/jobs-en-light-1440.png)

### Built-in tools

![Conversion and PDF controls with Material icons](docs/evidence/modern-workspace/current/tools-en-light-1440.png)

### Local assistant

![Local assistant and managed runtime controls without an invented running model](docs/evidence/modern-workspace/current/assistant-en-light-1440.png)

### Read-only companion

![Explicit HTTPS browser pairing and read-only session controls](docs/evidence/modern-workspace/current/companion-en-light-1440.png)

### Offline documentation

![Bilingual offline help showing the actual packaged article inventory](docs/evidence/modern-workspace/current/offline-help-bilingual-dark-960.png)

### Settings and recovery

![Appearance, language and workspace recovery controls](docs/evidence/modern-workspace/current/settings-en-light-1440.png)

### Resumable onboarding

![Practical resumable workspace setup wizard](docs/evidence/modern-workspace/current/onboarding-en-light-1440.png)

[Historical screenshots and their original provenance](docs/evidence/ARCHIVE.md) are retained separately.

## Scope and verification

The full product remains in active implementation. Windows runtime testing is deferred by owner direction. Source implementation, Linux browser fixtures, Windows packaging and native acceptance are separate evidence. The [workspace guide](docs/desktop/modern-workspace.md) describes actual behavior and limits; the [roadmap](ROADMAP.md) retains missing functionality and acceptance requirements.

Buildroot runs in a non-root Linux runtime. Docker requires an existing digest-pinned image. External converters and PDF tools require admitted payloads and verified isolation. Companion pairing requires browser-trusted TLS and native owner approval. Downloading an update does not install it. Existing sources, outputs and protected data are preserved.

## Build

```powershell
.\build.bat /s
.\build-installer.bat /s
.\build.bat --target documentation /s
```

The root entrypoints acquire pinned portable tools and locked packages without administrator rights. `build.bat --run` explicitly builds and launches the application. The unsigned Squirrel.Windows installer can trigger publisher or SmartScreen warnings. Build scripts produce artifacts; publication is a separate workflow.

The documentation target validates isolated generated output before promotion into `docs/`. GitHub Pages serves `main` → `/docs`. See [Windows entrypoints](docs/build/windows-entrypoints.md), [website authoring](website/README.md) and [the current handoff](HANDOFF.md).
