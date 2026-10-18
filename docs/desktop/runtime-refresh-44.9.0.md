# Pinned desktop runtime refresh to 44.9.0

[香港粵語](runtime-refresh-44.9.0.zh-HK.md)

The desktop runtime package and project-local portable archive now use Electron 44.9.0. The application version is unchanged. The existing build entrypoint retains its complete archive checksum, extracted-file inventory, portable activation and source-bound output checks. The versioned cache keeps earlier runtime generations available; this change does not modify installed application settings, machine security, runtime flags or host configuration.

The official normal release `v44.9.0` was published on 2026-10-17. Its Windows x64 ZIP is 158,625,558 bytes with SHA-256 `88e08039d0ef359bab9f674e8051fa103bd8628ea7c5a5e1daaa610a8a0c6931`. The release asset digest and the downloaded official `SHASUMS256.txt` agree. The checksum file itself has SHA-256 `f9485deeff752391c11c443e62f92eb03a25be39d899405264635c241d121767`. The npm package lock uses the published 44.9.0 tarball integrity value; no adjacent packages are upgraded.

This is a supported runtime refresh candidate, not a proven repair for the observed native renderer exits. Earlier observations include exit codes `0x80000003` and `0xC0000005`; neither establishes an application-source cause. A successful build verifies packaging and source binding only. Startup, sustained native operation, renderer-exit behavior and the affected workflows require separate acceptance on the built application. No release or automatic installed update is performed by this change.

Sources: [official release](https://github.com/electron/electron/releases/tag/v44.9.0), [official checksums](https://github.com/electron/electron/releases/download/v44.9.0/SHASUMS256.txt), [npm package metadata](https://registry.npmjs.org/electron/44.9.0).
