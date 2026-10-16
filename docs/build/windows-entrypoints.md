# Windows entrypoints and source-bound outputs

[香港粵語](windows-entrypoints.zh-HK.md)

The supported host is Windows x64. The three root entrypoints share `build-manifest.json` and the same acquisition implementation:

```powershell
.\build.bat --run
.\build-installer.bat /s
.\download-dependencies.bat --target design-reference /s
.\build.bat --target design-reference /s
.\build.bat --target documentation /s
```

The first command builds and explicitly launches the production desktop shell. The exact root desktop build succeeded from `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd`, producing the packaged shell and its source-bound receipt. The bounded runtime evidence is described below; installer production, installation/update and release acceptance remain unverified. The design-reference target builds separate synthetic material with no host operations.

## Portable acquisition

No administrator rights are required. Node.js 24.22.0 and MinGit 2.56.0.2 are obtained from their canonical distributions into ignored project-local storage. Exact archive SHA-256 values, extraction limits and required members are checked in the shared manifest. Windows PowerShell 5.1 and built-in .NET APIs provide the initial bootstrap; a preinstalled Node.js or Git executable is not required by this acquisition route.

Archives are hashed before extraction. The inventory is derived from those verified archive bytes, and every extracted regular file is checked on both cold and warm paths. Unsafe member names, duplicate paths, links, missing files and unexpected files are rejected. Each activation holds an exclusive file handle, uses a unique staging generation and records a durable journal before moving an existing tree. Recovery verifies real active, backup or staged bytes instead of trusting journal paths. Malformed journals are retained or quarantined; an unrecoverable state stops without discarding evidence.

The root package lock pins desktop/reference npm dependencies and integrity values; the documentation target uses its separate `website/package-lock.json`. `npm ci --ignore-scripts` reinstalls the exact locked tree using npm's cache and disables dependency lifecycle scripts. The separate desktop runtime archive is pinned in the manifest. Vite, Material Web, Lit and packaging versions are exact in `package.json`. Material Web is maintained upstream in maintenance mode; imports alone do not prove component registration or accessibility.

The observed acquisition run obtained Node.js and MinGit, read back their versions and installed 311 locked packages. This proves acquisition on the current Windows host. It is not a fresh-operating-system receipt, and no production installer or runtime proof is implied.

Extraction and complete-tree verification use extended-length Windows paths at the .NET file I/O boundary, including local-drive and UNC paths. This supports deeply nested package members in long checkout paths under Windows PowerShell 5.1 without changing host long-path settings. Verification walks entries without following reparse points and still checks every regular file against the pinned archive inventory. Child tools receive ordinary paths. Existing failed stages and acquisition caches remain preserved.

## Production and recovery boundaries

A checkout-wide producer lock covers acquisition, npm mutation, renderer generation, package output activation and launch checks. A competing producer stops with an explicit ownership message. Every actual build requires committed source, an unchanged index and no untracked source files. The receipt binds commit, source tree, index tree, manifest schema/hash, target metadata, canonical command, package-lock hash and exact output bytes. Source identity is checked again after production and before a requested launch.

The design target emits `dist-design/design/reference/index.html` and `dist-design/build-receipt.json`. It uses a fresh generation, preserves earlier outputs, and journals destination replacement. Recovery promotes only a byte-verified prior output when the advertised destination is absent. An invalid journal with no verified generation fails closed.

The desktop target produces an executable plus `resources/app.asar`. The installer target invokes Squirrel.Windows with signing and publication disabled. Its local output check requires a PE `Setup.exe`, `RELEASES`, full `.nupkg` and matching package hashes and lengths. This shape check is not native install/update proof. Unsigned installers may trigger unknown-publisher or SmartScreen warnings. No build script creates tags, pushes source or publishes releases.

Silent flags are `/s`, `--silent` and `SILENT=1`. Run aliases are `/run`, `--run` and `RUN_AFTER_BUILD=1`. Silent mode never prompts; launch requires an explicit run choice. A static target has no desktop launch action, and installer production cannot launch the application. Child exit status propagates to the root command.

An optional maintainer-local currency check skips outsiders with no private source and rejects missing or stale local locks when that source is present. The public repository contains only the method, no dictionary or digest. This check cannot prove conversation behavior.

## Verification and remaining work

Six focused Node tests cover source/index mutation, real junction escapes, output tampering/recovery, installer metadata and a real PowerShell 5.1 fixture. The PowerShell fixture exercises argument parsing, complete cold/warm trees, tamper repair, journal replacement, malformed journals, interrupted moves, exclusive lock contention, extra files and archive traversal. These are local tests, not workflow jobs.

Remaining acceptance includes a genuinely fresh Windows environment, stalled-transfer cancellation, a real concurrent whole-build attempt, forced process interruption during production activation, complete package/license inventory, full product/native UI and execution-adapter acceptance, Squirrel installation/update, and all release/publication proof. The build and reference tasks remain unchecked until their full acceptance is present.

## Historical reference build

The first real root reference build succeeded from commit `e16fa45fc73d24480b80c4db2eab695bcbe57b2d`, transforming 137 modules. Its build-receipt SHA-256 is `99a6b5a5d9b5da35b0cc23b5986f6302d7d296e01d1f3c0ac7e59f23433cec0f`. Later source corrections require separate rebuilt evidence.

## Current desktop milestone

Source `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd` produced `release/app/win-unpacked/Material Buildroot.exe`. Build-receipt SHA-256: `21e9109880510ef4fde2b561e728195b7de0dd09bbeb0fdfa3ea01a415ea92d1`. Executable SHA-256: `95b0d00acc352dc598bc315fb14dd4403ea57ffbfde4711a6960a2d66d89d031`. Packaged `resources/app.asar` SHA-256: `377445849f5c8028b20807f00a51ba3dda9d4e3595c116baac05f01b5b0cfa77`.

Six build-tool checks ran on that source. The current shell passed 48 settings tuples and 52 validated layout receipts, plus actual restart persistence for all three languages. These results cover the bounded shell, not Buildroot execution, installer acceptance or full product completion. Earlier host/preload and interaction checks keep their original source binding. Read the [capture evidence and exact limitations](../evidence/desktop-shell/README.md), including native DPI versus runtime/CDP scale.

## Isolated documentation target

Invoke `build.bat --target documentation /s` from the repository root. The shared driver installs the exact website lock with lifecycle scripts disabled, generates into a unique ignored staging generation, runs the documentation check, and activates `.cache/documentation-output/` with a standard source-bound receipt. Tracked source and the index must remain unchanged throughout production.

The generator recursively includes all Markdown under `docs/` and `design/` except generated `docs/site/`, renders the existing source wiki, copies referenced local assets, and binds their raw bytes into its snapshot. Path and ancestor-link checks protect both source and output. Three focused tests cover encoded Windows traversal/control rejection, actual junction ancestors and asset-only snapshot changes; `npm test` discovers both CommonJS and ES-module test files.

Review and browser verification precede separate promotion of generated `index.html`, `.nojekyll` and `site/` into `docs/`. Publication and actual live route/asset/anchor verification remain separate. The exact root target succeeded from 2f24e10df6e8294d2bb00863f4d1222161669df0 with 69 pages and 1,578 checked internal links/assets/fragments. Twenty browser runtime tuples passed observed checks; strict audit acceptance remains incomplete because temporary-profile deletion was blocked by automatic approval. It has no installer or desktop launch action.
