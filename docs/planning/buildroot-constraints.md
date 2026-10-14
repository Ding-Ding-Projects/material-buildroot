# Official-source Buildroot constraints

Research observation date: 2026-10-14. Recheck current official listings before pinning implementation dependencies or declaring version support.

## Source versions

Observed official listings show stable 2026.08 (released 2026-09-04, listed EOL December 2026) and LTS 2025.02.18 (released 2026-09-10, listed EOL March 2028). The news retrieved for this planning pass ends on 10 September 2026; no later release is assumed. The listed 2026.05.3 old-stable line has an elapsed September 2026 EOL. The future 2027.02 LTS schedule is not an available release.

The application must distinguish a discoverable ref from a verified compatible version. Custom refs need capability discovery and honest compatibility rows.

## Host, filesystem and paths

Buildroot is designed for Linux and recommends normal-user execution. The Windows application delegates to WSL 2 or Linux containers.

Validate the actual Linux tools, including GNU make, GCC/G++, Perl, Bash, binutils, patch, archive utilities, rsync, bc, awk, wget and `/usr/bin/file`. Host checks are version-specific.

Buildroot's dependency check rejects spaces, tabs and newlines in PATH. WSL often imports Windows PATH entries containing spaces. Supply a scoped validated Linux task PATH; do not globally rewrite the user's environment.

Recommend Linux-side storage for Linux sources/output. Windows-mounted sources need separately verified semantics for case, permissions, symlinks and performance. Docker bind sources are resolved on the daemon host. Do not pretend a remote daemon can mount a local client directory.

## Configuration and concurrency

`O=` moves configuration/build products to a separate output tree. Relative values resolve against the source tree. Canonical absolute output paths and output-level locks prevent collisions; distinct outputs may share sources.

`BR2_EXTERNAL` is an ordered space-separated list, not a colon-separated list. Relative paths resolve against the source tree and the selection persists in output `.br2-external.mk`. Model it as an ordered array and distinguish omission from explicit clearing.

Buildroot's actual `olddefconfig` uses compiled `conf` and `COMMON_CONFIG_ENV`. The proposed Kconfig library must reproduce each supported version's environment and generated external inputs, then reconcile through the official target. It is an implementation proposal, not an official Buildroot endorsement.

`savedefconfig` omits defaults; destination uses `BR2_DEFCONFIG`. Discover actual defaults through `list-defconfigs`, including external trees.

`BR2_JLEVEL` controls ordinary package build concurrency; zero means CPU count plus one. Top-level `make -jN` is experimental and requires `BR2_PER_PACKAGE_DIRECTORIES`. The interface must distinguish these settings rather than exposing a misleading generic Jobs value.

Architecture/toolchain changes generally require a full rebuild. Removing packages requires rebuilding from scratch. Reconciled configuration does not make previous output current.

## Graphs and license output

Dependency graphs require Graphviz and support PDF/SVG/PNG. Build-time graphs require recorded data and Matplotlib/Numpy. Surface unavailable data and dependencies before starting.

`legal-info` provides sources, licenses, manifests, configuration and warnings. It is declarative evidence with known incompleteness, not certified license compliance. Preserve warnings in the UI and exports.

## Docker setup

Observed Docker Desktop documentation calls for WSL 2.1.5 or newer, Linux container mode, virtualization and 8 GB RAM. Enhanced Container Isolation calls for WSL 2.6. Some organizational use requires a subscription. Detect actual licensing/install state and do not promise universally free unattended setup.

## Official references

- [Downloads](https://buildroot.org/download.html)
- [Release news](https://buildroot.org/news.html)
- [LTS lifecycle](https://lts.buildroot.org/)
- [Stable manual](https://buildroot.org/downloads/manual/manual.html)
- [Configuration target environment](https://gitlab.com/buildroot.org/buildroot/-/raw/2026.08/Makefile)
- [Host checks](https://gitlab.com/buildroot.org/buildroot/-/raw/2026.08/support/dependencies/dependencies.sh)
- [Package parallelism](https://gitlab.com/buildroot.org/buildroot/-/raw/2026.08/package/Makefile.in)
- [WSL filesystem guidance](https://learn.microsoft.com/en-us/windows/wsl/filesystems)
- [Windows case sensitivity](https://learn.microsoft.com/en-us/windows/wsl/case-sensitivity)
- [Docker WSL backend](https://docs.docker.com/desktop/features/wsl/)
- [Docker filesystem guidance](https://docs.docker.com/desktop/features/wsl/best-practices/)
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [Docker Desktop requirements](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Kconfig language](https://www.kernel.org/doc/html/latest/kbuild/kconfig-language.html)
