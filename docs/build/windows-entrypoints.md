# Windows entrypoints and source-bound outputs

The supported host is Windows x64. The three root entrypoints share `build-manifest.json` and the same acquisition implementation:

```powershell
.\build.bat --run
.\build-installer.bat /s
.\download-dependencies.bat --target design-reference /s
.\build.bat --target design-reference /s
```

The first command is the intended one-command desktop build-and-run route. It currently returns a nonzero result because the production desktop entry is not implemented. It does not launch the design reference as a substitute. The installer path is likewise incomplete until the production source and bundled adapters exist. The design-reference target builds a static executable reference only, with synthetic records and no host operations.

## Portable acquisition

No administrator rights are required. Node.js 24.22.0 and MinGit 2.56.0.2 are obtained from their canonical distributions into ignored project-local storage. Exact archive SHA-256 values, extraction limits and required members are checked in the shared manifest. Windows PowerShell 5.1 and built-in .NET APIs provide the initial bootstrap; a preinstalled Node.js or Git executable is not required by this acquisition route.

Archives are hashed before extraction. The inventory is derived from those verified archive bytes, and every extracted regular file is checked on both cold and warm paths. Unsafe member names, duplicate paths, links, missing files and unexpected files are rejected. Each activation holds an exclusive file handle, uses a unique staging generation and records a durable journal before moving an existing tree. Recovery verifies real active, backup or staged bytes instead of trusting journal paths. Malformed journals are retained or quarantined; an unrecoverable state stops without discarding evidence.

The root package lock pins npm dependencies and integrity values. `npm ci --ignore-scripts` reinstalls the exact locked tree using npm's cache and disables dependency lifecycle scripts. The separate desktop runtime archive is pinned in the manifest. Vite, Material Web, Lit and packaging versions are exact in `package.json`. Material Web is maintained upstream in maintenance mode; imports alone do not prove component registration or accessibility.

The observed acquisition run obtained Node.js and MinGit, read back their versions and installed 311 locked packages. This proves acquisition on the current Windows host. It is not a fresh-operating-system receipt, and no production installer or runtime proof is implied.

## Production and recovery boundaries

A checkout-wide producer lock covers acquisition, npm mutation, renderer generation, package output activation and launch checks. A competing producer stops with an explicit ownership message. Every actual build requires committed source, an unchanged index and no untracked source files. The receipt binds commit, source tree, index tree, manifest schema/hash, target metadata, canonical command, package-lock hash and exact output bytes. Source identity is checked again after production and before a requested launch.

The design target emits `dist-design/design/reference/index.html` and `dist-design/build-receipt.json`. It uses a fresh generation, preserves earlier outputs, and journals destination replacement. Recovery promotes only a byte-verified prior output when the advertised destination is absent. An invalid journal with no verified generation fails closed.

The desktop target is specified to produce an executable plus `resources/app.asar`. The installer target invokes Squirrel.Windows with signing and publication disabled. Its local output check requires a PE `Setup.exe`, `RELEASES`, full `.nupkg` and matching package hashes and lengths. This shape check is not native install/update proof. Unsigned installers may trigger unknown-publisher or SmartScreen warnings. No build script creates tags, pushes source or publishes releases.

Silent flags are `/s`, `--silent` and `SILENT=1`. Run aliases are `/run`, `--run` and `RUN_AFTER_BUILD=1`. Silent mode never prompts; launch requires an explicit run choice. A static target has no desktop launch action, and installer production cannot launch the application. Child exit status propagates to the root command.

An optional maintainer-local currency check skips outsiders with no private source and rejects missing or stale local locks when that source is present. The public repository contains only the method, no dictionary or digest. This check cannot prove conversation behavior.

## Verification and remaining work

Six focused Node tests cover source/index mutation, real junction escapes, output tampering/recovery, installer metadata and a real PowerShell 5.1 fixture. The PowerShell fixture exercises argument parsing, complete cold/warm trees, tamper repair, journal replacement, malformed journals, interrupted moves, exclusive lock contention, extra files and archive traversal. These are local tests, not workflow jobs.

Remaining acceptance includes a genuinely fresh Windows environment, stalled-transfer cancellation, a real concurrent whole-build attempt, forced process interruption during production activation, complete package/license inventory, production executable and bundled-resource validation, native UI operation, Squirrel installation/update, and all release/publication proof. The build and reference tasks remain unchecked until their full acceptance is present.

The first real root reference build succeeded from commit `e16fa45fc73d24480b80c4db2eab695bcbe57b2d`, transforming 137 modules. Its build-receipt SHA-256 is `99a6b5a5d9b5da35b0cc23b5986f6302d7d296e01d1f3c0ac7e59f23433cec0f`. Later source corrections require separate rebuilt evidence.
