# qr-pairing delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Actual scannable pairing and manual equivalent, private secret handling

Overall: **partial**. This label remains provisional.

Public ledger requirements: `qr-pairing-REQ-01`, `qr-pairing-REQ-02`, `qr-pairing-REQ-03`, `qr-pairing-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | missing |
| C | missing |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `src/main/security/experience-policy.cjs`, `src/renderer/companion-panel.ts`

experience-policy verifies supplied TOTP but creates no QR/URI. companion-panel five-minute browser challenge is not OTP registration. D/C lack QR consumer.

Missing behavior: experience-policy verifies supplied TOTP but creates no QR/URI. companion-panel five-minute browser challenge is not OTP registration. D/C lack QR consumer.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`

experience-policy verifies supplied TOTP but creates no QR/URI. companion-panel five-minute browser challenge is not OTP registration. D/C lack QR consumer.

Missing behavior: experience-policy verifies supplied TOTP but creates no QR/URI. companion-panel five-minute browser challenge is not OTP registration. D/C lack QR consumer.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `website/app.js`

experience-policy verifies supplied TOTP but creates no QR/URI. companion-panel five-minute browser challenge is not OTP registration. D/C lack QR consumer.

Missing behavior: experience-policy verifies supplied TOTP but creates no QR/URI. companion-panel five-minute browser challenge is not OTP registration. D/C lack QR consumer.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `docs/planning/feature-evidence.json`

Admission-only planned consumers do not establish delivery; complete localized articles and current runtime proof remain incomplete.

Missing behavior: Admission-only planned consumers do not establish delivery; complete localized articles and current runtime proof remain incomplete.

Missing proof: No current pinned built proof inspected.

Next action: Complete controls and authority, then obtain current interaction, persistence and negative proof.

Applicability AP-034: R records supporting documentation, implementation and verification obligations for this feature. It is not a fourth independent runtime consumer. The formal ledger excluded the runtime surface; supporting record incompleteness remains assessed without changing that exclusion.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
