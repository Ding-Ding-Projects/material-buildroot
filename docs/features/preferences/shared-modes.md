# Shared modes, attention controls and narration

The persistent Attention & narration entry opens five independent interface accommodations. All five are off by default and persist in the current local profile. Focus outlines the active panel, record or section and removes inactive elevation without reducing text contrast. Low stimulation removes motion and quiets accent colors in discovered open shadow roots, including dynamically mounted controls. System reduced motion is respected independently. Explicitly marked nonessential routine notifications are hidden; warnings, decisions and unclassified notifications remain visible. Time awareness shows elapsed session time and time since input in the work strip. One thing at a time keeps a user-written next action in that strip. Momentum offers a non-blocking prompt after 20 minutes without interaction, with a one-hour persisted dismissal. Reset restores defaults. These controls make no medical claims.

The existing shared preference enrollment remains authoritative. Unknown or active shared state enforces English, omits narration language customization and the food catalogue, and cancels queued narration before applying English. The stored personal narration language remains recoverable after leaving with the enrolled credential. This feature does not replace or weaken enrollment, vault storage, revision checks or recovery.

## Narration

Narration is off until explicitly enabled. English and Hong Kong Cantonese have separate voice pickers, with automatic selection as the default. Discovery reads actual platform voices and subscribes to late voice-list changes. Voice identities use `voiceURI`; a missing selected voice remains saved while an available fallback is identified. Network-backed voices are identified and skipped offline. No voice for a language produces an explicit capability message rather than an invented voice.

Rate supports 0.1 through 10; pitch supports 0 through 2. Both default to 1. Both-language delivery serializes English before Cantonese. Start sample, pause, resume and stop controls operate the platform speech queue. Mode-change and admitted operation-state narration use fixed localized messages, a category cooldown and bounded serialized queue. Operation sequence numbers reject duplicate or older events; event bodies and identifiers never enter spoken text. Failed, interrupted and partial operations use the error category without its ordinary cooldown. User-written next actions, credentials, logs, paths, arbitrary DOM and protected content are never read aloud.

Low stimulation silences narration while preserving the user's enabled preference. Observed live-region changes conservatively pause narration for three seconds, without reading the announced content; repeated announcements extend this pause. A manual pause is not undone by this timer. This is coexistence behavior, not detection of whether a screen reader is running. Root observers and speech subscriptions are disposed when the component detaches.

## Preference history and transfer

Each local preference save queues a redacted snapshot into the existing app-owned bare Git history adapter under a separate attention namespace. The pending queue persists locally and retries in order. If preservation fails, the UI reports pending history and stops further preference changes until retry. It never reports a failed history write as completed. History is browsable in pages of 25 revisions; restoring a revision appends a new snapshot rather than rewriting history.

The JSON export/import controls transfer mode switches and narration enablement, language, rate and pitch. They exclude arbitrary next-action text, installed voice identities and snooze timestamps. Those local values survive import and history restoration. The importer validates the whole bounded schema before applying anything, rejects unknown keys and files larger than 2048 bytes, and creates new history for an accepted import. Protected shared mode omits import and restoration controls. Host IPC accepts only the fixed history actions and bounded, validated snapshots; it exposes no path or command argument.

## Scheduled settings

Existing scheduled language/theme/profile consumers are preserved. The native scheduled-preferences service remains responsible for timezone and DST matching, cross-midnight rules, deterministic priority and base-setting restoration. This change does not create a competing timer or persist temporary schedule values into base preferences. Attention controls and narration are currently local profile preferences, not new schedule fields.

## Public food catalogue

The catalogue obtains names only from the public `Ding-Ding-Projects/dim-sum-photos` catalogue. Only matching PNG assets in published `catalog-v1` release volumes are admitted. Missing photos are explicitly unavailable. No catalogue metadata or images are copied into the source repository, and no substitute artwork is generated.

Host-only fetching uses fixed HTTPS endpoints, bounded response sizes, 12-second request timeouts, a single catalogue request in flight and a one-minute retry interval. Release-photo redirects are admitted only to the release asset delivery hostname. The renderer cannot supply URLs or filesystem paths. Successful photos may be cached in application data with their source and catalogue revision; a failed cache write does not claim offline availability. Catalogue metadata is held in memory, so a fresh offline launch currently reports the catalogue unavailable even if individual cached photos exist.

One host-owned random draw per eligible launch has a ten-percent success probability. The renderer requests it only after an already-saved, completed setup is loaded and no interaction has occurred. School mode and quiet mode suppress the request. A delayed response is discarded after interaction, restriction changes or teardown. The optional display auto-dismisses after eight seconds, never takes focus and never delays the productive workspace. There is no surprise opt-out setting.

## Verification and remaining coverage

This change was implemented under a build-only delivery scope. Runtime, voice availability, restart persistence, input behavior, visual layout and accessibility acceptance are unverified. The production build is reported separately by its source-bound receipt.

The following requirements remain open and must not be inferred from the controls alone:

- Styling of closed shadow roots or third-party surfaces that do not expose their DOM remains unavailable. Notification quieting requires explicit nonessential/routine classification and never guesses from message text.
- Automatic screen-reader detection remains unavailable. Conservative live-region yielding is implemented but platform coexistence remains unverified.
- Event producers outside the admitted operation-event bridge require their own explicit fixed-phrase mapping; arbitrary status text is deliberately not narrated.
- History recovery after interruption between a successful host append and local queue acknowledgement may append the same redacted snapshot again. This retains prior history and is not deduplicated across restarts.
- Shared funny-level styling, per-control guidance and full settings-search coverage for the new controls.
- A catalogue metadata cache for fully offline first access, catalogue pagination beyond the first 40 filtered matches, and comprehensive catalogue interaction acceptance.
- Proof that startup surprise is suppressed during every update and exceptional startup route.
- Source-bound runtime evidence for scheduled timezone/DST precedence and every protected mode transition.
