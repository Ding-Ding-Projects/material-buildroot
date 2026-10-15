# Material Buildroot

A Windows desktop workspace in development for configuring Buildroot and running builds through WSL 2 or Docker Linux containers.

The packaged desktop shell now opens a genuine empty-project workspace and saves English, Hong Kong Cantonese or bilingual language preferences through a narrowly scoped durable broker. Appearance choices are explicitly session-only. Project creation, Buildroot execution, virtual-machine workflows, encrypted publication and the authenticated companion remain unimplemented. The [phased checklist](ROADMAP.md) preserves the wider scope and its separate evidence requirements.

The current bounded runtime evidence is tied to source `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`. Twenty-six host/preload/broker checks passed on the earlier `aa91c34f4588a0dae85faef169c4dcf542c307d0` candidate; those host/preload/session sources were unchanged by the final renderer-only repairs. Six build-tool checks passed on the current source. The settings matrix covered 48 language/theme/viewport/runtime-scale tuples; 52 layout receipts passed, including four startup receipts. Language persistence was verified across actual executable restarts. Read the [desktop article](docs/desktop/host-and-preferences.md) and [capture evidence](docs/evidence/desktop-shell/README.md) for exact limitations. These results do not establish complete product, installer or release acceptance.

The [documentation website](https://ding-ding-projects.github.io/material-buildroot/) is hosted from `main` → `/docs`, and the stored repository homepage matches that address. The isolated documentation build includes the current desktop articles and captures, all nested documentation and the complete source wiki. Its 69-page build passed 1,578 internal link/asset/fragment checks, and 20 browser runtime tuples passed observed checks. Strict browser audit acceptance remains incomplete because automatic approval rejected temporary-profile deletion. See issue 1 for the final publication revision and live byte verification. Historical [initial hosting evidence](docs/evidence/hosting/initial-live.json) remains historical. No installer or product release is available.

## Build

```powershell
.\build.bat /s
.\build.bat --target documentation /s
```

The root entrypoints acquire pinned portable tools and locked packages without administrator rights. The desktop build produced the source-bound packaged executable at `release/app/win-unpacked/Material Buildroot.exe`; its build-receipt SHA-256 is `21e9109880510ef4fde2b561e728195b7de0dd09bbeb0fdfa3ea01a415ea92d1`. An explicit `.\build.bat --run` builds and launches the desktop. The installer route is separate and has not been verified.

The documentation target builds and validates isolated `.cache/documentation-output/` files before a separate reviewed promotion into `docs/`. See [website build instructions](website/README.md) and [Windows build boundaries](docs/build/windows-entrypoints.md). The design-reference target remains synthetic material, not production evidence. No fresh-operating-system success is claimed.

Buildroot itself runs inside Linux. WSL projects should live on the distribution's Linux filesystem for predictable case sensitivity and performance. Docker projects use a dedicated Linux container with separate output storage. Neither execution route has been accepted in the current product.

Read [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [HANDOFF.md](HANDOFF.md) and [NEXT_SESSION.md](NEXT_SESSION.md) before continuing implementation.

## Verified desktop shell captures

The packaged shell was captured from source `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`. These images show the empty workspace and saved bilingual language settings. Read the [capture evidence and limitations](docs/evidence/desktop-shell/README.md) for the 48-tuple matrix, 52 validated layout receipts, source hashes, runtime-scale boundary and remaining product work.

![Projects empty workspace in bilingual dark mode at 1440 by 960](docs/evidence/desktop-shell/projects-dark.png)

![Settings in bilingual dark mode at 1440 by 960](docs/evidence/desktop-shell/settings-dark.png)
