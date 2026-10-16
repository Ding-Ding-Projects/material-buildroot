# Local authenticator and pairing

[香港粵語](authenticator.zh-HK.md)

The Authenticator destination adds local TOTP enrollment and code display. It is registered in the existing workspace destination catalog and command provider, using the same shell navigation consumer. It does not contact an account service, synchronize entries or check time over the network.

## Enrollment

Paste an `otpauth://totp/` URI or enter a base32 key, issuer, account, SHA-1/SHA-256/SHA-512 algorithm, six to eight digits and a period from 1 to 86400 seconds. URI values are retained; duplicate or unsupported URI fields, HOTP URIs, invalid encodings and conflicting issuers are rejected. Secret inputs are bounded and never appear in diagnostics.

Select the explicit temporary-display consent and choose **Review pairing**. The host creates a QR matrix with pinned `qrcode` 1.5.4. The renderer draws it on a local canvas, with a four-module quiet zone and black modules on white in either theme. No QR service, network image, disk image or data-URL export is used. Manual grouped base32 and the exact algorithm, digits and period appear alongside it. The manual-copy button explicitly warns that the operating-system clipboard may retain the value.

Type one current code to complete enrollment. The pending enrollment expires in five minutes and permits at most five unsuccessful confirmations. Nothing is persisted before confirmation. Cancel, leaving the destination and hiding the document clear the transient renderer state. Encrypted stored secrets have no reveal API.

QR image and clipboard-image imports use the platform `BarcodeDetector` when present. Images are limited to 10 MiB and decoded images to 16 million pixels. Exactly one TOTP QR result is accepted. The existing desktop permission policy is preserved: a platform without QR detection or clipboard permission reports the import as unavailable. URI/manual input remains available. Camera capture is not implemented and no camera permission has been added.

## Entries and protected storage

Entries display grouped current codes, copy-current-code actions, a textual countdown and an explicit next-code toggle. Search uses the existing plain-text/regex search component. Entries can be reordered, grouped and selected for bulk removal or bulk group assignment. Issuer, account and a short text/emoji icon can be edited without changing the secret or code parameters. Metadata export explicitly states that secrets and authentication codes are omitted. Deliberate secret export is unavailable.

The admitted desktop IPC is bounded, serialized and returns fixed diagnostics. A capability-scoped host vault owns every secret. Only display metadata and opaque vault references enter the index and isolated append-only local history. The history manager uses a separately enrolled password verifier protected by the vault, with a salted scrypt derivation, five-minute unlock expiry and a thirty-second delay after five incorrect attempts. It pages revision numbers, searches them, displays redacted metadata comparisons, appends labels, exports the selected redacted revision and restores a selected snapshot only after explicit acknowledgement and a current-revision check. Password changes require both the current password and a confirmed replacement, then relock the manager. Password derivation is asynchronous; the admitted document generation is checked again before state changes. Navigation revokes pending pairing and history access. Restore verifies that every referenced encrypted record remains readable and creates a new revision. History responses contain neither vault references nor secrets. Removal retains encrypted historical records for future recovery, so it is not secure erasure. A failed history write prevents the metadata update. The host rejects unavailable or insecure protected storage, and refuses malformed existing indexes rather than resetting them. A history write followed by an index-write failure requires recovery before another mutation; the previous index remains retained.

The code calculation follows the RFC 6238 time-counter construction over RFC 4226 dynamic truncation. Device time is the only time source. The surface explicitly says clock accuracy is not independently verified and reports a detected local clock discontinuity. It cannot discover a constant clock offset without an external trusted reference. A local experience lock whose authenticator resides in the same application is ornamental; the destination states this plainly.

## Integration API

`studio.authenticator` exposes the admitted `status`, `begin`, `generate`, `confirm`, `cancel`, targeted `cancelPairing`, `codes`, `remove`, `organize`, `edit`, `bulkGroup` and password-protected metadata-history actions. `generate` creates a temporary random enrollment after explicit reveal consent for a local factor consumer. It does not save an authenticator entry automatically. Up to eight temporary pairings can coexist; consumers cancel only their own pending identifier. The reusable `authenticator-pairing` component accepts only a temporary pairing response and draws the matrix; consumers must clear it on cancellation, expiry, navigation and completion. A local lock consumer must verify its entered code before arming the factor.

## Verification state and remaining work

This delivery contains source changes only. Tests, static analysis, independent review, runtime exercises and screenshots were explicitly deferred. RFC vectors, scanner interoperability, countdown rollover, protected-storage restart persistence, invalid-data rejection, accessibility and narrow-layout behavior are **unverified**. A successful future build alone will not establish those claims.

Remaining implementation includes camera capture through a narrowly authorized native permission flow, a bundled decoder for platforms without `BarcodeDetector`, history pruning and deliberate secret export through the separate confirmation contract. Password recovery is not implemented; lost history-manager credentials leave ordinary authenticator entries available but the history manager locked. The reusable pairing display has a separately owned local-lock consumer integration that must land with the targeted cancellation API. Do not mark full authenticator acceptance complete until these implementation and verification gaps are resolved.

## Sources and dependency

- [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), TOTP construction and published vectors.
- [RFC 4226](https://www.rfc-editor.org/rfc/rfc4226), HOTP dynamic truncation.
- [node-qrcode](https://github.com/soldair/node-qrcode), pinned production dependency 1.5.4, MIT license. Its local matrix encoder is used in the trusted host process. The lockfile records registry integrity; no dependency lifecycle script was run during lockfile preparation.
