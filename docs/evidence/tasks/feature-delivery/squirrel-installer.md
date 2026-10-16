# squirrel-installer delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Real unsigned Squirrel.Windows Setup.exe/RELEASES/full packages/deltas

Overall: **implemented-unverified**. This label remains provisional.

Public ledger requirements: `squirrel-installer-REQ-01`, `squirrel-installer-REQ-02`, `squirrel-installer-REQ-03`, `squirrel-installer-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | implemented-unverified |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | implemented-unverified |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `build-manifest.json`, `scripts/build/driver.cjs`, `scripts/release/prepare.cjs`, `scripts/release/publish.cjs`, `docs/evidence/native-windows-20261016/release-v0.1.0-build.42.1.json`

Only Squirrel target is declared; MSI disabled; Setup.exe/RELEASES/full packages required and deltas collected if generated.

verifyInstaller validates index SHA-1/length, PE signature bytes and ZIP shape.

prepare binds exact source to receipt and copies only supported assets plus provenance/hash list.

Unsigned warnings appear in producer output and release prose.

Historical release .42.1 receipt binds 22861aed9678918b5a9a23e319ac5f17719f5d5d, explicitly excluding installation/update proof.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No current pinned package bytes, Authenticode readback, native installation/update or rollback proof.

Next action: Build exact source, inspect full payload and unsigned state, then verify supported install and update routes.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `build-manifest.json`, `scripts/build/driver.cjs`, `scripts/release/prepare.cjs`, `scripts/release/publish.cjs`, `docs/evidence/native-windows-20261016/release-v0.1.0-build.42.1.json`

Only Squirrel target is declared; MSI disabled; Setup.exe/RELEASES/full packages required and deltas collected if generated.

verifyInstaller validates index SHA-1/length, PE signature bytes and ZIP shape.

prepare binds exact source to receipt and copies only supported assets plus provenance/hash list.

Unsigned warnings appear in producer output and release prose.

Historical release .42.1 receipt binds 22861aed9678918b5a9a23e319ac5f17719f5d5d, explicitly excluding installation/update proof.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No current pinned package bytes, Authenticode readback, native installation/update or rollback proof.

Next action: Build exact source, inspect full payload and unsigned state, then verify supported install and update routes.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `build-manifest.json`, `scripts/build/driver.cjs`, `scripts/release/prepare.cjs`, `scripts/release/publish.cjs`, `docs/evidence/native-windows-20261016/release-v0.1.0-build.42.1.json`

Only Squirrel target is declared; MSI disabled; Setup.exe/RELEASES/full packages required and deltas collected if generated.

verifyInstaller validates index SHA-1/length, PE signature bytes and ZIP shape.

prepare binds exact source to receipt and copies only supported assets plus provenance/hash list.

Unsigned warnings appear in producer output and release prose.

Historical release .42.1 receipt binds 22861aed9678918b5a9a23e319ac5f17719f5d5d, explicitly excluding installation/update proof.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No current pinned package bytes, Authenticode readback, native installation/update or rollback proof.

Next action: Build exact source, inspect full payload and unsigned state, then verify supported install and update routes.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `build-manifest.json`, `scripts/build/driver.cjs`, `scripts/release/prepare.cjs`, `scripts/release/publish.cjs`, `docs/evidence/native-windows-20261016/release-v0.1.0-build.42.1.json`

Only Squirrel target is declared; MSI disabled; Setup.exe/RELEASES/full packages required and deltas collected if generated.

verifyInstaller validates index SHA-1/length, PE signature bytes and ZIP shape.

prepare binds exact source to receipt and copies only supported assets plus provenance/hash list.

Unsigned warnings appear in producer output and release prose.

Historical release .42.1 receipt binds 22861aed9678918b5a9a23e319ac5f17719f5d5d, explicitly excluding installation/update proof.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: No current pinned package bytes, Authenticode readback, native installation/update or rollback proof.

Next action: Build exact source, inspect full payload and unsigned state, then verify supported install and update routes.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
