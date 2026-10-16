# release-timing delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Actual workflow start/completion/duration in notes

Overall: **partial**. This label remains provisional.

Public ledger requirements: `release-timing-REQ-01`, `release-timing-REQ-02`, `release-timing-REQ-03`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | not-applicable-with-reason |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `scripts/release/publish.cjs`

Publisher queries attempt jobs, chooses earliest started_at and renders UTC start/end plus HH:mm:ss.

Initial release notes say publication in progress; completed timestamp is taken after release create but before final release edit and asset/tag verification.

Missing behavior: Recorded end excludes the final publication edit and verification steps.

Missing proof: No exact-run timing consistency readback.

Next action: Refute the end-boundary interpretation independently, then record a real final-publication timestamp and verify against the run.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `scripts/release/publish.cjs`

Publisher queries attempt jobs, chooses earliest started_at and renders UTC start/end plus HH:mm:ss.

Initial release notes say publication in progress; completed timestamp is taken after release create but before final release edit and asset/tag verification.

Missing behavior: Recorded end excludes the final publication edit and verification steps.

Missing proof: No exact-run timing consistency readback.

Next action: Refute the end-boundary interpretation independently, then record a real final-publication timestamp and verify against the run.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `scripts/release/publish.cjs`

Publisher queries attempt jobs, chooses earliest started_at and renders UTC start/end plus HH:mm:ss.

Initial release notes say publication in progress; completed timestamp is taken after release create but before final release edit and asset/tag verification.

Missing behavior: Recorded end excludes the final publication edit and verification steps.

Missing proof: No exact-run timing consistency readback.

Next action: Refute the end-boundary interpretation independently, then record a real final-publication timestamp and verify against the run.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `scripts/release/publish.cjs`

Publisher queries attempt jobs, chooses earliest started_at and renders UTC start/end plus HH:mm:ss.

Initial release notes say publication in progress; completed timestamp is taken after release create but before final release edit and asset/tag verification.

Missing behavior: Recorded end excludes the final publication edit and verification steps.

Missing proof: No exact-run timing consistency readback.

Next action: Refute the end-boundary interpretation independently, then record a real final-publication timestamp and verify against the run.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
