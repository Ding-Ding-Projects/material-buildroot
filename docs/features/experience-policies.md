# Experience preferences

The desktop exposes reversible per-element locks through the context-action provider and a Settings panel. These are self-imposed interaction preferences, not security, encryption, or operation authorization. The operation broker retains its independent capability checks. Window exit and recovery controls are excluded.

## Enrollment and unlocking

Each stable target has its own policy and credential record. Supported policies are PIN, password, PIN plus password, password plus TOTP, PIN plus TOTP, and password plus PIN plus TOTP. The wizard collects ordered factors, confirmation, unlock duration, and disclosure acceptance. PIN typing and the accessible keypad use the same submission and attempt budget. TOTP enrollment requires a current code from the supplied authenticator secret.

A host-admitted, bounded IPC adapter calls the existing experience-policy service. Password/PIN hashes and authenticator secrets are serialized only into the scoped operating-system protected vault. Public state exposes no credential values or references. Replacement and removal require the existing target to be unlocked. Missing protected storage leaves enrollment unavailable rather than storing plaintext.

Locks start locked after process launch. The selected duration is until leaving the surface, a specified number of minutes, or until process close. Lock again is explicit. Pointer, input, drag, keyboard and programmatic click events are intercepted, and the shared command registry consults the access provider for palette activation, inline edits and picker choices. Unlocking does not replay a pending action: select the original action again.

## Timed waiting and local support

After the attempt budget is exhausted, the host supplies and grades single-use, expiring challenges. The ladder restores exactly the attempts that normal waiting restores, does not reset escalation, and permits at most three wait skips per rolling hour. It never grants an authenticated session or authorizes broker work. Restricted-mode state is read by the host; unavailable state starts with arithmetic rather than the food challenge. Timed rounds are graded using host time and individually recorded hits.

Support Tickets are local fictional records. The panel states that nothing is transmitted and nobody is reading them. Records can be searched, exported, advanced and selected for deletion. Recovery shows the actual application-data path and opens that same folder in the platform file manager. The application does not delete the folder. Manual deletion also removes local settings and credentials, so users must preserve their work first.

## Boundaries and deferred acceptance

Persistent identity uses explicit `data-experience-id` attributes, element IDs, or unique composed ancestry. Repeated elements without a stable identity do not receive a persistence target. Full per-element identity coverage, lock configuration history, bulk lock enrollment, appearance-property integration, complete touch/assistive-technology interception and all required display tuples remain incomplete. This implementation does not claim those requirements are satisfied.

Tests, reviews, static analysis, runtime interaction and screenshots were not run in the scoped delivery mode. Source implementation is not runtime verification. In particular protected-store availability, six-policy execution, restart/expiry behavior, stale handles, input-route interception, restricted-mode transitions and timed-round accessibility still require built acceptance.
