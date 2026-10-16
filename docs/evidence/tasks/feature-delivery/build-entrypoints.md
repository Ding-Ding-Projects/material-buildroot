# build-entrypoints delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Real root build.bat/build-installer.bat, silent mode and nonzero failure propagation

Overall: **partial**. This label remains provisional.

Public ledger requirements: `build-entrypoints-REQ-01`, `build-entrypoints-REQ-02`, `build-entrypoints-REQ-03`, `build-entrypoints-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | not-applicable-with-reason |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build.bat`, `build-installer.bat`, `scripts/build/entrypoint.ps1`, `scripts/build/driver.cjs`, `scripts/build/arguments.ps1`, `docs/build/windows-entrypoints.md`

Both exact root commands propagate the PowerShell child exit result.

Shared entrypoint uses portable user-scope tools, an exclusive producer lock and explicit no-elevation explanation.

Silent and run aliases parse; real desktop and Squirrel commands run through the manifest; installer cannot launch.

driver.sourceIdentity binds commit/tree/index/manifest before and after production; verifyInstaller checks PE/ZIP/index lengths and hashes.

Output activation preserves prior generations and validates receipt inventory; build path does not publish.

Console reports output directory and receipt SHA-256, not the requested Setup.exe path and SHA-256.

Missing behavior: Direct Setup.exe digest/path reporting absent. Per-phase elapsed duration reporting absent. Root build commands share acquisition implementation but do not invoke download-dependencies.bat itself.

Missing proof: No exact-pin root command run or fresh-environment receipt. No current install or published digest comparison.

Next action: Exercise the exact root commands on the selected host, add required direct installer identity reporting and complete cold/warm proof.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build.bat`, `build-installer.bat`, `scripts/build/entrypoint.ps1`, `scripts/build/driver.cjs`, `scripts/build/arguments.ps1`, `docs/build/windows-entrypoints.md`

Both exact root commands propagate the PowerShell child exit result.

Shared entrypoint uses portable user-scope tools, an exclusive producer lock and explicit no-elevation explanation.

Silent and run aliases parse; real desktop and Squirrel commands run through the manifest; installer cannot launch.

driver.sourceIdentity binds commit/tree/index/manifest before and after production; verifyInstaller checks PE/ZIP/index lengths and hashes.

Output activation preserves prior generations and validates receipt inventory; build path does not publish.

Console reports output directory and receipt SHA-256, not the requested Setup.exe path and SHA-256.

Missing behavior: Direct Setup.exe digest/path reporting absent. Per-phase elapsed duration reporting absent. Root build commands share acquisition implementation but do not invoke download-dependencies.bat itself.

Missing proof: No exact-pin root command run or fresh-environment receipt. No current install or published digest comparison.

Next action: Exercise the exact root commands on the selected host, add required direct installer identity reporting and complete cold/warm proof.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build.bat`, `build-installer.bat`, `scripts/build/entrypoint.ps1`, `scripts/build/driver.cjs`, `scripts/build/arguments.ps1`, `docs/build/windows-entrypoints.md`

Both exact root commands propagate the PowerShell child exit result.

Shared entrypoint uses portable user-scope tools, an exclusive producer lock and explicit no-elevation explanation.

Silent and run aliases parse; real desktop and Squirrel commands run through the manifest; installer cannot launch.

driver.sourceIdentity binds commit/tree/index/manifest before and after production; verifyInstaller checks PE/ZIP/index lengths and hashes.

Output activation preserves prior generations and validates receipt inventory; build path does not publish.

Console reports output directory and receipt SHA-256, not the requested Setup.exe path and SHA-256.

Missing behavior: Direct Setup.exe digest/path reporting absent. Per-phase elapsed duration reporting absent. Root build commands share acquisition implementation but do not invoke download-dependencies.bat itself.

Missing proof: No exact-pin root command run or fresh-environment receipt. No current install or published digest comparison.

Next action: Exercise the exact root commands on the selected host, add required direct installer identity reporting and complete cold/warm proof.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `build.bat`, `build-installer.bat`, `scripts/build/entrypoint.ps1`, `scripts/build/driver.cjs`, `scripts/build/arguments.ps1`, `docs/build/windows-entrypoints.md`

Both exact root commands propagate the PowerShell child exit result.

Shared entrypoint uses portable user-scope tools, an exclusive producer lock and explicit no-elevation explanation.

Silent and run aliases parse; real desktop and Squirrel commands run through the manifest; installer cannot launch.

driver.sourceIdentity binds commit/tree/index/manifest before and after production; verifyInstaller checks PE/ZIP/index lengths and hashes.

Output activation preserves prior generations and validates receipt inventory; build path does not publish.

Console reports output directory and receipt SHA-256, not the requested Setup.exe path and SHA-256.

Missing behavior: Direct Setup.exe digest/path reporting absent. Per-phase elapsed duration reporting absent. Root build commands share acquisition implementation but do not invoke download-dependencies.bat itself.

Missing proof: No exact-pin root command run or fresh-environment receipt. No current install or published digest comparison.

Next action: Exercise the exact root commands on the selected host, add required direct installer identity reporting and complete cold/warm proof.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
