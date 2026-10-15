# Unsigned Windows releases

## Published version 0.1.0

Automatic workflow [38682722692](https://github.com/Ding-Ding-Projects/material-buildroot/actions/runs/38682722692) subsequently completed successfully and created normal release `v0.1.0-build.1.1`, superseding the running observation below. The first `v0.1.0` direct download remains stable.

[Download Setup.exe](https://github.com/Ding-Ding-Projects/material-buildroot/releases/download/v0.1.0/Setup.exe) or inspect the [normal v0.1.0 release](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.0). The immutable tag resolves to `0881a3a3f58c85bf73f57035b3a09da3acbbe1a8`. All five uploaded asset sizes and SHA-256 digests matched local files. Bounded installed-launch evidence reported version 0.1.0, that source and ready storage, and the installed executable/archive matched the full package. Setup exit code was unavailable; signer-process audit, an update pair and automatic updating are not proven. The automatic release run 38682722692 was still in progress at this record boundary. This first desktop milestone does not close complete installer, updater or product acceptance.

The first downloadable milestone is version 0.1.0. It contains the bounded desktop shell and durable language settings. Project creation, Buildroot execution and automatic updates are not implemented. The initial code name is **Classic Har Gow · 蝦餃**, resolved from the public catalog revision recorded in `assets/branding/release-codename.json`; the [public dish photo](https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/hk-dish-0001-classic-har-gow.png) remains in its owning catalog release and is not copied into this repository or attached again.

## Local production and publication

Run the exact `build-installer.bat /s` entrypoint from committed, unchanged source. It bootstraps pinned Node.js 24.22.0, MinGit 2.56.0.2 and desktop runtime 44.7.2 from `build-manifest.json`, installs the exact npm lock and produces genuine unsigned Squirrel.Windows output. `scripts/release/prepare.cjs <exact-source-sha>` validates the receipt and Squirrel package records before copying only Setup.exe, RELEASES and full/delta packages into a fresh `release/publish` folder, adding reduced public provenance and SHA-256 checksums. Existing publication staging is preserved and rejected, never overwritten.

The installer may trigger an unknown-publisher or SmartScreen warning. Executable resource editing is enabled for the original product icon; code signing and certificate autodiscovery remain disabled. This configuration is not a signature claim. Native Authenticode readback, installation, launch and update evidence remain separate from package production. No first-release package proves an update pair or automatic updater.

## Automatic publication

`.github/workflows/release.yml` runs on every branch push and manual dispatch, excluding tag events to avoid publication loops. The selected image is `windows-2025` because no repository-owned compatible runner was available. It invokes the exact root installer entrypoint and publishes one uniquely tagged normal release, `v<version>-build.<run-number>.<attempt>`, bound to the exact workflow source SHA. No prior tag or asset is overwritten. All installer assets, reduced provenance and checksums are read back after publication, together with the tag's exact commit. The notes record first-job start, publication completion and measured duration. Tests, lint and type checks do not run in this workflow; consequently it may publish from source whose local checks would fail. Local verification is reported separately.

Release credentials use `RELEASE_TOKEN`, then `ORG_TOKEN`, then `GITHUB_TOKEN`. Values remain in the supported environment channel and are never written to output. Safe collection and upload run even after failure, with seven-day retention and nonmasking collection errors. Source trees, caches, dependency directories and credentials are excluded.

## Job dependency inventory and limits

The `package` job requires Windows PowerShell/.NET and archive support supplied by the pinned Windows image, checkout action v4, upload action v4, the root manifest's portable tools/runtime, the complete npm lock, and GitHub CLI 2.96.0. The publication CLI is downloaded from its official release with a pinned SHA-256 into the job temporary directory and started before use. The root entrypoint handles cold and warm tool acquisition without global installation. Squirrel's supported packager obtains its own required packaging tools through the pinned npm package route. Fresh hosted-job execution and native installer acceptance remain unverified until their actual runs; a dependency inventory is not that evidence.

## Branding

`assets/branding/mark.json` is the geometric source for the project's existing layered-build mark. `scripts/build/branding.cjs` deterministically generates SVG, 256-pixel PNG and ICO entries at 16, 24, 32, 48, 64, 128 and 256 pixels. `--check` checks exact output bytes. The desktop window, executable and Squirrel setup use the owned ICO. The documentation generator copies that icon to `site/assets/icon.ico`; the installer metadata uses its exact deployed project-owned URL. Live delivery of that URL must be verified before publication is claimed.
