# Use the HTTP collections without confusing them with desktop IPC

[香港粵語](api-workflow.zh-HK.md) · [API collection index](README.md)

The product's HTTP surface is the opt-in HTTPS companion. The [category collection](../security/postman/companion.postman_collection.json) contains its requests; the [master collection](material-buildroot.postman_collection.json) contains the same requests under Security / HTTPS companion. They are real Postman v2.1 JSON collections generated from one definition in `scripts/api/generate-postman.cjs`. They contain placeholders, not a running endpoint or a preapproved session.

## Pair, inspect, act and disconnect

1. Configure the desktop companion with your own TLS certificate and key through its native controls. Trust that certificate through the client's supported certificate route. Do not disable TLS verification.
2. Create a pairing challenge for the exact HTTPS origin you will send. Set `baseUrl` to the exact endpoint reported by the desktop, including its port, and set `origin` and the single-use `challenge` in unshared current values.
3. Send **Pair browser**, then approve the native desktop review of the origin and scopes. Copy the reply's `csrfToken` to an unshared current value. The client's cookie jar retains the secure session cookie. The challenge alone cannot enroll a client.
4. Send **Read session** to obtain the current `nextSequence`. Set `sequence` to that value before each action. `{{$guid}}` creates a fresh UUID nonce. Read the actual operation result, then use its next sequence rather than assuming the previous action was accepted.
5. Send **Disconnect** to revoke this session. It does not cancel already dispatched jobs. Inspect durable job state separately.

Neither collection stores certificates, cookies, usable challenges or session credentials. Do not save populated current values into a shared workspace, collection export, repository, diagnostic record or screenshot.

## Request inventory

| Request | Body and authority |
| --- | --- |
| `POST /pair` | `{challenge,clientNonce}`; exact approved origin, single-use five-minute challenge and native approval |
| `POST /session` | `{}`; current cookie, exact origin and CSRF header |
| `POST /actions` | `{action,args,sequence,nonce}`; session scopes plus consumer authorization |
| `POST /disconnect` | `{}`; current cookie, exact origin and CSRF header |

The six baseline typed actions in the existing collection snapshot are `workspace.read`, `projects.list`, `jobs.list`, `jobs.get`, `jobs.cancel` and `builds.submit`. Their original arguments and scopes are in the [protocol article](../security/companion.md#enrollment-and-http-contract). This snapshot does not claim complete coverage of newer host-admitted `actionContracts` or later pairing headers and request fields. Collection regeneration must use the exact integrated host contract before claiming current API completeness. The desktop defaults to read scopes. A mutation request appearing in a collection does not enable its scope or implement its consumer.

## Recover an uncertain reply

An accepted action reserves its sequence and nonce before dispatch. A lost reply or `unknown` operation state may mean effects occurred. Do not automatically resend a mutation with a fresh nonce. Refresh the session, inspect jobs with `jobs.list` or `jobs.get`, and reconcile the actual result first. Native revocation or disconnect prevents new authority but does not prove existing work stopped.

The host requires exact Host and Origin, rejects duplicate security headers, validates typed fields and limits request JSON to 16 KiB. Consumer responses are bounded to depth eight, 64 KiB and 1,000 array entries. Sessions last one hour, are memory-only and lose authority on desktop restart. The [protocol article](../security/companion.md#request-and-resource-limits) records capacity, rate, CORS and expiry behavior.

## What has no Postman request

Project adoption, source changes, settings, configuration, output viewers, local history, documentation, package editing and host execution use the validated desktop IPC bridge. A renderer operation name is not an HTTP URL. Cloud/provider adapters and the authenticated Status Hub client are outbound host consumers, not additional product HTTP endpoints. Adding invented collection requests would misrepresent those boundaries.

## Generation and acceptance

The existing root documentation producer owns regeneration of articles and wiki routes. Collection generation uses `node scripts/api/generate-postman.cjs`; its existing `--check` mode reports stale files. The focused collection fixture is described in the [protocol article](../security/companion.md#postman-collections), but no generator, test, Postman session, TLS connection, browser pairing, LAN request or runtime exercise was run for this documentation change. Source inventory, generated publication and installed-client acceptance remain separate.
