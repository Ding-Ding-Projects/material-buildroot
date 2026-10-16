# app-icon delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Original product identity, packaged icons, actual installed rendering

Overall: **partial**. This label remains provisional.

Public ledger requirements: `app-icon-REQ-01`, `app-icon-REQ-02`, `app-icon-REQ-03`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | partial |
| C | partial |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `assets/branding/mark.json`, `assets/branding/icon.ico`, `assets/branding/icon.svg`, `scripts/build/branding.cjs`, `package.json`, `src/main/index.cjs`

Original layered mark has deterministic SVG/PNG and seven-resolution ICO generator.

BrowserWindow and executable packaging use tracked ICO.

Squirrel iconUrl points to a mutable GitHub Pages asset, rather than an immutable content address.

No explicit update-metadata icon identity was established.

Missing behavior: Mutable iconUrl violates immutable icon-delivery clause.

Missing proof: Built executable and installer icon inspection at small and standard sizes absent at exact source.

Next action: Pin immutable reachable icon metadata and inspect the real executable/installer at required sizes.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `assets/branding/mark.json`, `assets/branding/icon.ico`, `assets/branding/icon.svg`, `scripts/build/branding.cjs`, `package.json`, `src/main/index.cjs`

Original layered mark has deterministic SVG/PNG and seven-resolution ICO generator.

BrowserWindow and executable packaging use tracked ICO.

Squirrel iconUrl points to a mutable GitHub Pages asset, rather than an immutable content address.

No explicit update-metadata icon identity was established.

Missing behavior: Mutable iconUrl violates immutable icon-delivery clause. Exact required surface implementation or a justified accessible equivalent is not independently admitted.

Missing proof: Built executable and installer icon inspection at small and standard sizes absent at exact source. Applicability remains unresolved; no current proof establishes a surface exemption.

Next action: Pin immutable reachable icon metadata and inspect the real executable/installer at required sizes.

Applicability AP-058: The formal ledger requires this surface and no sufficiently specific exemption is admitted. Browser capability constraints or a sibling implementation do not establish nonapplicability. Retain the obligation as partial until its exact accessible equivalent or explicit scope exclusion is reviewed.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `assets/branding/mark.json`, `assets/branding/icon.ico`, `assets/branding/icon.svg`, `scripts/build/branding.cjs`, `package.json`, `src/main/index.cjs`

Original layered mark has deterministic SVG/PNG and seven-resolution ICO generator.

BrowserWindow and executable packaging use tracked ICO.

Squirrel iconUrl points to a mutable GitHub Pages asset, rather than an immutable content address.

No explicit update-metadata icon identity was established.

Missing behavior: Mutable iconUrl violates immutable icon-delivery clause. Exact required surface implementation or a justified accessible equivalent is not independently admitted.

Missing proof: Built executable and installer icon inspection at small and standard sizes absent at exact source. Applicability remains unresolved; no current proof establishes a surface exemption.

Next action: Pin immutable reachable icon metadata and inspect the real executable/installer at required sizes.

Applicability AP-059: The formal ledger requires this surface and no sufficiently specific exemption is admitted. Browser capability constraints or a sibling implementation do not establish nonapplicability. Retain the obligation as partial until its exact accessible equivalent or explicit scope exclusion is reviewed.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `assets/branding/mark.json`, `assets/branding/icon.ico`, `assets/branding/icon.svg`, `scripts/build/branding.cjs`, `package.json`, `src/main/index.cjs`

Original layered mark has deterministic SVG/PNG and seven-resolution ICO generator.

BrowserWindow and executable packaging use tracked ICO.

Squirrel iconUrl points to a mutable GitHub Pages asset, rather than an immutable content address.

No explicit update-metadata icon identity was established.

Missing behavior: Mutable iconUrl violates immutable icon-delivery clause.

Missing proof: Built executable and installer icon inspection at small and standard sizes absent at exact source.

Next action: Pin immutable reachable icon metadata and inspect the real executable/installer at required sizes.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
