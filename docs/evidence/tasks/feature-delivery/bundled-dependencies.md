# bundled-dependencies delivery source audit

Source snapshot: e722cf1b91ccc46465eb449df4abd84d9d6df2a1. This is a provisional source record; no current complete-feature acceptance is claimed.


Complete single-installer capability bundle, bundled-first discovery and offline proof

Overall: **partial**. This label remains provisional.

Public ledger requirements: `bundled-dependencies-REQ-01`, `bundled-dependencies-REQ-02`, `bundled-dependencies-REQ-03`, `bundled-dependencies-REQ-04`. See `docs/planning/feature-evidence.json` at the source revision above.

| Surface | Status |
|---|---|
| A | partial |
| D | not-applicable-with-reason |
| C | not-applicable-with-reason |
| R | partial |

### A

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `src/main/operations-service.cjs`, `src/main/tools/payload-manager.cjs`, `src/main/tools/runtime.cjs`, `docs/desktop/built-in-tools.md`

Package includes desktop runtime, application source and Kconfig helper source.

createPayloadManager defaults bundledManifest to empty; operations service supplies directory/dialog/parentWindow only.

resolve prefers a supplied bundle, otherwise a persisted user-selected executable receipt.

Runtime executable checks require an admitted absolute path and matching SHA-256.

Missing tool list reports a code but does not enumerate all searched locations.

Package files and resources contain no portable FFmpeg/ImageMagick/Pandoc/LibreOffice/Calibre/qpdf/Java bundle.

Missing behavior: Actual bundled tool payloads and manifest wiring missing. No complete license inventory, size floor/arithmetic or release bundle-size statement. Manual executable selection is not the contract-required bundled delivery.

Missing proof: No offline installed-package origin=bundled proof for exact pin.

Next action: Supply licensed portable payloads and host manifest, validate installed resolution and each offline workflow.

### D

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `src/main/operations-service.cjs`, `src/main/tools/payload-manager.cjs`, `src/main/tools/runtime.cjs`, `docs/desktop/built-in-tools.md`

Package includes desktop runtime, application source and Kconfig helper source.

createPayloadManager defaults bundledManifest to empty; operations service supplies directory/dialog/parentWindow only.

resolve prefers a supplied bundle, otherwise a persisted user-selected executable receipt.

Runtime executable checks require an admitted absolute path and matching SHA-256.

Missing tool list reports a code but does not enumerate all searched locations.

Package files and resources contain no portable FFmpeg/ImageMagick/Pandoc/LibreOffice/Calibre/qpdf/Java bundle.

Missing behavior: Actual bundled tool payloads and manifest wiring missing. No complete license inventory, size floor/arithmetic or release bundle-size statement. Manual executable selection is not the contract-required bundled delivery.

Missing proof: No offline installed-package origin=bundled proof for exact pin.

Next action: Supply licensed portable payloads and host manifest, validate installed resolution and each offline workflow.

### C

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `src/main/operations-service.cjs`, `src/main/tools/payload-manager.cjs`, `src/main/tools/runtime.cjs`, `docs/desktop/built-in-tools.md`

Package includes desktop runtime, application source and Kconfig helper source.

createPayloadManager defaults bundledManifest to empty; operations service supplies directory/dialog/parentWindow only.

resolve prefers a supplied bundle, otherwise a persisted user-selected executable receipt.

Runtime executable checks require an admitted absolute path and matching SHA-256.

Missing tool list reports a code but does not enumerate all searched locations.

Package files and resources contain no portable FFmpeg/ImageMagick/Pandoc/LibreOffice/Calibre/qpdf/Java bundle.

Missing behavior: Actual bundled tool payloads and manifest wiring missing. No complete license inventory, size floor/arithmetic or release bundle-size statement. Manual executable selection is not the contract-required bundled delivery.

Missing proof: No offline installed-package origin=bundled proof for exact pin.

Next action: Supply licensed portable payloads and host manifest, validate installed resolution and each offline workflow.

### R

Shared feature-level source observations may be repeated across surfaces. These references do not establish independent per-surface interaction, persistence or runtime proof.

Source references: `package.json`, `src/main/operations-service.cjs`, `src/main/tools/payload-manager.cjs`, `src/main/tools/runtime.cjs`, `docs/desktop/built-in-tools.md`

Package includes desktop runtime, application source and Kconfig helper source.

createPayloadManager defaults bundledManifest to empty; operations service supplies directory/dialog/parentWindow only.

resolve prefers a supplied bundle, otherwise a persisted user-selected executable receipt.

Runtime executable checks require an admitted absolute path and matching SHA-256.

Missing tool list reports a code but does not enumerate all searched locations.

Package files and resources contain no portable FFmpeg/ImageMagick/Pandoc/LibreOffice/Calibre/qpdf/Java bundle.

Missing behavior: Actual bundled tool payloads and manifest wiring missing. No complete license inventory, size floor/arithmetic or release bundle-size statement. Manual executable selection is not the contract-required bundled delivery.

Missing proof: No offline installed-package origin=bundled proof for exact pin.

Next action: Supply licensed portable payloads and host manifest, validate installed resolution and each offline workflow.

[Return to the delivery index](README.md). [Read the snapshot and admission limits](../PH01-delivery-audit.md).
