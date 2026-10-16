# Managed Buildroot execution workflows

The execution setup workspace includes a fixed-action workflow builder and an expert YAML editor. Select and authorize the source repository, destination repository, and Linux runner in execution setup first. The builder requires a full 40-character source commit, a Buildroot defconfig name, one target (`all`, `source`, `legal-info`, or `sdk`), and parallelism from 1 through 8.

## Preview and publication

Preparing a preview resolves the source commit through the trusted host service, checks the selected destination's current default branch revision, inventories existing workflow files, and displays the exact generated YAML, destination path, source revision, runner, and SHA-256 digest. The preview expires after five minutes. Changing fields or execution selection clears the renderer confirmation.

Publication requires a separate checked confirmation and the displayed preview identity and digest. The host rechecks selection identity, source identity, and destination revision. It consumes the preview before the write, creates a new digest-named workflow file without an existing-file SHA, and reads the stored bytes back at the returned commit before admitting execution. Existing files are never overwritten. A lost response or failed readback is explicitly unverified and never automatically retried. The user must inspect the destination before preparing another attempt.

Publication is a source mutation only. It does not dispatch a run. A separate execution control requires its own confirmation. The workflow supports only manual dispatch with an operation UUID. Source revision, repository, configuration, target, and parallelism are fixed in the published file. No push, pull-request, schedule, or release trigger is generated.

## Expert YAML admission

The expert editor accepts YAML 1.2 through `yaml` version 2.9.1. JSON-form YAML is also valid, but is not required. Input is limited to 65,536 UTF-8 bytes, one document, 20 structural levels, and 2,000 structural nodes. Duplicate keys, aliases, anchors, custom tags, merge keys, dangerous object keys, parser errors, and parser warnings are rejected.

The parser recovers the same build model from the workflow's `env` values, validates those values, regenerates the entire allowed action document, and compares the complete parsed tree with that document. Formatting and mapping order may differ. Unknown actions, arbitrary shell, additional expressions, altered permissions, extra jobs, custom runner labels outside the selected runner, and unknown fields are not admitted. Unsupported text remains in the editor and cannot be published. The host, not renderer validation, is the admission authority.

## Execution boundary

Generated workflows use pinned checkout and upload actions, read-only repository permissions, disabled persisted checkout credentials, no recursive submodule checkout, and a non-root source build. The Linux runner must support `apt-get` and noninteractive `sudo` for the fixed dependency bootstrap. Unsupported images fail visibly instead of skipping prerequisites. This workflow builds Buildroot's Linux outputs, not the desktop application's Windows installer. It runs no tests or lint and creates no application release.

The checkout uses `BUILDROOT_SOURCE_TOKEN` when configured, otherwise the workflow token. A dedicated private source needs a narrowly scoped repository read credential configured outside this editor; execution setup currently rejects private cross-repository sources. No credential value is accepted by the editor, returned to the renderer, or written into generated source. Source code is trusted executable build input and may execute its own build rules, so publication and dispatch should be authorized only for trusted immutable source.

Only direct regular files from `output/images` are collected, without following symbolic links. Collection is capped at 1,000 files and 32 MiB total. Larger output sets remain unavailable through this bounded download path. `manifest.json` records schema version 1, operation UUID, workflow commit, source commit, and each file's relative path, byte length and SHA-256. Upload uses the fixed `buildroot-output` name, seven-day retention, and excludes hidden files. Collection/upload run after failure without masking the original build result. Missing or partial manifests must not be interpreted as verified downloads.

## Dependency provenance

- Package: `yaml`, exact version `2.9.1`, ISC license.
- Source: https://github.com/eemeli/yaml
- Registry archive: https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz
- Registry integrity: `sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==`
- The package includes its ISC license. The exact manifest and npm lockfile record production installation. Lockfile preparation used lifecycle scripts disabled and did not run tests or audits.

## Verification state

This change implements future admission and readback logic. No external workflow was published or dispatched during implementation. No local test, review suite, static analysis, runtime exercise, or UI capture was run under the selected delivery mode. Real hosted builds, self-hosted runner execution, publication races, malformed YAML rejection, download verification, localization and accessibility remain runtime acceptance work.
