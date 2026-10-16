# Component and adapter admission

`scripts/build/adapter-admission.cjs` exposes `loadAdapterAdmission(root)` for the build producer. It reads exact direct production package versions, registry URLs, integrity values and declared licenses from the root and documentation package locks. It rejects absent or changed pins. Build-tool archive provenance comes from `build-manifest.json`; Ollama and icon provenance come from their existing manifests. No network request or command execution occurs during inventory construction.

The result is a source inventory with `accepted: false`. Compatibility, runtime operation, redistribution and complete offline payload acceptance remain independent. A package's declared SPDX license is recorded metadata, not legal approval. Missing license declarations remain null. An external project's home page identifies its source lineage, not an approved binary or version.

## Coverage and consumers

The registry names genuine Material Web imports in the production renderer. Package versions are read independently for the desktop and documentation surfaces because their pins differ. Import records do not establish browser custom-element registration or visual behavior. Additional components imported by other renderer modules require their own runtime inventory.

The registry derives the ten required bundled tools and the external user-admitted tools directly from `scripts/build/offline-payloads.json`, including archive pins, declared licenses, notice paths, source URLs, composition, excluded members and source inventories. It rejects missing required tool records, duplicate identities and conflicting bundled/external identities. It adds first-party native file brokerage and flashing, the external WSL platform and the explicitly unadmitted FFmpeg WebAssembly adapter. First-party helper records retain unknown versions and incomplete package embedding. Browser PDF and ZIP packages are included only when present in the documentation manifest and exact lock. The complete toolset is never reported offline-capable merely because its bundled subset exists.

External executable selection still belongs to the existing runtime and payload manager: an inventory record grants no execution, path, command, network or file authority. Do not replace existing hash checks, user-selection receipts or isolation requirements with registry membership.

## Installer policy

`assertInstallerAdmission(admission, installerFiles)` consumes actual `{path, size}` output records and requires at least one nonempty full Squirrel package no larger than 1,400,000,000 bytes. The returned measurement proves only the supplied size policy. It deliberately retains `payloadEmbedding: unverified`; a small package can still omit required data. The build producer must supply actual measured package records after packaging, and include the inventory in its source-bound receipt.

## Verification and remaining admission

Implementation was authored under the requested release-speed mode. Tests, static analysis, builds, runtime interaction and screenshots were not run in this lane. Integration requires the packaging lane's existing `offline-payloads.json`, which is not duplicated by this change. Production build consumption, actual component registration, full transitive license/notice coverage, selected external binary versions, redistributability decisions, payload embedding and current installer size remain acceptance work. No HTTP API is introduced.
