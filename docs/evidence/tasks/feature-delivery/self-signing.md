# self-signing delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Required-format project-owned signing only; no invented trust or secret exposure

Overall: **not-applicable-with-reason**. This label remains provisional.

Public ledger requirements: `self-signing-REQ-01`, `self-signing-REQ-02`, `self-signing-REQ-03`, `self-signing-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | not-applicable-with-reason |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | not-applicable-with-reason |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `scripts/build/driver.cjs`, `.github/workflows/release.yml`

No CRX or other format requiring a signature is shipped by this product.

Unsigned Squirrel path sets forceCodeSigning false and CSC_IDENTITY_AUTO_DISCOVERY false.

No signing key or protected store was read.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: Unsigned binary readback remains part of Squirrel proof, not self-signature proof.

Next action: Retain unsigned delivery; apply protected project-owned signing only if a future required format needs it.

Applicability AP-056: The linked authority requires signing only for an output format or runtime that requires a signature. The pinned Squirrel output disables signing and no signature-required format is identified. Current unsigned-package verification remains required separately.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `scripts/build/driver.cjs`, `.github/workflows/release.yml`

No CRX or other format requiring a signature is shipped by this product.

Unsigned Squirrel path sets forceCodeSigning false and CSC_IDENTITY_AUTO_DISCOVERY false.

No signing key or protected store was read.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: Unsigned binary readback remains part of Squirrel proof, not self-signature proof.

Next action: Retain unsigned delivery; apply protected project-owned signing only if a future required format needs it.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `scripts/build/driver.cjs`, `.github/workflows/release.yml`

No CRX or other format requiring a signature is shipped by this product.

Unsigned Squirrel path sets forceCodeSigning false and CSC_IDENTITY_AUTO_DISCOVERY false.

No signing key or protected store was read.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: Unsigned binary readback remains part of Squirrel proof, not self-signature proof.

Next action: Retain unsigned delivery; apply protected project-owned signing only if a future required format needs it.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `scripts/build/driver.cjs`, `.github/workflows/release.yml`

No CRX or other format requiring a signature is shipped by this product.

Unsigned Squirrel path sets forceCodeSigning false and CSC_IDENTITY_AUTO_DISCOVERY false.

No signing key or protected store was read.

Missing behavior: No additional behavior absence asserted for this bounded slice.

Missing proof: Unsigned binary readback remains part of Squirrel proof, not self-signature proof.

Next action: Retain unsigned delivery; apply protected project-owned signing only if a future required format needs it.

Applicability AP-057: The linked authority requires signing only for an output format or runtime that requires a signature. The pinned Squirrel output disables signing and no signature-required format is identified. Current unsigned-package verification remains required separately.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
