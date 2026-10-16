# Desktop updates

The installed Windows package starts a host-owned update check after 15 seconds and repeats discovery every six hours. A manual check resumes discovery after cancellation. Development and non-Windows processes report that automatic installation is unavailable. One updater instance is shared by the operations workspace and persistent application banner; the renderer polls its redacted state every two seconds without initiating discovery.

## Feed and version selection

The feed is pinned to `Ding-Ding-Projects/material-buildroot`. Discovery reads at most ten pages of normal releases and accepts the established `vX.Y.Z` and `vX.Y.Z-build.N.N` tag forms. Only a strictly greater numeric version than `app.getVersion()` is eligible. Same-version source changes are never offered as upgrades, and publication dates never permit downgrading. The packaging receipt's `packageVersion` must agree with the installed package, release tag and provenance. Hosted builds use the configured monotonically increasing build version; local source versions are not automatically release versions.

The release must contain `Setup.exe`, `provenance.json` and `SHA256SUMS.txt`. Asset URLs name the selected repository and tag. Metadata checks cover the provenance checksum, version, source/tag relationship, Windows x64, genuine Squirrel format, unsigned status, bounded size and installer SHA-256. HTTPS redirects are restricted to GitHub's configured asset hosts. These checks establish transport integrity within repository control, not independently signed publisher authenticity.

## Download and cancellation

Discovery automatically downloads an eligible installer in the background. Downloads stream into an owned partial file and resume only after an exact matching HTTP range response. The full expected length and SHA-256 must match before the completed file is exposed as ready. Existing completed files are revalidated, and the installer is checked again immediately before launch. Cancellation aborts the active request and suspends scheduled discovery for the session. Retry or manual check resumes work; restarting the application resumes normal scheduling and revalidates retained data. Corrupt partial content is removed rather than installed. Existing user data and installed versions are retained.

The persistent localized ready banner shows the exact version, unsigned warning, release-note action, saved-work acknowledgement, `Restart to install update`, and `Later`. Later leaves a persistent reminder. The update workspace provides discovery, state, cancellation and download-recovery controls; restart is initiated through the global banner so the shell can check drafts.

## Explicit application restart

The renderer blocks restart for known unsaved plan or language edits, pending schedule drafts, active saves, configuration edits and jobs. Nested editors without a complete saved-work contract are conservatively blocked until they are closed. An additional explicit acknowledgement requires the user to save every other draft. The host blocks installation during active operations and queued/running builds, freezes new operation admission while confirmation is open, and displays a native bilingual unsigned-installer confirmation defaulting to Later. Cancellation returns focus and preserves the ready state.

Only after confirmation does the host revalidate the staged installer and launch its exact host-selected path without a shell or renderer-provided arguments. It requests a normal application quit, preserving before-quit/beforeunload protections; it never forces process exit and never restarts the computer. The genuine interactive Squirrel Setup performs installation and its own application lifecycle. If setup is cancelled, fails, or does not relaunch the application, reopen the existing installation manually. No unattended rollback or recovery installation occurs.

A bounded local transition receipt records the previous and expected numeric versions. The next launch reports the expected version reached, installation incomplete, rollback detected, or an unreadable recovery record. Installer process launch alone never means that installation succeeded. The receipt does not claim file compatibility, profile migration success or installer authenticity.

## Evidence boundary

This change is source implementation under a no-tests/no-runtime-verification delivery mode. Real Windows upgrade, native cancellation, interrupted transfer, profile migration, unsaved-state preservation, focus return, restart, version transition, rollback and accessibility behavior remain unverified. No installed application was updated, restarted or downloaded by this task.
