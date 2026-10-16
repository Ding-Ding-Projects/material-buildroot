# Authenticated status integration

[香港粵語](status-hub.zh-HK.md)

The trusted desktop process references the maintained Status Hub JavaScript client
from the maintainer-managed local client installation. It does not copy the private
emission implementation or credentials into the application package. Without that
installation, status reports `CLIENT_UNAVAILABLE` and the workspace remains usable.

## Lifecycle and authorization

Startup creates one process-lifetime session using the supported client, with an
in-process random identifier and client-managed session key. The client owns HTTP,
authentication headers, bounded retries, emission validation, heartbeat and reply
cursors. The host reports measured source-checkout inventory when available;
installed distributions report no source checkout rather than inventing one.
Shutdown submits `waiting`, which does not claim that user work completed.

The host reads `AGENT_INGEST_TOKEN` only from trusted-process configuration. Missing
configuration reports `MISSING_ENROLLMENT`. Configure authorization through the
owner-managed enrollment process before launching the desktop. Changing that
configuration requires restarting the process. The supported client's
`STATUS_HUB_URL` selects the endpoint; no renderer input can change the endpoint,
credentials, title, session, inventory or transport options.

## Typed consumer bridge

`studio.statusHub("read")` returns the current safe projection.
`studio.statusHub("refresh")` coalesces concurrent refreshes, publishes fixed host
status and polls the supported inbox. Both methods require the existing admitted
main-frame desktop session. Unknown actions are rejected. The projection contains
only state, a bounded status code, attempt/success timestamps and an authenticated
delivery boolean. It never returns raw transport errors, host paths, credentials,
session keys, arbitrary inbox content or endpoint configuration.

`authenticated` becomes true only after the client records a successful authenticated
write without a current degraded/error state. Health alone is insufficient. Missing
client, missing enrollment and unavailable delivery remain distinct states.
`lastSuccessAt` is historical evidence; it does not turn a current unavailable state
into a connected one. Refresh failures do not block productive work.

## Verification and remaining scope

This source integration adds no renderer presentation. An actual authenticated
create/update, shutdown delivery, protected webhook delivery, display-event delivery
and visible status consumer remain unverified. The selected fast-release workflow
intentionally excludes tests, audits, runtime interaction and screen captures.
Build receipts establish only compilation/package production for their exact source.
The public desktop API is IPC-only; a project Postman collection is not applicable.
