# Closeout prompt

```text
Continue Material Buildroot (Ding-Ding-Projects/material-buildroot), a Windows Electron workspace for Buildroot that runs builds through WSL 2 or Docker Linux containers.

State on main (12 November 2026, latest release v0.1.393-build.393.1, normal, hosted build and release-timing workflows green):

- External-tree images (11 November): Builds has an "Operating system and container images" panel, and scripts/haos/ has matching command-line drivers. It detects a repository's operating-system/ Buildroot external tree, exports the committed tree with git archive into a Docker volume, runs the tree's own builder with make <board>, and returns haos_* files with SHA-256 receipts. A second action builds the Home Assistant Material container image locally (never pushed). Verified: the ova board built in 93 minutes, booted under QEMU with KVM and UEFI to the Home Assistant landing page and onboarding, and the local container image served /manifest.json. Evidence: docs/evidence/external-tree-images/README.md.
- Installer size (12 November): with every engine bundled the full package was 1,431,852,095 bytes, over the 1.4 GB cap. LibreOffice, calibre, tar, pandoc and Ollama are now in onDemandToolIds (scripts/build/offline-payloads.json). The first operation that needs one downloads its pinned archive, checks length and SHA-256, and extracts it into the private payloads/on-demand folder (installOnDemandPayload in scripts/build/payloads.cjs, wired through src/main/tools/payload-manager.cjs). ImageMagick, FFmpeg and qpdf stay bundled because the native file broker loads them only from installed resources; Java and Docker stay bundled too. The full package is now 440,039,520 bytes. A real run over the actual pinned archives installed all five tools with the same file counts as the earlier bundled assembly.
- Hosted build fixes on the way: calibre and LibreOffice release downloads had moved (new addresses, same pinned bytes); offline Help now opens through a Windows 8.3 short temporary path; the release-timing workflow derives its tag from the run-number version instead of package.json.
- Unit tests: 713 run, 702 passed, 0 failed, 11 skipped (node --test tests/*.test.cjs).

Not verified yet:
1. A conversion inside an installed copy that needs an on-demand engine, with and without network access. In particular, LibreOffice reconstruction from inside app.asar relies on the unpacked extract-office-msi.ps1 path.
2. A container image build started from inside the desktop window. The last attempt ended when the application exited after a folder dialog driven by posted messages on a hidden desktop.
3. Other boards (Raspberry Pi and the remaining defconfigs), hardware, signed update bundles, and onboarding inside a booted image.
4. The earlier GUI acceptance items listed in ROADMAP.md and HANDOFF.md.

Keep README.md, HANDOFF.md, ROADMAP.md and docs/ current with each change. Every push builds and publishes a normal release, so verify before pushing.
```
