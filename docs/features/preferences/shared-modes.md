# Shared modes, attention controls and narration

The persistent Attention & narration entry opens five independent interface accommodations. All five are off by default and persist in the current local profile. Focus de-emphasizes inactive shell panels, restoring them on hover or keyboard focus. Low stimulation removes shell motion and quiets accent colors. Time awareness shows elapsed session time and time since input in the work strip. One thing at a time keeps a user-written next action in that strip. Momentum offers a non-blocking prompt after 20 minutes without interaction, with a one-hour persisted dismissal. Reset restores defaults. These controls make no medical claims.

The existing shared preference enrollment remains authoritative. Unknown or active shared state enforces English, omits narration language customization and the food catalogue, and cancels queued narration before applying English. The stored personal narration language remains recoverable after leaving with the enrolled credential. This feature does not replace or weaken enrollment, vault storage, revision checks or recovery.

## Narration

Narration is off until explicitly enabled. English and Hong Kong Cantonese have separate voice pickers, with automatic selection as the default. Discovery reads actual platform voices and subscribes to late voice-list changes. Voice identities use `voiceURI`; a missing selected voice remains saved while an available fallback is identified. Network-backed voices are identified and skipped offline. No voice for a language produces an explicit capability message rather than an invented voice.

Rate supports 0.1 through 10; pitch supports 0 through 2. Both default to 1. Both-language delivery serializes English before Cantonese. Start sample, pause, resume and stop controls operate the platform speech queue. Mode-change narration uses fixed localized messages, a category cooldown and bounded serialized queue. User-written next actions, credentials, logs, paths, arbitrary DOM and protected content are never read aloud.

## Scheduled settings

Existing scheduled language/theme/profile consumers are preserved. The native scheduled-preferences service remains responsible for timezone and DST matching, cross-midnight rules, deterministic priority and base-setting restoration. This change does not create a competing timer or persist temporary schedule values into base preferences. Attention controls and narration are currently local profile preferences, not new schedule fields.

## Public food catalogue

The catalogue obtains names only from the public `Ding-Ding-Projects/dim-sum-photos` catalogue. Only matching PNG assets in published `catalog-v1` release volumes are admitted. Missing photos are explicitly unavailable. No catalogue metadata or images are copied into the source repository, and no substitute artwork is generated.

Host-only fetching uses fixed HTTPS endpoints, bounded response sizes, 12-second request timeouts, a single catalogue request in flight and a one-minute retry interval. Release-photo redirects are admitted only to the release asset delivery hostname. The renderer cannot supply URLs or filesystem paths. Successful photos may be cached in application data with their source and catalogue revision; a failed cache write does not claim offline availability. Catalogue metadata is held in memory, so a fresh offline launch currently reports the catalogue unavailable even if individual cached photos exist.

One host-owned random draw per eligible launch has a ten-percent success probability. The renderer requests it only after an already-saved, completed setup is loaded and no interaction has occurred. School mode and quiet mode suppress the request. A delayed response is discarded after interaction, restriction changes or teardown. The optional display auto-dismisses after eight seconds, never takes focus and never delays the productive workspace. There is no surprise opt-out setting.

## Verification and remaining coverage

This change was implemented under a build-only delivery scope. Runtime, voice availability, restart persistence, input behavior, visual layout and accessibility acceptance are unverified. The production build is reported separately by its source-bound receipt.

The following requirements remain open and must not be inferred from the controls alone:

- Full attention styling and notification suppression inside every nested shadow-root surface.
- Automatic screen-reader detection/ducking. The user can stop narration, but platform coexistence is not verified.
- Narration of other application event categories, beyond mode changes and fixed guidance.
- Local version-history recording and portable import/export for attention and narration preferences.
- Shared funny-level styling, per-control guidance and full settings-search coverage for the new controls.
- A catalogue metadata cache for fully offline first access, catalogue pagination beyond the first 40 filtered matches, and comprehensive catalogue interaction acceptance.
- Proof that startup surprise is suppressed during every update and exceptional startup route.
- Source-bound runtime evidence for scheduled timezone/DST precedence and every protected mode transition.
