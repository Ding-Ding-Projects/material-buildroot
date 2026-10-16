# Experience preferences

[香港粵語](experience-policies.zh-HK.md)

The desktop exposes reversible per-element locks through the context-action provider and a Settings panel. These are self-imposed interaction preferences, not security, encryption, or operation authorization. The operation broker retains its independent capability checks. Window exit and recovery controls are excluded.

## Enrollment and unlocking

Each stable target has its own policy and credential record. Supported policies are PIN, password, PIN plus password, password plus TOTP, PIN plus TOTP, and password plus PIN plus TOTP. The wizard collects ordered factors, confirmation, unlock duration, and disclosure acceptance. PIN typing and the accessible keypad use the same submission and attempt budget. TOTP enrollment requires a current code from the supplied authenticator secret.

A host-admitted, bounded IPC adapter calls the existing experience-policy service. Password/PIN hashes and authenticator secrets are serialized only into the scoped operating-system protected vault. Public state exposes no credential values or references. Replacement and removal require the existing target to be unlocked. Missing protected storage leaves enrollment unavailable rather than storing plaintext.

Locks start locked after process launch. The selected duration is until leaving the surface, a specified number of minutes, or until process close. Lock again is explicit. Pointer, input, drag, keyboard and programmatic click events are intercepted, and the shared command registry consults the access provider for palette activation, inline edits and picker choices. Unlocking does not replay a pending action: select the original action again.

## Timed waiting and local support

After the attempt budget is exhausted, the host supplies and grades single-use, expiring challenges. The ladder restores exactly the attempts that normal waiting restores, does not reset escalation, and permits at most three wait skips per rolling hour. It never grants an authenticated session or authorizes broker work. Restricted-mode state is read by the host; unavailable state starts with arithmetic rather than the food challenge. Timed rounds are graded using host time and individually recorded hits.

Support Tickets are local fictional records. The panel states that nothing is transmitted and nobody is reading them. Records can be searched, exported, advanced and selected for deletion. Recovery shows the actual application-data path and opens that same folder in the platform file manager. The application does not delete the folder. Manual deletion also removes local settings and credentials, so users must preserve their work first.

## Boundaries and deferred acceptance

Persistent identity uses explicit `data-experience-id` attributes, element IDs, or unique composed ancestry. Repeated elements without a stable identity do not receive a persistence target. Full per-element identity coverage, complete touch/assistive-technology interception and all required display tuples remain incomplete. This implementation does not claim those requirements are satisfied.

Tests, reviews, static analysis, runtime interaction and screenshots were not run in the scoped delivery mode. Source implementation is not runtime verification. In particular protected-store availability, six-policy execution, restart/expiry behavior, stale handles, input-route interception, restricted-mode transitions and timed-round accessibility still require built acceptance.

## Connected settings, bulk enrollment and configuration history

The Settings search has an Experience entry that renders the real consumer. The bulk enrollment control discovers currently registered targets and walks them one at a time, clears credentials between targets, requires independent confirmation and supports skipping without changing that target. Existing locked targets must first be unlocked with their current factors. Navigation destinations and interface-language settings carry explicit stable identities; the registry also accepts unique composed ancestry and explicit IDs. Ambiguous repeated controls are reported as unavailable for persistent enrollment, never assigned a list position.

Configuration changes increment a durable revision. The existing app-owned bare-history abstraction preserves an allowlisted snapshot containing only the configuration revision, its fixed timestamp and target/policy/duration entries. The panel displays the newest 25 records. Neither credentials, credential references, hashes, authenticator seeds nor personal wording enter these snapshots. An unavailable history write is reported explicitly. A later configuration mutation waits until the pending revision can be preserved, retaining the usable current state. Ordinary workspace restore does not modify experience lock state or resurrect missing credentials.

Appearance property rows expose stable identities containing the target key, visual state and property key. The experience consumer registers with the appearance permission provider, so save, reset, import and motion-track consumers check the corresponding policies before applying changes. Until experience state is available, appearance mutations remain unavailable. Policy management stays outside the original-action lock check so an unlocked property can always be relocked and a locked property can reach authentication and recovery.

## Local authenticator pairing

For enrollment policies containing TOTP, the wizard can reuse the local authenticator pairing consumer. Generation requires an explicit reveal consent, then shows a temporary QR matrix and manual key locally. The user saves the pairing in an authenticator, explicitly selects it for this element, and supplies a current code. The existing experience enrollment verifier checks that code before storing the independent element credential. Generated parameters are SHA-1, six digits and a 30-second period, matching the experience engine. No external account or standalone authenticator entry is enrolled.

Temporary pairing state is kept only in memory and cleared on cancellation, completion, policy changes, disconnection, document hiding, navigation or expiry. Targeted pending cancellation does not clear another consumer's enrollment. Setup values do not enter configuration history, ticket export, logs or ordinary settings. Copy is explicit and warns that the clipboard may retain the key. Supplied-key enrollment remains available.

This source integration does not establish QR scanning, authenticator interoperability, clock-skew, lifecycle or accessibility runtime acceptance. No actual account enrollment, tests, reviews or captures were performed for this change.
