# Opt-in HTTPS companion boundary

## Historical baseline and current contract

The detailed six-action protocol below records the original implementation boundary. Current pairing additionally requires a reviewed browser choice and the original client-instance header, and the trusted host now supplies expanded typed action contracts. Read [current browser pairing](../features/browser-pairing.md), [authenticated consumer workflows](../features/companion-consumers.md) and [current collection usage](../postman/api-workflow.md) for those changes. The regenerated category/master collections enumerate the integrated action contracts. Historical fixture descriptions below do not claim coverage or runtime acceptance of the newer contract.

The companion server is disabled until the trusted desktop explicitly starts it. It accepts only supplied HTTPS credentials. It does not generate, install or trust certificates, bypass browser certificate checks, open a wildcard interface or publish an internet listener. Certificate provisioning, browser trust, operating-system firewall permissions and real Windows/LAN behavior require separate verification.

## Trusted host APIs

`createCompanionServer({tls:{key,cert},confirmPairing,onAction,now?})` creates no listener. The host owns both TLS values and both callbacks. The API exposes:

| Method | Result |
| --- | --- |
| `start({host,port})` | Promise resolving `{host,port,authority,origin}` |
| `stop()` | Promise resolving after listener connections close; all sessions revoked |
| `createPairing({origin,scopes})` | `{challenge,origin,scopes,expiresAt}` |
| `revoke(sessionId)` | Boolean indicating whether a known session was revoked |
| `state()` | `{enabled,binding,sessions,operations}`, without cookies, CSRF tokens, challenges or TLS credentials |

Binding requires an explicit literal loopback or private IPv4 address. IPv6 loopback is supported; wildcard, DNS-name, public-IP and other IPv6 bindings are rejected. The native controller additionally restricts binding to a currently observed local interface or loopback. Port zero requests an ephemeral port; an explicit valid port is also supported. Nothing in this implementation binds LAN during unit tests.

`createCompanionController({dialog,parentWindow,onAction,networkInterfaces?,allowedScopes?,now?})` adds a desktop-only `request(action,args)` method. It returns plain action results or throws sanitized coded errors. Expose it only through separately authorized desktop IPC, never through the companion HTTP action dispatcher.

| Desktop action | Arguments |
| --- | --- |
| `companion.status` | `{}` |
| `companion.configure` | `{}` |
| `companion.start` | `{host,port}` |
| `companion.stop` | `{}` |
| `companion.createPairing` | `{origin,scopes}` |
| `companion.revoke` | `{sessionId}` |

Configure uses native certificate and private-key pickers. It reads bounded canonical files, checks their open-file identity and validates the TLS context before replacing the prior inactive configuration. No path or key body is returned. Configuration is memory-only; application restart requires configuration again. Reconfiguration requires stopping the active listener first. TLS files must be regular, singly linked files, not symbolic links.

The controller defaults to the read scopes `workspace:read`, `projects:read` and `jobs:read`. A host may explicitly enable the separately implemented mutation scopes only after their consumer authorization is integrated. A paired browser does not inherit the desktop user's project grants or job ownership.

## Enrollment and HTTP contract

Every request requires the exact configured Host authority and an exact approved HTTPS Origin. Origins contain no path, query, credentials, fragment or wildcard. The host chooses one origin and a finite scope set when creating a five-minute, single-use pairing challenge. The desktop shows that opaque challenge to the user for intentional copying into the browser.

The browser posts JSON `{challenge,clientNonce}` to `/pair`; `clientNonce` is a UUID. The challenge is consumed before native approval. The server invokes `confirmPairing({origin,scopes,clientNonce,remoteAddress})` and creates a session only when the callback returns exactly `true` while the listener and challenge remain valid. Only one native review can be pending. The native controller's review dialog displays the exact origin and scopes, with Cancel as the initial and cancellation action. Possession of the challenge alone does not enroll a browser.

A successful pair response contains `{session,csrfToken,nextSequence:1}` and a host-only `__Host-material-companion` cookie with `Path=/; Secure; HttpOnly; SameSite=None`. The cookie lasts one hour, and the host enforces the same session expiry independently. Browser requests use credentials and the returned CSRF token in `X-CSRF-Token`. Cookies and CSRF tokens are independently random and bound to the same session and approved origin. All sessions are memory-only and lose authority on application restart.

`POST /session` with exact JSON `{}` requires the cookie, origin and CSRF header. It returns `{session,nextSequence}` for the current session. This is session metadata, not a build or connection-success claim.

`POST /actions` accepts exactly `{action,args,sequence,nonce}`. Sequence starts at one and must equal the next accepted session sequence. Nonce is a fresh UUID and cannot repeat within a session. Acceptance reserves both before calling the consumer, preventing parallel retries from dispatching the same authority twice. Clients must not automatically retry an accepted mutation under a new nonce after a lost reply; they first reconcile actual job state. Typed actions are:

| Action | Required scope | Exact arguments |
| --- | --- | --- |
| `workspace.read` | `workspace:read` | `{}` |
| `projects.list` | `projects:read` | `{}` |
| `jobs.list` | `jobs:read` | `{}` |
| `jobs.get` | `jobs:read` | `{jobId:UUID}` |
| `jobs.cancel` | `jobs:cancel` | `{jobId:UUID,expectedSequence:integer}` |
| `builds.submit` | `builds:submit` | `{workspaceId:UUID,runtime:"wsl"|"docker",target:"all"|"clean"|"sdk"|"toolchain",jobs:1..64}` |

There are no arbitrary method names, commands, raw paths or dynamic dispatch targets. Scope admission does not implement the operation. `onAction({action,args},context)` must call an explicitly integrated authorized consumer, enforce the paired principal's project/job ownership and return bounded browser-safe data. The context includes `sessionId`, `origin`, `scopes`, `operationId` and `isAuthorized()`. Consumers recheck authority before later effects rather than retaining a stale grant across asynchronous work. A read-only root integration must leave mutation scopes disabled.

Success returns `{operation,result,nextSequence}`. Operation `succeeded` means the consumer callback returned valid bounded data; it does not mean an accepted build finished. Actual job status belongs to the consumer result and subsequent job discovery. If the callback throws or returns an invalid response, operation state is `unknown`: effects may have occurred, and neither rollback nor cancellation is inferred. Raw callback exception details are not returned.

`POST /disconnect` requires exact JSON `{}`, the current session cookie, exact Host/Origin and CSRF token. It revokes only that cookie's session and returns `{revoked:true,session:{id,status:"revoked"}}`, clearing the secure cookie. Already revoked or expired sessions return HTTP 401 and clear the cookie. A mismatched origin or missing CSRF token cannot revoke another session.

Native `revoke` and `stop` prevent new authority immediately. Already dispatched consumer work remains running until its actual callback settles. State records `authorityRevoked:true`; it does not fabricate stopped, cancelled or rolled-back jobs. Closing a connection does not stop delegated jobs. The host consumer must retain durable job state independently.

## Request and resource limits

JSON bodies are limited to 16 KiB, with duplicate-key, prototype-key, unknown-field, enum and typed-argument rejection. Responses from consumers must be plain JSON of depth at most eight and at most 64 KiB, with arrays limited to 1,000 elements. Header size is limited to 8 KiB; duplicate security headers are rejected. Request, header and keep-alive timeouts are bounded.

Per remote IP, the server admits at most 20 pairing attempts and 120 total requests per minute. Rate buckets are capped at 100 addresses. There are at most 100 outstanding pairing challenges, 100 retained session records and 1,000 retained dispatched-operation records. Each session accepts at most 1,000 action nonces. Capacity exhaustion is explicit, rather than silently evicting history or restoring old authority. Restart clears these ephemeral records and revokes all sessions.

CORS reflects only an exact enrolled or currently challenged origin and allows credentials without wildcards. Preflight admits only POST and the Content-Type/CSRF headers. Private-network preflight acknowledgement is limited to those same approved origins; it does not override browser local-network permission or certificate trust. Actual Edge/Chrome permission and cross-origin cookie behavior remain runtime acceptance work.

## Postman collections

The category collection is [postman/companion.postman_collection.json](postman/companion.postman_collection.json); the master collection for every product HTTP API is [../postman/material-buildroot.postman_collection.json](../postman/material-buildroot.postman_collection.json). The companion is the only HTTP surface, so the master contains exactly one folder that mirrors the category collection.

To use them: start the companion from the desktop with your own TLS files, trust the certificate in the client, create a pairing challenge for the exact origin you will send, then set `baseUrl`, `origin` and `challenge`. Send **Pair browser** and approve the native review. Copy `csrfToken` from the reply into the unshared current value; the client cookie jar keeps the session cookie. After each action, set `sequence` to the reply's `nextSequence`. `{{$guid}}` creates a fresh nonce per send. The mutation actions need scopes the desktop leaves disabled by default.

Regenerate with `node scripts/api/generate-postman.cjs`; `--check` fails when either file is stale. `node --test tests/postman-collections.test.cjs` checks route and action coverage, the absence of credential material, and replays every request in order against a real loopback HTTPS companion with a temporary certificate. That replay is not a Postman-application, LAN, firewall or browser-trust result.

## Current verification

### Browser summary response contract

The browser consumes the host's privacy-filtered `result` directly. `workspace.read` returns
`{revision,onboardingCompleted,plans}`; it does not return a full workspace, preferences, notes,
paths or credentials. `projects.list` returns `{projects}` and `jobs.list` returns `{jobs}`.
Each collection contains only the fields explicitly selected by the host consumer in
`src/main/operations-service.cjs`.

The browser validates the complete result before rendering any record: exact object fields,
bounded strings, non-negative integer counters, Boolean flags and at most 1,000 records.
Malformed replies display a localized unavailable result, retain no raw result for language
rerendering and never display a success notice. A lost response clears the prior displayed
result, marks the sequence uncertain and requires session refresh before another request.
There is no automatic retry. This consumer validation does not grant authority or widen the
host's disclosure boundary.

Run `node --test tests/browser-workflow-contract.test.mjs` for the focused
source regression. It executes the actual host projection and browser rendering code with
in-memory DOM doubles, checks malformed and empty results, language modes and lost replies,
and compares every dynamic supporting article link with the generator's route expression.
This is not installed-browser, TLS, pairing, accessibility or built-layout evidence.

The focused tests create a one-day certificate and private key with OpenSSL in a temporary directory, remove the files and use the certificate as the HTTPS client's trusted CA. They do not disable TLS validation or commit private keys. Actual loopback HTTPS checks cover enrollment, native denial, cookie flags, Host/Origin rejection, CSRF, scopes, replay, expiry, rate limiting, bounded JSON, revocation during delegated work, self-disconnect and exact CORS preflight. Injected dialog tests cover private TLS selection, local-interface restrictions and default-Cancel review. No actual LAN listener, Windows firewall action, browser certificate installation or live paired-browser runtime is exercised by these tests.
