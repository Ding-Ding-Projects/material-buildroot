# Window-wide personal wording: bounded desktop evidence

## Source and build

The exact desktop entrypoint, `build.bat /s --target desktop`, succeeded at source `e463ef114d7975febf7bee58b888ff044f9c03a0`. The executable was unsigned when independently inspected. Root build receipt SHA-256: `da3df437fecb11f9c3d7cafe180586ed9a7854f69b5f529109e35d4d21253b67`. Executable SHA-256: `76cda5bc94a78c9d7319fa23c62e3ab2c204ac0c096be37882a0c03322cff475`. Packaged payload SHA-256: `86ae92e10a5683cc60141445abbc7f9c02bfa84bdce04c329ce29132d353c5a7`.

## Observed behavior

The actual packaged desktop passed 29 bounded behavior checks, including a real normal close and restart. CDP-dispatched synthetic file drops applied neutral wording without navigation. Settings input used the same validation and feedback route. Malformed JSON, oversized data, non-JSON filenames and multiple-file input preserved the previous selection. The polite live region retained focus and permitted continued input. The normal-motion sequence measured 3,480 ms; reduced motion used a static hold. Success and invalid feedback remained inside the real setup modal's accessible boundary. Wording survived normal restart, and clear restored original wording after reload and removed active feedback.

At the single bilingual/light tuple, the logical viewport was 1280×752 with actual DPR 1.5. The feedback host filled that viewport; its 900×88 card was contained, with equal 900 px client and scroll widths. The first bounded observation recorded zero console errors, exceptions, log errors and HTTP requests. Restart recorded zero runtime errors. These are interval-specific observations.

Both recorded four-process trees, their endpoints and both named hidden desktops were absent after normal close. Verification profiles were retained. The exact assembled desktop bytes and original private receipts are preserved separately without changing their source bindings.

## Limits and remaining work

This establishes synthetic CDP drop delivery and Settings input assignment, not actual OLE dragging or native file-picker operation. Polite live-region semantics do not prove screen-reader speech. The complete language/theme/viewport/scale matrix, installed-package behavior and update behavior remain unverified.

Nine genuine PNGs were inspected privately. They are not promoted here: the capture helper omitted per-image capture start/completion clocks, and adjacent observations or filesystem timestamps cannot replace them. A new qualifying capture requires actual producer timestamps and the complete promotion receipt. Normal-motion applied/invalid images also include an entry transition and are not settled-layout evidence.

An independent source review subsequently confirmed that a valid empty or ordinary-whitespace headline can suppress meaningful success feedback. That edge case was not run in this native session. Its bounded follow-up changes only transient headline selection, preserving the valid stored mapping; the 29 checks above remain bound to the original source and do not verify that later repair.

The [109-feature baseline audit](PH01-delivery-audit.md) remains provisional and unchanged by this narrow result.
